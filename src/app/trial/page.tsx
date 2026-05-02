import type { Metadata } from 'next';
import TrialLanding from './trial-landing';

export const metadata: Metadata = {
  title: '키퍼 — 30일 무료체험',
  description:
    '카메라 2~32대를 매장에 시범 설치하고 30일 동안 직접 사용해보세요. 결제 0원, 약정 없음, 회수 시 비용 0원.',
};

export default function TrialPage() {
  return <TrialLanding />;
}
