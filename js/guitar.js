// GuitarClear's shared parts: note maths, real string sets, a WebAudio plucked-string synth
// with a small amp, and 3D acoustic and electric guitars.
// Guitars are built in metres: x runs along the guitar from the tail (x = 0) to the headstock,
// y across the strings (the low E string on the +y side), z out of the top towards the player.
import { THREE, M, box, beam, clamp, canvasTexture } from './kit.js';
import { audio } from './ui.js';

const TAU = Math.PI * 2;
export const G = 9.80665;                   // m/s², kilograms-force to newtons
export const LB = 0.45359237;               // kg per pound
export const INCH = 0.0254;
export const E_STEEL = 2.0e11;              // Young's modulus of steel string wire, Pa
export const RHO_STEEL = 7850;              // kg/m³

// ---------------------------------------------------------------- notes
// MIDI numbers: 40 = E2, 45 = A2, 50 = D3, 55 = G3, 59 = B3, 64 = E4. A4 (69) = 440 Hz.
export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const midiFreq = (m) => 440 * 2 ** ((m - 69) / 12);
export const midiName = (m) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
export function nearest(f) {
  const x = 69 + 12 * Math.log2(f / 440), m = Math.round(x);
  return { m, cents: (x - m) * 100, name: midiName(m) };
}
export const TUNING = [40, 45, 50, 55, 59, 64];          // standard tuning, low E first
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// ---------------------------------------------------------------- string sets
// Scale length 25.5 in (647.7 mm), the length the makers' tension charts use.
// Acoustic: D'Addario EJ16 phosphor bronze "Light" 12–53. Electric: D'Addario EXL110 nickel wound 10–46.
// Tensions in pounds at standard pitch, from D'Addario's published figures (EJ16 product page;
// the D'Addario tension chart uses T = UW·(2Lf)²/386.4 on a 25.5 in scale).
export const SCALE_M = 25.5 * INCH;
export const SETS = {
  acoustic: {
    name: 'Light acoustic set, 0.012 to 0.053 in',
    gauge: [0.053, 0.042, 0.032, 0.024, 0.016, 0.012],
    wound: [true, true, true, true, false, false],
    lb: [24.9, 28.9, 29.9, 30.1, 23.3, 23.4],     // 160.5 lb ≈ 72.8 kg (daddario.com, EJ16)
  },
  electric: {
    name: 'Regular electric set, 0.010 to 0.046 in',
    gauge: [0.046, 0.036, 0.026, 0.017, 0.013, 0.010],
    wound: [true, true, true, false, false, false],
    lb: [16.91, 19.04, 18.38, 16.58, 15.39, 16.22], // ≈ 102.5 lb ≈ 46.5 kg (EXL110)
  },
};
// Mass per metre from Mersenne: T = (2Lf)²·μ.
export function stringInfo(kind, i) {
  const set = SETS[kind], f = midiFreq(TUNING[i]), T = set.lb[i] * LB * G;
  const mu = T / (2 * SCALE_M * f) ** 2;
  const d = set.gauge[i] * INCH;
  return { i, name: STRING_NAMES[i], f, T, kg: T / G, lb: set.lb[i], mu, d, wound: set.wound[i], gauge: set.gauge[i] };
}
export const totalKg = (kind) => SETS[kind].lb.reduce((a, b) => a + b, 0) * LB;
export const freqFrom = (L, T, mu) => Math.sqrt(T / mu) / (2 * L);
// Fret n sits at d = L(1 − 2^(−n/12)) from the nut.
export const fretDist = (n, L = SCALE_M) => L * (1 - 2 ** (-n / 12));

// ---------------------------------------------------------------- chords
// Frets for strings low E → high E; -1 = not played, 0 = open. Fingers for the diagram (0 = none).
export const CHORDS = {
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
};
export const chordNotes = (c) => CHORDS[c].frets.map((fr, i) => (fr < 0 ? null : TUNING[i] + fr));

// ---------------------------------------------------------------- spectra
// A string plucked at fraction β of its length (measured from the bridge) starts as a triangle.
// Its k-th harmonic has displacement bₖ = 2h·sin(kπβ) / (π²k²β(1−β)): harmonics with a node
// at the pluck point (sin(kπβ) = 0) are missing. The force on the bridge (acoustic) and the
// voltage from a magnetic pickup at fraction p (electric, which senses velocity) both add a factor k;
// the pickup also multiplies by sin(kπp), a comb filter that depends on where it sits.
export function harmonics(beta, { K = 12, pickup = 0, touch = 0 } = {}) {
  const a = [0];
  for (let k = 1; k <= K; k++) {
    let v = (2 * Math.sin(k * Math.PI * beta)) / (Math.PI ** 2 * k * k * beta * (1 - beta));
    v *= k;
    if (pickup) v *= Math.sin(k * Math.PI * pickup);
    if (touch && k % touch) v *= 0.02;       // a light touch at 1/n of the length stops every mode without a node there
    a.push(v);
  }
  return a;
}

// ---------------------------------------------------------------- synth
// Each note is rendered into an AudioBuffer as a sum of decaying partials with the amplitudes above,
// plus a short pick click. Higher partials die away faster. Acoustic notes pass through two body
// resonances (the air mode near 100 Hz and the top-plate mode near 200 Hz); electric notes go through
// a small amp: gain, a clipping curve, a cabinet filter and an effect.
// Sound starts only after a real click or key press, respects the mute button, and never plays while
// the studio is recording.
let ctx = null, master = null, noiseSeed = 7;
const bus = {};
const voices = [];
const cache = new Map();
let gestured = false;
if (typeof window !== 'undefined') {
  const mark = () => { gestured = true; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => window.addEventListener(t, mark, { capture: true, passive: true }));
}
export const recording = () => document.body.classList.contains('gb-reel') || /[?&]reel=1/.test(location.search);

export function clipCurve(mode, drive = 1) {
  const n = 1024, c = new Float32Array(n), X = 6;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1, x = u * X;
    c[i] = shape(mode, x, drive);
  }
  return c;
}
// The transfer curve itself (input in volts after the gain, output normalised to ±1).
export function shape(mode, x) {
  if (mode === 'hard') return clamp(x, -1, 1);
  if (mode === 'soft') return Math.tanh(x);
  return x / 6;                                  // clean: a straight line with plenty of headroom
}

function ready() {
  if (audio.muted || recording()) return null;
  if (!gestured && !navigator.userActivation?.hasBeenActive) return null;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!master) {
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
      master.connect(comp).connect(ctx.destination);
      // A small room.
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      let seed = 3;
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = ((seed / 2147483647) * 2 - 1) * Math.exp((-5 * i) / len); } }
      conv.buffer = ir;
      bus.room = ctx.createGain(); bus.room.gain.value = 0.1; bus.room.connect(conv).connect(master);
      // Acoustic: the body's air and top resonances lift the lows.
      bus.acoustic = ctx.createGain(); bus.acoustic.gain.value = 1;
      const air = ctx.createBiquadFilter(); air.type = 'peaking'; air.frequency.value = 100; air.Q.value = 3; air.gain.value = 9;
      const top = ctx.createBiquadFilter(); top.type = 'peaking'; top.frequency.value = 200; top.Q.value = 2.5; top.gain.value = 6;
      const hi = ctx.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 6500;
      bus.acoustic.connect(air).connect(top).connect(hi);
      hi.connect(master); hi.connect(bus.room);
      // No body: the string alone barely moves the air, and what it does radiate is thin (a dipole).
      bus.bare = ctx.createGain(); bus.bare.gain.value = 0.12;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; hp.Q.value = 0.5;
      bus.bare.connect(hp).connect(master);
      // Electric: pickup → amp gain → clipping → cabinet → effects → master.
      bus.electric = ctx.createGain(); bus.electric.gain.value = 1;
      bus.pre = ctx.createGain();
      bus.shaper = ctx.createWaveShaper(); bus.shaper.oversample = '4x';
      bus.cab = ctx.createBiquadFilter(); bus.cab.type = 'lowpass'; bus.cab.frequency.value = 4800; bus.cab.Q.value = 0.8;
      const cabHp = ctx.createBiquadFilter(); cabHp.type = 'highpass'; cabHp.frequency.value = 75;
      bus.post = ctx.createGain();
      bus.electric.connect(bus.pre).connect(bus.shaper).connect(bus.cab).connect(cabHp).connect(bus.post);
      bus.fxDry = ctx.createGain(); bus.post.connect(bus.fxDry).connect(master);
      // Delay with feedback.
      bus.delay = ctx.createDelay(1.5); bus.delay.delayTime.value = 0.36;
      bus.fb = ctx.createGain(); bus.fb.gain.value = 0.4;
      bus.delayOut = ctx.createGain(); bus.delayOut.gain.value = 0;
      bus.post.connect(bus.delay); bus.delay.connect(bus.fb).connect(bus.delay); bus.delay.connect(bus.delayOut).connect(master);
      // Reverb send.
      bus.revSend = ctx.createGain(); bus.revSend.gain.value = 0; bus.post.connect(bus.revSend).connect(conv);
      // Wah: a swept band-pass.
      bus.wah = ctx.createBiquadFilter(); bus.wah.type = 'bandpass'; bus.wah.Q.value = 5; bus.wah.frequency.value = 800;
      const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 1.6; depth.gain.value = 650;
      lfo.connect(depth).connect(bus.wah.frequency); lfo.start();
      bus.wahOut = ctx.createGain(); bus.wahOut.gain.value = 0;
      bus.post.connect(bus.wah).connect(bus.wahOut).connect(master);
      setAmp(ampState);
    }
    return ctx;
  } catch { return null; }
}

const ampState = { gain: 1, clip: 'clean', fx: 'none' };
function setAmp(a) {
  Object.assign(ampState, a);
  if (!ctx || !bus.pre) return;
  const { gain, clip, fx } = ampState, t = ctx.currentTime;
  // Pickup output of about ±0.3 V (our buffers peak near 0.3); the curve's input spans ±6.
  bus.pre.gain.setTargetAtTime(gain / 6, t, 0.02);
  const key = clip;
  if (bus.shaper._k !== key) { bus.shaper.curve = clipCurve(clip); bus.shaper._k = key; }
  // Keep loudness roughly level: a clean signal gets louder with gain, a clipped one can't.
  const out = clip === 'clean' ? clamp(1.8 / Math.max(0.3, gain * 0.3 / 6 * 6), 0.2, 3) : 0.55;
  bus.post.gain.setTargetAtTime(out, t, 0.02);
  bus.fxDry.gain.setTargetAtTime(fx === 'wah' ? 0.15 : 1, t, 0.03);
  bus.delayOut.gain.setTargetAtTime(fx === 'delay' ? 0.55 : 0, t, 0.03);
  bus.fb.gain.setTargetAtTime(fx === 'delay' ? 0.42 : 0, t, 0.03);
  bus.revSend.gain.setTargetAtTime(fx === 'reverb' ? 0.9 : 0, t, 0.03);
  bus.wahOut.gain.setTargetAtTime(fx === 'wah' ? 2.4 : 0, t, 0.03);
}

// Render one note into a buffer (cached).
function render(f, o) {
  const key = [f.toFixed(2), o.beta.toFixed(3), o.pickup.toFixed(3), o.touch, o.tone, o.hum ? 1 : 0].join('|');
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate;
  const electric = o.tone === 'electric';
  // Time constant of the fundamental: a few seconds on the low strings, shorter higher up.
  // Solid bodies sustain longer because they take less energy from the string.
  const tau1 = clamp(2.6 * Math.sqrt(110 / f), 0.7, 3.4) * (electric ? 1.7 : 1) * (o.touch ? 0.8 : 1);
  const dur = Math.min(electric ? 5 : 4, tau1 * 3.2 + 0.2);
  const N = Math.floor(sr * dur), out = new Float32Array(N);
  const K = Math.max(1, Math.min(48, Math.floor(8000 / f)));
  const a = harmonics(o.beta, { K, pickup: electric ? o.pickup : 0, touch: o.touch });
  const B = 0.00008;                           // a guitar string's small inharmonicity
  for (let k = 1; k <= K; k++) {
    const ak = a[k];
    if (Math.abs(ak) < 1e-4) continue;
    const fk = k * f * Math.sqrt(1 + B * k * k);
    if (fk > sr * 0.45) break;
    const tk = tau1 / (1 + 0.35 * (k - 1)) / (1 + fk / 5000);
    const w = (TAU * fk) / sr, r = Math.exp(-1 / (tk * sr)), c = 2 * r * Math.cos(w);
    // Damped recursive oscillator y[n] = a·rⁿ·sin(wn): y[n+1] = 2r·cos(w)·y[n] − r²·y[n−1].
    const r2 = r * r;
    let s1 = 0, s2 = -ak * Math.sin(w) / r;
    for (let n = 0; n < N; n++) { out[n] += s1; const s0 = c * s1 - r2 * s2; s2 = s1; s1 = s0; }
  }
  // Pick click and a soft attack (the pick takes about a millisecond to let go).
  const att = Math.floor(sr * 0.0015), clickN = Math.floor(sr * 0.012);
  let peak = 0;
  for (let n = 0; n < N; n++) {
    if (n < att) out[n] *= n / att;
    if (n < clickN) { noiseSeed = (noiseSeed * 16807) % 2147483647; out[n] += ((noiseSeed / 2147483647) * 2 - 1) * 0.08 * (1 - n / clickN) ** 2; }
    if (o.hum) out[n] += 0.05 * (Math.sin((TAU * 50 * n) / sr) + 0.5 * Math.sin((TAU * 150 * n) / sr) + 0.25 * Math.sin((TAU * 250 * n) / sr));
    if (n < sr * 0.2) peak = Math.max(peak, Math.abs(out[n]));
  }
  const g = 0.3 / Math.max(1e-6, peak);
  for (let n = 0; n < N; n++) out[n] *= g;
  const fade = Math.floor(sr * 0.05);
  for (let n = 0; n < fade; n++) out[N - 1 - n] *= n / fade;
  const buf = ctx.createBuffer(1, N, sr); buf.copyToChannel(out, 0);
  cache.set(key, buf);
  while (cache.size > 40) cache.delete(cache.keys().next().value);
  return buf;
}

export const synth = {
  get context() { return ctx; },
  sync() { if (master && ctx) { const want = audio.muted || recording() ? 0 : 0.9; if (Math.abs(master.gain.value - want) > 0.01) master.gain.setTargetAtTime(want, ctx.currentTime, 0.02); } },
  amp(a) { ampState.gain = a.gain ?? ampState.gain; ampState.clip = a.clip ?? ampState.clip; ampState.fx = a.fx ?? ampState.fx; setAmp(ampState); },
  // Pluck frequency f. Options: string id (re-plucking a string stops its old note), beta (pluck point
  // from the bridge), tone ('acoustic' | 'bare' | 'electric'), pickup (fraction from the bridge),
  // touch (natural harmonic: 2 = 12th fret, 3 = 7th, 4 = 5th), delay in seconds, vel (0–1), hum.
  pluck(f, { id = null, beta = 0.2, tone = 'acoustic', pickup = 0.25, touch = 0, delay = 0, vel = 0.8, hum = false } = {}) {
    try {
      const ac = ready(); if (!ac || !(f > 20 && f < 5000)) return null;
      const t = ac.currentTime + 0.01 + delay;
      if (id !== null) for (const v of voices) if (v.id === id && !v.off) stop(v, t, 0.02);
      const buf = render(f, { beta: clamp(beta, 0.02, 0.5), pickup: tone === 'electric' ? pickup : 0, touch, tone, hum: hum && tone === 'electric' });
      const src = ac.createBufferSource(); src.buffer = buf;
      const g = ac.createGain(); g.gain.value = 0.35 + 0.65 * vel;
      src.connect(g).connect(bus[tone] || bus.acoustic);
      if (tone === 'acoustic') { const send = ac.createGain(); send.gain.value = 0.25; g.connect(send).connect(bus.room); }
      src.start(t);
      const v = { id, src, g, off: false };
      voices.push(v);
      src.onended = () => { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); };
      while (voices.length > 18) stop(voices.shift(), ac.currentTime, 0.03);
      return v;
    } catch { return null; }
  },
  // Strum notes (frequencies, low string first) with a little gap between strings.
  strum(fs, o = {}, gap = 0.028) { fs.forEach((f, i) => { if (f) this.pluck(f, { ...o, id: i, delay: (o.delay || 0) + i * gap, vel: (o.vel ?? 0.8) * (0.85 + 0.15 * Math.random()) }); }); },
  // Feedback: a sustained partial that swells through the amp, as when you stand close to a loud speaker.
  feedback(f, on) {
    const ac = ready(); if (!ac) return;
    if (this._fb) { const o = this._fb; o.g.gain.setTargetAtTime(0, ac.currentTime, 0.1); o.o.stop(ac.currentTime + 1); this._fb = null; }
    if (!on || !f) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * 2; g.gain.value = 0; g.gain.setTargetAtTime(0.25, ac.currentTime + 0.6, 0.8);
    o.connect(g).connect(bus.electric); o.start();
    this._fb = { o, g };
  },
  mute(id) { if (ctx) for (const v of voices) if ((id === undefined || v.id === id) && !v.off) stop(v, ctx.currentTime, 0.04); },
  allOff() { if (ctx) { voices.forEach((v) => stop(v, ctx.currentTime, 0.05)); voices.length = 0; this.feedback(0, false); } },
};
function stop(v, t, tau) {
  if (!v || v.off) return;
  v.off = true;
  try { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, tau); v.src.stop(t + tau * 8); } catch { /* already stopped */ }
}

// ---------------------------------------------------------------- vibrating strings (visual)
// A string drawn as a thin tube we bend every frame. Its shape is a sum of standing waves
// bₖ·sin(kπu)·cos(φₖ). Real guitar strings swing 80 to 1,300 times a second, far too fast to see,
// so they are drawn slowed down: the fundamental at about one swing a second, the overtones at their
// true multiples of it.
export class VString {
  constructor(radius, mat, { seg = 120, K = 10 } = {}) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 6, seg, true); g.rotateZ(-Math.PI / 2); g.translate(0.5, 0, 0);
    this.base = Float32Array.from(g.attributes.position.array);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.r = radius; this.K = K;
    this.amp = new Float32Array(K + 1); this.phase = new Float32Array(K + 1);
    this.A = new THREE.Vector3(); this.B = new THREE.Vector3();
    this.stop = 1;           // fraction of A→B that vibrates (a fretted string is stopped earlier)
    this.press = 0;          // how far the fret point is pushed down (z), metres
    this.dir = new THREE.Vector3(0, 1, 0);
    this.vis = 1; this.tau = 3; this.only = 0; this.onlyGain = 1; this.touch = 0;
  }
  // Pluck at fraction beta from A with peak height h (metres, drawn).
  pluck(beta, h, touch = 0) {
    const a = harmonics(beta, { K: this.K });
    for (let k = 1; k <= this.K; k++) { this.amp[k] = (h * a[k]) / k; this.phase[k] = 0; if (touch && k % touch) this.amp[k] = 0; }
    this.touch = touch;
  }
  damp() { this.amp.fill(0); }
  energy() { let e = 0; for (let k = 1; k <= this.K; k++) e += this.amp[k] ** 2 * k * k; return Math.sqrt(e); }
  update(dt, speed = 1) {
    const d = Math.exp(-dt / this.tau);
    for (let k = 1; k <= this.K; k++) { this.amp[k] *= d ** (1 + 0.35 * (k - 1)); this.phase[k] += dt * TAU * this.vis * k * speed; }
  }
  // Displacement at u (0–1 along A→B).
  y(u) {
    if (u >= this.stop) return 0;
    const v = u / this.stop;
    let y = 0;
    for (let k = 1; k <= this.K; k++) if (!this.only || this.only === k) y += this.amp[k] * Math.sin(k * Math.PI * v) * Math.cos(this.phase[k]);
    return this.only ? y * this.onlyGain : y;
  }
  draw() {
    const pos = this.mesh.geometry.attributes.position, b = this.base, A = this.A, B = this.B, r = this.r, dir = this.dir;
    for (let i = 0; i < pos.count; i++) {
      const u = b[i * 3], by = b[i * 3 + 1], bz = b[i * 3 + 2];
      const yy = this.y(u);
      // Pressed down at the fret: the string bends to the fret top there.
      const pz = this.stop < 1 ? -this.press * (u < this.stop ? u / this.stop : (1 - u) / (1 - this.stop)) : 0;
      pos.array[i * 3] = A.x + (B.x - A.x) * u + dir.x * yy;
      pos.array[i * 3 + 1] = A.y + (B.y - A.y) * u + by * r + dir.y * yy;
      pos.array[i * 3 + 2] = A.z + (B.z - A.z) * u + bz * r + pz + dir.z * yy;
    }
    pos.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- outlines
// A smooth closed outline through (x, y) points, sampled into n points.
function outline(pts, n = 220) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return c.getSpacedPoints(n).slice(0, n).map((p) => [p.x, p.y]);
}
function inset(pts, d) {
  const n = pts.length;
  // Signed area tells us which way is inside.
  let A = 0; for (let i = 0; i < n; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; A += x1 * y2 - x2 * y1; }
  const s = A > 0 ? 1 : -1;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
    return [p[0] - (s * ty / L) * d, p[1] + (s * tx / L) * d];
  });
}
const toShape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const toPath = (pts) => { const s = new THREE.Path(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
function slab(shape, z0, depth, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
  g.translate(0, 0, z0);
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
const mirror = (half) => [...half, ...half.slice().reverse().map(([x, y]) => [x, -y])];

// Dreadnought: body 20 in (508 mm) long, lower bout 15⅝ in (397 mm), waist ~10¾ in, upper bout 11½ in
// (292 mm), about 4⅞ in (124 mm) deep at the tail. Sound hole 4 in (102 mm) across.
export const DREAD = { len: 0.508, depth: 0.115, hole: 0.051, holeX: 0.33, joint: 14 };
const DREAD_HALF = [[0.004, 0.06], [0.02, 0.13], [0.06, 0.178], [0.12, 0.197], [0.18, 0.196], [0.235, 0.18], [0.285, 0.148], [0.325, 0.137], [0.37, 0.142], [0.42, 0.148], [0.462, 0.14], [0.492, 0.112], [0.506, 0.06]];
const DREAD_OUT = outline([[0, 0], ...DREAD_HALF, [0.509, 0], ...DREAD_HALF.slice().reverse().map(([x, y]) => [x, -y])]);
// Offset-double-cutaway solid body, about 18 in long and 12¾ in wide, 1¾ in (44 mm) thick.
export const SOLID = { len: 0.457, depth: 0.044, joint: 16 };
const SOLID_OUT = outline([
  [0.004, 0], [0.025, 0.115], [0.075, 0.158], [0.145, 0.16], [0.205, 0.14], [0.255, 0.122], [0.3, 0.128], [0.35, 0.146], [0.41, 0.152],
  [0.47, 0.14], [0.505, 0.114], [0.498, 0.09], [0.47, 0.072], [0.45, 0.05], [0.457, 0.03], [0.457, -0.03], [0.445, -0.05], [0.425, -0.075],
  [0.44, -0.105], [0.425, -0.128], [0.385, -0.14], [0.33, -0.13], [0.28, -0.124], [0.23, -0.14], [0.16, -0.162], [0.085, -0.16], [0.028, -0.12],
]);

// ---------------------------------------------------------------- guitars
// makeGuitar('acoustic' | 'electric'). Returns the group, its parts (for exploding and labels),
// string end points and vibrating strings, fret positions, and see-through switches.
export function makeGuitar(kind = 'acoustic') {
  const acoustic = kind === 'acoustic';
  const B = acoustic ? DREAD : SOLID;
  const L = SCALE_M;
  const xNut = B.len + fretDist(B.joint, L), xSad = xNut - L;
  const FRETS = acoustic ? 20 : 21;
  const g = new THREE.Group();
  const parts = {};
  const part = (name) => { const p = new THREE.Group(); p.name = name; g.add(p); parts[name] = p; return p; };
  const see = [];
  const mats = {
    top: M.matte(0xa8773e, { roughness: 0.6 }),
    back: M.matte(0x6a3620, { roughness: 0.5 }),
    neck: M.matte(acoustic ? 0x8a4a28 : 0xe2bd82, { roughness: 0.55 }),
    board: M.matte(acoustic ? 0x201713 : 0x3b2317, { roughness: 0.6 }),
    fret: M.metal(0xd7dbe2, { roughness: 0.25 }),
    bone: M.matte(0xf2ecdc, { roughness: 0.4 }),
    chrome: M.metal(0xe8ecf2, { roughness: 0.18 }),
    pearl: M.plastic(0xf6f2ea, { roughness: 0.25 }),
    ebony: M.matte(0x16110e, { roughness: 0.45 }),
    body: M.plastic(0x9c1d18, { roughness: 0.28 }),
    guard: M.plastic(0xf4f1e8, { roughness: 0.35 }),
    plate: M.plastic(0x18181c, { roughness: 0.3 }),
    string: M.metal(0xe6eaf0, { roughness: 0.22 }),
    wound: M.metal(acoustic ? 0xd4a15e : 0xc9ced6, { roughness: 0.35 }),
  };
  const addTo = (p, ...m) => { m.forEach((x) => p.add(x)); return m[0]; };
  const fx = (n) => xNut - fretDist(n, L);                    // x of fret n
  const boardW = (x) => 0.043 + (0.057 - 0.043) * clamp((xNut - x) / (xNut - B.len + 0.1), 0, 1.4);
  const BOARD_T = 0.006, FRET_H = 0.0012;
  const zBoard = BOARD_T, zFret = BOARD_T + FRET_H;
  const zNut = zFret + 0.0009, zSad = acoustic ? 0.0118 : 0.0112;

  let body;
  if (acoustic) {
    // Top with the sound hole, rosette, bracing underneath, back and sides.
    const shape = toShape(DREAD_OUT);
    const hole = new THREE.Path(); hole.absarc(B.holeX, 0, B.hole, 0, TAU, true); shape.holes.push(hole);
    const topP = part('top');
    const top = addTo(topP, slab(shape, -0.003, 0.003, mats.top));
    const ros = new THREE.Mesh(new THREE.RingGeometry(B.hole + 0.008, B.hole + 0.016, 64), M.matte(0x3a2a1c)); ros.position.set(B.holeX, 0, 0.0004); topP.add(ros);
    const ros2 = new THREE.Mesh(new THREE.RingGeometry(B.hole + 0.019, B.hole + 0.022, 64), M.matte(0x3a2a1c)); ros2.position.set(B.holeX, 0, 0.0004); topP.add(ros2);
    // Teardrop pickguard hugging the treble side of the sound hole.
    const gpts = [];
    for (let k = 0; k <= 24; k++) { const t = -0.35 - (k / 24) * 2.15; gpts.push([B.holeX + (B.hole + 0.012) * Math.cos(t), (B.hole + 0.012) * Math.sin(t)]); }
    for (let k = 24; k >= 0; k--) { const t = -0.35 - (k / 24) * 2.15, r = B.hole + 0.012 + 0.05 * Math.sin((k / 24) * Math.PI) ** 0.8; gpts.push([B.holeX + r * Math.cos(t), r * Math.sin(t)]); }
    addTo(topP, slab(toShape(gpts), 0, 0.0008, M.plastic(0x2a1510, { roughness: 0.3 })));
    see.push(top.material, mats.top);
    // X-bracing: two long braces crossing between the sound hole and the bridge, plus tone bars,
    // a bridge plate and an upper transverse brace.
    const brP = part('bracing');
    const bm = M.matte(0xd9b77c);
    // The X crosses just below the sound hole; its arms run past the hole to the upper bout
    // and out to the edges of the lower bout, at about 46° to the centre line.
    const cx = B.holeX - B.hole - 0.035, ta = Math.tan(0.8);
    const brace = (a, b, h = 0.012) => { const m = beam([a[0], a[1], -0.003 - h / 2], [b[0], b[1], -0.003 - h / 2], 0.0045, bm, 6); brP.add(m); return m; };
    for (const sgn of [1, -1]) brace([cx - 0.175 / ta, -sgn * 0.175], [cx + 0.132 / ta, sgn * 0.132]);
    brace([0.075, 0.07], [0.15, -0.1], 0.008); brace([0.05, 0.03], [0.11, -0.12], 0.008);
    brace([B.holeX + B.hole + 0.02, -0.15], [B.holeX + B.hole + 0.02, 0.15], 0.014);
    const plate = box(0.05, 0.16, 0.003, M.matte(0xc9a46d)); plate.position.set(xSad, 0, -0.0045); brP.add(plate);
    const backP = part('back');
    addTo(backP, slab(toShape(DREAD_OUT), -B.depth - 0.003, 0.003, mats.back));
    const sideP = part('sides');
    const ring = toShape(DREAD_OUT); ring.holes.push(toPath(inset(DREAD_OUT, 0.003).reverse()));
    const sides = addTo(sideP, slab(ring, -B.depth, B.depth - 0.003, mats.back));
    // Cream binding round the top edge.
    const bind = toShape(DREAD_OUT); bind.holes.push(toPath(inset(DREAD_OUT, 0.004).reverse()));
    addTo(sideP, slab(bind, -0.0035, 0.0036, M.plastic(0xf3ead6)));
    see.push(mats.back);
    // Tail block and strap pin, heel strap pin.
    const pins = part('pins');
    const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.014, 16), mats.bone); pin1.rotation.z = Math.PI / 2; pin1.position.set(-0.006, 0, -B.depth / 2); pins.add(pin1);
    const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.014, 16), mats.bone); pin2.position.set(B.len + 0.03, 0, -0.036); pin2.rotation.x = 0; pins.add(pin2);
    pin2.rotation.set(Math.PI / 2, 0, 0); pin2.position.set(B.len + 0.035, -0.034, -0.03);
    body = top;
    void sides;
    // Bridge (ebony), bone saddle and six bridge pins.
    const brg = part('bridge');
    const bridge = box(0.03, 0.15, 0.009, mats.ebony); bridge.position.set(xSad - 0.004, 0, 0.0045); brg.add(bridge);
    const sad = box(0.003, 0.08, 0.004, mats.bone); sad.position.set(xSad, 0, zSad - 0.002); sad.rotation.z = -0.04; brg.add(sad);
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.003, 0.004, 12), mats.bone); p.rotation.x = Math.PI / 2; p.position.set(xSad - 0.013, 0.027 - i * 0.0108, 0.011); brg.add(p); }
  } else {
    const bP = part('body');
    body = addTo(bP, slab(toShape(SOLID_OUT), -B.depth, B.depth, mats.body));
    see.push(mats.body);
    // Pickguard.
    const gp = [[0.215, 0.105], [0.3, 0.1], [0.39, 0.11], [0.445, 0.095], [0.452, 0.034], [0.43, -0.035], [0.34, -0.085], [0.25, -0.118], [0.16, -0.12], [0.13, -0.07], [0.17, -0.045], [0.165, 0.05]];
    const guard = part('guard');
    addTo(guard, slab(toShape(outline(gp, 120)), 0, 0.0025, mats.plate));
    // Pickups: distances from the bridge saddle as on a Stratocaster-style guitar.
    const pk = part('pickups');
    parts.pickupX = [];
    PICKUPS.forEach((p) => {
      const x = xSad + p.d, grp = new THREE.Group(); grp.position.set(x, 0, 0.0025); grp.rotation.z = p.slant || 0; pk.add(grp);
      const cover = box(0.018, 0.07, 0.009, mats.guard); cover.position.z = 0.0045; grp.add(cover);
      for (let i = 0; i < 6; i++) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 12), mats.chrome); pole.rotation.x = Math.PI / 2; pole.position.set(0, 0.026 - i * 0.0104, 0.0095); grp.add(pole); }
      parts.pickupX.push(x);
    });
    // Controls: selector, volume and two tones, output jack.
    const ctl = part('controls');
    const knob = (x, y) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.016, 24), mats.guard); k.rotation.x = Math.PI / 2; k.position.set(x, y, 0.0105); ctl.add(k); return k; };
    knob(0.235, -0.1); knob(0.19, -0.108); knob(0.15, -0.101);
    const sw = box(0.004, 0.01, 0.014, mats.guard); sw.position.set(0.29, -0.095, 0.009); sw.rotation.z = 0.5; ctl.add(sw);
    const slot = box(0.03, 0.004, 0.001, M.matte(0x111111)); slot.position.set(0.29, -0.095, 0.0028); slot.rotation.z = 0.5; ctl.add(slot);
    const jack = part('jack');
    const jp = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.003, 32, 1, false), mats.chrome); jp.rotation.x = Math.PI / 2; jp.scale.set(0.8, 1, 1.35); jp.position.set(0.13, -0.142, 0.0015); jack.add(jp);
    const jh = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 16), M.matte(0x111111)); jh.rotation.x = Math.PI / 2; jh.position.set(0.13, -0.142, 0.003); jack.add(jh);
    // Tremolo bridge with six saddles and a whammy bar.
    const brg = part('bridge');
    const bp = box(0.045, 0.074, 0.003, mats.chrome); bp.position.set(xSad - 0.01, 0, 0.004); brg.add(bp);
    for (let i = 0; i < 6; i++) { const s = box(0.012, 0.0095, 0.006, mats.chrome); s.position.set(xSad - 0.004, 0.026 - i * 0.0104, zSad - 0.003); brg.add(s); }
    const bar = new THREE.Group(); brg.add(bar); parts.whammy = bar;
    bar.position.set(xSad - 0.02, -0.034, 0.006);
    bar.add(beam([0, 0, 0], [0, 0, 0.03], 0.0025, mats.chrome, 10), beam([0, 0, 0.03], [-0.1, -0.045, 0.04], 0.0025, mats.chrome, 10));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), mats.guard); tip.position.set(-0.1, -0.045, 0.04); bar.add(tip);
    const pins = part('pins');
    const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.014, 16), mats.chrome); pin1.rotation.z = Math.PI / 2; pin1.position.set(-0.004, 0, -B.depth / 2); pins.add(pin1);
    const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.014, 16), mats.chrome); pin2.rotation.x = 0; pin2.position.set(0.49, 0.12, -B.depth / 2); pins.add(pin2);
  }

  // Neck: from the body joint to the nut, with a fretboard, frets, inlays, truss rod and a nut.
  const neck = part('neck');
  const xEnd = acoustic ? fx(FRETS) - 0.012 : fx(FRETS) - 0.01;   // fretboard end
  const nlen = xNut - B.len + (acoustic ? 0.02 : 0.075);
  const nk = new THREE.CylinderGeometry(1, 1, nlen, 28, 1, false, 0, Math.PI);
  nk.rotateZ(Math.PI / 2); nk.rotateX(Math.PI / 2);
  {
    const p = nk.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), u = (x + nlen / 2) / nlen;            // 0 at the body end, 1 at the nut
      const w = (0.056 - 0.013 * u) / 2, d = 0.021 + 0.003 * (1 - u);
      p.setY(i, p.getY(i) * w); p.setZ(i, -Math.abs(p.getZ(i)) * d);
    }
    nk.computeVertexNormals();
  }
  const neckM = new THREE.Mesh(nk, mats.neck); neckM.position.x = xNut - nlen / 2; neckM.castShadow = true; neck.add(neckM);
  if (acoustic) { const heel = box(0.05, 0.056, B.depth * 0.8, mats.neck); heel.position.set(B.len + 0.02, 0, -B.depth * 0.4); neck.add(heel); }
  // Fretboard as a tapered slab.
  const bs = new THREE.Shape([[xNut, 0.0215], [xEnd, boardW(xEnd) / 2], [xEnd, -boardW(xEnd) / 2], [xNut, -0.0215]].map(([x, y]) => new THREE.Vector2(x, y)));
  const board = slab(bs, 0, BOARD_T, mats.board); neck.add(board);
  const frets = [];
  for (let n = 1; n <= FRETS; n++) {
    const x = fx(n), w = boardW(x);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(FRET_H, FRET_H, w, 8), mats.fret); f.position.set(x, 0, BOARD_T); neck.add(f); frets.push(f);
  }
  const inl = [3, 5, 7, 9, 12, 15, 17, 19, 21].filter((n) => n <= FRETS);
  for (const n of inl) {
    const x = (fx(n) + fx(n - 1)) / 2;
    const ys = n === 12 ? [0.011, -0.011] : [0];
    ys.forEach((y) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0006, 20), mats.pearl); d.rotation.x = Math.PI / 2; d.position.set(x, y, BOARD_T + 0.0001); neck.add(d); });
  }
  const nut = box(0.005, 0.044, zNut + 0.001, mats.bone); nut.position.set(xNut + 0.0025, 0, zNut / 2); neck.add(nut);
  // Truss rod: a steel rod inside the neck, adjusted with a nut at the headstock (acoustic: in the sound hole).
  const rodP = part('truss');
  const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, xNut - B.len + 0.1, 10), M.metal(0x9aa3b0)); rodM.rotation.z = Math.PI / 2;
  rodM.position.set((xNut + B.len - 0.1) / 2 + 0.01, 0, -0.008); rodP.add(rodM);
  // Headstock with tuners.
  const head = part('head');
  head.position.set(xNut + 0.005, 0, 0);
  const tilt = acoustic ? 0.24 : 0;                       // acoustic headstocks tilt back about 14°
  const hs = new THREE.Group(); hs.rotation.y = tilt; head.add(hs);
  const posts = [];
  const tuners = part('tuners');
  tuners.position.copy(head.position);
  const ts = new THREE.Group(); ts.rotation.y = tilt; tuners.add(ts);
  if (acoustic) {
    const hsh = new THREE.Shape([[0, 0.022], [0.19, 0.043], [0.2, 0.03], [0.2, -0.03], [0.19, -0.043], [0, -0.022]].map(([x, y]) => new THREE.Vector2(x, y)));
    hs.add(slab(hsh, -0.012, 0.014, mats.neck));
    const face = slab(hsh, 0.0018, 0.0006, mats.ebony); hs.add(face);
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? 1 : -1, k = i < 3 ? i : 5 - i;           // strings 1–3 on the +y side
      const x = [0.05, 0.095, 0.14][k], y = side * 0.028;
      posts.push([x, y]);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.016, 12), mats.chrome); post.rotation.x = Math.PI / 2; post.position.set(x, y, 0.009); ts.add(post);
      const gear = box(0.022, 0.012, 0.014, mats.chrome); gear.position.set(x, side * 0.034, -0.019); ts.add(gear);
      const shaft = beam([x, side * 0.04, -0.019], [x, side * 0.055, -0.019], 0.002, mats.chrome, 8); ts.add(shaft);
      const btn = box(0.018, 0.012, 0.006, mats.chrome); btn.position.set(x, side * 0.062, -0.019); ts.add(btn);
    }
  } else {
    // Inline headstock: six tuners along the bass side.
    const hp = outline([[0, 0.022], [0.04, 0.035], [0.1, 0.045], [0.17, 0.05], [0.2, 0.042], [0.19, 0.022], [0.14, 0.004], [0.06, -0.012], [0.03, -0.024], [0, -0.022]], 90);
    hs.add(slab(toShape(hp), -0.012, 0.012, mats.neck));
    for (let i = 0; i < 6; i++) {
      const px = 0.035 + i * 0.0275, py = 0.026 + i * 0.0025;
      posts.push([px, py]);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 12), mats.chrome); post.rotation.x = Math.PI / 2; post.position.set(px, py, 0.005); ts.add(post);
      const gear = box(0.014, 0.014, 0.01, mats.chrome); gear.position.set(px, py + 0.004, -0.017); ts.add(gear);
      const btn = box(0.012, 0.016, 0.005, mats.chrome); btn.position.set(px, py + 0.024, -0.017); ts.add(btn);
    }
    const tree = box(0.006, 0.012, 0.004, mats.chrome); tree.position.set(0.075, -0.004, 0.002); ts.add(tree);
  }

  // Strings: saddle → nut vibrate; nut → tuner posts stay still.
  const strP = part('strings');
  const ends = [], vs = [];
  for (let i = 0; i < 6; i++) {
    const info = stringInfo(kind, i);
    const r = info.d / 2;
    const A = new THREE.Vector3(xSad, (acoustic ? 0.027 : 0.026) - i * (acoustic ? 0.0108 : 0.0104), zSad);
    const Bn = new THREE.Vector3(xNut, 0.0175 - i * 0.007, zNut);
    const v = new VString(r, info.wound ? mats.wound : mats.string);
    v.A.copy(A); v.B.copy(Bn); v.draw();
    v.mesh.userData.string = i;
    strP.add(v.mesh); vs.push(v); ends.push({ A, B: Bn });
    // Behind the nut, to the tuner post (in the headstock's tilted frame).
    const [px, py] = posts[i];
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const pz = acoustic ? 0.009 : 0.007;
    const P = new THREE.Vector3(xNut + 0.005 + px * c + pz * s, py, -px * s + pz * c);
    strP.add(beam([Bn.x, Bn.y, Bn.z], [P.x, P.y, P.z], r, info.wound ? mats.wound : mats.string, 6));
    if (acoustic) strP.add(beam([A.x, A.y, A.z], [xSad - 0.013, A.y, 0.011], r, info.wound ? mats.wound : mats.string, 6));
    else strP.add(beam([A.x, A.y, A.z], [xSad - 0.012, A.y, 0.006], r, info.wound ? mats.wound : mats.string, 6));
  }
  // Wider invisible tubes to make strings easy to click.
  const hitMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, depthWrite: false });
  const hits = ends.map(({ A, B: Bn }, i) => { const h = beam([A.x, A.y, A.z + 0.003], [Bn.x, Bn.y, Bn.z + 0.003], 0.0045, hitMat, 6); h.userData.string = i; h.castShadow = false; strP.add(h); return h; });

  const setSee = (k) => {
    see.forEach((m) => { m.transparent = k < 0.999; m.opacity = k; m.depthWrite = k > 0.9; m.needsUpdate = true; });
  };
  return {
    group: g, parts, kind, top: acoustic ? body : null, xNut, xSad, L, frets, FRETS, fx, ends, vs, hits, body, zBoard, zFret, zSad, zNut, boardW, B,
    setSee,
    // Stop string i at fret n (0 = open). The string is pressed down to the fret top just behind it.
    setFret(i, n) {
      const v = vs[i];
      if (!n) { v.stop = 1; v.press = 0; return; }
      const x = fx(n);
      v.stop = (x - xSad) / (xNut - xSad);
      const zAt = v.A.z + (v.B.z - v.A.z) * v.stop;
      v.press = Math.max(0, zAt - (zFret + v.r));
    },
    // Where along a string (0 at the saddle) a point x sits.
    uAt: (x) => (x - xSad) / (xNut - xSad),
  };
}

// Stratocaster pickup positions measured from the bridge on a 25.5 in scale: 1.625, 3.875 and 6.375 in
// (till.com, "Pickup response"). The bridge pickup is slanted.
export const PICKUPS = [
  { id: 'bridge', name: 'Bridge', d: 0.041, slant: -0.17 },
  { id: 'middle', name: 'Middle', d: 0.098 },
  { id: 'neck', name: 'Neck', d: 0.162 },
];

// ---------------------------------------------------------------- boards
// A canvas board in 3D for charts and scopes.
export function boardMesh(w, h, draw, width) {
  const b = canvasTexture(w, h, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * h) / w), new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  m.renderOrder = 2;
  return { mesh: m, redraw: b.redraw };
}
export function panel(g, w, h, title) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(7,8,12,.86)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 18) : g.rect(0, 0, w, h); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '600 26px sans-serif'; g.fillText(title, 24, 40);
}

// On a phone the readout sits over the model, so keep its headline and first rows only.
export function compact(html, stage, rows = 2) {
  if (stage.host.clientWidth >= 560) return html;
  let k = 0;
  return html.replace(/<small>[\s\S]*?<\/small>/g, '').replace(/<div class="(row|no)">[\s\S]*?<\/div>/g, (m) => (++k <= rows ? m : ''));
}

// Frame-counted tasks (so recorded videos come out the same every time).
export function scheduler() {
  const q = [];
  return {
    at(t, fn) { q.push({ t, fn }); },
    update(dt) { for (const e of q) e.t -= dt; for (let i = q.length - 1; i >= 0; i--) if (q[i].t <= 0) { const e = q.splice(i, 1)[0]; e.fn(); } },
    clear() { q.length = 0; },
  };
}

export { TAU };
