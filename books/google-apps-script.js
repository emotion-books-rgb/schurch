// ========================================
// Google Apps Script 코드
// 구글 시트에 붙여넣어 사용하세요
// ========================================

const SHEET_NAME = '신청목록';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
                    .getSheetByName(SHEET_NAME);

    // 첫 행이 비어있으면 헤더 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        '번호', '신청일', '이름', '연락처', '부서',
        '도서명', '저자', '출판사', '구매링크', '신청사유',
        '상태', '처리일', '비고'
      ]);
    }

    const nextNum = sheet.getLastRow(); // 헤더 포함이므로 그대로 번호로 사용

    sheet.appendRow([
      nextNum,                 // 번호
      data.submittedAt,        // 신청일
      data.name,               // 이름
      data.phone,              // 연락처
      data.department,         // 부서
      data.bookTitle,          // 도서명
      data.author,             // 저자
      data.publisher,          // 출판사
      data.link,               // 구매링크
      data.reason,             // 신청사유
      '신청중',                 // 상태 (기본값)
      '',                      // 처리일
      ''                       // 비고
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 테스트용
function doGet(e) {
  return ContentService
    .createTextOutput('Apps Script 연결 성공!')
    .setMimeType(ContentService.MimeType.TEXT);
}
