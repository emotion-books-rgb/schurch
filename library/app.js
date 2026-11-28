// ===== 유틸리티 =====
function csvToArray(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseCsvLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

function formatDate(str) {
  if (!str) return '-';
  return str.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') || str;
}

function today() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function todayFormatted() {
  return new Date().toISOString().slice(0, 10);
}

function daysLeft(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((due - now) / 86400000);
}

function getCategoryName(code) {
  const cat = CONFIG.CATEGORIES.find(c => c.code === code);
  return cat ? cat.name : code;
}

function showTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['tab-loan', 'tab-add', 'tab-edit', 'tab-status'].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.classList.toggle('hidden', t !== id);
  });
  if (id === 'tab-status') loadStatusTab();
}

// ===== 구글 시트 CSV 읽기 =====
async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('시트 로드 실패');
  const text = await res.text();
  return csvToArray(text);
}

// ===== 도서 목록 (index.html) =====
let allBooks = [];

async function loadBooks() {
  const container = document.getElementById('booksContainer');
  try {
    allBooks = await fetchSheet(CONFIG.SHEETS.BOOKS);
    renderStats(allBooks);
    buildCategoryFilter(allBooks);
    renderBooks(allBooks);
  } catch (e) {
    if (container) container.innerHTML = '<div class="empty">도서 목록을 불러올 수 없습니다.<br>잠시 후 다시 시도해주세요.</div>';
  }
}

function renderStats(books) {
  const total = document.getElementById('totalBooks');
  const avail = document.getElementById('availableBooks');
  const loaned = document.getElementById('loanedBooks');
  if (!total) return;
  const available = books.filter(b => b['상태'] === '대출가능').length;
  total.textContent = books.length;
  avail.textContent = available;
  loaned.textContent = books.length - available;
}

function buildCategoryFilter(books) {
  const bar = document.getElementById('categoryFilter');
  if (!bar) return;
  const codes = [...new Set(books.map(b => b['분류코드']).filter(Boolean))];
  codes.sort().forEach(code => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = `${code} ${getCategoryName(code)}`;
    btn.onclick = function() { filterCategory(code, this); };
    bar.appendChild(btn);
  });
}

function filterCategory(code, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const keyword = document.getElementById('searchInput')?.value?.trim() || '';
  let filtered = allBooks;
  if (code !== 'all') filtered = filtered.filter(b => b['분류코드'] === code);
  if (keyword) filtered = filtered.filter(b =>
    (b['도서명'] || '').includes(keyword) ||
    (b['저자'] || '').includes(keyword) ||
    (b['출판사'] || '').includes(keyword)
  );
  renderBooks(filtered);
}

function searchBooks() {
  const keyword = document.getElementById('searchInput')?.value?.trim() || '';
  const activeBtn = document.querySelector('.filter-btn.active');
  const code = activeBtn?.onclick?.toString().includes("'all'") ? 'all'
    : activeBtn?.textContent?.split(' ')[0] || 'all';
  let filtered = allBooks;
  if (code !== 'all') filtered = filtered.filter(b => b['분류코드'] === code);
  if (keyword) filtered = filtered.filter(b =>
    (b['도서명'] || '').includes(keyword) ||
    (b['저자'] || '').includes(keyword) ||
    (b['출판사'] || '').includes(keyword)
  );
  renderBooks(filtered);
}

function renderBooks(books) {
  const container = document.getElementById('booksContainer');
  if (!container) return;
  if (!books.length) {
    container.innerHTML = '<div class="empty">검색 결과가 없습니다.</div>';
    return;
  }
  container.innerHTML = `<div class="books-grid">${books.map(b => bookCard(b)).join('')}</div>`;
}

function bookCard(b) {
  const avail = b['상태'] === '대출가능';
  const badgeClass = avail ? 'badge-available' : 'badge-loaned';
  const badgeText = avail ? '대출 가능' : '대출 중';
  return `<div class="book-card" onclick="openLoanModal(${JSON.stringify(b).replace(/"/g, '&quot;')})">
    <div class="book-call">${b['청구기호'] || ''}</div>
    <div class="book-title">${b['도서명'] || ''}</div>
    <div class="book-author">${b['저자'] || ''} ${b['출판사'] ? '· ' + b['출판사'] : ''}</div>
    <div class="book-meta">
      <span class="book-category">${getCategoryName(b['분류코드'])}</span>
      <span class="status-badge ${badgeClass}">${badgeText}</span>
    </div>
  </div>`;
}

// ===== 대출 신청 모달 =====
let currentBook = null;

function openLoanModal(book) {
  currentBook = book;
  document.getElementById('loanModal').style.display = 'block';
  document.getElementById('modalBookInfo').innerHTML =
    `<strong>${book['도서명']}</strong><br>저자: ${book['저자'] || '-'} | 청구기호: ${book['청구기호'] || '-'}<br>상태: <span class="status-badge ${book['상태'] === '대출가능' ? 'badge-available' : 'badge-loaned'}">${book['상태'] || '-'}</span>`;
  document.getElementById('loanMsg').innerHTML = '';
  if (book['상태'] !== '대출가능') {
    document.getElementById('loanMsg').innerHTML = '<div class="msg-error">현재 대출 중인 도서입니다.</div>';
    document.getElementById('loanSubmitBtn').disabled = true;
  } else {
    document.getElementById('loanSubmitBtn').disabled = false;
  }
}

function closeModal() {
  document.getElementById('loanModal').style.display = 'none';
  currentBook = null;
}

async function submitLoan() {
  const name = document.getElementById('loanName').value.trim();
  const phone = document.getElementById('loanPhone').value.trim();
  const dept = document.getElementById('loanDept').value;
  if (!name || !phone) {
    document.getElementById('loanMsg').innerHTML = '<div class="msg-error">이름과 연락처를 입력해주세요.</div>';
    return;
  }
  const btn = document.getElementById('loanSubmitBtn');
  btn.disabled = true;
  btn.textContent = '처리 중...';
  const data = {
    action: 'loan',
    청구기호: currentBook['청구기호'],
    도서명: currentBook['도서명'],
    이름: name,
    연락처: phone,
    부서: dept,
    대출일: today(),
    반납예정일: (() => {
      const d = new Date(); d.setDate(d.getDate() + 14);
      return d.toISOString().slice(0,10).replace(/-/g,'');
    })()
  };
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    document.getElementById('loanMsg').innerHTML = '<div class="msg-success">대출 신청이 완료되었습니다! 담당자 확인 후 처리됩니다.</div>';
    btn.textContent = '완료';
  } catch (e) {
    document.getElementById('loanMsg').innerHTML = '<div class="msg-error">오류가 발생했습니다. 다시 시도해주세요.</div>';
    btn.disabled = false;
    btn.textContent = '대출 신청';
  }
}

// ===== 내 대출현황 (mybooks.html) =====
async function searchMyBooks() {
  const phone = document.getElementById('searchPhone').value.trim();
  if (!phone) return alert('연락처를 입력해주세요.');
  document.getElementById('resultArea')?.classList.add('hidden');
  document.getElementById('notFoundMsg')?.classList.add('hidden');
  try {
    const loans = await fetchSheet(CONFIG.SHEETS.LOANS);
    const mine = loans.filter(r => (r['연락처'] || '').replace(/-/g,'') === phone.replace(/-/g,''));
    if (!mine.length) {
      document.getElementById('notFoundMsg')?.classList.remove('hidden');
      return;
    }
    const active = mine.filter(r => r['상태'] === '대출중' || r['상태'] === '대출신청');
    const history = mine.filter(r => r['상태'] === '반납완료');
    const overdue = active.filter(r => daysLeft(r['반납예정일']) < 0);

    document.getElementById('myLoanCount').textContent = active.length;
    document.getElementById('myOverdueCount').textContent = overdue.length;
    document.getElementById('myHistoryCount').textContent = history.length;

    // 대출 중
    const activeBody = document.getElementById('activeLoansBody');
    if (activeBody) {
      activeBody.innerHTML = active.length ? active.map(r => {
        const days = daysLeft(r['반납예정일']);
        const overdueCls = days !== null && days < 0 ? 'color:#e74c3c;font-weight:600' : '';
        const dueText = days !== null ? (days < 0 ? `${Math.abs(days)}일 연체` : `${days}일 남음`) : '-';
        return `<tr>
          <td>${r['도서명'] || '-'}</td>
          <td style="font-family:monospace">${r['청구기호'] || '-'}</td>
          <td>${formatDate(r['대출일'])}</td>
          <td>${formatDate(r['반납예정일'])}</td>
          <td style="${overdueCls}">${dueText}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="5" class="empty">대출 중인 도서가 없습니다.</td></tr>';
    }

    // 이력
    const histBody = document.getElementById('historyBody');
    if (histBody) {
      histBody.innerHTML = history.length ? history.map(r => `<tr>
        <td>${r['도서명'] || '-'}</td>
        <td>${formatDate(r['대출일'])}</td>
        <td>${formatDate(r['반납일'])}</td>
      </tr>`).join('') : '<tr><td colspan="3" class="empty">대출 이력이 없습니다.</td></tr>';
    }

    document.getElementById('resultArea')?.classList.remove('hidden');
  } catch (e) {
    alert('조회 중 오류가 발생했습니다.');
  }
}

// ===== 관리자 (admin.html) =====
let adminBooks = [];
let adminLoans = [];

async function loadAdminData() {
  try {
    [adminBooks, adminLoans] = await Promise.all([
      fetchSheet(CONFIG.SHEETS.BOOKS),
      fetchSheet(CONFIG.SHEETS.LOANS)
    ]);
    renderPendingLoans();
    renderActiveLoansAdmin();
  } catch (e) {
    console.error('관리자 데이터 로드 오류', e);
  }
}

function renderPendingLoans() {
  const el = document.getElementById('pendingLoans');
  if (!el) return;
  const pending = adminLoans.filter(r => r['상태'] === '대출신청');
  if (!pending.length) { el.innerHTML = '<div class="empty">처리 대기 중인 신청이 없습니다.</div>'; return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>신청일</th><th>도서명</th><th>청구기호</th><th>신청자</th><th>연락처</th><th>처리</th></tr></thead>
    <tbody>${pending.map((r, i) => `<tr>
      <td>${formatDate(r['대출일'])}</td>
      <td>${r['도서명']}</td>
      <td style="font-family:monospace">${r['청구기호'] || '-'}</td>
      <td>${r['이름']}</td>
      <td>${r['연락처']}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="approveLoan('${r['번호']}')">승인</button>
        <button class="btn btn-danger btn-sm" onclick="rejectLoan('${r['번호']}')">반려</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderActiveLoansAdmin() {
  const tbody = document.getElementById('activeLoansAdmin');
  if (!tbody) return;
  const active = adminLoans.filter(r => r['상태'] === '대출중');
  if (!active.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">대출 중인 도서가 없습니다.</td></tr>'; return; }
  tbody.innerHTML = active.map(r => {
    const days = daysLeft(r['반납예정일']);
    const overdueCls = days !== null && days < 0 ? 'style="color:#e74c3c;font-weight:600"' : '';
    return `<tr>
      <td style="font-family:monospace">${r['청구기호'] || '-'}</td>
      <td>${r['도서명']}</td>
      <td>${r['이름']}</td>
      <td>${r['연락처']}</td>
      <td>${formatDate(r['대출일'])}</td>
      <td ${overdueCls}>${formatDate(r['반납예정일'])}</td>
      <td><button class="btn btn-primary btn-sm" onclick="returnBook('${r['번호']}')">반납처리</button></td>
    </tr>`;
  }).join('');
}

async function approveLoan(loanId) {
  if (!confirm('대출을 승인하시겠습니까?')) return;
  await adminPost({ action: 'approveLoan', 번호: loanId, 처리일: today() });
}

async function rejectLoan(loanId) {
  if (!confirm('대출 신청을 반려하시겠습니까?')) return;
  await adminPost({ action: 'rejectLoan', 번호: loanId, 처리일: today() });
}

async function returnBook(loanId) {
  if (!confirm('반납 처리하시겠습니까?')) return;
  await adminPost({ action: 'returnBook', 번호: loanId, 반납일: today() });
}

async function adminPost(data) {
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    alert('처리되었습니다. 잠시 후 새로고침하면 반영됩니다.');
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    alert('오류가 발생했습니다.');
  }
}

// ===== 도서 등록 (admin.html) =====
function onCatChange() {
  // 분류 바뀌면 일련번호 초기화 후 자동추천
  const serialEl = document.getElementById('bookSerial');
  if (serialEl) serialEl.value = '';
  const callNumEl = document.getElementById('bookCallNum');
  if (callNumEl) callNumEl.value = '';
  document.getElementById('addBookMsg').innerHTML = '';
  const cat = document.getElementById('bookCat')?.value || '';
  if (cat) suggestNextSerial(cat);
}

function updateCallNum() {
  const cat = document.getElementById('bookCat')?.value || '';
  const author = document.getElementById('bookAuthorCode')?.value || '';
  const serial = document.getElementById('bookSerial')?.value || '';
  const callNum = document.getElementById('bookCallNum');
  if (callNum) callNum.value = cat && serial ? `${cat}/${serial.padStart(3,'0')}${author ? '/' + author : ''}` : '';
}

async function suggestNextSerial(cat) {
  try {
    const books = adminBooks.length ? adminBooks : await fetchSheet(CONFIG.SHEETS.BOOKS);
    const prefix = `${cat}/`;
    const nums = books
      .map(b => b['청구기호'] || '')
      .filter(c => c.startsWith(prefix))
      .map(c => { const parts = c.split('/'); return parseInt(parts[1]) || 0; });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const serialEl = document.getElementById('bookSerial');
    if (serialEl && !serialEl.value) {
      serialEl.value = String(next).padStart(3, '0');
      updateCallNum();
    }
  } catch (e) { /* 무시 */ }
}

async function addBook() {
  const title = document.getElementById('bookTitle').value.trim();
  const author = document.getElementById('bookAuthor').value.trim();
  const callNum = document.getElementById('bookCallNum').value.trim();
  const cat = document.getElementById('bookCat').value;
  if (!title || !author || !callNum) {
    document.getElementById('addBookMsg').innerHTML = '<div class="msg-error">분류, 저자 첫 성, 일련번호, 도서명, 저자를 입력해주세요.</div>';
    return;
  }

  // 중복 체크
  document.getElementById('addBookMsg').innerHTML = '<div style="padding:8px 12px;background:#fff3cd;border-radius:6px;font-size:0.85rem;">🔍 중복 확인 중...</div>';
  try {
    const books = await fetchSheet(CONFIG.SHEETS.BOOKS);
    const dup = books.find(b => (b['청구기호'] || '').trim() === callNum);
    if (dup) {
      document.getElementById('addBookMsg').innerHTML =
        `<div class="msg-error">⚠️ 청구기호 <strong>${callNum}</strong> 가 이미 존재합니다.<br>도서명: ${dup['도서명']} / 저자: ${dup['저자']}</div>`;
      return;
    }
  } catch (e) { /* 중복체크 실패시 그냥 진행 */ }

  const btn = document.getElementById('addBookBtn');
  btn.disabled = true; btn.textContent = '등록 중...';
  const data = {
    action: 'addBook',
    청구기호: callNum,
    분류코드: cat,
    도서명: title,
    저자: author,
    출판사: document.getElementById('bookPublisher').value.trim(),
    출판연도: document.getElementById('bookYear').value.trim(),
    구입일: document.getElementById('bookBuyDate').value.replace(/-/g,''),
    메모: document.getElementById('bookMemo').value.trim(),
    상태: '대출가능',
    등록일: today()
  };
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    document.getElementById('addBookMsg').innerHTML = '<div class="msg-success">✅ 도서가 등록되었습니다!</div>';
    ['bookTitle','bookAuthor','bookPublisher','bookYear','bookBuyDate','bookMemo','bookAuthorCode','bookSerial'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('bookCat').value = '';
    document.getElementById('bookCallNum').value = '';
    btn.disabled = false; btn.textContent = '도서 등록';
  } catch (e) {
    document.getElementById('addBookMsg').innerHTML = '<div class="msg-error">오류가 발생했습니다.</div>';
    btn.disabled = false; btn.textContent = '도서 등록';
  }
}

// ===== 도서 변경 탭 =====
let editTargetBook = null; // 현재 선택된 수정 대상 도서

function searchEditBook() {
  const q = document.getElementById('editSearch').value.trim().toLowerCase();
  const resultEl = document.getElementById('editSearchResult');
  const formEl = document.getElementById('editForm');
  if (!q) { resultEl.innerHTML = ''; formEl.style.display = 'none'; return; }

  const matched = adminBooks.filter(b =>
    (b['청구기호'] || '').toLowerCase().includes(q) ||
    (b['도서명'] || '').toLowerCase().includes(q)
  );

  if (!matched.length) {
    resultEl.innerHTML = '<div class="msg-error">검색 결과가 없습니다. 도서 목록을 먼저 불러와 주세요.</div>';
    formEl.style.display = 'none';
    return;
  }

  resultEl.innerHTML = matched.slice(0, 10).map(b =>
    `<div style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;margin:4px 0;cursor:pointer;background:#fff;"
         onclick="selectEditBook('${(b['청구기호']||'').replace(/'/g,"\\'")}')">
      <strong>${b['청구기호']}</strong> — ${b['도서명']} <span style="color:#888;font-size:0.85rem;">(${b['저자']||''})</span>
    </div>`
  ).join('');
}

function selectEditBook(callNum) {
  const book = adminBooks.find(b => (b['청구기호']||'').trim() === callNum.trim());
  if (!book) return;
  editTargetBook = book;

  document.getElementById('editSelectedCallNum').textContent = book['청구기호'];
  document.getElementById('editSelectedTitle').textContent = book['도서명'];
  document.getElementById('editCallNum').value = book['청구기호'] || '';
  document.getElementById('editTitle').value = book['도서명'] || '';
  document.getElementById('editAuthor').value = book['저자'] || '';
  document.getElementById('editPublisher').value = book['출판사'] || '';
  document.getElementById('editYear').value = book['출판연도'] || '';
  document.getElementById('editMemo').value = book['메모'] || '';

  // 분류 선택
  const catSel = document.getElementById('editCat');
  catSel.innerHTML = '<option value="">선택</option>';
  CONFIG.CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code; opt.textContent = `${c.code} ${c.name}`;
    if (c.code === book['분류코드']) opt.selected = true;
    catSel.appendChild(opt);
  });

  // 상태 선택
  const statusSel = document.getElementById('editStatus');
  for (const opt of statusSel.options) {
    opt.selected = opt.value === book['상태'];
  }

  document.getElementById('editSearchResult').innerHTML = '';
  document.getElementById('editSearch').value = '';
  document.getElementById('editForm').style.display = 'block';
  document.getElementById('editBookMsg').innerHTML = '';
}

async function updateBook() {
  if (!editTargetBook) return;
  const btn = document.getElementById('editBookBtn');
  btn.disabled = true; btn.textContent = '저장 중...';

  const newCallNum = document.getElementById('editCallNum').value.trim();
  const data = {
    action: 'updateBook',
    청구기호: editTargetBook['청구기호'],
    새청구기호: newCallNum,
    도서명: document.getElementById('editTitle').value.trim(),
    저자: document.getElementById('editAuthor').value.trim(),
    출판사: document.getElementById('editPublisher').value.trim(),
    출판연도: document.getElementById('editYear').value.trim(),
    분류코드: document.getElementById('editCat').value,
    상태: document.getElementById('editStatus').value,
    메모: document.getElementById('editMemo').value.trim()
  };

  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    document.getElementById('editBookMsg').innerHTML = '<div class="msg-success">✅ 도서 정보가 변경되었습니다!</div>';
    // adminBooks 캐시 업데이트
    const idx = adminBooks.findIndex(b => b['청구기호'] === editTargetBook['청구기호']);
    if (idx >= 0) {
      adminBooks[idx] = { ...adminBooks[idx], ...data, 청구기호: newCallNum || editTargetBook['청구기호'] };
    }
    editTargetBook = null;
    document.getElementById('editForm').style.display = 'none';
  } catch (e) {
    document.getElementById('editBookMsg').innerHTML = '<div class="msg-error">오류가 발생했습니다.</div>';
  }
  btn.disabled = false; btn.textContent = '변경 저장';
}

// ===== 현황 탭 =====
async function loadStatusTab() {
  try {
    if (!adminBooks.length) adminBooks = await fetchSheet(CONFIG.SHEETS.BOOKS);
    if (!adminLoans.length) adminLoans = await fetchSheet(CONFIG.SHEETS.LOANS);
    const avail = adminBooks.filter(b => b['상태'] === '대출가능').length;
    const loaned = adminBooks.filter(b => b['상태'] !== '대출가능').length;
    const overdue = adminLoans.filter(r => r['상태'] === '대출중' && daysLeft(r['반납예정일']) < 0).length;
    document.getElementById('sTotalBooks').textContent = adminBooks.length;
    document.getElementById('sAvailable').textContent = avail;
    document.getElementById('sLoaned').textContent = loaned;
    document.getElementById('sOverdue').textContent = overdue;
    const tbody = document.getElementById('allBooksAdmin');
    if (tbody) {
      tbody.innerHTML = adminBooks.map(b => `<tr>
        <td style="font-family:monospace">${b['청구기호']}</td>
        <td>${b['도서명']}</td>
        <td>${b['저자']}</td>
        <td>${getCategoryName(b['분류코드'])}</td>
        <td><span class="status-badge ${b['상태'] === '대출가능' ? 'badge-available' : 'badge-loaned'}">${b['상태']}</span></td>
        <td>${formatDate(b['등록일'])}</td>
      </tr>`).join('');
    }
  } catch (e) {
    console.error('현황 로드 오류', e);
  }
}
