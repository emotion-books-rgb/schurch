// ========================================
// 설정: 아래 두 값을 실제 값으로 교체하세요
// ========================================

// 1. Google Apps Script 웹앱 URL (신청 폼 → 시트 저장)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoxXuhdSqi5MqrVdnX8rdXDIz9BtBRu8eqb7JKHGIANVuwoMiFRrCVXbWmGjIjm2DnDw/exec';

// 2. 구글 시트 ID (현황 조회용 — 시트를 "링크 있는 사용자" 공개로 설정 필요)
const SHEET_ID = '18HjSR5OmfOJQS8LFDPmS5Ub4H2hNeU9s2tmZZr5OAEQ';
const SHEET_NAME = '신청목록';

// ========================================
// 신청 폼 처리
// ========================================
const bookForm = document.getElementById('bookForm');

if (bookForm) {
  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const successMsg = document.getElementById('successMsg');
    const errorMsg = document.getElementById('errorMsg');

    // 버튼 비활성화
    submitBtn.disabled = true;
    submitBtn.textContent = '신청 중...';
    successMsg.classList.add('hidden');
    errorMsg.classList.add('hidden');

    // 폼 데이터 수집
    const data = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      department: document.getElementById('department').value,
      bookTitle: document.getElementById('bookTitle').value.trim(),
      author: document.getElementById('author').value.trim(),
      publisher: document.getElementById('publisher').value.trim(),
      link: document.getElementById('link').value.trim(),
      reason: document.getElementById('reason').value.trim(),
      submittedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      // no-cors 모드에서는 응답 확인 불가 → 성공으로 처리
      bookForm.reset();
      bookForm.classList.add('hidden');
      successMsg.classList.remove('hidden');

    } catch (err) {
      console.error(err);
      errorMsg.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = '신청하기';
    }
  });
}

// ========================================
// 현황 조회 (status.html)
// ========================================
const tableBody = document.getElementById('tableBody');

if (tableBody) {
  let allData = [];

  // 구글 시트 공개 CSV로 불러오기
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

  fetch(csvUrl)
    .then(res => res.text())
    .then(csv => {
      allData = parseCSV(csv);
      document.getElementById('loading').classList.add('hidden');
      renderTable(allData, '전체');
    })
    .catch(err => {
      console.error(err);
      document.getElementById('loading').textContent = '데이터를 불러오지 못했습니다.';
    });

  // 필터 버튼
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTable(allData, btn.dataset.status);
    });
  });
}

// CSV 파싱
function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (values[i] || '').trim());
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// 테이블 렌더링
function renderTable(data, statusFilter) {
  const tableWrap = document.getElementById('tableWrap');
  const emptyMsg = document.getElementById('emptyMsg');

  const filtered = statusFilter === '전체'
    ? data
    : data.filter(row => row['상태'] === statusFilter);

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    tableWrap.classList.add('hidden');
    emptyMsg.classList.remove('hidden');
    return;
  }

  tableWrap.classList.remove('hidden');
  emptyMsg.classList.add('hidden');

  filtered.forEach((row, i) => {
    const tr = document.createElement('tr');
    const status = row['상태'] || '신청중';
    tr.innerHTML = `
      <td>${filtered.length - i}</td>
      <td>${row['신청일'] || ''}</td>
      <td><strong>${row['도서명'] || ''}</strong></td>
      <td>${row['저자'] || ''}</td>
      <td>${row['부서'] || ''}</td>
      <td><span class="badge badge-${status}">${status}</span></td>
      <td>${row['처리일'] || '-'}</td>
    `;
    tableBody.appendChild(tr);
  });
}
