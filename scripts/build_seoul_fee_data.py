#!/usr/bin/env python3
"""Normalize the collected Seoul district fee sources into TypeScript data.

Inputs are intentionally kept outside ``src``: ELIS ordinance annexes converted
to XHTML by ``collect_seoul_fees.py``, two district reporting portal pages, and
the Gangbuk Open Data CSV.  The generated file is the only build-time input.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
from lxml import html


ROOT = Path(__file__).resolve().parents[1]

REGIONS = {
    "gangnam": "강남구", "gangdong": "강동구", "gangbuk": "강북구",
    "gangseo": "강서구", "gwanak": "관악구", "gwangjin": "광진구",
    "guro": "구로구", "geumcheon": "금천구", "nowon": "노원구",
    "dobong": "도봉구", "ddm": "동대문구", "dongjak": "동작구",
    "mapo": "마포구", "sdm": "서대문구", "seocho": "서초구",
    "seongdong": "성동구", "seongbuk": "성북구", "songpa": "송파구",
    "yangcheon": "양천구", "ydp": "영등포구", "yongsan": "용산구",
    "ep": "은평구", "jongno": "종로구", "junggu": "중구",
    "jungnang": "중랑구",
}

XHTML_REGION_IDS = (
    "dobong", "dongjak", "gangnam", "gangseo", "geumcheon", "guro",
    "gwanak", "sdm", "jongno", "junggu", "yongsan", "ddm", "jungnang",
    "seongbuk", "mapo", "yangcheon", "ydp", "seocho", "gangdong",
    "gwangjin", "ep",
)

# Direct reporting pages are retained where the current official endpoint was
# verified.  Other districts deliberately use an official-search fallback
# rather than guessing a deep link that may silently change.
REPORT_URLS = {
    "sdm": "https://www.sdm.go.kr/civil/print/xpay/reg.do",
    "jongno": "https://jongno.go.kr/waste/pc/web/expense/selectExpenseList.do",
    "nowon": "https://smartclean.nowon.kr/online/bulky/request",
    "songpa": "https://smartclean.songpa.go.kr/online/bulky/request",
}

PHONES = {
    "sdm": "02-330-1376",
    "jongno": "02-2148-2376",
    "nowon": "02-2116-3806",
    "songpa": "02-2147-6380",
    "gangbuk": "02-901-6114",
}


def clean(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    value = str(value).replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def column_name(value: Any) -> str:
    if isinstance(value, tuple):
        return " ".join(clean(part) for part in value if "Unnamed" not in clean(part))
    return clean(value)


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", clean(value))


def parse_fee(value: Any) -> int | None:
    text = clean(value)
    if not text:
        return None
    if any(token in text for token in ("면제", "무상", "무료")):
        return 0
    match = re.search(r"\d[\d,]*", text)
    return int(match.group(0).replace(",", "")) if match else None


def unique(rows: Iterable[tuple[str, str, int]]) -> list[tuple[str, str, int]]:
    seen: set[tuple[str, str, int]] = set()
    result = []
    for name, spec, fee in rows:
        row = (clean(name), clean(spec) or "규격 없음", fee)
        if (
            not row[0]
            or row[0] in {"품목", "품목별", "품명"}
            or row[0].startswith("※")
            or row in seen
        ):
            continue
        seen.add(row)
        result.append(row)
    return result


def extract_xhtml(region_id: str, path: Path) -> list[tuple[str, str, int]]:
    rows: list[tuple[str, str, int]] = []
    for raw_table in pd.read_html(path):
        header_index = None
        for index, record in raw_table.head(8).iterrows():
            joined = "".join(compact(value) for value in record)
            if re.search(r"수수료|부과금액|가격|금액", joined) and re.search(r"품목|품명|분류", joined):
                header_index = index
                break
        if header_index is None:
            continue
        headers = [compact(value) for value in raw_table.loc[header_index].tolist()]
        table = raw_table.loc[header_index + 1:].reset_index(drop=True)
        fee_columns = [
            index for index, header in enumerate(headers)
            if re.search(r"수수료|부과금액|가격|금액", header)
        ]
        if region_id == "dobong" and "수수료(원)" in headers:
            for record in table.itertuples(index=False, name=None):
                name = clean(record[2]) or clean(record[1])
                fee = parse_fee(record[4])
                if fee is not None:
                    rows.append((name, clean(record[3]), fee))
            continue
        for fee_index in fee_columns:
            item_candidates = [
                index for index, header in enumerate(headers[:fee_index])
                if re.search(r"품목|품명", header)
            ]
            if not item_candidates:
                continue
            item_index = item_candidates[-1]
            spec_candidates = [
                index for index, header in enumerate(headers[item_index + 1:fee_index], item_index + 1)
                if "규격" in header
            ]
            spec_index = spec_candidates[-1] if spec_candidates else None
            for record in table.itertuples(index=False, name=None):
                fee = parse_fee(record[fee_index])
                if fee is None:
                    continue
                name = clean(record[item_index])
                spec = clean(record[spec_index]) if spec_index is not None else ""
                rows.append((name, spec, fee))
    return unique(rows)


def extract_embedded_items(path: Path) -> list[tuple[str, str, int]]:
    text = path.read_text(encoding="utf-8")
    marker = "items: ["
    start = text.index(marker) + len("items: ")
    depth = 0
    quoted = escaped = False
    end = start
    for end in range(start, len(text)):
        char = text[end]
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                end += 1
                break
    items = json.loads(text[start:end])
    return unique(
        (item["name"], item.get("standard", ""), int(float(item["price"])))
        for item in items
        if item.get("active", True) and not item.get("deleted", False)
    )


def extract_gangbuk(path: Path) -> list[tuple[str, str, int]]:
    rows = []
    lines = path.read_text(encoding="cp949").splitlines()[1:]
    for line in lines:
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 3:
            continue
        fee = parse_fee(parts[-1])
        if fee is not None:
            rows.append((parts[0], ", ".join(parts[1:-1]), fee))
    return unique(rows)


def cell_lines(cell: Any) -> list[str]:
    # pyhwp uses one paragraph per item, which is preserved as child elements.
    lines = [clean(node.text_content()) for node in cell.xpath("./*")]
    lines = [line for line in lines if line]
    return lines or [clean(cell.text_content())]


def extract_seongdong(path: Path) -> list[tuple[str, str, int]]:
    document = html.fromstring(path.read_bytes())
    rows = []
    for table in document.xpath("//table")[:4]:
        table_rows = table.xpath(".//tr")
        if len(table_rows) < 2:
            continue
        prices = [parse_fee(cell.text_content()) for cell in table_rows[0].xpath("./th|./td")]
        item_cells = table_rows[1].xpath("./th|./td")
        for price, cell in zip(prices, item_cells):
            if price is None:
                continue
            for item in cell_lines(cell):
                # The annex encodes the size in parentheses as part of the item.
                rows.append((item, "조례 표기 기준", price))
    return unique(rows)


def load_sources(input_root: Path) -> dict[str, dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    for summary_path in input_root.glob("**/summary.json"):
        for entry in json.loads(summary_path.read_text(encoding="utf-8")):
            if not entry.get("error") and entry.get("detail_url"):
                candidates[entry["region_id"]] = entry
    return candidates


def fallback_report_url(region_name: str) -> str:
    from urllib.parse import quote
    return "https://www.google.com/search?q=" + quote(f"{region_name} 대형폐기물 인터넷 신고 공식")


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render(data: dict[str, list[tuple[str, str, int]]], sources: dict[str, dict[str, Any]]) -> str:
    lines = [
        "// This file is generated by scripts/build_seoul_fee_data.py.",
        "// Source: current ELIS ordinances and official district data/reporting systems.",
        "import type { FeeTable } from './index'",
        "",
        "type CompactFeeTable = Omit<FeeTable, 'rows'> & { compactRows: readonly (readonly [string, string, number])[] }",
        "",
        "const TABLES: Record<string, CompactFeeTable> = {",
    ]
    for region_id, region_name in REGIONS.items():
        rows = data[region_id]
        source = sources.get(region_id, {})
        source_url = source.get("detail_url", "")
        authority = f"행정안전부 자치법규정보시스템 · 서울특별시 {region_name}"
        effective_on = source.get("effective_on")
        if region_id == "gangbuk":
            source_url = "https://data.gangbuk.go.kr/openinf/sheetview.jsp?infId=OA-11585"
            authority = "서울특별시 강북구 열린데이터광장"
        elif region_id == "nowon":
            source_url = "https://smartclean.nowon.kr/online/bulky/item"
            authority = "노원구 대형폐기물 인터넷 신고시스템"
        elif region_id == "songpa":
            source_url = "https://smartclean.songpa.go.kr/online/bulky/item"
            authority = "송파구 대형폐기물 인터넷 신고시스템"
        lines.extend([
            f"  {region_id}: {{",
            f"    regionId: {ts_string(region_id)},",
            f"    regionName: {ts_string(region_name)},",
            "    source: {",
            f"      authority: {ts_string(authority)},",
            f"      url: {ts_string(source_url)},",
            "      checkedOn: '2026-08-16',",
            *([f"      effectiveOn: {ts_string(effective_on)},"] if effective_on else []),
            f"      rowCount: {len(rows)},",
            "    },",
            f"    phone: {ts_string(PHONES.get(region_id, '120'))},",
            f"    reportUrl: {ts_string(REPORT_URLS.get(region_id, fallback_report_url(region_name)))},",
            "    compactRows: [",
        ])
        lines.extend(f"      [{ts_string(name)}, {ts_string(spec)}, {fee}]," for name, spec, fee in rows)
        lines.extend(["    ],", "  },"])
    lines.extend([
        "}", "",
        "export const SEOUL_FEE_TABLES: Record<string, FeeTable> = Object.fromEntries(",
        "  Object.entries(TABLES).map(([id, table]) => {",
        "    const { compactRows, ...metadata } = table",
        "    return [id, { ...metadata, rows: compactRows.map(([name, spec, fee]) => ({ name, spec, fee })) }]",
        "  }),",
        ")", "",
    ])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-root", type=Path, default=ROOT / ".tmp-seoul-fees")
    parser.add_argument("--output", type=Path, default=ROOT / "src/data/fees/seoul.generated.ts")
    args = parser.parse_args()

    input_root = args.input_root.resolve()
    data = {
        region_id: extract_xhtml(region_id, input_root / f"{region_id}.xhtml")
        for region_id in XHTML_REGION_IDS
    }
    data["gangbuk"] = extract_gangbuk(input_root / "gangbuk.csv")
    data["nowon"] = extract_embedded_items(input_root / "nowon.html")
    data["songpa"] = extract_embedded_items(input_root / "songpa.html")
    data["seongdong"] = extract_seongdong(input_root / "seongdong.xhtml")

    missing = set(REGIONS) - set(data)
    if missing:
        raise RuntimeError(f"missing districts: {sorted(missing)}")
    suspicious = {region_id: len(rows) for region_id, rows in data.items() if len(rows) < 50}
    if suspicious:
        raise RuntimeError(f"suspiciously small tables: {suspicious}")
    for region_id, rows in data.items():
        if any(fee < 0 or fee > 1_000_000 for _, _, fee in rows):
            raise RuntimeError(f"invalid fee in {region_id}")

    sources = load_sources(input_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render(data, sources), encoding="utf-8", newline="\n")
    print(json.dumps({region_id: len(rows) for region_id, rows in data.items()}, ensure_ascii=False, indent=2))
    print(f"total={sum(map(len, data.values()))}, output={args.output}")


if __name__ == "__main__":
    main()
