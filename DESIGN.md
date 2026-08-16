# DESIGN.md — 비움 BIUM

> AI 코딩 에이전트를 위한 디자인 시스템 명세.
> 이 파일은 상상으로 쓴 것이 아니라 `src/styles/tokens.css` 와 실제 화면 코드에서 추출했습니다.
> 새 화면을 만들 때는 여기 있는 값만 쓰고, **새 값을 발명하지 마십시오.**

**제품**: 사진 한 장으로 폐기물 배출 방법을 판별해주는 모바일 웹앱 (한국어, 서울 서대문구)
**스택**: React 19 + Vite + TypeScript, CSS Modules, CSS 변수 기반 라이트/다크 테마

---

## 1. 비주얼 테마와 분위기

**따뜻한 무채색 종이 위의 차분한 정보 도구.** 순백(`#ffffff`)이나 순흑(`#000000`)을 쓰지 않습니다. 표면은 아주 옅은 온기가 도는 회백색(`#fcfcfb`, `#f4f5f2`)이고, 텍스트는 완전한 검정이 아닌 `#0b0b0b` 입니다. 이 미묘한 온기가 "쓰레기 앱"이 주기 쉬운 차갑고 위생적인 인상을 상쇄합니다.

**밀도는 높지만 답답하지 않게.** 한국어는 같은 정보를 영어보다 짧게 담기 때문에 폰트가 작아도 읽힙니다. 본문 15px, 보조 정보 11.5~12.5px 로 촘촘하게 쌓되 카드 사이 여백(12~18px)으로 숨을 틔웁니다.

**감정 톤: 재촉하지 않는다.** 이 앱은 사용자가 미뤄둔 일을 다룹니다. 붉은 경고, 느낌표, 카운트다운을 쓰지 않습니다. 방치일수조차 비난이 아니라 눈금으로 보여줍니다.

**색은 오직 의미를 위해서만.** 장식용 색은 없습니다. 화면에 색이 있다면 그건 반드시 네 처리 경로 중 하나를 가리킵니다.

---

## 2. 색상 팔레트와 역할

모든 색은 CSS 변수입니다. **하드코딩된 hex 를 컴포넌트에 쓰지 마십시오.**
다크 테마는 `<html data-theme="dark">` 로 전환되며 모든 변수가 자동으로 갈립니다.

### 표면 · 텍스트

| 변수 | 라이트 | 다크 | 역할 |
|---|---|---|---|
| `--page` | `#f4f5f2` | `#0d0d0d` | 페이지 배경, 카드 안쪽 강조 블록 |
| `--surface` | `#fcfcfb` | `#1a1a19` | 앱 셸, 카드, 바(bar) 배경 |
| `--ink` | `#0b0b0b` | `#ffffff` | 제목, 숫자, 강조 텍스트 |
| `--ink2` | `#52514e` | `#c3c2b7` | 본문, 설명문 |
| `--muted` | `#898781` | `#898781` | 캡션, 부제, 비활성 |
| `--grid` | `#e1e0d9` | `#2c2c2a` | 목록 구분선, 트랙, 비활성 배경 |
| `--line` | `rgba(11,11,11,.10)` | `rgba(255,255,255,.12)` | 카드 테두리 |

### 브랜드

| 변수 | 라이트 | 다크 | 역할 |
|---|---|---|---|
| `--brand` | `#0f7a55` | `#1baf7a` | 주요 버튼, 활성 탭, 진행 상태 |
| `--brand-soft` | `rgba(27,175,122,.12)` | `rgba(27,175,122,.18)` | 넛지 카드, 안내 배너 배경 |
| `--good-text` | `#006300` | `#0ca30c` | "0원" 같은 좋은 소식 |

> 라이트의 `--brand` 가 다크보다 어두운 이유는 흰 배경에서 대비를 확보하기 위해서입니다. 두 값을 통일하지 마십시오.

### 4개 처리 경로 — 이 앱의 핵심 색 체계

색맹 안전성이 검증된 categorical 조합입니다. **네 색의 의미는 고정이며 절대 바꾸지 마십시오.**

| 변수 | 라이트 | 다크 | 의미 |
|---|---|---|---|
| `--r-reuse` | `#1baf7a` | `#199e70` | 재사용·기부 |
| `--r-free` | `#2a78d6` | `#3987e5` | 무상 방문수거 |
| `--r-bulk` | `#eb6834` | `#d95926` | 대형폐기물 신고 |
| `--r-drop` | `#e34948` | `#e66767` | 전용 수거함 |
| `--r-burn` | `#898781` | `#898781` | 종량제(소각) — **안티 경로** |

`--r-burn` 은 리포트의 "종량제로 갔다면" 반사실 비교에만 씁니다. **판별 결과로 제시해서는 안 됩니다.**

`--r-bulk` 는 100일 넘게 방치된 물건의 일수 표기에도 재사용합니다 (경고가 아니라 "비용이 드는 쪽"이라는 뜻).

TypeScript 에서는 `src/data/routeKinds.ts` 의 `ROUTE_BY_ID[route].color` 로 접근합니다. 값은 `var(--r-*)` 문자열이라 인라인 스타일에 그대로 넣으면 다크모드가 자동 반영됩니다.

---

## 3. 타이포그래피

```css
--font: system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo',
        'Malgun Gothic', sans-serif;
```

웹폰트를 쓰지 않습니다. 한국어 시스템 폰트가 기기별로 가장 잘 렌더링되고, 로딩 지연도 없습니다.

**기본**: 15px / line-height 1.55 / `-webkit-font-smoothing: antialiased`

### 타입 스케일 (실제 사용 중인 값 — 새 단계를 추가하지 마십시오)

| px | weight | letter-spacing | 쓰임 |
|---|---|---|---|
| 54 | 800 | −0.045em | 리포트 대표 숫자 (`83%`) |
| 23 | 800 | −0.035em | 판별 결과 헤드라인 |
| 19 | 800 | −0.03em | 촬영 결과 품목명 |
| 16 | 800 | −0.025em | 화면 제목 (navbar) |
| 15 | 800 | −0.02em | 대상 물건명, CTA 버튼 라벨 |
| 15 | 400 | — | 본문 기본 |
| 14.5 | 800 | — | 넛지 제목, 명세서 합계 |
| 14 | 700 | −0.01em | 목록 항목명, 설정 라벨 |
| 13.5 | 600~700 | — | 진행 단계 제목, 방치일수 |
| 13 | 400 | — | 본문 보조, 카운터, 콜아웃 |
| 12.5 | 400 | — | 근거·경고문, 부제, 칩 |
| 12 | 400 | — | 목록 부제, 하단 안내 |
| 11.5 | 400~700 | — | 범례, 출처 스탬프, 확신도 |
| 11 | 400 | — | "방치" 같은 최소 라벨 |
| 10.5 | 700~800 | −0.01em | 탭 라벨, 배지, 단계 번호 |

**자간 규칙**: 클수록 좁게. 19px 이상은 −0.03em 이하, 14~16px 는 −0.01~−0.025em, **12.5px 이하는 자간 조정 없음**.

### 숫자 표기 — 필수

방치일수·금액·확신도·품목 개수 등 **변하는 숫자에는 반드시 `className="tnum"`** 을 붙입니다.

```tsx
<b className="tnum">{daysIdle(item)}일</b>
<span className="tnum">{formatWon(item.fee)}</span>
```

`tnum` 은 `font-variant-numeric: tabular-nums` 입니다. 없으면 숫자가 바뀔 때 폭이 흔들려 목록이 덜컹거립니다.

---

## 4. 컴포넌트 스타일

### 버튼

| 종류 | 스펙 |
|---|---|
| **Primary** | `background: var(--brand)`, `color: #fff`, `border: 0`, `radius: var(--radius-md)`, `font-size: 15px`, `weight: 800`, `padding: 14px 0`, `width: 100%` |
| **Ghost** | Primary 에서 `background: none`, `color: var(--ink2)`, `border: 1px solid var(--line)`, `weight: 700` |
| **Disabled** | `background: var(--grid)`, `color: var(--muted)` |
| **FAB (촬영)** | 56×56, `border-radius: 50%`, `background: var(--brand)`, `border: 3px solid var(--surface)`, `box-shadow: var(--shadow-float)`, 눌림 시 `scale(0.94)` |

주 동작은 항상 폭 100% 로 깔고, 보조 동작을 그 아래 ghost 로 둡니다. 나란히 두 개를 놓을 때만 `grid-template-columns: 1fr 1fr`.

### 카드

```css
border: 1px solid var(--line);
border-radius: var(--radius-lg);   /* 14px */
background: var(--surface);
padding: 12~15px 13~16px;
box-shadow: var(--shadow-card);    /* 아주 옅게, 생략 가능 */
```

**강조 블록**(넛지·근거·카운터)은 테두리 없이 배경만 씁니다: `background: var(--brand-soft)` 또는 `var(--page)`, `radius: var(--radius-lg)`.

### 경로 배지 (pill)

```css
display: inline-flex; align-items: center; gap: 6~7px;
font-size: 12.5px; font-weight: 800;
color: #fff; background: <경로색>;
padding: 5px 11px; border-radius: 999px;
```

### 필터 칩

```css
font-size: 11.5px; font-weight: 700;
padding: 6px 11px; border-radius: 999px;
border: 1px solid var(--line); background: none; color: var(--ink2);
```
선택 시(`aria-pressed="true"`) → `background: var(--ink); color: var(--surface); border-color: var(--ink)`.
경로 칩에는 8×8 `border-radius: 2px` 색 사각형을 앞에 둡니다.

### 목록 행

```css
display: flex; gap: 12px; align-items: center;
padding: 13px 0; border-bottom: 1px solid var(--grid);
```
마지막 행은 `border-bottom: 0`. 왼쪽 42×42 썸네일(`radius: 10px`, `background: var(--page)`) 안에 9×9 경로 색 사각형 또는 사진. 오른쪽 끝에 `margin-left: auto` 로 숫자.

### 토글 스위치

46×27 트랙(`radius: 999px`), 21×21 흰 노브. 꺼짐 `--grid` / 켜짐 `--brand`. 전환 0.18s. **반드시 `role="switch"` + `aria-checked`** 를 씁니다.

### 진행 단계 마커

19×19 원, 흰 텍스트 10.5px/800.
완료 `--r-reuse` + `✓` / 현재 `--brand` + `▶` / 대기 `--grid` + `--muted` 색 번호.

### 세그먼트 바

높이 34px, 조각 사이 `gap: 2px`, 각 조각 `flex: <개수>` 로 비율 배분. 양 끝만 바깥쪽 모서리 4px. 조각 안에 흰 숫자 12px/800.

### 상단 바 / 하단 탭

둘 다 `position: sticky` + 반투명 + 블러:
```css
background: color-mix(in srgb, var(--surface) 92%, transparent);
backdrop-filter: blur(12px);
```
상단은 `border-bottom: 1px solid var(--grid)`, 하단은 `border-top: 1px solid var(--line)`.

---

## 5. 레이아웃 원칙

**앱 셸**: `max-width: 480px`, 가운데 정렬, `background: var(--surface)`, `display: flex; flex-direction: column`. 520px 이상 화면에서는 `box-shadow: 0 0 0 1px var(--line)` 로 경계만 표시합니다.

**화면 패딩**: 본문 `16px 18px 24px`. 상단 바 `calc(var(--safe-t) + 12px) 18px 12px`.

**간격 스케일**: `2 · 4 · 6 · 8 · 9 · 10 · 12 · 15 · 18 · 24` (px). 카드 사이 12~18px, 카드 안 요소 사이 4~10px, 섹션 사이 18px.

**모서리 반경**
```css
--radius-sm: 8px;    /* 작은 버튼 */
--radius-md: 12px;   /* CTA, 근거 블록, 경고 */
--radius-lg: 14px;   /* 카드, 넛지, 사진 */
--radius-xl: 20px;
/* 999px — pill (배지·칩·스위치) */
/* 10px  — 42px 썸네일 (고정값) */
/* 50%   — FAB, 단계 마커 */
```

**안전 영역**: 하단 탭은 `height: calc(var(--tabbar-h) + var(--safe-b))` + `padding-bottom: var(--safe-b)`. 상단 바는 `--safe-t` 를 패딩에 더합니다. iPhone 노치·홈 인디케이터 대응입니다.

**세로 흐름**: 모든 화면은 위에서 아래로 한 줄기입니다. 좌우 스크롤·캐러셀·탭 안의 탭을 쓰지 않습니다.

---

## 6. 깊이와 엘리베이션

그림자를 거의 쓰지 않습니다. 면은 **색 차이**(`--surface` vs `--page`)와 **1px 선**(`--line`, `--grid`)으로 구분합니다.

```css
--shadow-card:  0 1px 2px rgba(11,11,11,.04);   /* 다크: rgba(0,0,0,.35) */
--shadow-float: 0 6px 20px rgba(11,11,11,.16);  /* 다크: rgba(0,0,0,.5)  */
```

`--shadow-float` 는 **떠 있는 것에만** — 실질적으로 촬영 FAB 하나입니다. 카드·버튼·바에 쓰지 마십시오.

**레이어 순서**: 본문 → 상단 바 `z-index: 10` → 하단 탭 `z-index: 20` → 로딩 오버레이(`position: absolute; inset: 0`).

---

## 7. Do's and Don'ts

### ✅ Do

- **색은 `var(--*)` 로만.** 새 hex 를 컴포넌트에 넣지 마십시오. 다크모드가 깨집니다.
- **변하는 숫자에는 `tnum`.**
- **금액은 요금표에서만.** `src/data/sdmBulkFees.ts`(218행 실제 고시값)를 `lib/fees.ts` 로 조회합니다. AI 응답이나 컴포넌트가 금액을 만들어내면 안 됩니다.
- **조사는 `lib/korean.ts` 로.** 품목명이 AI 판별 결과라 `은/는`, `이/가`를 미리 정할 수 없습니다. `topic(name)`, `subject(name)` 을 쓰십시오. **"은(는)" 표기 금지.**
- **경로 색은 `ROUTE_BY_ID[route].color` 로.**
- **불확실할 때는 불확실하다고 표시.** 확신도 85% 미만이면 결과를 확정하지 말고 확신도 바를 `--r-drop` 으로 바꾸고 "구청에 물어보기"를 주 버튼으로 올립니다.
- **빈 상태에도 문장을 주십시오.** "데이터 없음" 대신 "아직 비운 물건이 없습니다 / 하나를 처리하면 여기에 행선지가 기록됩니다".

### ❌ Don't

- **종량제봉투를 해결책으로 제시하지 마십시오.** `--r-burn` 은 반사실 비교 전용입니다.
- **대표 지표를 "버린 개수"로 두지 마십시오.** 많이 버린 사람이 칭찬받는 구조가 됩니다. 리포트 최상단은 언제나 **다시 쓰이게 된 비율**입니다.
- **방치일수를 붉은 경고로 칠하지 마십시오.** 비난이 아니라 눈금입니다. 100일 이상에만 `--r-bulk`(주황)를 씁니다.
- **재촉하지 마십시오.** 카운트다운, 붉은 배너, 느낌표, "지금 당장!" 금지. 문구는 언제나 "오늘 하나만 비워볼까요?" 톤입니다.
- **새 폰트 크기·반경·그림자를 만들지 마십시오.** 위 표에 있는 값을 재사용하십시오.
- **순백/순흑 금지.** `#fff` 는 색 배지 위 텍스트와 스위치 노브에만 씁니다.
- **웹폰트·아이콘 폰트·UI 라이브러리를 추가하지 마십시오.** 아이콘은 `src/components/icons.tsx` 의 인라인 SVG(`stroke-width: 1.9`, `stroke: currentColor`)입니다.
- **장식용 일러스트·그라데이션 금지.** 유일한 그라데이션은 사진 자리표시자입니다.

---

## 8. 반응형 동작

**모바일 우선.** 기준 뷰포트 375×812.

| 브레이크포인트 | 동작 |
|---|---|
| ~519px | 앱 셸이 화면 전체 폭 |
| 520px~ | 셸을 480px 로 고정, 가운데 정렬, 1px 경계선 |

**터치 타깃**: 최소 44×44 를 확보합니다. 하단 탭 항목은 58px 높이 전체가 타깃이고, FAB 는 56px 입니다. 시각적으로 작은 칩(높이 ~28px)은 좌우 패딩으로 폭을 벌립니다.

**뷰포트 메타**: `width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1`
(`viewport-fit=cover` 가 있어야 `env(safe-area-inset-*)` 이 동작합니다.)

**본문 오버스크롤 차단**: `overscroll-behavior-y: none` — 웹앱이 브라우저처럼 튕기지 않게.

**긴 텍스트**: 한국어 품목명은 길어질 수 있습니다. 목록 부제와 행선지는 줄바꿈을 허용하고, 숫자 열만 `white-space: nowrap` 으로 고정합니다.

---

## Agent Prompt Guide

새 화면을 만들 때 에이전트에게 이렇게 지시하십시오:

> `DESIGN.md` 를 따르십시오. 색은 `var(--*)` 변수만 쓰고 새 hex 를 만들지 마십시오. 타입 스케일과 반경은 문서의 표에 있는 값만 재사용하십시오. 화면은 `<Screen title="…">` 로 감싸고, 변하는 숫자에는 `tnum`, 조사에는 `lib/korean.ts`, 경로 색에는 `ROUTE_BY_ID[route].color`, 금액에는 `lib/fees.ts` 를 쓰십시오. 종량제를 해결책으로 제시하지 말고, 사용자를 재촉하는 문구를 쓰지 마십시오.

**핵심 파일**

| 경로 | 내용 |
|---|---|
| `src/styles/tokens.css` | 모든 색·반경·그림자 변수 (단일 진실 공급원) |
| `src/styles/global.css` | 앱 셸, 기본 타이포, `.tnum` |
| `src/data/routeKinds.ts` | 4개 경로 정의와 색 |
| `src/data/sdmBulkFees.ts` | 서대문구 실제 요금표 218행 |
| `src/lib/fees.ts` | 요금 조회 (별칭·규격 매칭 포함) |
| `src/lib/korean.ts` | 조사 자동 선택 |
| `src/components/Screen.tsx` | 화면 껍데기 (상단 바 + 본문) |
| `src/components/icons.tsx` | 인라인 SVG 아이콘 |
