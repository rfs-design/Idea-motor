// app.js — IdeaMotor main controller

import { getAllProjects, saveProject, getProject, updateRating, deleteProject, getRatingsByArchetype } from './storage.js';
import { getKey, getAllKeys, saveAllKeys, saveKey, loadKeys } from './settings.js';
import { SpeechCapture } from './speech.js';
import { analyzeIdea, buildRatingsContext } from './gemini-engine.js';
import { renderProjectList, renderProjectDetail, initWaveform, drawWaveform } from './ui.js';

// ── State ──────────────────────────────────────────────────────────────────
let speech          = null;
let waveFrameId     = null;
let currentProjectId = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const views = {
  welcome: document.getElementById('view-welcome'),
  list:    document.getElementById('view-list'),
  capture: document.getElementById('view-capture'),
  detail:  document.getElementById('view-detail'),
  write:   document.getElementById('view-write'),
};

// ── View navigation ────────────────────────────────────────────────────────
function showView(name) {
  Object.values(views).forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  const v = views[name];
  v.style.display = 'flex';
  // Force reflow before adding class for CSS transition
  requestAnimationFrame(() => v.classList.add('active'));
}

// On load, show list
async function init() {
  // Hide all views until we know whether a Gemini key exists (avoids a flash)
  Object.values(views).forEach(el => { el.style.display = 'none'; el.classList.remove('active'); });

  // Load API keys from IndexedDB into the in-memory cache before deciding the view
  await loadKeys();

  // First access: no Gemini key yet → show welcome onboarding instead of the list
  const firstView = getKey('gemini') ? 'list' : 'welcome';
  Object.entries(views).forEach(([name, el]) => {
    const on = name === firstView;
    el.style.display = on ? 'flex' : 'none';
    el.classList.toggle('active', on);
  });

  loadProjectList();
  registerServiceWorker();
  bindEvents();
}

// ── Project list ───────────────────────────────────────────────────────────
async function loadProjectList() {
  const projects = await getAllProjects();
  renderProjectList(projects, openProject);
}

async function openProject(id) {
  const project = await getProject(id);
  if (!project) return;
  currentProjectId = id;

  renderProjectDetail(project, {
    onRating: handleRating,
  });
  showView('detail');
}

async function handleRating(id, rating) {
  await updateRating(id, rating);
  const updated = await getProject(id);
  renderProjectDetail(updated, { onRating: handleRating });
  // Also refresh the list in background
  loadProjectList();
}

// ── Voice capture ──────────────────────────────────────────────────────────
function enterCaptureMode() {
  const apiKey = getKey('gemini');
  if (!apiKey) {
    alert('⚙️ Configura prima la tua API key Gemini nelle Impostazioni.');
    openSettings();
    return;
  }

  // Reset UI
  const transcriptEl   = document.getElementById('transcript-display');
  const statusEl       = document.getElementById('capture-status');
  const processingEl   = document.getElementById('processing-overlay');
  transcriptEl.textContent  = 'Inizia a parlare…';
  statusEl.textContent      = 'In ascolto';
  processingEl.classList.remove('visible');

  showView('capture');

  // Init canvas
  const canvas = document.getElementById('waveform');
  // Wait for view to be visible before measuring
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initWaveform(canvas);
      startWaveformLoop();
    });
  });

  // Start speech
  speech = new SpeechCapture({
    onTranscript(final, interim) {
      const display = final + (interim ? ' ' + interim : '');
      transcriptEl.textContent = display || 'Inizia a parlare…';
    },
    onError(msg) {
      statusEl.textContent = msg;
    },
    onStatusChange(s) {
      if (s === 'listening') statusEl.textContent = 'In ascolto';
    }
  });
  speech.start();
}

function exitCaptureMode() {
  if (speech) { speech.stop(); speech = null; }
  stopWaveformLoop();
  showView('list');
}

async function finalizeCaptureAndProcess() {
  if (!speech) return;

  const transcript = speech.stop();
  speech = null;
  stopWaveformLoop();

  if (!transcript || transcript.trim().length < 8) {
    alert('Nessuna trascrizione rilevata. Riprova.');
    showView('list');
    return;
  }

  await processIdea(transcript);
}

// Shared pipeline: turn a raw idea (from voice OR text) into a saved workflow
async function processIdea(rawText) {
  const transcript = (rawText || '').trim();
  if (transcript.length < 8) {
    alert('Servono almeno qualche parola per elaborare un workflow.');
    return false;
  }

  const overlay = document.getElementById('processing-overlay');
  overlay.classList.add('visible');

  try {
    const apiKey = getKey('gemini');

    // First pass: get archetype and initial workflow
    let result = await analyzeIdea(transcript, '', apiKey);

    // Second pass: enrich with ratings context for this archetype
    const ratings = await getRatingsByArchetype(result.archetipo);
    if (ratings.length > 0) {
      const ratingsCtx = buildRatingsContext(ratings);
      result = await analyzeIdea(transcript, ratingsCtx, apiKey);
    }

    // Save to DB
    const newId = await saveProject({ transcript, ...result });

    overlay.classList.remove('visible');
    await loadProjectList();
    await openProject(newId);
    return true;

  } catch (err) {
    overlay.classList.remove('visible');
    alert('Errore: ' + err.message);
    showView('list');
    return false;
  }
}

// ── Waveform animation ─────────────────────────────────────────────────────
function startWaveformLoop() {
  function frame() {
    const data = speech?.getFrequencyData?.() || null;
    drawWaveform(data);
    waveFrameId = requestAnimationFrame(frame);
  }
  frame();
}

function stopWaveformLoop() {
  if (waveFrameId) { cancelAnimationFrame(waveFrameId); waveFrameId = null; }
}

// ── Settings drawer ────────────────────────────────────────────────────────
function openSettings() {
  const keys = getAllKeys();
  document.getElementById('key-gemini').value     = keys.gemini     || '';
  document.getElementById('key-claude').value     = keys.claude     || '';
  document.getElementById('key-openai').value     = keys.openai     || '';
  document.getElementById('key-perplexity').value = keys.perplexity || '';

  document.getElementById('settings-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('visible');
}

function closeSettings() {
  document.getElementById('settings-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
}

function persistSettings() {
  saveAllKeys({
    gemini:     document.getElementById('key-gemini').value.trim(),
    claude:     document.getElementById('key-claude').value.trim(),
    openai:     document.getElementById('key-openai').value.trim(),
    perplexity: document.getElementById('key-perplexity').value.trim(),
  });
  closeSettings();

  // Feedback on save button
  const btn  = document.getElementById('btn-save-keys');
  const orig = btn.textContent;
  btn.textContent = '✓ Salvato';
  setTimeout(() => { btn.textContent = orig; }, 1800);
}

// ── Delete project ─────────────────────────────────────────────────────────
async function handleDeleteProject() {
  if (!currentProjectId) return;
  if (!confirm("Eliminare questo progetto? L'operazione è irreversibile.")) return;
  await deleteProject(currentProjectId);
  currentProjectId = null;
  await loadProjectList();
  showView('list');
}

// ── Event bindings ─────────────────────────────────────────────────────────
function bindEvents() {
  // List view
  document.getElementById('btn-capture').addEventListener('click', enterCaptureMode);
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  // Welcome / onboarding (first access)
  const welcomeKey = document.getElementById('welcome-key');
  const welcomeBtn = document.getElementById('btn-welcome-start');
  if (welcomeKey && welcomeBtn) {
    welcomeKey.addEventListener('input', () => {
      welcomeBtn.disabled = welcomeKey.value.trim().length === 0;
    });
    const startApp = () => {
      const k = welcomeKey.value.trim();
      if (!k) return;
      saveKey('gemini', k);
      welcomeKey.value = '';
      showView('list');
    };
    welcomeBtn.addEventListener('click', startApp);
    welcomeKey.addEventListener('keydown', (e) => { if (e.key === 'Enter') startApp(); });
  }

  // Capture view
  document.getElementById('btn-capture-close').addEventListener('click', exitCaptureMode);
  document.getElementById('btn-stop-capture').addEventListener('click', finalizeCaptureAndProcess);

  // Detail view
  document.getElementById('btn-detail-back').addEventListener('click', () => showView('list'));
  document.getElementById('btn-delete-project').addEventListener('click', handleDeleteProject);

  // Write view (text idea — alternative to voice)
  const writeInput = document.getElementById('write-input');
  const writeBtn   = document.getElementById('btn-write-process');
  document.getElementById('btn-write').addEventListener('click', () => {
    writeInput.value  = '';
    writeBtn.disabled = true;
    showView('write');
    setTimeout(() => writeInput.focus(), 250);
  });
  document.getElementById('btn-write-back').addEventListener('click', () => showView('list'));
  writeInput.addEventListener('input', () => {
    writeBtn.disabled = writeInput.value.trim().length < 8;
  });
  writeBtn.addEventListener('click', async () => {
    const ok = await processIdea(writeInput.value);
    if (ok) writeInput.value = '';
  });

  // Settings drawer
  document.getElementById('btn-save-keys').addEventListener('click', persistSettings);
  document.getElementById('drawer-overlay').addEventListener('click', closeSettings);

  // Show/hide key buttons
  document.querySelectorAll('.show-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type  = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Handle device back gesture / popstate (Android)
  window.addEventListener('popstate', () => {
    const active = Object.entries(views).find(([, el]) => el.classList.contains('active'));
    if (active && active[0] !== 'list') showView('list');
  });
}

// ── Service Worker ─────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
init();
