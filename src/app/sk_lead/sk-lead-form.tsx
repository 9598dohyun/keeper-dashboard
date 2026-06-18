'use client';

import { useState } from 'react';
import '../cal/cal.css';
import '../cal/lead/lead.css';
import './sk-lead.css';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const HERO_IMAGE = '/photo_2026-06-17%2018.57.12.jpeg';

const SWITCH_BENEFITS = [
  {
    ico: '💰',
    lead: '요금 부담 그대로',
    text: '지금 수준의 비용으로 400만 화소 QHD·4주 영상 보관까지 업그레이드',
  },
  {
    ico: '🆓',
    lead: '설치비 0원 + 앱 기능 무료',
    text: '빠른 영상 재생, 직원관리 기능까지 추가 비용 없이',
  },
  {
    ico: '🔒',
    lead: "약정·렌탈 아닌 '구매 소유형'",
    text: '다 내고 나면 내 장비, 이후 추가 망사용료 없음',
  },
  {
    ico: '🛡',
    lead: '끝까지 책임',
    text: '3년 무상 A/S + 안심케어 한화 보험 1년 무료',
  },
];

const WHY_KEEPER = [
  {
    ico: '🎥',
    text: '구매형으로 구매 즉시 고객님 소유, 망사용료 0원',
  },
  {
    ico: '📷',
    text: '한화비전 자체 기술력 400만 화소 QHD 압도적 화질차이',
  },
  {
    ico: '💾',
    text: '24시간 녹화 영상 / 4주 저장, 해킹 위험으로부터 안전!',
  },
  { ico: '🔧', text: '3년 무상 A/S' },
  {
    ico: '📱',
    text: '앱으로 매장 실시간 확인 + 문열림 감지 시 앱 알림 (경비모드)',
  },
  { ico: '🛡', text: '안심케어 한화 보험 1년 무료' },
];

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim();
}

function isValidPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export default function SkLeadForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const canSubmit = name.trim().length > 0 && isValidPhone(phone) && agree && status !== 'submitting';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/sk-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: normalizePhone(phone),
          agree: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `요청 실패 (${res.status})`);
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '신청 중 오류가 발생했습니다.');
    }
  }

  return (
    <main className="cal-main lead-main sk-main min-h-screen">
      <nav className="cal-nav">
        <div className="nav-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-ci-logo" src="/keeper-ci-logo.png" alt="한화비전 keeper" />
          </div>
        </div>
      </nav>

      <section className="sk-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="sk-hero-banner"
          src={HERO_IMAGE}
          alt="SK브로드밴드 종료 고객 전용 안내 — CCTV의 시대교체, 한화비전 키퍼"
        />
      </section>

      <section className="sk-intro">
        <div className="sk-eyebrow">SK브로드밴드 CCTV 서비스 종료 고객 전용</div>
        <h1>
          지금 내시던 비용 그대로,
          <br />
          <span className="accent">한화비전 키퍼</span>로 부담 없이.
        </h1>
        <p>
          SK브로드밴드 CCTV 종료 안내를 받으신 고객님께,
          <br />
          지금 내시던 비용 수준에서 한화비전 키퍼로 부담 없이 전환하실 수 있도록 안내드립니다.
        </p>
      </section>

      <section className="sk-section">
        <div className="sk-block">
          <div className="sk-block-title">한화비전 KEEPER(키퍼) CCTV로 바꾼다면?!</div>
          <div className="sk-list">
            {SWITCH_BENEFITS.map((b, i) => (
              <div className="sk-list-item" key={i}>
                <span className="sk-ico" aria-hidden>
                  {b.ico}
                </span>
                <span>
                  <strong className="sk-lead">{b.lead}</strong>
                  <span className="sk-dash"> — </span>
                  {b.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="sk-block">
          <div className="sk-block-title">글로벌 CCTV 제조사 한화비전이 직접 만들고, 직접 책임집니다.</div>
          <div className="sk-list">
            {WHY_KEEPER.map((b, i) => (
              <div className="sk-list-item" key={i}>
                <span className="sk-ico" aria-hidden>
                  {b.ico}
                </span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lead-section">
        <div className="lead-card">
          <p className="sk-form-lede">
            연락처를 남겨주시면 키퍼 전담 상담사가
            <br />
            영업일 기준 1~2일 내 직접 전화드립니다.
          </p>
          {status === 'success' ? (
            <div className="lead-success">
              <div className="lead-success-icon">✓</div>
              <h2 className="lead-success-title">신청이 접수되었습니다.</h2>
              <p className="lead-success-desc">
                키퍼 전담 상담사가 영업일 기준 1~2일 내에 입력하신 연락처로 직접 전화드립니다.
                <br />
                실시간 응대 시간(평일 9~11시 / 16:30~19시)에 문의주시면 더 빠르게 안내받으실 수 있습니다.
              </p>
              <div className="lead-success-actions">
                <button
                  type="button"
                  className="lead-btn lead-btn-primary"
                  onClick={() => {
                    setName('');
                    setPhone('');
                    setAgree(false);
                    setStatus('idle');
                  }}
                >
                  다시 신청하기
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="lead-form" noValidate>
              <div className="lead-field">
                <label className="lead-label" htmlFor="sk-name">
                  매장명 (혹은 성함) <span className="lead-required">*</span>
                </label>
                <input
                  id="sk-name"
                  type="text"
                  className="lead-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: ○○카페 / 김사장"
                  maxLength={40}
                  required
                />
              </div>

              <div className="lead-field">
                <label className="lead-label" htmlFor="sk-phone">
                  연락처 <span className="lead-required">*</span>
                </label>
                <input
                  id="sk-phone"
                  type="tel"
                  className="lead-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  inputMode="tel"
                  maxLength={20}
                  required
                />
                <div className="lead-help">
                  키퍼 전담 상담사가 연락드릴 번호입니다. 전환 상담 연락 목적으로만 사용됩니다.
                </div>
              </div>

              <div className="lead-field">
                <label className="lead-label">
                  개인정보 수집/이용 동의 <span className="lead-required">*</span>
                </label>
                <button
                  type="button"
                  className="sk-terms-toggle"
                  onClick={() => setShowTerms((v) => !v)}
                  aria-expanded={showTerms}
                >
                  개인 정보 수집 동의 및 이용 약관 상세 내용 보기
                </button>
                {showTerms && (
                  <div className="sk-terms-box">
                    <strong>수집 항목</strong> 매장명(혹은 성함), 연락처
                    <br />
                    <strong>수집 목적</strong> 한화비전 키퍼 전환 상담 연락
                    <br />
                    <strong>보유·이용 기간</strong> 상담 종료 후 관련 법령에 따라 보관·파기
                    <br />※ 남겨주신 정보는 전환 상담 연락 목적으로만 사용됩니다. 동의를 거부하실 수 있으나, 거부 시 상담 연락이 어렵습니다.
                  </div>
                )}
                <label className="lead-agree">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    <strong>(필수)</strong> 위 개인정보 수집·이용에 동의합니다.
                  </span>
                </label>
              </div>

              {status === 'error' && (
                <div className="lead-error">
                  ⚠ {errorMsg || '신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
                </div>
              )}

              <button type="submit" className="lead-submit" disabled={!canSubmit}>
                {status === 'submitting' ? '신청 중...' : '상담 신청하기'}
              </button>

              <div className="lead-note">
                신청 후 영업일 기준 1~2일 내 키퍼 전담 상담사가 직접 전화드립니다.
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="cal-footer">
        <div className="footer-line">한화비전 KEEPER · SK브로드밴드 종료 고객 전용 안내</div>
      </footer>
    </main>
  );
}
