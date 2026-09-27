// Chapter 6: the amp. The pickup's few hundred millivolts are made bigger (gain); push too hard and the
// signal is clipped, which adds new harmonics: distortion. Soft clipping (a tanh curve, like an overdriven
// valve) adds them gently, hard clipping (flat tops, like a diode or a transistor hitting its rails) adds more.
import { THREE, M, box, latheX, tube, clamp } from '../kit.js';
import { makeGuitar, synth, shape, harmonics, midiFreq, TUNING, CHORDS, stringInfo, boardMesh, panel, compact, scheduler } from '../guitar.js';

const VIN = 0.19;                      // pickup peak for a firm pluck, volts (see the pickups chapter)
const RAIL = 6;                        // a clean stage can swing about ±6 V before it runs out of room (illustrative)
const FX = { none: 'No effect', delay: 'Delay: repeats every 0.36 s', reverb: 'Reverb: a room of echoes', wah: 'Wah: a moving band-pass filter' };

// What comes out for a given input voltage x after the gain.
const out = (mode, x) => (mode === 'clean' ? clamp(x, -RAIL, RAIL) : shape(mode, x));
// Harmonics of a pure sine pushed through the stage: amplitudes h₁…h₉ by a discrete Fourier transform, and THD.
function thd(s) {
  const a = VIN * s.gain, N = 512, h = [0];
  for (let k = 1; k <= 9; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const th = (2 * Math.PI * n) / N, y = out(s.clip, a * Math.sin(th)); re += y * Math.cos(k * th); im += y * Math.sin(k * th); }
    h.push((2 / N) * Math.hypot(re, im));
  }
  const rest = Math.sqrt(h.slice(2).reduce((q, v) => q + v * v, 0));
  return { h, thd: rest / Math.max(1e-9, h[1]), peakIn: a, peakOut: Math.max(...Array.from({ length: 100 }, (_, i) => Math.abs(out(s.clip, a * Math.sin((i / 100) * Math.PI * 2))))) };
}
// The note that goes in: the neck pickup's view of a plucked low E (velocity, harmonics × sin(kπp)).
const NOTE_P = 0.162 / 0.6477;
function noteWave(t, f) {
  const a = harmonics(0.3, { K: 20, pickup: NOTE_P });
  let v = 0, m = 0;
  for (let k = 1; k <= 20; k++) { v += a[k] * Math.sin(2 * Math.PI * k * f * t); m += Math.abs(a[k]); }
  return v;
}
let NOTE_NORM = null;
const noteNorm = () => { if (NOTE_NORM) return NOTE_NORM; let m = 0; for (let i = 0; i < 500; i++) m = Math.max(m, Math.abs(noteWave(i / 500 / 82.4, 82.4))); return (NOTE_NORM = m); };

export default {
  id: 'amp',
  short: 'The amp',
  title: 'Amps, distortion and effects',
  subtitle: 'Turn a whisper of voltage into a roar, and clip it on purpose.',
  view: { pos: [0.55, 2.3, 6.1], target: [0.55, 1.5, 0] },
  learn: `<p>A pickup gives out only a few tenths of a volt, far too little to move a loudspeaker. An <b>amplifier</b> makes it bigger. How many times bigger is the <b>gain</b>: a gain of 30 turns 0.2 V into 6 V. Power stages then drive the <b>speaker</b>, a paper cone pushed by a coil and magnet (the pickup in reverse), and the speaker pushes the air. For amps and resistance, see <a href="/ohmslawclear/">Ohm's law</a>.</p>
    <p>Every amp has a limit. Push the signal past it and the tops of the wave get cut off: <b>clipping</b>. A clipped wave is no longer a clean wiggle, so it contains new <b>harmonics</b> that weren't in the string. That is <b>distortion</b>, the sound of rock. <b>Soft clipping</b>, the gentle squash of an overdriven valve (vacuum tube), rounds the tops and adds harmonics gradually. <b>Hard clipping</b> slices them flat and sounds fizzier. A symmetrical clip adds only <b>odd</b> harmonics: 3rd, 5th, 7th.</p>
    <p>Stand close to a loud amp and the sound can shake the strings back into motion, which the pickup hears and the amp makes louder still. That loop is <b>feedback</b>: a note that never dies, or a howl. <b>Effects</b> change the signal on the way: a <b>delay</b> repeats it, <b>reverb</b> adds the echoes of a room, and a <b>wah</b> pedal sweeps a narrow filter up and down, so the guitar seems to say "wah".</p>
    <p class="tip"><b>Try it:</b> play a power chord clean, then turn up the gain with soft and hard clipping and watch the scope and the harmonics. Try the delay.</p>`,
  terms: [
    { t: 'Gain', d: 'How many times bigger an amplifier makes a signal.' },
    { t: 'Clipping', d: 'When a signal is pushed past the limit of an amp, so the tops of the wave are cut off.' },
    { t: 'Distortion', d: 'Any change in a wave’s shape. Clipping adds harmonics that weren’t in the original.' },
    { t: 'THD', d: 'Total harmonic distortion: how big the added harmonics are compared with the original note.' },
    { t: 'Valve (vacuum tube)', d: 'An old kind of amplifier part that clips softly, loved for its warm distortion.' },
    { t: 'Feedback', d: 'Sound from the speaker shaking the strings, which the pickup hears and the amp makes louder, round and round.' },
  ],
  defaults: { gain: 3, clip: 'clean', fx: 'none', feedback: false },
  controls: [
    { key: 'play', type: 'buttons', label: 'Play', items: [{ label: '♪ Low E', act: (s, inst) => inst.play('note') }, { label: '♪ Power chord', act: (s, inst) => inst.play('power') }, { label: '♪ E chord', act: (s, inst) => inst.play('E') }] },
    { key: 'gain', type: 'log', label: 'Gain', min: 1, max: 100, fmt: (v) => `×${v < 10 ? v.toFixed(1) : Math.round(v)} (${Math.round(20 * Math.log10(v))} dB)` },
    { key: 'clip', type: 'seg', label: 'When it runs out of room', options: [{ v: 'clean', label: 'Clean' }, { v: 'soft', label: 'Soft clip' }, { v: 'hard', label: 'Hard clip' }] },
    { key: 'fx', type: 'seg', label: 'Effect', options: [{ v: 'none', label: 'None' }, { v: 'delay', label: 'Delay' }, { v: 'reverb', label: 'Reverb' }, { v: 'wah', label: 'Wah' }] },
    { key: 'feedback', type: 'toggle', label: 'Stand close to the speaker (feedback)' },
  ],
  onChange(s) { synth.amp({ gain: s.gain, clip: s.clip, fx: s.fx }); },
  quiz: [
    { q: 'What is clipping?', options: ['Cutting the guitar lead', 'The amp running out of room, so the tops of the wave are cut off', 'A way to tune the strings', 'Turning the volume down'], answer: 1, why: 'Every amp can only swing so far. Push the signal past that and the peaks are flattened.' },
    { q: 'Why does a clipped note sound different, even at the same pitch?', options: ['It is louder', 'Flattening the wave adds new harmonics that weren’t in the string', 'It removes the fundamental', 'It changes the frequency'], answer: 1, why: 'A flat-topped wave is made of the original sine plus 3rd, 5th, 7th… harmonics. That added edge is distortion.' },
    { q: 'What causes feedback?', options: ['A broken speaker', 'Sound from the speaker shakes the strings, the pickup hears it and the amp makes it louder in a loop', 'Too many effects', 'Old strings'], answer: 1, why: 'It is a loop: string → pickup → amp → speaker → air → string. With enough gain, it sustains or howls.' },
  ],
  reel: [
    { ms: 5600, caption: 'Push an amp past its limit and it clips the wave, adding the harmonics of distortion.', set: { gain: 2, clip: 'soft', fx: 'none', feedback: false }, anim: { gain: [2, 60, true] }, act: (s, inst) => inst.play('power', true), view: { pos: [0.9, 2.5, 6.9], target: [0.6, 1.7, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    // The amp: a combo cabinet with a 12-inch speaker behind a grille.
    const amp = new THREE.Group(); amp.position.set(-1.55, 0, 0.1); root.add(amp);
    const cab = box(2.1, 1.8, 0.9, M.matte(0x1c1c20, { roughness: 0.8 })); cab.position.y = 0.9; amp.add(cab);
    const panelM = box(2.0, 0.34, 0.06, M.metal(0x8f949e, { roughness: 0.35 })); panelM.position.set(0, 1.58, 0.45); amp.add(panelM);
    const knobs = [];
    for (let i = 0; i < 5; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 20), M.plastic(0x111111)); k.rotation.x = Math.PI / 2; k.position.set(-0.55 + i * 0.3, 1.58, 0.5); amp.add(k); knobs.push(k); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), M.glow(0xff4a3a)); lamp.position.set(0.85, 1.58, 0.5); amp.add(lamp);
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), M.metal(0xe8ecf2)); jack.rotation.x = Math.PI / 2; jack.position.set(-0.85, 1.58, 0.5); amp.add(jack);
    // Speaker: a paper cone with a dust cap, seen through a dark cloth grille.
    const cone = latheX([[0, 0.12], [0.02, 0.2], [0.12, 0.5], [0.16, 0.58]], M.matte(0x2a2622, { side: THREE.DoubleSide }));
    cone.rotation.y = Math.PI / 2; cone.position.set(0, 0.75, 0.28); amp.add(cone);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.matte(0x1a1714)); cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.75, 0.3); amp.add(cap);
    const grille = box(1.9, 1.3, 0.02, M.ghost(0x6f6558, 0.35)); grille.position.set(0, 0.72, 0.455); amp.add(grille);
    stage.label('Amplifier and speaker', [0, 1.95, 0.4], amp);
    // The guitar on a stand, cabled to the amp.
    const g = makeGuitar('electric');
    const holder = new THREE.Group(); holder.scale.setScalar(2.9); holder.position.set(0.35, 0.3, 0.5); holder.rotation.set(0, -0.2, 1.22); holder.add(g.group); root.add(holder);
    g.vs.forEach((v, i) => { v.vis = 1.2 * (stringInfo('electric', i).f / 82.4) ** 0.35; v.tau = 3; });
    stage.pickables.push(...g.hits);
    root.updateMatrixWorld(true);
    const jw = holder.localToWorld(new THREE.Vector3(0.13, -0.142, 0.005)), aw = amp.localToWorld(new THREE.Vector3(-0.85, 1.58, 0.55));
    root.add(tube([jw, [jw.x + 0.1, 0.05, jw.z + 0.4], [(jw.x + aw.x) / 2, 0.04, 0.9], [aw.x - 0.1, 0.4, aw.z + 0.35], [aw.x, aw.y - 0.05, aw.z + 0.1], aw].map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), 0.025, M.plastic(0x111114)));
    // An effect pedal on the floor.
    const pedal = new THREE.Group(); pedal.position.set(-0.1, 0, 1.25); root.add(pedal);
    const pbody = box(0.36, 0.12, 0.5, M.plastic(0x2a8f5a)); pbody.position.y = 0.06; pedal.add(pbody);
    const rocker = box(0.3, 0.04, 0.42, M.metal(0x9aa3b0)); rocker.position.y = 0.15; pedal.add(rocker);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), M.glow(0x40ff80)); led.position.set(0, 0.14, -0.22); pedal.add(led);
    const lFx = stage.label('', [0, 0.35, 0], pedal);
    // Sound leaving the speaker, and the feedback loop.
    const rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), M.ghost(0x8ef0ff, 0.3)); m.position.set(amp.position.x, 0.75, 0.6); root.add(m); return m; });
    const loop = tube([[aw.x + 0.5, 0.9, 0.9], [-0.4, 1.3, 1.3], [0.2, 1.5, 1.0]], 0.02, M.glow(0xffb547)); root.add(loop);
    const lLoop = stage.label('Feedback: speaker → strings → pickup → amp', [-0.3, 1.6, 1.3], root, 'hot');

    // Scope and harmonics board.
    let S = s0, level = 0.001;
    const board = boardMesh(900, 620, (c, w, h) => {
      panel(c, w, h, 'Into the clipper and out');
      const x0 = 50, x1 = w - 24, yA = 64, yB = 300, ym = (yA + yB) / 2;
      const f = 82.4, T = 2.2 / f, a = VIN * S.gain * Math.max(0.02, level), n0 = noteNorm();
      const top = Math.max(1.3, a * 1.1);
      const Y = (v) => ym - clamp(v / top, -1.05, 1.05) * (yB - yA) / 2;
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
      if (S.clip !== 'clean' || a > RAIL) { const lim = S.clip === 'clean' ? RAIL : 1; c.setLineDash([8, 6]); c.strokeStyle = 'rgba(255,107,107,.7)'; [lim, -lim].forEach((v) => { c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke(); }); c.setLineDash([]); }
      const draw = (fn, col, wdt) => { c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); for (let i = 0; i <= 500; i++) { const t = (i / 500) * T, v = fn(t), x = x0 + (i / 500) * (x1 - x0); i ? c.lineTo(x, Y(v)) : c.moveTo(x, Y(v)); } c.stroke(); };
      draw((t) => (a * noteWave(t, f)) / n0, 'rgba(142,240,255,.35)', 2);
      draw((t) => out(S.clip, (a * noteWave(t, f)) / n0), '#ffb547', 3.5);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '19px sans-serif';
      c.fillText(`faint: in (×${S.gain < 10 ? S.gain.toFixed(1) : Math.round(S.gain)})   bright: out   dashed: limit`, x0, yB + 26);
      // Harmonics of a pure sine through the same stage.
      const r = thd(S), hm = Math.max(...r.h.slice(1));
      c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '600 21px sans-serif'; c.fillText('Harmonics added to a pure note', 24, 380);
      const by0 = h - 44, bw = (w - 80) / 9;
      for (let k = 1; k <= 9; k++) {
        const hh = r.h[k] / hm, db = hh > 1e-4 ? 20 * Math.log10(hh) : -80, bh = clamp((db + 60) / 60, 0, 1) * 150;
        const x = 40 + (k - 1) * bw;
        c.fillStyle = k === 1 ? '#8ef0ff' : '#ffb547'; if (bh > 0) c.fillRect(x + 8, by0 - bh, bw - 16, bh);
        c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '18px sans-serif'; c.textAlign = 'center'; c.fillText('×' + k, x + bw / 2, by0 + 24); c.textAlign = 'left';
      }
      c.fillStyle = 'rgba(255,255,255,.45)'; c.font = '16px sans-serif'; c.fillText('bars on a dB scale, 60 dB tall', w - 250, 380);
    }, 2.9);
    board.mesh.position.set(2.4, 1.45, -0.35); board.mesh.rotation.y = -0.22; root.add(board.mesh);

    const sch = scheduler();
    let t = 0, energy = 0, lastF = midiFreq(40), drawnKey = '', acc = 0;
    const api = {
      play(what, silent = false) {
        const frets = what === 'note' ? [0, -1, -1, -1, -1, -1] : what === 'power' ? [0, 2, 2, -1, -1, -1] : CHORDS.E.frets;
        frets.forEach((fr, i) => {
          if (fr < 0) { g.setFret(i, 0); g.vs[i].damp(); return; }
          sch.at(i * 0.025, () => {
            g.setFret(i, fr); const v = g.vs[i]; v.pluck(0.2 / v.stop, 0.008);
            if (!silent) synth.pluck(midiFreq(TUNING[i] + fr), { id: i, beta: 0.2 / v.stop, tone: 'electric', pickup: NOTE_P, vel: 0.85 });
          });
        });
        lastF = midiFreq(TUNING[0]);
        energy = 1;
        if (S.feedback && !silent) synth.feedback(lastF, true);
      },
    };
    synth.amp({ gain: s0.gain, clip: s0.clip, fx: s0.fx });
    let fbWas = s0.feedback;
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        synth.sync();
        S = s; t += dt; sch.update(dt);
        if (s.feedback !== fbWas) { fbWas = s.feedback; synth.feedback(lastF, s.feedback && energy > 0.05); }
        // Feedback keeps the strings going instead of letting them die away.
        g.vs.forEach((v) => { v.tau = s.feedback ? 60 : 3; v.update(dt); v.draw(); });
        energy = s.feedback ? Math.max(energy, energy > 0.05 ? 0.8 : 0) : energy * Math.exp(-dt / 1.6);
        level = energy;
        const r = thd(s), loud = clamp(r.peakOut / (s.clip === 'clean' ? RAIL : 1), 0, 1) * energy;
        // Speaker cone, drawn slowed down.
        cone.position.z = 0.28 + 0.03 * loud * Math.sin(t * Math.PI * 2 * 3);
        cap.position.z = cone.position.z + 0.02;
        knobs[0].rotation.y = -2.4 + (Math.log10(s.gain) / 2) * 4.8;
        // Rings: echoes for delay, a haze for reverb.
        const nR = rings.length;
        rings.forEach((m, k) => {
          let u, op;
          if (s.fx === 'delay') { const rep = Math.floor(k / 2), tt = ((t % 1.6) - rep * 0.36) / 0.9 - (k % 2) * 0.15; u = clamp(tt, 0, 1); op = tt > 0 && tt < 1 ? (1 - u) * 0.55 * 0.55 ** rep : 0; }
          else { u = (t * (s.fx === 'reverb' ? 0.8 : 0.5) + k / nR) % 1; op = (1 - u) * (s.fx === 'reverb' ? 0.22 : 0.35) * (0.25 + 0.75 * loud); }
          m.position.z = 0.6 + u * 1.2; m.scale.setScalar(0.3 + u * 1.2); m.material.opacity = op * (0.3 + 0.7 * Math.max(loud, 0.2));
        });
        loop.visible = lLoop.visible = s.feedback;
        pedal.visible = s.fx !== 'none'; lFx.element.textContent = FX[s.fx];
        rocker.rotation.x = s.fx === 'wah' ? 0.18 * Math.sin(t * Math.PI * 2 * 0.8) : 0;
        led.visible = s.fx !== 'none';
        acc += dt;
        const key = `${s.gain.toFixed(2)}|${s.clip}`;
        if (key !== drawnKey || (acc > 0.12 && energy > 0.01)) { drawnKey = key; acc = 0; board.redraw(); }
      },
      readout: (s) => compact((() => {
        const r = thd(s);
        const clipped = s.clip !== 'clean' ? r.peakIn > 1 : r.peakIn > RAIL;
        return `<div class="big ${clipped ? 'no' : ''}">${clipped ? 'Clipping: ' : 'Clean: '}${(r.thd * 100).toFixed(r.thd < 0.1 ? 1 : 0)}% distortion</div>
          <div class="row"><span>Pickup in</span><b>${Math.round(VIN * 1000)} mV peak</b></div>
          <div class="row"><span>After ×${s.gain < 10 ? s.gain.toFixed(1) : Math.round(s.gain)} gain</span><b>${r.peakIn.toFixed(2)} V</b></div>
          <div class="row"><span>3rd harmonic added</span><b>${r.h[3] / r.h[1] > 1e-4 ? (20 * Math.log10(r.h[3] / r.h[1])).toFixed(0) + ' dB' : 'none'}</b></div>
          <div class="row"><span>Effect</span><b>${FX[s.fx]}</b></div>
          <small>THD = √(h₂² + h₃² + …)/h₁ for a pure sine. Limits: ±1 V clipped, ±${RAIL} V clean (illustrative).</small>`;
      })(), stage),
      dispose() { synth.allOff(); synth.amp({ gain: 1, clip: 'clean', fx: 'none' }); },
    };
  },
};
