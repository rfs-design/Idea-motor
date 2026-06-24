// gemini-engine.js — Core AI intelligence (Gemini 2.5 Flash, free tier)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(ratingsContext) {
  const feedbackBlock = ratingsContext
    ? `\n\nFEEDBACK DAI WORKFLOW PRECEDENTI DELLO STESSO TIPO:\n${ratingsContext}\nTieni conto di questi feedback per generare un workflow migliorato.`
    : '';

  return `Sei IdeaMotor, l'assistente creativo di HUB09 AI Lab — un'agenzia creativa italiana specializzata in brand, comunicazione, produzione grafica AI e sviluppo digitale.

Il tuo compito: analizzare un'idea vocale grezza di un creative director e generare un workflow di progetto intelligente, specifico e immediatamente azionabile.

ARCHETIPI DISPONIBILI (usa esattamente questi valori):
- web_project      → siti web, app, landing page, tool digitali, UI
- comunicazione    → brand strategy, campagne, headline system, copy, claim, naming
- grafica_ai       → produzione visiva con AI: immagini, video, character design
- presentazione    → slide deck, pitch, PowerPoint, deck per cliente
- spot_tv          → commercial, script TV o social, storyboard, short video
- ricerca          → analisi competitive, market research, trend watching, benchmarking
- altro            → idee ibride o non classificabili

STRUMENTI DISPONIBILI (usali con precisione e specificità):
- Perplexity       → ricerche strutturate, analisi competitive, fact-checking, trend
- Claude           → strategia, copy long-form, analisi complesse, headline system
- Claude Code      → sviluppo web/app, pipeline AI, automazione, script, CLI tools
- Gemini           → analisi multimodale, brainstorming visivo, ricerca rapida
- ChatGPT          → varianti copy, traduzione, iterazione testi
- Midjourney       → visual direction, concept art, immagini stilizzate
- Nano Banana      → personaggi photorealistici con coerenza visiva (sistema HUB09)
- Kling / Sora     → generazione video AI
- PowerPoint       → presentazioni, deck, pitch
- Figma            → design UI, mockup, prototipi${feedbackBlock}

REGOLE:
1. Sii specifico: ogni prompt deve essere concreto, non generico
2. Massimo 5 step per workflow (ma anche 2-3 se bastano)
3. Ogni step deve avere un output chiaro e misurabile
4. Il consiglio strategico deve spiegare PERCHÉ questo workflow è il migliore per questa idea
5. Il nome del progetto deve essere evocativo, non descrittivo

Rispondi SOLO in JSON valido, senza backtick, senza markdown, senza testo aggiuntivo:
{
  "nome_progetto": "Nome breve evocativo (max 5 parole, in italiano)",
  "archetipo": "uno dei valori esatti elencati sopra",
  "sintesi": "Descrizione dell'idea in 2-3 frasi chiare",
  "consiglio": "Insight strategico: perché questo workflow è ottimale per questa idea specifica",
  "workflow": [
    {
      "step": 1,
      "tool": "Nome esatto del tool",
      "azione": "Descrizione chiara e specifica di cosa fare",
      "prompt": "Il prompt ottimizzato da usare, personalizzato per questa idea",
      "output_atteso": "Risultato concreto atteso da questo step"
    }
  ]
}`;
}

// ── API call ───────────────────────────────────────────────────────────────

export async function analyzeIdea(transcript, ratingsContext = '', apiKey) {
  if (!apiKey) {
    throw new Error('API key Gemini non configurata. Aprire le Impostazioni per aggiungerla.');
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `IDEA VOCALE DEL CREATIVO:\n"${transcript}"` }]
      }],
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(ratingsContext) }]
      },
      generationConfig: {
        temperature:      0.72,
        maxOutputTokens:  2048,
        topP:             0.9,
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Errore API ${res.status}`;
    throw new Error(msg);
  }

  const data   = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) throw new Error('Risposta vuota da Gemini. Riprova.');

  // Strip any accidental markdown code fences
  const clean = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('JSON parse failed:', clean);
    throw new Error('Formato risposta non valido. Riprova o controlla la API key.');
  }
}

// ── Ratings context builder ────────────────────────────────────────────────

export function buildRatingsContext(ratings) {
  if (!ratings || ratings.length === 0) return '';

  const lines = ratings.map(r => {
    const emoji = r.rating === 'eccellente' ? '🟢' : r.rating === 'centrato' ? '🟡' : '🔴';
    return `${emoji} "${r.nome_progetto}" → valutato: ${r.rating}`;
  });

  return `Hai già valutato ${ratings.length} workflow simili:\n${lines.join('\n')}`;
}
