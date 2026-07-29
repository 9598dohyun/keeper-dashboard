'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: '상담 가이드' },
  // 대시보드는 임시 비활성화 (링크만 숨김, /dashboard 라우트는 유지). 노출 재개 시 아래 주석 해제
  // { href: '/dashboard', label: '대시보드' },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
      {tabs.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
