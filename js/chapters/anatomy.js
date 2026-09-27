// Chapter 1: take an acoustic guitar apart, and compare it with an electric one.
import { THREE, exploder } from '../kit.js';
import { makeGuitar, stringInfo, synth, midiFreq, midiName, TUNING, CHORDS, SETS, SCALE_M, totalKg, compact, scheduler } from '../guitar.js';

const S = 3.6;                     // 1 scene unit ≈ 28 cm
const PLUCK_AT = { acoustic: 0.17, electric: 0.2 };   // over the sound hole / between the pickups

export default {
  id: 'anatomy',
  short: 'Inside a guitar',
  title: 'Inside a guitar',
  subtitle: 'Six strings, a neck with frets, and a hollow wooden box. Or a solid one with magnets.',
  view: { pos: [-0.3, 2.5, 4.75], target: [-0.4, 1.6, 0] },
  learn: `<p>A guitar is six <b>strings</b> stretched between two fixed points: the <b>saddle</b> on the <b>bridge</b> and the <b>nut</b> at the top of the <b>neck</b>. At the far end, each string wraps around a <b>tuner</b> on the <b>headstock</b>. Turn it and the string gets tighter and higher.</p>
    <p>Under the strings is the <b>fretboard</b>, with thin metal <b>frets</b> and dots called <b>inlays</b> to help you find your place. Inside the neck a steel <b>truss rod</b> stops the strings' pull from bending it.</p>
    <p>An <b>acoustic</b> guitar is a hollow box. Its thin <b>top</b> (the <b>soundboard</b>) is braced underneath with strips of wood in an <b>X</b>, and a round <b>sound hole</b> lets the air inside breathe. An <b>electric</b> guitar has a <b>solid body</b> that makes little sound. Instead, magnetic <b>pickups</b> turn the strings' motion into electricity, sent through the <b>output jack</b> to an amplifier.</p>
    <p class="tip"><b>Try it:</b> take the guitar apart, switch to the electric, and click any string to pluck it.</p>`,
  terms: [
    { t: 'Saddle', d: 'A thin strip of bone or plastic on the bridge. The strings cross it, and it marks one end of their vibrating length.' },
    { t: 'Nut', d: 'The slotted strip at the top of the fretboard. It marks the other end of the open strings.' },
    { t: 'Fret', d: 'A metal wire across the fretboard. Press a string behind it and the string vibrates from there instead of the nut.' },
    { t: 'Soundboard', d: 'The thin wooden top of an acoustic guitar. The bridge shakes it, and it pushes the air.' },
    { t: 'Truss rod', d: 'A steel rod inside the neck that resists the pull of the strings, so the neck stays straight.' },
    { t: 'Pickup', d: 'A magnet wrapped in a coil of fine wire, under the strings of an electric guitar. It turns their motion into a voltage.' },
  ],
  defaults: { kind: 'acoustic', explode: 0, xray: false },
  controls: [
    { key: 'kind', type: 'seg', label: 'Guitar', options: [{ v: 'acoustic', label: 'Acoustic' }, { v: 'electric', label: 'Electric' }] },
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'xray', type: 'toggle', label: 'See-through body', hint: 'See the bracing under the top.' },
    { key: 'play', type: 'buttons', label: 'Play', items: [{ label: '♪ Open strings', act: (s, inst) => inst.strum(null) }, { label: '♪ E chord', act: (s, inst) => inst.strum('E') }, { label: '♪ G chord', act: (s, inst) => inst.strum('G') }] },
  ],
  quiz: [
    { q: 'Which two points mark the ends of an open string’s vibrating length?', options: ['The tuner and the strap pin', 'The saddle and the nut', 'The sound hole and the headstock', 'The first and last frets'], answer: 1, why: 'The string is free to vibrate only between the saddle on the bridge and the nut at the top of the fretboard.' },
    { q: 'What is the truss rod for?', options: ['It makes the strings louder', 'It stops the pull of the strings from bending the neck', 'It holds the frets in', 'It carries the signal to the amp'], answer: 1, why: 'Six strings pull with about 70 kg. The steel rod in the neck pushes back so the neck stays straight.' },
    { q: 'Why does an electric guitar need an amplifier?', options: ['Its strings are thinner', 'Its solid body barely moves the air, so the pickups’ signal must be made loud by an amp and speaker', 'It has no frets', 'Its strings are not made of steel'], answer: 1, why: 'A solid body is heavy and stiff, so it makes little sound. The pickups turn string motion into a small voltage for the amp.' },
  ],
  reel: [
    { ms: 5800, caption: 'A guitar is six strings, a neck with frets, and a hollow wooden box.', set: { kind: 'acoustic', xray: false }, anim: { explode: [0, 1] }, view: { pos: [1.1, 2.5, 3.9], target: [0.3, 1.3, 0] }, spin: 0.4 },
    { ms: 5200, caption: 'An electric swaps the hollow box for a solid body and magnetic pickups.', set: { kind: 'electric', explode: 0, xray: false }, act: (s, inst) => inst.strum('E', true), view: { pos: [0.3, 2.3, 3.5], target: [-0.05, 1.3, 0] }, spin: 0.3 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const guitars = {}, explode = {}, labels = {};
    const L = (g, text, part, pos, cls) => { const l = stage.label(text, pos, g.parts[part], cls); (labels[g.kind] ||= []).push({ l, part }); return l; };
    for (const kind of ['acoustic', 'electric']) {
      const g = makeGuitar(kind);
      const holder = new THREE.Group(); holder.scale.setScalar(S); holder.position.set(-0.55 * S, 1.3, 0); holder.rotation.x = -0.42;
      holder.add(g.group); root.add(holder);
      g.holder = holder;
      g.vs.forEach((v, i) => { const f = stringInfo(kind, i).f; v.vis = 1.3 * (f / 82.4) ** 0.35; v.tau = kind === 'electric' ? 5 : 3; });
      guitars[kind] = g;
      const P = g.parts;
      const common = [
        { obj: P.strings, off: [0, 0, 0.3] },
        { obj: P.neck, off: [0.2, 0, 0] },
        { obj: P.truss, off: [0.2, -0.13, -0.02] },
        { obj: P.head, off: [0.33, 0, 0] },
        { obj: P.tuners, off: [0.33, 0, 0.1] },
        { obj: P.pins, off: [-0.08, 0, 0] },
      ];
      explode[kind] = exploder(kind === 'acoustic' ? [
        ...common,
        { obj: P.top, off: [0, 0, 0.16] },
        { obj: P.bracing, off: [0, 0, 0.07] },
        { obj: P.back, off: [0, 0, -0.22] },
        { obj: P.sides, off: [0, 0, -0.07] },
        { obj: P.bridge, off: [0, 0, 0.23] },
      ] : [
        ...common,
        { obj: P.guard, off: [0, 0, 0.1] },
        { obj: P.pickups, off: [0, 0, 0.18] },
        { obj: P.controls, off: [0, -0.05, 0.14] },
        { obj: P.jack, off: [0, -0.1, 0.05] },
        { obj: P.bridge, off: [0, 0, 0.24] },
      ]);
      if (kind === 'acoustic') {
        L(g, 'Top (soundboard)', 'top', [0.1, 0.17, 0.01]);
        L(g, 'Sound hole', 'top', [0.33, -0.02, 0.01], 'hot');
        L(g, 'Bridge and saddle', 'bridge', [0.215, -0.1, 0.02]);
        L(g, 'X-bracing', 'bracing', [0.2, 0.06, -0.01]);
        L(g, 'Back and sides', 'back', [0.12, -0.2, -0.12]);
      } else {
        L(g, 'Solid body', 'body', [0.08, 0.13, 0]);
        L(g, 'Pickups', 'pickups', [0.3, 0.055, 0.02], 'hot');
        L(g, 'Volume and tone', 'controls', [0.19, -0.13, 0.02]);
        L(g, 'Selector', 'controls', [0.3, -0.12, 0.02]);
        L(g, 'Output jack', 'jack', [0.12, -0.17, 0.01]);
        L(g, 'Whammy bar', 'bridge', [0.06, -0.12, 0.05]);
      }
      L(g, 'Frets and inlays', 'neck', [0.66, -0.045, 0.01]);
      L(g, 'Nut', 'neck', [g.xNut, -0.04, 0.01]);
      L(g, 'Truss rod', 'truss', [0.72, -0.02, -0.01]);
      L(g, 'Headstock and tuners', 'head', [0.1, kind === 'acoustic' ? 0.065 : 0.07, 0]);
      L(g, 'Strap pin', 'pins', [-0.02, 0.03, -0.05]);
    }

    const sch = scheduler();
    let cur = null, last = null;
    const setKind = (kind) => {
      if (cur === kind) return;
      cur = kind;
      for (const k in guitars) guitars[k].holder.visible = k === kind;
      stage.pickables.length = 0; stage.pickables.push(...guitars[kind].hits);
      synth.mute();
    };
    const pluck = (i, fret = 0, delay = 0, vel = 0.8) => {
      const g = guitars[cur];
      g.setFret(i, fret);
      const v = g.vs[i];
      v.pluck(PLUCK_AT[cur] / v.stop, 0.007 * (0.6 + vel * 0.5));
      const m = TUNING[i] + fret;
      synth.pluck(midiFreq(m), { id: i, beta: PLUCK_AT[cur] / v.stop, tone: cur, pickup: 0.19, delay, vel });
      last = { i, m };
    };
    const api = {
      strum(chord, silent = false) {
        const frets = chord ? CHORDS[chord].frets : [0, 0, 0, 0, 0, 0];
        let d = 0;
        frets.forEach((fr, i) => {
          const g = guitars[cur];
          if (fr < 0) { g.setFret(i, 0); g.vs[i].damp(); return; }
          // Visual pluck now, sound a few ms later per string, like a pick sweeping across.
          const dd = d; d += 0.03;
          sch.at(dd, () => { if (silent) { g.setFret(i, fr); const v = g.vs[i]; v.pluck(PLUCK_AT[cur] / v.stop, 0.0075); last = { i, m: TUNING[i] + fr }; } else pluck(i, fr, 0, 0.75); });
        });
        api.chord = chord;
      },
      pick(o) { const i = o.userData.string; if (i === undefined) return; pluck(i, 0); },
    };
    setKind(s0.kind);
    return {
      ...api,
      update(dt, s) {
        dt = Math.max(0, dt);
        synth.sync();
        setKind(s.kind);
        const g = guitars[cur];
        sch.update(dt);
        explode[cur](s.explode);
        g.setSee(s.xray ? 0.22 : s.explode > 0.05 ? 0.55 : 1);
        if (g.parts.bracing) g.parts.bracing.visible = s.xray || s.explode > 0.05;
        const narrow = stage.host.clientWidth < 560;
        labels[cur].forEach(({ l, part }) => {
          let vis = true;
          if (part === 'truss') vis = s.explode > 0.35 || s.xray;
          if (part === 'bracing') vis = s.explode > 0.05 || s.xray;
          if (part === 'pins' || part === 'jack' || (narrow && ['back', 'controls', 'bridge', 'neck'].includes(part))) vis = vis && !narrow;
          l.visible = vis;
        });
        for (const v of g.vs) { v.update(dt); v.draw(); }
      },
      readout: (s) => compact((() => {
        const kind = s.kind, set = SETS[kind];
        const lastRow = last ? `<div class="row"><span>Last note</span><b>${midiName(last.m)}: ${midiFreq(last.m).toFixed(1)} Hz</b></div>` : '<small>Click a string to pluck it.</small>';
        return `<div class="big">6 strings, ${Math.round(totalKg(kind))} kg of pull</div>
          <div class="row"><span>Scale length (saddle to nut)</span><b>${Math.round(SCALE_M * 1000)} mm</b></div>
          <div class="row"><span>Frets</span><b>${kind === 'acoustic' ? '20, 14 clear of the body' : '21, 16 clear of the body'}</b></div>
          <div class="row"><span>Strings</span><b>${set.gauge[5].toFixed(3).slice(1)} to ${set.gauge[0].toFixed(3).slice(1)} in</b></div>
          ${lastRow}`;
      })(), stage),
      dispose() { synth.allOff(); },
    };
  },
};
