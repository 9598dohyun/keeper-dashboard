"""
키퍼 인바운드 데이터 리포트 — 리드 라이프사이클 기반 지표

**이력관리 테이블 기준** — 피추천인 테이블은 참고용(전화번호, 실패사유)
**메모 관리 테이블 보완** — 메모 생성자가 있는 메모만 컨택 증거로 간주 (생성자 빈값은 시스템 자동/누락이라 허수)

영업일 기준: 전날 20:00 KST ~ 당일 20:00 KST (20 to 20)
  예: 2026-04-17 영업일 = 04-16 20:00 ~ 04-17 20:00

정의:
  - 유입 시점 = 이력관리 [첫진입] 이벤트의 Created time
  - 유입 경로 = [첫진입] 이력 텍스트에서 파싱
  - 성공 처리 = 이력관리 [상태변경] 최종결과 이벤트에서 '결제 완료' 포함
  - 실패 처리 = 이력관리 [상태변경] 최종결과 이벤트에서 '실패'
  - 살아있는 리드 = 최종결과 상태변경 이벤트의 마지막 값이 성공/실패가 아님
  - 처리 일자 = 이력관리 [상태변경] 최종결과 이벤트 시점
  - 오늘 컨택 = 메모 관리에 당일 '생성자 있는' 메모 존재 OR 이력관리에 당일 [상태변경] 최종결과(성공/실패) 이벤트 존재 (피추천인 ID 기준 DISTINCT)
    (생성자 빈값 메모는 시스템 자동/누락 케이스로 간주하여 컨택에서 제외 — 허수 방지)
    (성공/실패 처리 시 메모를 별도로 남기지 않는 케이스 보완)
  - 부재중 컨택 = 이력관리에 '[상태변경] 부재중' 이벤트 (유입 제외)
  - 첫 컨택 = 유입시간 이후 첫 [상태변경] (부재중:유입 제외)

Usage:
    python3 compute_metrics.py 2026-04-16
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone, date
from collections import defaultdict, Counter
import statistics

SNAP = Path(os.environ.get(
    'KEEPER_SNAPSHOT_DIR',
    "/Users/dohyeon/Documents/업무/사바사/한화비전/데이터/airtable_snapshot"
))
KST = timezone(timedelta(hours=9))
BIZ_START_HOUR = 20  # 영업일 시작: 전날 20:00 KST


def biz_date(dt_kst):
    """KST datetime → 영업일 date (20시 이후면 다음날 영업일)"""
    if dt_kst.hour >= BIZ_START_HOUR:
        return (dt_kst + timedelta(days=1)).date()
    return dt_kst.date()


def biz_day_start(d):
    """영업일 d의 시작 시각: 전날 20:00 KST"""
    prev_d = d - timedelta(days=1)
    return datetime(prev_d.year, prev_d.month, prev_d.day, BIZ_START_HOUR, tzinfo=KST)


def biz_day_end(d):
    """영업일 d의 종료 시각: d일 20:00 KST"""
    return datetime(d.year, d.month, d.day, BIZ_START_HOUR, tzinfo=KST)


def parse_utc(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def to_kst(dt):
    return dt.astimezone(KST) if dt else None


def parse_final_result_from_hist(hist_text):
    """이력관리 [상태변경] 최종결과 이벤트 텍스트에서 결과값 추출.
    예: '[상태변경] 최종결과 : 결제 완료 (영원)' → '결제 완료 (영원)'
        '[상태변경] 최종결과: 실패' → '실패'
        '[상태변경] 최종결과: 이력관리 테이블 용 → 결제 완료 (영원)' → '결제 완료 (영원)'
        '[상태변경] 최종결과 : ' → '' (초기화)

    'A → B' 형태(이전값 → 신규값)는 신규값만 사용. 신규 오토메이션이 'old → new' 패턴으로 기록.
    """
    if '최종결과' not in hist_text:
        return None
    # 콜론 뒤 공백 유무 혼재: '최종결과 : ' 또는 '최종결과: '
    for sep in ['최종결과 : ', '최종결과: ']:
        if sep in hist_text:
            value = hist_text.split(sep, 1)[1].strip()
            # 'A → B' 패턴이면 → 뒤의 신규값만 사용
            if '→' in value:
                value = value.split('→', 1)[1].strip()
            return value
    return ''


def parse_channel_from_entry(hist_text):
    """[첫진입] 이력 텍스트에서 유입경로 파싱.
    예: '[첫진입] 유입경로 : facebook.business / 260413_ahnstar2 / /calculator'
    → 'facebook.business'
    """
    for sep in ['유입경로 : ', '유입경로: ']:
        if sep in hist_text:
            path = hist_text.split(sep, 1)[1].strip()
            return path.split('/')[0].strip() or '(미상)'
    return '(미상)'


def normalize_page(entry_path):
    """피추천인의 진입경로 필드 값을 정규화.
    예: '/calculator', '/trial', '/cal/lead?utm=...'
    빈 값이면 '(미상)'.
    """
    if not entry_path:
        return '(미상)'
    s = str(entry_path).strip()
    if not s:
        return '(미상)'
    # 쿼리스트링/해시 제거
    s = s.split('?', 1)[0].split('#', 1)[0].strip()
    if not s:
        return '(미상)'
    if not s.startswith('/'):
        s = '/' + s
    # trailing slash 정리 (단, '/' 단독은 유지)
    if len(s) > 1 and s.endswith('/'):
        s = s[:-1]
    return s


def load_data():
    """이력관리 기준으로 리드 데이터 구축. 피추천인은 참고용. 메모 관리는 컨택 보완용."""
    raw_leads = json.loads((SNAP / "피추천인.json").read_text(encoding='utf-8'))
    raw_hist = json.loads((SNAP / "이력관리.json").read_text(encoding='utf-8'))

    # 메모 관리 로드 (없으면 빈 리스트)
    memo_path = SNAP / "메모관리.json"
    raw_memo = json.loads(memo_path.read_text(encoding='utf-8')) if memo_path.exists() else []

    # 메모 관리 → 리드별 {영업일 date: 생성자} (피추천인 ID → {date: creator, ...})
    # 생성자가 비어있는 메모는 컨택으로 인정하지 않음 (시스템 자동/누락된 기록 — 허수 차단).
    # 같은 리드·같은 영업일에 생성자 있는 메모 복수건이면 첫 메모의 생성자 사용.
    memo_dates_by_lead = defaultdict(dict)
    for m in raw_memo:
        f = m.get('fields', {})
        links = f.get('피추천인') or []
        created = parse_utc(f.get('Created'))
        creator = (f.get('생성자') or '').strip()
        if not created or not links or not creator:
            continue
        memo_biz = biz_date(to_kst(created))
        for link in links:
            if memo_biz not in memo_dates_by_lead[link]:
                memo_dates_by_lead[link][memo_biz] = creator

    # 피추천인 참조용 딕셔너리 (전화번호, 실패사유, UTM, 유입시간 폴백)
    lead_ref = {}
    for l in raw_leads:
        lead_ref[l['id']] = {
            '전화번호_키워드': l['fields'].get('전화번호 키워드') or '',
            '실패사유': l['fields'].get('[콜]실패사유') or '',
            '담당자': l['fields'].get('[콜]담당자') or '',
            'utm_source': l['fields'].get('UTM_source') or '',
            'utm_campaign': l['fields'].get('UTM_campaign') or '',
            '유입시간': parse_utc(l['fields'].get('유입시간')),
            '유입경로': l['fields'].get('[참고]전체유입경로') or '',
            '진입경로': l['fields'].get('진입경로') or '',
        }

    # 이력관리 → 리드별 이벤트 리스트 + 첫진입 정보
    hist_by_lead = defaultdict(list)
    lead_entry = {}  # lead_id → {유입시간, 유입경로}

    for h in raw_hist:
        f = h.get('fields', {})
        links = f.get('피추천인') or []
        created = parse_utc(f.get('Created time'))
        hist_text = f.get('이력', '')

        for link in links:
            hist_by_lead[link].append({
                '이력': hist_text,
                '변경필드': f.get('변경 필드값', ''),
                'ts': created,
            })

            # [첫진입] 이벤트에서 유입시간/유입경로 추출
            if hist_text.startswith('[첫진입]'):
                # 동일 리드에 여러 첫진입이 있을 수 있음 → 가장 이른 것 사용
                if link not in lead_entry or (created and lead_entry[link]['유입시간'] and created < lead_entry[link]['유입시간']):
                    lead_entry[link] = {
                        '유입시간': created,
                        '유입경로': parse_channel_from_entry(hist_text),
                    }

    # 시간순 정렬
    for k in hist_by_lead:
        hist_by_lead[k].sort(key=lambda x: x['ts'] or datetime.min.replace(tzinfo=timezone.utc))

    # 리드 목록 구축: 이력관리 [첫진입] 기준 + 없으면 피추천인 유입시간 폴백
    leads = []
    seen_ids = set()

    # 1) [첫진입] 있는 리드
    for lid, entry in lead_entry.items():
        if not entry['유입시간']:
            continue
        ref = lead_ref.get(lid, {})
        leads.append({
            'id': lid,
            'inflow_ts': entry['유입시간'],
            'channel': entry['유입경로'],
            'page': normalize_page(ref.get('진입경로', '')),
            'phone_key': ref.get('전화번호_키워드', ''),
            'fail_reason': ref.get('실패사유', ''),
            '담당자': ref.get('담당자', ''),
            'utm_source': ref.get('utm_source', ''),
            'utm_campaign': ref.get('utm_campaign', ''),
        })
        seen_ids.add(lid)

    # 2) [첫진입] 없지만 이력관리에 이벤트가 있는 리드 → 피추천인 유입시간 폴백
    for lid in hist_by_lead:
        if lid in seen_ids:
            continue
        ref = lead_ref.get(lid, {})
        fallback_ts = ref.get('유입시간')
        if not fallback_ts:
            continue
        fallback_channel = ref.get('유입경로', '')
        if fallback_channel:
            fallback_channel = fallback_channel.split('/')[0].strip() or '(미상)'
        else:
            fallback_channel = '(미상)'
        leads.append({
            'id': lid,
            'inflow_ts': fallback_ts,
            'channel': fallback_channel,
            'page': normalize_page(ref.get('진입경로', '')),
            'phone_key': ref.get('전화번호_키워드', ''),
            'fail_reason': ref.get('실패사유', ''),
            '담당자': ref.get('담당자', ''),
            'utm_source': ref.get('utm_source', ''),
            'utm_campaign': ref.get('utm_campaign', ''),
        })
        seen_ids.add(lid)

    return leads, hist_by_lead, memo_dates_by_lead


def had_promotion_in_range(lid, hist_by_lead, start_date, end_date):
    """영업일 기준 [start_date, end_date] 범위 내 프로모션 마지막 상태가 true인지 판정.
    true→false(취소) 후 재적용 등 상태 변동을 반영하기 위해 마지막 이벤트 기준."""
    last_promo = None
    for h in hist_by_lead.get(lid, []):
        if not h['ts']:
            continue
        d = biz_date(to_kst(h['ts']))
        if not (start_date <= d <= end_date):
            continue
        txt = h['이력']
        if '프로모션' in txt:
            if 'true' in txt:
                last_promo = True
            elif 'false' in txt:
                last_promo = False
    return last_promo is True


def get_last_final_result(lid, hist_by_lead):
    """이력관리에서 해당 리드의 마지막 최종결과 상태변경 값을 반환.
    최종결과 이벤트가 없으면 None, 초기화(빈값)면 ''."""
    last_result = None
    for h in hist_by_lead.get(lid, []):
        txt = h['이력']
        parsed = parse_final_result_from_hist(txt)
        if parsed is not None:
            last_result = (parsed, h['ts'])
    return last_result  # (result_text, ts) or None


def is_success(result_text):
    if not result_text:
        return False
    return result_text.startswith('결제 완료')


def is_fail(result_text):
    return result_text == '실패'


def is_alive_result(last_result_tuple):
    """최종결과가 없거나 빈값이면 살아있음"""
    if last_result_tuple is None:
        return True
    return not last_result_tuple[0]  # result_text가 빈 문자열


def processed_date(lid, hist_by_lead):
    """성공/실패 처리 영업일. 이력관리 [상태변경] 최종결과 이벤트 시점만 사용."""
    last = get_last_final_result(lid, hist_by_lead)
    if not last:
        return None
    result_text, ts = last
    if not result_text:  # 초기화(빈값)
        return None
    if ts:
        return biz_date(to_kst(ts))
    return None


def get_final_result_text(lid, hist_by_lead):
    """마지막 최종결과 텍스트만 반환"""
    last = get_last_final_result(lid, hist_by_lead)
    if not last:
        return ''
    return last[0]


def first_contact_ts(lid, hist_by_lead):
    """유입 후 첫 실제 [상태변경] (부재중:유입 자동값 제외)"""
    for h in hist_by_lead.get(lid, []):
        txt = h['이력']
        if txt.startswith('[상태변경]'):
            if '부재중: 유입' in txt or '부재중상태: 유입' in txt:
                continue
            return h['ts']
    return None


def had_contact_action(lid, hist_by_lead, target_date, memo_dates_by_lead=None):
    """target_date 영업일에 컨택 여부 판정.
    메모 관리에 당일 '생성자 있는' 메모 존재 OR 이력관리에 당일 [상태변경] 최종결과(성공/실패) 이벤트 존재.
    (memo_dates_by_lead는 load_data에서 이미 생성자 빈값 메모를 제거함.)"""
    if memo_dates_by_lead and target_date in memo_dates_by_lead.get(lid, {}):
        return True
    # 성공/실패 처리 시 메모 없이 이력관리만 변경되는 케이스 보완
    for h in hist_by_lead.get(lid, []):
        if not h['ts']:
            continue
        if biz_date(to_kst(h['ts'])) != target_date:
            continue
        result = parse_final_result_from_hist(h['이력'])
        if result and (is_success(result) or is_fail(result)):
            return True
    return False


def had_contact_action_in_range(lid, hist_by_lead, start_date, end_date, memo_dates_by_lead=None):
    """영업일 기준 [start_date, end_date] 범위 내 컨택 여부 판정.
    메모 관리에 기간 내 '생성자 있는' 메모 존재 OR 이력관리에 기간 내 [상태변경] 최종결과(성공/실패) 이벤트 존재.
    (memo_dates_by_lead는 load_data에서 이미 생성자 빈값 메모를 제거함.)"""
    if memo_dates_by_lead:
        for memo_d in memo_dates_by_lead.get(lid, {}):
            if start_date <= memo_d <= end_date:
                return True
    # 성공/실패 처리 시 메모 없이 이력관리만 변경되는 케이스 보완
    for h in hist_by_lead.get(lid, []):
        if not h['ts']:
            continue
        d = biz_date(to_kst(h['ts']))
        if not (start_date <= d <= end_date):
            continue
        result = parse_final_result_from_hist(h['이력'])
        if result and (is_success(result) or is_fail(result)):
            return True
    return False


def had_missed_contact_in_range(lid, hist_by_lead, start_date, end_date):
    """영업일 기준 [start_date, end_date] 범위 내 마지막 [상태변경]이 부재중인지 판정.
    부재중 이벤트가 있더라도 이후 다른 상태변경(성공/실패/컨택)이 있으면 부재중 아님."""
    last_status = None
    for h in hist_by_lead.get(lid, []):
        if not h['ts']:
            continue
        d = biz_date(to_kst(h['ts']))
        if not (start_date <= d <= end_date):
            continue
        txt = h['이력']
        if txt.startswith('[상태변경]'):
            if '부재중: 유입' in txt or '부재중상태: 유입' in txt:
                continue
            if '부재중' in txt:
                last_status = 'missed'
            else:
                last_status = 'other'
    return last_status == 'missed'


def compute_range(start_date, end_date, leads, hist_by_lead, memo_dates_by_lead=None):
    """기간 [start_date, end_date] 지표 계산 (일간은 start=end)"""
    prev_date = start_date - timedelta(days=1)

    # 전화번호 키워드(뒷8자리) 기준 전체 리드 그룹핑 (중복 판정용)
    by_phone = defaultdict(list)
    for l in leads:
        key = l['phone_key']
        if not key:
            continue
        by_phone[key].append(l['inflow_ts'])
    for k in by_phone:
        by_phone[k].sort()

    # --- 리드 관련 ---
    start_alive = 0
    period_new_ids = set()
    period_new_dup_ids = set()
    end_alive = 0

    for l in leads:
        lid = l['id']
        inflow = l['inflow_ts']
        inflow_biz = biz_date(to_kst(inflow))
        proc_d = processed_date(lid, hist_by_lead)
        alive = is_alive_result(get_last_final_result(lid, hist_by_lead))

        # 시작 전 잔존
        if inflow_biz <= prev_date:
            if alive:
                start_alive += 1
            elif proc_d and proc_d > prev_date:
                start_alive += 1

        # 기간 신규
        if start_date <= inflow_biz <= end_date:
            period_new_ids.add(lid)
            key = l['phone_key']
            if key:
                earlier_in_period = [
                    t for t in by_phone[key]
                    if t and t < inflow
                    and start_date <= biz_date(to_kst(t)) <= end_date
                ]
                if earlier_in_period:
                    period_new_dup_ids.add(lid)

        # 마감 잔존
        if inflow_biz <= end_date:
            if alive:
                end_alive += 1
            elif proc_d and proc_d > end_date:
                end_alive += 1

    period_new = len(period_new_ids)
    period_new_dup = len(period_new_dup_ids)
    period_new_unique = period_new - period_new_dup

    today_new_ids = period_new_ids
    today_new = period_new
    today_new_dup = period_new_dup
    today_new_unique = period_new_unique
    yesterday_alive = start_alive
    today_alive = end_alive

    # --- 액션 관련 ---
    today_contacted = 0
    today_missed = 0
    today_success = 0
    today_fail = 0
    today_success_new = 0
    today_success_existing = 0
    today_fail_dup = 0
    today_promotion = 0
    today_contacted_from_new = 0
    today_contacted_from_new_all = 0
    today_contacted_from_new_dup = 0
    today_contacted_from_existing = 0

    # 1차: 성공/실패 리드 먼저 식별
    processed_success_ids = set()
    processed_fail_ids = set()
    for l in leads:
        lid = l['id']
        final = get_final_result_text(lid, hist_by_lead)
        proc_d = processed_date(lid, hist_by_lead)
        if proc_d and start_date <= proc_d <= end_date:
            if is_success(final):
                processed_success_ids.add(lid)
                today_success += 1
                if lid in period_new_ids:
                    today_success_new += 1
                else:
                    today_success_existing += 1
            elif is_fail(final):
                processed_fail_ids.add(lid)
                today_fail += 1
                fail_reason = l['fail_reason']
                if lid in period_new_dup_ids or '중복' in str(fail_reason):
                    today_fail_dup += 1

    # 2차: 컨택/부재 카운트 (성공·실패 리드도 컨택에 포함)
    for l in leads:
        lid = l['id']
        inflow_biz = biz_date(to_kst(l['inflow_ts']))

        contacted_any = had_contact_action_in_range(lid, hist_by_lead, start_date, end_date, memo_dates_by_lead)
        missed_any = had_missed_contact_in_range(lid, hist_by_lead, start_date, end_date)

        if contacted_any:
            today_contacted += 1
            # 컨택 하위 분류 (성공·실패 포함)
            if lid in period_new_ids:
                today_contacted_from_new_all += 1
                if lid in period_new_dup_ids:
                    today_contacted_from_new_dup += 1
            else:
                today_contacted_from_existing += 1
        if missed_any:
            today_missed += 1

        # 소진율: 고유 신규 중 유입 영업일 당일 컨택 (중복 제외)
        if lid in period_new_ids and lid not in period_new_dup_ids:
            if had_contact_action(lid, hist_by_lead, inflow_biz, memo_dates_by_lead):
                today_contacted_from_new += 1

        # 프로모션
        if had_promotion_in_range(lid, hist_by_lead, start_date, end_date):
            today_promotion += 1

    # 오늘 처리 총량
    all_action_ids = set()
    for l in leads:
        lid = l['id']
        if had_contact_action_in_range(lid, hist_by_lead, start_date, end_date, memo_dates_by_lead):
            all_action_ids.add(lid)
        proc_d = processed_date(lid, hist_by_lead)
        if proc_d and start_date <= proc_d <= end_date:
            all_action_ids.add(lid)
    today_total_processed = len(all_action_ids)

    # --- 지표 ---
    denom_conv = yesterday_alive + today_new
    conv_rate = (today_success / denom_conv * 100) if denom_conv else 0
    burn_rate = (today_contacted_from_new / today_new_unique * 100) if today_new_unique else 0
    miss_rate = (today_missed / today_contacted * 100) if today_contacted else 0

    # --- 리드타임 ---
    lead_times_min = []
    for l in leads:
        if l['id'] not in today_new_ids:
            continue
        inflow = l['inflow_ts']
        first_ts = first_contact_ts(l['id'], hist_by_lead)
        if not first_ts:
            continue
        delta = (first_ts - inflow).total_seconds() / 60
        if delta >= 0:
            lead_times_min.append(delta)

    lt_stats = {}
    if lead_times_min:
        lt_stats = {
            '중앙값_분': round(statistics.median(lead_times_min), 1),
            '평균_분': round(statistics.mean(lead_times_min), 1),
            '최소_분': round(min(lead_times_min), 1),
            '최대_분': round(max(lead_times_min), 1),
            '샘플_건': len(lead_times_min),
            '≤5분': sum(1 for m in lead_times_min if m <= 5),
            '5~30분': sum(1 for m in lead_times_min if 5 < m <= 30),
            '30~60분': sum(1 for m in lead_times_min if 30 < m <= 60),
            '1~3시간': sum(1 for m in lead_times_min if 60 < m <= 180),
            '3~12시간': sum(1 for m in lead_times_min if 180 < m <= 720),
            '12시간+': sum(1 for m in lead_times_min if m > 720),
        }
    else:
        lt_stats = {'샘플_건': 0}

    # --- 채널 분포 (이력관리 [첫진입]에서 파싱) ---
    lead_by_id = {l['id']: l for l in leads}
    ch_new = Counter(lead_by_id[lid]['channel'] for lid in today_new_ids if lid in lead_by_id)

    # --- 시간대별 신규 유입 분포 ---
    hourly_dist = Counter()
    for l in leads:
        if l['id'] not in today_new_ids:
            continue
        hour = to_kst(l['inflow_ts']).hour
        hourly_dist[hour] += 1

    # --- 시간대별 성공/실패 분포 (처리 시점 기준) ---
    hourly_success = Counter()
    hourly_fail = Counter()
    for l in leads:
        lid = l['id']
        final = get_final_result_text(lid, hist_by_lead)
        proc_d = processed_date(lid, hist_by_lead)
        if not proc_d or not (start_date <= proc_d <= end_date):
            continue
        proc_hour = None
        for h in reversed(hist_by_lead.get(lid, [])):
            txt = h['이력']
            if '[상태변경]' in txt and '최종결과' in txt and h['ts']:
                h_kst = to_kst(h['ts'])
                if biz_date(h_kst) == proc_d:
                    proc_hour = h_kst.hour
                    break
        if proc_hour is not None:
            if is_success(final):
                hourly_success[proc_hour] += 1
            elif is_fail(final):
                hourly_fail[proc_hour] += 1

    # --- 채널별 세부 집계 ---
    ZERO = lambda: {'전날잔존': 0, '오늘신규': 0, '잔존컨택': 0, '신규컨택': 0,
                    '잔존성공': 0, '신규성공': 0, '프로모션': 0, '실패': 0, '부재': 0}
    channel_stats = defaultdict(ZERO)

    for l in leads:
        lid = l['id']
        src = l['utm_source'] or '(미상)'
        inflow_biz = biz_date(to_kst(l['inflow_ts']))
        proc_d = processed_date(lid, hist_by_lead)
        alive = is_alive_result(get_last_final_result(lid, hist_by_lead))
        final = get_final_result_text(lid, hist_by_lead)
        is_new = lid in period_new_ids

        t = channel_stats[src]

        # 전날잔존
        if inflow_biz <= prev_date:
            if alive or (proc_d and proc_d > prev_date):
                t['전날잔존'] += 1

        # 오늘신규
        if is_new:
            t['오늘신규'] += 1

        # 컨택 (잔존/신규)
        contacted = had_contact_action_in_range(lid, hist_by_lead, start_date, end_date, memo_dates_by_lead)
        if contacted:
            if is_new:
                t['신규컨택'] += 1
            else:
                t['잔존컨택'] += 1

        # 부재
        missed = had_missed_contact_in_range(lid, hist_by_lead, start_date, end_date)
        if missed:
            t['부재'] += 1

        # 성공/실패
        if proc_d and start_date <= proc_d <= end_date:
            if is_success(final):
                if is_new:
                    t['신규성공'] += 1
                else:
                    t['잔존성공'] += 1
            elif is_fail(final):
                t['실패'] += 1

        # 프로모션
        if had_promotion_in_range(lid, hist_by_lead, start_date, end_date):
            t['프로모션'] += 1

    # 채널을 가용(전날잔존+오늘신규) 내림차순 정렬
    sorted_channels = sorted(channel_stats.items(),
                             key=lambda x: x[1]['전날잔존'] + x[1]['오늘신규'], reverse=True)
    channel_breakdown = []
    for src, stats in sorted_channels:
        s = dict(stats)
        s['가용'] = s['전날잔존'] + s['오늘신규']
        s['컨택'] = s['잔존컨택'] + s['신규컨택']
        s['처리완료'] = s['잔존성공'] + s['신규성공'] + s['실패'] + s['부재']
        channel_breakdown.append({'채널': src, **s})

    # --- 담당자별 세부 집계 ---
    assignee_stats = defaultdict(ZERO)

    for l in leads:
        lid = l['id']
        assignee = l.get('담당자') or '(미배정)'
        inflow_biz = biz_date(to_kst(l['inflow_ts']))
        proc_d = processed_date(lid, hist_by_lead)
        alive = is_alive_result(get_last_final_result(lid, hist_by_lead))
        final = get_final_result_text(lid, hist_by_lead)
        is_new = lid in period_new_ids

        t = assignee_stats[assignee]

        # 전날잔존
        if inflow_biz <= prev_date:
            if alive or (proc_d and proc_d > prev_date):
                t['전날잔존'] += 1

        # 오늘신규
        if is_new:
            t['오늘신규'] += 1

        # 컨택 (잔존/신규) — 메모 우선, 성공/실패 처리 보완
        # 메모 생성자가 있으면 메모 생성자를, 없으면 [콜]담당자를 컨택 담당자로 집계
        memo_contacted = False
        memo_creator = ''
        if memo_dates_by_lead:
            for memo_d, creator in memo_dates_by_lead.get(lid, {}).items():
                if start_date <= memo_d <= end_date:
                    memo_contacted = True
                    memo_creator = creator or ''
                    break

        result_contacted = False
        if not memo_contacted:
            # 메모 없이 성공/실패만 처리된 케이스 보완
            if proc_d and start_date <= proc_d <= end_date and (is_success(final) or is_fail(final)):
                result_contacted = True

        if memo_contacted or result_contacted:
            contact_assignee = memo_creator if memo_creator else assignee
            ct = assignee_stats[contact_assignee]
            if is_new:
                ct['신규컨택'] += 1
            else:
                ct['잔존컨택'] += 1

        # 부재
        missed = had_missed_contact_in_range(lid, hist_by_lead, start_date, end_date)
        if missed:
            t['부재'] += 1

        # 성공/실패
        if proc_d and start_date <= proc_d <= end_date:
            if is_success(final):
                if is_new:
                    t['신규성공'] += 1
                else:
                    t['잔존성공'] += 1
            elif is_fail(final):
                t['실패'] += 1

        # 프로모션
        if had_promotion_in_range(lid, hist_by_lead, start_date, end_date):
            t['프로모션'] += 1

    # 담당자를 가용(전날잔존+오늘신규) 내림차순 정렬
    sorted_assignees = sorted(assignee_stats.items(),
                              key=lambda x: x[1]['전날잔존'] + x[1]['오늘신규'], reverse=True)
    assignee_breakdown = []
    for name, stats in sorted_assignees:
        s = dict(stats)
        s['가용'] = s['전날잔존'] + s['오늘신규']
        s['컨택'] = s['잔존컨택'] + s['신규컨택']
        s['처리완료'] = s['잔존성공'] + s['신규성공'] + s['실패'] + s['부재']
        assignee_breakdown.append({'담당자': name, **s})

    # --- 페이지별 세부 집계 (피추천인.진입경로 기준) ---
    page_stats = defaultdict(ZERO)

    for l in leads:
        lid = l['id']
        page = l.get('page') or '(미상)'
        inflow_biz = biz_date(to_kst(l['inflow_ts']))
        proc_d = processed_date(lid, hist_by_lead)
        alive = is_alive_result(get_last_final_result(lid, hist_by_lead))
        final = get_final_result_text(lid, hist_by_lead)
        is_new = lid in period_new_ids

        t = page_stats[page]

        # 전날잔존
        if inflow_biz <= prev_date:
            if alive or (proc_d and proc_d > prev_date):
                t['전날잔존'] += 1

        # 오늘신규
        if is_new:
            t['오늘신규'] += 1

        # 컨택 (잔존/신규)
        contacted = had_contact_action_in_range(lid, hist_by_lead, start_date, end_date, memo_dates_by_lead)
        if contacted:
            if is_new:
                t['신규컨택'] += 1
            else:
                t['잔존컨택'] += 1

        # 부재
        missed = had_missed_contact_in_range(lid, hist_by_lead, start_date, end_date)
        if missed:
            t['부재'] += 1

        # 성공/실패
        if proc_d and start_date <= proc_d <= end_date:
            if is_success(final):
                if is_new:
                    t['신규성공'] += 1
                else:
                    t['잔존성공'] += 1
            elif is_fail(final):
                t['실패'] += 1

        # 프로모션
        if had_promotion_in_range(lid, hist_by_lead, start_date, end_date):
            t['프로모션'] += 1

    sorted_pages = sorted(page_stats.items(),
                          key=lambda x: x[1]['전날잔존'] + x[1]['오늘신규'], reverse=True)
    page_breakdown = []
    for page_name, stats in sorted_pages:
        s = dict(stats)
        s['가용'] = s['전날잔존'] + s['오늘신규']
        s['컨택'] = s['잔존컨택'] + s['신규컨택']
        s['처리완료'] = s['잔존성공'] + s['신규성공'] + s['실패'] + s['부재']
        page_breakdown.append({'페이지': page_name, **s})

    return {
        '대상기간': (start_date, end_date),
        '리드': {
            '전날잔존': yesterday_alive,
            '오늘신규': today_new,
            '오늘신규_중복': today_new_dup,
            '오늘신규_고유': today_new_unique,
            '오늘잔존': today_alive,
        },
        '액션': {
            '오늘처리총량': today_total_processed,
            '오늘컨택': today_contacted,
            '오늘컨택_신규': today_contacted_from_new_all - today_contacted_from_new_dup,
            '오늘컨택_신규_전체': today_contacted_from_new_all,
            '오늘컨택_신규_중복': today_contacted_from_new_dup,
            '오늘컨택_신규_소진율': today_contacted_from_new,
            '오늘컨택_기존팔로업': today_contacted_from_existing,
            '오늘성공': today_success,
            '오늘성공_신규': today_success_new,
            '오늘성공_기존': today_success_existing,
            '오늘실패': today_fail,
            '오늘실패_중복': today_fail_dup,
            '오늘프로모션': today_promotion,
            '오늘부재': today_missed,
        },
        '지표': {
            '전환율_pct': round(conv_rate, 2),
            '전환율_분자': today_success,
            '전환율_분모': denom_conv,
            '소진율_pct': round(burn_rate, 2),
            '소진율_분자': today_contacted_from_new,
            '소진율_분모': today_new_unique,
            '부재율_pct': round(miss_rate, 2),
            '부재율_분자': today_missed,
            '부재율_분모': today_contacted,
        },
        '리드타임': lt_stats,
        '채널_신규Top': ch_new.most_common(10),
        '시간대별_유입': dict(sorted(hourly_dist.items())),
        '시간대별_성공': dict(sorted(hourly_success.items())),
        '시간대별_실패': dict(sorted(hourly_fail.items())),
        '채널_breakdown': channel_breakdown,
        '담당자_breakdown': assignee_breakdown,
        '페이지_breakdown': page_breakdown,
    }


def compute_daily(target_date, leads, hist_by_lead, memo_dates_by_lead=None):
    """일간 wrapper: start=end=target_date"""
    return compute_range(target_date, target_date, leads, hist_by_lead, memo_dates_by_lead)


def main():
    args = sys.argv[1:]
    leads, hist_by_lead, memo_dates_by_lead = load_data()
    if not args:
        d = datetime.now(KST).date()
        r = compute_range(d, d, leads, hist_by_lead, memo_dates_by_lead)
    elif len(args) >= 2 and args[1] == 'weekly':
        base = date.fromisoformat(args[0])
        # 저번주 화~금주 월 7일 집계
        days_since_mon = base.weekday()  # 월=0
        end = base - timedelta(days=days_since_mon)    # 금주 월요일
        start = end - timedelta(days=6)                # 저번주 화요일
        r = compute_range(start, end, leads, hist_by_lead, memo_dates_by_lead)
    elif len(args) >= 2 and args[1] == 'monthly':
        ym = args[0]
        y, m = map(int, ym.split('-'))
        start = date(y, m, 1)
        if m == 12:
            end = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(y, m + 1, 1) - timedelta(days=1)
        r = compute_range(start, end, leads, hist_by_lead, memo_dates_by_lead)
    else:
        d = date.fromisoformat(args[0])
        r = compute_range(d, d, leads, hist_by_lead, memo_dates_by_lead)
    import pprint
    pprint.pp(r, width=100)


if __name__ == '__main__':
    main()
