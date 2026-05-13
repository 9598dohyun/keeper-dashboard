"""
키퍼 인바운드 리포트 데이터 → Google Sheets 자동 기록

Usage:
    # 일간 (기본)
    python3 push_to_sheets.py 2026-04-18
    python3 push_to_sheets.py                   # 오늘 날짜

    # 주간 (저번주 화~금주 월 7일 집계, 행 일자 = 종료일=월요일)
    python3 push_to_sheets.py --weekly 2026-05-10

    # 월간 (해당 월 1일~말일 집계, 행 일자 = 월 1일)
    python3 push_to_sheets.py --monthly 2026-05

compute_metrics에서 지표를 계산한 뒤:
  - 일간: '전체' / '채널별 전환율' / '담당자별 전환율'
  - 주간: '주간 전체 전환율' / '주간 채널별 전환율' / '주간 담당자별 전환율'
  - 월간: '월간 전체 전환율' / '월간 채널별 전환율' / '월간 담당자별 전환율'
"""
import sys
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# 프로젝트 경로 (로컬 기본값, GitHub Actions에선 환경변수로 덮어쓴다)
PROJECT = Path(os.environ.get(
    'KEEPER_PROJECT_DIR',
    "/Users/dohyeon/Documents/업무/사바사/한화비전"
))
# compute_metrics는 같은 디렉토리에 있어야 함 (Actions에선 scripts/keeper-reports/)
sys.path.insert(0, str(Path(__file__).parent))
import compute_metrics as cm

SPREADSHEET_ID = "12mX8xvWl9ZrBhCSZzsXW4M1CymVUTDd8unpTcAEyWfY"

# 모드별 시트 이름 매핑
SHEETS_BY_MODE = {
    'daily': {
        'total': '전체',
        'channel': '채널별 전환율',
        'assignee': '담당자별 전환율',
    },
    'weekly': {
        'total': '주간 전체 전환율',
        'channel': '주간 채널별 전환율',
        'assignee': '주간 담당자별 전환율',
    },
    'monthly': {
        'total': '월간 전체 전환율',
        'channel': '월간 채널별 전환율',
        'assignee': '월간 담당자별 전환율',
    },
}

# 기존 일간 시트 이름 (하위 호환용)
SHEET_TOTAL = SHEETS_BY_MODE['daily']['total']
SHEET_CHANNEL = SHEETS_BY_MODE['daily']['channel']
SHEET_ASSIGNEE = SHEETS_BY_MODE['daily']['assignee']
KST = timezone(timedelta(hours=9))

# --- '전체' 시트 컬럼 구조 (2026-04-22 확인) ---
# A=일자(직접), B=누적리드(수식), C=누적성공(수식), D=전환율(수식)
# E=가용리드합계(수식=F+G), F=전날잔존(직접), G=오늘신규(직접)
# H=컨택합계(수식=I+J), I=잔존컨택(직접), J=신규컨택(직접)
# K=처리완료합계(수식=sum(L:Q)), L=잔존성공(직접), M=신규성공(직접),
# N=프로모션(직접), O=실패(직접), P=부재중(직접), Q=B2B이관(직접)
# R=당일신규전환율(수식)
FORMULA_COLS = {'A', 'B', 'C', 'D', 'E', 'H', 'K', 'R'}
DATA_COLS = {'F', 'G', 'I', 'J', 'L', 'M', 'N', 'O', 'P'}

# --- '채널별 전환율' 시트 컬럼 구조 (2026-04-22 확인) ---
# A=일자, B=source, C=campaign
# D=누적리드, E=누적성공, F=전환율
# G=가용합계, H=전날잔존, I=오늘신규
# J=컨택합계, K=잔존컨택, L=신규컨택
# M=처리완료합계, N=잔존성공, O=신규성공, P=프로모션, Q=실패, R=부재중, S=B2B이관
# T~=지표


def get_sheets_service():
    """Google Sheets API 인증 객체 생성.

    토큰 소스 우선순위:
      1. 환경변수 GOOGLE_TOKEN_JSON (GitHub Actions Secret) — JSON 문자열
      2. 로컬 파일 google-token.json (PROJECT/google-token.json)

    토큰 만료 시 자동 갱신.
    로컬 파일 경로일 때만 갱신된 토큰을 디스크에 저장한다.
    GitHub Actions에선 컨테이너가 일회성이라 디스크 저장은 의미 없음 — 매 실행마다 refresh_token으로 새 access token 받음."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    token_env = os.environ.get('GOOGLE_TOKEN_JSON', '').strip()
    if token_env:
        token_data = json.loads(token_env)
        token_path = None  # 디스크 저장 안 함
    else:
        token_path = PROJECT / "google-token.json"
        with open(token_path) as f:
            token_data = json.load(f)

    creds = Credentials(
        token=token_data['token'],
        refresh_token=token_data['refresh_token'],
        token_uri=token_data['token_uri'],
        client_id=token_data['client_id'],
        client_secret=token_data['client_secret'],
        scopes=token_data['scopes']
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        if token_path is not None:
            token_data['token'] = creds.token
            with open(token_path, 'w') as f:
                json.dump(token_data, f)

    return build('sheets', 'v4', credentials=creds)


def find_row_for_date(service, sheet_name, target_date, auto_create=True, display_str=None):
    """시트에서 target_date(또는 display_str)에 해당하는 행 번호를 찾는다.
    auto_create=True면 없을 경우 마지막 날짜 행 아래에 자동 생성.
    display_str: A열에 적힐 표시 문자열. 미지정 시 단일 날짜 'YYYY. MM. DD.' 사용.
                 주간/월간은 기간 표기를 넘기면 그대로 검색·생성한다."""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A1:A500"
    ).execute()
    rows = result.get('values', [])
    target_str = display_str if display_str else target_date.strftime("%Y. %m. %d.")

    last_date_row = None
    for i, row in enumerate(rows):
        if not row:
            continue
        cell = row[0].strip()
        if cell == target_str:
            return i + 1  # 1-indexed
        # 날짜 형식 감지 (2026. 04. 20.)
        if cell[:2] == '20' and '.' in cell:
            last_date_row = i + 1

    if not auto_create:
        return None

    # 날짜 행이 없으면 자동 생성
    # 마지막 날짜 행의 하위 행을 건너뛴 다음 위치에 삽입
    if last_date_row:
        # A~B열을 다시 읽어서 하위 행 수를 정확히 계산
        # (A열만으로는 trailing 빈 행이 API 응답에서 누락되므로)
        sub_result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{sheet_name}'!A{last_date_row + 1}:B{last_date_row + 200}"
        ).execute()
        sub_rows = sub_result.get('values', [])
        sub_count = 0
        for sr in sub_rows:
            a = sr[0].strip() if len(sr) > 0 and sr[0] else ''
            if a and a[:2] == '20' and '.' in a:
                break
            sub_count += 1
        insert_row = last_date_row + sub_count + 1
    else:
        insert_row = len(rows) + 1

    # 행 삽입 + 날짜 기록
    sheet_id = get_sheet_id(service, sheet_name)
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': [{
            'insertDimension': {
                'range': {
                    'sheetId': sheet_id,
                    'dimension': 'ROWS',
                    'startIndex': insert_row - 1,  # 0-indexed
                    'endIndex': insert_row,
                },
                'inheritFromBefore': True,
            }
        }]}
    ).execute()
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A{insert_row}",
        valueInputOption='USER_ENTERED',
        body={'values': [[target_str]]}
    ).execute()
    print(f"[{sheet_name}] {target_date} 날짜 행 자동 생성 (행 {insert_row})")
    return insert_row


def get_sheet_id(service, sheet_name):
    """시트 이름으로 sheetId를 반환한다."""
    meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    for s in meta['sheets']:
        if s['properties']['title'] == sheet_name:
            return s['properties']['sheetId']
    return None


# ============================================================
# '전체' 시트 기록
# ============================================================

def push_total_sheet(service, target_date, r, sheet_name=SHEET_TOTAL, display_str=None):
    """전체 시트(일간/주간/월간 공용)에 전체 수치를 기록한다."""
    L = r['리드']
    A = r['액션']

    row_num = find_row_for_date(service, sheet_name, target_date, display_str=display_str)
    if not row_num:
        print(f"[{sheet_name}] 시트에서 {target_date} 행을 찾을 수 없습니다.")
        return False

    updates = [
        (f"F{row_num}", L['전날잔존']),
        (f"G{row_num}", L['오늘신규_고유']),
        (f"I{row_num}", A['오늘컨택_기존팔로업']),
        (f"J{row_num}", A['오늘컨택_신규']),
        (f"L{row_num}", A['오늘성공_기존']),
        (f"M{row_num}", A['오늘성공_신규']),
        (f"N{row_num}", A['오늘프로모션']),
        (f"O{row_num}", A['오늘실패']),
        (f"P{row_num}", A['오늘부재']),
    ]

    batch_data = []
    for cell, value in updates:
        col = ''.join(c for c in cell if c.isalpha())
        if col in FORMULA_COLS:
            raise ValueError(f"수식 컬럼 {col}에 쓰기 시도 차단: {cell}={value}")
        if col not in DATA_COLS:
            raise ValueError(f"허용되지 않은 컬럼 {col}에 쓰기 시도 차단: {cell}={value}")
        batch_data.append({
            'range': f"'{sheet_name}'!{cell}",
            'values': [[value]]
        })

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'valueInputOption': 'USER_ENTERED', 'data': batch_data}
    ).execute()

    print(f"[{sheet_name}] {target_date} → 행 {row_num} 업데이트")
    print(f"  전날잔존: {L['전날잔존']} / 신규(고유): {L['오늘신규_고유']}")
    print(f"  잔존컨택: {A['오늘컨택_기존팔로업']} / 신규컨택: {A['오늘컨택_신규']}")
    print(f"  잔존성공: {A['오늘성공_기존']} / 신규성공: {A['오늘성공_신규']}")
    print(f"  실패: {A['오늘실패']} / 부재: {A['오늘부재']}")
    return True


# ============================================================
# '채널별 전환율' 시트 기록
# ============================================================

def count_channel_sub_rows(service, date_row_num, sheet_name=SHEET_CHANNEL):
    """날짜 행 아래에 이미 존재하는 채널·캠페인 하위 행 수를 센다.
    다음 날짜 행(A열에 '20'으로 시작하는 값)까지의 거리로 계산.
    빈 행도 하위 행에 포함하여 삭제 대상으로 카운트."""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A{date_row_num + 1}:B{date_row_num + 200}"
    ).execute()
    rows = result.get('values', [])
    count = 0
    for row in rows:
        a = row[0].strip() if len(row) > 0 and row[0] else ''
        # A열에 날짜가 있으면 다음 날짜 행 → 하위 행 끝
        if a and a[:2] == '20' and '.' in a:
            break
        count += 1
    return count


def push_channel_sheet(service, target_date, r, sheet_name=SHEET_CHANNEL, display_str=None):
    """채널별 시트(일간/주간/월간 공용)에 날짜 행 + 채널(source) 하위 행을 기록한다."""
    breakdown = r.get('채널_breakdown', [])
    if not breakdown:
        print(f"[{sheet_name}] breakdown 데이터 없음")
        return False

    sheet_id = get_sheet_id(service, sheet_name)
    if sheet_id is None:
        print(f"[{sheet_name}] 시트를 찾을 수 없습니다.")
        return False

    # 날짜 행 찾기
    date_row = find_row_for_date(service, sheet_name, target_date, display_str=display_str)

    if date_row:
        # 기존 하위 행 삭제
        existing = count_channel_sub_rows(service, date_row, sheet_name)
        if existing > 0:
            service.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={'requests': [{
                    'deleteDimension': {
                        'range': {
                            'sheetId': sheet_id,
                            'dimension': 'ROWS',
                            'startIndex': date_row,  # 0-indexed = date_row (다음 행)
                            'endIndex': date_row + existing,
                        }
                    }
                }]}
            ).execute()
            print(f"[{sheet_name}] 기존 하위 행 {existing}행 삭제")

        # 날짜 행의 전체 수치 업데이트 (G, J, M은 수식 컬럼 — 기록 금지)
        L = r['리드']
        A = r['액션']
        batch_data = [
            {'range': f"'{sheet_name}'!H{date_row}", 'values': [[L['전날잔존']]]},
            {'range': f"'{sheet_name}'!I{date_row}", 'values': [[L['오늘신규']]]},
            {'range': f"'{sheet_name}'!K{date_row}", 'values': [[A['오늘컨택_기존팔로업']]]},
            {'range': f"'{sheet_name}'!L{date_row}", 'values': [[A['오늘컨택_신규']]]},
            {'range': f"'{sheet_name}'!N{date_row}", 'values': [[A['오늘성공_기존']]]},
            {'range': f"'{sheet_name}'!O{date_row}", 'values': [[A['오늘성공_신규']]]},
            {'range': f"'{sheet_name}'!P{date_row}", 'values': [[A['오늘프로모션']]]},
            {'range': f"'{sheet_name}'!Q{date_row}", 'values': [[A['오늘실패']]]},
            {'range': f"'{sheet_name}'!R{date_row}", 'values': [[A['오늘부재']]]},
        ]
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'valueInputOption': 'USER_ENTERED', 'data': batch_data}
        ).execute()
    else:
        print(f"[{sheet_name}] 시트에서 {target_date} 행을 찾을 수 없습니다.")
        return False

    # 하위 행 수 = 채널 수 (캠페인 하위 행 없음)
    total_sub = len(breakdown)

    # 하위 행 삽입
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': [{
            'insertDimension': {
                'range': {
                    'sheetId': sheet_id,
                    'dimension': 'ROWS',
                    'startIndex': date_row,  # 날짜 행 바로 아래
                    'endIndex': date_row + total_sub,
                },
                'inheritFromBefore': False,
            }
        }]}
    ).execute()

    # 하위 행 데이터 기록 (채널 행만, 캠페인 없음)
    batch_data = []
    current_row = date_row + 1  # 1-indexed

    for ch in breakdown:
        batch_data.append({'range': f"'{sheet_name}'!B{current_row}", 'values': [[ch['채널']]]})
        batch_data.append({'range': f"'{sheet_name}'!H{current_row}", 'values': [[ch['전날잔존']]]})
        batch_data.append({'range': f"'{sheet_name}'!I{current_row}", 'values': [[ch['오늘신규']]]})
        batch_data.append({'range': f"'{sheet_name}'!K{current_row}", 'values': [[ch['잔존컨택']]]})
        batch_data.append({'range': f"'{sheet_name}'!L{current_row}", 'values': [[ch['신규컨택']]]})
        batch_data.append({'range': f"'{sheet_name}'!N{current_row}", 'values': [[ch['잔존성공']]]})
        batch_data.append({'range': f"'{sheet_name}'!O{current_row}", 'values': [[ch['신규성공']]]})
        batch_data.append({'range': f"'{sheet_name}'!P{current_row}", 'values': [[ch['프로모션']]]})
        batch_data.append({'range': f"'{sheet_name}'!Q{current_row}", 'values': [[ch['실패']]]})
        batch_data.append({'range': f"'{sheet_name}'!R{current_row}", 'values': [[ch['부재']]]})
        current_row += 1

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'valueInputOption': 'USER_ENTERED', 'data': batch_data}
    ).execute()

    print(f"[{sheet_name}] {target_date} → 채널 {total_sub}행 기록 (행 {date_row + 1}~{date_row + total_sub})")
    return True


# ============================================================
# '담당자별 전환율' 시트 기록
# ============================================================

# --- '담당자별 전환율' 시트 컬럼 구조 ---
# '전체' 시트와 동일. 날짜 행 아래에 담당자별 하위 행 삽입.
# 하위 행: B=담당자명, 나머지 데이터 컬럼은 '전체'와 동일
# 수식 컬럼(A,B,C,D,E,H,K,R) 중 B는 하위 행에서 담당자명으로 사용
ASSIGNEE_FORMULA_COLS = {'A', 'C', 'D', 'E', 'H', 'K'}
ASSIGNEE_DATA_COLS = {'B', 'F', 'G', 'I', 'J', 'L', 'M', 'N', 'O', 'P'}


def count_assignee_sub_rows(service, date_row_num, sheet_name=SHEET_ASSIGNEE):
    """날짜 행 아래에 이미 존재하는 담당자 하위 행 수를 센다."""
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"'{sheet_name}'!A{date_row_num + 1}:B{date_row_num + 200}"
    ).execute()
    rows = result.get('values', [])
    count = 0
    for row in rows:
        a = row[0].strip() if len(row) > 0 and row[0] else ''
        if a and a[:2] == '20' and '.' in a:
            break
        count += 1
    return count


def push_assignee_sheet(service, target_date, r, sheet_name=SHEET_ASSIGNEE, display_str=None):
    """담당자별 시트(일간/주간/월간 공용)에 날짜 행 + 담당자 하위 행을 기록한다."""
    breakdown = r.get('담당자_breakdown', [])
    if not breakdown:
        print(f"[{sheet_name}] breakdown 데이터 없음")
        return False

    sheet_id = get_sheet_id(service, sheet_name)
    if sheet_id is None:
        print(f"[{sheet_name}] 시트를 찾을 수 없습니다.")
        return False

    # 날짜 행 찾기
    date_row = find_row_for_date(service, sheet_name, target_date, display_str=display_str)

    if date_row:
        # 기존 하위 행 삭제
        existing = count_assignee_sub_rows(service, date_row, sheet_name)
        if existing > 0:
            service.spreadsheets().batchUpdate(
                spreadsheetId=SPREADSHEET_ID,
                body={'requests': [{
                    'deleteDimension': {
                        'range': {
                            'sheetId': sheet_id,
                            'dimension': 'ROWS',
                            'startIndex': date_row,
                            'endIndex': date_row + existing,
                        }
                    }
                }]}
            ).execute()
            print(f"[{sheet_name}] 기존 하위 행 {existing}행 삭제")

        # 날짜 행의 전체 수치 업데이트
        L = r['리드']
        A = r['액션']
        batch_data = [
            {'range': f"'{sheet_name}'!F{date_row}", 'values': [[L['전날잔존']]]},
            {'range': f"'{sheet_name}'!G{date_row}", 'values': [[L['오늘신규_고유']]]},
            {'range': f"'{sheet_name}'!I{date_row}", 'values': [[A['오늘컨택_기존팔로업']]]},
            {'range': f"'{sheet_name}'!J{date_row}", 'values': [[A['오늘컨택_신규']]]},
            {'range': f"'{sheet_name}'!L{date_row}", 'values': [[A['오늘성공_기존']]]},
            {'range': f"'{sheet_name}'!M{date_row}", 'values': [[A['오늘성공_신규']]]},
            {'range': f"'{sheet_name}'!N{date_row}", 'values': [[A['오늘프로모션']]]},
            {'range': f"'{sheet_name}'!O{date_row}", 'values': [[A['오늘실패']]]},
            {'range': f"'{sheet_name}'!P{date_row}", 'values': [[A['오늘부재']]]},
        ]
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'valueInputOption': 'USER_ENTERED', 'data': batch_data}
        ).execute()
    else:
        print(f"[{sheet_name}] 시트에서 {target_date} 행을 찾을 수 없습니다.")
        return False

    # 가용 > 0인 담당자만 하위 행으로 삽입
    active = [a for a in breakdown if a['가용'] > 0]
    if not active:
        print(f"[{sheet_name}] 가용 리드가 있는 담당자 없음")
        return True

    total_sub = len(active)

    # 하위 행 삽입
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'requests': [{
            'insertDimension': {
                'range': {
                    'sheetId': sheet_id,
                    'dimension': 'ROWS',
                    'startIndex': date_row,
                    'endIndex': date_row + total_sub,
                },
                'inheritFromBefore': False,
            }
        }]}
    ).execute()

    # 하위 행 데이터 기록
    batch_data = []
    current_row = date_row + 1

    for a in active:
        batch_data.append({'range': f"'{sheet_name}'!B{current_row}", 'values': [[a['담당자']]]})
        batch_data.append({'range': f"'{sheet_name}'!F{current_row}", 'values': [[a['전날잔존']]]})
        batch_data.append({'range': f"'{sheet_name}'!G{current_row}", 'values': [[a['오늘신규']]]})
        batch_data.append({'range': f"'{sheet_name}'!I{current_row}", 'values': [[a['잔존컨택']]]})
        batch_data.append({'range': f"'{sheet_name}'!J{current_row}", 'values': [[a['신규컨택']]]})
        batch_data.append({'range': f"'{sheet_name}'!L{current_row}", 'values': [[a['잔존성공']]]})
        batch_data.append({'range': f"'{sheet_name}'!M{current_row}", 'values': [[a['신규성공']]]})
        batch_data.append({'range': f"'{sheet_name}'!N{current_row}", 'values': [[a['프로모션']]]})
        batch_data.append({'range': f"'{sheet_name}'!O{current_row}", 'values': [[a['실패']]]})
        batch_data.append({'range': f"'{sheet_name}'!P{current_row}", 'values': [[a['부재']]]})
        current_row += 1

    service.spreadsheets().values().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={'valueInputOption': 'USER_ENTERED', 'data': batch_data}
    ).execute()

    print(f"[{sheet_name}] {target_date} → 담당자 {total_sub}행 기록 (행 {date_row + 1}~{date_row + total_sub})")
    return True


# ============================================================
# 모드별 디스패처
# ============================================================

def _format_period_label(mode, start_date, end_date):
    """모드별 A열 표시 문자열을 만든다.
    - daily: 'YYYY. MM. DD.'
    - weekly/monthly: 'YYYY. MM. DD. ~ YYYY. MM. DD.'"""
    if mode == 'daily':
        return start_date.strftime("%Y. %m. %d.")
    return f"{start_date.strftime('%Y. %m. %d.')} ~ {end_date.strftime('%Y. %m. %d.')}"


def push_to_kv(mode, row_date, r):
    """채널별·담당자별 breakdown을 Upstash KV에 저장.

    환경변수 KV_REST_API_URL · KV_REST_API_TOKEN이 있을 때만 동작.
    GitHub Actions에서만 호출됨(로컬 실행 시 환경변수 없으면 silent skip).

    저장 키:
      metrics:channel:daily:{YYYY-MM-DD}       — 일간 채널 breakdown
      metrics:assignee:daily:{YYYY-MM-DD}      — 일간 담당자 breakdown
      metrics:channel:weekly:{YYYY-MM-DD}      — 주간 채널 (row_date = 종료일=월요일)
      metrics:assignee:weekly:{YYYY-MM-DD}     — 주간 담당자
      metrics:channel:monthly:{YYYY-MM}        — 월간 채널 (row_date 월 단위)
      metrics:assignee:monthly:{YYYY-MM}       — 월간 담당자

    TTL: 일간·주간·월간 모두 무제한(0). 1일 약 6.8KB → 1년 약 2.5MB로 KV 무료 한도(256MB) 대비 충분."""
    import requests as _requests

    kv_url = os.environ.get('KV_REST_API_URL', '').strip()
    kv_token = os.environ.get('KV_REST_API_TOKEN', '').strip()
    if not kv_url or not kv_token:
        return  # 로컬 실행 — KV 비활성

    # 모드별 키 일자 표기
    if mode == 'monthly':
        key_date = row_date.strftime('%Y-%m')
    else:
        key_date = row_date.strftime('%Y-%m-%d')
    ttl_seconds = 0  # 무제한

    payloads = [
        (f'metrics:channel:{mode}:{key_date}', r.get('채널_breakdown', [])),
        (f'metrics:assignee:{mode}:{key_date}', r.get('담당자_breakdown', [])),
        (f'metrics:page:{mode}:{key_date}', r.get('페이지_breakdown', [])),
    ]

    headers = {
        'Authorization': f'Bearer {kv_token}',
        'Content-Type': 'application/json',
    }
    for key, value in payloads:
        body = ['SET', key, json.dumps(value, ensure_ascii=False)]
        if ttl_seconds > 0:
            body += ['EX', ttl_seconds]
        resp = _requests.post(kv_url, headers=headers, json=body, timeout=15)
        if not resp.ok:
            print(f"[KV] {key} 저장 실패: {resp.status_code} {resp.text}")
            continue
        ttl_label = f"TTL {ttl_seconds // 86400}일" if ttl_seconds > 0 else "TTL 무제한"
        print(f"[KV] {key} 저장 ({ttl_label}, {len(value)}개 항목)")


def _push_range(mode, start_date, end_date, row_date):
    """기간 지표를 계산해 mode에 해당하는 시트 3종에 기록.
    row_date = 시트의 A열 정렬 기준 일자(일간=target, 주간=종료일=월요일, 월간=월 1일).
    표시 문자열은 _format_period_label로 생성하여 A열에 기록."""
    leads, hist, memo_dates = cm.load_data()
    r = cm.compute_range(start_date, end_date, leads, hist, memo_dates)

    sheets = SHEETS_BY_MODE[mode]
    display_str = _format_period_label(mode, start_date, end_date)
    service = get_sheets_service()

    push_total_sheet(service, row_date, r, sheet_name=sheets['total'], display_str=display_str)
    push_channel_sheet(service, row_date, r, sheet_name=sheets['channel'], display_str=display_str)
    push_assignee_sheet(service, row_date, r, sheet_name=sheets['assignee'], display_str=display_str)

    # KV 저장 (일간/주간/월간 모두)
    push_to_kv(mode, row_date, r)


def push_daily(target_date):
    """일간: target_date 하루치."""
    _push_range('daily', target_date, target_date, target_date)


def push_weekly(base_date):
    """주간: 저번주 화요일~금주 월요일(=base_date 기준 종료일). 행 일자 = 종료일(월요일)."""
    days_since_mon = base_date.weekday()  # 월=0
    end = base_date - timedelta(days=days_since_mon)
    start = end - timedelta(days=6)
    print(f"[주간] 집계 기간: {start} ~ {end}, 행 일자: {end}")
    _push_range('weekly', start, end, end)


def push_monthly(target_ym):
    """월간: target_ym('YYYY-MM') 1일~말일. 행 일자 = 해당 월 1일."""
    y, m = map(int, target_ym.split('-'))
    start = date(y, m, 1)
    if m == 12:
        end = date(y + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(y, m + 1, 1) - timedelta(days=1)
    print(f"[월간] 집계 기간: {start} ~ {end}, 행 일자: {start}")
    _push_range('monthly', start, end, start)


def main():
    args = sys.argv[1:]
    if args and args[0] == '--weekly':
        if len(args) < 2:
            print("Usage: push_to_sheets.py --weekly YYYY-MM-DD")
            sys.exit(1)
        base = date.fromisoformat(args[1])
        push_weekly(base)
    elif args and args[0] == '--monthly':
        if len(args) < 2:
            print("Usage: push_to_sheets.py --monthly YYYY-MM")
            sys.exit(1)
        push_monthly(args[1])
    elif args:
        target = date.fromisoformat(args[0])
        push_daily(target)
    else:
        target = datetime.now(KST).date()
        push_daily(target)


if __name__ == '__main__':
    main()
