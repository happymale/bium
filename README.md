# 비움 BIUM

> 버리는 법을 몰라서, 아직 집에 있습니다.

사진 한 장으로 폐기물 배출 방법을 판별해주는 모바일 웹앱 (PWA).
「신인류 AI 사피엔스 경험디자인」 기말 팀프로젝트.

**https://biume.vercel.app**

---

## 무엇을 하는가

물건 사진을 찍으면 AI가 **재질과 부착물**을 보고 네 경로 중 하나로 분류하고,
지자체 실제 요금표에서 수수료를 조회해 붙입니다.

| 경로 | 대상 | 비용 |
|---|---|---|
| 🟢 재사용·기부 | 아직 쓸 만한 가구·의류·장난감 | 0원 |
| 🔵 무상 방문수거 | 폐가전 전 품목 | 0원 |
| 🟠 대형폐기물 신고 | 가구·매트리스 등 | 지자체 요금표 |
| 🔴 전용 수거함 | 폐건전지·폐의약품·형광등 | 0원 |

**종량제봉투는 네 경로 어디에도 없습니다.**

두 가지 원칙이 코드에 박혀 있습니다.

- **AI에게 금액을 묻지 않습니다.** AI는 품목·경로·근거만 판단하고, 수수료는 항상 구청 고시 요금표에서 조회합니다.
- **확신도 85% 미만이면 결과를 확정하지 않고** 구청 문의로 안내합니다.

디자인 시스템은 [DESIGN.md](DESIGN.md).

---

## 실행

Node.js 20 이상 필요.

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev                        # http://localhost:5173
```

**환경변수 — 전부 선택입니다.** 아무것도 없어도 목업 응답 + localStorage로 동작합니다.

| 변수 | 없으면 | 비고 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 목업 응답 | [console.anthropic.com](https://console.anthropic.com) 발급 |
| `BIUM_MODEL` | `claude-opus-5` | `claude-haiku-4-5` 약 7원/장, `claude-opus-5` 약 45원/장 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` | 기기 저장만 | 클라우드 동기화. **publishable(anon) 키만** |
| `VITE_GA_MEASUREMENT_ID` | GA 비활성 | 동의 전에는 스크립트도 로드하지 않음 |

> ⚠️ `ANTHROPIC_API_KEY`에 **`VITE_` 접두사를 붙이지 마세요.** 붙는 순간 브라우저 번들에 키가 박힙니다.
> `.env.local`은 `.gitignore`에 있습니다. 절대 커밋하지 마세요.

Supabase를 쓰려면 [`supabase/schema.sql`](supabase/schema.sql) → [`schema-02-profiles.sql`](supabase/schema-02-profiles.sql)을
SQL Editor에서 실행하고, **Authentication → Anonymous Sign-Ins를 켜야** 합니다.

---

## 구조

```
├─ api/classify.ts        판별 로직 전부 (프롬프트·스키마·목업·API 호출)
├─ api/status.ts          키·모델 상태 (값은 내려보내지 않음)
├─ server/vitePlugin.ts   개발 서버가 api/classify 를 재사용
├─ supabase/*.sql         테이블 · RLS · Storage 버킷
└─ src/
   ├─ data/fees/          지역별 요금표 레지스트리
   ├─ lib/fees.ts         요금 조회 (표기 별칭 + 규격 매칭)
   ├─ lib/korean.ts       조사 자동 선택 (은/는, 이/가)
   ├─ lib/recommend.ts    "오늘 하나만" 추천 점수
   ├─ screens/            온보딩 · 홈 · 목록 · 촬영 · 직접추가 · 결과 · 대행 · 리포트 · 설정
   └─ store/              zustand + localStorage (+ Supabase 동기화)
```

**API 키는 브라우저로 나가지 않습니다.** `api/` 안에서만 읽히고, 빌드 산출물에
`sk-ant`·`anthropic`·프롬프트 문자열이 없는 것을 확인했습니다.

> ⚠️ `api/*.ts`는 **`api/` 바깥 모듈을 import 하면 안 됩니다.**
> Vercel 함수가 `FUNCTION_INVOCATION_FAILED`로 죽습니다. npm 패키지만 쓰세요.

---

## 배포 (Vercel)

1. GitHub 저장소 연결 — [`vercel.json`](vercel.json) 이미 있음
2. Environment Variables 등록 → **Redeploy** (빌드 캐시 해제)
3. `/api/status`가 `{"hasApiKey":true}`면 성공

새 자치구 요금표를 추가하려면 `src/data/fees/`에 파일 하나와 등록 한 줄이면 됩니다.
아이콘은 `node scripts/gen-icons.mjs`로 다시 생성합니다.

---

## 데이터 출처

- [서대문구 대형폐기물 수수료](https://www.sdm.go.kr/civil/print/waste/standards.do) — 218개 품목
- [종로구 대형폐기물 수수료](https://jongno.go.kr/waste/pc/web/expense/selectExpenseList.do) — 159개 품목
- [폐가전 무상방문수거](https://15990903.or.kr) 1599-0903 (전국)
- [스마트서울맵 폐건전지 수거함](https://map.seoul.go.kr/smgis2/short/6Ntl8) — 6,138곳

모두 2026-08-16 수집. 구청 고시가 바뀌면 달라지며, 앱 설정 화면에 **확인일**을 표시합니다.
요금표가 없는 자치구는 금액 대신 구청 문의로 안내합니다 — 다른 구 요금을 대신 쓰지 않습니다.

---

## 프로토타입입니다

- **신청 대행은 개념 시연입니다.** 실제 신고·결제가 일어나지 않습니다. 지자체 제휴·정산 계약과 통신판매업 신고가 필요합니다.
- **무상수거·기부·수거함은 대신 신청해 주지 않습니다.** 실제 창구로 연결하고, 다녀온 뒤 직접 표시합니다.
- 요금표는 서울 25개 구 중 **2개 구**만 갖췄습니다.
- 전용 수거함은 서울시 지도로 연결할 뿐, 앱 안에 좌표 데이터는 없습니다.
- 사용자가 늘면 **API 비용이 판별 횟수에 비례**합니다 (호출 제한 필요).
