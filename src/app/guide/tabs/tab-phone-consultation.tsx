import React from 'react';
import { Alert, Tag, SectionCard, Table, TemplateBox } from '../components/guide-helpers';

export default function CallTab() {
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
4. 확실한 AS: 한화 직접 보증, 무상 AS
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
4. 확실한 AS: 한화 직접 보증, 무상 AS
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
4. 확실한 AS: 한화 직접 보증, 무상 AS
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
