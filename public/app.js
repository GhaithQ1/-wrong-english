const API = 'http://localhost:5000/api';

let currentTopicId = null;
let currentSection = 1; // 1 or 2
let skippedQuestions = new Set();
let currentTopicQuestions = []; // holds the full question data for hint access

// --- Helpers ---

function $(id) { return document.getElementById(id); }

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function token() { return localStorage.getItem('token'); }

async function req(method, path, body) {
  const opts = { method, headers: {} };
  const t = token();
  if (t) opts.headers['Authorization'] = 'Bearer ' + t;
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  return fetch(API + path, opts).then(r => r.json());
}

function out(data) {
  const el = $('output');
  el.textContent = JSON.stringify(data, null, 2);
  show(el);
}

// --- Auth ---

function updateAuthUI() {
  const t = token();
  if (t) {
    hide($('auth-screen'));
    show($('topics-screen'));
    show($('daily-section'));
    show($('traps-section'));
    show($('logout-btn'));
    refreshUser();
    loadTopics();
    loadDailyStatus();
    loadTraps(true);
  } else {
    show($('auth-screen'));
    hide($('topics-screen'));
    hide($('daily-section'));
    hide($('traps-section'));
    hide($('quiz-screen'));
    hide($('section-result-screen'));
    hide($('result-screen'));
    hide($('logout-btn'));
    hide($('user-bar'));
  }
}

async function register() {
  const name = $('auth-name').value.trim();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value.trim();
  if (!name || !email || !password) return $('auth-error').textContent = 'Fill all fields';
  const data = await req('POST', '/auth/register', { name, email, password });
  if (data.token) {
    localStorage.setItem('token', data.token);
    $('auth-error').textContent = '';
    updateAuthUI();
  } else {
    $('auth-error').textContent = data.message || 'Registration failed';
  }
}

async function login() {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value.trim();
  if (!email || !password) return $('auth-error').textContent = 'Fill email and password';
  const data = await req('POST', '/auth/login', { email, password });
  if (data.token) {
    localStorage.setItem('token', data.token);
    $('auth-error').textContent = '';
    updateAuthUI();
  } else {
    $('auth-error').textContent = data.message || 'Login failed';
  }
}

function logout() {
  localStorage.removeItem('token');
  currentTopicId = null;
  updateAuthUI();
}

async function refreshUser() {
  const data = await req('GET', '/auth/me');
  if (data.status === 'success') {
    const u = data.data;
    $('user-name').textContent = u.name;
    $('user-level').textContent = u.level;
    $('user-xp').textContent = u.xp;
    $('user-coins').textContent = u.coins;
    $('user-stars').textContent = u.stars;
    show($('user-bar'));
    if (u.role === 'admin') {
      show($('admin-link'));
    } else {
      hide($('admin-link'));
    }
  }
}

// --- Daily Login ---

const DAILY_REWARDS = [
  { day: 1, coins: 10, stars: 0 },
  { day: 2, coins: 12, stars: 0 },
  { day: 3, coins: 15, stars: 0 },
  { day: 4, coins: 18, stars: 0 },
  { day: 5, coins: 22, stars: 0 },
  { day: 6, coins: 26, stars: 0 },
  { day: 7, coins: 35, stars: 1 },
];

async function loadDailyStatus() {
  const data = await req('GET', '/daily/status');
  if (data.status !== 'success') return;
  const { streak, canClaim } = data.data;
  renderDailyGrid(streak, canClaim);
  $('daily-day-label').textContent = `Day ${streak || '-'} / 7`;
  const btn = $('daily-claim-btn');
  if (canClaim) {
    btn.disabled = false;
    btn.textContent = 'Claim Reward';
  } else {
    btn.disabled = true;
    btn.textContent = 'Claimed ✓';
  }
}

function renderDailyGrid(streak, canClaim) {
  const grid = $('daily-grid');
  grid.innerHTML = '';
  let highlightDay;
  if (canClaim) {
    highlightDay = streak === 0 ? 1 : (streak % 7) + 1;
  } else {
    highlightDay = streak;
  }
  DAILY_REWARDS.forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'daily-cell';
    if (!canClaim && r.day <= streak) cell.classList.add('claimed');
    else if (canClaim && streak > 0 && r.day <= streak) cell.classList.add('claimed');
    else if (r.day === highlightDay) cell.classList.add('current');
    else cell.classList.add('locked');
    cell.innerHTML = `
      <span class="day-num">${r.day}</span>
      <span class="day-reward">${r.coins}🪙${r.stars ? ' +1⭐' : ''}</span>`;
    grid.appendChild(cell);
  });
}

async function claimDaily() {
  const data = await req('POST', '/daily/claim');
  if (data.status !== 'success') { alert(data.message || 'Failed to claim'); return; }
  refreshUser();
  loadDailyStatus();
  $('daily-message').textContent = `+${data.data.reward.coins}🪙${data.data.reward.stars ? ' +' + data.data.reward.stars + '⭐' : ''}`;
  $('daily-message').classList.add('show');
  setTimeout(() => $('daily-message').classList.remove('show'), 3000);
}

// --- Traps ---

let showMine = true;
let currentDifficulty = '';

function diffBadge(d) {
  const colors = { easy: '#40c060', medium: '#f0c040', hard: '#e05050' };
  return `<span class="diff-badge" style="color:${colors[d] || '#888'};font-size:0.75rem;font-weight:600;margin-left:0.5rem;">${d || '?'}</span>`;
}

async function loadTraps(mine) {
  showMine = mine !== undefined ? mine : showMine;
  $('tab-my').classList.toggle('active', showMine);
  $('tab-all').classList.toggle('active', !showMine);

  const filterBar = $('trap-filter-bar');
  if (showMine === false) { filterBar.classList.remove('hidden'); } else { filterBar.classList.add('hidden'); }

  let url = '/traps?mine=' + showMine;
  if (currentDifficulty) url += '&difficulty=' + currentDifficulty;
  const data = await req('GET', url);
  if (data.status !== 'success') return;
  const container = $('traps-list');
  container.innerHTML = '';
  if (!data.data.length) {
    container.innerHTML = '<p style="color:#888;font-size:0.85rem;">No traps yet.</p>';
    return;
  }
  data.data.forEach(t => {
    const card = document.createElement('div');
    card.className = 'trap-card';
    const correctPct = t.totalAttempts > 0 ? Math.round(t.correctAttempts / t.totalAttempts * 100) : 0;
    card.innerHTML = `
      <div class="trap-head">
        <span class="trap-sentence">${escapeHtml(t.sentence)}${diffBadge(t.difficulty)}</span>
        ${t.hint ? `<span class="trap-hint">💡 ${escapeHtml(t.hint)}</span>` : ''}
      </div>
      <div class="trap-meta">
        ${showMine ? `
          <span>🔧 ${escapeHtml(t.correction)}</span>
          <span>${t.totalAttempts} attempts · ${correctPct}% correct</span>
          ${!t.rewardClaimed && t.totalAttempts > 0
            ? `<button class="btn sm" onclick="claimTrapReward('${t._id}')">Claim Reward</button>`
            : t.rewardClaimed ? '<span style="color:#40c060;">Claimed ✓</span>' : ''
          }
        ` : `
          <span>by ${t.creator?.name || 'unknown'}</span>
          <span>${t.totalAttempts} attempts</span>
          ${t.myAttempt
            ? `<span style="color:${t.myAttempt.correct ? '#40c060' : '#e05050'}">${t.myAttempt.correct ? '✅ Correct' : '❌ Wrong'}</span>`
            : `<button class="btn sm" onclick="attemptTrap('${t._id}', this)">حاول</button>`
          }
        `}
      </div>
      ${!showMine && !t.myAttempt ? `<div class="trap-attempt hidden"><input type="text" placeholder="Your correction..." /><button class="btn sm primary" onclick="submitAttempt('${t._id}', this)">Submit</button></div>` : ''}
    `;
    container.appendChild(card);
  });
}

function switchTrapTab(mine) {
  currentDifficulty = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === ''));
  loadTraps(mine);
}

function filterTraps(diff) {
  currentDifficulty = diff;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
  loadTraps(false);
}

function toggleCreateTrap() {
  const form = $('create-trap-form');
  form.classList.toggle('hidden');
}

async function submitTrap() {
  const sentence = $('trap-sentence').value.trim();
  const correction = $('trap-correction').value.trim();
  if (!sentence || !correction) return alert('Sentence and correction required');

  const msgEl = $('trap-validation-msg');
  const btn = $('trap-submit-btn');
  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';
  msgEl.style.display = 'none';

  const data = await req('POST', '/traps', { sentence, correction });
  btn.disabled = false;
  btn.textContent = 'Create Trap';

  if (data.status !== 'success') {
    if (data.refund) { refreshUser(); }
    msgEl.textContent = data.message || 'فشل إنشاء الفخ';
    msgEl.style.display = 'block';
    return;
  }
  msgEl.style.display = 'none';
  $('trap-sentence').value = '';
  $('trap-correction').value = '';
  $('create-trap-form').classList.add('hidden');
  refreshUser();
  loadTraps(showMine);
}

function attemptTrap(trapId, btn) {
  const card = btn.closest('.trap-card');
  const form = card.querySelector('.trap-attempt');
  form.classList.remove('hidden');
}

async function submitAttempt(trapId, btn) {
  const card = btn.closest('.trap-card');
  const input = card.querySelector('.trap-attempt input');
  const answer = input.value.trim();
  if (!answer) return alert('Enter your correction');
  const data = await req('POST', `/traps/${trapId}/attempt`, { answer });
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  refreshUser();
  loadTraps(false);
}

async function claimTrapReward(trapId) {
  if (!confirm('Claim reward for this trap?')) return;
  const data = await req('POST', `/traps/${trapId}/claim`);
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  refreshUser();
  loadTraps(true);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- Topics ---

async function loadTopics() {
  const data = await req('GET', '/topics');
  const container = $('topics-list');
  container.innerHTML = '';
  if (data.status !== 'success' || !data.data.length) {
    container.innerHTML = '<p style="color:#888;font-size:0.85rem;">No topics yet.</p>';
    return;
  }
  data.data.forEach(t => {
    const card = document.createElement('div');
    card.className = 'topic-card';

    if (!t.unlocked) {
      card.style.opacity = '0.5';
      card.innerHTML = `
        <span class="name">🔒 ${t.name}</span>
        <span class="status" style="color:#888;">
          ${t.unlockStars > 0 ? `<button class="unlock-btn" data-id="${t._id}">Unlock (${t.unlockStars}⭐)</button>` : 'Locked'}
        </span>`;
      const btn = card.querySelector('.unlock-btn');
      if (btn) btn.onclick = (e) => { e.stopPropagation(); unlockTopic(t._id, t.unlockStars); };
      container.appendChild(card);
      return;
    }

    let statusHtml = '<span class="pending">Not attempted</span>';
    const done = [];
    if (t.section1Done) done.push('S1');
    if (t.section2Done) done.push('S2');
    if (done.length === 2) statusHtml = '<span class="done">Complete</span>';
    else if (done.length === 1) statusHtml = `<span style="color:#f0c040;">Section ${done[0]} done</span>`;

    card.innerHTML = `
      <span class="name">${t.name}</span>
      <span class="status">${statusHtml}</span>`;
    card.onclick = () => startTopic(t._id);
    container.appendChild(card);
  });
}

async function unlockTopic(topicId, stars) {
  if (!confirm(`Spend ${stars}⭐ to unlock this topic?`)) return;
  const data = await req('POST', `/topics/${topicId}/unlock`);
  if (data.status !== 'success') { alert(data.message || 'Failed to unlock'); return; }
  refreshUser();
  loadTopics();
}

// --- Quiz Flow ---

async function startTopic(topicId) {
  const progress = await req('GET', `/topics/${topicId}/progress`);
  if (progress.status !== 'success') return out(progress);

  const p = progress.data;
  currentTopicId = topicId;

  if (p.completed) {
    showFinalResultFromProgress(topicId);
  } else if (p.section1.completed && !p.section2.completed) {
    showSection2();
  } else {
    showSection1();
  }
}

async function showSection1() {
  currentSection = 1;
  skippedQuestions = new Set();
  const data = await req('GET', `/topics/${currentTopicId}`);
  if (data.status !== 'success') return out(data);

  currentTopicQuestions = data.data.questions;
  $('quiz-title').textContent = data.data.name;
  $('quiz-section-label').textContent = 'Section 1 of 2';
  $('submit-section-btn').textContent = 'Submit Section 1';

  renderQuestions(data.data.questions.slice(0, 5), 0);

  hide($('topics-screen'));
  hide($('section-result-screen'));
  hide($('result-screen'));
  show($('quiz-screen'));
}

async function showSection2() {
  currentSection = 2;
  skippedQuestions = new Set();
  const data = await req('GET', `/topics/${currentTopicId}`);
  if (data.status !== 'success') return out(data);

  currentTopicQuestions = data.data.questions;
  $('quiz-title').textContent = data.data.name;
  $('quiz-section-label').textContent = 'Section 2 of 2';
  $('submit-section-btn').textContent = 'Submit Section 2';

  renderQuestions(data.data.questions.slice(5), 5);

  hide($('topics-screen'));
  hide($('section-result-screen'));
  hide($('result-screen'));
  show($('quiz-screen'));
}

function renderQuestions(questions, offset) {
  const container = $('questions-container');
  container.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  questions.forEach((q, i) => {
    const num = offset + i + 1;
    const realIdx = offset + i;
    const div = document.createElement('div');
    div.className = 'quiz-question';
    div.id = 'qblock-' + realIdx;
    div.innerHTML = `
      <div class="q-text">
        <span style="color:#f0c040;">${num}.</span> ${q.sentence}
        <span class="q-diff">[${q.difficulty}]</span>
      </div>
      <div class="q-actions">
        <button class="btn q-btn hint-btn" onclick="useHint(${realIdx})" title="Hint (10🪙)">💡</button>
        <button class="btn q-btn skip-btn" onclick="skipQuestion(${realIdx})" title="Skip (5🪙)">⏭️</button>
      </div>
      <div id="hint-${realIdx}" class="q-hint hidden"></div>
      <div class="choices" id="choices-${realIdx}">
        ${q.choices.map((c, j) => `
          <label>
            <input type="radio" name="q${num}" value="${j}" />
            <span>${letters[j]}. ${c}</span>
          </label>
        `).join('')}
      </div>`;
    container.appendChild(div);
  });
}

async function submitCurrentSection() {
  if (!currentTopicId) return;
  const offset = currentSection === 1 ? 0 : 5;
  const answers = [];

  for (let i = offset; i < offset + 5; i++) {
    if (skippedQuestions.has(i)) {
      answers.push({ questionIndex: i, skipped: true });
    } else {
      const sel = document.querySelector(`input[name="q${i + 1}"]:checked`);
      if (!sel) return alert('Answer all questions before submitting!');
      answers.push({ questionIndex: i, selectedIndex: parseInt(sel.value) });
    }
  }

  if (currentSection === 1) {
    const data = await req('POST', `/topics/${currentTopicId}/section1`, { answers });
    if (data.status !== 'success') return out(data);
    showSection1Result(data.data);
  } else {
    const data = await req('POST', `/topics/${currentTopicId}/section2`, { answers });
    if (data.status !== 'success') return out(data);
    showFinalResult(data.data);
  }
}

async function useHint(idx) {
  const data = await req('POST', `/topics/${currentTopicId}/hint`, { questionIndex: idx });
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  const el = $('hint-' + idx);
  el.textContent = '💡 ' + data.data.hint;
  el.classList.remove('hidden');
  refreshUser();
}

async function skipQuestion(idx) {
  if (skippedQuestions.has(idx)) return;
  const data = await req('POST', `/topics/${currentTopicId}/skip`);
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  skippedQuestions.add(idx);
  const block = $('qblock-' + idx);
  block.style.opacity = '0.4';
  const radios = block.querySelectorAll('input[type="radio"]');
  radios.forEach(r => r.disabled = true);
  refreshUser();
}

function showSection1Result(r) {
  hide($('quiz-screen'));
  const container = $('section-result-content');
  container.innerHTML = `
    <div class="result-section">
      <div class="result-row"><span>Score</span><span>${r.correct} / ${r.total}</span></div>
      <div class="result-row"><span>XP earned</span><span class="positive">+${r.rewards.xp} XP</span></div>
      <div class="result-row"><span>Coins earned</span><span class="positive">+${r.rewards.coins} 🪙</span></div>
      <div class="result-row"><span>Section bonus</span><span class="positive">+${r.bonus} 🪙</span></div>
    </div>`;
  show($('section-result-screen'));
  refreshUser();
}

function showFinalResult(r) {
  hide($('quiz-screen'));
  hide($('section-result-screen'));
  const container = $('result-content');
  container.innerHTML = `
    <div class="result-section">
      <h3>Score</h3>
      <div class="result-row"><span>Section 1</span><span>${r.section1Correct} / 5</span></div>
      <div class="result-row"><span>Section 2</span><span>${r.section2Correct} / 5</span></div>
      <div class="result-row total"><span>Total</span><span>${r.totalCorrect} / 10</span></div>
    </div>
    <div class="result-section">
      <h3>Rewards</h3>
      <div class="result-row"><span>XP earned</span><span class="positive">+${r.rewards.xp} XP</span></div>
      <div class="result-row"><span>Coins earned</span><span class="positive">+${r.rewards.coins} 🪙</span></div>
      <div class="result-row"><span>Stars earned</span><span class="star-reward">+${r.rewards.stars} ⭐</span></div>
      ${r.perfectXp ? `<div class="result-row"><span>Perfect bonus</span><span class="positive">+${r.perfectXp} XP</span></div>` : ''}
    </div>`;
  show($('result-screen'));
  refreshUser();
}

async function showFinalResultFromProgress(topicId) {
  const data = await req('GET', `/topics/${topicId}/result`);
  if (data.status !== 'success') return out(data);
  const p = data.data;
  const perfectXp = p.totalCorrect === 10 ? 100 : 0;
  const container = $('result-content');
  container.innerHTML = `
    <div class="result-section">
      <h3>Score</h3>
      <div class="result-row"><span>Section 1</span><span>${p.section1.correct} / 5</span></div>
      <div class="result-row"><span>Section 2</span><span>${p.section2.correct} / 5</span></div>
      <div class="result-row total"><span>Total</span><span>${p.totalCorrect} / 10</span></div>
    </div>
    <div class="result-section">
      <h3>Rewards</h3>
      <div class="result-row"><span>XP</span><span class="positive">+${p.rewards.xp} XP</span></div>
      <div class="result-row"><span>Coins</span><span class="positive">+${p.rewards.coins} 🪙</span></div>
      <div class="result-row"><span>Stars</span><span class="star-reward">+${p.rewards.stars} ⭐</span></div>
      ${perfectXp ? `<div class="result-row"><span>Perfect bonus</span><span class="positive">+${perfectXp} XP</span></div>` : ''}
    </div>`;
  hide($('topics-screen'));
  hide($('quiz-screen'));
  hide($('section-result-screen'));
  show($('result-screen'));
}

function backToTopics() {
  hide($('result-screen'));
  hide($('section-result-screen'));
  show($('topics-screen'));
  currentTopicId = null;
  loadTopics();
}

async function retryTopic() {
  if (!currentTopicId) return;
  if (!confirm('This will cost 10🪙. Are you sure?')) return;
  const data = await req('POST', `/topics/${currentTopicId}/retry`);
  if (data.status !== 'success') return out(data);
  refreshUser();
  backToTopics();
  alert('Topic reset! You can retry now.');
}

// --- Init ---
updateAuthUI();
