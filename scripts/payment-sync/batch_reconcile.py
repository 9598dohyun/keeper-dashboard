"""
8/26~9/30 등 여러 날짜의 결제대조를 한 번의 에어테이블 조회로 처리한다.

reconcile.py를 날짜마다 새로 실행하면 매번 에어테이블 전체 조회(인바운드 1만6천여 건,
2분+)를 반복하게 된다. 이 스크립트는 reconcile.py의 순수 함수(엑셀 파싱·매칭·중복 제거)를
그대로 재사용하되, 에어테이블 조회는 한 번만 하고 날짜별 루프는 메모리 안에서 돌린다.
reconcile.py의 main()은 건드리지 않으므로 평소 하루치 반영 절차에는 영향이 없다.

연락처(개인정보)를 다루는 에어테이블 조회 결과는 디스크에 남기지 않고 프로세스 메모리에서만
쓰고 버린다 — reconcile.py와 같은 원칙.

사용법:
    python3 scripts/payment-sync/batch_reconcile.py <엑셀> --start 2026-08-26 --end 2026-09-30

각 날짜마다 data/결제대조.json을 그 날짜 기준으로 다시 써서 즉시 반환하므로,
호출 스크립트(패치용 셸/파이썬)가 날짜별로 이 파일을 읽어 처리하면 된다.
결제원장(data/결제원장.json)은 이번 목적과 무관해 건드리지 않는다.
"""

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reconcile as rc  # noqa: E402


def date_range(start, end):
    d = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    out = []
    while d <= e:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def build_index(inbound, skb, rep_phone):
    index = {}
    for label, recs, name_field, inflow_field in (
        ("인바운드", inbound, "고객명", "유입시간"),
        ("SKB", skb, "이름", "유입시간"),
        ("정보와기술", rep_phone, "이름", "유입날짜"),
    ):
        for r in recs:
            f = r.get("fields", {})
            k = rc.phone_key(f.get("연락처"))
            if k is None:
                continue
            index.setdefault(k, []).append(
                {
                    "테이블": label,
                    "id": r["id"],
                    "고객명": f.get(name_field),
                    "최종결과": f.get("[콜]최종 결과"),
                    "유입시간": f.get(inflow_field) or "",
                    "담당자": (f.get("[콜]담당자") or "").strip() or "(미배정)",
                }
            )
    return index


def reconcile_one_day(all_items, 기준일, index):
    """reconcile.py main()의 날짜 1건 처리 로직만 뽑아 온 것. 원장·엑셀 재파싱은 하지 않는다."""
    day = [i for i in all_items if i["결제일"] == 기준일]
    day = rc.dedupe_orders(day)
    유효 = [i for i in day if not rc.is_cancelled(i)]
    취소 = [i for i in day if rc.is_cancelled(i)]

    매칭, 미매칭 = [], []
    for it in 유효:
        hit = index.get(it["키"])
        if hit:
            대표 = rc.pick_lead(hit)
            매칭.append({**it, "리드": [대표]})
        else:
            미매칭.append(it)

    by_table = Counter(r["테이블"] for m in 매칭 for r in m["리드"])
    ch = Counter(i["채널"] or "(없음)" for i in 유효)

    payload = {
        "기준일": 기준일,
        "생성시각": datetime.now(rc.KST).isoformat(),
        "엑셀파일": None,  # main()에서 채움
        "결제_전체": len(유효),
        "결제_매칭": len(매칭),
        "취소_건수": len(취소),
        "미매칭_건수": len(미매칭),
        "수동제외_건수": 0,
        "수동제외": [],
        "채널별_결제": dict(ch.most_common()),
        "채널별_결제_매칭": dict(Counter(m["채널"] or "(없음)" for m in 매칭).most_common()),
        "채널별_취소": dict(Counter(c["채널"] or "(없음)" for c in 취소).most_common()),
        "결제ID_인바운드": sorted(
            {r["id"] for m in 매칭 for r in m["리드"] if r["테이블"] == "인바운드"}
        ),
        "결제ID_SKB": sorted({r["id"] for m in 매칭 for r in m["리드"] if r["테이블"] == "SKB"}),
        "결제ID_정보와기술": sorted(
            {r["id"] for m in 매칭 for r in m["리드"] if r["테이블"] == "정보와기술"}
        ),
        "결제건수_인바운드": by_table.get("인바운드", 0),
        "결제건수_SKB": by_table.get("SKB", 0),
        "결제건수_정보와기술": by_table.get("정보와기술", 0),
        "담당자별_결제_인바운드": dict(
            Counter(
                m["리드"][0]["담당자"] for m in 매칭 if m["리드"][0]["테이블"] == "인바운드"
            ).most_common()
        ),
        "담당자별_결제_SKB": dict(
            Counter(
                m["리드"][0]["담당자"] for m in 매칭 if m["리드"][0]["테이블"] == "SKB"
            ).most_common()
        ),
        "담당자별_결제_정보와기술": dict(
            Counter(
                m["리드"][0]["담당자"] for m in 매칭 if m["리드"][0]["테이블"] == "정보와기술"
            ).most_common()
        ),
        "원장_주문수": 0,
        "원장_결제ID_인바운드": [],
        "원장_결제ID_SKB": [],
        "원장_결제ID_정보와기술": [],
        "원장_결제건수_인바운드": 0,
        "원장_결제건수_SKB": 0,
        "원장_결제건수_정보와기술": 0,
    }
    return payload, len(유효), len(취소), len(매칭), len(미매칭)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("excel", help="키퍼 주문정산통합데이터 엑셀 경로")
    ap.add_argument("--start", required=True, help="시작일 YYYY-MM-DD")
    ap.add_argument("--end", required=True, help="종료일 YYYY-MM-DD")
    ap.add_argument("--out-dir", default=None, help="결제대조_<날짜>.json을 쓸 디렉토리 (기본 data/)")
    args = ap.parse_args()

    token = os.environ.get("AIRTABLE_TOKEN")
    base = os.environ.get("AIRTABLE_SKB_BASE_ID") or os.environ.get("AIRTABLE_BASE_ID")
    if not token or not base:
        raise SystemExit("AIRTABLE_TOKEN / AIRTABLE_SKB_BASE_ID 환경변수가 필요합니다.")

    all_items, skipped, hdr, sheet = rc.read_excel(args.excel)
    if not all_items:
        raise SystemExit("엑셀에서 읽은 주문이 0건입니다.")
    print(f"엑셀: {Path(args.excel).name} — 전체 주문 {len(all_items)}건")

    print("에어테이블 조회 중 (1회)...")
    inbound = rc.airtable_fetch(
        base, token, rc.INBOUND_TABLE,
        ["연락처", "고객명", "최종결과", "유입시간", "담당자"], "인바운드",
    )
    # 2026-09-30 '인바운드'→'영원' 개명으로 원본 필드명이 바뀌었다 — 표준 필드명으로 되돌린다
    # (reconcile.py main()과 동일한 패치)
    for r in inbound:
        f = r.get("fields", {})
        f["[콜]최종 결과"] = f.get("최종결과")
        f["[콜]담당자"] = f.get("담당자")
    skb = rc.airtable_fetch(
        base, token, rc.SKB_TABLE,
        ["연락처", "이름", "[콜]최종 결과", "유입시간", "[콜]담당자"], "SKB",
    )
    rep_phone = rc.airtable_fetch(
        base, token, rc.REP_PHONE_TABLE,
        ["연락처", "이름", "[콜]최종 결과", "유입날짜", "[콜]담당자"], "정보와기술",
    )
    print(f"  인바운드 {len(inbound)}건 / SKB {len(skb)}건 / 정보와기술 {len(rep_phone)}건")
    index = build_index(inbound, skb, rep_phone)

    out_dir = Path(args.out_dir) if args.out_dir else rc.BASE_DIR / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    dates = date_range(args.start, args.end)
    print(f"\n{len(dates)}일치 처리: {dates[0]} ~ {dates[-1]}")
    for 기준일 in dates:
        payload, 유효, 취소, 매칭, 미매칭 = reconcile_one_day(all_items, 기준일, index)
        payload["엑셀파일"] = Path(args.excel).name
        out_path = out_dir / f"결제대조_{기준일}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
        print(
            f"  {기준일}: 유효 {유효} / 취소 {취소} / 매칭 {매칭} / 미매칭 {미매칭}"
            f" (인바운드 {payload['결제건수_인바운드']} · SKB {payload['결제건수_SKB']}"
            f" · 정보와기술 {payload['결제건수_정보와기술']}) → {out_path.name}"
        )

    print("\n완료. 다음: npx tsx scripts/payment-sync/patch-payment-batch.ts")


if __name__ == "__main__":
    main()
