import React from 'react';
import { Alert, Tag, SectionCard, Table } from '../components/guide-helpers';

export default function OpsTab() {
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
