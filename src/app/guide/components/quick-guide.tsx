'use client';

import React, { useState } from 'react';

export function QuickGuideItem({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
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

export function QuickGuideTag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1 ${colors[color] || colors.gray}`}>{children}</span>;
}

export const QUICK_GUIDES: Record<string, React.ReactNode> = {
  price: (
    <>
      <QuickGuideItem emoji="💰" title="&quot;얼마예요? 한 대당 / 월 얼마?&quot;">
        <p>1대 <strong>월 11,000원</strong>(VAT포함) × 대수 = 월 납입금</p>
        <p className="mt-1">4대 월 44,000원 / 총 1,584,000원 / 36개월 무이자</p>
        <p className="text-gray-400 mt-1">반드시 VAT 포함으로 통일 안내</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏷️" title="&quot;할인 안 되나요? / 깎아주세요&quot;">
        <p><QuickGuideTag color="blue">수량할인</QuickGuideTag> 8대↑ 5% / 12대↑ 10%</p>
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
        <p><strong>무료</strong>, 출퇴근 자동 계산</p>
        <p className="text-gray-400 mt-1">매장형(카페·식당·미용실) 고객 관심 높음 → 선제 안내</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🏗️" title="실외 설치 문의">
        <p>먼저 <strong>녹화기 위치 · 유선 인터넷 · 전기 인입 · 배선 거리 · 부착 구조</strong>를 확인</p>
        <p className="mt-1">받침판 고정 수준이면 검토 가능, <strong>폴대 신설·지반 공사 필요 시 설치팀 작업 불가 가능성 높음</strong></p>
        <p className="text-gray-400 mt-1">외부 PVC/CD관 미시공이면 고객 측 사전 준비 필요할 수 있음</p>
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
        <p>구매라 처음부터 고객님 소유고, 할부만 끝나면 추가 비용도 없습니다.</p>
        <p>저장 30일, 400만 QHD, 무상 A/S — 이게 차이입니다.&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🔵" title="&quot;캡스/세콤 알아보고 있어요&quot;">
        <p>&quot;경비 출동이 본업이라 <strong>월 10만+ 영구</strong>. 키퍼는 CCTV 구매라 3년이면 끝&quot;</p>
        <p className="mt-1">&quot;캡스 AI 기능은 대형·무인매장용. 소규모는 CCTV+도어센서면 충분&quot;</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="🟠" title="&quot;S1/KT 견적 받았는데요&quot;">
        <p>&quot;3년 뒤 카메라 가져갑니다. 키퍼는 구매라 <strong>처음부터 고객님 소유 + 할부 끝나면 월 0원</strong>&quot;</p>
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
        <p><strong>BP:</strong> &quot;한화비전 공식 서비스입니다. 앱스토어에서 &apos;키퍼&apos; 검색해보세요&quot;</p>
        <p className="text-gray-400 mt-1">보이스피싱 의심 고객 증가 → 공식성 강조 필수</p>
      </QuickGuideItem>
      <QuickGuideItem emoji="📋" title="&quot;3년 뒤엔 어떻게 되나요?&quot;">
        <p>&quot;구매라 <strong>설치 즉시 고객님 소유</strong>. 렌탈 아닙니다. 카드 할부만 끝나면 낼 게 없습니다&quot;</p>
        <p className="mt-1">A/S: 무상 A/S 지원</p>
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

export function QuickGuidePanel({ tabId }: { tabId: string }) {
  const guide = QUICK_GUIDES[tabId];
  if (!guide) return null;
  return (
    <div data-section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-4 scroll-mt-28">
      <h2 className="text-[15px] font-bold text-gray-900 mb-3">💡 이럴 땐 이렇게</h2>
      {guide}
    </div>
  );
}
