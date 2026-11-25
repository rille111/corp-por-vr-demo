// Procedural WebAudio sound design. No audio files needed.
export class Sound {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // reverb for the dungeon
    this.verb = this.ctx.createConvolver(); this.verb.buffer = this._impulse(2.8, 2.2);
    this.verbGain = this.ctx.createGain(); this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.noiseBuf = this._noise(2);
    this._ambient();
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  _impulse(sec, decay) {
    const r = this.ctx.sampleRate, len = r * sec, b = this.ctx.createBuffer(2, len, r);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  _noise(sec) {
    const r = this.ctx.sampleRate, b = this.ctx.createBuffer(1, r * sec, r), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
  }
  _out(node, wet = 0.5) { node.connect(this.master); const s = this.ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.verb); }
  _noiseSrc(loop = false) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; return s; }
  _ambient() {
    const c = this.ctx, n = this._noiseSrc(true), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = c.createGain(); g.gain.value = 0.10; n.connect(lp); lp.connect(g); g.connect(this.master); n.start();
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    const drone = c.createOscillator(), dg = c.createGain(); drone.type = 'sawtooth'; drone.frequency.value = 41.2; dg.gain.value = 0.012;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 120; drone.connect(dlp); dlp.connect(dg); dg.connect(this.master); drone.start();
    const drip = () => { if (!this.ctx) return; this.drip(); setTimeout(drip, 2500 + Math.random() * 6000); }; setTimeout(drip, 3000);
    const crackle = () => { this.crackle(); setTimeout(crackle, 60 + Math.random() * 380); }; crackle();
  }
  drip() {
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(1400 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); this._out(g, 1.2); o.start(t); o.stop(t + 0.25);
  }
  crackle() {
    const c = this.ctx, t = c.currentTime, n = this._noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 2500; bp.Q.value = 2;
    g.gain.setValueAtTime(0.012 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(bp); bp.connect(g); this._out(g, 0.2); n.start(t, Math.random()); n.stop(t + 0.04);
  }
  castStart(dur = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.10, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    [98, 147, 196.5].forEach((f, i) => { const o = c.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + dur); o.connect(g); o.start(t); o.stop(t + dur + 0.2); });
    const n = this._noiseSrc(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(5000, t + dur); bp.Q.value = 6;
    const ng = c.createGain(); ng.gain.value = 0.4; n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t); n.stop(t + dur + 0.2);
    this._out(g, 0.6);
  }
  bolt() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const n = this._noiseSrc(), hp = c.createBiquadFilter(), g = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 900;
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.12); g.gain.setValueAtTime(0.5, t + 0.13); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(hp); hp.connect(g); this._out(g, 0.8); n.start(t); n.stop(t + 0.6);
    const n2 = this._noiseSrc(), lp = c.createBiquadFilter(), g2 = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(60, t + 1.8);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(1.0, t + 0.06); g2.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    n2.connect(lp); lp.connect(g2); this._out(g2, 1.0); n2.start(t, 0.3); n2.stop(t + 2.3);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.25);
    og.gain.setValueAtTime(0.15, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(og); this._out(og, 0.5); o.start(t); o.stop(t + 0.32);
  }
  fizzle() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = this._noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); n.connect(lp); lp.connect(g); this._out(g, 0.5); n.start(t); n.stop(t + 0.85);
  }
  roar(len = 1.6, pitch = 1) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.18); g.gain.setValueAtTime(0.5, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.setValueAtTime(380 * pitch, t); f1.frequency.linearRampToValueAtTime(260 * pitch, t + len); f1.Q.value = 3;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900 * pitch; f2.Q.value = 5;
    const mix = c.createGain(); f1.connect(mix); f2.connect(mix); mix.connect(g);
    [52, 77, 104].forEach(f => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * pitch, t); o.frequency.linearRampToValueAtTime(f * 0.8 * pitch, t + len);
      const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 7 + Math.random() * 5; vg.gain.value = f * 0.06; v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + len);
      o.connect(f1); o.connect(f2); o.start(t); o.stop(t + len); });
    const n = this._noiseSrc(), ng = c.createGain(); ng.gain.value = 0.5; n.connect(ng); ng.connect(f1); n.start(t); n.stop(t + len);
    this._out(g, 0.9);
  }
  whoosh() {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = this._noiseSrc(), bp = c.createBiquadFilter(), g = c.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.5; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1400, t + 1.0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    n.connect(bp); bp.connect(g); this._out(g, 0.6); n.start(t); n.stop(t + 1.35);
  }
  boom(v = 0.8) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = this._noiseSrc(), lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(80, t + 1.0);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); n.connect(lp); lp.connect(g); this._out(g, 0.9); n.start(t); n.stop(t + 1.25);
  }
}
