import type { Metadata } from 'next';
import CalLanding from './cal-landing';

export const metadata: Metadata = {
  title: '키퍼 — 매장 CCTV 비용 비교 계산기',
  description:
    '카메라 대수와 현재 월 렌탈료를 입력하시면 키퍼 일시불·무이자 할부와의 누적 비용 차이를 즉시 계산해드립니다.',
};

export default function CalPage() {
  return <CalLanding />;
}
