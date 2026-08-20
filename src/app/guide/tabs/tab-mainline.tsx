import React from 'react';
import { Alert, Tag, SectionCard, Table, TemplateBox } from '../components/guide-helpers';

export default function MainlineTab() {
  return (
    <div className="space-y-4">
      <SectionCard title="📌 대표전화 PoC — 이 탭의 범위">
        <Alert type="info">
          대표전화(1670-5773)로 걸려온 <strong>세일즈성 문의</strong>만 다룬다.
          대표전화는 A/S 응대가 1순위이므로, A/S·고장·사용법 문의는 기존 CS 플로우로 처리하고 세일즈 전환을 시도하지 않는다.
        </Alert>
        <div className="mt-3">
          <Table
            headers={['구분', '내용']}
            rows={[
              ['적용 시점', '2026-09-01 TM 조직 운영 전 PoC 기간'],
              ['번호 구분', <><strong key="n">영업·도입 문의 5773</strong> / 일반 CS 5772</>],
              ['이 탭 구성', '통화 흐름(콜 스크립트) → 통화 후 메모 작성 → 현장 실사 대응'],
            ]}
          />
        </div>
      </SectionCard>

      {/* ─────────── 1. 콜 스크립트 ─────────── */}

      <SectionCard title="📞 첫 응대 — 가격 질문에 바로 답한다">
        <Alert type="warning">
          대표전화는 광고 리드와 다르다. <strong>고객이 먼저 걸어왔고 대부분 첫 마디가 &quot;설치하면 얼마예요?&quot;다.</strong><br/>
          가격을 뒤로 미루거나 &quot;상담 후 안내드린다&quot;고 하면 그 자리에서 끊긴다.
        </Alert>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">고객이 &quot;얼마예요?&quot;로 시작할 때</h3>
        <p className="text-[13px] text-gray-500 mb-2">대수를 모르면 금액을 못 낸다. 다만 되묻기 전에 기준 단가를 먼저 준다. 질문에 질문으로 답하면 방어적으로 들린다.</p>
        <TemplateBox>{`네, 카메라 한 대당 월 11,000원이고요.
몇 대 정도 생각하고 계세요?`}</TemplateBox>

        <p className="text-[13px] text-gray-500 mt-3 mb-2">대수를 말하면 바로 계산해서 답한다.</p>
        <TemplateBox>{`4대면 월 44,000원이에요.
36개월 카드 무이자 할부로 나눠 내시는 거고, 총액은 158만 4천 원입니다.

렌탈이 아니라 구매라서, 설치하는 순간부터 사장님 소유예요.
36개월 지나면 그 뒤로는 더 내실 게 없습니다.

설치비는 따로 없어요. 녹화기랑 저장장치까지 다 포함된 금액입니다.`}</TemplateBox>

        <div className="mt-3">
          <Alert type="success">
            <strong>순서 고정</strong> — 월 금액 → 대수 확인 → 총액 → 소유 개념 → 설치비 포함
          </Alert>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">대수를 모르겠다고 할 때</h3>
        <TemplateBox>{`매장이 몇 평 정도 되세요?
10평 기준으로 실내 1대, 실외 1대 정도를 기본으로 보고 있고
주방이나 창고가 따로 있으면 한 대 더 보시면 됩니다.`}</TemplateBox>
        <div className="mt-3">
          <Table
            headers={['매장 규모', '추천 대수']}
            rows={[
              ['20평 카페', '3~4대'],
              ['53평 매장', '14~16대'],
              ['70평 실내 + 부지', <>실내 6 + 실외 10, <strong key="s">현장 실사 제안</strong></>],
            ]}
          />
        </div>
        <p className="text-[13px] text-gray-500 mt-2">최소 2대부터 설치 가능하다. 1대는 안 된다.</p>
      </SectionCard>

      <SectionCard title="💰 가격 안내 필수 사항">
        <Alert type="danger">
          가격을 말한 직후 <strong>모니터 별도 안내를 빠뜨리지 않는다.</strong> 누락하면 설치 당일 분쟁이 된다.
        </Alert>
        <div className="mt-3">
          <TemplateBox>{`아, 모니터는 따로 준비하셔야 해요.
쓰시던 거 있으면 그대로 쓰시면 됩니다.`}</TemplateBox>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">수량 할인</h3>
        <p className="text-[13px] text-gray-500">
          8대 이상 5%, 12대 이상 10%. 할부·일시불 모두 적용되고 <strong>앱에서 자동으로 붙는다.</strong> 할인 때문에 따로 상담을 잡을 필요 없다.<br/>
          일시불 추가 5% 할인은 일시불에만 적용된다.
        </p>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">결제 방식</h3>
        <Table
          headers={['경로', '할부']}
          rows={[
            ['키퍼 앱', '36개월 무이자 (삼성·현대·롯데·국민·하나·신한)'],
            ['네이버 스토어', '최대 12개월'],
          ]}
        />
        <div className="mt-3 text-[13px] text-gray-500 space-y-1">
          <p>• 우리 24개월 / 농협 18개월 / BC 12개월</p>
          <p>• <strong>법인카드·체크카드는 36개월 할부가 안 된다.</strong> 36개월 안내할 때 반드시 같이 고지한다.</p>
          <p>• 계좌이체·가상계좌도 가능하다.</p>
        </div>
      </SectionCard>

      <SectionCard title="❓ 자주 나오는 질문">
        <Table
          headers={['질문', '답변']}
          rows={[
            ['저장 얼마나 되나요', '30일이요. 24시간 계속 녹화됩니다. 저장 기간을 조절하거나 필요할 때만 녹화하는 건 안 됩니다'],
            ['화질은요', '400만 화소 QHD입니다. 확대해도 얼굴이 선명하게 남아요'],
            ['A/S는요', <>제조사인 한화비전이 직접 품질 보증하고, <strong key="as">무상 A/S를 지원</strong>합니다<br/><span className="text-gray-400">보상 범위·비용 발생 여부는 상담 단계에서 단정하지 않는다. 구체적인 조건 문의는 고객만족센터(1670-5772)로 안내</span></>],
            ['설치는 언제 되나요', '결제하시고 7일 뒤부터 날짜 선택이 가능해요. 빠른 설치는 요청하시면 설치팀이 조율합니다'],
            ['약정 있나요', '없습니다. 구매라서 위약금도 없어요'],
            ['보험 되나요', '안심케어가 1년 무료로 들어갑니다. 비품 파손 300만원, 개인정보 유출 500만원, 영업배상 1,000만원 한도예요'],
            ['직원 출퇴근 관리', '무료로 쓰실 수 있어요. 매장 앱 깔면 출퇴근이 자동 기록됩니다'],
          ]}
        />
        <div className="mt-3">
          <Alert type="warning">
            A/S는 <strong>&quot;무상 A/S 지원&quot;까지만 안내한다.</strong> 기간·무료 범위를 숫자로 약속하면
            실제로는 유상인 건(고객 귀책·사용환경 변경 등)에 무상을 약속하게 되어 분쟁이 된다.
          </Alert>
        </div>
      </SectionCard>

      <SectionCard title="🚫 절대 하면 안 되는 안내">
        <p className="text-[13px] text-gray-500 mb-2">말하는 순간 사고가 되는 것들이다.</p>
        <Table
          headers={['금지', '대신 이렇게']}
          rows={[
            ['"국산 카메라예요"', '"한화비전 자체 기술이고, 베트남에서 생산합니다"'],
            ['"출동 서비스 있어요"', '"출동은 없고, 문열림 감지되면 앱에서 112·119 버튼으로 바로 연결됩니다"'],
            ['"창문 깨고 들어와도 잡아요"', '"도어센서는 문열림만 감지합니다"'],
            ['"카메라가 움직임 감지하면 알림 가요"', '움직임 감지는 녹화 검색용이다. 경비 알림은 도어센서만'],
            ['아파트 "설치 가능"', '아파트는 B2B로 이관한다'],
            ['A/S 기간·무료 범위 단정', '"무상 A/S 지원됩니다" 까지만. 조건 문의는 1670-5772'],
            ['모니터 안내 누락', '가격 말한 직후 반드시 안내'],
            ['이전설치·NVR 교체 금액 단정', '"설치팀 확인 후 정확히 안내드리겠습니다"'],
            ['상담사가 결제 링크 생성', '고객이 앱에서 직접 결제한다'],
          ]}
        />
      </SectionCard>

      <SectionCard title="🔗 KT텔레캅 연계 — 출동보안·출입보안">
        <p className="text-[13px] text-gray-500 mb-2">
          키퍼는 출동 서비스를 하지 않는다. 하지만 KT텔레캅과 연계해 출동보안·출입보안 상품을 함께 진행할 수 있다.
        </p>

        <h3 className="text-[14px] font-semibold mt-3 mb-2">이런 얘기가 나오면 연계 대상</h3>
        <div className="text-[13px] text-gray-500 space-y-1">
          <p>• &quot;출동은 안 되나요?&quot; / &quot;누가 와주나요?&quot;</p>
          <p>• &quot;에스원이나 캡스처럼 경비 서비스도 같이 되나요?&quot;</p>
          <p>• &quot;출입 통제(카드키·지문)도 필요한데요&quot;</p>
          <p>• 기존에 KT텔레캅·에스원·캡스를 쓰고 있고 그 기능을 유지하고 싶어하는 경우</p>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">응대 방법</h3>
        <p className="text-[13px] text-gray-500 mb-2">그 자리에서 조건·금액을 안내하지 않는다. 상품 구조가 별도라 잘못 말하면 정정이 어렵다.</p>
        <TemplateBox>{`출동이나 출입 보안은 저희가 KT텔레캅이랑 같이 진행할 수 있어요.
담당자가 따로 안내드리는 게 정확해서, 연결해 드리겠습니다.
매장 위치랑 필요하신 부분만 여쭤볼게요.`}</TemplateBox>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">처리 — 커뮤니케이션 채널에 티켓 작성</h3>
        <Table
          headers={['항목', '내용']}
          rows={[
            ['업무 유형', <strong key="t">도입상담</strong>],
            ['제목', <code key="c" className="text-[12px] bg-gray-100 px-1 py-0.5 rounded">[고객명] KT텔레캅 연계 문의 - 출동보안 / 출입보안</code>],
            ['필수 기재', '고객명·연락처 / 매장 위치 / 필요한 것(출동·출입·둘 다) / 현재 쓰는 업체와 계약 상태 / 키퍼 CCTV 동시 검토 여부 및 대수'],
          ]}
        />
        <div className="mt-3">
          <Alert type="info">티켓 작성 후 에어테이블 메모에도 &quot;KT텔레캅 연계 티켓 발행&quot;을 남겨 중복 응대를 막는다</Alert>
        </div>
      </SectionCard>

      <SectionCard title="📵 부재 처리 — 대표전화 기준">
        <Alert type="danger">
          광고 리드와 기준이 다르다. <strong>고객이 이미 우리에게 걸어온 건</strong>이라 반복 발신이 곧 신뢰 훼손으로 이어진다.
        </Alert>

        <div className="mt-3">
          <Table
            headers={['단계', '시점', '시도']}
            rows={[
              [<strong key="s1">1단계</strong>, '당일', '2회 (시간대를 벌려서)'],
              [<strong key="s2">2단계</strong>, '다음 날', '1회'],
              [<strong key="s3">종료</strong>, '2단계 불발', '문자 남기고 종료 처리'],
            ]}
          />
        </div>
        <p className="text-[13px] font-semibold text-red-600 mt-2">총 3회까지다. 그 이상 걸지 않는다.</p>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">지킬 것</h3>
        <div className="text-[13px] text-gray-500 space-y-1">
          <p>• 매 시도마다 문자를 함께 보낸다.</p>
          <p>• 당일 2회는 시간대를 벌린다. 30분 간격으로 연달아 걸지 않는다.</p>
          <p>• 매장 유선번호로 확인되면 영업시간 안에서만 시도한다.</p>
          <p>• <strong>A/S 문의로 걸려온 건에는 이 부재 룰을 적용하지 않는다.</strong> 세일즈성으로 판정된 건에만 해당한다.</p>
        </div>

        <div className="mt-3">
          <Alert type="warning">
            <strong>왜 3회인가</strong> — 대표전화는 본래 A/S 라인이다. A/S 때문에 걸었던 번호로 세일즈 발신이 반복되면
            그 자체가 클레임이 된다. 기존 광고 리드 룰(당일 3회 + 익일 2회 + 마지막 1회, 총 6회)을 여기에 그대로 쓰면 안 된다.
          </Alert>
        </div>
      </SectionCard>

      <SectionCard title="👋 통화 마무리">
        <h3 className="text-[14px] font-semibold mb-2">구매 의사가 있을 때</h3>
        <TemplateBox>{`키퍼 앱에서 바로 주문하실 수 있어요.
문자로 링크 보내드릴게요. 앱에서 설치 날짜도 직접 고르실 수 있습니다.`}</TemplateBox>
        <p className="text-[13px] text-gray-500 mt-2">앱 링크: <code className="bg-gray-100 px-1 py-0.5 rounded">keeper.airbridge.io</code></p>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">고민해보겠다고 할 때</h3>
        <p className="text-[13px] text-gray-500 mb-2">끊기 전에 다음 접점을 만든다.</p>
        <TemplateBox>{`네, 편하게 보시고요.
제가 견적 정리해서 문자로 보내드릴게요.
혹시 궁금한 거 생기시면 이 번호로 편하게 연락 주세요.`}</TemplateBox>
      </SectionCard>

      <SectionCard title="↗️ 이관 기준">
        <p className="text-[13px] text-gray-500 mb-2">세일즈로 끌고 가지 않고 넘겨야 하는 건들이다.</p>
        <Table
          headers={['상황', '처리']}
          rows={[
            ['A/S·고장·사용법 문의', '기존 CS 플로우. 세일즈 전환 시도하지 않는다'],
            ['아파트', 'B2B 이관'],
            ['다점포·법인·대형 사업장', 'B2B 이관'],
            ['출동보안·출입보안 필요', 'KT텔레캅 연계 티켓'],
            ['복층·고층·넓은 영업장', '현장 실사 필요. 금액 단정하지 말고 실사 접수'],
          ]}
        />
      </SectionCard>

      {/* ─────────── 2. 에어테이블 메모 작성법 ─────────── */}

      <SectionCard title="📝 에어테이블 메모 작성법">
        <Alert type="success">
          <strong>한 일 / 알게 된 것 / 다음 할 일</strong> — 이 세 가지를 슬래시(/)로 구분해서 적는다.
        </Alert>

        <div className="mt-3">
          <Table
            headers={['칸', '무엇을 적나', '예시']}
            rows={[
              [<strong key="m1">한 일</strong>, '이번 통화에서 내가 한 것', '가격 안내 / 견적 전달 / 문자 발송'],
              [<strong key="m2">알게 된 것</strong>, '통화로 파악한 현재 고객 상황', '카페 20평 실내 3대 / 타업체 견적 비교 중'],
              [<strong key="m3">다음 할 일</strong>, '다음 전화 일정, 또는 알아봐야 할 것', 'D+2 재전화 / 설치팀에 층고 확인'],
            ]}
          />
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">작성 예시</h3>
        <TemplateBox>{`가격 안내 / 카페 20평 실내 3대, 할부 희망 / 앱 설치 안내 문자 발송

견적 전달 / 성남 아동체육시설 27평 교체설치 실내 3대 / 3월 중 설치 희망

가격 안내 / 바쁘다고 함 / D+2 재전화

견적 전달 / 공장 120평 + 80평 2동, 실외 4대 / 현장 실사 접수 예정

앱 설치 완료 / 결제 방법 다시 물어봄 / 결제 방법 재안내 문자

부재중, 1차 문자 발송

타업체 진행`}</TemplateBox>

        <div className="mt-3">
          <Alert type="info">
            해당 없는 항목은 생략한다. 한 건당 <strong>1~2줄로 간결하게</strong> 적는다.
          </Alert>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">지킬 것</h3>
        <div className="text-[13px] text-gray-500 space-y-1">
          <p>• 메모 필드에는 <strong>내용만</strong> 적는다. 날짜·시간·담당자명은 <code className="bg-gray-100 px-1 py-0.5 rounded">[콜]메모 관리</code> 필드에 자동으로 누적된다.</p>
          <p>• <strong>부재중일 때는 미수신 유형을 적는다</strong> — 안받음 / 바쁘다고함 / 다시전화준다고함 / 통화중 / 거절 / 전원꺼짐</p>
          <p>• 간단한 조치(문자 전달 등)는 키워드만 적어도 충분하다.</p>
        </div>
      </SectionCard>

      {/* ─────────── 3. 현장 실사 대응 ─────────── */}

      <SectionCard title="🔎 현장 실사 대응">
        <h3 className="text-[14px] font-semibold mb-2">실사 대상 판단</h3>
        <Table
          headers={['조건', '처리']}
          rows={[
            [<strong key="r1">8대 이상 / 대형 부지 / 특이 환경</strong>, '실사 대상 (서울·수도권 가능)'],
            [<strong key="r2">4대 이하</strong>, '실사 미진행 — 사진·도면 기반으로 검토'],
            ['복층·고층·넓은 영업장', '실사 필요. 배선 동선·층고 확인이 필요해 원격 판단 불가'],
            ['인테리어 미착공', <>실사 불가. <strong key="r4">도면·사진 요청으로 원격 대응</strong></>],
          ]}
        />

        <div className="mt-3">
          <Alert type="danger">
            실사 대상 건에는 <strong>금액을 단정하지 않는다.</strong> 현장 추가비는 실사 후 산정된다.
            &quot;설치팀이 현장 확인하고 정확히 안내드리겠습니다&quot;로 마무리한다.
          </Alert>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">고객 응대 멘트</h3>
        <TemplateBox>{`매장이 넓으셔서 카메라 위치랑 배선을 현장에서 보고 잡는 게 정확해요.
설치팀이 방문해서 확인드리고, 그 다음에 정확한 견적 안내드리겠습니다.

방문 가능한 날짜만 미리 여쭤볼게요.`}</TemplateBox>

        <div className="mt-3">
          <Alert type="warning">
            실사를 요청하지만 대상이 아닌 경우(4대 이하 등)에는 실사를 잡지 말고
            <strong> 사진·도면 요청으로 원격 대응</strong>한다. 설치와 실사를 함께 진행하는 방식으로도 안내 가능하다.
          </Alert>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">실사 접수 절차</h3>
        <Table
          headers={['순서', '내용']}
          rows={[
            [<strong key="p1">1차</strong>, '실사 담당자와 먼저 소통 — 일정·스케줄 조율, 고객 맥락 공유'],
            [<strong key="p2">2차</strong>, '실사 티켓 발행 — 키퍼 어드민 > CS센터 > 커뮤니케이션 채널'],
            [<strong key="p3">3차</strong>, '에어테이블 메모에 실사 접수 사실 기재'],
          ]}
        />
        <div className="mt-2">
          <Alert type="info">티켓에 댓글이 달리면 어드민 상단 <strong>알림</strong>에서 확인된다</Alert>
        </div>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">실사 티켓 양식</h3>
        <TemplateBox>{`[현장 실사 요청]
• 고객명: OOO
• 연락처: 010-XXXX-XXXX
• 주소: 서울시 OO구 OO동 OOO
• 업종: OO
• 설치 희망 대수: 실내 O대 / 실외 O대
• 실사 희망일: O월 O일
• 특이사항: (있으면 기재)`}</TemplateBox>

        <h3 className="text-[14px] font-semibold mt-4 mb-2">상담 단계 권한</h3>
        <Table
          headers={['기능', '가능 여부', '비고']}
          rows={[
            ['설치 메모', <Tag key="a1" color="green">가능</Tag>, '주문관리 &gt; 설치'],
            ['실사 티켓 발행', <Tag key="a2" color="green">가능</Tag>, 'CS센터 &gt; 커뮤니케이션'],
            ['설치 취소', <Tag key="a3" color="red">불가</Tag>, '고객에게 앱 내 취소 안내'],
            ['본사 직접 소통', <Tag key="a4" color="red">불가</Tag>, '사업팀 통해 전달'],
          ]}
        />
      </SectionCard>
    </div>
  );
}
