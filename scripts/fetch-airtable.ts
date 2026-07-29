/**
 * SKB+인바운드 통합관리 베이스에서 인바운드·SKB·레드텔레콤 데이터를 가져와 로컬 JSON으로 저장
 * GitHub Actions에서 실행됨 (시간 제한 없음)
 * 개인정보 필드(연락처)는 가져오지 않음
 */
import fs from 'fs';
import path from 'path';
import { V2Record } from '../src/lib/metrics2/types';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const OUT_DIR = path.join(__dirname, '../data');

const TABLES = {
  인바운드: 'tbljFHOl4PzAWmb1f',
  SKB: 'tblb5APohbhFixfHB',
  레드텔레콤: 'tbll3OcD4C6LGtnDv',
};

// 계산에 필요한 필드만 가져옴 (개인정보 연락처 제외)
const INBOUND_FIELDS = ['유입시간', 'Last Modified', '[콜]최종 결과', '[콜]담당자', 'UTM_source', '진입경로'];
const SKB_FIELDS = ['유입시간', 'Last Modified', '[콜]최종 결과', '[콜]담당자', 'UTM_source'];
const REDTEL_FIELDS = ['유입시간']; // 카운트 + 오늘이후 판정용

type AirtableListResponse<TRecord> = {
  records?: TRecord[];
  offset?: string;
};

async function fetchAll<TRecord>(tableId: string, fields?: string[]): Promise<TRecord[]> {
  const records: TRecord[] = [];
  let offset: string | undefined;

  while (true) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    if (fields) {
      fields.forEach((f) => params.append('fields[]', f));
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as AirtableListResponse<TRecord>;
    records.push(...(data.records ?? []));
    offset = data.offset;

    if (!offset) break;
    // Rate limit: 5 req/sec
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  return records;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Fetching 인바운드...');
  const inbound = await fetchAll<V2Record>(TABLES.인바운드, INBOUND_FIELDS);
  fs.writeFileSync(path.join(OUT_DIR, '인바운드.json'), JSON.stringify(inbound, null, 0));
  console.log(`인바운드: ${inbound.length}건`);

  console.log('Fetching SKB...');
  const skb = await fetchAll<V2Record>(TABLES.SKB, SKB_FIELDS);
  fs.writeFileSync(path.join(OUT_DIR, 'SKB.json'), JSON.stringify(skb, null, 0));
  console.log(`SKB: ${skb.length}건`);

  console.log('Fetching 레드텔레콤...');
  const redtel = await fetchAll<V2Record>(TABLES.레드텔레콤, REDTEL_FIELDS);
  fs.writeFileSync(path.join(OUT_DIR, '레드텔레콤.json'), JSON.stringify(redtel, null, 0));
  console.log(`레드텔레콤: ${redtel.length}건`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
