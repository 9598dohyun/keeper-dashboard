import React from 'react';
import { Alert, Tag, SectionCard, Table } from '../components/guide-helpers';

export default function VsTab() {
  return (
    <div className="space-y-4">
      {/* 고객 질문 대응 — 상단 배치 */}
      <SectionCard title="💬 고객이 경쟁사 언급하면?">
        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">캡스</Tag> &quot;ADT캡스 알아보고 있어요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;캡스도 3년 후 기기는 내 것이 되지만, <strong>망사용료가 매달 계속</strong> 나갑니다. 키퍼는 36개월 후 완전 0원이에요.&quot;</p>
          <p>• &quot;캡스 AI 기능은 대형·무인매장에 적합해요. 소규모 매장은 CCTV+도어센서면 충분하고, AI 때문에 렌탈료 계속 내는 건 부담입니다.&quot;</p>
          <p>• &quot;캡스 출동경비는 별도 가입이고, <strong>고객 요청 출동은 건당 2만5천원</strong> 청구돼요.&quot;</p>
          <p>• &quot;캡스 저장 약 20일, 키퍼 30일. 가격도 캡스는 전화해야 알려주는데, 키퍼는 홈페이지 공개.&quot;</p>
        </div>

        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">에스원</Tag> &quot;세콤 알아보고 있어요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;에스원도 3년 후 기기는 내 것이 되지만, <strong>망사용료 계속</strong>. 키퍼는 36개월 후 0원.&quot;</p>
          <p>• &quot;에스원 카메라 대부분 200만. 키퍼는 400만으로 두 배 선명. 저장도 18일 vs 30일.&quot;</p>
        </div>

        <h3 className="text-[14px] font-semibold mb-2"><Tag color="blue">KT</Tag> &quot;KT 견적 받았는데요&quot;</h3>
        <div className="space-y-1.5 text-[13px] text-gray-600 mb-4">
          <p>• &quot;KT 200만 4대 월 4만원, 키퍼도 4만원. 근데 <strong>키퍼는 사는 거고 KT는 빌리는 거</strong>예요.&quot;</p>
          <p>• &quot;KT 500만은 월 5만5천원. 키퍼가 더 싸고 내 것이 됩니다. 저장도 KT 15일 vs 키퍼 30일.&quot;</p>
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
                <td className="p-1.5 border-b border-gray-100 font-semibold sticky left-0 bg-green-50/30 z-10">3년 총비용</td>
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
                <td className="p-1.5 border-b border-gray-100 font-bold text-green-700">✅ 30일<br/><span className="text-[10px] text-gray-400">(4대 실측 약 28일)</span></td>
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
        <div className="mt-2"><Alert type="warning">이 표는 <strong>VAT 별도</strong> 기준이라 키퍼 금액이 가격 탭(VAT 포함)과 다르게 보인다. 4대 VAT 별도 40,000원 = VAT 포함 44,000원. <strong>고객 안내는 항상 VAT 포함으로</strong> 한다</Alert></div>
        <p className="text-[11px] text-gray-400 mt-2">저장: KT 200만 4대 14일 / 500만 4대 15일 / 키퍼 4대 실측 약 28일(안내 기준 30일) | KT 모니터 옵션 월 15,000원 추가</p>
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
