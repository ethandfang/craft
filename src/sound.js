// ============================================================
// Procedural sound via the Web Audio API — no asset files.
// Must be unlocked from a user gesture (see input.onGesture).
// ============================================================
export class Sound {
  constructor() { this.ctx = null; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  }

  // Short filtered-noise burst (digging / breaking).
  _noise(dur, freq, gain) {
    if (!this.ctx) return;
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start();
  }

  // Short pitched blip (placing).
  _blip(freq, dur, type = 'square') {
    if (!this.ctx) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  dig()   { this._noise(0.08, 220 + Math.random() * 80, 0.25); }
  hurt()  { this._blip(95, 0.18, 'sawtooth'); }
  break() { this._noise(0.16, 180 + Math.random() * 60, 0.4); }
  place() { this._blip(160 + Math.random() * 40, 0.09); }
  step()  { this._noise(0.05, 120 + Math.random() * 40, 0.12); }
  jump()  { this._blip(300, 0.08, 'sine'); }
}
