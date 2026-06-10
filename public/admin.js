const API = 'http://localhost:5000/api';

function token() { return localStorage.getItem('token'); }

async function req(method, path, body) {
  const opts = { method, headers: {} };
  const t = token();
  if (!t) { window.location.href = '/'; return; }
  opts.headers['Authorization'] = 'Bearer ' + t;
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (data.status === 'error' && data.message === 'Admin access only') {
    alert('Admin access only');
    window.location.href = '/';
  }
  return data;
}

function out(data) {
  const el = document.getElementById('output');
  el.textContent = JSON.stringify(data, null, 2);
  el.classList.remove('hidden');
}

function $(id) { return document.getElementById(id); }

// --- Stats ---

async function loadStats() {
  const data = await req('GET', '/admin/stats');
  if (data.status !== 'success') return out(data);
  $('stats').innerHTML = `
    <div class="result-row"><span>Users</span><span>${data.data.users}</span></div>
    <div class="result-row"><span>Topics</span><span>${data.data.topics}</span></div>
  `;
}

// --- Users ---

async function loadUsers() {
  const data = await req('GET', '/admin/users');
  out(data);
}

// --- Edit Topics ---

let editingId = null;

async function loadTopicsList() {
  const data = await req('GET', '/admin/topics');
  if (data.status !== 'success') return out(data);
  const container = $('topics-list');
  container.innerHTML = '';
  if (!data.data.length) { container.innerHTML = '<p style="color:#888;">No topics yet.</p>'; return; }
  data.data.forEach(t => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #2a2a3e;';
    row.innerHTML = `
      <span><strong>${t.order}</strong>. ${t.name} <span style="color:#888;font-size:0.8rem;">(${t.unlockStars}⭐)</span></span>
      <button class="btn sm" onclick="editTopic('${t._id}')">Edit</button>
    `;
    container.appendChild(row);
  });
}

async function editTopic(id) {
  const data = await req('GET', `/admin/topics/${id}`);
  if (data.status !== 'success') return out(data);
  const t = data.data;

  editingId = id;
  $('form-title').textContent = 'Edit Topic';
  $('save-topic-btn').textContent = 'Update Topic';
  $('cancel-edit-btn').style.display = 'inline-block';
  $('topic-name').value = t.name;
  $('topic-order').value = t.order;
  $('topic-unlock').value = t.unlockStars;

  for (let i = 0; i < 10; i++) {
    const q = t.questions[i];
    $(`q${i}s`).value = q.sentence;
    $(`q${i}correct`).value = q.correctIndex;
    $(`q${i}diff`).value = q.difficulty;
    $(`q${i}hint`).value = q.hint || '';
    for (let j = 0; j < 4; j++) {
      $(`q${i}c${j}`).value = q.choices[j];
    }
  }
}

function cancelEdit() {
  editingId = null;
  $('form-title').textContent = 'Create Topic';
  $('save-topic-btn').textContent = 'Create Topic';
  $('cancel-edit-btn').style.display = 'none';
  $('topic-name').value = '';
  $('topic-order').value = '';
  $('topic-unlock').value = '';
  for (let i = 0; i < 10; i++) {
    $(`q${i}s`).value = '';
    $(`q${i}correct`).value = '0';
    $(`q${i}diff`).value = 'easy';
    $(`q${i}hint`).value = '';
    for (let j = 0; j < 4; j++) {
      $(`q${i}c${j}`).value = '';
    }
  }
}

// --- Create / Update Topic ---

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LETTERS = ['A', 'B', 'C', 'D'];

function buildForm() {
  const container = $('questions-form');
  container.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const sec = i < 5 ? 'Section 1' : 'Section 2';
    const div = document.createElement('div');
    div.className = 'quiz-question';
    div.id = `q-${i}`;
    let choicesHTML = '';
    for (let j = 0; j < 4; j++) {
      choicesHTML += `<input type="text" id="q${i}c${j}" placeholder="Choice ${LETTERS[j]}" style="margin-top:0.25rem;" />`;
    }
    div.innerHTML = `
      <div class="q-text">Q${i + 1} <span style="color:#888;font-size:0.75rem;">[${sec}]</span></div>
      <input type="text" id="q${i}s" placeholder="Sentence" style="margin-bottom:0.5rem;" />
      ${choicesHTML}
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;">
        <span style="font-size:0.8rem;color:#888;">Correct:</span>
        <select id="q${i}correct" style="background:#0f0f1a;color:#e0e0e0;border:1px solid #2a2a3e;border-radius:8px;padding:0.3rem 0.5rem;">
          <option value="0">A</option>
          <option value="1">B</option>
          <option value="2">C</option>
          <option value="3">D</option>
        </select>
        <span style="font-size:0.8rem;color:#888;">Difficulty:</span>
        <select id="q${i}diff" style="background:#0f0f1a;color:#e0e0e0;border:1px solid #2a2a3e;border-radius:8px;padding:0.3rem 0.5rem;">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <input type="text" id="q${i}hint" placeholder="Hint (optional)" style="flex:1;" />
      </div>
    `;
    container.appendChild(div);
  }
}

async function createTopic() {
  const name = $('topic-name').value.trim();
  const order = parseInt($('topic-order').value);
  const unlockStars = parseInt($('topic-unlock').value) || 0;
  if (!name || !order) return alert('Enter topic name and order');
  const questions = [];
  for (let i = 0; i < 10; i++) {
    const sentence = $(`q${i}s`).value.trim();
    const choices = [0, 1, 2, 3].map(j => $(`q${i}c${j}`).value.trim());
    const correctIndex = parseInt($(`q${i}correct`).value);
    const difficulty = $(`q${i}diff`).value;
    if (!sentence || choices.some(c => !c)) return alert(`Fill all fields for Q${i + 1}`);
    const hint = $(`q${i}hint`).value.trim();
    questions.push({ sentence, choices, correctIndex, difficulty, ...(hint ? { hint } : {}) });
  }
  let data;
  if (editingId) {
    data = await req('PUT', `/admin/topics/${editingId}`, { name, order, unlockStars, questions });
  } else {
    data = await req('POST', '/admin/topics', { name, order, unlockStars, questions });
  }
  out(data);
  if (data.status === 'success') {
    cancelEdit();
    loadStats();
    loadTopicsList();
  }
}

// --- Init ---
if (!token()) window.location.href = '/';
buildForm();
loadStats();
loadTopicsList();
