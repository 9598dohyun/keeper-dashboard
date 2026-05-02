import type { Metadata } from 'next';
import LeadForm from './lead-form';

export const metadata: Metadata = {
  title: '키퍼 — 상담 신청',
  description: '이름과 연락처를 남겨주시면 키퍼 담당자가 직접 연락드립니다.',
};

export default function LeadPage() {
  return <LeadForm />;
}
