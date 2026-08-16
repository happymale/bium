"""Collect current Seoul district bulky-waste fee annexes from ELIS.

This is a research/maintenance helper. It downloads only official Ministry of
the Interior and Safety (ELIS) ordinance pages and their attached annexes.
HWP conversion uses pyhwp; pass its source directory with ``--pyhwp-src``.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

from lxml import html


BASE = "https://www.elis.go.kr"
DISTRICTS = [
    ("jongno", "종로구", "110"),
    ("junggu", "중구", "140"),
    ("yongsan", "용산구", "170"),
    ("seongdong", "성동구", "200"),
    ("gwangjin", "광진구", "215"),
    ("ddm", "동대문구", "230"),
    ("jungnang", "중랑구", "260"),
    ("seongbuk", "성북구", "290"),
    ("gangbuk", "강북구", "305"),
    ("dobong", "도봉구", "320"),
    ("nowon", "노원구", "350"),
    ("ep", "은평구", "380"),
    ("sdm", "서대문구", "410"),
    ("mapo", "마포구", "440"),
    ("yangcheon", "양천구", "470"),
    ("gangseo", "강서구", "500"),
    ("guro", "구로구", "530"),
    ("geumcheon", "금천구", "545"),
    ("ydp", "영등포구", "560"),
    ("dongjak", "동작구", "590"),
    ("gwanak", "관악구", "620"),
    ("seocho", "서초구", "650"),
    ("gangnam", "강남구", "680"),
    ("songpa", "송파구", "710"),
    ("gangdong", "강동구", "740"),
]


@dataclass
class DistrictResult:
    region_id: str
    region_name: str
    sgg_code: str
    alr_no: str | None = None
    hist_no: str | None = None
    effective_on: str | None = None
    ordinance_title: str | None = None
    detail_url: str | None = None
    annex_no: str | None = None
    annex_title: str | None = None
    annex_url: str | None = None
    annex_path: str | None = None
    xhtml_path: str | None = None
    error: str | None = None


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "BIUM fee-table research/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def choose_ordinance(document: html.HtmlElement, region_name: str):
    expected = compact(f"서울특별시 {region_name} 폐기물 관리 조례")
    candidates = []
    for anchor in document.xpath('//a[contains(@onclick, "fnSrchDtls")]'):
        title = " ".join(anchor.text_content().split())
        onclick = anchor.get("onclick") or ""
        match = re.search(r"fnSrchDtls\('([^']+)'\s*,\s*'([^']+)'", onclick)
        if not match:
            continue
        normalized = compact(title).replace("현", "", 1)
        candidates.append((title, normalized, match.group(1), match.group(2)))

    # Prefer the ordinance itself over an identically prefixed enforcement rule.
    exact = [row for row in candidates if row[1] == expected]
    if not exact:
        exact = [
            row
            for row in candidates
            if compact(region_name) in row[1]
            and "폐기물" in row[1]
            and "관리조례" in row[1]
            and "음식물류" not in row[1]
            and "시행규칙" not in row[1]
        ]
    if not exact:
        raise RuntimeError(f"current waste ordinance not found; candidates={candidates}")
    return exact[0]


def choose_annex(document: html.HtmlElement):
    candidates = []
    for anchor in document.xpath('//a[starts-with(@id, "attList")]'):
        title = " ".join(anchor.text_content().split())
        href = anchor.get("href") or ""
        match = re.search(r"fnAttListDown\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'", href)
        if match:
            candidates.append((title, *match.groups()))

    preferred = [
        row
        for row in candidates
        if "대형" in compact(row[0])
        and "폐기물" in compact(row[0])
        and any(token in compact(row[0]) for token in ("수수료", "부과기준", "처리비"))
    ]
    if not preferred:
        preferred = [
            row
            for row in candidates
            if "대형" in compact(row[0]) and "폐기물" in compact(row[0])
            and "별지" not in compact(row[0])
        ]
    if not preferred:
        bundled = [
            row
            for row in candidates
            if compact(row[0]) in {"별표", "별표및별지서식"}
            or re.search(r"별표\]?\s*1\s*[-~]\s*\d+", row[0])
        ]
        if len(bundled) == 1:
            preferred = bundled
    if not preferred:
        raise RuntimeError(f"bulky-waste fee annex not found; annexes={candidates}")
    return preferred[0]


def collect_one(
    region_id: str,
    region_name: str,
    sgg_code: str,
    output_dir: Path,
    pyhwp_src: Path | None,
    olefile_src: Path | None,
) -> DistrictResult:
    result = DistrictResult(region_id, region_name, sgg_code)
    try:
        query = urllib.parse.urlencode(
            {
                "ctpvCd": "11",
                "sggCd": sgg_code,
                "srchKwd": "폐기물 관리 조례",
                "srchTabSe": "alrNm",
                "pageSize": "100",
            }
        )
        listing = html.fromstring(
            fetch(f"{BASE}/allalr/allAlrList?{query}").decode("utf-8")
        )
        title, _normalized, alr_no, hist_no = choose_ordinance(listing, region_name)
        result.ordinance_title = title
        result.alr_no = alr_no
        result.hist_no = hist_no

        detail_query = urllib.parse.urlencode(
            {"alrNo": alr_no, "histNo": hist_no, "menuNm": "allalr"}
        )
        detail_url = f"{BASE}/allalr/selectAlrBdtOne?{detail_query}"
        result.detail_url = detail_url
        detail_bytes = fetch(detail_url)
        detail = html.fromstring(detail_bytes.decode("utf-8"))
        detail_text = " ".join(detail.text_content().split())
        effective = re.search(r"\[시행\s+(\d{4})[.\-/](\d{2})[.\-/](\d{2})\]", detail_text)
        if effective:
            result.effective_on = "-".join(effective.groups())

        annex_title, annex_alr, annex_hist, annex_no = choose_annex(detail)
        result.annex_no = annex_no
        result.annex_title = annex_title
        annex_query = urllib.parse.urlencode(
            {"alrNo": annex_alr, "histNo": annex_hist, "attlistSn": annex_no}
        )
        annex_url = f"{BASE}/allalr/attListDown?{annex_query}"
        result.annex_url = annex_url
        annex_bytes = fetch(annex_url)
        suffix = ".hwp" if annex_bytes.startswith(b"\xd0\xcf\x11\xe0") else ".bin"
        annex_path = output_dir / f"{region_id}{suffix}"
        annex_path.write_bytes(annex_bytes)
        result.annex_path = str(annex_path)

        if suffix == ".hwp" and pyhwp_src and olefile_src:
            xhtml_path = output_dir / f"{region_id}.xhtml"
            env = os.environ.copy()
            env["PYTHONPATH"] = os.pathsep.join(
                [str(olefile_src), str(pyhwp_src), env.get("PYTHONPATH", "")]
            )
            command = [
                sys.executable,
                "-c",
                "from hwp5.hwp5html import main; main()",
                "--html",
                "--output",
                str(xhtml_path),
                str(annex_path),
            ]
            conversion = subprocess.run(
                command,
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if conversion.returncode != 0:
                raise RuntimeError(f"HWP conversion failed: {conversion.stderr[-1000:]}")
            result.xhtml_path = str(xhtml_path)
    except Exception as exc:  # keep the 25-district batch moving
        result.error = f"{type(exc).__name__}: {exc}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--pyhwp-src", type=Path)
    parser.add_argument("--olefile-src", type=Path)
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    selected = [row for row in DISTRICTS if not args.only or row[0] in args.only]
    results = []
    for region_id, region_name, sgg_code in selected:
        print(f"[{len(results) + 1}/{len(selected)}] {region_name}", flush=True)
        result = collect_one(
            region_id,
            region_name,
            sgg_code,
            args.output,
            args.pyhwp_src,
            args.olefile_src,
        )
        results.append(result)
        print(f"  annex={result.annex_title!r} error={result.error!r}", flush=True)

    # These two districts publish the live item catalogue in their official
    # reporting systems; keep the page beside the ELIS files for normalization.
    for region_id, url in {
        "nowon": "https://smartclean.nowon.kr/online/bulky/item",
        "songpa": "https://smartclean.songpa.go.kr/online/bulky/item",
    }.items():
        (args.output / f"{region_id}.html").write_bytes(fetch(url))

    summary_path = args.output / "summary.json"
    summary_path.write_text(
        json.dumps([asdict(row) for row in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(summary_path)
    return 1 if any(row.error for row in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
