/**
 * Airtable에서 피추천인 + 이력관리 데이터를 가져와 로컬 JSON으로 저장
 * GitHub Actions에서 실행됨 (시간 제한 없음)
 * 개인정보 필드는 가져오지 않음
 */
import fs from 'fs';
import path from 'path';
import { AirtableHistory, AirtableLead } from '../src/lib/types';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const OUT_DIR = path.join(__dirname, '../data');

const TABLES = {
  피추천인: 'tbl45D05oiu3wffTT',
  이력관리: 'tblEPutPIjLYcm0Lp',
};

// 계산에 필요한 필드만 가져옴 (개인정보 제외)
const LEAD_FIELDS = [
  '유입시간',
  '수정일자',
  '[콜]최종 결과',
  '[콜]실패사유',
  '[콜]메모 관리',
  '전화번호 키워드',
  '[참고]전체유입경로',
  '진입경로',
];

const HIST_FIELDS = [
  '이력',
  '피추천인',
  '변경 필드값',
  'Created time',
];

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

    const data = await res.json() as AirtableListResponse<TRecord>;
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

  console.log('Fetching 피추천인...');
  const leads = await fetchAll<AirtableLead>(TABLES.피추천인, LEAD_FIELDS);
  fs.writeFileSync(
    path.join(OUT_DIR, '피추천인.json'),
    JSON.stringify(leads, null, 0)
  );
  console.log(`피추천인: ${leads.length}건`);

  console.log('Fetching 이력관리...');
  const hist = await fetchAll<AirtableHistory>(TABLES.이력관리, HIST_FIELDS);
  fs.writeFileSync(
    path.join(OUT_DIR, '이력관리.json'),
    JSON.stringify(hist, null, 0)
  );
  console.log(`이력관리: ${hist.length}건`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
