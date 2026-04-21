'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import NavTabs from '../components/nav-tabs';

/* ── 탭 정의 ── */
const TAB_DEFS = [
  { id: 'ops', label: '내부운영룰' },
  { id: 'price', label: '가격·결제' },
  { id: 'spec', label: '제품스펙' },
  { id: 'vs', label: '경쟁사비교' },
  { id: 'cs', label: '고객응대' },
  { id: 'at', label: '에어테이블' },
  { id: 'call', label: '전화상담' },
] as const;

type TabId = (typeof TAB_DEFS)[number]['id'];

/* ── 헬퍼 컴포넌트 ── */
function Alert({ type, children }: { type: 'danger' | 'warning' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    danger: 'bg-red-50 border-l-3 border-red-400',
    warning: 'bg-amber-50 border-l-3 border-amber-400',
    info: 'bg-blue-50 border-l-3 border-blue-400',
    success: 'bg-green-50 border-l-3 border-green-400',
  };
  return <div className={`rounded-lg p-3 text-[13px] ${styles[type]}`}>{children}</div>;
}

function Tag({ color, children }: { color: 'red' | 'green' | 'yellow' | 'blue'; children: React.ReactNode }) {
  const styles = {
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${styles[color]}`}>{children}</span>;
}

function SectionCard({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} data-section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 scroll-mt-28">
      <h2 className="text-[15px] font-bold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left p-2 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="p-2 border-b border-gray-100 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-3 text-left text-[14px] font-semibold">
        <span>{q}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && <div className="pb-3 text-[14px] text-gray-500">{a}</div>}
    </div>
  );
}

function TemplateBox({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);
  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-4 text-[13px] whitespace-pre-wrap leading-7">
      <button
        onClick={copy}
        className={`absolute top-2 right-2 px-2 py-1 text-[11px] border rounded-md transition-colors ${
          copied ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-red-500 hover:text-white hover:border-red-500'
        }`}
      >
        {copied ? '완료!' : '복사'}
      </button>
      {children}
    </div>
  );
}

/* ── 좌측 상황별 퀵 가이드 ── */
function QuickGuideItem({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 py-2.5 text-left text-[13px] font-semibold hover:bg-gray-50 px-2 rounded-md">
        <span>{emoji}</span>
        <span className="flex-1">{title}</span>
        <span className={`text-gray-400 text-[11px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && <div className="px-2 pb-3 text-[12px] text-gray-600 leading-5">{children}</div>}
    </div>
  );
}

function QuickGuideTag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1 ${colors[color] || colors.gray}`}>{children}</span>;
}

const QUICK_GUIDES: Record<string, React.ReactNode> = {
  ops: (
    <>
      <QuickGuideItem emoji="🚨" title="아파트 설치 문의">
        <p><strong>설치 불가</strong> → B2B 이관 (임채형 사원 경유)</p>
        <p className="text-gray-400 mt-1">상업용과 구조 달라 추가비 과도</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏭" title="&quot;국산 카메라인가요?&quot;">
        <p><QuickGuideTag color="red">금지</QuickGuideTag> &quot;국산 카메라&quot; 안내 절대 금지</p>
        <p className="mt-1">→ &quot;한화비전 자체 기술력, 베트남 OEM 생산&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏗️" title="&quot;인테리어 중인데 언제 설치?&quot;">
        <p>공사 순서: <strong>철거·사전전기→목공→전기(실사가능)→페인트·바닥마무리→CCTV</strong></p>
        <p className="mt-1">→ CCTV는 <strong>페인트 이후, 가장 마지막</strong>에 설치 권장</p>
        <p className="text-gray-400 mt-1 text-[12px]">넓은 면적은 스프레이건 작업 → CCTV 가림 어려움 / 페인트 전 설치 시 철거 후 미도장 부분 발생</p>
        <p className="text-gray-400 mt-1">도면/사진 먼저 받고 대수 제안</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🛗" title="엘리베이터 있는 건물">
        <p><QuickGuideTag color="red">필수</QuickGuideTag> 초반에 &quot;엘리베이터 있나요?&quot; 필수 질문</p>
        <p className="mt-1">산안법 적용 → <strong>수백만원 추가 시공비 가능</strong> 사전 경고</p>
        <p className="text-red-500 mt-1">사례: 결제 후 590만원 추가비 통보 → 대형 클레임</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📞" title="부재중 리드 대응">
        <p>24시간 내 3회 시도(매회 문자) → 다음 날 오전/오후 각 1회 → 2~3일 뒤 마지막</p>
      </QuickGuideItem>
    </>
  ),
  price: (
    <>
      <QuickGuideItem emoji="💰" title="&quot;얼마예요? 한 대당 / 월 얼마?&quot;">
        <p>1대 <strong>월 11,000원</strong>(VAT포함) × 대수 = 월 납입금</p>
        <p className="mt-1">4대 월 44,000원 / 총 1,584,000원 / 36개월 무이자</p>
        <p className="text-gray-400 mt-1">반드시 VAT 포함으로 통일 안내</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏷️" title="&quot;할인 안 되나요? / 깎아주세요&quot;">
        <p><QuickGuideTag color="blue">수량할인</QuickGuideTag> 9대↑ 5% / 16대↑ 10%</p>
        <p><QuickGuideTag color="green">일시불</QuickGuideTag> 추가 5% (일시불에서만)</p>
        <p className="mt-1"><strong>BP:</strong> 할인 대신 <strong>대수 최적화</strong>로 단가 유지</p>
        <p className="text-gray-400 mt-1">&quot;화각 105도라 대수 줄여도 커버 가능&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏢" title="&quot;법인인데 할부 되나요?&quot;">
        <p><QuickGuideTag color="red">주의</QuickGuideTag> <strong>법인은 일시불만</strong> / 개인사업자 할부 가능</p>
        <p className="text-gray-400 mt-1">초반에 법인/개인 확인 필수</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🖥️" title="&quot;모니터 포함이에요?&quot;">
        <p><strong>모니터 별도</strong> → 고객이 준비</p>
        <p className="text-red-500 mt-1">🚨 가격 안내 직후 반드시 안내 (클레임 다수)</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="💸" title="예산 초과 고객 대응">
        <p>&quot;키퍼 정가 판매라 가격 조정 불가&quot; 솔직 안내</p>
        <p className="mt-1">→ 대수 최적화 제안 or &quot;현장에서 추가/감소 조정 가능&quot;</p>
      </QuickGuideItem>
    </>
  ),
  spec: (
    <>
      <QuickGuideItem emoji="📷" title="기본 스펙 멘트 (암기 필수)">
        <p><strong>&quot;400만 화소 QHD · 30일 저장 · 105도 광각 · 야간보정&quot;</strong></p>
        <p className="text-gray-400 mt-1">이 4종 세트를 모든 상담에서 기본 안내</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🔢" title="&quot;500만 화소가 더 좋지 않아요?&quot;">
        <p><strong>BP:</strong> &quot;500만 화소는 마케팅 용어. 4:3 vs 16:9 비율 차이일 뿐&quot;</p>
        <p className="mt-1">&quot;화소 높으면 저장 용량 많이 먹어 <strong>저장 1~2주밖에 안 됨</strong>&quot;</p>
        <p className="mt-1">→ 키퍼 400만 + 30일 저장이 실익이 더 큼</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🚪" title="&quot;움직임 감지 / 알람 되나요?&quot;">
        <p>카메라 움직임 감지 = <strong>녹화 검색 편의용</strong></p>
        <p className="text-red-500">경비 알림은 도어센서만. 출동 서비스 없음</p>
        <p className="text-gray-400 mt-1">S1 알람(월 5.5만) / 세콤 출동과 혼동 주의</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📹" title="&quot;몇 대 필요해요?&quot;">
        <p>평수·구조·출입구 질문 후 제안</p>
        <p className="mt-1"><strong>BP:</strong> &quot;방 4개? 외부도? → 4대 딱 맞습니다&quot;</p>
        <p className="text-gray-400 mt-1">3대 이하는 프로모션 안내 금지</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="👤" title="&quot;직원 출퇴근 관리도 돼요?&quot;">
        <p><strong>월 500원 (곧 무료화 예정)</strong>, 출퇴근 자동 계산</p>
        <p className="text-gray-400 mt-1">매장형(카페·식당·미용실) 고객 관심 높음 → 선제 안내</p>
      </QuickGuideItem>
    </>
  ),
  vs: (
    <>
      <QuickGuideItem emoji="⭐" title="원샷 포지션 멘트 (암기)">
        <p>&quot;캡스·세콤은 <strong>경비 출동</strong>이 본업이라 월 10만 원 이상 계속,</p>
        <p>S1·KT는 <strong>렌탈</strong>이라 3년 뒤 카메라 가져갑니다.</p>
        <p>중국산은 A/S 1년이고 해킹 이슈도 걱정되죠.</p>
        <p>키퍼는 <strong>한화비전이 직접 만든 CCTV를 36개월 할부로 사시는 것</strong>이라</p>
        <p>3년 뒤엔 고객님 소유고 추가 비용도 없습니다.</p>
        <p>저장 30일, 400만 QHD, A/S 3년 무상 — 이게 차이입니다.&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🔵" title="&quot;캡스/세콤 알아보고 있어요&quot;">
        <p>&quot;경비 출동이 본업이라 <strong>월 10만+ 영구</strong>. 키퍼는 CCTV 구매라 3년이면 끝&quot;</p>
        <p className="mt-1">&quot;캡스 AI 기능은 대형·무인매장용. 소규모는 CCTV+도어센서면 충분&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🟠" title="&quot;S1/KT 견적 받았는데요&quot;">
        <p>&quot;3년 뒤 카메라 가져갑니다. 키퍼는 3년 뒤 <strong>고객님 소유 + 월 0원</strong>&quot;</p>
        <p className="mt-1">&quot;S1 저장 17~20일, KT 15일 → 키퍼 <strong>30일</strong>&quot;</p>
        <p className="mt-1"><strong>양도:</strong> &quot;가게 팔 때 권리금에 카메라값 포함 가능&quot; (렌탈은 불가)</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🔴" title="&quot;인터넷에서 싼 거 봤는데&quot;">
        <p>&quot;화소 숫자만 크고 저장 1~2주. A/S 1년, 해킹 위험(미·영 정부 금지)&quot;</p>
        <p className="mt-1"><strong>BP:</strong> &quot;화소 높으면 저장 용량만 잡아먹어 저장기간 오히려 짧아짐&quot;</p>
      </QuickGuideItem>
    </>
  ),
  cs: (
    <>
      <QuickGuideItem emoji="🔐" title="&quot;선결제가 좀 의심되는데…&quot;">
        <p><strong>BP:</strong> &quot;한화비전 공식 서비스입니다. 앱스토어에서 '키퍼' 검색해보세요&quot;</p>
        <p className="text-gray-400 mt-1">보이스피싱 의심 고객 증가 → 공식성 강조 필수</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📋" title="&quot;3년 뒤엔 어떻게 되나요?&quot;">
        <p>&quot;36개월 완납 후 <strong>고객님 소유</strong>. 렌탈 아닙니다&quot;</p>
        <p className="mt-1">A/S: 3년 무상 → 3~5년 출장비 8만원 + 부품 유상</p>
        <p className="mt-1"><strong>양도:</strong> 가게 매매 시 권리금에 포함 가능</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🚨" title="클레임 발생 시 (3단계)">
        <p>① <strong>감정 수용:</strong> &quot;충분히 화나실 수 있습니다&quot;</p>
        <p>② <strong>원인 인정:</strong> &quot;커뮤니케이션 전달 오류였습니다&quot;</p>
        <p>③ <strong>해결 약속:</strong> &quot;내부 검토 후 방향 연락드리겠습니다&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="👴" title="IT 취약 고객 (고령)">
        <p><strong>BP:</strong> 카카오톡 알림톡 결제 링크 제공</p>
        <p>&quot;핸드폰 링크 클릭하면 바로 결제 화면&quot;</p>
        <p className="mt-1">&quot;주말에도 연락 주셔도 괜찮습니다&quot; 접근성 확보</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏗️" title="&quot;넓은 매장 / 복층인데 가능?&quot;">
        <p>녹화기~카메라 거리·층고·구조물 → <strong>현장확인 필수</strong></p>
        <p className="mt-1">복층 = 난공사 → 추가공사비 사전 안내</p>
        <p className="text-gray-400 mt-1">8대↑ 실사 필수 / 4대↓ 사진·도면 가능</p>
      </QuickGuideItem>
    </>
  ),
  at: (
    <>
      <QuickGuideItem emoji="📝" title="메모 뭘 써야 하나요?">
        <p><strong>필수:</strong> 업종 + 카메라 대수 + 특이사항</p>
        <p className="mt-1">예: &quot;카페 / 4대 / 테라스 있음 / 다음주 오픈&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🔄" title="중복 리드 처리">
        <p>전화번호 뒷 8자리 기준 → <strong>마지막 유입 건을 살리고</strong> 나머지 실패 처리</p>
        <p className="mt-1">과거 실패 건 재유입 = 부활 처리</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📊" title="딜스테이지 변경 순서">
        <p>상담예정 → 상담완료 → 회원가입 → 결제완료</p>
      </QuickGuideItem>
    </>
  ),
  call: (
    <>
      <QuickGuideItem emoji="⏱️" title="리드 우선순위">
        <p>① 전화예약(약속) → ② 실시간 유입 → ③ 전화예약(랜덤) → ④ 잔존 리드</p>
        <p className="text-gray-400 mt-1">실시간 9-11시 / 16:30-19시 = 온도감 유지 핵심</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📵" title="부재중 3회 후 어떡하죠?">
        <p>다음 날 오전/오후 각 1회(매회 문자) → 2~3일 뒤 마지막 시도 후 실패 처리</p>
        <p className="text-gray-400 mt-1">모든 시도에 문자 필수</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="💬" title="가격 저항 대응">
        <p>&quot;월 4만원대면 하루 1,500원, 커피 한 잔 값으로 24시간 보안입니다.&quot;</p>
        <p className="mt-1">&quot;다른 곳은 렌탈이라 36개월 후에도 월비용. 키퍼는 <strong>내 것</strong>&quot;</p>
        <p className="mt-1"><strong>BP:</strong> 대수 최적화 제안 → &quot;화각 105도라 줄여도 커버 가능&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🌙" title="야간 리드(21~23시) 대응">
        <p>채팅 상담 중심 → 전화번호 확보 → 다음 날 오전 콜백</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📝" title="인수인계 메모 필수">
        <p>CRM에 &quot;다음 담당자 인수 필수: OOO 재연락&quot; 기록</p>
        <p className="text-red-500 mt-1">미기록 시 동일 고객 반복 질문 → 신뢰 손상</p>
      </QuickGuideItem>
    </>
  ),
};

function QuickGuidePanel({ tabId }: { tabId: string }) {
  const guide = QUICK_GUIDES[tabId];
  if (!guide) return null;
  return (
    <div data-section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4 scroll-mt-28">
      <h2 className="text-[15px] font-bold text-gray-900 mb-3">💡 이럴 땐 이렇게</h2>
      {guide}
    </div>
  );
}

/* ── 탭 콘텐츠 ── */
function OpsTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="⏰ 근무·응대 시간">
        <Table
          headers={['구분', '시간대', '내용']}
          rows={[
            ['실시간 콜', '9:00–11:00 / 16:30–19:00', '담당 분배 기다리지 말고 빨리 잡기 — 온도감 유지'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🎙️ 통화 녹음">
        <Table
          headers={['항목', '룰']}
          rows={[
            ['업로드 대상', <strong key="r">3분 이상 모든 통화 — 전부 업로드 필수</strong>],
            ['업로드 위치', '영원 내부 드라이브'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🚨 상담 중 정정 사항">
        <div className="mb-2"><Tag color="red">필수 확인</Tag></div>
        <Table
          headers={['주제', '기존 안내 ✕', '올바른 안내 ✔', '비고']}
          rows={[
            ['아파트 설치', '아파트 설치 가능', <strong key="a">설치 불가 → 임채형 사원 경유 B2B 이관</strong>, '상업용과 구조 달라 추가비 과도'],
            ['제조 원산지', '"국산 카메라"', <strong key="b">한화비전 자체 기술력, 베트남 제조 생산</strong>, '본사 컴플레인 발생 사례'],
            ['엘리베이터 내부', '-', '설치 가능, 단 추가 비용 발생 (산안법 적용)', ''],
            ['매장 양도', '-', '기존 키퍼 ID 유지 불가, 새 ID 생성 시 양도 가능', ''],
          ]}
        />
        <div className="mt-3">
          <Alert type="danger">
            <strong>&quot;국산 카메라&quot; 안내 절대 금지</strong> — &quot;한화비전 자체 기술력, 베트남 제조 생산&quot;으로 안내
          </Alert>
        </div>
      </SectionCard>

      <SectionCard title="🔗 외부 시스템 연동">
        <Table
          headers={['대상', '룰']}
          rows={[
            ['현장실사 티켓', '혜성님 선 연락 후 발행 (직접 발행 금지)'],
          ]}
        />
        <div className="mt-3">
          <Alert type="info">
            부재중 프로세스 → <strong>전화상담</strong> 탭 참조 | 중복 리드 → <strong>에어테이블</strong> 탭 참조
          </Alert>
        </div>
      </SectionCard>
    </div>
  );
}

function PriceTab() {
  return (
    <div className="space-y-4">
      <SectionCard id="price-installment" title="💰 할부 가격표 (36개월 무이자)">
        <p className="text-[13px] text-gray-500 mb-2">녹화기(NVR)·설치비·저장공간 모두 포함 | 삼성·현대·롯데 무이자</p>
        <Alert type="warning">고객 안내 시 반드시 <strong>VAT 포함 금액</strong>으로 안내</Alert>
        <div className="mt-3">
          <Table
            headers={['대수', '월 할부금 (VAT포함)', '총액 (VAT포함)']}
            rows={[
              ['2대', <strong key="p2">22,000원</strong>, '792,000원'],
              ['3대', <strong key="p3">33,000원</strong>, '1,188,000원'],
              ['4대', <strong key="p4">44,000원</strong>, '1,584,000원'],
              ['5대', <strong key="p5">55,000원</strong>, '1,980,000원'],
              ['6대', <strong key="p6">66,000원</strong>, '2,376,000원'],
              ['7대', <strong key="p7">77,000원</strong>, '2,772,000원'],
              ['8대', <strong key="p8">88,000원</strong>, '3,168,000원'],
              ['9대', <strong key="p9">99,000원</strong>, '3,564,000원'],
              ['10대', <strong key="p10">110,000원</strong>, '3,960,000원'],
              ['12대', <strong key="p12">132,000원</strong>, '4,752,000원'],
              ['16대', <strong key="p16">176,000원</strong>, '6,336,000원'],
              ['20대', <strong key="p20">220,000원</strong>, '7,920,000원'],
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard id="price-discount" title="🏷️ 할인 정책">
        <Alert type="info"><strong>개수 할인</strong>(수량별) = 할부·일시불 모두 적용 | <strong>일시불 할인</strong> = 일시불에서만</Alert>
        <h3 className="text-[14px] font-semibold mt-4 mb-2">현행 (9대↑ 5%, 16대↑ 10%)</h3>
        <Table
          headers={['대수', '할인율', '할인가 (VAT포함)', '절감액']}
          rows={[
            ['9대', <Tag key="d9" color="blue">5%</Tag>, '3,385,800원', '178,200원'],
            ['10대', <Tag key="d10" color="blue">5%</Tag>, '3,762,000원', '198,000원'],
            ['12대', <Tag key="d12" color="blue">5%</Tag>, '4,514,400원', '237,600원'],
            ['16대', <Tag key="d16" color="green">10%</Tag>, '5,702,400원', '633,600원'],
            ['20대', <Tag key="d20" color="green">10%</Tag>, '7,128,000원', '792,000원'],
          ]}
        />
        <h3 className="text-[14px] font-semibold mt-4 mb-2">5월 변경 예정 (8대↑ 5%, 12대↑ 10%) <Tag color="yellow">예정</Tag></h3>
        <Table
          headers={['대수', '할인율', '할인가 (VAT포함)', '절감액']}
          rows={[
            ['8대', <Tag key="n8" color="blue">5%</Tag>, '3,009,600원', '158,400원'],
            ['10대', <Tag key="n10" color="blue">5%</Tag>, '3,762,000원', '198,000원'],
            ['12대', <Tag key="n12" color="green">10%</Tag>, '4,276,800원', '475,200원'],
            ['16대', <Tag key="n16" color="green">10%</Tag>, '5,702,400원', '633,600원'],
            ['20대', <Tag key="n20" color="green">10%</Tag>, '7,128,000원', '792,000원'],
          ]}
        />
      </SectionCard>

      <SectionCard id="price-relocation" title="🔄 위치변경·이전설치 단가">
        <h3 className="text-[14px] font-semibold mb-2">위치변경 (동일 건물 내)</h3>
        <p className="text-[13px] text-gray-500 mb-2">대당 120,000원 균일가</p>
        <Table
          headers={['대수', '청구 가격']}
          rows={[
            ['1대', '120,000원'], ['2대', '240,000원'], ['3대', '360,000원'],
            ['4대', '480,000원'], ['5대', '600,000원'],
          ]}
        />
        <h3 className="text-[14px] font-semibold mt-4 mb-2">이전설치 (철거→재설치)</h3>
        <Table
          headers={['대수', '청구 가격']}
          rows={[
            ['2대', '400,000원'], ['3대', '520,000원'],
            ['4대', '640,000원'], ['5대', '760,000원'],
          ]}
        />
      </SectionCard>

      <SectionCard id="price-payment" title="💳 결제 안내">
        <Table
          headers={['항목', '내용']}
          rows={[
            ['결제 경로', '앱 내 결제(기본) / 결제 링크(할인 시) / 네이버 스토어(무이자 3개월만)'],
            ['36개월 무이자', <><strong key="c">삼성·현대·롯데</strong> 개인 신용카드만 (법인카드 불가)</>],
            ['기타 카드', '1~2년 할부 가능'],
            ['체크카드', '일시불만 가능'],
            ['카카오톡 결제', '고령·카드 없는 고객 → 알림톡 결제 링크 제공'],
            ['분리 결제', '가능 (예: 3대 일시불 + 2대 할부)'],
            ['법인', <><strong key="l">일시불만 가능</strong>. 개인사업자는 할부 가능</>],
            ['VAT', '항상 VAT 포함 금액으로 안내'],
            ['결제 링크 생성', <><Tag key="t" color="red">상담사 X</Tag> — 에러 시 책임 문제</>],
            ['할인 적용', '결제 링크로만 적용 (앱 내 불가)'],
          ]}
        />
      </SectionCard>
    </div>
  );
}

function SpecTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="📷 카메라 기능">
        <Table
          headers={['기능', '설명', '주의사항']}
          rows={[
            ['도어센서 (경비 모드)', '문열림 시 앱 푸시 알림', <span key="d" className="text-red-600 font-semibold">창문 깨고 침입 시 감지 불가</span>],
            ['움직임 감지', '녹화 검색 편의용', <strong key="m">경비 알림 아님. 알림은 도어센서만</strong>],
            ['음성 녹음', <strong key="v">불가 (법규 금지)</strong>, '홈캠은 가능'],
            ['모니터 출력', '녹화기(NVR)와 모니터 연결', 'PC 불필요'],
            ['저장 기간', '약 4주, 24시간 풀녹화', '시간 조정 불가'],
            ['인터넷', '원격 확인 시 필수', '내부 녹화만 = 모니터+HDMI'],
            ['영상 다운로드', '4주 내 자유 편집 + 다운 + 카톡 전송', ''],
            ['근태관리', <>1개월 무료, 이후 월 500원<br/>출퇴근 관리 + 근로계약서 + 스케줄 관리</>, '매장형 고객 초기안내'],
            ['직원 권한 분할', '원장/직원 권한 분리 설정', '병원·학원·다점포'],
            ['방수·외부 설치', '영하 40도, 실외형 있음, 30m 선 포함', '내구성 10~15년'],
            ['앱 업데이트', '상·하반기 1회', '제조사+앱 동일 = 호환 최적화'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🛡️ 보험 및 A/S">
        <Table
          headers={['항목', '내용', '주의사항']}
          rows={[
            [<><strong key="i">안심케어 보험</strong><br/>(1년 무료)</>, '1년 후 연장: 월 8,000원 구독 (원치 않으면 자동 종료)', <><Tag key="t" color="red">분실·도난 보상 없음</Tag></>],
            ['┗ 비품파손 수리', '300만원 (사업장당), 자부담 2만원/1사고', 'CCTV에 기록된 집기 비품파손'],
            ['┗ 개인정보유출', '500만원 (사업장당)', ''],
            ['┗ 영업배상책임', '대인/대물 1,000만원, 자부담 10만원/1사고', '구내치료비 100만원'],
            ['A/S 1~3년', <Tag key="a" color="green">무상 A/S</Tag>, '출장비: 확인 후 안내'],
            ['A/S 3~5년', '출동비 8만원', ''],
            ['A/S 5년~', '유상 A/S', ''],
            ['A/S 연락처', '1670-5772 또는 앱 내 1:1 문의', '상담사 직접 응대 안 함'],
            ['출동 서비스', <strong key="n">미제공</strong>, '도어센서 알림 → 앱 내 112/119 버튼'],
            ['모니터', <strong key="m">별도 — 고객 준비</strong>, <Tag key="mt" color="red">가격 안내 직후 필수 안내</Tag>],
          ]}
        />
      </SectionCard>

      <SectionCard title="📐 카메라 스펙">
        <Table
          headers={['항목', '실내 (KNO-L7012R)', '실외 (KNV-L7012R)']}
          rows={[
            ['화소', '400만 화소 (QHD)', '동일'],
            ['화각', '105도', '동일'],
            ['감지 거리', '44.3m', '동일'],
            ['인식 거리', '8.9m', '동일'],
            ['동작 온도', '-40°C ~ +55°C', '동일'],
            ['규격 인증', 'IP66', <>IP66 + <strong>IK10</strong> (충격 방호)</>],
            ['재질', 'Plastic (White)', 'Plastic + Aluminum'],
            ['사이즈/무게', '78×262mm / 390g', '120×92mm / 410g'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🔲 녹화기(NVR) 채널 기준">
        <Table
          headers={['카메라 대수', '채널', '경계 넘을 시']}
          rows={[
            ['1~4대', '4채널', '-'],
            ['4대→5대', '8채널로 교체', <Tag key="n1" color="yellow">추가 비용 — 설치팀 확인</Tag>],
            ['5~8대', '8채널', '-'],
            ['8대→9대', '16채널로 교체', <Tag key="n2" color="yellow">추가 비용</Tag>],
            ['9~16대', '16채널', '-'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🔧 추가비용 발생 요소">
        <Alert type="warning">기본 설치비 무료. 아래만 현장 개별 산출. <strong>상담사 임의 금액 안내 금지.</strong></Alert>
        <div className="mt-3">
          <Table
            headers={['요소', '설명', '비고']}
            rows={[
              ['복층/다층/고층', <>배선동선(층간포설) 확인 필수<br/>구축 상가: 피트공간 없음 → 창문샷시·에어컨 배관 활용<br/>복층 = 난공사 → 추가공사비</>, '사전 현장확인'],
              ['넓은 영업장', '녹화기~설치위치 거리, 층고, 실내/실외 수량, 구조물 종류 확인', '현장 개별 산출'],
              ['고소작업대', '층고 3m 초과 시', '리프트카 출장비 60만원~'],
              ['타공 제한', '임대 사무실, 관리사무소 승인 필요', '아파트 설치 불가 → B2B'],
              ['엘리베이터 내부', <>산업안전보건법 적용, 관리업체 대동<br/>인건비 30만원 + 추가 시공비</>, <Tag key="e" color="red">사전 경고 필수</Tag>],
              ['인테리어 중', <>철거·사전전기 → 목공 → 전기(실사) → 페인트·바닥 → <strong>CCTV(가장 마지막)</strong></>, '페인트 후 설치 권장'],
              ['설치 기간', '수도권 3~7일, 지방 2주', ''],
            ]}
          />
        </div>
        <div className="mt-3"><Alert type="info">케이블 길이로는 추가비용 산정하지 않음</Alert></div>
      </SectionCard>

      <Alert type="info">상세 경쟁사 비교는 <strong>경쟁사비교</strong> 탭 참조</Alert>
    </div>
  );
}

function VsTab() {
  return (
    <div className="space-y-4">
      {/* 고객 질문 대응 — 상단 배치 */}
      <SectionCard title="💬 고객이 경쟁사 언급하면?">
        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">캡스</Tag> &quot;ADT캡스 알아보고 있어요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;캡스도 3년 후 기기는 내 것이 되지만, <strong>망사용료가 매달 계속</strong> 나갑니다. 키퍼는 36개월 후 완전 0원이에요.&quot;</p>
          <p>• &quot;캡스 AI 기능은 대형·무인매장에 적합해요. 소규모 매장은 CCTV+도어센서면 충분하고, AI 때문에 렌탈료 계속 내는 건 부담입니다.&quot;</p>
          <p>• &quot;캡스 출동경비는 별도 가입이고, <strong>고객 요청 출동은 건당 2만5천원</strong> 청구돼요.&quot;</p>
          <p>• &quot;캡스 저장 약 20일, 키퍼 28일. 가격도 캡스는 전화해야 알려주는데, 키퍼는 홈페이지 공개.&quot;</p>
        </div>

        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">에스원</Tag> &quot;세콤 알아보고 있어요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;에스원도 3년 후 기기는 내 것이 되지만, <strong>망사용료 계속</strong>. 키퍼는 36개월 후 0원.&quot;</p>
          <p>• &quot;에스원 카메라 대부분 200만. 키퍼는 400만으로 두 배 선명. 저장도 18일 vs 28일.&quot;</p>
        </div>

        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">KT</Tag> &quot;KT 견적 받았는데요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;KT 200만 4대 월 4만원, 키퍼도 4만원. 근데 <strong>키퍼는 사는 거고 KT는 빌리는 거</strong>예요.&quot;</p>
          <p>• &quot;KT 500만은 월 5만5천원. 키퍼가 더 싸고 내 것이 됩니다. 저장도 KT 15일 vs 키퍼 28일.&quot;</p>
        </div>

        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">중국산</Tag> &quot;인터넷에서 싼 거 봤는데&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600">
          <p>• &quot;처음엔 싸지만 수리 1년, 해킹 위험(미·영 정부 금지), 저장 1~2주. 화소도 숫자만 높아요.&quot;</p>
        </div>
      </SectionCard>

      {/* 전체 비교 테이블 */}
      <SectionCard title="📊 전체 비교 (4대 / 3년 기준)">
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[11px] min-w-[700px]">
            <thead>
              <tr>
                <th className="text-left p-1.5 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[80px]">항목</th>
                <th className="text-left p-1.5 bg-green-50 font-bold text-green-800 border-b border-gray-200 min-w-[110px]">KEEPER</th>
                <th className="text-left p-1.5 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 min-w-[110px]">ADT캡스</th>
                <th className="text-left p-1.5 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 min-w-[100px]">에스원</th>
                <th className="text-left p-1.5 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 min-w-[100px]">KT텔레캅</th>
                <th className="text-left p-1.5 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 min-w-[90px]">중국산</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="bg-green-50/30">
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">소유 구조</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 구매형<br/>3년 후 0원</td>
                <td className="p-1.5 border-b border-gray-100">렌탈<br/>3년 후 기기소유<br/>+ 망사용료 계속</td>
                <td className="p-1.5 border-b border-gray-100">렌탈<br/>3년 후 기기소유<br/>+ 망사용료 계속</td>
                <td className="p-1.5 border-b border-gray-100">렌탈<br/>3년 후 기기소유<br/>+ 망사용료 계속</td>
                <td className="p-1.5 border-b border-gray-100">직접 구매</td>
              </tr>
              <tr>
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-white z-10">월 비용</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 44,000원</td>
                <td className="p-1.5 border-b border-gray-100">비공개<br/>(현장 견적)</td>
                <td className="p-1.5 border-b border-gray-100">비공개<br/>(5~7만 추정)</td>
                <td className="p-1.5 border-b border-gray-100">44,000원(200만)<br/>55,000원(500만)</td>
                <td className="p-1.5 border-b border-gray-100">저가<br/>A/S 별도</td>
              </tr>
              <tr className="bg-green-50/30">
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">5년 총비용</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 약 158만</td>
                <td className="p-1.5 border-b border-gray-100">300만+ 추정</td>
                <td className="p-1.5 border-b border-gray-100">300만+ 추정</td>
                <td className="p-1.5 border-b border-gray-100">264만~330만</td>
                <td className="p-1.5 border-b border-gray-100">초기비용<br/>+수리 별도</td>
              </tr>
              <tr>
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-white z-10">화소</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 400만 QHD</td>
                <td className="p-1.5 border-b border-gray-100">500만</td>
                <td className="p-1.5 border-b border-gray-100">200~500만</td>
                <td className="p-1.5 border-b border-gray-100">200만 / 500만</td>
                <td className="p-1.5 border-b border-gray-100 text-red-500">표기만 높음</td>
              </tr>
              <tr className="bg-green-50/30">
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">저장기간</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 약 28일</td>
                <td className="p-1.5 border-b border-gray-100">약 20일</td>
                <td className="p-1.5 border-b border-gray-100">약 18일</td>
                <td className="p-1.5 border-b border-gray-100">14일 / 15일</td>
                <td className="p-1.5 border-b border-gray-100 text-red-500">1~2주</td>
              </tr>
              <tr>
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-white z-10">AI 감지</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
                <td className="p-1.5 border-b border-gray-100 font-semibold text-blue-600">✅ KISA 인증<br/>침입·배회·쓰러짐<br/>방화·동일인·소리</td>
                <td className="p-1.5 border-b border-gray-100">일부 모델</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
              </tr>
              <tr className="bg-green-50/30">
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">출동경비</td>
                <td className="p-1.5 border-b border-gray-100">없음<br/>(앱 알림+112)</td>
                <td className="p-1.5 border-b border-gray-100">별도 가입<br/><span className="text-red-500">고객요청 건당 2.5만</span></td>
                <td className="p-1.5 border-b border-gray-100">별도 가입<br/>(월 ~5.5만)</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
              </tr>
              <tr>
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-white z-10">보상</td>
                <td className="p-1.5 border-b border-gray-100">안심케어 1년 무료<br/>(비품300만+배상1천만)</td>
                <td className="p-1.5 border-b border-gray-100">도난1천만+파손5백만<br/>+화재1억<br/><span className="text-gray-400">(렌탈 중만)</span></td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">미공개</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
                <td className="p-1.5 border-b border-gray-100 text-gray-400">없음</td>
              </tr>
              <tr className="bg-green-50/30">
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">A/S</td>
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 3년 무료</td>
                <td className="p-1.5 border-b border-gray-100">렌탈 기간 내</td>
                <td className="p-1.5 border-b border-gray-100">계약기간 내</td>
                <td className="p-1.5 border-b border-gray-100">계약기간 내</td>
                <td className="p-1.5 border-b border-gray-100 text-red-500">보통 1년</td>
              </tr>
              <tr>
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-white z-10">보안</td>
                <td className="p-1.5 border-b border-gray-100">한화비전 자체</td>
                <td className="p-1.5 border-b border-gray-100">SK쉴더스</td>
                <td className="p-1.5 border-b border-gray-100">국내 보안업체</td>
                <td className="p-1.5 border-b border-gray-100">KT그룹</td>
                <td className="p-1.5 border-b border-gray-100 text-red-500 font-semibold">❌ 해킹 위험<br/>(미·영 정부 금지)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Alert type="success">키퍼 = 3년 내면 끝(0원). 경쟁사 = 기기는 내 것 되지만 <strong>망사용료 계속</strong>.</Alert>
        </div>
      </SectionCard>

      {/* 키퍼가 지는 항목 */}
      <SectionCard title="⚠️ 키퍼 약점 + 대응">
        <Table
          headers={['항목', '경쟁사 강점', '대응 멘트']}
          rows={[
            [<Tag key="v1" color="red">출동</Tag>, 'ADT캡스·에스원 출동 가능', '도어센서 알림+112 바로 연결. 출동은 월5만+, 캡스 고객요청 건당 2.5만원'],
            [<Tag key="v2" color="red">AI 감지</Tag>, 'ADT캡스 KISA 인증 AI', '대형·무인매장용. 소규모는 CCTV+도어센서 충분, AI 때문에 렌탈료 계속 내는 건 비효율'],
            [<Tag key="v3" color="red">보상</Tag>, 'ADT캡스 도난1천만+화재1억', '렌탈 계약 중에만 적용. 키퍼는 1년 무료보험+소유 CCTV로 증거 확보'],
            [<Tag key="v4" color="yellow">1대 판매</Tag>, '캡스·KT 1대 가능', '사각지대 커버 위해 최소 2대 추천'],
          ]}
        />
      </SectionCard>

      {/* KT 가격표 */}
      <SectionCard title="📋 KT텔레캅 가격표 (브로셔 원본, VAT 별도)">
        <Table
          headers={['대수', 'KT 200만 3년', 'KT 500만 3년', 'KEEPER 3년']}
          rows={[
            ['1대', '25,000원', '35,000원', <span key="k1" className="text-gray-400">- (2대부터)</span>],
            ['2대', '30,000원', '40,000원', <strong key="k2" className="text-green-700">✅ 20,000원</strong>],
            ['3대', '35,000원', '45,000원', <strong key="k3" className="text-green-700">✅ 30,000원</strong>],
            ['4대', '40,000원', '50,000원', <strong key="k4" className="text-green-700">✅ 40,000원</strong>],
          ]}
        />
        <p className="text-[11px] text-gray-400 mt-2">저장: KT 200만 4대 14일 / 500만 4대 15일 / 키퍼 4대 약 28일 | KT 모니터 옵션 월 15,000원 추가</p>
      </SectionCard>

      {/* ADT캡스 AI 기능 상세 */}
      <SectionCard title="🤖 ADT캡스 AI 기능 (KISA 인증, 정확도 90%+)">
        <Table
          headers={['기능', '설명']}
          rows={[
            ['침입·배회·쓰러짐·방화', '금지구역 설정 → 실시간 감지·알림'],
            ['동일인 추적', '혼잡 구역 동일 인물 입·퇴장 식별 (2025.03 추가)'],
            ['소리 감지', '유리 파손, 비명 등 비정상 소리 감지'],
            ['매장 분석', '방문자 수·성별·연령·동선 리포트'],
            ['AI 검색', '사람/차량/침입/방문 조건별 영상 검색'],
          ]}
        />
        <p className="text-[11px] text-gray-400 mt-2">AI가 카메라 자체 탑재 → 별도 서버 불필요 | 뷰가드 V4.0 앱 | 500만 화소 | NVR 4/8/16ch H.265</p>
      </SectionCard>
    </div>
  );
}

function CsTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="🎁 프로모션 안내 기준">
        <Table
          headers={['프로모션', '조건', '비고']}
          rows={[
            ['한달 무료 체험', '신규 고객 대상', <Tag key="p" color="green">가장 강력한 클로징 도구</Tag>],
            ['개수 할인', <>현행: 9대↑5%, 16대↑10%<br/>5월: 8대↑5%, 12대↑10%</>, '할부·일시불 모두 적용'],
            ['일시불 할인', '일시불 결제 시 추가 할인', '일시불에서만 적용'],
            ['복수 매장 번들', '인접 매장 동시 설치', '일시불 무상제공 할인'],
          ]}
        />
      </SectionCard>

      <SectionCard title="📅 설치 일정 + 어드민 메모">
        <Table
          headers={['항목', '내용']}
          rows={[
            ['기본 설치일', '결제일 기준 7일 후부터 선택 가능'],
            ['빠른 설치', "어드민 메모에 '설치 희망일' 기재"],
            ['설치 취소', <><Tag key="c" color="red">상담사 권한 없음</Tag> — 앱 내 직접 취소 안내</>],
          ]}
        />
      </SectionCard>

      <SectionCard title="🔎 현장 실사">
        <Table
          headers={['기준', '내용']}
          rows={[
            ['8대 이상', '실사 진행 (서울/수도권)'],
            ['4대 이하', '실사 미진행 — 사진/도면 기반'],
            ['프로세스', '1차: 실사 티켓 발행 → 2차: 혜성님과 소통'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🌡️ 온도감 판별 기준">
        <Table
          headers={['온도감', '고객 신호']}
          rows={[
            [<Tag key="h" color="red">상 🔥</Tag>, '설치 일정/결제 방법 직접 물음, 빨리 해달라'],
            [<Tag key="m" color="yellow">중 🤔</Tag>, '견적 비교 중, 경쟁사 언급'],
            [<Tag key="l" color="blue">하 ❄️</Tag>, '나중에 반복, 정보만 확인'],
          ]}
        />
      </SectionCard>

      <SectionCard title="📢 선제 안내 필수 항목">
        <Table
          headers={['항목', '필수 멘트', '시점']}
          rows={[
            ['건물 유형 확인', <>&quot;아파트·오피스텔·엘리베이터 있나요?&quot;<br/>아파트=불가 B2B이관</>, '초기 상담'],
            ['모니터 별도', '"모니터는 별도로 고객님이 준비"', '가격 안내 직후'],
            ['스펙 4종', '"400만 QHD · 4주 저장 · 105도 광각 · 야간보정"', '제품 소개 시'],
            ['소유권', '"렌탈이 아닌 구매. 구매 즉시 고객님 소유"', '가격 안내 시'],
            ['경비출동 구분', '"키퍼는 녹화·감지 전용, 경비출동 없음"', '보안 질문 시'],
            ['음성녹음 불가', '"영상만 녹화, 음성은 법규상 불가"', '기능 질문 시'],
            ['근태관리', '"1개월 무료, 이후 월 500원. 출퇴근·근로계약서·스케줄 관리"', '매장형 고객'],
          ]}
        />
      </SectionCard>

      <SectionCard title="❓ 자주 묻는 질문 (FAQ)">
        <h3 className="text-[14px] font-semibold mb-2">가격 및 서비스</h3>
        <FaqItem q="정말로 약정이나 위약금이 전혀 없나요?" a="네, 키퍼는 기존 렌탈 방식의 CCTV와 달리 사장님이 제품을 직접 구매하여 소유하는 방식입니다. 따라서 별도의 의무 사용 약정 기간이 없으며, 서비스를 중단하시더라도 위약금이 전혀 발생하지 않습니다." />
        <FaqItem q="렌탈보다 구매가 더 경제적인 이유가 무엇인가요?" a="출동보안 업체의 렌탈 서비스는 중간 유통 마진과 영업사원 수수료가 포함되어 매달 높은 고정비가 지출됩니다. 키퍼는 한화비전이 직접 제조하고 다이렉트로 판매하여 중간 마진을 제거했기 때문에, 3년만 사용해도 렌탈 대비 최대 40% 이상의 비용을 절감할 수 있습니다." />
        <FaqItem q="설치는 제가 직접 해야 하나요?" a="아니요, 키퍼를 구매하시면 CCTV 전문 설치 기사가 직접 방문하여 매장환경에 최적화된 위치에 안전하고 정밀하게 설치해 드립니다. 최초 설치비는 무료이므로 안심하고 주문하세요." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">기능 및 보안</h3>
        <FaqItem q="출동 서비스가 없으면 보안이 취약하지 않을까요?" a="경비 모드 설정 시, 매장 마감 후 문 열림이 감지되면 사장님 휴대폰으로 즉시 실시간 알림이 전송됩니다. 사장님이 앱으로 상황을 확인한 후 필요 시 즉시 경찰에 신고할 수 있으며, 키퍼가 제공하는 사장님 안심보험(1년 무료)을 통해 사고 발생 시 실질적인 보상을 받으실 수 있어 더욱 든든합니다." />
        <FaqItem q="영상은 얼마나 오래 저장되나요?" a="키퍼는 최소 4TB 이상의 고용량 전용 저장장치를 기본으로 탑재하고 있습니다. 따라서 일반적인 CCTV보다 훨씬 긴 최소 4주 이상의 영상을 안전하게 저장할 수 있어, 뒤늦게 발견된 이슈도 확실하게 확인 가능합니다." />
        <FaqItem q="야간이나 역광 환경에서도 잘 보이나요?" a="네, 한화비전만의 차별화된 역광 보정 기술(WDR)과 400만 화소 QHD 해상도를 적용했습니다. 어두운 곳은 밝게, 역광이 심한 창가 쪽도 선명하게 보정하여 24시간 언제든 깨끗한 화질을 제공합니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">직원 관리 서비스</h3>
        <FaqItem q="처음 사용하는데, 직원관리 서비스 설정은 어떻게 하면 되나요?" a={<>키퍼 전담 상담사에게 연락해 주세요. 사장님의 매장 상황에 맞춰 근로계약서 작성과 근태 설정을 1:1 전화 상담으로 안내해드립니다. 무료로 제공되며, 처음 사용하셔도 쉽게 설정하실 수 있습니다.<br/>연락처: 고객만족센터 1670-5772 &gt; 2번 직원관리</>} />
        <FaqItem q="직원이 매장 밖에서 출근 체크를 할 수도 있지 않나요?" a={<>매장 밖에서는 출근 처리가 되지 않습니다. 출근 체크는 사장님이 등록한 매장 위치를 기준으로, 설정된 범위 내에서만 정상적으로 인정됩니다.<br/>출퇴근 GPS 허용 범위 설정: 직원관리 더보기 &gt; 출퇴근 GPS</>} />
        <FaqItem q="직원은 몇 명까지 등록할 수 있나요?" a="인원 제한 없이 등록 가능합니다. 다만, 모바일 환경상 원활한 관리를 위해 5~10명 규모 사용을 권장드립니다." />
        <FaqItem q="급여는 어떻게 계산되나요?" a={<>근무 기록 또는 계약 정보를 기준으로 예상 급여가 자동 계산됩니다.<br/>• 시급제: 직원의 근무 기록을 기준으로 월 급여가 자동 계산됩니다.<br/>• 월급제: 계약에 등록된 월 급여 기준으로 자동 계산됩니다.<br/>안내되는 급여는 예상 값으로, 실제 지급 금액과는 차이가 있을 수 있습니다.</>} />
        <FaqItem q="퇴직금 정산도 가능한가요?" a="현재는 지원하지 않습니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">보안 및 사후 관리</h3>
        <FaqItem q="무상 A/S 기간은 어떻게 되나요?" a="제조사인 한화비전이 직접 품질을 보증하며, 총 3년간의 넉넉한 무상 A/S를 제공합니다. 접수 후 24시간 이내 방문하는 신속한 서비스로 매장 운영에 차질이 없도록 관리해 드립니다." />
        <FaqItem q="무료 보험 혜택은 1년 뒤에 어떻게 되나요?" a="구매 후 첫 1년은 한화비전이 보험료를 전액 부담합니다. 1년이 지난 후에도 보장을 계속 유지하고 싶으신 경우, 월 8,000원 수준의 합리적인 구독료(4월 오픈)로 간편하게 서비스를 연장하실 수 있습니다. 원치 않으실 경우 자동 종료됩니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">구매</h3>
        <FaqItem q="매장 상황에 맞춰 실내외 카메라를 섞어서 구매할 수 있나요?" a="물론입니다. 실내용(돔형)과 실외용(불렛형) 카메라를 자유롭게 구성하여 구매하실 수 있습니다." />
        <FaqItem q="우리 매장에 카메라가 몇 대나 필요한지 어떻게 알 수 있나요?" a={<>일반적인 매장 규모에 따른 권장 가이드:<br/>• 소형 매장 (10~15평): 평균 4대 권장<br/>• 중대형 매장 (20~40평 이상): 평균 8~10대 권장<br/>정확한 위치는 전문 설치 기사님이 방문 시 상담을 통해 최종 확정해 드립니다.</>} />
        <FaqItem q="나중에 카메라를 더 추가하고 싶으면 어떻게 하나요?" a="키퍼 앱이나 스마트스토어에서 카메라만 추가로 주문하시면 됩니다. 전문 설치 기사가 방문하여 기존 시스템과 연동 설치해 드리며, 기존 앱에서 한 번에 관리 가능합니다." />
        <FaqItem q="평수가 크지 않은데 2대만 구매해도 될까요?" a="네, 최소 2대 이상이면 구매가 가능합니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">설치 및 일정</h3>
        <FaqItem q="주문하면 설치까지 얼마나 걸리나요?" a="주문 확인 후 24시간 이내에 해피콜을 드리며, 통상 해피콜 후 3~5일 내 설치 완료됩니다." />
        <FaqItem q="인테리어 공사 중에 설치하는 게 좋을까요?" a="CCTV는 인테리어 공사의 가장 마지막 단계에 설치하는 것을 권장합니다. 공사 순서는 철거·사전전기 → 목공 → 전기(실사 가능) → 페인트·바닥 마무리 → CCTV입니다. 넓은 면적은 스프레이건으로 페인트 작업을 하기 때문에 CCTV를 가리기 어렵고, 페인트 전에 설치하면 나중에 CCTV 철거 시 미도장 부분이 생길 수 있습니다." />
        <FaqItem q="제품 탈부착이 자유롭게 가능한가요?" a="고정형으로 설치됩니다. 이전 설치가 필요하신 경우 키퍼 서비스팀(1670-5773)으로 연락해 주세요." />
        <FaqItem q="구입 후 설치일을 한 달 뒤로 잡을 수 있나요?" a="네, 해피콜 시 설치 희망일을 말씀해 주시면 조율해 드립니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">앱 사용 및 공유</h3>
        <FaqItem q="가족이나 매니저도 같이 영상을 볼 수 있나요?" a="네, 계정 공유로 최대 10대 동시 로그인 가능합니다. 사용자별 세부 권한 관리는 추후 업데이트 예정입니다." />
        <FaqItem q="매장이 여러 개인데, 앱 하나로 다 관리할 수 있나요?" a="네, 다중 매장 관리를 지원합니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">기술 환경</h3>
        <FaqItem q="매장에 인터넷이 반드시 설치되어 있어야 하나요?" a="네, 원격 확인·GPS 출퇴근·알림 서비스를 위해 인터넷 연결이 필수입니다." />
        <FaqItem q="매장 내 모니터나 TV에 연결해서 볼 수 있나요?" a="네, NVR의 HDMI 포트로 모니터/TV 연결하면 24시간 실시간 모니터링 가능합니다." />

        <h3 className="text-[14px] font-semibold mt-4 mb-2">결제 및 증빙</h3>
        <FaqItem q="법인카드 결제나 무통장 입금도 가능한가요?" a="법인카드 결제는 앱/네이버 스마트스토어 모두 가능합니다. 무통장 입금은 네이버 스마트스토어에서만 가능합니다." />
        <FaqItem q="할부 구매도 가능한가요?" a={<>네, 각 카드사별 무이자 할부 혜택을 이용하시면 초기 목돈 부담 없이 설치하실 수 있습니다. 할부가 끝나면 장비는 완전히 사장님의 자산이 됩니다.<br/><strong>단, 법인카드의 경우 카드사 정책상 할부 구매가 제한됩니다.</strong></>} />
      </SectionCard>

      <SectionCard title="🚑 클레임 대응 가이드">
        <Table
          headers={['단계', '대응 방법', '멘트 예시']}
          rows={[
            [<Tag key="c1" color="red">1. 감정 수용</Tag>, '고객 감정에 공감', '"충분히 이해합니다"'],
            [<Tag key="c2" color="yellow">2. 원인 인정</Tag>, '책임 전가 없이 인정', '"전달 오류였던 것 같습니다"'],
            [<Tag key="c3" color="green">3. 해결 약속</Tag>, '내부 보고 후 빠른 대응', '"내부 검토 후 방향 말씀드리겠습니다"'],
          ]}
        />
      </SectionCard>
    </div>
  );
}

function AtTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="📝 메모 작성 규칙">
        <Alert type="info">형식: <strong>[한 일] / [알게 된 것] / [다음 할 일]</strong></Alert>
        <p className="text-[13px] text-gray-500 mt-2">자동 누적: 메모 입력 → [콜]메모 관리에 날짜+담당자+내용 자동 기록</p>
        <div className="mt-3">
          <Table
            headers={['규칙', '상세']}
            rows={[
              ['기본', '한 일·알게 된 것·다음 할 일 자유 기록 (1~2줄 간결)'],
              ['부재중 시', <strong key="a">미수신 유형 + 생성자 표기 필수</strong>],
              ['미수신 유형', '안받음 / 바쁘다고함 / 다시전화준다고함 / 통화중 / 거절 / 전원꺼짐'],
              ['담당자', '[콜]담당자 필드 반드시 선택 (메모에 이름 별도 기입 불필요)'],
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="📊 딜스테이지">
        <Table
          headers={['딜스테이지', '설명', '진입 조건']}
          rows={[
            [<Tag key="s1" color="blue">상담예정</Tag>, '첫 통화 전 리드', '리드 유입 시'],
            [<Tag key="s2" color="blue">전화상담예약</Tag>, '고객과 통화 일시 확정', '콜백 약속 잡힌 경우'],
            [<Tag key="s3" color="blue">전화상담랜덤</Tag>, '예약 없이 콜 시도 대상', '예약 없는 리드'],
            [<Tag key="s4" color="yellow">상담완료</Tag>, '첫 통화 완료, 앱 설치/회원가입 유도 중', '첫 상담 완료 시'],
            [<Tag key="s5" color="green">회원가입</Tag>, '앱 회원가입 완료, 결제 유도 중', '키퍼앱 회원가입 확인'],
            [<Tag key="s6" color="green">결제완료(영원)</Tag>, '구매 완료', '키퍼 어드민에서 확인'],
            [<Tag key="s7" color="red">실패</Tag>, '전환 실패', '실패 사유와 함께 처리'],
          ]}
        />
        <h3 className="text-[14px] font-semibold mt-4 mb-2">⏰ 장기 체류 경고</h3>
        <Table
          headers={['딜스테이지', '경고', '즉시 조치']}
          rows={[
            ['상담예정', <Tag key="w1" color="yellow">2일</Tag>, <Tag key="a1" color="red">3일</Tag>],
            ['상담완료', <Tag key="w2" color="yellow">5일</Tag>, <Tag key="a2" color="red">7일</Tag>],
            ['회원가입', <Tag key="w3" color="yellow">3일</Tag>, <Tag key="a3" color="red">5일</Tag>],
          ]}
        />
      </SectionCard>

      <SectionCard title="❌ 실패 사유">
        <Table
          headers={['사유', '설명']}
          rows={[
            ['연락 불가', '24시간 3회 + 다음 날 2회 + 마지막 시도 전부 불발 + 문자 무응답'],
            ['번호 오류', '잘못된 연락처 / 없는 번호'],
            ['신청한 적 없음', '본인이 문의한 적 없다고 함'],
            ['타업체 선택', '다른 CCTV 업체로 설치 결정'],
            ['비용 부담', '가격이 비싸다고 판단'],
            ['현장 추가비용 부담', '배선·타공·고소작업대 등'],
            ['설치 일정 미스매치', '고객 희망일 불가, 응대 지연'],
            ['렌탈 선호', '구매가 아닌 렌탈 원함'],
            ['기능 불일치', '출동서비스, 음성녹음 등 미지원'],
            ['설치 환경 부적합', '인터넷 미설치, 설치 불가'],
            ['보류 / 추후 검토', '나중에 연락하겠다'],
            ['단순 견적 확인', '도입 의사 없이 가격만'],
            ['기타', '메모에 상세 사유 기재'],
          ]}
        />
      </SectionCard>

      <SectionCard title="✅ 상담 후 필수 체크리스트">
        <ul className="space-y-2 text-[14px]">
          {[
            '메모 작성 ([한 일] / [알게 된 것] / [다음 할 일])',
            '[콜]담당자 필드 선택',
            '팔로업 예정 날짜 기입 (재연락마다 최신화)',
            '온도감(상/중/하) 기록',
            '통화 녹음 업로드 (3분 이상 전부)',
            "구매완료 시 '결제완료(영원)' 변경",
            '실패 시 실패 사유 반드시 선택',
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-base">☐</span> {item}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="🔁 중복 리드 처리">
        <Alert type="info">판별 기준: <strong>전화번호 뒷 8자리</strong> 일치 시 동일 고객</Alert>
        <div className="mt-3">
          <Table
            headers={['유형', '정의', '처리']}
            rows={[
              ['동일 기간 내 중복', '전번 뒷 8자리 동일', <strong key="d1">마지막 유입 건 살리고 나머지 실패</strong>],
              ['과거 실패 건 재유입', '실패 처리된 리드 다시 유입', <strong key="d2">부활 처리 (실패 건에 정보 많음)</strong>],
            ]}
          />
        </div>
      </SectionCard>
    </div>
  );
}

function CallTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="📨 문자 팔로업 프로세스">
        <Table
          headers={['단계', '시점', '내용']}
          rows={[
            [<Tag key="f0" color="blue">선제 문자</Tag>, '리드 유입 즉시', '담당자 통화 예정 + 키퍼앱 링크 + 채널톡 링크'],
            [<Tag key="f1" color="green">1차 팔로업</Tag>, '통화 직후 (Day 0)', '상담 요약 + 가격/혜택 핵심 강조 + 앱 링크'],
            [<Tag key="f2" color="yellow">2차 팔로업</Tag>, 'Day +2~3', '손실 회피 (중국산 A/S 비교)'],
            [<Tag key="f3" color="red">3차 팔로업</Tag>, 'Day +5~7', '마감 압박 (설치 일정 포화 강조)'],
            ['아웃바운드 이관', '3차 무응답 + 수도권', '아웃바운드팀 방문 이관'],
            ['실패 처리', '아웃바운드 후 미전환', '실패 처리'],
            ['재전환', '실패 후 고객 연락 시', '진행중 복귀 (1주 내 미구매 시 재실패)'],
          ]}
        />
      </SectionCard>

      <SectionCard title="📞 리드 우선순위 및 콜 시간">
        <Table
          headers={['순위', '내용']}
          rows={[
            [<Tag key="p1" color="red">1순위</Tag>, '신규 리드 전화 상담'],
            [<Tag key="p2" color="yellow">2순위</Tag>, '상담완료 리드에 문자 팔로업'],
          ]}
        />
        <h3 className="text-[14px] font-semibold mt-4 mb-2">채널별 목표 응대 시간</h3>
        <Table
          headers={['채널', '목표']}
          rows={[
            ['채널톡', <strong key="t1">5분 이내</strong>],
            ['홈페이지 폼', <strong key="t2">30분 이내 첫 콜</strong>],
            ['토스/캐시노트/당근', <strong key="t3">1시간 이내 첫 문자</strong>],
          ]}
        />
      </SectionCard>

      <SectionCard title="📵 부재중 처리 프로세스">
        <Alert type="danger">전화만 하고 <strong>문자 안 남기면 시도로 인정 안 됨</strong> | 최대한 빨리 털어내기</Alert>
        <div className="mt-3">
          <Table
            headers={['단계', '시점', '행동 / 문자']}
            rows={[
              [<strong key="b1">1단계: 당일 3회</strong>, '리드 유입 후 24시간 내', <>3회 전화 + <strong>매회 문자 필수</strong></>],
              [<strong key="b2">2단계: 다음 날 2회</strong>, '1단계 불발 다음 날', <>오전 1회 + 오후 1회 + <strong>매회 문자</strong></>],
              [<strong key="b3">3단계: 마지막</strong>, '2단계 불발 후 2~3일 뒤', <>마지막 1회 + 문자 남기고 <strong>실패 처리</strong></>],
            ]}
          />
        </div>
        <h3 className="text-[14px] font-semibold mt-4 mb-2">부재중 용어 구분</h3>
        <Table
          headers={['구분', '정의', '메모 표기']}
          rows={[
            ['최초 상담 부재중', '리드 유입 후 첫 통화 시도에서 연결 실패', '최초 부재중'],
            ['상담 진행 중 부재중', '첫 상담 완료 후 재연결 시도에서 연결 실패', '진행중 부재중'],
            ['부재중 재연결', '부재중 뒤 다시 전화 거는 행위', '동일 차수 시도'],
            ['후속 콜 (팔로업)', '최초 상담 완료 후 구매 검토 확인 2차 콜', '팔로업'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🌙 야간 리드 (21~23시) 대응">
        <Alert type="warning">21~23시 유입이 전체 <strong>20%</strong>. 12시간 후 대응 시 전환율 0</Alert>
        <div className="mt-3">
          <Table
            headers={['항목', '룰']}
            rows={[
              ['원칙', <strong key="n1">전화보다 채팅 우선. 5~10분 내 즉시 OR 다음날 동시간대</strong>],
              ['첫 멘트', '"지금 상담 괜찮으신지, 아니면 내일 오전에 드릴지"'],
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="💬 가격 저항 대응 화법">
        <Table
          headers={['상황', '대응 화법', '핵심']}
          rows={[
            ['"할인 안 되나요?"', '"개수 할인은 할부에도 됩니다. 9대↑5%, 16대↑10%"', '개수 vs 일시불 구분'],
            ['가격 부담', '"화각 105도라 대수 줄여도 커버 가능"', '대수 최적화'],
            ['예산 초과', '"정가 판매라 가격 조정 불가" + 협력 업체 안내', '품질 포지션 유지'],
            ['경쟁사 비교', '"렌탈사는 계속 돈. 키퍼는 36개월만 내면 소유"', '소유권 + 권리금'],
            ['"500만 화소가 더 좋지?"', '"마케팅 용어. 화소 높으면 저장 1~2주만"', '저장기간이 판단 기준'],
          ]}
        />
      </SectionCard>

      <SectionCard title="👴 IT 취약 고객 대응">
        <Table
          headers={['상황', '대응']}
          rows={[
            ['고령 고객 앱 결제 어려움', '카카오톡 알림톡 결제 링크 제공'],
            ['대리 결제 요청', '개인정보 원칙 설명 + 계정 공유 방법'],
            ['접근성 확보', '"주말에도 연락 주셔도 괜찮습니다"'],
            ['체크카드만', '체크카드 일시불만 가능'],
          ]}
        />
      </SectionCard>

      <SectionCard title="📋 견적 안내 문자 템플릿">
        <h3 className="text-[14px] font-semibold mb-2">할부용</h3>
        <TemplateBox>{`[한화 키퍼 CCTV 견적 안내]
사장님, 신청하신 CCTV {N}대 도입 견적입니다.
구매 즉시 사장님 소유가 되어 평생 무료로 사용 가능합니다!

월 이용료: {월 할부금}원 (VAT 포함)
* 36개월 무이자 할부 기준
* 설치비 & 저장공간 0원 (무료 제공)

한화 키퍼만의 특별 혜택
1. 평생 소유: 할부 종료 후 추가 비용 없이 사장님 자산
2. 한 달 이상 보관: 대용량 저장장치로 4주간 영상 보관
3. 압도적 화질: 400만 화소(QHD) 선명한 영상
4. 확실한 AS: 한화 직접 보증, 3년 무상 AS
5. 무료 보험: 1년간 안심케어 서비스 (최대 1,000만 원 보상)

키퍼앱 다운로드: https://keeper.airbridge.io`}</TemplateBox>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">일시불용</h3>
        <TemplateBox>{`[한화 키퍼 CCTV 견적 안내]
사장님, 신청하신 CCTV {N}대 도입 견적입니다.
구매 즉시 사장님 소유가 되어 평생 무료로 사용 가능합니다!

총금액: {총액}원 (VAT 포함)
* 카메라 1대 기준 369,000원
* 설치비 & 저장공간 0원 (무료 제공)

한화 키퍼만의 특별 혜택
1. 평생 소유: 할부 종료 후 추가 비용 없이 사장님 자산
2. 한 달 이상 보관: 대용량 저장장치로 4주간 영상 보관
3. 압도적 화질: 400만 화소(QHD) 선명한 영상
4. 확실한 AS: 한화 직접 보증, 3년 무상 AS
5. 무료 보험: 1년간 안심케어 서비스 (최대 1,000만 원 보상)

출동 서비스 없어도 안심!
마감 후 문열림 감지 시 즉시 앱 알림 전송 및
앱에서 바로 경찰 출동 요청이 가능합니다.

▶ 키퍼앱 다운로드: https://keeper.airbridge.io`}</TemplateBox>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">일반 견적 (부재중용)</h3>
        <TemplateBox>{`[한화 키퍼 CCTV 견적 안내]
사장님, 부재중으로 키퍼 CCTV 간단 견적 안내드립니다.
구매 즉시 사장님 소유가 되어 평생 무료로 사용 가능합니다!

월 이용료: 카메라 1대당 11,000원 (VAT 포함)
* 36개월 무이자 할부 기준
* 설치비 & 저장공간 0원 (무료 제공)

한화 키퍼만의 특별 혜택
1. 평생 소유: 할부 종료 후 추가 비용 없이 사장님 자산
2. 한 달 이상 보관: 대용량 저장장치로 4주간 영상 보관
3. 압도적 화질: 400만 화소(QHD) 선명한 영상
4. 확실한 AS: 한화 직접 보증, 3년 무상 AS
5. 무료 보험: 1년간 안심케어 서비스 (최대 1,000만 원 보상)

출동 서비스 없어도 안심!
마감 후 문열림 감지 시 즉시 앱 알림 전송 및
앱에서 바로 경찰 출동 요청이 가능합니다.

연락주세요.

▶ 키퍼앱 다운로드: https://keeper.airbridge.io`}</TemplateBox>
      </SectionCard>
    </div>
  );
}

/* ── 텍스트 하이라이트 ── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(q, last);
  while (idx !== -1) {
    if (idx > last) parts.push(text.substring(last, idx));
    parts.push(
      <mark key={idx} className="bg-yellow-200 text-gray-900 font-semibold px-0.5 rounded">
        {text.substring(idx, idx + q.length)}
      </mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(q, last);
  }
  if (last < text.length) parts.push(text.substring(last));
  return <>{parts}</>;
}

function highlightNode(node: React.ReactNode, query: string): React.ReactNode {
  if (!query) return node;
  if (typeof node === 'string') return <Highlight text={node} query={query} />;
  if (typeof node === 'number') return <Highlight text={String(node)} query={query} />;
  if (Array.isArray(node)) return node.map((child, i) => <span key={i}>{highlightNode(child, query)}</span>);
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.props.children != null) {
      return React.cloneElement(el, {}, highlightNode(el.props.children, query));
    }
  }
  return node;
}

function nodeContainsText(node: React.ReactNode, query: string): boolean {
  if (!node) return false;
  if (typeof node === 'string') return node.toLowerCase().includes(query);
  if (typeof node === 'number') return String(node).toLowerCase().includes(query);
  if (Array.isArray(node)) return node.some((c) => nodeContainsText(c, query));
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return nodeContainsText(el.props.children, query);
  }
  return false;
}

/* ── DOM 기반 하이라이트 ── */
function highlightDOM(root: HTMLElement, query: string) {
  if (!query) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const q = query.toLowerCase();
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    const lower = text.toLowerCase();
    if (!lower.includes(q)) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    let idx = lower.indexOf(q, last);
    while (idx !== -1) {
      if (idx > last) frag.appendChild(document.createTextNode(text.substring(last, idx)));
      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-200 text-gray-900 font-semibold px-0.5 rounded';
      mark.textContent = text.substring(idx, idx + q.length);
      frag.appendChild(mark);
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.substring(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function clearHighlights(root: HTMLElement) {
  const marks = root.querySelectorAll('mark');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });
  // 숨겨진 섹션 복원
  root.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
    el.style.display = '';
  });
}

function hideSectionsWithoutMatch(root: HTMLElement, query: string) {
  const q = query.toLowerCase();
  root.querySelectorAll<HTMLElement>('[data-section]').forEach((section) => {
    if (section.textContent?.toLowerCase().includes(q)) {
      section.style.display = '';
    } else {
      section.style.display = 'none';
    }
  });
}

/* ── 메인 컴포넌트 ── */
export default function GuideContent() {
  const [activeTab, setActiveTab] = useState<TabId>('ops');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mounted, setMounted] = useState(false);
  const [matchingTabs, setMatchingTabs] = useState<TabId[] | null>(null);

  const tabComponents: Record<TabId, React.ReactNode> = useMemo(() => ({
    ops: <OpsTab />,
    price: <PriceTab />,
    spec: <SpecTab />,
    vs: <VsTab />,
    cs: <CsTab />,
    at: <AtTab />,
    call: <CallTab />,
  }), []);

  const currentQuickGuide = QUICK_GUIDES[activeTab] ?? null;

  // 모든 탭 마운트 완료 감지
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const isSearching = debouncedSearch.length > 0;

  // DOM 기반 검색 + 하이라이트 (모든 탭 DOM에서)
  useEffect(() => {
    if (!mounted) return;

    // 먼저 모든 탭의 기존 하이라이트 제거
    for (const def of TAB_DEFS) {
      const el = tabRefs.current[def.id];
      if (el) clearHighlights(el);
    }

    if (!isSearching) {
      setMatchingTabs(null);
      return;
    }

    // 모든 탭 DOM에서 textContent 검색
    const matches: TabId[] = [];
    for (const def of TAB_DEFS) {
      const el = tabRefs.current[def.id];
      if (el && el.textContent?.toLowerCase().includes(debouncedSearch)) {
        matches.push(def.id);
      }
    }
    setMatchingTabs(matches);

    // 매칭된 탭에 하이라이트 + 비매칭 섹션 숨김
    requestAnimationFrame(() => {
      for (const tabId of matches) {
        const el = tabRefs.current[tabId];
        if (el) {
          highlightDOM(el, debouncedSearch);
          hideSectionsWithoutMatch(el, debouncedSearch);
        }
      }
      // 첫 하이라이트로 스크롤
      setTimeout(() => {
        const firstMark = contentRef.current?.querySelector('mark');
        if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });
  }, [mounted, isSearching, debouncedSearch]);

  const totalMatches = matchingTabs?.length ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">키퍼 CCTV 상담 가이드</h1>
          <p className="text-xs text-gray-400">한화비전 KEEPER · 상담사 업무 매뉴얼</p>
        </div>
        <NavTabs />
      </div>

      {/* 검색 */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="검색어 입력 (예: 할인, 부재중, 법인)"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
        {isSearching && (
          <div className="text-center text-xs text-gray-400 mt-1">
            {totalMatches > 0 ? `${totalMatches}개 탭에서 발견` : '검색 결과 없음'}
          </div>
        )}
      </div>

      {/* 탭 바 — 검색 중에는 숨김 */}
      {!isSearching && (
        <div className="flex overflow-x-auto gap-1 -mx-4 px-4 scrollbar-hide">
          {TAB_DEFS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 2컬럼 레이아웃: 좌측 퀵 가이드 사이드바 + 우측 탭 콘텐츠 */}
      <div className="flex gap-5">
        {/* 좌측: 상황별 퀵 가이드 (항상 표시, 검색에도 포함) */}
        {currentQuickGuide && (
          <div className="hidden lg:block w-72 shrink-0">
            <div data-section className="sticky top-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 scroll-mt-28">
              <h3 className="text-[13px] font-bold text-gray-900 mb-3">💡 이럴 땐 이렇게</h3>
              {currentQuickGuide}
            </div>
          </div>
        )}

        {/* 우측: 탭 콘텐츠 */}
        <div className="flex-1 min-w-0">
          <div ref={contentRef} className="relative">
            {TAB_DEFS.map((tab) => {
              const shouldShow = isSearching
                ? (matchingTabs?.includes(tab.id) ?? false)
                : tab.id === activeTab;

              return (
                <div key={tab.id}>
                  {isSearching && shouldShow && (
                    <div className="text-xs font-bold text-rose-500 mb-2 mt-4">{tab.label}</div>
                  )}
                  <div
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    data-tab={tab.id}
                    style={shouldShow ? undefined : { position: 'absolute', left: '-9999px', visibility: 'hidden' }}
                    aria-hidden={!shouldShow}
                  >
                    {tabComponents[tab.id]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-300 pb-4">
        한화비전 키퍼 · 사바사 운영
      </div>
    </div>
  );
}
