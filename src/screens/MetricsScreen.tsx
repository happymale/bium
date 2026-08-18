import {
  accuracyStat,
  categoryStats,
  counterMetrics,
  funnel,
  newGoodsStat,
  northStar,
  paidPathStat,
  problemStat,
  reuseStat,
  triggerStats,
} from '../lib/funnel'
import { analyticsAvailable, getConsent } from '../lib/analytics'
import { Screen } from '../components/Screen'
import { useItems } from '../store/items'
import { SEGMENT_LABEL, useProfile } from '../store/profile'
import { CATEGORY_LABEL, TRIGGER_LABEL, type Trigger } from '../types'
import s from './MetricsScreen.module.css'

/**
 * 계측 점검 화면 — **운영자 전용입니다.**
 *
 * ⚠ 왜 사용자 화면에서 떼어냈는가
 *   측정판을 피측정자에게 보여주면 행동이 바뀝니다. "종량제 선택률 25%,
 *   경보 기준 10% 초과" 를 사용자가 읽으면 다음 선택이 달라지고, 그러면
 *   그 지표는 더 이상 자연스러운 행동을 재지 못합니다.
 *   실험군(A/B)을 알려주는 것은 더 나쁩니다 — §6-4 의 비교가 무의미해집니다.
 *
 * ⚠ 그러면 왜 남겨두는가
 *   지표의 **정본은 Supabase 뷰**(metric_*)입니다. 이 화면은 그것을 대신하지
 *   않고, "이 기기에서 계측이 살아 있는지" 를 즉시 확인하는 용도입니다.
 *   DB 값과 이 값이 어긋나면 동기화가 새고 있다는 뜻입니다.
 *
 * 접근: 링크가 어디에도 없습니다. 주소창에 #/metrics 를 직접 칩니다.
 *       배포본에서는 VITE_SHOW_METRICS=1 이 없으면 라우트 자체가 없습니다.
 */

function pctText(v: number | null): string {
  return v != null ? `${v}%` : '—'
}

export function MetricsScreen() {
  const items = useItems((st) => st.items)
  const { experimentGroup, segment, joinedAt } = useProfile()
  const setProfile = useProfile((st) => st.setProfile)

  const f = funnel(items)
  const acc = accuracyStat(items)
  const nsm = northStar(items)
  const cm = counterMetrics(items)
  const k0 = problemStat(items, joinedAt)
  const reuse = reuseStat(items)
  const paid = paidPathStat(items)
  const newGoods = newGoodsStat(items)
  const cats = categoryStats(items)
  const trig = triggerStats(items)
  const consent = getConsent()

  return (
    <Screen title="계측 점검" back>
      <div className={s.banner}>
        <b>운영자용 화면입니다.</b>
        <br />
        지표의 정본은 Supabase 의 <code>metric_*</code> 뷰입니다. 이 화면은 이
        기기에서 계측이 살아 있는지 확인하는 용도이며, 여기 숫자는{' '}
        <b>이 기기 기록만</b> 셉니다.
      </div>

      {/* ── 실험군 ── */}
      <h2 className={s.groupTitle}>실험 배정</h2>
      <div className={s.group}>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>참가군</div>
            <div className={s.rowSub}>
              보통 초대 링크(<code>?g=A</code> / <code>?g=B</code>)로 자동
              배정됩니다. 사용자에게는 보이지 않습니다.
            </div>
          </div>
          <select
            className={s.select}
            value={experimentGroup}
            onChange={(e) => setProfile({ experimentGroup: e.target.value })}
          >
            <option value="">미참가</option>
            <option value="A">A · 판별만</option>
            <option value="B">B · 판별+대행</option>
          </select>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>세그먼트 (K6)</div>
            <div className={s.rowSub}>
              {segment
                ? SEGMENT_LABEL[segment as Exclude<typeof segment, ''>]
                : '답하지 않음'}
            </div>
          </div>
          <span className={s.rowValue}>{segment || '—'}</span>
        </div>
        <div className={s.row}>
          <div>
            <div className={s.rowLabel}>통계 수집</div>
            <div className={s.rowSub}>
              {!analyticsAvailable
                ? '측정 ID 가 없어 GA 이벤트가 한 건도 나가지 않습니다'
                : consent === 'granted'
                  ? '동의됨 — GA4 로 전송 중'
                  : consent === 'denied'
                    ? '거부됨 — 이 기기는 GA 집계에 들어가지 않습니다'
                    : '아직 선택하지 않았습니다'}
            </div>
          </div>
          <span className={s.rowValue}>
            {!analyticsAvailable
              ? '비활성'
              : consent === 'granted'
                ? '수집 중'
                : consent === 'denied'
                  ? '거부'
                  : '미선택'}
          </span>
        </div>
      </div>

      {/* ── 대표 지표 ── */}
      <h2 className={s.groupTitle}>대표 지표</h2>
      <div className={s.group}>
        <Metric
          label="다시 쓰이게 된 비율"
          sub={
            nsm.total > 0
              ? `완료 ${nsm.total}개 중 ${nsm.recirculated}개 · 목표 60%`
              : '완료된 판별 물건이 없습니다'
          }
          value={pctText(nsm.rate)}
        />
      </div>

      {/* ── 보조 지표 ── */}
      <h2 className={s.groupTitle}>보조 지표 (K0~K11)</h2>
      <div className={s.group}>
        <Metric
          label="K0 초기 적체"
          sub={
            joinedAt == null
              ? '가입 시각이 없어 14일 창을 셀 수 없습니다'
              : `가입 14일 내 ${k0.addedWithin14d}개 (목표 3개) · 방치 중앙값 ${
                  k0.medianIdleMonths ?? '—'
                }개월 (응답 ${k0.answered}건)`
          }
          value={joinedAt == null ? '—' : `${k0.addedWithin14d}개`}
        />
        <Metric
          label="K1 판별 정확도"
          sub={
            acc.answered > 0
              ? `응답 ${acc.answered}건 중 ${acc.correct}건 정확 · 응답률 ${acc.responseRate}% · 목표 95%`
              : '응답이 아직 없습니다'
          }
          value={pctText(acc.k1)}
        />
        <Metric
          label="K2 판별→실행 전환율"
          sub={`판별 ${f.classified} · 신청 ${f.requested} · 완료 ${f.disposed} · 목표 45%`}
          value={pctText(f.k2)}
        />
        <Metric
          label="K3 방치 일수 (중앙값)"
          sub="등록 → 완료 · 목표 7일 이하 · AS-IS 128일"
          value={
            f.medianDaysToDispose != null ? `${f.medianDaysToDispose}일` : '—'
          }
        />
        <Metric
          label="K4 4주 재방문율"
          sub="이 기기에서는 계산할 수 없습니다 — GA4 → 보고서 → 보존율"
          value="GA"
        />
        <Metric
          label="K5 처리 소요 시간 (중앙값)"
          sub="촬영 → 승인 완료 · 목표 60초 이하"
          value={
            f.medianSecondsToApprove != null
              ? `${f.medianSecondsToApprove}초`
              : '—'
          }
        />
        <Metric
          label="K8 반려·실패율"
          sub="안내가 지자체 규정과 어긋난 비율 · 목표 3% 이하"
          value={pctText(f.rejectRate)}
          warn={f.rejectRate != null && f.rejectRate > 3}
        />
        <Metric
          label="K9 재사용 성사율"
          sub={
            reuse.answered > 0
              ? `보낸 ${reuse.sent}개 중 ${reuse.answered}개 응답 · ${reuse.completed}개 성사 · 목표 70%`
              : '⚠ 파트너 회신 연동 전 — 자기신고로만 셉니다'
          }
          value={pctText(reuse.rate)}
        />
        <Metric
          label="K11 월간 총 처리 건수"
          sub="최근 30일 · 대표 지표가 못 담는 규모의 성장"
          value={`${f.monthlyDisposed}건`}
        />

        {cats.length > 0 && (
          <div className={s.breakdown}>
            <span className={s.breakdownTitle}>K10 카테고리별 재사용률</span>
            {cats.map((c) => (
              <div key={c.category} className={s.breakdownRow}>
                <span>{CATEGORY_LABEL[c.category]}</span>
                <span className="tnum">
                  {c.recirculated}/{c.done} · {c.rate}%
                </span>
              </div>
            ))}
          </div>
        )}

        {trig.length > 0 && (
          <div className={s.breakdown}>
            <span className={s.breakdownTitle}>K7 트리거별 전환</span>
            {trig.map((t) => (
              <div key={t.trigger} className={s.breakdownRow}>
                <span>{TRIGGER_LABEL[t.trigger as Trigger]}</span>
                <span className="tnum">
                  {t.disposed}/{t.added}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 카운터 메트릭 ── */}
      <h2 className={s.groupTitle}>카운터 메트릭</h2>
      <div className={s.group}>
        <Metric
          label="① 인당 월 처리 개수"
          sub="최근 30일 · 3개월 연속 상승이면 리바운드 신호"
          value={`${cm.disposedLast30Days}개`}
        />
        <Metric
          label="② 유료 경로 유도율"
          sub={
            paid.judged > 0
              ? `AI 판단 ${paid.judged}건 중 ${paid.paidDespiteFree}건 · 경보 8% 초과`
              : '무료 대안 판단이 아직 없습니다'
          }
          value={pctText(paid.rate)}
          warn={paid.rate != null && paid.rate > 8}
        />
        <Metric
          label="③ 신규 취득물 비중"
          sub={
            newGoods.answered > 0
              ? `응답 ${newGoods.answered}건 중 ${newGoods.within12m}건이 1년 이내 취득`
              : '취득 시점 응답이 아직 없습니다'
          }
          value={pctText(newGoods.rate)}
        />
        <Metric
          label="④ 종량제 경로 선택률"
          sub={
            cm.guidedAndDone > 0
              ? `완료 ${cm.guidedAndDone}개 중 ${cm.wasteBag}개 · 경보 10% 초과`
              : '완료된 판별 물건이 없습니다'
          }
          value={pctText(cm.wasteBagRate)}
          warn={cm.wasteBagRate != null && cm.wasteBagRate > 10}
        />
      </div>

      <p className={s.foot}>
        분모 규칙 — <b>사진으로 판별한 물건만</b> 셉니다. 직접 추가한{' '}
        <span className="tnum">{f.manual}</span>개와 시연용 예시는 제외됩니다.
        <br />
        전체 사용자 집계는 Supabase SQL Editor 에서{' '}
        <code>select * from metric_overview;</code>
      </p>
    </Screen>
  )
}

function Metric({
  label,
  sub,
  value,
  warn,
}: {
  label: string
  sub: string
  value: string
  warn?: boolean
}) {
  return (
    <div className={s.row}>
      <div>
        <div className={s.rowLabel}>{label}</div>
        <div className={s.rowSub}>{sub}</div>
      </div>
      <span className={`${s.rowValue} tnum ${warn ? s.warn : ''}`}>{value}</span>
    </div>
  )
}
