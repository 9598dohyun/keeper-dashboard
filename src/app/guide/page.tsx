import GuideContent from './guide-content';

export const metadata = {
  title: '상담 가이드 — 키퍼 대시보드',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <GuideContent />
    </div>
  );
}
