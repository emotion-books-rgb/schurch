// ========================================================
// 서대문교회 도서관 관리 - Google Apps Script
// 이 코드를 Google Apps Script (script.google.com) 에 붙여넣기
// ========================================================

const SPREADSHEET_ID = '1TLzXn5xCCWaYQoe7_ylqAULPwzJA6QLVkucQQpZZSR4';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'addBook') return addBook(data);
    if (action === 'loan') return requestLoan(data);
    if (action === 'approveLoan') return approveLoan(data);
    if (action === 'rejectLoan') return rejectLoan(data);
    if (action === 'returnBook') return returnBook(data);
    if (action === 'updateBook') return updateBook(data);

    return ok('unknown action');
  } catch (err) {
    return error(err.toString());
  }
}

// ── 도서 등록 ──
function addBook(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = getOrCreateSheet(ss, '도서목록', [
    '청구기호','분류코드','도서명','저자','출판사','출판연도','구입일','메모','상태','등록일'
  ]);
  sh.appendRow([
    data.청구기호, data.분류코드, data.도서명, data.저자,
    data.출판사||'', data.출판연도||'', data.구입일||'',
    data.메모||'', '대출가능', data.등록일 || today()
  ]);
  return ok('도서 등록 완료');
}

// ── 도서 정보 변경 ──
function updateBook(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName('도서목록');
  if (!sh) return error('도서목록 시트 없음');

  const rows = sh.getDataRange().getValues();
  const headers = rows[0]; // ['청구기호','분류코드','도서명','저자','출판사','출판연도','구입일','메모','상태','등록일']
  const colIdx = (name) => headers.indexOf(name);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.청구기호).trim()) {
      const fields = {
        '도서명': data.도서명,
        '저자': data.저자,
        '출판사': data.출판사,
        '출판연도': data.출판연도,
        '분류코드': data.분류코드,
        '상태': data.상태,
        '메모': data.메모
      };
      for (const [field, value] of Object.entries(fields)) {
        const col = colIdx(field);
        if (col >= 0 && value !== undefined && value !== null) {
          sh.getRange(i + 1, col + 1).setValue(value);
        }
      }
      return ok('도서 정보 변경 완료');
    }
  }
  return error('해당 청구기호를 찾을 수 없습니다: ' + data.청구기호);
}

// ── 대출 신청 ──
function requestLoan(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const loanSh = getOrCreateSheet(ss, '대출관리', [
    '번호','대출일','이름','연락처','부서','청구기호','도서명','반납예정일','상태','반납일','처리일','비고'
  ]);
  const nextNum = getNextNum(loanSh);
  loanSh.appendRow([
    nextNum, data.대출일, data.이름, data.연락처, data.부서||'',
    data.청구기호, data.도서명, data.반납예정일, '대출신청',
    '', '', ''
  ]);
  return ok('대출 신청 완료');
}

// ── 대출 승인 ──
function approveLoan(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const loanSh = ss.getSheetByName('대출관리');
  const bookSh = ss.getSheetByName('도서목록');
  if (!loanSh) return error('대출관리 시트 없음');

  // 대출관리 시트 업데이트
  const loanRows = loanSh.getDataRange().getValues();
  for (let i = 1; i < loanRows.length; i++) {
    if (String(loanRows[i][0]) === String(data.번호)) {
      loanSh.getRange(i + 1, 9).setValue('대출중');       // 상태
      loanSh.getRange(i + 1, 11).setValue(data.처리일);   // 처리일
      const callNum = loanRows[i][5]; // 청구기호

      // 도서목록 상태 → 대출중
      if (bookSh) {
        const bookRows = bookSh.getDataRange().getValues();
        for (let j = 1; j < bookRows.length; j++) {
          if (bookRows[j][0] === callNum) {
            bookSh.getRange(j + 1, 9).setValue('대출중');
            break;
          }
        }
      }
      break;
    }
  }
  return ok('대출 승인 완료');
}

// ── 대출 반려 ──
function rejectLoan(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const loanSh = ss.getSheetByName('대출관리');
  if (!loanSh) return error('대출관리 시트 없음');
  const loanRows = loanSh.getDataRange().getValues();
  for (let i = 1; i < loanRows.length; i++) {
    if (String(loanRows[i][0]) === String(data.번호)) {
      loanSh.getRange(i + 1, 9).setValue('반려');
      loanSh.getRange(i + 1, 11).setValue(data.처리일);
      break;
    }
  }
  return ok('반려 처리 완료');
}

// ── 반납 처리 ──
function returnBook(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const loanSh = ss.getSheetByName('대출관리');
  const bookSh = ss.getSheetByName('도서목록');
  if (!loanSh) return error('대출관리 시트 없음');
  const loanRows = loanSh.getDataRange().getValues();
  for (let i = 1; i < loanRows.length; i++) {
    if (String(loanRows[i][0]) === String(data.번호)) {
      loanSh.getRange(i + 1, 9).setValue('반납완료');   // 상태
      loanSh.getRange(i + 1, 10).setValue(data.반납일); // 반납일
      const callNum = loanRows[i][5];
      if (bookSh) {
        const bookRows = bookSh.getDataRange().getValues();
        for (let j = 1; j < bookRows.length; j++) {
          if (bookRows[j][0] === callNum) {
            bookSh.getRange(j + 1, 9).setValue('대출가능');
            break;
          }
        }
      }
      break;
    }
  }
  return ok('반납 처리 완료');
}

// ── 헬퍼 ──
function getOrCreateSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#3a5a3a').setFontColor('white');
  }
  return sh;
}

function getNextNum(sh) {
  const rows = sh.getLastRow();
  if (rows <= 1) return 1;
  const vals = sh.getRange(2, 1, rows - 1, 1).getValues();
  const nums = vals.map(r => parseInt(r[0]) || 0).filter(n => n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function today() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
}

function ok(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── CORS 허용 (GET 테스트용) ──
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: '도서관 API 정상' }))
    .setMimeType(ContentService.MimeType.JSON);
}
