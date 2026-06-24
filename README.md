# IdeaMotor ◎

> Cattura idee vocali → genera workflow AI azionabili → impara dai tuoi feedback.
> HUB09 AI Lab · 2025

---

## Cos'è

IdeaMotor è una PWA (Progressive Web App) installabile su iPhone e Android che permette di:

1. **Catturare un'idea vocale** premendo il pulsante mic
2. **Farla elaborare da Gemini** che riconosce l'archetipo (web, comunicazione, grafica AI, presentazione…) e genera un workflow step-by-step con i tool giusti
3. **Valutare il workflow** (Debole / Centrato / Eccellente) — il feedback migliora automaticamente i prossimi workflow dello stesso tipo

---

## Stack

- Vanilla JS (ES modules, no build step)
- CSS custom properties + Google Fonts (Syne + DM Sans)
- IndexedDB per storage locale dei progetti
- Web Speech API per trascrizione vocale
- Web Audio API per visualizzazione waveform
- Gemini 1.5 Flash (free tier) come motore AI
- PWA: manifest + service worker per installazione offline

---

## Setup

### 1. Installa e deploy

Deploy consigliato: **Netlify** o **Vercel** (drag & drop della cartella, zero config).

```bash
# oppure servi in locale per test
npx serve .
# o: python3 -m http.server 8080
```

> ⚠️ Web Speech API richiede HTTPS. In locale funziona su `localhost`.

### 2. Genera le icone PNG (una tantum)

```bash
cd icons
npm install sharp
node generate-icons.js
```

### 3. Configura le API key

Apri l'app → ⚙️ Impostazioni → inserisci la tua Gemini API key.

Ottieni una chiave gratuita su [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 4. Installa come app su iPhone

Apri in Safari → **Condividi** → **Aggiungi a schermata Home**

### 5. Collega all'Action Button iOS

**Impostazioni iPhone** → Accessibilità → Action Button → Scorciatoie → crea una shortcut che apre l'URL dell'app.

---

## Struttura

```
ideamotor/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── style.css
├── js/
│   ├── app.js             # Controller principale
│   ├── storage.js         # IndexedDB (progetti + rating)
│   ├── settings.js        # Gestione API key
│   ├── speech.js          # Web Speech API wrapper
│   ├── gemini-engine.js   # Motore AI Gemini
│   └── ui.js              # Rendering + canvas waveform
├── icons/
│   ├── icon.svg
│   ├── icon-192.png       # generare con generate-icons.js
│   ├── icon-512.png
│   ├── apple-touch-icon.png
│   └── generate-icons.js
├── .gitignore
├── README.md
├── DECISIONS.md           # gitignored — log decisioni + API key
└── .env.local             # gitignored
```

---

## Archetipi riconosciuti

| Archetipo     | Quando                                      |
|---------------|---------------------------------------------|
| web_project   | Siti, app, landing page, tool digitali      |
| comunicazione | Brand, campagne, headline, copy, naming     |
| grafica_ai    | Immagini e video AI (Midjourney, Nano Banana, Kling) |
| presentazione | Slide deck, pitch, PowerPoint               |
| spot_tv       | Script TV/social, storyboard, commercial    |
| ricerca       | Analisi competitive, trend, benchmarking    |
| altro         | Idee ibride o non classificabili            |
