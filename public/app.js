const API = 'http://localhost:5000/api';

let currentTopicId = null;
let currentSecIdx = 0;
let currentPartNum = 1;
let skippedQuestions = new Set();
let currentQuestions = [];

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

function avatarUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return 'http://localhost:5000' + path;
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
    show($('profile-btn'));
    show($('leaderboard-btn'));
    hide($('profile-screen'));
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
    hide($('sections-screen'));
    hide($('part-result-screen'));
    hide($('result-screen'));
    hide($('logout-btn'));
    hide($('profile-btn'));
    hide($('profile-screen'));
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
    localStorage.setItem('user', JSON.stringify(data.data));
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
    localStorage.setItem('user', JSON.stringify(data.data));
    $('auth-error').textContent = '';
    updateAuthUI();
  } else {
    $('auth-error').textContent = data.message || 'Login failed';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentTopicId = null;
  updateAuthUI();
}

function googleLogin() {
  window.location.href = API + '/auth/google';
}

// --- Forgot / Reset Password ---

let forgotEmail = '';

function showForgotPassword() {
  hide($('auth-screen'));
  forgotEmail = '';
  $('forgot-email').value = '';
  $('forgot-msg').textContent = '';
  show($('forgot-stage-1'));
  hide($('forgot-stage-2'));
  show($('forgot-screen'));
}

function backFromForgot() {
  hide($('forgot-screen'));
  show($('auth-screen'));
}

async function sendResetCode() {
  const email = $('forgot-email').value.trim();
  if (!email) return $('forgot-msg').textContent = 'Enter your email';
  forgotEmail = email;
  $('forgot-msg').textContent = 'Sending...';
  const data = await req('POST', '/auth/forgot-password', { email });
  $('forgot-msg').textContent = data.message || 'Failed to send code';
  if (data.status === 'success') {
    hide($('forgot-stage-1'));
    $('forgot-email-display').textContent = email;
    show($('forgot-stage-2'));
    document.querySelectorAll('.code-box').forEach((inp, i) => {
      inp.value = '';
      inp.oninput = function () {
        if (this.value.length === 1 && i < 5) document.getElementById('code-' + (i + 1)).focus();
      };
      inp.onkeydown = function (e) {
        if (e.key === 'Backspace' && !this.value && i > 0) document.getElementById('code-' + (i - 1)).focus();
      };
    });
    setTimeout(() => { try { document.getElementById('code-0').focus(); } catch(e) {} }, 100);
  }
}

async function resetPassword() {
  const code = Array.from({ length: 6 }, (_, i) => $('code-' + i).value).join('');
  const password = $('reset-password').value.trim();
  const confirm = $('reset-confirm').value.trim();
  if (code.length !== 6) return $('forgot-msg').textContent = 'Enter the 6-digit code';
  if (!password || password.length < 6) return $('forgot-msg').textContent = 'Password must be at least 6 characters';
  if (password !== confirm) return $('forgot-msg').textContent = 'Passwords do not match';
  $('forgot-msg').textContent = 'Resetting...';
  const data = await req('POST', '/auth/reset-password', { email: forgotEmail, code, password });
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.data));
    $('forgot-msg').textContent = '';
    forgotEmail = '';
    updateAuthUI();
  } else {
    $('forgot-msg').textContent = data.message || 'Failed to reset password';
  }
}

async function refreshUser() {
  const data = await req('GET', '/auth/me');
  if (data.status === 'success') {
    const u = data.data;
    localStorage.setItem('user', JSON.stringify(u));
    const avatarHtml = u.avatar ? `<img src="${avatarUrl(u.avatar)}" class="user-avatar-thumb" />` : '';
    $('user-bar').innerHTML = `
      ${avatarHtml}
      <span id="user-name">${u.name}</span>
      <span class="badge">Lv. <span id="user-level">${u.level}</span></span>
      <span class="badge">XP <span id="user-xp">${u.xp}</span></span>
      <span class="badge coin">🪙 <span id="user-coins">${u.coins}</span></span>
      <span class="badge star">⭐ <span id="user-stars">${u.stars}</span></span>
    `;
    show($('user-bar'));
    show($('notif-btn'));
    if (u.role === 'admin') {
      show($('admin-link'));
    } else {
      hide($('admin-link'));
    }
    loadNotifications();
    const placeholder = $('pc-avatar-placeholder');
    const img = $('pc-avatar');
    if (u.avatar) {
      hide(placeholder);
      img.src = avatarUrl(u.avatar) + '?t=' + Date.now();
      show(img);
    } else {
      hide(img);
      placeholder.textContent = u.name[0].toUpperCase();
      placeholder.style.background = '#2a2a4e';
      show(placeholder);
    }
    $('pc-name').textContent = u.name;
    $('pc-level').textContent = 'Level ' + u.level;
    $('pc-xp').textContent = u.xp;
    $('pc-coins').textContent = u.coins;
    $('pc-stars').textContent = u.stars;
    show($('profile-card'));
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
          <span>${t.creator?.avatar ? `<img src="${avatarUrl(t.creator.avatar)}" class="trap-creator-avatar" />` : ''} ${t.creator?.name || 'unknown'}</span>
          <span>${t.totalAttempts} attempts</span>
          ${t.myAttempt
            ? `<span style="color:${t.myAttempt.correct ? '#40c060' : '#e05050'}">${t.myAttempt.correct ? '✅ Correct' : '❌ Wrong'}</span>`
            : `<button class="btn sm" onclick="attemptTrap('${t._id}', this)">حاول</button>`
          }
        `}
      </div>
      ${!showMine && !t.myAttempt ? `<div class="trap-attempt hidden"><input type="text" placeholder="Your correction..." /><button class="btn sm primary" onclick="submitAttempt('${t._id}', this)">Submit</button></div>` : ''}
      <div class="trap-actions">
        <button class="btn sm trap-action-btn ${t.liked ? 'liked' : ''}" onclick="toggleLike('${t._id}', this)">
          ${t.liked ? '❤️' : '🤍'} <span class="like-count">${t.likesCount}</span>
        </button>
        <button class="btn sm trap-action-btn" onclick="toggleComments('${t._id}', this)">
          💬 <span class="comment-count">${t.commentsCount}</span>
        </button>
      </div>
      <div class="trap-comments hidden" id="trap-comments-${t._id}">
        <div class="trap-comments-list">
          ${(t.latestComments || []).map(c => renderCommentHtml(t._id, c)).join('')}
          ${t.commentsCount > 2 ? `<div class="comment-more">+${t.commentsCount - 2} more</div>` : ''}
        </div>
        <div class="trap-comment-form">
          <input type="text" placeholder="Write a comment..." />
          <button class="btn sm primary" onclick="addComment('${t._id}', this)">Post</button>
        </div>
      </div>
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
  if (!sentence) return alert('Enter a wrong English sentence');

  const msgEl = $('trap-validation-msg');
  const btn = $('trap-submit-btn');
  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';
  msgEl.style.display = 'none';

  const data = await req('POST', '/traps', { sentence });
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

async function toggleLike(trapId, btn) {
  const data = await req('POST', `/traps/${trapId}/like`);
  if (data.status !== 'success') return;
  const isLiked = data.data.liked;
  btn.classList.toggle('liked', isLiked);
  btn.innerHTML = (isLiked ? '❤️' : '🤍') + ' <span class="like-count">' + data.data.likesCount + '</span>';
  loadNotifications();
}

function toggleComments(trapId, btn) {
  const section = $('trap-comments-' + trapId);
  section.classList.toggle('hidden');
}

async function addComment(trapId, btn) {
  const section = $('trap-comments-' + trapId);
  const input = section.querySelector('.trap-comment-form input');
  const text = input.value.trim();
  if (!text) return;
  const data = await req('POST', `/traps/${trapId}/comment`, { text });
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  input.value = '';
  loadTraps(showMine);
  loadNotifications();
}

async function deleteComment(trapId, commentId) {
  if (!confirm('Delete this comment?')) return;
  const data = await req('DELETE', `/traps/${trapId}/comment/${commentId}`);
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  loadTraps(showMine);
}

function renderCommentHtml(trapId, c) {
  const userId = JSON.parse(localStorage.getItem('user') || '{}')._id;
  const cUser = typeof c.user === 'object' ? c.user : null;
  const cUserId = cUser?._id || c.user;
  const cUserName = cUser?.name || '';
  const isMine = cUserId === userId;
  return `
  <div class="comment-item">
    <div class="comment-head">
      <span class="comment-user">${escapeHtml(cUserName || '')}</span>
      <span class="comment-text">${escapeHtml(c.text)}</span>
      ${isMine ? `<button class="btn sm comment-del-btn" onclick="event.stopPropagation();deleteComment('${trapId}','${c._id}')">✕</button>` : ''}
    </div>
    <div class="comment-actions">
      <button class="btn sm comment-like-btn ${c.liked ? 'liked' : ''}" onclick="event.stopPropagation();toggleCommentLike('${trapId}','${c._id}', this)">
        ${c.liked ? '❤️' : '🤍'} <span>${c.likesCount}</span>
      </button>
      <button class="btn sm comment-reply-btn" onclick="event.stopPropagation();showReplyForm('${trapId}','${c._id}')">Reply</button>
    </div>
    <div class="comment-replies" id="replies-${c._id}">
      ${(c.replies || []).map(r => renderReplyHtml(trapId, c._id, r)).join('')}
    </div>
    <div class="reply-form hidden" id="reply-form-${c._id}">
      <input type="text" placeholder="Write a reply..." />
      <button class="btn sm primary" onclick="submitReply('${trapId}','${c._id}', this)">Reply</button>
    </div>
  </div>`;
}

function renderReplyHtml(trapId, commentId, r) {
  const userId = JSON.parse(localStorage.getItem('user') || '{}')._id;
  const rUser = typeof r.user === 'object' ? r.user : null;
  const rUserId = rUser?._id || r.user;
  const rUserName = rUser?.name || '';
  const isMine = rUserId === userId;
  return `
  <div class="reply-item">
    <div class="reply-head">
      <span class="comment-user">${escapeHtml(rUserName || '')}</span>
      <span class="comment-text">${escapeHtml(r.text)}</span>
      ${isMine ? `<button class="btn sm comment-del-btn" onclick="event.stopPropagation();deleteComment('${trapId}','${r._id}')">✕</button>` : ''}
    </div>
    <div class="reply-actions">
      <button class="btn sm comment-like-btn ${r.liked ? 'liked' : ''}" onclick="event.stopPropagation();toggleReplyLike('${trapId}','${commentId}','${r._id}', this)">
        ${r.liked ? '❤️' : '🤍'} <span>${r.likesCount}</span>
      </button>
    </div>
  </div>`;
}

async function toggleCommentLike(trapId, commentId, btn) {
  const data = await req('POST', `/traps/${trapId}/comment/${commentId}/like`);
  if (data.status !== 'success') return;
  const liked = data.data.liked;
  btn.classList.toggle('liked', liked);
  btn.innerHTML = (liked ? '❤️' : '🤍') + ' <span>' + data.data.likesCount + '</span>';
  loadNotifications();
}

async function toggleReplyLike(trapId, commentId, replyId, btn) {
  const data = await req('POST', `/traps/${trapId}/comment/${commentId}/reply/${replyId}/like`);
  if (data.status !== 'success') return;
  const liked = data.data.liked;
  btn.classList.toggle('liked', liked);
  btn.innerHTML = (liked ? '❤️' : '🤍') + ' <span>' + data.data.likesCount + '</span>';
  loadNotifications();
}

function showReplyForm(trapId, commentId) {
  const form = $('reply-form-' + commentId);
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    form.querySelector('input').focus();
  }
}

async function submitReply(trapId, commentId, btn) {
  const form = btn.closest('.reply-form');
  const input = form.querySelector('input');
  const text = input.value.trim();
  if (!text) return;
  const data = await req('POST', `/traps/${trapId}/comment/${commentId}/reply`, { text });
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  input.value = '';
  form.classList.add('hidden');
  loadTraps(showMine);
  loadNotifications();
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

    const secsDone = t.sectionsDone || 0;
    const secsTotal = t.sectionsCount || 0;
    let statusHtml;
    if (secsDone >= secsTotal && secsTotal > 0) {
      statusHtml = '<span class="done">Complete</span>';
    } else if (secsDone > 0) {
      statusHtml = `<span style="color:#f0c040;">${secsDone}/${secsTotal} sections</span>`;
    } else {
      statusHtml = '<span class="pending">Not attempted</span>';
    }

    const imgHtml = t.image ? `<img src="${avatarUrl(t.image)}" class="topic-thumb" />` : '';

    card.innerHTML = `
      ${imgHtml}
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

// --- Sections Flow ---

function startTopic(topicId) {
  currentTopicId = topicId;
  loadSections();
}

async function loadSections() {
  const data = await req('GET', `/topics/${currentTopicId}/sections`);
  if (data.status !== 'success') return out(data);
  const topicName = data.data.name || '';
  const sections = data.data.sections || [];

  $('sections-topic-name').textContent = topicName || 'Sections';
  const container = $('sections-list');
  container.innerHTML = '';

  sections.forEach((sec, idx) => {
    const card = document.createElement('div');
    card.className = 'section-card';

    let label, cls;
    if (sec.completed) {
      label = 'Complete ✓';
      cls = 'done';
    } else if (sec.part2Done) {
      label = 'Complete ✓';
      cls = 'done';
    } else if (sec.part1Done) {
      label = 'Part 2 available';
      cls = 'part2';
    } else if (sec.locked) {
      label = 'Locked 🔒';
      cls = 'locked';
    } else {
      label = 'Start';
      cls = 'start';
    }

    card.innerHTML = `
      <div class="section-card-name">${sec.name || 'Section ' + (idx + 1)}</div>
      <div class="section-card-status ${cls}">${label}</div>`;

    if (!sec.locked) {
      card.onclick = () => startSection(idx, sec);
    }
    container.appendChild(card);
  });

  hide($('topics-screen'));
  hide($('quiz-screen'));
  hide($('part-result-screen'));
  hide($('result-screen'));
  show($('sections-screen'));
}

function startSection(secIdx, sec) {
  currentSecIdx = secIdx;
  skippedQuestions = new Set();

  let partNum = 1;
  if (sec.part1Done) {
    partNum = 2;
  }
  currentPartNum = partNum;
  loadQuiz(partNum);
}

async function loadQuiz(partNum) {
  const data = await req('GET', `/topics/${currentTopicId}/sections/${currentSecIdx}/questions?part=${partNum}`);
  if (data.status !== 'success') return out(data);
  currentQuestions = data.data.questions;
  currentPartNum = partNum;

  const secName = data.data.name || 'Section ' + (currentSecIdx + 1);
  $('quiz-title').textContent = secName;
  $('quiz-section-label').textContent = `Part ${partNum} of 2`;
  $('submit-section-btn').textContent = 'Submit Part ' + partNum;

  renderQuestions(currentQuestions, 0);
  $('submit-section-btn').disabled = false;

  hide($('sections-screen'));
  hide($('part-result-screen'));
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

async function submitCurrentPart() {
  if (!currentTopicId) return;
  const answers = [];

  for (let i = 0; i < currentQuestions.length; i++) {
    if (skippedQuestions.has(i)) {
      answers.push({ questionIndex: i, skipped: true });
    } else {
      const sel = document.querySelector(`input[name="q${i + 1}"]:checked`);
      if (!sel) return alert('Answer all questions before submitting!');
      answers.push({ questionIndex: i, selectedIndex: parseInt(sel.value) });
    }
  }

  const data = await req('POST', `/topics/${currentTopicId}/sections/${currentSecIdx}/part/${currentPartNum}`, { answers });
  if (data.status !== 'success') return out(data);
  showPartResult(data.data);
}

async function useHint(idx) {
  const data = await req('POST', `/topics/${currentTopicId}/sections/${currentSecIdx}/hint`, { questionIndex: idx });
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  const el = $('hint-' + idx);
  el.textContent = '💡 ' + data.data.hint;
  el.classList.remove('hidden');
  refreshUser();
}

async function skipQuestion(idx) {
  if (skippedQuestions.has(idx)) return;
  const data = await req('POST', `/topics/${currentTopicId}/sections/${currentSecIdx}/skip`);
  if (data.status !== 'success') { alert(data.message || 'Failed'); return; }
  skippedQuestions.add(idx);
  const block = $('qblock-' + idx);
  block.style.opacity = '0.4';
  const radios = block.querySelectorAll('input[type="radio"]');
  radios.forEach(r => r.disabled = true);
  refreshUser();
}

function showPartResult(r) {
  hide($('quiz-screen'));
  const isComplete = r.sectionCompleted || r.sectionComplete || false;
  const container = $('part-result-content');
  container.innerHTML = `
    <div class="result-section">
      <div class="result-row"><span>Score</span><span>${r.correct} / ${r.total}</span></div>
      <div class="result-row"><span>XP earned</span><span class="positive">+${r.rewards?.xp || r.xp || 0} XP</span></div>
      <div class="result-row"><span>Coins earned</span><span class="positive">+${(r.rewards?.coins || r.coins || 0)} 🪙</span></div>
      ${r.bonus > 0 ? `<div class="result-row"><span>Bonus</span><span class="positive">+${r.bonus} 🪙</span></div>` : ''}
      ${isComplete ? `
        <div class="result-row total"><span>Section Complete!</span><span></span></div>
        ${r.finalBonus ? `<div class="result-row"><span>Section coins</span><span class="positive">+${r.finalBonus.coins} 🪙</span></div>` : ''}
        ${r.finalBonus ? `<div class="result-row"><span>Stars earned</span><span class="star-reward">+${r.finalBonus.stars} ⭐</span></div>` : ''}
        ${r.perfectXp ? `<div class="result-row"><span>Perfect bonus</span><span class="positive">+${r.perfectXp} XP</span></div>` : ''}
      ` : ''}
    </div>`;

  const nextBtn = $('part-result-next-btn');
  if (isComplete) {
    nextBtn.textContent = 'Back to Sections';
    nextBtn.onclick = () => backToSections();
  } else {
    nextBtn.textContent = 'Continue to Part 2';
    nextBtn.onclick = () => {
      hide($('part-result-screen'));
      currentPartNum = 2;
      skippedQuestions = new Set();
      loadQuiz(2);
    };
  }

  show($('part-result-screen'));
  refreshUser();
}

function nextAfterResult() {
  // Handled by onclick set in showPartResult
}

function backFromQuiz() {
  hide($('quiz-screen'));
  show($('sections-screen'));
  loadSections();
}

function backFromSections() {
  hide($('sections-screen'));
  show($('topics-screen'));
  currentTopicId = null;
  loadTopics();
}

function backToSections() {
  hide($('part-result-screen'));
  hide($('result-screen'));
  show($('sections-screen'));
  loadSections();
}

async function retrySection() {
  if (!currentTopicId) return;
  if (!confirm('This will cost 10🪙. Are you sure?')) return;
  const data = await req('POST', `/topics/${currentTopicId}/retry`);
  if (data.status !== 'success') return out(data);
  refreshUser();
  backToSections();
  alert('Topic reset! You can retry now.');
}

// --- Profile ---

function showProfile() {
  hide($('topics-screen'));
  hide($('daily-section'));
  hide($('traps-section'));
  hide($('sections-screen'));
  hide($('quiz-screen'));
  hide($('part-result-screen'));
  hide($('result-screen'));
  show($('profile-screen'));
  const u = JSON.parse(localStorage.getItem('user') || '{}');
  const placeholder = $('profile-avatar-placeholder');
  const img = $('profile-avatar-img');
  if (u.avatar) {
    hide(placeholder);
    img.src = avatarUrl(u.avatar) + '?t=' + Date.now();
    show(img);
  } else {
    hide(img);
    placeholder.textContent = (u.name || '?')[0].toUpperCase();
    placeholder.style.background = '#2a2a4e';
    show(placeholder);
  }
  $('profile-name-input').value = u.name;
  $('profile-email').textContent = u.email;
  $('profile-avatar-input').value = '';
  $('profile-file-name').textContent = '';
  $('profile-msg').textContent = '';
  $('profile-avatar-input').onchange = function () {
    const f = this.files[0];
    if (f) {
      $('profile-file-name').textContent = 'Selected: ' + f.name;
      const reader = new FileReader();
      reader.onload = function (e) {
        hide($('profile-avatar-placeholder'));
        $('profile-avatar-img').src = e.target.result;
        show($('profile-avatar-img'));
      };
      reader.readAsDataURL(f);
    }
  };
}

async function saveProfile() {
  const name = $('profile-name-input').value.trim();
  const fileInput = $('profile-avatar-input');
  const file = fileInput.files[0];
  if (!name) return $('profile-msg').textContent = 'Name is required';
  const fd = new FormData();
  fd.append('name', name);
  if (file) fd.append('avatar', file);
  const t = token();
  const res = await fetch(API + '/auth/profile', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + t },
    body: fd,
  });
  const data = await res.json();
  if (data.status !== 'success') {
    $('profile-msg').textContent = data.message || 'Failed to update profile';
    return;
  }
  localStorage.setItem('user', JSON.stringify(data.data));
  $('profile-msg').textContent = 'Profile updated!';
  showProfile();
  refreshUser();
}

function backFromProfile() {
  hide($('profile-screen'));
  show($('topics-screen'));
  show($('daily-section'));
  show($('traps-section'));
  show($('leaderboard-btn'));
}

// --- Leaderboard ---

function showLeaderboard() {
  hide($('topics-screen'));
  hide($('daily-section'));
  hide($('traps-section'));
  hide($('profile-screen'));
  show($('leaderboard-btn'));
  $('leaderboard-loading').classList.remove('hidden');
  $('leaderboard-list').innerHTML = '';
  show($('leaderboard-screen'));
  loadLeaderboard();
}

async function loadLeaderboard() {
  const data = await req('GET', '/users/leaderboard');
  $('leaderboard-loading').classList.add('hidden');
  if (data.status !== 'success' || !data.data.length) {
    $('leaderboard-list').innerHTML = '<p style="color:#888;text-align:center;padding:1rem;">No users yet.</p>';
    return;
  }
  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')._id;
  const ranks = ['🥇', '🥈', '🥉'];
  const medals = ['#ffd700', '#c0c0c0', '#cd7f32'];
  $('leaderboard-list').innerHTML = data.data.map((u, i) => {
    const isMe = u._id === currentUserId;
    const rankClass = i < 3 ? 'lb-rank-medal' : 'lb-rank-num';
    const rankHtml = i < 3
      ? `<span class="${rankClass}" style="color:${medals[i]}">${ranks[i]}</span>`
      : `<span class="${rankClass}">#${i + 1}</span>`;
    const avatarHtml = u.avatar
      ? `<img src="${avatarUrl(u.avatar)}" class="lb-avatar" />`
      : `<span class="lb-avatar lb-avatar-letter">${(u.name || '?')[0].toUpperCase()}</span>`;
    return `
      <div class="lb-row ${isMe ? 'lb-current' : ''}">
        ${rankHtml}
        ${avatarHtml}
        <div class="lb-info">
          <span class="lb-name">${escapeHtml(u.name)}</span>
          <div class="lb-details">
            <span class="badge">Lv.${u.level}</span>
            <span class="badge">${u.xp} XP</span>
            <span class="badge" style="color:#ff6b35;">🔥${u.loginStreak || 0}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function backFromLeaderboard() {
  hide($('leaderboard-screen'));
  show($('topics-screen'));
  show($('daily-section'));
  show($('traps-section'));
}

// --- Notifications ---

let notifOpen = false;

async function loadNotifications() {
  const data = await req('GET', '/notifications');
  if (data.status !== 'success') return;
  const { unread, read, unreadCount } = data.data;
  const badge = $('notif-badge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  return data.data;
}

function toggleNotifications() {
  notifOpen = !notifOpen;
  if (notifOpen) renderNotifications();
  else $('notif-dropdown').classList.add('hidden');
}

async function renderNotifications() {
  const dd = $('notif-dropdown');
  dd.innerHTML = '<div style="text-align:center;padding:1rem;color:#888;">Loading...</div>';
  dd.classList.remove('hidden');
  const data = await loadNotifications();
  if (!data) { dd.innerHTML = '<div style="text-align:center;padding:1rem;color:#888;">No notifications</div>'; return; }
  const all = [...data.unread, ...data.read];
  if (!all.length) {
    dd.innerHTML = '<div style="text-align:center;padding:1rem;color:#888;">No notifications</div>';
    return;
  }
  dd.innerHTML = `
    <div class="notif-header">
      <span>Notifications</span>
      ${data.unreadCount > 0 ? '<button class="btn sm" onclick="event.stopPropagation();markAllRead()">Mark all read</button>' : ''}
    </div>
    <div class="notif-list">${all.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="event.stopPropagation();handleNotifClick('${n._id}', ${n.read})">
        <span class="notif-icon">${n.type === 'like' ? '❤️' : '💬'}</span>
        <div class="notif-body">
          <span class="notif-text">${escapeHtml(n.fromUser?.name || 'Someone')} ${n.type === 'like' ? 'liked' : 'commented on'} your trap</span>
          <span class="notif-sentence">${escapeHtml(n.trap?.sentence || '')}</span>
          <span class="notif-time">${timeAgo(n.createdAt)}</span>
        </div>
      </div>
    `).join('')}</div>`;
}

async function markAllRead() {
  await req('PUT', '/notifications/read');
  loadNotifications();
  if (notifOpen) renderNotifications();
}

async function handleNotifClick(id, alreadyRead) {
  if (!alreadyRead) { await req('PUT', `/notifications/${id}/read`); }
  notifOpen = false;
  $('notif-dropdown').classList.add('hidden');
  loadNotifications();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

document.addEventListener('click', function (e) {
  const dd = $('notif-dropdown');
  if (notifOpen && !e.target.closest('#notif-btn') && !e.target.closest('.notif-dropdown')) {
    notifOpen = false;
    dd.classList.add('hidden');
  }
});

// --- Init ---
(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const userData = params.get('user');
  if (token) {
    localStorage.setItem('token', token);
    if (userData) {
      try {
        localStorage.setItem('user', JSON.stringify(JSON.parse(decodeURIComponent(userData))));
      } catch (e) { /* ignore */ }
    }
    window.history.replaceState({}, '', window.location.pathname);
  }
  const error = params.get('error');
  if (error) {
    const msg = { no_code: 'Authentication failed', no_email: 'Email required from Google', auth_failed: 'Google sign-in failed' };
    $('auth-error').textContent = msg[error] || 'Google sign-in failed';
    window.history.replaceState({}, '', window.location.pathname);
  }
})();
updateAuthUI();
setInterval(() => { if (token()) loadNotifications(); }, 30000);