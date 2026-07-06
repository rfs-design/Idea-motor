// speech.js — Web Speech API wrapper + Web Audio visualization

export class SpeechCapture {
  constructor({ onTranscript, onError, onStatusChange }) {
    this.onTranscript    = onTranscript    || (() => {});
    this.onError         = onError         || (() => {});
    this.onStatusChange  = onStatusChange  || (() => {});

    this.recognition    = null;
    this.audioCtx       = null;
    this.analyser       = null;
    this.stream         = null;
    this.isListening    = false;
    this.finalTranscript = '';
    this.lastInterim     = '';
  }

  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  static isIOS() {
    return /iP(hone|od|ad)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS desktop UA
  }

  async start() {
    if (!SpeechCapture.isSupported()) {
      this.onError('Speech recognition non supportato. Usa Safari su iOS o Chrome su Android.');
      return;
    }

    this.finalTranscript = '';
    this.lastInterim     = '';
    this.isListening     = true;

    // ── Speech Recognition ──
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous      = true;
    this.recognition.interimResults  = true;
    this.recognition.lang            = 'it-IT';

    this.recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          this.finalTranscript += r[0].transcript + ' ';
        } else {
          interim = r[0].transcript;
        }
      }
      this.lastInterim = interim;
      this.onTranscript(this.finalTranscript.trim(), interim);
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech') return; // silently ignore
      if (e.error === 'not-allowed') {
        this.onError('Permesso microfono negato. Controlla le impostazioni del browser.');
        return;
      }
      console.warn('SpeechRecognition error:', e.error);
    };

    // Auto-restart if recognition ends while still listening
    this.recognition.onend = () => {
      if (this.isListening) {
        try { this.recognition.start(); } catch (_) {}
      }
    };

    try {
      this.recognition.start();
      this.onStatusChange('listening');
    } catch (e) {
      this.onError('Impossibile avviare il riconoscimento vocale.');
      return;
    }

    // ── Audio Visualization ──
    // On iOS, opening getUserMedia here competes with SpeechRecognition for the mic
    // and silently kills the transcript. Skip it there: the waveform falls back to its
    // idle animation (drawWaveform handles null) and dictation keeps the mic to itself.
    if (SpeechCapture.isIOS()) {
      console.info('iOS: waveform mic disabled to protect speech recognition');
    } else {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.75;
        const src = this.audioCtx.createMediaStreamSource(this.stream);
        src.connect(this.analyser);
      } catch (e) {
        // Visualization fails silently — speech still works
        console.warn('Audio visualization unavailable:', e.message);
      }
    }
  }

  /** Returns frequency data array or null if unavailable */
  getFrequencyData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Stop and return the complete transcript */
  stop() {
    this.isListening = false;

    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
      this.recognition = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.analyser  = null;
    }

    // Include the last interim result. On iOS the engine often never flips results
    // to isFinal, so the visible transcript lives entirely in interim; without this,
    // "Elabora" sees an empty finalTranscript and wrongly reports "nessuna trascrizione".
    return (this.finalTranscript + ' ' + this.lastInterim).trim();
  }
}
