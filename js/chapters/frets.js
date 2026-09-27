// Chapter 3: frets and chords. Equal temperament: every fret shortens the vibrating length by 2^(−1/12),
// so fret n sits at d = L(1 − 2^(−n/12)) from the nut. Click the fretboard to play; strum chord shapes.
import { THREE, M, beam, clamp } from '../kit.js';
import { makeGuitar, stringInfo, synth, midiFreq, midiName, TUNING, CHORDS, SCALE_M, E_STEEL, INCH, boardMesh, panel, compact, scheduler } from '../guitar.js';

const S = 5;                                     // 1 scene unit = 20 cm
const SCALES = { 650: 0.65, 648: SCALE_M, 628: 24.75 * INCH };
const CHORD_LIST = ['E', 'A', 'D', 'G', 'C', 'Em', 'Am'];
const PLUCK_U = 0.17;                           // over the sound hole
const ACTION = 0.002;                           // high E string height above the 12th fret, m (a typical 2 mm)

// Fret positions three ways: exact equal temperament, the old rule of 18, and the rule of 17.817.
const exact = (n, L) => L * (1 - 2 ** (-n / 12));
const rule = (n, L, k) => L * (1 - ((k - 1) / k) ** n);
const centsOff = (n, k) => n * (1200 * Math.log2(k / (k - 1)) - 100);   // how far a rule-of-k fret plays from 100 cents per fret

// Pressing the plain high E down at the 12th fret stretches it a little, so it goes sharp.
// Extra length ≈ 2h²/L, extra tension ΔT = E·A·(2h²/L)/L, and f ∝ √T gives Δf/f ≈ ΔT/2T.
function intonation(L) {
  const info = stringInfo('acoustic', 5), A = Math.PI * (info.d / 2) ** 2;
  const T = info.T * (L / SCALE_M) ** 2;                    // same note on a different scale needs T ∝ L²
  const dT = (E_STEEL * A * (2 * ACTION * ACTION / L)) / L;
  const r = Math.sqrt(1 + dT / T), cents = 1200 * Math.log2(r);
  // Move the saddle back by Δ so that (L + Δ)/(L/2 + Δ)·r = 2.
  const comp = (L * (r - 1)) / (2 - r);
  return { cents, comp };
}

export default {
  id: 'frets',
  short: 'Frets and chords',
  title: 'Frets, notes and chords',
  subtitle: 'Each fret makes the string about 6% shorter: one semitone higher.',
  view: { pos: [0.15, 3.5, 2.3], target: [0.15, 1.1, -0.2] },
  learn: `<p>Press a string down just behind a <b>fret</b> and the string now vibrates from the saddle to that fret instead of the nut. Shorter string, higher note. Each fret raises the note by one <b>semitone</b>, and 12 frets make an <b>octave</b>.</p>
    <p>For an octave, the string must be exactly <b>half</b> as long, so the 12th fret sits in the middle: on a 650 mm classical guitar, <b>325 mm</b> from the nut. In between, each fret shortens the string by the same factor, <b>2<sup>−1/12</sup> ≈ 0.944</b>: about 5.6% each time. That is <b>equal temperament</b>. Fret n sits at <b>d = L × (1 − 2<sup>−n/12</sup>)</b>, so the frets get closer together as you go up.</p>
    <p>Old makers used a shortcut: put each fret 1/18 of the way from the last one to the bridge. That <b>rule of 18</b> plays slightly flat, so later makers used <b>17.817</b>, which is almost exact.</p>
    <p>A <b>chord</b> is several notes at once. Your fingers make a <b>shape</b>, and you strum all six strings. Pressing a string down also stretches it a little, so fretted notes go slightly <b>sharp</b>. To fix that, the saddle sits a millimetre or two further back than the exact scale length. That is <b>compensation</b>, and getting every fret in tune is called <b>intonation</b>.</p>
    <p class="tip"><b>Try it:</b> pick a chord and strum it, then click anywhere on the fretboard to play single notes. Slide the fret number and check the 12th fret is at half the scale.</p>`,
  terms: [
    { t: 'Semitone', d: 'The smallest step in Western music, one fret on a guitar. Twelve make an octave.' },
    { t: 'Equal temperament', d: 'A tuning where every semitone has the same frequency ratio, 2^(1/12) ≈ 1.059.' },
    { t: 'Scale length', d: 'The vibrating length of an open string, from nut to saddle: 650 mm on a classical guitar.' },
    { t: 'Chord', d: 'Three or more notes played together.' },
    { t: 'Intonation', d: 'How well a guitar stays in tune as you play up the neck.' },
    { t: 'Compensation', d: 'Setting the saddle slightly further back to cancel the sharpening from pressing strings down.' },
  ],
  defaults: { chord: 'E', n: 12, scale: 650 },
  controls: [
    { key: 'chord', type: 'seg', label: 'Chord shape', options: CHORD_LIST.map((c) => ({ v: c, label: c })) },
    { key: 'play', type: 'buttons', label: 'Play', items: [{ label: '♪ Strum the chord', act: (s, inst) => inst.strum() }, { label: 'Lift fingers', act: (s, inst) => inst.clear() }] },
    { key: 'n', type: 'range', label: 'Measure to fret', min: 1, max: 20, step: 1, fmt: (v) => `fret ${v}` },
    { key: 'scale', type: 'seg', label: 'Scale length', options: [{ v: 650, label: '650 mm classical' }, { v: 648, label: '25.5 in' }, { v: 628, label: '24.75 in' }] },
  ],
  onChange(s, key) { if (key === 'chord' || key === null) s._apply = true; },
  quiz: [
    { q: 'On a guitar with a 650 mm scale, where is the 12th fret?', options: ['162.5 mm from the nut', '325 mm from the nut, halfway', '433 mm from the nut', '600 mm from the nut'], answer: 1, why: 'The 12th fret is an octave, which needs half the length: 650 ÷ 2 = 325 mm.' },
    { q: 'Why do frets get closer together as you go up the neck?', options: ['To save wood', 'Each fret takes off the same fraction (about 5.6%) of a string that keeps getting shorter', 'Because the strings are thinner there', 'It is just a tradition'], answer: 1, why: 'Each semitone needs the length × 0.944. 5.6% of a shorter string is a shorter step.' },
    { q: 'Why is the saddle set a little further back than the exact scale length?', options: ['To make the guitar louder', 'Pressing a string down stretches it and makes it sharp, so a slightly longer string cancels that', 'To make room for the pick', 'So the strings are easier to change'], answer: 1, why: 'Fretting pulls the string a bit tighter. A millimetre or two of extra length, called compensation, brings it back in tune.' },
  ],
  reel: [
    { ms: 5600, caption: 'Each fret shortens the string by the same 5.6%, so the 12th fret sits exactly halfway.', set: { chord: 'G', n: 12, scale: 650 }, act: (s, inst) => inst.strum(true), view: { pos: [0.3, 3.3, 2.2], target: [0.3, 1.1, -0.2] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const g = makeGuitar('acoustic');
    const holder = new THREE.Group(); holder.scale.setScalar(S); holder.rotation.x = -Math.PI / 2;
    holder.position.set(-0.66 * S, 1.1, 0.25); holder.add(g.group); stage.root.add(holder);
    g.vs.forEach((v, i) => { v.vis = 1.2 * (stringInfo('acoustic', i).f / 82.4) ** 0.35; v.tau = 3; });
    // Clickable cells on the fretboard, one per string per fret.
    const cellMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const cells = [];
    const yAt = (i, x) => { const e = g.ends[i], u = (x - e.A.x) / (e.B.x - e.A.x); return e.A.y + (e.B.y - e.A.y) * u; };
    for (let i = 0; i < 6; i++) for (let n = 1; n <= 15; n++) {
      const x0 = g.fx(n - 1), x1 = g.fx(n), xm = (x0 + x1) / 2;
      const c = new THREE.Mesh(new THREE.BoxGeometry(x0 - x1, 0.0068, 0.004), cellMat); c.position.set(xm, yAt(i, xm), g.zFret + 0.002);
      c.userData = { string: i, fret: n }; g.group.add(c); cells.push(c);
    }
    stage.pickables.push(...cells, ...g.hits);
    // Finger dots.
    const dotMat = M.plastic(0xff7a59, { emissive: new THREE.Color(0x401000) });
    const dots = Array.from({ length: 6 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 16, 10), dotMat); d.scale.z = 0.6; g.group.add(d); return d; });
    const marks = Array.from({ length: 6 }, (_, i) => stage.label('', [g.xNut + 0.022, g.ends[i].B.y, 0.01], g.group));
    // Fret ruler: a line from the nut to fret n along the bass edge, with a label.
    const glow = M.glow(0x8ef0ff), yb = 0.036;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 8), glow); bar.rotation.z = Math.PI / 2; g.group.add(bar);
    const tickA = beam([g.xNut, yb - 0.006, g.zFret], [g.xNut, yb + 0.006, g.zFret], 0.0012, glow, 6); g.group.add(tickA);
    const tickB = beam([0, -0.006, 0], [0, 0.006, 0], 0.0012, glow, 6); g.group.add(tickB);
    const hi = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.06, 10), M.glow(0x8ef0ff)); g.group.add(hi);
    const lRule = stage.label('', [0, 0, 0], g.group, 'hot');
    const lNote = stage.label('', [0.2, -0.24, 0.02], g.group, 'hot');
    stage.label('Nut', [g.xNut + 0.004, -0.05, 0.01], g.group);

    // Chord diagram.
    let shown = s0.chord;
    const diag = boardMesh(420, 470, (c, w, h) => {
      panel(c, w, h, `${shown} chord`);
      const ch = CHORDS[shown], x0 = 70, x1 = w - 70, y0 = 120, fh = 72, nf = 4;
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 7; c.beginPath(); c.moveTo(x0 - 3, y0); c.lineTo(x1 + 3, y0); c.stroke();
      c.lineWidth = 2;
      for (let k = 1; k <= nf; k++) { c.beginPath(); c.moveTo(x0, y0 + k * fh); c.lineTo(x1, y0 + k * fh); c.stroke(); }
      for (let i = 0; i < 6; i++) {
        const x = x0 + (i * (x1 - x0)) / 5;
        c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y0 + nf * fh); c.stroke();
        const fr = ch.frets[i];
        c.font = '600 28px sans-serif'; c.textAlign = 'center'; c.fillStyle = fr < 0 ? '#ff8a8a' : 'rgba(255,255,255,.85)';
        if (fr <= 0) c.fillText(fr < 0 ? '×' : '○', x, y0 - 16);
        if (fr > 0) { const y = y0 + (fr - 0.5) * fh; c.fillStyle = '#ff7a59'; c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.font = '600 22px sans-serif'; c.fillText(ch.fingers[i], x, y + 8); }
        c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '19px sans-serif'; c.fillText('EADGBE'[i], x, y0 + nf * fh + 34);
      }
      c.textAlign = 'left';
    }, 1.05);
    diag.mesh.position.set(1.85, 1.45, -1.0); diag.mesh.rotation.x = -0.55; stage.root.add(diag.mesh);

    const sch = scheduler();
    const fing = CHORDS[s0.chord].frets.slice();
    let last = null;
    const place = () => {
      fing.forEach((fr, i) => {
        g.setFret(i, Math.max(0, fr));
        dots[i].visible = fr > 0;
        if (fr > 0) { const x = g.fx(fr) + 0.28 * (g.fx(fr - 1) - g.fx(fr)); dots[i].position.set(x, yAt(i, x), g.zFret + 0.004); }
        marks[i].element.textContent = fr < 0 ? '×' : fr === 0 ? '○' : '';
        marks[i].visible = fr <= 0;
      });
    };
    place();
    const play = (i, delay = 0, silent = false) => {
      const fr = fing[i]; if (fr < 0) return;
      const v = g.vs[i];
      v.pluck(PLUCK_U / v.stop, 0.006);
      last = TUNING[i] + fr;
      if (!silent) synth.pluck(midiFreq(last), { id: i, beta: PLUCK_U / v.stop, tone: 'acoustic', delay, vel: 0.75 });
    };
    const api = {
      strum(silent = false) { fing.forEach((fr, i) => { if (fr < 0) g.vs[i].damp(); else sch.at(i * 0.03, () => play(i, 0, silent)); }); },
      clear() { fing.fill(0); place(); shown = ''; diag.redraw(); },
      pick(o) {
        const { string: i, fret } = o.userData; if (i === undefined) return;
        fing[i] = fret ?? 0; place(); play(i);
      },
    };
    let drawn = '';
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        synth.sync();
        if (s._apply) { s._apply = false; fing.splice(0, 6, ...CHORDS[s.chord].frets); place(); shown = s.chord; }
        if (shown !== drawn && CHORDS[shown]) { drawn = shown; diag.redraw(); }
        diag.mesh.visible = !!CHORDS[shown];
        sch.update(dt);
        for (const v of g.vs) { v.update(dt); v.draw(); }
        // Ruler to fret n: drawn on the model's own 648 mm neck, numbers for the chosen scale.
        const n = s.n, x = g.fx(n);
        bar.position.set((g.xNut + x) / 2, yb, g.zFret); bar.scale.y = g.xNut - x;
        tickB.position.set(x, yb, g.zFret);
        hi.position.set(x, 0, g.zFret + 0.0008);
        hi.scale.y = g.boardW(x) / 0.06 * 1.05;
        const L = SCALES[s.scale];
        lRule.position.set((g.xNut + x) / 2, yb + 0.014, g.zFret);
        lRule.element.textContent = `Fret ${n}: ${(exact(n, L) * 1000).toFixed(1)} mm`;
        lNote.visible = !!last;
        if (last) lNote.element.textContent = `${midiName(last)}: ${midiFreq(last).toFixed(1)} Hz`;
      },
      readout: (s) => compact((() => {
        const L = SCALES[s.scale], n = s.n, d = exact(n, L), r18 = rule(n, L, 18), r178 = rule(n, L, 17.817), io = intonation(L);
        return `<div class="big">Fret ${n}: ${(d * 1000).toFixed(1)} mm from the nut</div>
          <div class="row"><span>Left to vibrate</span><b>${((L - d) * 1000).toFixed(1)} mm (×${(2 ** (-n / 12)).toFixed(3)})</b></div>
          <div class="row"><span>Rule of 18</span><b>${(r18 * 1000).toFixed(1)} mm, ${Math.abs(centsOff(n, 18)).toFixed(1)} cents flat</b></div>
          <div class="row"><span>Rule of 17.817</span><b>${(r178 * 1000).toFixed(1)} mm</b></div>
          <div class="row"><span>High E fretted at 12</span><b>+${io.cents.toFixed(1)} cents sharp</b></div>
          <div class="row"><span>Saddle moved back to fix it</span><b>${(io.comp * 1000).toFixed(1)} mm</b></div>
          <small>d = L(1 − 2^(−n/12)), L = ${Math.round(L * 1000)} mm. Sharpening from stretch alone, 2 mm action. Stiffness adds more: real saddles sit 1.5 to 3 mm back.</small>`;
      })(), stage),
      dispose() { synth.allOff(); },
    };
  },
};
void clamp;
