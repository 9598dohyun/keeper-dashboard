'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import './cal.css';
import VideoCompare from './video-compare';

const CAMERA_UNIT_PRICE = 396_000;

const PRESETS = [
  { label: '소형 매장 2대', value: 2 },
  { label: '표준 4대', value: 4 },
  { label: '중형 6대', value: 6 },
  { label: '대형 8대', value: 8 },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: '녹화기(NVR)는 별도 비용입니까?',
    a: '아니요. 녹화기와 저장공간은 카메라 구성에 포함되어 무상 제공됩니다. 견적은 카메라 대당 가격으로만 산정되며 추가 비용이 없습니다.',
  },
  {
    q: '일시불이 부담스럽습니다. 할부 가능한가요?',
    a: '네. 현대·롯데·삼성카드는 36개월 무이자, KB국민·농협카드는 18개월 무이자, 그 외 카드사는 24개월 무이자 분할이 가능합니다. 36개월 기준 카메라 대당 월 66,000원입니다.',
  },
  {
    q: '설치 후 A/S는 어떻게 됩니까?',
    a: '한화비전 본사가 직접 운영하는 어플과 고객센터를 통해 사후 지원이 이루어지며, 보증 기간 내에는 무상 점검·교체가 가능합니다. 보증 기간 출장비 기준은 별도 안내드립니다.',
  },
  {
    q: '기존 보안업체(출동보안)와 같이 써도 되나요?',
    a: '네. 키퍼는 매장 영상 감시·녹화에 특화된 솔루션으로 출동 보안과 병행하여 사용할 수 있습니다. 기존 출동 계약을 해지하지 않고도 키퍼만 추가 도입하실 수 있습니다.',
  },
  {
    q: '세금계산서 발행이 가능한가요?',
    a: '네. 사업자 결제 시 전자세금계산서가 자동 발행됩니다. 가격은 모두 VAT 포함 기준이므로 매입세액 공제도 받으실 수 있습니다.',
  },
  {
    q: '설치 기간은 얼마나 걸리나요?',
    a: '결제 후 평균 1~2주 내 현장 설치가 완료됩니다. 매장 구조나 배선 환경에 따라 일정이 조정될 수 있으며 사전 현장 확인 후 설치일을 협의합니다.',
  },
];

function formatKRW(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

function calcUnitPriceWithDiscount(cameras: number) {
  if (cameras >= 12) return CAMERA_UNIT_PRICE * 0.9;
  if (cameras >= 8) return CAMERA_UNIT_PRICE * 0.95;
  return CAMERA_UNIT_PRICE;
}

export default function CalLanding() {
  const [cameras, setCameras] = useState<number>(6);
  const [rental, setRental] = useState<string>('');
  const [card, setCard] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const totals = useMemo(() => {
    const safeCameras = Math.max(1, Math.min(50, Number(cameras) || 1));
    const unit = calcUnitPriceWithDiscount(safeCameras);
    const total = Math.round(unit * safeCameras);
    const subtotal = CAMERA_UNIT_PRICE * safeCameras;
    const discountAmount = subtotal - total;
    const discountPct = safeCameras >= 12 ? 10 : safeCameras >= 8 ? 5 : 0;
    return {
      cameras: safeCameras,
      unit,
      total,
      subtotal,
      discountAmount,
      discountPct,
      m12: Math.round(total / 12),
      m24: Math.round(total / 24),
      m36: Math.round(total / 36),
    };
  }, [cameras]);

  const cumulative = useMemo(() => {
    const monthly = Number(rental) || 0;
    if (monthly <= 0) return null;
    const years = [3, 5, 7, 10];
    return years.map((y) => {
      const rentalSum = monthly * 12 * y;
      const diff = rentalSum - totals.total;
      const multi = totals.total > 0 ? rentalSum / totals.total : 0;
      return { year: y, rentalSum, keeperSum: totals.total, diff, multi };
    });
  }, [rental, totals.total]);

  const cardLimit = Number(card) || 0;
  const limitTight = cardLimit > 0 && cardLimit < totals.total;

  return (
    <main className="cal-main pt-[80px] lg:pt-[80px] min-h-screen">
      <nav className="cal-nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="brand-logo-text">KEEPER</span>
            <span className="brand-sub">한화비전 · 매장용 CCTV</span>
          </div>
          <Link className="nav-cta" href="/cal/lead">
            견적 신청하기
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">매장 CCTV — 비용 비교 계산기</div>
        <h1>
          <span className="strike">월 렌탈비</span>로 10년 내신 카메라,
          <br />
          어차피 <span className="accent">사장님 자산은 아닙니다.</span>
        </h1>
        <p className="hero-sub">
          카메라 대수와 지금 내고 계신(또는 견적 받으신) 월 렌탈료를 입력하면,
          <br />
          키퍼 일시불·무이자 할부와의 누적 비용 차이를 즉시 계산해드립니다.
        </p>
        <a href="#calc" className="hero-cta">
          내 매장 비용으로 비교하기
        </a>
        <div className="hero-trust">
          <span>한화비전 자체 제품</span>
          <span>NVR 무상 제공</span>
          <span>최대 36개월 무이자</span>
          <span>결제 즉시 매장 자산</span>
        </div>
      </section>

      <section className="section" id="calc">
        <div className="section-eyebrow">Section 01 · 비용 비교</div>
        <h2 className="section-title">
          렌탈은 매월, 키퍼는 한 번.
          <br />
          <span className="accent">3·5·7·10년</span> 누적으로 보면 답이 나옵니다.
        </h2>
        <p className="section-lede">
          카메라 1대 = 월 렌탈비처럼 보이지만, 누적해서 보면 두 모델의 차이가 분명히 드러납니다. 아래에서 직접 입력해보세요.
        </p>

        <div className="calc-wrap">
          <div className="calc-grid">
            <div className="calc-inputs">
              <h3>매장 정보 입력</h3>
              <div className="h3-sub">대당 396,000원(VAT 포함) 기준</div>

              <div className="field">
                <label className="field-label" htmlFor="f-cameras">
                  카메라 대수
                </label>
                <div className="field-input-wrap">
                  <input
                    id="f-cameras"
                    type="number"
                    className="field-input has-suffix"
                    min={1}
                    max={50}
                    inputMode="numeric"
                    value={cameras}
                    onChange={(e) => setCameras(Number(e.target.value) || 1)}
                  />
                  <span className="field-suffix">대</span>
                </div>
                <div className="preset-row">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`preset-chip ${cameras === p.value ? 'active' : ''}`}
                      onClick={() => setCameras(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="field-help">8대 이상 5%, 12대 이상 10% 자동 할인이 적용됩니다.</div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="f-rental">
                  현재(또는 견적 받으신) 월 렌탈료
                </label>
                <div className="field-input-wrap">
                  <input
                    id="f-rental"
                    type="number"
                    className="field-input has-suffix"
                    min={0}
                    step={1000}
                    placeholder="예: 120000"
                    inputMode="numeric"
                    value={rental}
                    onChange={(e) => setRental(e.target.value)}
                  />
                  <span className="field-suffix">원/월</span>
                </div>
                <div className="field-help">
                  다른 업체에서 받으신 견적이나, 지금 내고 계신 월 청구액을 입력하시면 누적 비용이 계산됩니다.
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="f-card">
                  내 카드 한도{' '}
                  <span style={{ color: 'var(--cal-muted)', fontWeight: 400 }}>(선택)</span>
                </label>
                <div className="field-input-wrap">
                  <input
                    id="f-card"
                    type="number"
                    className="field-input has-suffix"
                    min={0}
                    step={100000}
                    placeholder="예: 5000000"
                    inputMode="numeric"
                    value={card}
                    onChange={(e) => setCard(e.target.value)}
                  />
                  <span className="field-suffix">원</span>
                </div>
                <div className="field-help">
                  입력하시면 일시불·할부 결제 시 한도 영향을 안내해드립니다. 입력하지 않으셔도 계산은 됩니다.
                </div>
              </div>
            </div>

            <div className="calc-results">
              <div className="total-card">
                <div className="total-card-row">
                  <div>
                    <div className="total-card-label">키퍼 일시불 총액 (VAT 포함)</div>
                    <div className="total-card-value num">{formatKRW(totals.total)}</div>
                    <div className="total-card-sub">
                      카메라 {totals.cameras}대 × {formatKRW(CAMERA_UNIT_PRICE)}{totals.discountPct > 0 ? ` − 자동 할인 ${totals.discountPct}%` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="total-card-label">36개월 무이자 시 월 납입</div>
                    <div className="total-card-value accent num">{formatKRW(totals.m36)}</div>
                    <div className="total-card-sub">현대·롯데·삼성카드 기준</div>
                  </div>
                </div>
                <div className="breakdown">
                  <div className="breakdown-row">
                    <span>카메라 ({totals.cameras}대)</span>
                    <span className="num">{formatKRW(CAMERA_UNIT_PRICE * totals.cameras)}</span>
                  </div>
                  {totals.discountPct > 0 && (
                    <div className="breakdown-row">
                      <span>자동 할인 ({totals.discountPct}%)</span>
                      <span className="num" style={{ color: 'var(--cal-accent)', fontWeight: 600 }}>
                        −{formatKRW(totals.discountAmount)}
                      </span>
                    </div>
                  )}
                  <div className="breakdown-row">
                    <span>NVR(녹화기) · 저장공간</span>
                    <span className="num" style={{ color: 'var(--cal-positive)', fontWeight: 600 }}>
                      무상 제공
                    </span>
                  </div>
                </div>
              </div>

              <div className="install-grid">
                <div className="install-card">
                  <div className="install-tag">12개월</div>
                  <div className="install-months">무이자</div>
                  <div className="install-month-amt num">
                    {formatKRW(totals.m12)} <span className="install-month-suffix">/월</span>
                  </div>
                </div>
                <div className="install-card">
                  <div className="install-tag">24개월</div>
                  <div className="install-months">무이자</div>
                  <div className="install-month-amt num">
                    {formatKRW(totals.m24)} <span className="install-month-suffix">/월</span>
                  </div>
                </div>
                <div className="install-card featured">
                  <div className="install-tag">36개월</div>
                  <div className="install-months">무이자 · 추천</div>
                  <div className="install-month-amt num">
                    {formatKRW(totals.m36)} <span className="install-month-suffix">/월</span>
                  </div>
                </div>
              </div>

              {cardLimit > 0 ? (
                <div className={`limit-info ${limitTight ? 'coverage-tight' : 'coverage-ok'}`}>
                  <span className="icon">i</span>
                  {limitTight ? (
                    <>
                      입력하신 카드 한도 <strong>{formatKRW(cardLimit)}</strong>는 일시불 총액{' '}
                      <strong>{formatKRW(totals.total)}</strong>보다 작습니다. 결제 전 카드사에 임시 한도 상향(보통 1~3개월)을 신청해주세요.
                    </>
                  ) : (
                    <>
                      입력하신 카드 한도 <strong>{formatKRW(cardLimit)}</strong>로 일시불 총액{' '}
                      <strong>{formatKRW(totals.total)}</strong> 결제가 가능합니다.
                    </>
                  )}
                </div>
              ) : (
                <div className="limit-info">
                  <span className="icon">i</span>총액 <strong>{formatKRW(totals.total)}</strong>은 신용카드 한도에 영향을 줍니다. 36개월 무이자 분할을 선택하시더라도 결제 시점에 총액이 한도에서 차감되는 것이 일반적이므로(카드사별 상이), 한도가 빠듯하시다면 미리 카드사에 임시 한도 상향(보통 1~3개월)을 신청해두시면 좋습니다.
                </div>
              )}

              <div className="compare-block">
                <div className="compare-block-title">3 · 5 · 7 · 10년 누적 비교</div>
                {cumulative ? (
                  <>
                    <div className="compare-block-sub">
                      입력하신 월 렌탈료 <strong>{formatKRW(Number(rental))}</strong> 기준입니다.
                    </div>
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th>기간</th>
                          <th className="col-num">렌탈 누적</th>
                          <th className="col-num">키퍼 일시불</th>
                          <th className="col-num">차액</th>
                          <th className="col-num">배수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cumulative.map((row) => (
                          <tr key={row.year} className={row.year === 5 ? 'highlight' : ''}>
                            <td>{row.year}년</td>
                            <td className="col-num">{formatKRW(row.rentalSum)}</td>
                            <td className="col-num">{formatKRW(row.keeperSum)}</td>
                            <td className="col-num positive">+{formatKRW(row.diff)}</td>
                            <td className="col-num multi">{row.multi.toFixed(1)}배</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div
                    className="compare-block-sub"
                    style={{ color: 'var(--cal-accent)' }}
                  >
                    ↑ 위에 월 렌탈료를 입력하시면 누적 비용 차이가 즉시 계산됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="calc-notes">
          <strong>비교 기준</strong> — 키퍼: 카메라 대당 396,000원(VAT 포함), NVR(녹화기)·저장공간 무상 제공. 카드 결제 시 36개월 무이자(현대·롯데·삼성), 18개월(KB국민·농협), 그 외 24개월. 렌탈 비교는 입력하신 월 비용을 그대로 누적합니다(렌탈 계약은 일반적으로 3~5년 약정 후 자동 연장 또는 재계약).{' '}
          <strong>카메라는 결제 즉시 사장님 자산</strong>으로 등재됩니다.
        </div>
      </section>

      <VideoCompare />

      <section className="section">
        <div className="section-eyebrow">Section 02 · 매장에 키퍼인 이유</div>
        <h2 className="section-title">
          한 번 설치한 카메라는 <span className="accent">10년</span> 갑니다.
          <br />
          그동안 살아있을 회사·시스템인지가 가장 중요합니다.
        </h2>
        <p className="section-lede">
          한화비전(구 삼성테크윈)은 방산·반도체 광학 기술을 기반으로 한 글로벌 영상감시 솔루션 기업입니다. 외주 OEM이 아닌 자체 R&amp;D·자체 어플 운영 체계를 갖추고 있습니다.
        </p>
        <div className="benefits-grid">
          {[
            {
              n: '01',
              title: '결제 즉시\n매장 자산',
              desc:
                '렌탈은 10년이 지나도 카메라가 사장님 자산이 되지 않습니다. 키퍼는 첫 달부터 자산이며, 매장 매도·양도 시 그대로 인계할 수 있습니다.',
            },
            {
              n: '02',
              title: '화각 105°\n대수 절감 효과',
              desc:
                '매장용 일반 카메라(85~90°) 대비 약 17% 넓은 화각. 같은 매장이라도 카메라를 1~2대 덜 설치하거나, 같은 대수로 사각지대를 좁힐 수 있습니다.',
            },
            {
              n: '03',
              title: 'NVR(녹화기)\n무상 제공',
              desc:
                '녹화기와 저장공간을 별도 청구하지 않고 카메라 구성에 포함하여 제공. 견적은 카메라 대당 가격으로만 산정되어 추가 비용이 없습니다.',
            },
            {
              n: '04',
              title: '약 4주\n영상 보관',
              desc:
                '택배 분실·매장 분쟁·도난 신고는 보통 며칠~일주일 후 들어옵니다. 4주 분량의 영상이 사후 추적·증빙의 결정적 근거가 됩니다.',
            },
            {
              n: '05',
              title: '한화비전\n직접 운영 어플',
              desc:
                '렌탈사가 외주 맡긴 어플은 1~2년 뒤 업데이트가 끊기는 경우가 많습니다. 키퍼는 한화비전 내부팀이 직접 운영하여 폰 OS와 무관하게 호환성이 유지됩니다.',
            },
            {
              n: '06',
              title: '방산·반도체\n광학 기술 기반',
              desc:
                '방산 카메라·반도체 검사 장비에 사용되는 정밀 광학 기술이 그대로 이전된 카메라 모듈. 어두운 매장·역광에서도 노이즈가 적습니다.',
            },
          ].map((b) => (
            <div className="benefit" key={b.n}>
              <div className="benefit-num">{b.n}</div>
              <div className="benefit-title" style={{ whiteSpace: 'pre-line' }}>
                {b.title}
              </div>
              <div className="benefit-desc">{b.desc}</div>
            </div>
          ))}
        </div>
        <div className="asset-quote">
          <div className="body">
            “렌탈은 10년이 지나도 카메라가 <span className="accent">사장님 자산</span>이 되지 않습니다.
            <br />
            키퍼는 <span className="accent">첫 달부터 자산</span>입니다.”
          </div>
          <div className="attr">— 본 자료의 핵심 명제</div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">Section 03 · 자주 받는 질문</div>
        <h2 className="section-title">결정 전에 가장 많이 받는 질문</h2>
        <div className="faq-list">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className={`faq ${open ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="faq-q"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-q-icon" aria-hidden>
                    {open ? '−' : '+'}
                  </span>
                </button>
                {open && <div className="faq-a">{f.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-eyebrow">Next Step</div>
          <h2 className="cta-title">
            비교가 끝나셨다면,
            <br />
            <span className="accent">담당자 상담</span>으로 견적을 확정하세요.
          </h2>
          <p className="cta-sub">
            이름과 연락처만 남겨주시면, 키퍼 담당자가 직접 연락드려 매장에 맞는 견적을 안내해드립니다.
          </p>
          <Link href="/cal/lead" className="cta-btn">
            <span>상담 신청하기</span>
            <span className="arrow">→</span>
          </Link>
          <div className="cta-steps">
            <div className="step">
              <strong>① 신청</strong> · 이름·연락처 입력
            </div>
            <div className="step">
              <strong>② 상담</strong> · 담당자 직접 연락
            </div>
            <div className="step">
              <strong>③ 견적 확정</strong> · 대수·결제 선택
            </div>
            <div className="step">
              <strong>④ 설치</strong> · 1~2주 내 완료
            </div>
          </div>
        </div>
      </section>

      <footer className="cal-footer">
        <div className="footer-line">한화비전 KEEPER · CCTV 매장용 검토 자료</div>
        <div className="footer-line">
          <Link href="/cal/lead">상담 신청하기</Link>
        </div>
      </footer>

      <div className="mobile-cta">
        <Link href="/cal/lead">상담 신청하기 →</Link>
      </div>
    </main>
  );
}
