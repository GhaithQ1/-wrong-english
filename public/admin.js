const API = 'http://localhost:5000/api';

let sectionsList = [];
let editingId = null;

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
  setTopicImagePreview(t.image || '');

  sectionsList = t.sections.map(s => ({ name: s.name }));
  renderSections();
  t.sections.forEach((s, si) => {
    s.questions.forEach((q, qi) => {
      $(`q${si}_${qi}s`).value = q.sentence;
      $(`q${si}_${qi}correct`).value = q.correctIndex;
      $(`q${si}_${qi}diff`).value = q.difficulty;
      $(`q${si}_${qi}hint`).value = q.hint || '';
      for (let j = 0; j < 4; j++) {
        $(`q${si}_${qi}c${j}`).value = q.choices[j];
      }
    });
  });
}

function cancelEdit() {
  editingId = null;
  $('form-title').textContent = 'Create Topic';
  $('save-topic-btn').textContent = 'Create Topic';
  $('cancel-edit-btn').style.display = 'none';
  $('topic-name').value = '';
  $('topic-order').value = '';
  $('topic-unlock').value = '';
  setTopicImagePreview('');
  $('topic-image-input').value = '';
  sectionsList = [];
  renderSections();
}

// --- Sections Form ---

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LETTERS = ['A', 'B', 'C', 'D'];

function avatarUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return 'http://localhost:5000' + path;
}

function setTopicImagePreview(url) {
  const img = document.getElementById('topic-image-img');
  const preview = document.getElementById('topic-image-preview');
  if (url) {
    img.src = avatarUrl(url);
    preview.classList.remove('hidden');
    document.getElementById('topic-image').value = url;
  } else {
    preview.classList.add('hidden');
    document.getElementById('topic-image').value = '';
  }
}

async function uploadTopicImage() {
  const fileInput = document.getElementById('topic-image-input');
  const file = fileInput.files[0];
  if (!file) return alert('Select an image first');
  const fd = new FormData();
  fd.append('image', file);
  const t = token();
  const res = await fetch(API + '/admin/upload-image', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t },
    body: fd,
  });
  const data = await res.json();
  if (data.status !== 'success') return alert(data.message || 'Upload failed');
  setTopicImagePreview(data.data.url);
}

function removeTopicImage() {
  setTopicImagePreview('');
  document.getElementById('topic-image-input').value = '';
}

function addSection() {
  sectionsList.push({ name: '' });
  renderSections();
}

function removeSection(idx) {
  sectionsList.splice(idx, 1);
  renderSections();
}

function renderSections() {
  const container = $('sections-container');
  container.innerHTML = '';
  sectionsList.forEach((sec, si) => {
    const secDiv = document.createElement('div');
    secDiv.style.cssText = 'margin-bottom:1.5rem;border:1px solid #2a2a3e;border-radius:12px;padding:1rem;background:#14142a;';
    secDiv.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
        <input type="text" id="secName${si}" value="${sec.name}" placeholder="Section name (e.g. Grammar Basics)" style="flex:1;margin-right:0.5rem;" oninput="updateSec(${si})" />
        <button class="btn sm danger" onclick="removeSection(${si})">Remove</button>
      </div>
      <div id="secQuestions${si}"></div>
    `;
    container.appendChild(secDiv);

    const qContainer = secDiv.querySelector(`#secQuestions${si}`);
    for (let qi = 0; qi < 10; qi++) {
      const qDiv = document.createElement('div');
      qDiv.className = 'quiz-question';
      let choicesHTML = '';
      for (let j = 0; j < 4; j++) {
        choicesHTML += `<input type="text" id="q${si}_${qi}c${j}" placeholder="Choice ${LETTERS[j]}" style="margin-top:0.25rem;" />`;
      }
      qDiv.innerHTML = `
        <div class="q-text">Q${qi + 1}</div>
        <input type="text" id="q${si}_${qi}s" placeholder="Sentence" style="margin-bottom:0.5rem;" />
        ${choicesHTML}
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;flex-wrap:wrap;">
          <span style="font-size:0.8rem;color:#888;">Correct:</span>
          <select id="q${si}_${qi}correct" style="background:#0f0f1a;color:#e0e0e0;border:1px solid #2a2a3e;border-radius:8px;padding:0.3rem 0.5rem;">
            <option value="0">A</option>
            <option value="1">B</option>
            <option value="2">C</option>
            <option value="3">D</option>
          </select>
          <span style="font-size:0.8rem;color:#888;">Difficulty:</span>
          <select id="q${si}_${qi}diff" style="background:#0f0f1a;color:#e0e0e0;border:1px solid #2a2a3e;border-radius:8px;padding:0.3rem 0.5rem;">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <input type="text" id="q${si}_${qi}hint" placeholder="Hint (optional)" style="flex:1;" />
        </div>
      `;
      qContainer.appendChild(qDiv);
    }
  });
}

function updateSec(si) {
  sectionsList[si].name = document.getElementById(`secName${si}`).value;
}

// --- Create / Update Topic ---

async function createTopic() {
  const name = $('topic-name').value.trim();
  const order = parseInt($('topic-order').value);
  const unlockStars = parseInt($('topic-unlock').value) || 0;
  if (!name || !order) return alert('Enter topic name and order');
  const image = $('topic-image').value;

  const sections = [];
  for (let si = 0; si < sectionsList.length; si++) {
    const secName = document.getElementById(`secName${si}`).value.trim();
    if (!secName) return alert(`Enter a name for section ${si + 1}`);
    const questions = [];
    for (let qi = 0; qi < 10; qi++) {
      const sentence = $(`q${si}_${qi}s`).value.trim();
      const choices = [0, 1, 2, 3].map(j => $(`q${si}_${qi}c${j}`).value.trim());
      const correctIndex = parseInt($(`q${si}_${qi}correct`).value);
      const difficulty = $(`q${si}_${qi}diff`).value;
      if (!sentence || choices.some(c => !c)) return alert(`Fill all fields for section ${si + 1}, question ${qi + 1}`);
      const hint = $(`q${si}_${qi}hint`).value.trim();
      questions.push({ sentence, choices, correctIndex, difficulty, ...(hint ? { hint } : {}) });
    }
    sections.push({ name: secName, questions });
  }

  if (sections.length < 1) return alert('Add at least one section');

  let data;
  if (editingId) {
    data = await req('PUT', `/admin/topics/${editingId}`, { name, image, order, unlockStars, sections });
  } else {
    data = await req('POST', '/admin/topics', { name, image, order, unlockStars, sections });
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
loadStats();
loadTopicsList();
