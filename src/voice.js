// Push-to-talk spell recognition.
// 1) Web Speech API when the browser has it (desktop Chrome/Edge, some Android).
// 2) Fallback: on-device Vosk (WASM, small English model) with a closed grammar of sound-alikes.
// 3) Always: button casting (keyboard 1/2, Quest A/B).

const SPELLS = [
  { id: 'corp', words: 'Corp Por', keys: ['corppor', 'corpor', 'copper', 'corepoor', 'corepour'] },
  { id: 'flam', words: 'Vas Flam', keys: ['vasflam', 'vasflame', 'bossflame', 'wasflam', 'fasflam'] },
];

function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur; }
  return prev[n];
}

export function detectSpell(text) {
  const s = (text || '').toLowerCase().replace(/[^a-z]/g, '');
  if (s.length < 4) return null;
  let best = null, bestD = 9;
  for (const sp of SPELLS) for (const k of sp.keys) {
    const tol = k.length >= 7 ? 2 : 1;
    for (let L = Math.max(4, k.length - 2); L <= k.length + 2; L++) for (let i = 0; i + L <= s.length; i++) {
      const d = lev(s.substr(i, L), k);
      if (d <= tol && d < bestD) { bestD = d; best = sp; }
    }
  }
  return best;
}

export class Voice {
  constructor({ onSpell, onText, onState }) {
    this.onSpell = onSpell; this.onText = onText; this.onState = onState;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.mode = SR ? 'webspeech' : 'vosk';
    this.SR = SR; this.active = false; this.fired = false; this.vosk = null; this.voskLoading = null;
    const q = new URLSearchParams(location.search); if (q.get('voice') === 'vosk') this.mode = 'vosk';
  }
  label() { return this.mode === 'webspeech' ? 'Browser speech' : (this.vosk ? 'On-device (Vosk)' : 'On-device (loading on first use)'); }
  _handle(text, final) {
    if (!this.active && !final) return;
    text = (text || '').replace(/\[unk\]/g, '…').trim(); if (!text) return;
    this.onText && this.onText(text, final);
    if (this.fired) return;
    const sp = detectSpell(text);
    if (sp) { this.fired = true; this.onSpell(sp.id, text); }
  }
  async start() {
    this.active = true; this.fired = false; this.onState && this.onState(true);
    if (this.mode === 'webspeech') {
      try {
        const r = new this.SR(); this.rec = r;
        r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = true;
        r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i];
          for (let a = 0; a < res.length; a++) this._handle(res[a].transcript, res.isFinal); } };
        r.onerror = (e) => { if (['network', 'not-allowed', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
          this.onText && this.onText('Browser speech unavailable (' + e.error + '), switching to on-device recognition', true);
          this.mode = 'vosk'; if (this.active) this._startVosk(); } };
        r.start();
      } catch (err) { this.mode = 'vosk'; this._startVosk(); }
    } else this._startVosk();
  }
  stop() {
    this.active = false; this.onState && this.onState(false);
    if (this.rec) { try { this.rec.stop(); } catch (e) {} this.rec = null; }
    if (this.vosk && this.vosk.rec) { try { this.vosk.rec.retrieveFinalResult(); } catch (e) {} }
  }
  // Called from the Enter click (a user gesture): ask for the mic up front, and preload Vosk when it is the active engine,
  // so the first cast inside the headset does not wait on a permission prompt or a 40 MB download.
  prepare() {
    if (this.mode === 'vosk') { this._loadVosk().catch(() => {}); return; }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
  }
  async _loadVosk() {
    if (this.vosk) return this.vosk;
    if (this.voskLoading) return this.voskLoading;
    this.voskLoading = (async () => {
      this.onText && this.onText('Loading on-device speech model (40 MB, once)…', false);
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = window.__VOSK_JS_URL || 'vendor/vosk.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const model = await window.Vosk.createModel(new URL(window.__VOSK_MODEL_URL || 'assets/vosk/model.tar.gz', location.href).href);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream);
      const grammar = JSON.stringify(['core poor', 'core pour', 'corp poor', 'copper', 'court poor', 'core', 'poor', 'boss flame', 'was flam', 'vast flame', 'flame', '[unk]']);
      const rec = new model.KaldiRecognizer(ctx.sampleRate, grammar);
      rec.on('result', (m) => { const t = m.result && m.result.text; if (t) this._handle(t, true); });
      rec.on('partialresult', (m) => { const t = m.result && m.result.partial; if (t) this._handle(t, false); });
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => { if (this.active) { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} } };
      src.connect(proc); proc.connect(ctx.destination);
      this.vosk = { model, rec, ctx };
      this.onText && this.onText('On-device speech ready. Hold and say “Corp Por”.', false);
      return this.vosk;
    })();
    return this.voskLoading;
  }
  async _startVosk() {
    try { const v = await this._loadVosk(); if (v.ctx.state !== 'running') v.ctx.resume(); }
    catch (e) { this.onText && this.onText('No speech recognition here. Use A / key 1 to cast.', true); }
  }
}
