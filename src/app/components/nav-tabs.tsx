'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: '상담 가이드' },
  { href: '/dashboard', label: '대시보드' },
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
