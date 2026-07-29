import React from 'react';
import { Alert, Tag, SectionCard, Table } from '../components/guide-helpers';

export default function PriceTab() {
  return (
    <div className="space-y-4">
      <SectionCard id="price-installment" title="💰 할부 가격표 (36개월 무이자)">
        <p className="text-[13px] text-gray-500 mb-2">녹화기(NVR)·저장공간 포함 | 삼성·현대·롯데·국민·하나·신한 36개월 무이자</p>
        <Alert type="warning">고객 안내 시 반드시 <strong>VAT 포함 금액</strong>으로 안내</Alert>
        <div className="mt-2">
          <Alert type="info"><strong>개수 할인</strong>(수량별) = 할부·일시불 모두 적용 | <strong>일시불 할인</strong> = 일시불에서만 | 8대↑ 5%, 12대↑ 10% 자동 적용 (단, <strong>네이버 스마트스토어는 8대 이상 수량 할인 미적용</strong>)</Alert>
        </div>
        <div className="mt-3">
          <Table
            headers={['대수', '할인율', '월 할부금 (VAT포함)', '총액 (VAT포함)']}
            rows={[
              ['2대', '-', <strong key="p2">22,000원</strong>, '792,000원'],
              ['3대', '-', <strong key="p3">33,000원</strong>, '1,188,000원'],
              ['4대', '-', <strong key="p4">44,000원</strong>, '1,584,000원'],
              ['5대', '-', <strong key="p5">55,000원</strong>, '1,980,000원'],
              ['6대', '-', <strong key="p6">66,000원</strong>, '2,376,000원'],
              ['7대', '-', <strong key="p7">77,000원</strong>, '2,772,000원'],
              ['8대', <Tag key="d8" color="blue">5%</Tag>, <strong key="p8">83,600원</strong>, '3,009,600원'],
              ['9대', <Tag key="d9" color="blue">5%</Tag>, <strong key="p9">94,050원</strong>, '3,385,800원'],
              ['10대', <Tag key="d10" color="blue">5%</Tag>, <strong key="p10">104,500원</strong>, '3,762,000원'],
              ['12대', <Tag key="d12" color="green">10%</Tag>, <strong key="p12">118,800원</strong>, '4,276,800원'],
              ['16대', <Tag key="d16" color="green">10%</Tag>, <strong key="p16">158,400원</strong>, '5,702,400원'],
              ['20대', <Tag key="d20" color="green">10%</Tag>, <strong key="p20">198,000원</strong>, '7,128,000원'],
            ]}
          />
        </div>
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
        <p className="text-[13px] text-gray-500 mb-2">대당 132,000원 균일가</p>
        <Table
          headers={['대수', '청구 가격']}
          rows={[
            ['2대', '264,000원'], ['3대', '396,000원'],
            ['4대', '528,000원'], ['5대', '660,000원'],
          ]}
        />
      </SectionCard>

      <SectionCard id="price-payment" title="💳 결제 안내">
        <Table
          headers={['항목', '내용']}
          rows={[
            ['결제 경로', '앱 내 결제(기본) / 결제 링크(할인 시) / 네이버 스마트스토어'],
            ['카드 무이자', <>36개월: <strong key="c">삼성·현대·롯데·국민·하나·신한</strong> / 24개월: 우리 / 18개월: 농협 / 12개월: BC (모두 개인 신용카드, 법인카드 불가)</>],
            ['네이버 스마트스토어', <>최대 무이자 <strong key="nv">5개월</strong> · <Tag key="nvt" color="red">8대 이상 수량 할인 미적용</Tag><br/><a href="https://smartstore.naver.com/shopmanager_keeper/products/11980485529" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">구매 링크</a></>],
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
