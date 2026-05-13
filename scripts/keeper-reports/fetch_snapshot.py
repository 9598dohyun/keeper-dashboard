"""Airtable에서 피추천인·이력관리·메모관리 3개 테이블을 받아 로컬 스냅샷 JSON으로 저장.

GitHub Actions 워크플로우에서 push_to_sheets.py 실행 전에 호출.

환경변수:
  AIRTABLE_TOKEN, AIRTABLE_BASE_ID — 인증
  KEEPER_SNAPSHOT_DIR — 저장 경로 (없으면 ./airtable_snapshot)
"""
import json
import os
import time
from pathlib import Path

import requests

TABLES = {
    '피추천인': 'tbl45D05oiu3wffTT',
    '이력관리': 'tblEPutPIjLYcm0Lp',
    '메모관리': 'tblAziNK1u9NVChR3',
}


def fetch_all(base_id, token, table_id):
    out, offset = [], None
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        r = requests.get(
            f"https://api.airtable.com/v0/{base_id}/{table_id}",
            headers={'Authorization': f'Bearer {token}'},
            params=params,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        out.extend(data.get('records', []))
        offset = data.get('offset')
        if not offset:
            break
        time.sleep(0.22)
    return out


def main():
    token = os.environ['AIRTABLE_TOKEN']
    base = os.environ['AIRTABLE_BASE_ID']
    out_dir = Path(os.environ.get('KEEPER_SNAPSHOT_DIR', './airtable_snapshot'))
    out_dir.mkdir(parents=True, exist_ok=True)

    for name, tid in TABLES.items():
        recs = fetch_all(base, token, tid)
        (out_dir / f"{name}.json").write_text(
            json.dumps(recs, ensure_ascii=False),
            encoding='utf-8',
        )
        print(f"{name}: {len(recs)}건 → {out_dir / f'{name}.json'}")


if __name__ == '__main__':
    main()
