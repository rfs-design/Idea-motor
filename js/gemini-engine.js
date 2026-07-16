// gemini-engine.js — Core AI intelligence (Gemini 2.5 Flash, free tier)

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(ratingsContext) {
  const feedbackBlock = ratingsContext
    ? `\n\nFEEDBACK DAI WORKFLOW PRECEDENTI DELLO STESSO TIPO:\n${ratingsContext}\nTieni conto di questi feedback per generare un workflow migliorato.`
    : '';

  return `Sei IdeaMotor, un assistente creativo per chi lavora nel campo creativo: brand, comunicazione, produzione grafica AI, sviluppo digitale.

Il tuo compito: partire dall'idea grezza di chi ti parla — un professionista della creatività — e restituire un workflow di progetto intelligente, specifico e immediatamente azionabile. Non ti limiti a trascrivere l'idea in prompt: la interroghi, ne fai emergere l'ambizione, e proponi il percorso di lavoro che le rende giustizia.

PRIMA DI PRODURRE IL WORKFLOW, RAGIONA SULL'IDEA (e versa questo ragionamento nei campi "sintesi" e "lettura_strategica"):
- Qual è l'ambizione reale dietro l'idea, oltre la lettera di ciò che è stato detto?
- Chi è il pubblico, qual è il tono, quali riferimenti o territori estetici evoca?
- Dov'è la tensione creativa interessante, l'angolo non ovvio da cui aggredirla?
Parti sempre dal presupposto dettato dall'utente, ma spingiti oltre la sua superficie: aggiungi ciò che un buon direttore creativo vedrebbe e che il brief grezzo non dice.

ARCHETIPI DISPONIBILI (usa esattamente questi valori):
- web_project      → siti web, app, landing page, tool digitali, UI
- comunicazione    → brand strategy, campagne, headline system, copy, claim, naming
- grafica_ai       → produzione visiva con AI: immagini, video, character design
- presentazione    → slide deck, pitch, PowerPoint, deck per cliente
- spot_tv          → commercial, script TV o social, storyboard, short video
- ricerca          → analisi competitive, market research, trend watching, benchmarking
- altro            → idee ibride o non classificabili

STRUMENTI AI DISPONIBILI (accettano un prompt — il "tool" di ogni step DEVE essere uno di questi):
- Perplexity       → ricerche strutturate, analisi competitive, fact-checking, trend
- Claude           → strategia, copy long-form, analisi complesse, headline system
- Claude Code      → sviluppo web/app, pipeline AI, automazione, script, CLI tools
- Gemini           → analisi multimodale, brainstorming visivo, ricerca rapida
- ChatGPT          → varianti copy, traduzione, iterazione testi
- Midjourney       → visual direction, concept art, immagini stilizzate
- Nano Banana      → personaggi photorealistici con coerenza visiva
- Kling / Sora     → generazione video AI

DESTINAZIONI (dove atterra il risultato — NON accettano prompt, NON usarle mai come "tool" di uno step):
- PowerPoint / Keynote → presentazioni, deck, pitch
- Figma                → design UI, mockup, prototipi
Se il deliverable finale è un deck o un file di design, NON creare uno step con tool "PowerPoint" o "Figma": genera il contenuto con uno strumento AI e cita la destinazione in "azione" e "output_atteso" (es. "…struttura pronta da impaginare in PowerPoint").${feedbackBlock}

ANATOMIA DI UN PROMPT RICCO (ogni campo "prompt" deve averla):
Ogni prompt è autosufficiente e pronto da incollare nello strumento indicato. Non è un'istruzione di una riga: è un brief operativo che, quando pertinente, contiene —
- RUOLO: la competenza/persona che lo strumento deve assumere ("Agisci come…")
- CONTESTO: il progetto, il brand, il pubblico, e ciò che gli step precedenti hanno prodotto
- OBIETTIVO: cosa deve produrre esattamente
- VINCOLI: lunghezza, stile, tono, riferimenti da rispettare, cosa evitare
- FORMATO DELL'OUTPUT: la struttura attesa della risposta
- CRITERI DI QUALITÀ: come si riconosce un buon risultato
Scrivi prompt densi e concreti, ricchi dei dettagli specifici di QUESTA idea. Meglio un prompt lungo e preciso che una riga generica. Vai a capo con \\n dove serve leggibilità.

REGOLE:
1. Anti-genericità: se potresti riusare un prompt tale e quale per un altro progetto, è troppo generico. Riscrivilo con i dettagli di questa idea.
2. Usa quanti step servono davvero (tipicamente 3-5): non gonfiare, non impoverire. Ogni step aggiunge qualcosa che il precedente non poteva dare, e alimenta il successivo.
3. Ogni step ha un output chiaro e misurabile.
4. Il "consiglio" spiega PERCHÉ questo percorso è il migliore per QUESTA idea specifica, non in generale.
5. Il nome del progetto è evocativo, non descrittivo.
6. Il progetto è di chi ti sta parlando. Non nominare MAI studi, agenzie o aziende che non siano esplicitamente nell'idea dell'utente — men che meno chi ha creato questa app. Nei prompt scrivi "il progetto" o il brand citato dall'utente, mai il nome di uno studio che non ti è stato dato.
7. Il "tool" di ogni step dev'essere uno STRUMENTO AI della lista sopra, mai una destinazione (PowerPoint, Figma, Keynote).

Rispondi SOLO in JSON valido, senza backtick, senza markdown, senza testo aggiuntivo:
{
  "nome_progetto": "Nome breve evocativo (max 5 parole, in italiano)",
  "archetipo": "uno dei valori esatti elencati sopra",
  "sintesi": "L'idea in 2-3 frasi che ne colgono l'ambizione, non solo la lettera",
  "lettura_strategica": "La tua lettura dell'idea in 3-4 frasi: pubblico, tono, tensione creativa, l'angolo non ovvio da cui parti",
  "consiglio": "Insight strategico: perché questo workflow è ottimale per questa idea specifica",
  "workflow": [
    {
      "step": 1,
      "tool": "Nome esatto del tool",
      "azione": "Descrizione chiara e specifica di cosa fare in questo step",
      "prompt": "Il prompt completo e autosufficiente secondo l'ANATOMIA sopra — può essere lungo e articolato su più righe",
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

  let res;
  try {
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
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
          maxOutputTokens:  12288,
          topP:             0.9,
          responseMimeType: 'application/json',
        }
      })
    });
  } catch (e) {
    // Network-level failure: offline, connection dropped, or the request was killed
    // mid-flight (more likely on long generations). Give a human message, not a
    // raw "TypeError: Load failed".
    throw new Error('Connessione interrotta o richiesta troppo lunga. Controlla la rete e riprova.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Errore API ${res.status}`;
    throw new Error(msg);
  }

  const data   = await res.json();
  // Gemini 2.5 may split the answer across multiple parts — concatenate them all
  const parts   = data?.candidates?.[0]?.content?.parts;
  const rawText = Array.isArray(parts) ? parts.map(p => (p && p.text) || '').join('').trim() : '';

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
