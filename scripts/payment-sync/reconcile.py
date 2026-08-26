"""
결제 데이터 엑셀 ↔ 에어테이블 대조

오전에 받는 결제 데이터 엑셀을 진짜 소스로 본다.
엑셀에 없는 결제 건은 결제가 아닌 것으로 판정한다.

에어테이블 원본은 수정하지 않는다. 대조 결과만 JSON으로 떨어뜨리고,
그 JSON을 대시보드 계산이 결제수 소스로 읽는다.

사용법:
    python reconcile.py <결제데이터.xlsx> [--date YYYY-MM-DD] [--dry-run]

--date 를 주지 않으면 엑셀에 담긴 결제일 중 가장 늦은 날짜를 기준일로 본다.
"""

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openpyxl import load_workbook

KST = timezone(timedelta(hours=9))
BASE_DIR = Path(__file__).resolve().parents[2]
OUT_PATH = BASE_DIR / "data" / "결제대조.json"

INBOUND_TABLE = "tbljFHOl4PzAWmb1f"
SKB_TABLE = "tblb5APohbhFixfHB"

# 엑셀 컬럼 이름은 매달 조금씩 바뀌므로 후보를 두고 찾는다
PHONE_HEADERS = ["연락처", "휴대폰", "휴대폰번호", "전화번호", "고객연락처", "가입번호"]
NAME_HEADERS = ["고객명", "이름", "성명", "가입자명", "가입자"]
DATE_HEADERS = ["결제일", "결제일시", "결제완료일", "승인일", "승인일시", "개통일", "가입일"]


def mask_name(n):
    """콘솔 표시용 이름 마스킹 — 가운데 글자를 별표로"""
    if not n:
        return "(이름없음)"
    n = str(n).strip()
    if len(n) <= 1:
        return n
    if len(n) == 2:
        return n[0] + "*"
    return n[0] + "*" * (len(n) - 2) + n[-1]


def norm_header(s):
    """헤더 비교용 정규화 — 공백·괄호·개행 제거"""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    return re.sub(r"[\s\(\)\[\]/_.-]", "", s)


def phone_key(v):
    """
    전화번호 뒷 8자리 = 리드 대조 키.

    한화비전 룰북의 중복 판정 기준과 같다.
    엑셀은 하이픈·공백·국가번호가 섞여 들어오므로 숫자만 남긴다.
    """
    if v is None:
        return None
    digits = re.sub(r"\D", "", str(v))
    if len(digits) < 8:
        return None
    return digits[-8:]


def find_col(headers, candidates):
    """후보 이름들 중 먼저 맞는 컬럼 인덱스. 없으면 None"""
    normed = [norm_header(h) for h in headers]
    for cand in candidates:
        c = norm_header(cand)
        for i, h in enumerate(normed):
            if h == c:
                return i
    # 완전일치 실패 시 부분일치
    for cand in candidates:
        c = norm_header(cand)
        for i, h in enumerate(normed):
            if c and c in h:
                return i
    return None


def parse_date(v):
    """엑셀 셀 → KST 날짜(YYYY-MM-DD). 판독 불가면 None"""
    if v is None or (isinstance(v, str) and not v.strip()):
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    s = str(v).strip()
    m = re.search(r"(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})", s)
    if m:
        y, mo, d = (int(x) for x in m.groups())
        try:
            return datetime(y, mo, d).date().isoformat()
        except ValueError:
            return None
    return None


def read_excel(path):
    """
    엑셀에서 결제 건 목록을 읽는다.

    헤더 행이 첫 줄이 아닌 경우가 흔해(제목·머리말 위에 붙음)
    전화번호 컬럼이 잡히는 첫 행을 헤더로 본다.
    """
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    wb.close()

    header_idx = None
    cols = None
    for i, row in enumerate(rows[:30]):
        p = find_col(row, PHONE_HEADERS)
        if p is not None:
            header_idx = i
            cols = {
                "phone": p,
                "name": find_col(row, NAME_HEADERS),
                "date": find_col(row, DATE_HEADERS),
            }
            break

    if header_idx is None:
        raise SystemExit(
            "엑셀에서 전화번호 컬럼을 못 찾았습니다.\n"
            f"  1행: {rows[0] if rows else '(빈 파일)'}\n"
            f"  찾는 이름: {', '.join(PHONE_HEADERS)}\n"
            "  컬럼명이 다르면 이 스크립트의 PHONE_HEADERS에 추가해 주세요."
        )

    items = []
    skipped = 0
    for row in rows[header_idx + 1 :]:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue
        key = phone_key(row[cols["phone"]] if cols["phone"] < len(row) else None)
        if key is None:
            skipped += 1
            continue
        name = None
        if cols["name"] is not None and cols["name"] < len(row):
            name = row[cols["name"]]
        d = None
        if cols["date"] is not None and cols["date"] < len(row):
            d = parse_date(row[cols["date"]])
        items.append(
            {
                "키": key,
                "고객명": str(name).strip() if name else None,
                "결제일": d,
            }
        )

    return items, skipped, {k: (rows[header_idx][v] if v is not None else None) for k, v in cols.items()}


def airtable_fetch(base, token, table, fields, progress=None):
    """테이블 전체 조회 (페이징). 리드가 1만 건대라 수십 초 걸린다"""
    out = []
    offset = None
    page = 0
    while True:
        q = [("pageSize", "100")] + [("fields[]", f) for f in fields]
        if offset:
            q.append(("offset", offset))
        url = f"https://api.airtable.com/v0/{base}/{table}?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.load(r)
        out += d.get("records", [])
        offset = d.get("offset")
        page += 1
        if progress and page % 20 == 0:
            print(f"    {progress}: {len(out)}건...", flush=True)
        if not offset:
            return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("excel", help="결제 데이터 엑셀 경로")
    ap.add_argument("--date", help="기준일 YYYY-MM-DD (생략 시 엑셀 내 최신 결제일)")
    ap.add_argument("--dry-run", action="store_true", help="파일로 저장하지 않고 결과만 출력")
    args = ap.parse_args()

    token = os.environ.get("AIRTABLE_TOKEN")
    base = os.environ.get("AIRTABLE_SKB_BASE_ID") or os.environ.get("AIRTABLE_BASE_ID")
    if not token or not base:
        raise SystemExit("AIRTABLE_TOKEN / AIRTABLE_SKB_BASE_ID 환경변수가 필요합니다.")

    items, skipped, mapping = read_excel(args.excel)
    if not items:
        raise SystemExit("엑셀에서 읽은 결제 건이 0건입니다. 파일을 확인해 주세요.")

    print(f"엑셀: {Path(args.excel).name}")
    print(f"  컬럼 매핑 — 연락처={mapping['phone']!r} 고객명={mapping['name']!r} 결제일={mapping['date']!r}")
    print(f"  결제 건 {len(items)}건" + (f" (전화번호 없어 제외 {skipped}행)" if skipped else ""))

    dates = sorted({i["결제일"] for i in items if i["결제일"]})
    기준일 = args.date or (dates[-1] if dates else datetime.now(KST).date().isoformat())
    if not args.date and dates:
        print(f"  엑셀 결제일 범위: {dates[0]} ~ {dates[-1]}")
    print(f"  기준일: {기준일}\n")

    # 에어테이블 조회 — 대조에 필요한 필드만
    print("에어테이블 조회 중...")
    inbound = airtable_fetch(
        base, token, INBOUND_TABLE, ["연락처", "고객명", "[콜]최종 결과"], "인바운드"
    )
    skb = airtable_fetch(
        base, token, SKB_TABLE, ["연락처", "이름", "[콜]최종 결과"], "SKB"
    )
    print(f"  인바운드 {len(inbound)}건 / SKB {len(skb)}건\n")

    # 전화번호 뒷 8자리 → 리드. 같은 키가 여러 건이면 모두 담는다
    index = {}
    for label, recs, name_field in (
        ("인바운드", inbound, "고객명"),
        ("SKB", skb, "이름"),
    ):
        for r in recs:
            f = r.get("fields", {})
            k = phone_key(f.get("연락처"))
            if k is None:
                continue
            index.setdefault(k, []).append(
                {
                    "테이블": label,
                    "id": r["id"],
                    "고객명": f.get(name_field),
                    "최종결과": f.get("[콜]최종 결과"),
                }
            )

    매칭, 미매칭 = [], []
    for it in items:
        hit = index.get(it["키"])
        if hit:
            매칭.append({**it, "리드": hit})
        else:
            미매칭.append(it)

    # 에어테이블에는 결제로 잡혀 있으나 엑셀에 없는 건 = 엑셀 기준으로는 결제 아님
    excel_keys = {i["키"] for i in items}
    에어테이블만_결제 = []
    for k, recs in index.items():
        if k in excel_keys:
            continue
        for r in recs:
            fin = r.get("최종결과") or ""
            if fin.startswith("결제 완료"):
                에어테이블만_결제.append({"키": k, **r})

    by_table = {}
    for m in 매칭:
        for r in m["리드"]:
            by_table[r["테이블"]] = by_table.get(r["테이블"], 0) + 1

    print("=== 대조 결과 ===")
    print(f"엑셀 결제 {len(items)}건")
    print(f"  에어테이블 매칭   {len(매칭)}건  ({', '.join(f'{k} {v}' for k, v in sorted(by_table.items())) or '-'})")
    print(f"  에어테이블 미매칭 {len(미매칭)}건" + ("  <== 리드 없이 결제된 건" if 미매칭 else ""))
    print(f"에어테이블만 결제 표기 {len(에어테이블만_결제)}건" + ("  <== 엑셀 기준 결제 아님" if 에어테이블만_결제 else ""))

    if 미매칭:
        print("\n[미매칭 — 엑셀에 있으나 에어테이블에 리드 없음]")
        for m in 미매칭[:20]:
            print(f"  ...{m['키'][-4:]}  {mask_name(m['고객명'])}  결제일 {m['결제일'] or '?'}")
        if len(미매칭) > 20:
            print(f"  … 외 {len(미매칭) - 20}건")

    if 에어테이블만_결제:
        print("\n[에어테이블만 결제 — 엑셀에 없어 결제로 세지 않음]")
        for r in 에어테이블만_결제[:20]:
            print(f"  ...{r['키'][-4:]}  {mask_name(r['고객명'])}  {r['테이블']}  {r['최종결과']}")
        if len(에어테이블만_결제) > 20:
            print(f"  … 외 {len(에어테이블만_결제) - 20}건")

    payload = {
        "기준일": 기준일,
        "생성시각": datetime.now(KST).isoformat(),
        "엑셀파일": Path(args.excel).name,
        "결제_전체": len(items),
        "결제_매칭": len(매칭),
        "결제_테이블별": by_table,
        # 개인정보(이름·연락처)는 파일에 남기지 않는다 — 건수와 레코드 ID만 기록
        "미매칭_건수": len(미매칭),
        "에어테이블만_결제_건수": len(에어테이블만_결제),
        "에어테이블만_결제_ID": [r["id"] for r in 에어테이블만_결제],
        # 대시보드가 결제수 소스로 읽는 목록.
        # 전화번호가 아니라 에어테이블 레코드 ID로 남긴다 (data/는 gitignore 대상이지만
        # 개인정보는 애초에 파일로 떨어뜨리지 않는다).
        "결제ID_인바운드": sorted(
            {r["id"] for m in 매칭 for r in m["리드"] if r["테이블"] == "인바운드"}
        ),
        "결제ID_SKB": sorted(
            {r["id"] for m in 매칭 for r in m["리드"] if r["테이블"] == "SKB"}
        ),
    }

    if args.dry_run:
        print("\n--dry-run: 파일 저장 생략")
        return

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n저장: {OUT_PATH.relative_to(BASE_DIR)}")
    print("다음: npx tsx scripts/fetch-airtable.ts && npx tsx scripts/compute-and-push.ts")


if __name__ == "__main__":
    main()
