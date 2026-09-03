import KpiCalendar from '../components/kpi-calendar';

export const metadata = {
  title: '월 KPI | 키퍼',
  description: '월 목표 대비 일별 달성 현황',
};

export default function Page() {
  return <KpiCalendar />;
}
