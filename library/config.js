// ========================================
// 도서관 시스템 설정
// ========================================

const CONFIG = {
  SHEET_ID: '1TLzXn5xCCWaYQoe7_ylqAULPwzJA6QLVkucQQpZZSR4',
  APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE',
  SHEETS: {
    BOOKS: '도서목록',
    LOANS: '대출관리',
    MEMBERS: '회원목록'
  },
  CATEGORIES: [
    { code: '신', name: '신앙생활' },
    { code: '성', name: '성경공부' },
    { code: '영', name: '영성' },
    { code: '복', name: '복음' },
    { code: '양', name: '교양' },
    { code: '선', name: '선교' },
    { code: '사', name: '교회사' },
    { code: '청', name: '청소년' },
    { code: '가', name: '가정' },
    { code: '교', name: '교리' }
  ]
};
