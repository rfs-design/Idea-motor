// ui.js — Rendering and canvas animation

// ── Constants ──────────────────────────────────────────────────────────────

export const ARCHETYPE_META = {
  web_project:   { label: 'Web Project',   color: '#3B82F6' },
  comunicazione: { label: 'Comunicazione', color: '#8B5CF6' },
  grafica_ai:    { label: 'Grafica AI',    color: '#EC4899' },
  presentazione: { label: 'Presentazione', color: '#F59E0B' },
  spot_tv:       { label: 'Spot / Video',  color: '#EF4444' },
  ricerca:       { label: 'Ricerca',       color: '#10B981' },
  altro:         { label: 'Altro',          color: '#6B7280' },
};

const TOOL_COLORS = {
  'Perplexity':   '#9333EA',
  'Claude':       '#D97706',
  'Claude Code':  '#C2410C',
  'Gemini':       '#4285F4',
  'ChatGPT':      '#10A37F',
  'OpenAI':       '#10A37F',
  'Midjourney':   '#EC4899',
  'Nano Banana':  '#F59E0B',
  'Kling':        '#7C3AED',
  'Sora':         '#0EA5E9',
  'PowerPoint':   '#D24726',
  'Figma':        '#A259FF',
};

const RATING_META = {
  debole:     { emoji: '🔴', label: 'Debole',     color: '#EF4444' },
  centrato:   { emoji: '🟡', label: 'Centrato',   color: '#F59E0B' },
  eccellente: { emoji: '🟢', label: 'Eccellente', color: '#10B981' },
};

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function archetypeColor(archetipo) {
  return (ARCHETYPE_META[archetipo] || ARCHETYPE_META.altro).color;
}
function archetypeLabel(archetipo) {
  return (ARCHETYPE_META[archetipo] || ARCHETYPE_META.altro).label;
}
function toolColor(tool) {
  return TOOL_COLORS[tool] || '#6B7280';
}
function chipStyle(color) {
  return `background:${color}18; color:${color}; border-color:${color}38;`;
}

// ── Project List ───────────────────────────────────────────────────────────

export function renderProjectList(projects, onCardClick) {
  const list       = document.getElementById('project-list');
  const emptyState = document.getElementById('empty-state');

  list.querySelectorAll('.project-card').forEach(el => el.remove());

  if (projects.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  projects.forEach(p => {
    const card = document.createElement('article');
    card.className   = 'project-card';
    card.dataset.id  = p.id;

    const color   = archetypeColor(p.archetipo);
    const label   = archetypeLabel(p.archetipo);
    const rMeta   = p.rating ? RATING_META[p.rating] : null;
    const date    = new Date(p.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const steps   = p.workflow?.length || 0;

    card.innerHTML = `
      <div class="card-top">
        <span class="archetype-chip" style="${chipStyle(color)}">${label}</span>
        <span class="card-date">${date}</span>
      </div>
      <h3 class="card-title">${esc(p.nome_progetto)}</h3>
      <p class="card-sintesi">${esc(p.sintesi)}</p>
      <div class="card-bottom">
        <span class="card-steps">${steps} step</span>
        ${rMeta ? `<span class="card-rating" style="color:${rMeta.color}">${rMeta.emoji} ${rMeta.label}</span>` : ''}
      </div>
    `;

    card.addEventListener('click', () => onCardClick(Number(p.id)));
    list.appendChild(card);
  });
}

// ── Project Detail ─────────────────────────────────────────────────────────

export function renderProjectDetail(project, { onRating }) {
  const container = document.getElementById('detail-content');
  const chip      = document.getElementById('detail-archetype-chip');

  const color = archetypeColor(project.archetipo);
  const label = archetypeLabel(project.archetipo);

  // Header chip
  chip.textContent = label;
  chip.setAttribute('style', chipStyle(color));

  // Workflow steps
  const workflowHTML = (project.workflow || []).map(s => {
    const tc = toolColor(s.tool);
    return `
      <div class="workflow-step">
        <div class="step-header">
          <span class="step-number">${s.step}</span>
          <span class="step-tool" style="${chipStyle(tc)}">${esc(s.tool)}</span>
        </div>
        <h4 class="step-azione">${esc(s.azione)}</h4>
        <details class="step-prompt-details">
          <summary>Prompt</summary>
          <pre class="step-prompt">${esc(s.prompt)}</pre>
        </details>
        <p class="step-output"><span class="output-label">Output →</span> ${esc(s.output_atteso)}</p>
      </div>
    `;
  }).join('');

  // Rating buttons
  const ratingBtns = Object.entries(RATING_META).map(([key, m]) => {
    const active = project.rating === key;
    const style  = active
      ? `background:${m.color}18; border-color:${m.color}; color:${m.color};`
      : '';
    return `<button class="rating-btn${active ? ' active' : ''}" data-rating="${key}" style="${style}">
              ${m.emoji} ${m.label}
            </button>`;
  }).join('');

  const rMeta = project.rating ? RATING_META[project.rating] : null;

  container.innerHTML = `
    <div class="detail-inner">
      <h2 class="detail-title">${esc(project.nome_progetto)}</h2>
      <p class="detail-sintesi">${esc(project.sintesi)}</p>

      <div class="consiglio-box">
        <span class="consiglio-label">💡 Consiglio IdeaMotor</span>
        <p class="consiglio-text">${esc(project.consiglio)}</p>
      </div>

      <div class="workflow-section">
        <h3 class="section-title">Workflow</h3>
        <div class="workflow-steps">${workflowHTML}</div>
      </div>

      <div class="rating-section">
        <h3 class="section-title">Come è andato?</h3>
        <p class="rating-sub">La tua valutazione migliora i prossimi workflow simili.</p>
        <div class="rating-buttons">${ratingBtns}</div>
        ${rMeta ? `<p class="current-rating" style="color:${rMeta.color}">${rMeta.emoji} Valutato: ${rMeta.label}</p>` : ''}
      </div>
    </div>
  `;

  container.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => onRating(project.id, btn.dataset.rating));
  });
}

// ── Waveform Canvas ────────────────────────────────────────────────────────

let _waveCanvas  = null;
let _waveCtx     = null;
let _waveW       = 0;
let _waveH       = 0;

/** Call once when entering capture mode */
export function initWaveform(canvas) {
  _waveCanvas = canvas;
  const dpr   = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  _waveW      = rect.width;
  _waveH      = rect.height;

  canvas.width  = _waveW * dpr;
  canvas.height = _waveH * dpr;
  _waveCtx      = canvas.getContext('2d');
  _waveCtx.scale(dpr, dpr);
}

/** Draw one frame — pass frequencyData from SpeechCapture, or null for idle */
export function drawWaveform(frequencyData) {
  if (!_waveCtx) return;

  const ctx = _waveCtx;
  const W   = _waveW;
  const H   = _waveH;

  ctx.clearRect(0, 0, W, H);

  const barCount    = Math.max(20, Math.floor(W / 9));
  const totalSlot   = W / barCount;
  const barW        = Math.max(2, totalSlot * 0.55);
  const gap         = (totalSlot - barW) / 2;
  const centerY     = H / 2;
  const t           = Date.now() / 500;

  for (let i = 0; i < barCount; i++) {
    let norm;

    if (frequencyData) {
      // Map bar index to a meaningful frequency band (skip DC, focus on 20Hz–8kHz)
      const freqIdx = Math.floor((i / barCount) * (frequencyData.length * 0.6));
      norm = Math.pow(frequencyData[freqIdx] / 255, 0.6);
      norm = Math.max(0.04, norm); // min visible height
    } else {
      // Idle: gentle sine wave animation
      norm = Math.sin(t + i * 0.45) * 0.18 + 0.22;
    }

    const halfH = Math.max(3, norm * centerY * 0.88);
    const x     = i * totalSlot + gap;

    // Draw mirrored bar (expands from center up and down)
    const drawHalf = (fromY, dir) => {
      const grad = ctx.createLinearGradient(0, fromY, 0, fromY + dir * halfH);
      grad.addColorStop(0,   'rgba(255, 92, 53, 0.85)');
      grad.addColorStop(0.6, 'rgba(255, 92, 53, 0.35)');
      grad.addColorStop(1,   'rgba(255, 92, 53, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, dir > 0 ? fromY : fromY - halfH, barW, halfH, 2);
      } else {
        ctx.rect(x, dir > 0 ? fromY : fromY - halfH, barW, halfH);
      }
      ctx.fill();
    };

    drawHalf(centerY, -1); // up
    drawHalf(centerY,  1); // down
  }
}
