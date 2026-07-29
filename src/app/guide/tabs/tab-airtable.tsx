import React from 'react';
import { Alert, SectionCard, Table } from '../components/guide-helpers';

export default function AtTab() {
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
