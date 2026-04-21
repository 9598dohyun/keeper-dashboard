'use client';

import React, { useState, useCallback } from 'react';

export function Alert({ type, children }: { type: 'danger' | 'warning' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    danger: 'bg-red-50 border-l-3 border-red-400',
    warning: 'bg-amber-50 border-l-3 border-amber-400',
    info: 'bg-blue-50 border-l-3 border-blue-400',
    success: 'bg-green-50 border-l-3 border-green-400',
  };
  return <div className={`rounded-lg p-3 text-[13px] ${styles[type]}`}>{children}</div>;
}

export function Tag({ color, children }: { color: 'red' | 'green' | 'yellow' | 'blue'; children: React.ReactNode }) {
  const styles = {
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${styles[color]}`}>{children}</span>;
}

export function SectionCard({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} data-section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 scroll-mt-28">
      <h2 className="text-[15px] font-bold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left p-2 bg-gray-50 font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="p-2 border-b border-gray-100 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-3 text-left text-[14px] font-semibold">
        <span>{q}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && <div className="pb-3 text-[14px] text-gray-500">{a}</div>}
    </div>
  );
}

export function TemplateBox({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);
  return (
    <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-4 text-[13px] whitespace-pre-wrap leading-7">
      <button
        onClick={copy}
        className={`absolute top-2 right-2 px-2 py-1 text-[11px] border rounded-md transition-colors ${
          copied ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-red-500 hover:text-white hover:border-red-500'
        }`}
      >
        {copied ? '완료!' : '복사'}
      </button>
      {children}
    </div>
  );
}
