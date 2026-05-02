'use client';

import Link from 'next/link';
import { useState } from 'react';
import '../cal.css';
import './lead.css';

type Status = 'idle' | 'submitting' | 'success' | 'error';

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

export default function LeadForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const canSubmit = name.trim().length > 0 && isValidPhone(phone) && agree && status !== 'submitting';

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
    <main className="cal-main lead-main pt-[80px] lg:pt-[80px] min-h-screen">
      <nav className="cal-nav">
        <div className="nav-inner">
          <Link href="/cal" className="brand" style={{ cursor: 'pointer' }}>
            <span className="brand-logo-text">KEEPER</span>
            <span className="brand-sub">한화비전 · 매장용 CCTV</span>
          </Link>
          <Link className="nav-cta" href="/cal">
            계산기로 돌아가기
          </Link>
        </div>
      </nav>

      <section className="lead-hero">
        <div className="hero-eyebrow">상담 신청</div>
        <h1>
          이름과 연락처만 남겨주시면,
          <br />
          <span className="accent">담당자가 직접 연락</span>드립니다.
        </h1>
        <p className="lead-sub">
          매장에 맞는 카메라 대수·결제 방법·설치 일정을 안내해드립니다.
          <br />
          닉네임으로 신청하셔도 됩니다.
        </p>
      </section>

      <section className="lead-section">
        <div className="lead-card">
          {status === 'success' ? (
            <div className="lead-success">
              <div className="lead-success-icon">✓</div>
              <h2 className="lead-success-title">신청이 접수되었습니다.</h2>
              <p className="lead-success-desc">
                키퍼 담당자가 영업일 기준 1~2일 내에 입력하신 연락처로 직접 연락드립니다.
                <br />
                실시간 응대 시간(평일 9~11시 / 16:30~19시)에 문의주시면 더 빠르게 안내받으실 수 있습니다.
              </p>
              <div className="lead-success-actions">
                <Link href="/cal" className="lead-btn lead-btn-secondary">
                  계산기로 돌아가기
                </Link>
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
                <label className="lead-label" htmlFor="lead-name">
                  이름 <span className="lead-required">*</span>
                  <span className="lead-label-help">(닉네임 가능)</span>
                </label>
                <input
                  id="lead-name"
                  type="text"
                  className="lead-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김사장 / 카페매니저"
                  maxLength={40}
                  required
                />
              </div>

              <div className="lead-field">
                <label className="lead-label" htmlFor="lead-phone">
                  연락처 <span className="lead-required">*</span>
                </label>
                <input
                  id="lead-phone"
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
                  담당자가 연락드릴 번호입니다. 입력하신 번호 외 다른 용도로 사용하지 않습니다.
                </div>
              </div>

              <label className="lead-agree">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  <strong>(필수)</strong> 위 정보를 키퍼 상담 목적으로 수집·이용하는 것에 동의합니다. 수집된 정보는 상담 종료 후 관련 법령에 따라 보관·파기됩니다.
                </span>
              </label>

              {status === 'error' && (
                <div className="lead-error">
                  ⚠ {errorMsg || '신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
                </div>
              )}

              <button type="submit" className="lead-submit" disabled={!canSubmit}>
                {status === 'submitting' ? '신청 중...' : '상담 신청하기'}
              </button>

              <div className="lead-note">
                신청 후 영업일 기준 1~2일 내 키퍼 담당자가 직접 연락드립니다.
              </div>
            </form>
          )}
        </div>
      </section>

      <footer className="cal-footer">
        <div className="footer-line">한화비전 KEEPER · CCTV 매장용 검토 자료</div>
        <div className="footer-line">
          <Link href="/cal">← 계산기로 돌아가기</Link>
        </div>
      </footer>
    </main>
  );
}
