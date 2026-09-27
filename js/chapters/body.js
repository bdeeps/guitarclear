// Chapter 4: why the body makes it loud. The bridge rocks the thin spruce top, and the air in the box
// bounces in and out of the sound hole like air in a bottle (a Helmholtz resonator). The two couple
// into a low "air" resonance near 100 Hz and a "top" resonance near 200 Hz.
import { THREE, M, beam, box, clamp, swarm } from '../kit.js';
import { makeGuitar, stringInfo, synth, midiFreq, TUNING, CHORDS, DREAD, boardMesh, panel, compact, scheduler } from '../guitar.js';

const S = 3.8;
const C = 343;                   // speed of sound in air at 20 °C, m/s
const T_TOP = 0.0025;            // top thickness, about 2.5 mm (UNSW Music Acoustics)
const V0 = 16.4;                 // a dreadnought holds roughly 1,000 cubic inches of air ≈ 16.4 L (approximate)
// Two-oscillator model of the guitar body (Christensen and Vistisen, 1980): the top as a piston on a
// spring (fp) and the air in the hole as a Helmholtz mass (fH), coupled through the air spring of the box
// (fc² ∝ 1/V). The coupled modes f₋, f₊ satisfy f₋·f₊ = fH·fp and f₋² + f₊² = fH² + fp² + fc².
// fp and fc are chosen so that a 16.4 L box with a 102 mm hole gives the measured ~100 Hz and ~200 Hz.
const FP = 155, FC0 = 96.6;

function body(s) {
  const r = s.hole / 2000, A = Math.PI * r * r, V = s.vol / 1000;
  const Leff = T_TOP + 1.7 * r;                                  // end corrections of 0.85 r on each side of the hole
  const fH = (C / (2 * Math.PI)) * Math.sqrt(A / (V * Leff));
  const fc2 = FC0 * FC0 * (V0 / s.vol);
  const Sm = fH * fH + FP * FP + fc2, P = fH * fH * FP * FP, D = Math.sqrt(Math.max(0, Sm * Sm - 4 * P));
  return { r, A, V, Leff, fH, fA: Math.sqrt((Sm - D) / 2), fT: Math.sqrt((Sm + D) / 2) };
}
// Response of the body to a force at the bridge: two resonances (air, Q ≈ 25; top, Q ≈ 20) and a
// gentle rise of the upper plate modes. Relative dB.
function response(f, b) {
  const pk = (f0, Q) => 1 / Math.hypot(1 - (f / f0) ** 2, f / (f0 * Q));
  const a = 0.55 * pk(b.fA, 25) + 0.9 * pk(b.fT, 20) + 0.6 * clamp(f / 400, 0.3, 1.4);
  return 20 * Math.log10(a);
}

export default {
  id: 'body',
  short: 'The body',
  title: 'Why the body makes it loud',
  subtitle: 'A string alone is almost silent. A hollow wooden box pumps the air.',
  view: { pos: [0.5, 2.35, 4.6], target: [0.15, 1.75, 0] },
  learn: `<p>A string is so thin that air just slips around it as it swings. On its own, even a hard pluck is barely louder than a whisper. So the strings press down on the <b>bridge</b>, which is glued to the thin <b>top</b>. As the strings pull and push, the bridge rocks, and the top pumps in and out like a loudspeaker cone. The top is big, so it moves a lot of air.</p>
    <p>The box helps in a second way. The air inside is a <b>spring</b>, and the air in the <b>sound hole</b> is a little plug that bounces on it, like when you blow across a bottle. This is a <b>Helmholtz resonator</b>. For a box of volume V and a hole of area A, it rings at <b>f = (c/2π) × √(A / (V × L))</b>, where c is the speed of sound and L is the hole's effective length. The air and the top shake each other, and together they make two strong <b>resonances</b>: the air mode near <b>100 Hz</b> and the top mode near <b>200 Hz</b>. They boost the low notes, which is why a big dreadnought sounds so deep.</p>
    <p>The top is usually <b>spruce</b>: light, stiff along the grain and only about 2.5 mm thick. Strips of wood called <b>braces</b> stop it from bulging under the strings' pull. Steel-string guitars use <b>X-bracing</b>. Classical guitars use <b>fan bracing</b>, made famous by Antonio de Torres. Old parlour guitars used simple <b>ladder bracing</b>. A piano does the same job with a much bigger board: see <a href="/pianoclear/#soundboard">PianoClear</a>.</p>
    <p class="tip"><b>Try it:</b> pluck the low E, then take the body away and pluck again. Make the sound hole bigger and watch the air resonance rise.</p>`,
  terms: [
    { t: 'Soundboard', d: 'The thin wooden top of the guitar that the bridge shakes. It does most of the work of pushing the air.' },
    { t: 'Resonance', d: 'A frequency at which something vibrates very easily, so a small push builds up a big motion.' },
    { t: 'Helmholtz resonator', d: 'A box of air with a neck or hole. The air in the hole bounces on the springy air inside, like blowing across a bottle.' },
    { t: 'Bracing', d: 'Strips of wood glued inside the top to stiffen it: X, fan or ladder patterns.' },
    { t: 'Spruce', d: 'A light, stiff softwood used for most guitar tops and piano soundboards.' },
  ],
  defaults: { bodyOn: true, vol: V0, hole: 102, brace: 'x', mode: 'top', see: false },
  controls: [
    { key: 'bodyOn', type: 'toggle', label: 'Hollow body fitted', hint: 'Off: the same strings on a solid plank.' },
    { key: 'hit', type: 'buttons', label: 'Hear it', items: [{ label: '♪ Low E', act: (s, inst) => inst.pluck([0]) }, { label: '♪ Strum G', act: (s, inst) => inst.pluck(null) }] },
    { key: 'mode', type: 'seg', label: 'Show the resonance', options: [{ v: 'air', label: 'Air (~100 Hz)' }, { v: 'top', label: 'Top (~200 Hz)' }] },
    { key: 'hole', type: 'range', label: 'Sound hole', min: 60, max: 130, step: 1, fmt: (v) => `${v} mm across` },
    { key: 'vol', type: 'range', label: 'Air inside the box', min: 8, max: 26, step: 0.1, fmt: (v) => `${v.toFixed(1)} litres` },
    { key: 'brace', type: 'seg', label: 'Bracing under the top', options: [{ v: 'x', label: 'X' }, { v: 'fan', label: 'Fan' }, { v: 'ladder', label: 'Ladder' }] },
    { key: 'see', type: 'toggle', label: 'See-through top' },
  ],
  quiz: [
    { q: 'Why is a string on its own so quiet?', options: ['It vibrates too slowly', 'It is so thin that air slips around it instead of being pushed', 'Steel can’t vibrate', 'The frets absorb the sound'], answer: 1, why: 'A string only moves a sliver of air. The top has thousands of times more area, so it pushes far more.' },
    { q: 'What happens to the air resonance if you make the sound hole bigger?', options: ['It goes up in frequency', 'It goes down', 'It stays the same', 'It disappears'], answer: 0, why: 'In f = (c/2π)√(A/(V·L)), a bigger hole area A raises the frequency. A bigger box V lowers it.' },
    { q: 'What do the braces under the top do?', options: ['They hold the strings', 'They stiffen the thin top so it doesn’t bulge, and shape how it vibrates', 'They stop the sound escaping', 'They make the guitar heavier so it sustains'], answer: 1, why: 'A 2.5 mm spruce top can’t take the strings’ pull alone. Braces stiffen it while keeping it light.' },
  ],
  reel: [
    { ms: 5600, caption: 'The bridge rocks the thin spruce top, and the air in the box bounces through the sound hole.', set: { bodyOn: true, mode: 'air', see: true, brace: 'x', hole: 102, vol: V0 }, act: (s, inst) => inst.pluck([0], true), view: { pos: [1.4, 2.4, 4.4], target: [0.0, 1.6, 0] }, spin: 0.25 },
  ],

  build({ stage, s: s0 }) {
    const g = makeGuitar('acoustic');
    const holder = new THREE.Group(); holder.scale.setScalar(S); holder.position.set(-0.4 * S, 1.45, 0); holder.rotation.x = -0.35;
    holder.add(g.group); stage.root.add(holder);
    g.vs.forEach((v, i) => { v.vis = 1.1 * (stringInfo('acoustic', i).f / 82.4) ** 0.35; v.tau = 3; });
    stage.pickables.push(...g.hits);
    const P = g.parts;
    const bodyParts = [P.top, P.back, P.sides, P.bracing, P.bridge, P.pins];
    // The plank that replaces the body.
    const plank = new THREE.Group(); g.group.add(plank);
    const pl = box(0.5, 0.075, 0.06, M.matte(0x3b2a1e)); pl.position.set(0.3, 0, -0.03); plank.add(pl);
    const blk = box(0.03, 0.08, 0.012, M.matte(0x16110e)); blk.position.set(g.xSad - 0.004, 0, 0.006); plank.add(blk);
    // Fan and ladder bracing, built under the top like the X.
    const bm = M.matte(0xd9b77c), under = -0.009;
    const fan = new THREE.Group(), ladder = new THREE.Group(); g.group.add(fan, ladder);
    for (let k = -3; k <= 3; k++) fan.add(beam([0.25, k * 0.012, under], [0.03, k * 0.042, under], 0.004, bm, 6));
    fan.add(beam([0.27, -0.14, under], [0.27, 0.14, under], 0.004, bm, 6), beam([0.07, -0.08, under], [0.03, 0.0, under], 0.004, bm, 6));
    [0.1, 0.19, 0.27, 0.41].forEach((x) => { const w = x < 0.2 ? 0.17 : 0.13; ladder.add(beam([x, -w, under], [x, w, under], 0.005, bm, 6)); });
    const xBr = P.bracing;
    // Deformable top: a mode shape we add to the flat slab's heights.
    const top = g.top, tpos = top.geometry.attributes.position, tbase = Float32Array.from(tpos.array);
    // Top mode: a bulge centred on the lower bout, zero at the rim and around the sound hole.
    const shapeTop = (x, y) => { const rr = ((x - 0.16) / 0.16) ** 2 + (y / 0.19) ** 2; return rr < 1 ? (1 - rr) ** 1.5 : 0; };
    // Air in the sound hole: little particles moving in and out.
    const NA = 160, plug = swarm(NA, new THREE.SphereGeometry(0.0028, 8, 6), M.glow(0x8ef0ff, { transparent: true, opacity: 0.85 }));
    plug.castShadow = false; g.group.add(plug);
    const seeds = Array.from({ length: NA }, (_, i) => { const a = (i * 2.399) % (Math.PI * 2), rr = Math.sqrt((i + 0.5) / NA); return [Math.cos(a) * rr, Math.sin(a) * rr, ((i * 7919) % 100) / 100]; });
    // Sound rings leaving the guitar.
    const rings = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 80), M.ghost(0x8ef0ff, 0.3)); g.group.add(m); return m; });
    const holeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), M.glow(0x8ef0ff)); holeRing.position.set(DREAD.holeX, 0, 0.0015); g.group.add(holeRing);
    const lAir = stage.label('Air in and out of the hole', [DREAD.holeX, 0.07, 0.03], g.group, 'hot');
    const lTop = stage.label('Top pumps in and out', [0.13, -0.16, 0.02], g.group, 'hot');
    const lBr = stage.label('', [0.12, 0.1, -0.01], g.group);
    const lPlank = stage.label('Strings on a solid plank', [0.3, -0.06, 0.01], g.group, 'hot');

    // Response chart.
    let B = body(s0), on = s0.bodyOn;
    const chart = boardMesh(760, 440, (c, w, h) => {
      panel(c, w, h, 'How strongly the body answers');
      const x0 = 70, x1 = w - 30, y0 = h - 60, y1 = 105, F0 = 60, F1 = 1000, D0 = -30, D1 = 22;
      const X = (f) => x0 + (Math.log(f / F0) / Math.log(F1 / F0)) * (x1 - x0), Y = (d) => y0 - ((clamp(d, D0, D1) - D0) / (D1 - D0)) * (y0 - y1);
      c.font = '19px sans-serif'; c.fillStyle = 'rgba(255,255,255,.55)'; c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      [60, 100, 200, 400, 1000].forEach((f) => { c.beginPath(); c.moveTo(X(f), y1); c.lineTo(X(f), y0); c.stroke(); c.fillText(f + ' Hz', X(f) - 22, y0 + 26); });
      // The open strings' notes.
      TUNING.forEach((m, i) => { const f = midiFreq(m); c.fillStyle = 'rgba(255,181,71,.8)'; c.fillRect(X(f) - 1, y0 - 12, 3, 12); if (i < 3) c.fillText('EADGBE'[i], X(f) - 5, y0 - 16); });
      c.lineWidth = 4; c.strokeStyle = '#8ef0ff'; c.beginPath();
      for (let k = 0; k <= 300; k++) { const f = F0 * (F1 / F0) ** (k / 300), d = on ? response(f, B) : -26 + 3 * Math.log10(f / 60); k ? c.lineTo(X(f), Y(d)) : c.moveTo(X(f), Y(d)); }
      c.stroke();
      c.fillStyle = '#8ef0ff'; c.font = '600 21px sans-serif';
      if (on) { c.fillText(`air ${Math.round(B.fA)} Hz`, X(B.fA) - 40, Y(response(B.fA, B)) - 12); c.fillText(`top ${Math.round(B.fT)} Hz`, X(B.fT) - 20, Y(response(B.fT, B)) - 12); }
      else c.fillText('No body: no resonances, little sound', x0 + 10, Y(-10));
    }, 2.2);
    chart.mesh.position.set(1.55, 2.62, -0.6); chart.mesh.rotation.y = -0.2; stage.root.add(chart.mesh);

    const sch = scheduler();
    let energy = 0, t = 0, drawn = '';
    const api = {
      pluck(which, silent = false) {
        const frets = which ? [0, -1, -1, -1, -1, -1] : CHORDS.G.frets;
        frets.forEach((fr, i) => {
          if (fr < 0) return;
          sch.at(which ? 0 : i * 0.03, () => {
            g.setFret(i, fr); const v = g.vs[i]; v.pluck(0.17 / v.stop, 0.007);
            if (!silent) synth.pluck(midiFreq(TUNING[i] + fr), { id: i, beta: 0.17 / v.stop, tone: on ? 'acoustic' : 'bare', vel: 0.8 });
          });
        });
        energy = 1;
      },
    };
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        synth.sync();
        t += dt;
        sch.update(dt);
        on = s.bodyOn;
        B = body(s);
        bodyParts.forEach((p) => { p.visible = on; });
        plank.visible = !on; lPlank.visible = !on;
        xBr.visible = on && s.brace === 'x'; fan.visible = on && s.brace === 'fan'; ladder.visible = on && s.brace === 'ladder';
        g.setSee(s.see ? 0.3 : 1);
        lBr.visible = on && s.see;
        lBr.element.textContent = { x: 'X-bracing (steel-string)', fan: 'Fan bracing (classical)', ladder: 'Ladder bracing (old parlour)' }[s.brace];
        for (const v of g.vs) { v.update(dt); v.draw(); }
        energy *= Math.exp(-dt / 2.2);
        const e = 0.18 + energy;                               // a little idle motion so the modes are always visible
        const air = s.mode === 'air';
        // Drawn slowed down: the air mode at 1 swing a second, the top mode at 2.
        const ph = t * Math.PI * 2 * (air ? 1 : 2);
        const wTop = on ? (air ? 0.25 : 1) * 0.006 * e * Math.sin(ph) : 0;
        for (let i = 0; i < tpos.count; i++) {
          const x = tbase[i * 3], y = tbase[i * 3 + 1];
          tpos.array[i * 3 + 2] = tbase[i * 3 + 2] + wTop * shapeTop(x, y);
        }
        tpos.needsUpdate = true;
        P.bridge.position.z = wTop * shapeTop(g.xSad, 0);
        // Air plug: the hole radius follows the slider, particles move along z.
        const hr = B.r;
        holeRing.scale.setScalar(hr); holeRing.visible = on && Math.abs(s.hole - 102) > 1;
        const zAmp = on ? (air ? 0.03 : 0.008) * e : 0;
        for (let i = 0; i < NA; i++) {
          const [cx, cy, z0] = seeds[i];
          const z = -0.03 + z0 * 0.05 + zAmp * Math.sin(ph + (air ? 0 : Math.PI));
          plug.place(i, [DREAD.holeX + cx * hr * 0.92, cy * hr * 0.92, z], null, on ? 1 : 0.001);
        }
        plug.done();
        lAir.visible = on && air; lTop.visible = on && !air;
        // Rings of sound from the body; faint without it.
        rings.forEach((m, k) => {
          const u = (t * 0.45 + k / rings.length) % 1;
          m.position.set(0.22, 0, 0.03 + u * 0.35); m.scale.setScalar(0.08 + u * 0.35);
          m.material.opacity = (1 - u) * (on ? 0.12 + 0.35 * Math.min(1, energy * 1.5) : 0.03 * energy);
        });
        const key = `${on}|${B.fA.toFixed(1)}|${B.fT.toFixed(1)}`;
        if (key !== drawn) { drawn = key; chart.redraw(); }
      },
      readout: (s) => compact((() => {
        const b = body(s);
        if (!s.bodyOn) return `<div class="big no">Almost silent</div>
          <div class="row"><span>String alone, plucked</span><b>roughly 25 dB quieter</b></div>
          <div class="row"><span>That is about</span><b>300× less sound power</b></div>
          <small>Rough figures: a strummed acoustic gives about 80 dB at 1 m; an unplugged solid-body electric 50 to 65 dB.</small>`;
        return `<div class="big">Air ${Math.round(b.fA)} Hz, top ${Math.round(b.fT)} Hz</div>
          <div class="row"><span>Helmholtz, rigid box</span><b>${Math.round(b.fH)} Hz</b></div>
          <div class="row"><span>Hole area A</span><b>${(b.A * 1e4).toFixed(0)} cm²</b></div>
          <div class="row"><span>Effective hole length L</span><b>${(b.Leff * 1000).toFixed(0)} mm</b></div>
          <div class="row"><span>Normal strum at 1 m</span><b>about 80 dB</b></div>
          <small>f = (c/2π)√(A/(V·L)). The flexible top pulls the air mode down.</small>`;
      })(), stage),
      dispose() { synth.allOff(); },
    };
  },
};
