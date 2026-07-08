// app.js — IdeaMotor main controller

import { getAllProjects, saveProject, getProject, updateRating, deleteProject, getRatingsByArchetype, importProjects } from './storage.js';
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

// ── Loading phrases (cycled while processing) ────────────────────────────────
const LOADING_PHRASES = [
  'Sto processando l\'idea…',
  'Le buone idee vanno lasciate respirare…',
  'Scelgo gli strumenti, uno per uno…',
  'Cucio i prompt sulla tua idea…',
  'Sto collegando i puntini…',
  'Vale la pena aspettare un\'idea buona…',
  'Metto in fila i passi del workflow…',
];
let loadingTimer = null;

function startLoadingPhrases() {
  const el = document.getElementById('processing-text');
  if (!el) return;
  let i = 0;
  el.textContent = LOADING_PHRASES[0];
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_PHRASES.length;
    el.textContent = LOADING_PHRASES[i];
  }, 2600);
}

function stopLoadingPhrases() {
  if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
}

// ── Install banner (biscotto) ────────────────────────────────────────────────
let deferredInstallPrompt = null;
const INSTALL_DISMISS_KEY  = 'im_install_dismissed_at';
const INSTALL_DISMISS_DAYS = 14;

// Capture the native install event (Android / desktop Chrome) as early as possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  maybeShowInstallBanner();
});

function installEligible() {
  // Already added to home / running as app → never show
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (standalone) return false;
  // Dismissed recently → stay quiet for a while
  try {
    const t = parseInt(localStorage.getItem(INSTALL_DISMISS_KEY) || '0', 10);
    if (t && (Date.now() - t) < INSTALL_DISMISS_DAYS * 86400000) return false;
  } catch (_) { /* localStorage unavailable */ }
  return true;
}

function maybeShowInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (!banner || !installEligible()) return;
  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add('visible'));
}

function dismissInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.classList.remove('visible');
    setTimeout(() => { banner.hidden = true; }, 350);
  }
  try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch (_) {}
}

function initInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (!banner) return;

  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  document.getElementById('install-close').addEventListener('click', dismissInstallBanner);
  document.getElementById('install-dismiss').addEventListener('click', dismissInstallBanner);
  document.getElementById('install-accept').addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();                       // native install (Android/desktop)
      try { await deferredInstallPrompt.userChoice; } catch (_) {}
      deferredInstallPrompt = null;
      dismissInstallBanner();
    } else if (isIOS) {
      const hint = document.getElementById('install-ios-hint');
      if (hint) hint.hidden = false;                        // iOS: show Add-to-Home instructions
    } else {
      dismissInstallBanner();
    }
  });

  // iOS never fires beforeinstallprompt → show after a short beat.
  // Other cases show when beforeinstallprompt fires (handled above).
  if (isIOS) setTimeout(maybeShowInstallBanner, 1200);
}

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
  initInstallBanner();
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

  // Let the user review and correct the dictated text before processing it.
  const writeInput = document.getElementById('write-input');
  const writeBtn   = document.getElementById('btn-write-process');
  const writeTitle = document.querySelector('.write-title');
  if (writeTitle) writeTitle.textContent = 'Rivedi e correggi';
  const writeHint = document.getElementById('write-hint');
  if (writeHint) writeHint.hidden = false;   // friendly note: only in dictation review
  writeInput.value  = transcript;
  writeBtn.disabled = transcript.trim().length < 8;
  showView('write');
  setTimeout(() => {
    writeInput.focus();
    const len = writeInput.value.length;
    writeInput.setSelectionRange(len, len); // cursor at end of the dictated text
  }, 250);
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
  startLoadingPhrases();

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

    stopLoadingPhrases();
    overlay.classList.remove('visible');
    await loadProjectList();
    await openProject(newId);
    return true;

  } catch (err) {
    stopLoadingPhrases();
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

// ── Backup: export / import history ────────────────────────────────────────
async function handleExport() {
  const projects = await getAllProjects();
  const payload  = { app: 'IdeaMotor', schema: 1, exported_at: new Date().toISOString(), projects };
  const json     = JSON.stringify(payload, null, 2);
  const fname    = `ideamotor-backup-${new Date().toISOString().slice(0, 10)}.json`;

  // Prefer the native share sheet with a file — most reliable on iOS standalone PWAs
  const file = new File([json], fname, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup IdeaMotor' }); }
    catch (e) { /* utente ha annullato: non fare il download di ripiego */ }
    return;
  }

  // Fallback: classic download
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // reset so the same file can be picked again
  if (!file) return;
  try {
    const data     = JSON.parse(await file.text());
    const projects = Array.isArray(data) ? data : (data.projects || []);
    if (!Array.isArray(projects) || projects.length === 0) {
      alert('Il file non contiene progetti validi.');
      return;
    }
    if (!confirm(`Importare ${projects.length} progetti? Verranno aggiunti allo storico attuale.`)) return;
    const n = await importProjects(projects);
    await loadProjectList();
    alert(`✓ Importati ${n} progetti.`);
  } catch (err) {
    alert('File non valido o illeggibile: ' + err.message);
  }
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
    const writeTitle = document.querySelector('.write-title');
    if (writeTitle) writeTitle.textContent = "Scrivi un'idea";
    const writeHint = document.getElementById('write-hint');
    if (writeHint) writeHint.hidden = true;   // hide the dictation note when writing fresh
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
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);

  // Backup: export / import history
  const importFile = document.getElementById('import-file');
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', handleImportFile);

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
  if (!('serviceWorker' in navigator)) return;

  // If a new SW takes control (new version deployed + activated), reload once so the
  // page runs the fresh assets. Guarded so it doesn't reload on the first-ever install.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });

  // updateViaCache:'none' → always re-fetch service-worker.js bypassing the HTTP cache
  // (GitHub Pages serves it with max-age=600, which otherwise delays updates ~10 min).
  navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' })
    .then(reg => { reg.update().catch(() => {}); })
    .catch(err => console.warn('SW registration failed:', err));
}

// ── Boot ───────────────────────────────────────────────────────────────────
// Block pinch-zoom (iOS ignores user-scalable=no in the viewport meta)
['gesturestart', 'gesturechange', 'gestureend'].forEach(evt =>
  document.addEventListener(evt, (e) => e.preventDefault())
);

init();
