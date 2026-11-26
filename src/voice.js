// Push-to-talk spell recognition. Nothing to install for players.
// Engines (both run at once when available; the first one that matches casts):
//  1) On-device Vosk (WebAssembly, small English model, ~41 MB). Downloaded once on first visit, then kept in the
//     browser's Cache Storage. Closed grammar limited to the spell words. Works in Chrome, Edge, Firefox, Safari, Quest.
//  2) Web Speech API (Chrome/Edge/Safari) as a fallback while Vosk loads, or if it cannot load. Open vocabulary,
//     so its text goes through the phonetic matcher below ("car", "core", "corpse" -> Corp Por).
//  3) Always: button casting (keyboard 1/2, Quest A/B).
// URL options: ?voice=vosk (only on-device), ?voice=web (only browser speech), ?lang=sv-SE (browser speech language).

export const SPELLS = [
  { id: 'corp', words: 'Corp Por', parts: ['corp', 'por'], solo: 0,
    joined: ['corppor', 'corpor', 'copper', 'corpora', 'corporal', 'corporate', 'carport', 'corpore', 'korppor'] },
  { id: 'flam', words: 'Vas Flam', parts: ['vas', 'flam'], solo: 1,
    joined: ['vasflam', 'vasflame', 'wasflame', 'fasflam', 'bossflame', 'vastflame'] },
];

// Rough phonetic skeleton: map sound-alike consonants together, drop vowels and h/w/y, drop a vowel-following r
// ("car" and "corp" both keep their r, "poor" -> "pr"). Swedish k/c/q all become k.
export function phon(w) {
  w = (w || '').toLowerCase().replace(/[^a-zåäö]/g, '');
  if (!w) return '';
  w = w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'k').replace(/ch/g, 'k').replace(/sh/g, 's')
       .replace(/^w/, 'v').replace(/[cqg]/g, 'k').replace(/z/g, 's').replace(/x/g, 'ks').replace(/b/g, 'p').replace(/d/g, 't');
  let out = '';
  for (const ch of w) { if ('aeiouyåäöhw'.includes(ch)) continue; if (out[out.length - 1] !== ch) out += ch; }
  return out;
}

export function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur; }
  return prev[n];
}

// Explicit sound-alikes that the phonetic skeleton alone would miss or score too low.
const ALIAS = {
  corp: ['car', 'core', 'corpse', 'corps', 'court', 'cork', 'cop', 'korp', 'corn', 'kor', 'cor', 'cope', 'crop', 'carp', 'harp', 'quarry', 'call', 'curb', 'cob', 'cup', 'cap', 'cart', 'card', 'cord', 'gorp'],
  por: ['por', 'poor', 'pour', 'pore', 'power', 'paw', 'pa', 'par', 'port', 'pork', 'pure', 'bore', 'boar', 'four', 'for', 'pool', 'pro', 'per', 'pearl', 'paul', 'poll'],
  vas: ['vas', 'was', 'vast', 'vass', 'bass', 'boss', 'fast', 'vase', 'vaz', 'vos', 'bus', 'buzz', 'vis', 'fuss', 'mass', 'pass', 'wass', 'voss'],
  flam: ['flam', 'flame', 'flames', 'flan', 'flem', 'phlegm', 'flum', 'plum', 'slam', 'clam', 'glam', 'blam', 'flamm', 'flom', 'from', 'film'],
};

// Score how well one heard token sounds like one spell word. 1 = certain, 0 = no match.
export function wordScore(tok, word) {
  const t = tok.toLowerCase().replace(/[^a-zåäö]/g, ''); if (!t) return 0;
  if (t === word) return 1;
  if (ALIAS[word] && ALIAS[word].includes(t)) return 0.9;
  const a = phon(t), b = phon(word); if (!a || !b) return 0;
  const d = lev(a, b);
  if (d === 0) return 0.85;
  if (d === 1 && b.length >= 2 && a[0] === b[0]) return 0.6;
  return 0;
}

// Match a transcript (one alternative). Returns { spell, score, matched } or null.
// final=false (interim text while the key is held) needs both words; final=true (release) also accepts the first
// word alone, because a push-to-talk press with "corpse" in it is almost certainly a Corp Por attempt.
export function matchSpell(text, final = true) {
  const raw = (text || '').toLowerCase().replace(/\[unk\]/g, ' ');
  const toks = raw.split(/[^a-zåäö]+/).filter(Boolean);
  if (!toks.length) return null;
  let best = null;
  const consider = (spell, score, how) => { if (!best || score > best.score) best = { spell, score, matched: how }; };
  for (const sp of SPELLS) {
    const [w1, w2] = sp.parts;
    // joined forms like "copper", "corpor"
    const squash = toks.join('');
    for (const j of sp.joined) {
      if (squash.includes(j)) consider(sp, 0.95, 'joined');
      for (const t of toks) if (t.length >= 5 && lev(phon(t), phon(j)) <= 1) consider(sp, 0.75, 'joined~');
    }
    for (let i = 0; i < toks.length; i++) {
      const s1 = wordScore(toks[i], w1);
      const s2 = i + 1 < toks.length ? wordScore(toks[i + 1], w2) : 0;
      if (s1 && s2) consider(sp, Math.min(1, (s1 + s2) / 2 + 0.1), 'both');
      // One word alone counts only on release, and only for the word that is distinctive for that spell
      // ("corpse" -> Corp Por, "flame" -> Vas Flam), and only when it is a clear sound-alike.
      const solo = wordScore(toks[i], sp.parts[sp.solo]);
      if (final && solo >= 0.85) consider(sp, solo * 0.8, 'single');
    }
  }
  return best && best.score >= 0.48 ? best : null;
}

// Back-compat with older callers.
export function detectSpell(text, final = true) { const m = matchSpell(text, final); return m ? m.spell : null; }

const VOSK_GRAMMAR = ['corp por', 'core poor', 'core pour', 'corps poor', 'car poor', 'court poor', 'cork poor', 'copper',
  'corporal', 'core', 'corps', 'corpse', 'car', 'poor', 'pour',
  'vast flame', 'was flame', 'boss flame', 'bus flame', 'fast flame', 'flame', '[unk]'];

// Caching: vosk-browser keeps the unpacked model in IndexedDB keyed by its URL, so the 41 MB download happens once
// per browser. Keep the model URL stable (no blob: URLs, they would store a new copy on every visit).

export class Voice {
  constructor({ onSpell, onText, onState, onMatch }) {
    this.onSpell = onSpell; this.onText = onText; this.onState = onState; this.onMatch = onMatch;
    this.onStatus = (t) => this.onText && this.onText(t, false, 'status');
    const q = new URLSearchParams(location.search);
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const force = q.get('voice');
    this.useWeb = !!this.SR && force !== 'vosk';
    this.useVosk = force !== 'web';
    this.lang = q.get('lang') || 'en-US';
    this.mode = this.useVosk ? 'vosk' : 'webspeech';
    this.active = false; this.fired = false; this.vosk = null; this.voskLoading = null; this.voskFailed = false;
    this.lastHeard = ''; this.loadMs = null;
  }
  label() {
    const parts = [];
    if (this.useVosk) parts.push(this.vosk ? 'on-device ready' : (this.voskFailed ? 'on-device unavailable' : 'on-device (downloads once)'));
    if (this.useWeb) parts.push('browser speech');
    return parts.join(' + ') || 'buttons only';
  }
  _handle(text, final, src = '') {
    if (!this.active && !final) return;
    text = (text || '').replace(/\[unk\]/g, '…').trim(); if (!text || text === '…') return;
    this.lastHeard = text;
    this.onText && this.onText(text, final, src);
    if (this.fired) return;
    const m = matchSpell(text, final);
    if (m) { this.fired = true; this.onMatch && this.onMatch(text, m.spell.words, m.score, src); this.onSpell(m.spell.id, text, m); }
    else if (final && src !== 'status') this.onMatch && this.onMatch(text, null, 0, src);
  }
  // Handle every alternative of a Web Speech result; pick the best-scoring one.
  _handleAlts(alts, final) {
    let best = null;
    for (const a of alts) { const m = matchSpell(a, final); if (m && (!best || m.score > best.m.score)) best = { a, m }; }
    this._handle(best ? best.a : alts[0], final, 'web');
  }
  async start() {
    this.active = true; this.fired = false; this.onState && this.onState(true);
    if (this.useVosk && !this.voskFailed) this._startVosk();
    if (this.useWeb) this._startWeb();
  }
  _startWeb() {
    try {
      const r = new this.SR(); this.rec = r;
      r.lang = this.lang; r.interimResults = true; r.maxAlternatives = 8; r.continuous = true;
      // Bias toward the spell words where the browser supports it (ignored elsewhere).
      try {
        const G = window.SpeechGrammarList || window.webkitSpeechGrammarList;
        if (G) { const g = new G(); g.addFromString('#JSGF V1.0; grammar spells; public <spell> = corp por | vas flam ;', 1); r.grammars = g; }
      } catch (e) {}
      try { if (window.SpeechRecognitionPhrase) r.phrases = [new SpeechRecognitionPhrase('Corp Por', 5), new SpeechRecognitionPhrase('Vas Flam', 5)]; } catch (e) {}
      r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i];
        const alts = []; for (let a = 0; a < res.length; a++) alts.push(res[a].transcript);
        this._handleAlts(alts, res.isFinal); } };
      r.onerror = (e) => { if (['network', 'not-allowed', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
        this.useWeb = false;
        if (!this.useVosk) { this.useVosk = true; if (this.active) this._startVosk(); }
        this.onStatus('Browser speech unavailable (' + e.error + '), using on-device recognition'); } };
      r.start();
    } catch (err) { this.useWeb = false; if (!this.useVosk) { this.useVosk = true; this._startVosk(); } }
  }
  stop() {
    this.active = false; this.onState && this.onState(false);
    if (this.rec) { try { this.rec.stop(); } catch (e) {} this.rec = null; }
    if (this.vosk && this.vosk.rec) { try { this.vosk.rec.retrieveFinalResult(); } catch (e) {} }
  }
  // Called from the Enter click (a user gesture): ask for the mic up front and start the one-time model download,
  // so the first cast does not wait on a permission prompt or a 41 MB download.
  prepare() {
    if (this.useVosk) { this._loadVosk().catch(() => {}); return; }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
  }
  async _loadVosk() {
    if (this.vosk) return this.vosk;
    if (this.voskLoading) return this.voskLoading;
    const t0 = performance.now();
    this.voskLoading = (async () => {
      const say = (t) => { if (!this.active) this.onStatus && this.onStatus(t); };
      say('Loading on-device speech (41 MB, only the first time)…');
      if (!window.Vosk) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = window.__VOSK_JS_URL || 'vendor/vosk.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const src = new URL(window.__VOSK_MODEL_URL || 'assets/vosk/model.tar.gz', location.href).href;
      const model = await window.Vosk.createModel(src);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      const ctx = new AudioContext(); const msrc = ctx.createMediaStreamSource(stream);
      const rec = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify(VOSK_GRAMMAR));
      rec.on('result', (m) => { const t = m.result && m.result.text; if (t) this._handle(t, true, 'vosk'); });
      rec.on('partialresult', (m) => { const t = m.result && m.result.partial; if (t) this._handle(t, false, 'vosk'); });
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => { if (this.active) { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} } };
      msrc.connect(proc); proc.connect(ctx.destination);
      this.vosk = { model, rec, ctx };
      this.loadMs = Math.round(performance.now() - t0);
      say('On-device speech ready. Hold and say “Corp Por”.');
      return this.vosk;
    })();
    this.voskLoading.catch(() => { this.voskFailed = true; this.voskLoading = null; });
    return this.voskLoading;
  }
  async _startVosk() {
    try { const v = await this._loadVosk(); if (v.ctx.state !== 'running') v.ctx.resume(); }
    catch (e) { if (!this.useWeb) this.onStatus('No speech recognition here. Use A / key 1 to cast.'); }
  }
}
