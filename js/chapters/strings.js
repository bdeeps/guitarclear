// Chapter 2: a vibrating string. Mersenne's law f = (1/2L)·√(T/μ), the six strings of standard
// tuning, where you pluck it (harmonics with a node at the pluck point go missing), and natural harmonics.
import { THREE, M, box, clamp } from '../kit.js';
import { VString, stringInfo, synth, harmonics, nearest, freqFrom, SCALE_M, STRING_NAMES, G, fretDist, boardMesh, panel, compact } from '../guitar.js';

const U = 7.6;                          // scene units per metre
const Y = 1.25;                         // height of the string
const X0 = -SCALE_M * U / 2;            // the saddle, on the left
const KMAX = 12;
const TOUCH = { 0: 'None', 2: '12th fret', 3: '7th fret', 4: '5th fret' };
const TOUCH_FRET = { 2: 12, 3: 7, 4: 5 };
const ordinal = (k) => k + (k % 10 === 1 && k !== 11 ? 'st' : k % 10 === 2 && k !== 12 ? 'nd' : k % 10 === 3 && k !== 13 ? 'rd' : 'th');

function physics(s) {
  const info = stringInfo('acoustic', s.str), T = s.kg * G;
  const f = freqFrom(SCALE_M, T, info.mu);
  const a = harmonics(s.beta, { K: KMAX, touch: s.touch });
  const missing = [];
  for (let k = 2; k <= KMAX; k++) if (Math.abs(Math.sin(k * Math.PI * s.beta)) < 0.12) missing.push(k);
  return { info, T, f, a, missing, fSound: s.touch ? f * s.touch : f };
}

export default {
  id: 'strings',
  short: 'Strings',
  title: 'What a string does',
  subtitle: 'Length, tension and weight set the note. Where you pluck sets the tone.',
  view: { pos: [0.1, 2.6, 7.0], target: [0.1, 1.95, 0] },
  learn: `<p>Pluck a string and it springs back, overshoots and swings to and fro. The low E string does this <b>82 times a second</b>: its <b>frequency</b> is 82.4 hertz (Hz). The six strings in standard tuning are E, A, D, G, B and E, from <b>82.4 Hz</b> up to <b>329.6 Hz</b>, two octaves higher.</p>
    <p>All six strings are the same length, so the note is set by <b>tension</b> and <b>weight</b>. Marin Mersenne wrote the rule in 1636: <b>f = (1/2L) × √(T/μ)</b>, where L is the length, T the tension and μ the mass of one metre of string. The low strings are thick and wound with bronze wire to make them heavy. Each string pulls with 10 to 14 kg. All six together pull with about <b>73 kg</b>.</p>
    <p>A string swings as a whole and in halves, thirds and quarters at once. These <b>harmonics</b> sit at 2, 3, 4 times the main note, and their mix is the <b>tone</b>. Pluck near the bridge and you get lots of high harmonics: a bright, twangy sound. Pluck in the middle and it is soft and round. Any harmonic with a still point (a <b>node</b>) right where you pluck goes <b>missing</b>, because you can't start a wave at a point that must stay still.</p>
    <p>Touch a string lightly at the <b>12th fret</b> (the middle) and pluck: only the harmonics with a node there survive, and you hear a chiming note an octave up. That is a <b>natural harmonic</b>. The 7th fret gives 3× the note, the 5th fret 4×.</p>
    <p class="tip"><b>Try it:</b> move the pluck point to the middle and watch the even harmonics disappear. Then try the harmonic at the 12th fret. Compare with <a href="/pianoclear/#strings">PianoClear</a>'s struck strings.</p>`,
  terms: [
    { t: 'Frequency', d: 'How many times a second something swings back and forth, in hertz (Hz).' },
    { t: 'Tension', d: 'How hard the string is pulled tight. On a guitar, about 10 to 14 kg per string.' },
    { t: 'Harmonic', d: 'A vibration of the string in 2, 3, 4… equal parts, at 2, 3, 4… times the main note.' },
    { t: 'Node', d: 'A point on a vibrating string that stays still.' },
    { t: 'Natural harmonic', d: 'A chiming note made by touching the string lightly at a node, such as the 12th fret, while you pluck.' },
    { t: 'Wound string', d: 'A string with wire wrapped around a steel core, to make it heavier without making it stiff.' },
  ],
  defaults: { str: 0, kg: stringInfo('acoustic', 0).kg, beta: 0.2, touch: 0, show: 0 },
  onChange(s, key) { if (key === 'str') s.kg = stringInfo('acoustic', s.str).kg; },
  controls: [
    { key: 'str', type: 'seg', label: 'String', options: STRING_NAMES.map((n, i) => ({ v: i, label: n })) },
    { key: 'kg', type: 'range', label: 'Tension (turn the tuner)', min: 4, max: 20, step: 0.1, fmt: (v) => `${v.toFixed(1)} kg of pull (${Math.round(v * G)} N)` },
    { key: 'beta', type: 'range', label: 'Pluck point', min: 0.03, max: 0.5, step: 0.005, ends: ['near the bridge', 'the middle'], fmt: (v) => `${Math.round(v * SCALE_M * 1000)} mm from the bridge` },
    { key: 'touch', type: 'seg', label: 'Natural harmonic: touch at', options: [0, 2, 3, 4].map((v) => ({ v, label: TOUCH[v] })) },
    { key: 'show', type: 'seg', label: 'Show the vibration', options: [{ v: 0, label: 'All' }, { v: 1, label: '1st' }, { v: 2, label: '2nd' }, { v: 3, label: '3rd' }, { v: 4, label: '4th' }, { v: 5, label: '5th' }] },
    { key: 'hit', type: 'buttons', label: 'Hear it', items: [{ label: '♪ Pluck the string', act: (s, inst) => inst.pluck() }] },
  ],
  quiz: [
    { q: 'All six guitar strings are the same length. What makes the low E string so much lower than the high E?', options: ['It is pulled much tighter', 'It is much heavier per metre (thicker and wound)', 'It is made of a different metal that vibrates slower', 'It is longer inside the headstock'], answer: 1, why: 'The tensions are similar, 10 to 14 kg. The low E is about 18 times heavier per metre, and √18 ≈ 4.2 is about two octaves.' },
    { q: 'You pluck a string exactly in the middle. Which harmonics go missing?', options: ['The odd ones: 1st, 3rd, 5th', 'The even ones: 2nd, 4th, 6th', 'Only the 12th', 'None'], answer: 1, why: 'Every even harmonic has a node in the middle, so a pluck there can’t start it. The sound is soft and hollow.' },
    { q: 'You touch the string lightly at the 12th fret and pluck. What do you hear?', options: ['Nothing', 'A note an octave higher: only harmonics with a node in the middle survive', 'The same note, quieter', 'A note an octave lower'], answer: 1, why: 'Your finger stops every mode that moves at the middle. The 2nd, 4th, 6th… harmonics have a node there, so they ring on: an octave up.' },
  ],
  reel: [
    { ms: 5400, caption: 'A plucked string swings as a whole, and in halves, thirds and quarters at once.', set: { str: 1, kg: stringInfo('acoustic', 1).kg, beta: 0.2, touch: 0, show: 0 }, act: (s, inst) => inst.pluck(true), view: { pos: [0.3, 2.5, 6.4], target: [0.3, 1.95, 0] }, spin: 0 },
    { ms: 5200, caption: 'Pluck it in the middle and every even harmonic goes missing: a softer, rounder note.', set: { str: 1, kg: stringInfo('acoustic', 1).kg, beta: 0.5, touch: 0, show: 0 }, act: (s, inst) => inst.pluck(true), view: { pos: [-0.5, 2.7, 6.3], target: [0.3, 1.95, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    // A strip of fretboard under the string, from saddle to nut, frets at their real places.
    const Lw = SCALE_M * U, X1 = X0 + Lw;
    const wood = M.matte(0x2a1c14, { roughness: 0.6 });
    const deck = box(Lw + 0.9, 0.12, 0.9, M.matte(0x7a5534)); deck.position.set(0, Y - 0.42, 0); root.add(deck);
    [-1, 1].forEach((k) => { const leg = box(0.3, Y - 0.48, 0.6, M.matte(0x4a3020)); leg.position.set(k * (Lw / 2 + 0.1), (Y - 0.48) / 2, 0); root.add(leg); });
    const fb = box(fretDist(19) * U, 0.05, 0.5, wood); fb.position.set(X1 - (fretDist(19) * U) / 2, Y - 0.34, 0); root.add(fb);
    const fretMat = M.metal(0xd7dbe2, { roughness: 0.25 });
    for (let n = 1; n <= 19; n++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), fretMat); f.rotation.x = Math.PI / 2; f.position.set(X1 - fretDist(n) * U, Y - 0.31, 0); root.add(f);
    }
    [3, 5, 7, 9, 12, 15, 17].forEach((n) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20), M.plastic(0xf6f2ea)); d.position.set(X1 - ((fretDist(n) + fretDist(n - 1)) / 2) * U, Y - 0.31, 0); root.add(d); });
    const saddle = box(0.06, 0.34, 0.5, M.matte(0xf2ecdc)); saddle.position.set(X0, Y - 0.2, 0); root.add(saddle);
    const bridge = box(0.5, 0.18, 0.7, M.matte(0x16110e)); bridge.position.set(X0 - 0.18, Y - 0.3, 0); root.add(bridge);
    const nut = box(0.08, 0.32, 0.5, M.matte(0xf2ecdc)); nut.position.set(X1 + 0.04, Y - 0.19, 0); root.add(nut);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 16), M.metal(0xe8ecf2)); peg.position.set(X1 + 0.5, Y - 0.05, 0); root.add(peg);
    const tail = box(0.46, 0.02, 0.02, M.metal(0xe6eaf0)); tail.position.set(X1 + 0.27, Y - 0.02, 0); root.add(tail);

    const sMat = M.metal(0xd4a15e, { roughness: 0.35 }), plain = M.metal(0xe6eaf0, { roughness: 0.2 });
    const v = new VString(0.02, sMat, { seg: 200, K: KMAX });
    v.A.set(X0, Y, 0); v.B.set(X1, Y, 0); v.dir.set(0, 1, 0); v.tau = 4.5;
    root.add(v.mesh);
    // Pluck point (a pick) and the finger for natural harmonics.
    const pick = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), M.plastic(0xff7a59)); pick.rotation.z = Math.PI; root.add(pick);
    const finger = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), M.plastic(0xf2c4a0)); finger.scale.set(1, 0.7, 1.4); root.add(finger);
    const nodeMat = M.glow(0xffb547), nodeGeo = new THREE.SphereGeometry(0.085, 14, 10);
    const nodes = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(nodeGeo, nodeMat); root.add(m); return m; });
    const env = [0, 1].map(() => { const l = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8ef0ff, transparent: true, opacity: 0.5 })); l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(121 * 3), 3)); root.add(l); return l; });

    // Harmonic board: bar heights from the pluck-point formula, missing ones marked.
    let P = physics(s0);
    const board = boardMesh(760, 330, (g, w, h) => {
      panel(g, w, h, 'Harmonics in the sound');
      const n = 10, bw = (w - 40) / n, top = Math.max(...P.a.slice(1, n + 1).map(Math.abs), 1e-6);
      for (let k = 1; k <= n; k++) {
        const a = Math.abs(P.a[k]) / top, x = 20 + (k - 1) * bw, bh = a * 160;
        const miss = P.missing.includes(k) && !P.touch;
        g.fillStyle = k === 1 ? '#8ef0ff' : '#ffb547'; g.fillRect(x + 7, 230 - bh, bw - 14, bh);
        if (miss || (P.touch && k % P.touch)) { g.strokeStyle = '#ff6b6b'; g.lineWidth = 3; g.setLineDash([7, 6]); g.strokeRect(x + 7, 100, bw - 14, 130); g.setLineDash([]); }
        g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 25px sans-serif'; g.textAlign = 'center';
        g.fillText(`×${k}`, x + bw / 2, 262);
        g.textAlign = 'left';
      }
      g.fillStyle = '#ff9b9b'; g.font = '23px sans-serif';
      g.fillText(P.touch ? `Finger at the ${TOUCH[P.touch]}: only ×${P.touch}, ×${2 * P.touch}… ring` : P.missing.length ? 'Dashed: missing. A node sits at the pluck point.' : 'No harmonics missing up to ×10', 22, 306);
    }, 3.3);
    board.mesh.position.set(1.75, Y + 1.72, -0.6); root.add(board.mesh);
    P.touch = s0.touch;

    const lNote = stage.label('', [X0 + Lw * 0.5, Y - 0.62, 0.45], root, 'hot');
    const lPick = stage.label('Pluck here', [0, 0, 0], root);
    const lFinger = stage.label('', [0, 0, 0], root);
    stage.label('Saddle', [X0, Y - 0.62, 0.4], root);
    stage.label('Nut', [X1, Y - 0.62, 0.4], root);

    let lastS = s0, drawnKey = '';
    const api = {
      pluck(silent = false) {
        const s = lastS, p = physics(s);
        v.pluck(s.beta, 0.3, s.touch);
        if (!silent) synth.pluck(p.f, { id: 'str', beta: s.beta, tone: 'acoustic', touch: s.touch });
      },
    };
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        lastS = s;
        synth.sync();
        const p = physics(s); p.touch = s.touch;
        const info = p.info;
        v.r = Math.max(0.012, (info.d / 2) * U * 8);             // drawn 8× thicker than life
        v.mesh.material = info.wound ? sMat : plain;
        v.vis = 0.55 * (p.f / 82.4) ** 0.3;
        v.only = s.show; v.onlyGain = 1 + s.show * 0.8;
        v.update(dt); v.draw();
        // Pick and finger.
        const xp = X0 + s.beta * Lw;
        pick.position.set(xp, Y + 0.3, 0.12);
        lPick.position.set(xp, Y + 0.55, 0.12);
        finger.visible = !!s.touch;
        lFinger.visible = !!s.touch;
        if (s.touch) { const xf = X1 - fretDist(TOUCH_FRET[s.touch]) * U; finger.position.set(xf, Y + 0.1, 0); lFinger.position.set(xf, Y + 0.5, 0); lFinger.element.textContent = `Light touch: ${TOUCH[s.touch]}`; }
        // Nodes and envelope of one shown harmonic.
        const kk = s.show;
        nodes.forEach((m, j) => { m.visible = !!kk && j <= kk; m.position.set(X0 + (j / Math.max(1, kk)) * Lw, Y, 0); });
        const A = kk ? Math.abs(v.amp[kk]) * v.onlyGain : 0;
        env.forEach((l, sgn) => {
          const pa = l.geometry.attributes.position;
          for (let i = 0; i <= 120; i++) { const u = i / 120; pa.setXYZ(i, X0 + u * Lw, Y + (sgn ? -1 : 1) * A * Math.sin(kk * Math.PI * u), 0); }
          pa.needsUpdate = true; l.visible = !!kk;
        });
        lNote.element.textContent = `${p.fSound.toFixed(1)} Hz`;
        const key = `${s.str}|${s.kg.toFixed(2)}|${s.beta.toFixed(3)}|${s.touch}`;
        if (key !== drawnKey) { drawnKey = key; P = p; board.redraw(); }
      },
      readout: (s) => compact((() => {
        const p = physics(s), nn = nearest(p.fSound), std = stringInfo('acoustic', s.str);
        const tuned = Math.abs(s.kg - std.kg) < 0.05;
        const miss = p.missing.length ? p.missing.map(ordinal).join(', ') : 'none below the 12th';
        return `<div class="big">${p.fSound.toFixed(1)} Hz: ${nn.name}${Math.abs(nn.cents) >= 3 ? ` <small>${nn.cents > 0 ? '+' : ''}${nn.cents.toFixed(0)} cents</small>` : ''}</div>
          <div class="row"><span>String</span><b>${std.name}, ${std.gauge.toFixed(3).slice(1)} in${std.wound ? ', wound' : ''}</b></div>
          <div class="row"><span>Pull on it</span><b>${s.kg.toFixed(1)} kg${tuned ? ' (in tune)' : ''}</b></div>
          <div class="row"><span>Mass of 1 m (μ)</span><b>${(std.mu * 1000).toFixed(2)} g</b></div>
          <div class="row"><span>Missing harmonics</span><b>${s.touch ? `all but ×${s.touch}, ×${2 * s.touch}…` : miss}</b></div>
          <small>f = (1/2L)·√(T/μ), L = ${Math.round(SCALE_M * 1000)} mm.</small>`;
      })(), stage),
      dispose() { synth.allOff(); },
    };
  },
};
void clamp;
