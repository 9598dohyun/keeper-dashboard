'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import NavTabs from '../components/nav-tabs';
import { QUICK_GUIDES } from './components/quick-guide';
import PriceTab from './tabs/tab-pricing';
import SpecTab from './tabs/tab-spec';
import VsTab from './tabs/tab-competitor';
import CsTab from './tabs/tab-customer-service';
import AtTab from './tabs/tab-airtable';
import CallTab from './tabs/tab-phone-consultation';
import CallScriptTab from './tabs/tab-call-script';
import SmsScriptTab from './tabs/tab-sms-script';

/* ── 탭 정의 ── */
const TAB_DEFS = [
  { id: 'price', label: '가격·결제' },
  { id: 'spec', label: '제품스펙' },
  { id: 'vs', label: '경쟁사비교' },
  { id: 'cs', label: '고객응대' },
  { id: 'at', label: '에어테이블' },
  { id: 'call', label: '전화상담' },
  { id: 'sms', label: '문자 스크립트' },
  { id: 'script', label: '콜 스크립트' },
] as const;

type TabId = (typeof TAB_DEFS)[number]['id'];

/* ── DOM 기반 하이라이트 ── */
function highlightDOM(root: HTMLElement, query: string) {
  if (!query) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const q = query.toLowerCase();
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    const lower = text.toLowerCase();
    if (!lower.includes(q)) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    let idx = lower.indexOf(q, last);
    while (idx !== -1) {
      if (idx > last) frag.appendChild(document.createTextNode(text.substring(last, idx)));
      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-200 text-gray-900 font-semibold px-0.5 rounded';
      mark.textContent = text.substring(idx, idx + q.length);
      frag.appendChild(mark);
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.substring(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function clearHighlights(root: HTMLElement) {
  const marks = root.querySelectorAll('mark');
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });
  root.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
    el.style.display = '';
  });
}

function hideSectionsWithoutMatch(root: HTMLElement, query: string) {
  const q = query.toLowerCase();
  root.querySelectorAll<HTMLElement>('[data-section]').forEach((section) => {
    if (section.textContent?.toLowerCase().includes(q)) {
      section.style.display = '';
    } else {
      section.style.display = 'none';
    }
  });
}

/* ── 메인 컴포넌트 ── */
export default function GuideContent() {
  const [activeTab, setActiveTab] = useState<TabId>('price');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [matchingTabs, setMatchingTabs] = useState<TabId[] | null>(null);

  const tabComponents: Record<TabId, React.ReactNode> = useMemo(() => ({
    price: <PriceTab />,
    spec: <SpecTab />,
    vs: <VsTab />,
    cs: <CsTab />,
    at: <AtTab />,
    call: <CallTab />,
    sms: <SmsScriptTab />,
    script: <CallScriptTab />,
  }), []);

  const currentQuickGuide = QUICK_GUIDES[activeTab] ?? null;

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const normalized = search.trim().toLowerCase();
      setDebouncedSearch(normalized);

      if (!normalized) {
        setMatchingTabs(null);
        return;
      }

      const matches: TabId[] = [];
      for (const def of TAB_DEFS) {
        const el = tabRefs.current[def.id];
        if (el && el.textContent?.toLowerCase().includes(normalized)) {
          matches.push(def.id);
        }
      }
      setMatchingTabs(matches);
    }, 200);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const isSearching = debouncedSearch.length > 0;

  useEffect(() => {
    for (const def of TAB_DEFS) {
      const el = tabRefs.current[def.id];
      if (el) clearHighlights(el);
    }

    if (!isSearching) {
      return;
    }

    requestAnimationFrame(() => {
      for (const tabId of matchingTabs ?? []) {
        const el = tabRefs.current[tabId];
        if (el) {
          highlightDOM(el, debouncedSearch);
          hideSectionsWithoutMatch(el, debouncedSearch);
        }
      }
      setTimeout(() => {
        const firstMark = contentRef.current?.querySelector('mark');
        if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });
  }, [debouncedSearch, isSearching, matchingTabs]);

  const totalMatches = matchingTabs?.length ?? 0;

  return (
    <div className="px-4 py-6">
      {/* 헤더·검색·탭바: 중앙 800px */}
      <div className="max-w-[800px] mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">키퍼 CCTV 상담 가이드</h1>
            <p className="text-xs text-gray-400">한화비전 KEEPER · 상담사 업무 매뉴얼</p>
          </div>
          <NavTabs />
        </div>

        {/* 검색 */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색어 입력 (예: 할인, 부재중, 법인)"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          />
          {isSearching && (
            <div className="text-center text-xs text-gray-400 mt-1">
              {totalMatches > 0 ? `${totalMatches}개 탭에서 발견` : '검색 결과 없음'}
            </div>
          )}
        </div>

        {/* 탭 바 — 검색 중에는 숨김 */}
        {!isSearching && (
          <div className="flex overflow-x-auto gap-1 -mx-4 px-4 scrollbar-hide">
            {TAB_DEFS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 본문: 중앙 탭 콘텐츠 + 좌측 여백에 퀵가이드 */}
      <div className="relative mt-4">
        {/* 좌측 여백: 퀵 가이드 사이드바 (데스크톱, 중앙 콘텐츠 왼쪽에 배치) */}
        {currentQuickGuide && (
          <div className="hidden xl:block absolute right-[calc(50%+400px)] w-72" style={{ top: 0 }}>
            <div data-section className="sticky top-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 scroll-mt-28">
              <h3 className="text-[13px] font-bold text-gray-900 mb-3">💡 이럴 땐 이렇게</h3>
              {currentQuickGuide}
            </div>
          </div>
        )}

        {/* 중앙: 탭 콘텐츠 (800px, 화면 중앙 고정) */}
        <div className="max-w-[800px] mx-auto">
            {/* 모바일: 퀵가이드를 탭 콘텐츠 상단에 표시 */}
            {currentQuickGuide && (
              <div data-section className="lg:hidden bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 scroll-mt-28">
                <h3 className="text-[13px] font-bold text-gray-900 mb-3">💡 이럴 땐 이렇게</h3>
                {currentQuickGuide}
              </div>
            )}
            <div ref={contentRef} className="relative">
              {TAB_DEFS.map((tab) => {
                const shouldShow = isSearching
                  ? (matchingTabs?.includes(tab.id) ?? false)
                  : tab.id === activeTab;

                return (
                  <div key={tab.id}>
                    {isSearching && shouldShow && (
                      <div className="text-xs font-bold text-rose-500 mb-2 mt-4">{tab.label}</div>
                    )}
                    <div
                      ref={(el) => { tabRefs.current[tab.id] = el; }}
                      data-tab={tab.id}
                      style={shouldShow ? undefined : { position: 'absolute', left: '-9999px', visibility: 'hidden' }}
                      aria-hidden={!shouldShow}
                    >
                      {tabComponents[tab.id]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      <div className="text-center text-[10px] text-gray-300 pb-4 mt-4">
        한화비전 키퍼 · 사바사 운영
      </div>
    </div>
  );
}
