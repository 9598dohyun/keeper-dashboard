'use client';

import { useState } from 'react';
import './trial.css';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const FAQS: { q: string; a: string }[] = [
  {
    q: '30일 후 회수해도 정말 비용이 0원인가요?',
    a: '네, 100% 0원입니다. 설치비·철거비·왕복 출장비를 모두 키퍼가 부담합니다. 카메라가 부서지거나 파손된 경우가 아니라면 추가 청구는 일체 없습니다.',
  },
  {
    q: '시범 설치는 몇 대까지 가능한가요?',
    a: '최소 2대부터 최대 32대까지 가능합니다. 1대만으로는 시범 설치가 어렵고, 32대를 초과하는 대규모 매장은 별도 B2B 상담으로 진행됩니다. 콜 시점에 매장 면적·구조에 맞춰 적정 대수를 함께 정합니다.',
  },
  {
    q: 'NVR(녹화기)도 함께 설치되나요?',
    a: '네, NVR과 저장공간(약 4주 분량)도 모두 무상 설치됩니다. 별도 비용이 발생하지 않습니다. 모니터는 매장에 있는 TV·모니터를 그대로 사용하시거나, 필요 시 별도 준비하시면 됩니다.',
  },
  {
    q: '체험 중 카메라가 도난·파손되면?',
    a: '통상적인 매장 운영 중 발생한 사고는 키퍼가 부담합니다. 다만 고의적인 파손이나 무단 양도 등 명백한 과실의 경우 별도 협의가 필요합니다. 자세한 책임 범위는 콜 시점에 안내드립니다.',
  },
  {
    q: '자산 전환 시 결제 방법은 어떻게 되나요?',
    a: '카메라 대당 396,000원(VAT 포함) 기준으로 일시불 또는 카드 무이자 할부가 가능합니다. 36개월 무이자(삼성·현대·롯데·국민·하나·신한), 24개월(우리), 18개월(농협), 12개월(BC). 8대 이상은 5%, 12대 이상은 10% 자동 할인이 적용됩니다.',
  },
  {
    q: '설치 가능한 지역이 따로 있나요?',
    a: '전국 어디든 신청 가능합니다. 다만 지역에 따라 현장 실사·설치 일정이 다소 조정될 수 있습니다. 신청 후 콜에서 매장 위치를 확인한 뒤 가능한 일정을 안내드립니다.',
  },
];

function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw.trim();
}

function isValidPhone(raw: string) {
  const d = raw.replace(/\D/g, '');
  return d.length === 10 || d.length === 11;
}

export default function TrialLanding() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit =
    name.trim().length > 0 && isValidPhone(phone) && agree && status !== 'submitting';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          source: 'trial',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `요청 실패 (${res.status})`);
      }

      setStatus('success');
      setTimeout(() => {
        document.getElementById('apply')?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 50);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '신청 중 오류가 발생했습니다.');
    }
  }

  return (
    <main className="trial-main">
      <nav className="trial-nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="brand-logo-text">KEEPER</span>
            <span className="brand-sub">한화비전 · 매장용 CCTV</span>
          </div>
          <a className="nav-cta" href="#apply">
            무료체험 신청하기
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">한 달 무료체험</div>
        <h1>
          <span className="strike">3년 약정</span>으로 묶이기 전에,
          <br />
          <span className="accent">30일 먼저 써보세요.</span>
        </h1>
        <p className="hero-sub">
          카메라 2대부터 32대까지, 매장에 시범 설치해드립니다.
          <br />
          30일 후 마음에 들면 그대로 자산화, 아니면 회수해드립니다.
        </p>
        <a href="#apply" className="hero-cta">
          30초 무료체험 신청하기
        </a>
        <div className="hero-trust">
          <span>결제 0원으로 시작</span>
          <span>2~32대 시범 설치</span>
          <span>회수 시 비용 0원</span>
          <span>30일 후 사장님이 결정</span>
        </div>
      </section>

      <section className="section">
        <div className="section-eyebrow">Section 01 · 무료체험의 약속</div>
        <h2 className="section-title">
          사장님 부담은 <span className="accent">0원</span>입니다.
        </h2>
        <p className="section-lede">
          렌탈은 처음부터 사장님이 비용·약정·위약금을 떠안고 시작합니다. 키퍼 무료체험은 반대입니다 — 키퍼가 먼저 보여드립니다.
        </p>
        <div className="promise-grid">
          <div className="promise-card">
            <div className="promise-num">01</div>
            <div className="promise-title">
              <span className="accent">결제 0원</span>으로 시작
            </div>
            <div className="promise-desc">
              신청부터 30일까지 결제·약정·위약금 일체 없습니다. 사업자등록증·카드 사전등록 같은 절차도 없습니다.
            </div>
          </div>
          <div className="promise-card">
            <div className="promise-num">02</div>
            <div className="promise-title">
              30일 뒤
              <br />
              사장님이 결정
            </div>
            <div className="promise-desc">
              만족하시면 그대로 매장 자산으로 전환, 마음에 안 드시면 회수 요청만 주시면 됩니다. 강제 전환·자동 결제 없습니다.
            </div>
          </div>
          <div className="promise-card">
            <div className="promise-num">03</div>
            <div className="promise-title">
              회수해도
              <br />
              <span className="accent">비용 0원</span>
            </div>
            <div className="promise-desc">
              설치비·철거비·왕복 출장비 모두 키퍼가 부담합니다. 사장님은 30일 동안 영상 품질을 직접 확인만 하시면 됩니다.
            </div>
          </div>
        </div>
      </section>

      <section className="section section-tinted">
        <div className="section-eyebrow">Section 02 · 진행 방식</div>
        <h2 className="section-title">
          신청부터 결정까지 <span className="accent">30일</span>
        </h2>
        <p className="section-lede">
          복잡한 절차 없이 4단계로 진행됩니다. 모든 단계는 사장님 일정에 맞춰 조정 가능합니다.
        </p>
        <div className="timeline-wrap">
          <div className="timeline">
            <div className="timeline-step">
              <div className="timeline-dot">D-0</div>
              <div className="timeline-body">
                <div className="timeline-day">신청 당일</div>
                <div className="timeline-title">무료체험 신청 → 1영업일 내 콜백</div>
                <div className="timeline-desc">
                  이름·연락처만 남겨주시면 키퍼 담당자가 직접 연락드립니다. 매장 위치·업종·예상 카메라 대수를 콜에서 확인합니다.
                </div>
              </div>
            </div>
            <div className="timeline-step">
              <div className="timeline-dot">D+3~7</div>
              <div className="timeline-body">
                <div className="timeline-day">설치 일정 협의</div>
                <div className="timeline-title">현장 실사 → 시범 설치</div>
                <div className="timeline-desc">
                  매장 구조·층고·동선 확인 후, 사장님 매장에 맞춰 <strong>2~32대 카메라</strong>와 NVR(녹화기)을 무상 설치합니다. 모니터는 매장에 있는 것을 사용하시면 됩니다.
                </div>
              </div>
            </div>
            <div className="timeline-step">
              <div className="timeline-dot">D+7~30</div>
              <div className="timeline-body">
                <div className="timeline-day">30일 체험 기간</div>
                <div className="timeline-title">영상 품질·앱 사용성 직접 체험</div>
                <div className="timeline-desc">
                  화각, 야간 화질, 모바일 앱 알림, 4주 영상 보관까지 매장 운영 그대로 사용해보세요. 체험 중 언제든 추가 카메라 위치 조정이 가능합니다.
                </div>
              </div>
            </div>
            <div className="timeline-step is-final">
              <div className="timeline-dot">D+30</div>
              <div className="timeline-body">
                <div className="timeline-day">최종 결정</div>
                <div className="timeline-title">
                  자산 전환 또는 회수 — <span style={{ color: 'var(--trial-accent)' }}>사장님 선택</span>
                </div>
                <div className="timeline-desc" style={{ marginBottom: 10 }}>
                  설치된 카메라를 그대로 매장 자산으로 전환하거나, 회수를 요청하실 수 있습니다.
                </div>
                <div className="timeline-choice">
                  <div className="choice-card primary">
                    <strong>① 자산 전환</strong>
                    <br />
                    정식 결제 후 사장님 자산으로 등재. 일시불 또는 최대 36개월 무이자 분할.
                  </div>
                  <div className="choice-card">
                    <strong>② 회수 요청</strong>
                    <br />
                    설치한 카메라·NVR 모두 회수. 철거비·왕복 출장비 키퍼 부담.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-eyebrow">Section 03 · 비교</div>
        <h2 className="section-title">
          렌탈은 약정부터, 키퍼는 <span className="accent">체험부터</span>
        </h2>
        <p className="section-lede">
          같은 매장 CCTV지만, 시작하는 방식이 다릅니다. 부담의 무게부터 비교해보세요.
        </p>
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th></th>
                <th>일반 렌탈</th>
                <th className="col-keeper">키퍼 30일 무료체험</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-label">시작 비용</td>
                <td className="neg">설치비 + 첫 달 렌탈비 즉시 청구</td>
                <td className="col-keeper">0원</td>
              </tr>
              <tr>
                <td className="row-label">약정</td>
                <td className="neg">3~5년 약정 + 위약금 발생</td>
                <td className="col-keeper">없음</td>
              </tr>
              <tr>
                <td className="row-label">결정 시점</td>
                <td className="neg">계약 직후 / 사용 전</td>
                <td className="col-keeper">30일 직접 사용 후</td>
              </tr>
              <tr>
                <td className="row-label">불만족 시</td>
                <td className="neg">위약금 부담하고 해지</td>
                <td className="col-keeper">회수 요청 — 비용 0원</td>
              </tr>
              <tr>
                <td className="row-label">자산 여부</td>
                <td className="neg">10년 내도 사장님 자산 X</td>
                <td className="col-keeper">자산 전환 시 즉시 사장님 자산</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">Section 04 · 자주 받는 질문</div>
        <h2 className="section-title">신청 전에 가장 많이 물어보시는 것</h2>
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
                  <span className="faq-q-icon">{open ? '−' : '+'}</span>
                </button>
                {open && <div className="faq-a">{f.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="cta-section" id="apply">
        <div className="cta-inner">
          <div className="cta-eyebrow">무료체험 신청</div>
          <h2 className="cta-title">
            이름과 연락처만 남겨주세요.
            <br />
            <span className="accent">담당자가 직접 연락</span>드립니다.
          </h2>
          <p className="cta-sub">
            신청은 30초. 결제·약정·위약금 일체 없습니다.
            <br />
            닉네임으로 신청하셔도 됩니다.
          </p>

          <div className="form-card">
            {status === 'success' ? (
              <div className="form-success">
                <div className="form-success-icon">✓</div>
                <div className="form-success-title">신청이 접수되었습니다.</div>
                <div className="form-success-desc">
                  키퍼 담당자가 영업일 기준 1~2일 내에
                  <br />
                  입력하신 연락처로 직접 연락드립니다.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label className="form-label" htmlFor="t-name">
                    이름 <span className="form-required">*</span>
                    <span className="form-label-help">(닉네임 가능)</span>
                  </label>
                  <input
                    id="t-name"
                    type="text"
                    className="form-input"
                    placeholder="예: 김사장 / 카페매니저"
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="t-phone">
                    연락처 <span className="form-required">*</span>
                  </label>
                  <input
                    id="t-phone"
                    type="tel"
                    className="form-input"
                    placeholder="010-0000-0000"
                    inputMode="tel"
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <div className="form-help">
                    담당자가 연락드릴 번호입니다. 입력하신 번호 외 다른 용도로 사용하지 않습니다.
                  </div>
                </div>

                <label className="form-agree">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    <strong>(필수)</strong> 위 정보를 키퍼 무료체험 상담 목적으로 수집·이용하는 것에 동의합니다. 수집된 정보는 상담 종료 후 관련 법령에 따라 보관·파기됩니다.
                  </span>
                </label>

                {status === 'error' && (
                  <div className="form-error">
                    ⚠ {errorMsg || '신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
                  </div>
                )}

                <button type="submit" className="form-submit" disabled={!canSubmit}>
                  {status === 'submitting' ? '신청 중...' : '무료체험 신청하기'}
                </button>

                <div className="form-note">
                  신청 후 영업일 기준 1~2일 내 키퍼 담당자가 직접 연락드립니다.
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className="trial-footer">
        <div className="footer-line">한화비전 KEEPER · 30일 무료체험</div>
        <div className="footer-line">결제 0원 / 약정 없음 / 위약금 없음</div>
      </footer>

      <div className="mobile-cta">
        <a href="#apply">무료체험 신청하기 →</a>
      </div>
    </main>
  );
}
