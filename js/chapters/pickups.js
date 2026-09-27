// Chapter 5: electric pickups. A magnet magnetises the steel string above it; as the string moves,
// the magnetic flux through the coil changes and induces a voltage, EMF = −N·dΦ/dt (Faraday's law).
// Single coil vs humbucker (two coils, reversed, so hum cancels), and pickup position as a comb filter.
import { THREE, M, box, beam, torus, clamp } from '../kit.js';
import { VString, stringInfo, synth, harmonics, PICKUPS, SCALE_M, STRING_NAMES, boardMesh, panel, compact } from '../guitar.js';

const U = 7.0;                          // scene units per metre for the long string
const YS = 0.3, ZS = 1.5;              // the long string's height and depth
const XB = -SCALE_M * U / 2 - 0.3;      // bridge end
const BETA = 0.3;                       // picked about 190 mm from the bridge, a common spot on a Strat
const KMAX = 24;
const TURNS = { single: 8000, humbucker: 10000 };     // a Strat single coil ≈ 8,000 turns of 42 AWG; a humbucker's two coils together, roughly
const OHMS = { single: '≈ 6 kΩ', humbucker: '≈ 7.5 to 9 kΩ' };
const HUM_MV = 25;                      // hum picked up by a single coil near mains wiring, a typical few tens of mV (illustrative)
const COIL_GAP = 0.018;                 // centres of a humbucker's two coils, about 18 mm apart
const MV_CAL = 190;                     // calibration: a firm pluck of the low E on the neck single coil ≈ 190 mV peak (sound-au.com measured 50–300 mV)

// The signal: string velocity above the pickup, a sum of harmonics weighted by sin(kπp) for each coil.
function signal(s) {
  const info = stringInfo('electric', s.str), f = info.f, p0 = PICKUPS.find((q) => q.id === s.pos).d / SCALE_M;
  const disp = harmonics(BETA, { K: KMAX });                       // already includes the ×k for velocity
  const coils = s.type === 'humbucker' ? [p0 - COIL_GAP / 2 / SCALE_M, p0 + COIL_GAP / 2 / SCALE_M] : [p0];
  const w = s.type === 'humbucker' ? 0.65 : 1;                      // each humbucker coil has fewer turns than a Strat coil
  const amp = [0];
  for (let k = 1; k <= KMAX; k++) amp.push(disp[k] * coils.reduce((a, p) => a + w * Math.sin(k * Math.PI * p), 0) * (1 / (1 + (k * f / 6000) ** 2)));
  return { f, p0, amp, info };
}
// Waveform over the first t seconds (mV), with a fixed calibration shared by every setting.
let CAL = null;
function wave(s, t) {
  const sg = signal(s);
  if (!CAL) { const ref = signal({ str: 0, pos: 'neck', type: 'single' }); let m = 0; for (let i = 0; i < 400; i++) m = Math.max(m, Math.abs(sum(ref, (i / 400) / ref.f))); CAL = MV_CAL / m; }
  return sum(sg, t) * CAL;
}
function sum(sg, t) { let v = 0; for (let k = 1; k < sg.amp.length; k++) v += sg.amp[k] * Math.sin(2 * Math.PI * k * sg.f * t); return v; }
const hum = (s, t) => (s.hum ? (s.type === 'humbucker' ? 0.03 : 1) * HUM_MV * (Math.sin(2 * Math.PI * 50 * t) + 0.35 * Math.sin(2 * Math.PI * 150 * t)) : 0);

export default {
  id: 'pickups',
  short: 'Pickups',
  title: 'How a pickup hears a string',
  subtitle: 'A magnet, a coil of hair-thin wire, and Faraday’s law.',
  view: { pos: [0.15, 2.2, 6.3], target: [0.15, 1.45, 0] },
  learn: `<p>An electric guitar's <b>pickup</b> is a <b>magnet</b> wrapped in a <b>coil</b> of very thin copper wire, about 8,000 turns of it. The magnet makes the steel string above it magnetic too. When the string moves towards the magnet and away, it changes how much <b>magnetic flux</b> passes through the coil.</p>
    <p>A changing flux through a coil makes a voltage. That is <b>Faraday's law</b>: <b>EMF = −N × dΦ/dt</b>, where N is the number of turns and dΦ/dt how fast the flux changes (see <a href="/faradayclear/">Faraday's law</a>). So the pickup's voltage follows the string's <b>speed</b>, a few tenths of a volt at most, and it wiggles at exactly the string's frequency. A cable carries it to the amp. That is why pickups need <b>steel</b> strings: nylon isn't magnetic.</p>
    <p>A single coil also picks up the 50 Hz <b>hum</b> from mains wiring. Seth Lover's <b>humbucker</b> fixes this with two coils wound in opposite directions and magnets pointing opposite ways. The hum arrives at both coils the same way and <b>cancels</b>. The string's signal flips twice, so it <b>adds up</b>.</p>
    <p>Where the pickup sits matters. It only hears the harmonics that move at its spot. A pickup a quarter of the way along the string sits on a node of the 4th harmonic, so it can't hear it. Near the neck, the pickup hears strong low harmonics: a warm, round tone. Near the bridge, every harmonic moves only a little but the high ones count more: a thin, bright tone.</p>
    <p class="tip"><b>Try it:</b> pluck with the neck and then the bridge pickup and compare the waveforms. Turn on the hum, then switch to a humbucker.</p>`,
  terms: [
    { t: 'Pickup', d: 'A magnet inside a coil of fine wire that turns a steel string’s motion into a small voltage.' },
    { t: 'Magnetic flux', d: 'How much magnetic field passes through a loop, measured in webers (Wb).' },
    { t: 'Faraday’s law', d: 'A changing magnetic flux through a coil makes a voltage: EMF = −N × dΦ/dt.' },
    { t: 'Humbucker', d: 'A pickup with two coils wound opposite ways, so hum cancels while the string’s signal adds.' },
    { t: 'Hum', d: 'A low buzz at the mains frequency, 50 Hz in India and Europe, 60 Hz in the Americas.' },
    { t: 'Comb filter', d: 'A filter that removes evenly spaced frequencies, like the teeth of a comb.' },
  ],
  defaults: { type: 'single', pos: 'neck', str: 0, hum: false },
  controls: [
    { key: 'type', type: 'seg', label: 'Pickup', options: [{ v: 'single', label: 'Single coil' }, { v: 'humbucker', label: 'Humbucker' }] },
    { key: 'pos', type: 'seg', label: 'Selector', options: PICKUPS.map((p) => ({ v: p.id, label: p.name })) },
    { key: 'str', type: 'seg', label: 'String', options: STRING_NAMES.map((n, i) => ({ v: i, label: n })) },
    { key: 'hum', type: 'toggle', label: 'Mains wiring nearby (50 Hz hum)' },
    { key: 'hit', type: 'buttons', label: 'Hear it', items: [{ label: '♪ Pluck', act: (s, inst) => inst.pluck() }] },
  ],
  quiz: [
    { q: 'What makes the voltage in a pickup’s coil?', options: ['The string touching the magnet', 'The moving steel string changing the magnetic flux through the coil', 'Static electricity from your fingers', 'A battery inside the guitar'], answer: 1, why: 'Faraday’s law: a changing flux through the coil induces an EMF. No change, no voltage.' },
    { q: 'Why does a humbucker cancel hum?', options: ['It is shielded in lead', 'Its two coils are wound in opposite directions, so hum arriving at both cancels while the string signal adds', 'It uses stronger magnets', 'It only works above 50 Hz'], answer: 1, why: 'The hum induces opposite voltages in the two reversed coils. The magnets are reversed too, so the string’s signal comes out the same way in both.' },
    { q: 'Why does the bridge pickup sound brighter than the neck pickup?', options: ['It has more turns', 'Close to the bridge the low harmonics barely move, so the high ones make up more of the sound', 'The strings are thinner there', 'It is nearer the amp'], answer: 1, why: 'The pickup hears each harmonic in proportion to how much it moves at that spot. Near the bridge, the fundamental hardly moves.' },
  ],
  reel: [
    { ms: 5400, caption: 'A pickup is a magnet in a coil: the moving steel string changes the flux and makes a voltage.', set: { type: 'single', pos: 'neck', str: 0, hum: false }, act: (s, inst) => inst.pluck(true), view: { pos: [-0.5, 2.1, 5.6], target: [-0.3, 1.4, 0] }, spin: 0 },
    { ms: 5000, caption: 'A humbucker’s two reversed coils cancel mains hum but add up the string’s signal.', set: { type: 'humbucker', pos: 'bridge', str: 0, hum: true }, act: (s, inst) => inst.pluck(true), view: { pos: [0.6, 2.2, 5.8], target: [0.2, 1.45, 0] }, spin: 0 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    // ---- the big cutaway of one pole piece and its coil, one or two of them
    const cut = new THREE.Group(); cut.position.set(-1.25, 1.0, 0.2); cut.scale.setScalar(0.85); root.add(cut);
    const N = M.plastic(0xd9433b), Sm = M.plastic(0x5b7fd6), cu = M.metal(0xc8763a, { roughness: 0.35, emissive: new THREE.Color(0xff8a30), emissiveIntensity: 0 });
    const bob = M.plastic(0x1b1b1f);
    const makeUnit = (northUp) => {
      const u = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 24), northUp ? N : Sm); top.position.y = 0.25; u.add(top);
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 24), northUp ? Sm : N); bot.position.y = -0.25; u.add(bot);
      const lab = (t, y) => stage.label(t, [0, y, 0.13], u, 'hot');
      u.userData.labs = [lab(northUp ? 'N' : 'S', 0.38), lab(northUp ? 'S' : 'N', -0.38)];
      const plateT = box(0.62, 0.04, 0.62, bob); plateT.position.y = 0.46; u.add(plateT);
      const plateB = box(0.62, 0.04, 0.62, bob); plateB.position.y = -0.46; u.add(plateB);
      for (let k = 0; k < 12; k++) { const t = torus(0.2, 0.035, cu, 40); t.rotation.x = Math.PI / 2; t.position.y = -0.4 + k * 0.073; u.add(t); }
      // Field lines: loops leaving one end of the magnet and returning to the other.
      const lines = new THREE.Group(); u.add(lines);
      const lm = M.ghost(0x8ef0ff, 0.45);
      for (const side of [-1, 1]) for (const R of [0.42, 0.62, 0.85]) {
        const pts = [];
        for (let a = -Math.PI / 2; a <= Math.PI / 2 + 1e-6; a += Math.PI / 24) pts.push(new THREE.Vector3(side * (0.1 + R * Math.cos(a)), 0.5 * Math.sin(a) * (1 + R * 0.9), 0));
        const c = new THREE.CatmullRomCurve3(pts);
        lines.add(new THREE.Mesh(new THREE.TubeGeometry(c, 30, 0.012, 6, false), lm));
      }
      u.userData.lines = lines;
      // Winding arrow: which way the wire goes round.
      const arr = stage.label(northUp ? '↻ clockwise' : '↺ anticlockwise', [0, -0.66, 0.1], u);
      u.userData.arr = arr;
      return u;
    };
    const unitA = makeUnit(true), unitB = makeUnit(false);
    cut.add(unitA, unitB);
    // The string above the magnet(s), seen end-on... drawn as a short steel bar we move up and down.
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 16), M.metal(0xe6eaf0, { roughness: 0.2 })); bar.rotation.z = Math.PI / 2; cut.add(bar);
    const lBar = stage.label('Steel string', [1.0, 0.95, 0], cut);
    const lCoil = stage.label('Coil: about 8,000 turns', [0.58, -0.1, 0], cut);
    const lHum = stage.label('Hum: equal and opposite in the two coils, cancels', [0, -0.98, 0], cut, 'hot');

    // ---- the long string with the three pickups under it
    const Lw = SCALE_M * U, X1 = XB + Lw;
    const deck = box(Lw + 0.5, 0.06, 0.55, M.plastic(0x9c1d18, { roughness: 0.3 })); deck.position.set((XB + X1) / 2, YS - 0.2, ZS); root.add(deck);
    const sad = box(0.06, 0.16, 0.12, M.metal(0xe8ecf2)); sad.position.set(XB, YS - 0.1, ZS); root.add(sad);
    const nut = box(0.06, 0.16, 0.3, M.matte(0xf2ecdc)); nut.position.set(X1, YS - 0.1, ZS); root.add(nut);
    const pk = PICKUPS.map((p) => {
      const g = new THREE.Group(); g.position.set(XB + p.d * U, YS - 0.13, ZS); root.add(g);
      const cover = box(0.12, 0.08, 0.46, M.plastic(0xf4f1e8)); g.add(cover);
      const cover2 = box(0.12, 0.08, 0.46, M.plastic(0xf4f1e8)); cover2.position.x = COIL_GAP * U; g.add(cover2);
      const lab = stage.label(p.name, [0, -0.2, 0.3], g);
      g.userData = { cover, cover2, lab };
      return g;
    });
    const v = new VString(0.012, M.metal(0xc9ced6, { roughness: 0.3 }), { seg: 160, K: 12 });
    v.A.set(XB, YS, ZS); v.B.set(X1, YS, ZS); v.dir.set(0, 1, 0); v.tau = 5; root.add(v.mesh);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 32), M.glow(0xffb547)); root.add(mark);

    // ---- scope and harmonic boards
    let S = s0, level = 0, t = 0, since = 9;
    const scope = boardMesh(900, 560, (c, w, h) => {
      panel(c, w, h, 'Voltage out of the pickup');
      const x0 = 60, x1 = w - 24, yA = 60, yB = 300, ym = (yA + yB) / 2, T = 0.03, VMAX = 400;
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (let k = 0; k <= 6; k++) { const x = x0 + (k / 6) * (x1 - x0); c.beginPath(); c.moveTo(x, yA); c.lineTo(x, yB); c.stroke(); }
      c.beginPath(); c.moveTo(x0, ym); c.lineTo(x1, ym); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '19px sans-serif';
      c.fillText('+400 mV', 4, yA + 14); c.fillText('−400', 8, yB - 2); c.fillText('0', 34, ym + 6); c.fillText('30 ms', x1 - 56, yB + 22);
      c.lineWidth = 3; c.strokeStyle = '#8ef0ff'; c.beginPath();
      for (let i = 0; i <= 600; i++) {
        const tt = (i / 600) * T, vv = level * wave(S, tt) + hum(S, tt + t);
        const y = ym - clamp(vv / VMAX, -1, 1) * (yB - yA) / 2, x = x0 + (i / 600) * (x1 - x0);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      // Harmonics heard by this pickup.
      const sg = signal(S), top = Math.max(...sg.amp.slice(1, 13).map(Math.abs), 1e-9);
      const refTop = Math.max(...signal({ ...S, pos: 'neck' }).amp.slice(1, 13).map(Math.abs), 1e-9);
      const by0 = h - 40, bw = (w - 80) / 12;
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '600 21px sans-serif'; c.fillText('Harmonics this pickup hears', 24, 360);
      for (let k = 1; k <= 12; k++) {
        const a = Math.abs(sg.amp[k]) / Math.max(top, refTop * 0.5), x = 40 + (k - 1) * bw, bh = a * 120;
        c.fillStyle = k === 1 ? '#8ef0ff' : '#ffb547'; c.fillRect(x + 6, by0 - bh, bw - 12, bh);
        c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '17px sans-serif'; c.textAlign = 'center'; c.fillText('×' + k, x + bw / 2, by0 + 22); c.textAlign = 'left';
      }
    }, 2.6);
    scope.mesh.position.set(1.95, 1.9, -0.3); scope.mesh.rotation.y = -0.15; root.add(scope.mesh);

    const api = {
      pluck(silent = false) {
        v.pluck(BETA, 0.16); level = 1; since = 0;
        const sg = signal(S);
        if (!silent) synth.pluck(sg.f, { id: 'pk', beta: BETA, tone: 'electric', pickup: sg.p0, hum: S.hum && S.type === 'single' });
      },
    };
    synth.amp({ gain: 1, clip: 'clean', fx: 'none' });
    let lastKey = '', acc = 0;
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        synth.sync();
        S = s; t += dt; since += dt;
        const hb = s.type === 'humbucker';
        // The cutaway.
        unitA.position.x = hb ? -0.55 : 0; unitB.visible = hb;
        unitB.position.x = 0.55;
        unitB.userData.labs.forEach((l) => { l.visible = hb; }); unitB.userData.arr.visible = hb;
        unitA.userData.arr.visible = hb;
        lCoil.element.textContent = hb ? 'Two coils, wound opposite ways' : 'Coil: about 8,000 turns';
        lCoil.position.set(hb ? 1.35 : 0.62, hb ? 0.2 : -0.1, 0);
        lHum.visible = hb && s.hum;
        // String velocity above the pickup drives the bar and the coil's glow.
        v.update(dt); v.draw();
        const sg = signal(s), p = sg.p0;
        const y = v.y(p) * 1.6;
        let vel = 0; for (let k = 1; k <= v.K; k++) vel += v.amp[k] * k * Math.sin(k * Math.PI * p) * Math.sin(v.phase[k]);
        bar.position.set(0, 0.78 + y, 0);
        lBar.position.set(1.0, 0.95 + y, 0);
        cu.emissiveIntensity = clamp(Math.abs(vel) * 9, 0, 1.6) + (s.hum && !hb ? 0.25 * (0.5 + 0.5 * Math.sin(t * 12)) : 0);
        [unitA, unitB].forEach((u) => u.userData.lines.scale.set(1, 1 + 0.25 * y, 1));
        // Pickups under the long string.
        pk.forEach((g, i) => {
          const on = PICKUPS[i].id === s.pos;
          g.userData.cover2.visible = hb;
          [g.userData.cover, g.userData.cover2].forEach((m) => m.material.emissive?.setHex(on ? 0x2a6f78 : 0));
        });
        const xp = XB + p * Lw;
        mark.position.set(xp + (hb ? COIL_GAP * U / 2 : 0), YS + 0.02, ZS + 0.001);
        mark.visible = true;
        // Scope: the level decays like the string; hum keeps running.
        level = Math.exp(-since / 1.6) * (since < 50 ? 1 : 0);
        acc += dt;
        const key = `${s.type}|${s.pos}|${s.str}|${s.hum}`;
        if (key !== lastKey || acc > 0.1) { lastKey = key; acc = 0; scope.redraw(); }
      },
      readout: (s) => compact((() => {
        const sg = signal(s), hb = s.type === 'humbucker';
        let pk = 0; for (let i = 0; i < 400; i++) pk = Math.max(pk, Math.abs(wave(s, (i / 400) / sg.f)));
        const dead = []; for (let k = 2; k <= 12; k++) if (Math.abs(sg.amp[k]) < 0.12 * Math.abs(harmonics(BETA, { K: 12 })[k])) dead.push('×' + k);
        const d = PICKUPS.find((q) => q.id === s.pos).d;
        return `<div class="big">Peak output ≈ ${Math.round(pk)} mV</div>
          <div class="row"><span>Pickup from the bridge</span><b>${Math.round(d * 1000)} mm (${(d / SCALE_M).toFixed(2)} of the string)</b></div>
          <div class="row"><span>Harmonics it can’t hear</span><b>${dead.length ? dead.join(', ') : 'none below ×12'}</b></div>
          <div class="row"><span>Coil</span><b>${hb ? 'two, opposite' : '≈ 8,000 turns'}, ${OHMS[s.type]}</b></div>
          <div class="row"><span>Hum at 50 Hz</span><b ${s.hum && !hb ? 'class="no"' : ''}>${s.hum ? (hb ? 'cancelled (≈ 3% left)' : `≈ ${HUM_MV} mV`) : 'off'}</b></div>
          <small>EMF = −N·dΦ/dt: ${Math.round(pk)} mV from ${TURNS[s.type].toLocaleString('en')} turns is a flux change of ${(pk / 1000 / TURNS[s.type] * 1e6).toFixed(0)} µWb/s per turn.</small>`;
      })(), stage),
      dispose() { synth.allOff(); },
    };
  },
};
void beam;
