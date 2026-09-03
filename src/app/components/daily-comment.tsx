'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyComment } from '@/lib/metrics3/comment';

/**
 * 일자별 진단 코멘트.
 *
 * 화면의 다른 지표(유입 코호트)와 분모가 다르다 — 여기는 '그날 응대한 리드' 기준이다.
 * 그래서 코멘트의 결제 건수는 대시보드 그날 결제수보다 작을 수 있다.
 */
export default function DailyCommentPanel({ data }: { data: DailyComment | null }) {
  if (!data || data.라인.length === 0) return null;

  const { 실적 } = data;
  const 응대외결제 = 실적.결제_전체 - 실적.결제;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{data.날짜} 코멘트</CardTitle>
        <CardDescription>
          그날 응대한 리드 기준으로 어디가 막혀 있는지 짚는다. 위 지표(유입 기준)와 세는 대상이
          다르다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span>
            응대 <strong className="text-foreground">{실적.응대}</strong>건
          </span>
          <span>
            결제 <strong className="text-foreground">{실적.결제}</strong>건
          </span>
          <span>
            실패 <strong className="text-foreground">{실적.실패}</strong>건
          </span>
          <span>
            부재중 <strong className="text-foreground">{실적.부재중}</strong>건
          </span>
        </div>

        <ul className="space-y-2.5">
          {data.라인.map((l, i) => (
            <li key={i} className="border-l-2 border-muted pl-3">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">
                  {l.축}
                </Badge>
                <p className="text-sm leading-relaxed text-foreground">{l.본문}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                {l.근거.map((g, j) => (
                  <span
                    key={j}
                    className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {응대외결제 > 0 && (
            <>
              그날 결제는 전체 {실적.결제_전체}건인데, 그중 {실적.결제}건만 그날 응대 기록이 있다.
              나머지 {응대외결제}건은 앞서 상담해 둔 건이 그날 결제된 것이다.{' '}
            </>
          )}
          메모 {data.meta.메모검토}건을 읽어 주제만 집계했고, 메모 원문은 저장하지 않는다.
        </p>
      </CardContent>
    </Card>
  );
}
