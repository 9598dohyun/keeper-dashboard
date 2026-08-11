import Diagnosis from '../components/diagnosis';

export const metadata = {
  title: '전환율 진단 | 키퍼',
};

export default function DiagnosisPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Diagnosis />
    </div>
  );
}
