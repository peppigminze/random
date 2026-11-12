'use strict';
// LUMEN — fully procedural audio: adaptive step sequencer + synthesized SFX (no audio files)
(function () {
  const L = window.L;
  const A = L.audio = { ctx: null, ready: false, intensity: 0.1, target: 0.12, mode: 'menu', muteSfx: false, duck: 0 };
  let ctx, master, musicBus, sfxBus, lp, revSend, delaySend, delayNode, noiseBuf;
  let step = 0, nextT = 0, bpm = 104;
  const last = {};

  const MINOR = [0, 2, 3, 5, 7, 8, 10], PHRYG = [0, 1, 3, 5, 7, 8, 10], PENTA = [0, 3, 5, 7, 10];
  const PROGS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 4], [0, 2, 3, 5], [0, 5, 3, 6]];
  const song = { root: 45, scale: MINOR, prog: PROGS[0], arp: [], bass: [], lead: [] };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const deg = (d, oct) => song.root + song.scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + (oct || 0));

  A.seedSong = function (seed) {
    const r = new L.RNG(seed);
    song.root = 43 + r.int(0, 6);
    song.prog = r.pick(PROGS);
    song.arp = []; song.bass = []; song.lead = [];
    for (let i = 0; i < 16; i++) {
      song.arp.push(r.chance(0.78) ? r.pick([0, 2, 4, 7, 9, 4, 2]) : -1);
      song.bass.push(i % 4 === 0 || r.chance(0.34) ? (r.chance(0.2) ? 7 : 0) : -1);
      song.lead.push(r.chance(0.3) ? r.pick([4, 5, 7, 9, 11]) : -1);
    }
  };
  A.seedSong(1234);

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = A.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
      master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = 0.6;
      musicBus.connect(lp); lp.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      // noise + generated impulse response for reverb
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const conv = ctx.createConvolver(); conv.buffer = ir;
      revSend = ctx.createGain(); const revOut = ctx.createGain(); revOut.gain.value = 0.5;
      revSend.connect(conv); conv.connect(revOut); revOut.connect(lp);
      delaySend = ctx.createGain(); delayNode = ctx.createDelay(1.5); const fb = ctx.createGain(); fb.gain.value = 0.38;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
      delaySend.connect(delayNode); delayNode.connect(dlp); dlp.connect(fb); fb.connect(delayNode); dlp.connect(lp);
      A.ready = true; nextT = ctx.currentTime + 0.1;
      A.applyVolume(); setBpm(bpm);
    } catch (e) { console.warn('audio unavailable:', e.message); }
  };
  A.applyVolume = function () {
    if (!A.ready) return;
    const s = L.set(), t = ctx.currentTime;
    master.gain.setTargetAtTime(Math.pow(s.master / 10, 1.6) * 0.9, t, 0.03);
    musicBus.gain.setTargetAtTime(Math.pow(s.music / 10, 1.6) * 0.8, t, 0.03);
    sfxBus.gain.setTargetAtTime(Math.pow(s.sfx / 10, 1.6) * 0.9, t, 0.03);
  };
  function setBpm(b) { bpm = b; if (A.ready) delayNode.delayTime.setTargetAtTime(60 / bpm * 0.75, ctx.currentTime, 0.05); }
  A.setMode = function (m) {
    if (A.mode === m) return;
    A.mode = m;
    song.scale = m === 'echo' ? PHRYG : MINOR;
    setBpm(m === 'menu' ? 96 : m === 'boss' ? 126 : m === 'echo' ? 138 : 110);
  };
  // muffle: 0 = open, 1 = underwater (pause, death, slow motion)
  A.muffle = function (v) { if (A.ready) lp.frequency.setTargetAtTime(L.lerp(18000, 420, v), ctx.currentTime, 0.08); };

  // ---------- voices ----------
  function env(g, t, a, d, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f, t, dur, vol, dest, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.toT || dur));
    if (o.det) osc.detune.value = o.det;
    env(g, t, o.a || 0.004, dur, vol);
    let out = g; osc.connect(g);
    if (o.lp) {
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 1;
      fl.frequency.setValueAtTime(o.lp, t);
      if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
      g.connect(fl); out = fl;
    }
    out.connect(dest);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; out.connect(s); s.connect(revSend); }
    if (o.del) { const s = ctx.createGain(); s.gain.value = o.del; out.connect(s); s.connect(delaySend); }
    osc.start(t); osc.stop(t + dur + (o.a || 0) + 0.08);
  }
  function noise(t, dur, vol, dest, o) {
    o = o || {};
    const src = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    fl.type = o.type || 'highpass'; fl.frequency.setValueAtTime(o.f || 6000, t); fl.Q.value = o.q || 0.8;
    if (o.fTo) fl.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
    env(g, t, o.a || 0.002, dur, vol);
    src.connect(fl); fl.connect(g); g.connect(dest);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(revSend); }
    src.start(t, Math.random() * 0.9); src.stop(t + dur + 0.1);
  }

  // ---------- music ----------
  function schedule(s, t) {
    const i = A.intensity, m = A.mode, st = s % 16, bar = Math.floor(s / 16) % 4, sp = 60 / bpm / 4;
    if (m === 'silence') return;
    const chord = song.prog[bar];
    // pad: one soft chord per bar
    if (st === 0) {
      const vol = m === 'menu' ? 0.05 : 0.035;
      for (const n of [0, 2, 4]) {
        const f = mtof(deg(chord + n, 1));
        tone('sawtooth', f, t, sp * 16, vol, musicBus, { a: sp * 3, lp: 500 + i * 1400, det: -7, rev: 0.7 });
        tone('sawtooth', f, t, sp * 16, vol, musicBus, { a: sp * 3, lp: 500 + i * 1400, det: 8 });
      }
    }
    if (m === 'menu') {
      if (st % 4 === 2 && song.arp[st] >= 0) tone('triangle', mtof(deg(chord + song.arp[st], 2)), t, 0.5, 0.05, musicBus, { rev: 0.8, del: 0.5 });
      return;
    }
    // kick
    const four = i > 0.42;
    if (i > 0.12 && (four ? st % 4 === 0 : (st === 0 || st === 10)) || (i > 0.85 && st === 14)) {
      tone('sine', 150, t, 0.22, 0.5, musicBus, { to: 42, toT: 0.09 });
      noise(t, 0.02, 0.12, musicBus, { type: 'lowpass', f: 3000 });
    }
    // hats
    if (i > 0.28 && st % 4 === 2) noise(t, 0.05, 0.07 + i * 0.05, musicBus, { f: 8000 });
    if (i > 0.62 && st % 2 === 1) noise(t, 0.025, 0.035, musicBus, { f: 10000 });
    // snare / clap
    if (i > 0.5 && (st === 4 || st === 12)) {
      noise(t, 0.14, 0.17, musicBus, { type: 'bandpass', f: 1900, q: 0.7, rev: 0.25 });
      tone('triangle', 210, t, 0.08, 0.12, musicBus, { to: 120 });
    }
    // bass
    if (i > 0.18 && song.bass[st] >= 0) {
      const f = mtof(deg(chord + song.bass[st], -1));
      tone('sawtooth', f, t, sp * 1.8, 0.2, musicBus, { lp: 240 + i * 1300, lpTo: 110, q: 5 });
      tone('sine', f, t, sp * 1.8, 0.16, musicBus);
    }
    // arp
    if (i > 0.3) {
      const a = m === 'echo' ? song.arp[15 - st] : song.arp[st];
      if (a >= 0) tone(m === 'boss' || m === 'echo' ? 'square' : 'triangle', mtof(deg(chord + a, i > 0.72 ? 3 : 2)), t, sp * 1.4,
        0.035 + i * 0.03, musicBus, { lp: 1200 + i * 3200, del: 0.45, rev: 0.25 });
    }
    // lead stabs at high intensity
    if (i > 0.78 && song.lead[st] >= 0) {
      const f = mtof(deg(chord + song.lead[st], 3));
      tone('sawtooth', f, t, sp * 2.5, 0.045, musicBus, { lp: 3400, lpTo: 600, det: 6, del: 0.4, rev: 0.4 });
      tone('sawtooth', f, t, sp * 2.5, 0.045, musicBus, { lp: 3400, lpTo: 600, det: -6 });
    }
    if (m === 'boss' && st % 8 === 0) tone('sawtooth', mtof(song.root - 24), t, sp * 6, 0.1, musicBus, { lp: 180, q: 3 });
  }

  A.update = function (rdt) {
    if (!A.ready) return;
    A.intensity = L.damp(A.intensity, A.target, 1.4, rdt);
    const now = ctx.currentTime;
    if (nextT < now - 0.25) nextT = now + 0.05; // tab was hidden: resync instead of bursting
    let guard = 0;
    while (nextT < now + 0.14 && guard++ < 8) {
      schedule(step, nextT);
      nextT += 60 / bpm / 4; step++;
    }
  };

  // ---------- sound effects ----------
  function can(name, gap) {
    if (!A.ready || A.muteSfx) return 0;
    const t = ctx.currentTime;
    if (last[name] && t - last[name] < (gap || 0.03)) return 0;
    last[name] = t; return t;
  }
  const jit = (v) => 1 + (Math.random() * 2 - 1) * v;
  const S = A.sfx = {
    dash() {
      const t = can('dash', 0.04); if (!t) return;
      noise(t, 0.16, 0.26, sfxBus, { type: 'bandpass', f: 900 * jit(.15), fTo: 5200, q: 1.4 });
      tone('sawtooth', 240 * jit(.08), t, 0.13, 0.1, sfxBus, { to: 900, lp: 2400 });
    },
    fizzle() {
      const t = can('fizzle', 0.1); if (!t) return;
      tone('square', 110, t, 0.07, 0.08, sfxBus, { to: 70, lp: 600 });
    },
    // kill notes climb the pentatonic scale of the current song with the chain
    kill(combo) {
      const t = can('kill', 0.02); if (!t) return;
      const n = Math.min(combo - 1, 14), f = mtof(song.root + 24 + PENTA[n % 5] + 12 * Math.floor(n / 5));
      tone('triangle', f, t, 0.3, 0.22, sfxBus, { del: 0.35, rev: 0.3 });
      tone('square', f * 2, t, 0.09, 0.05, sfxBus, { lp: 4000 });
      noise(t, 0.09, 0.2, sfxBus, { type: 'bandpass', f: 2400 * jit(.3), q: 0.9 });
      tone('sine', 160, t, 0.1, 0.22, sfxBus, { to: 60 });
    },
    hit() {
      const t = can('hit', 0.03); if (!t) return;
      noise(t, 0.06, 0.2, sfxBus, { type: 'bandpass', f: 1500 * jit(.3) });
      tone('square', 300 * jit(.1), t, 0.06, 0.09, sfxBus, { to: 140, lp: 1800 });
    },
    block() {
      const t = can('block', 0.05); if (!t) return;
      tone('square', 1250 * jit(.05), t, 0.14, 0.11, sfxBus, { to: 900, rev: 0.4 });
      tone('triangle', 2100 * jit(.05), t, 0.2, 0.09, sfxBus, { rev: 0.5 });
      noise(t, 0.04, 0.2, sfxBus, { f: 5000 });
    },
    slice() {
      const t = can('slice', 0.025); if (!t) return;
      tone('sine', 1500 * jit(.25), t, 0.07, 0.09, sfxBus, { to: 2600 });
    },
    hurt() {
      const t = can('hurt', 0.1); if (!t) return;
      tone('sawtooth', 220, t, 0.45, 0.32, sfxBus, { to: 45, lp: 1400, lpTo: 200 });
      noise(t, 0.3, 0.32, sfxBus, { type: 'lowpass', f: 2400, fTo: 200, rev: 0.3 });
    },
    pickup(streak) {
      const t = can('pickup', 0.035); if (!t) return;
      const f = mtof(song.root + 36 + PENTA[streak % 5] + 12 * Math.min(1, Math.floor(streak / 5)));
      tone('sine', f, t, 0.1, 0.07, sfxBus, { del: 0.2 });
    },
    heal() {
      const t = can('heal', 0.1); if (!t) return;
      [0, 4, 7, 12].forEach((n, i) => tone('triangle', mtof(song.root + 24 + n), t + i * 0.06, 0.3, 0.12, sfxBus, { rev: 0.5 }));
    },
    recharge() {
      const t = can('recharge', 0.05); if (!t) return;
      tone('sine', 880, t, 0.06, 0.05, sfxBus, { to: 1320 });
    },
    explode(big) {
      const t = can('explode', 0.04); if (!t) return;
      noise(t, big ? 0.9 : 0.45, big ? 0.5 : 0.36, sfxBus, { type: 'lowpass', f: 3200, fTo: 120, rev: 0.5 });
      tone('sine', 120, t, big ? 0.7 : 0.35, 0.45, sfxBus, { to: 30 });
    },
    nova() {
      const t = can('nova', 0.2); if (!t) return;
      tone('sawtooth', 90, t, 0.9, 0.3, sfxBus, { to: 700, toT: 0.25, lp: 3000, lpTo: 200, rev: 0.6 });
      noise(t, 0.8, 0.35, sfxBus, { type: 'bandpass', f: 400, fTo: 6000, q: 0.6, rev: 0.6 });
      [0, 7, 12, 19].forEach((n, i) => tone('triangle', mtof(song.root + 36 + n), t + i * 0.03, 0.6, 0.09, sfxBus, { rev: 0.7, del: 0.4 }));
    },
    telegraph() {
      const t = can('tele', 0.08); if (!t) return;
      tone('square', 620, t, 0.09, 0.05, sfxBus, { lp: 2400 });
      tone('square', 620, t + 0.11, 0.09, 0.05, sfxBus, { lp: 2400 });
    },
    charge() {
      const t = can('charge', 0.1); if (!t) return;
      tone('sawtooth', 160, t, 0.5, 0.12, sfxBus, { to: 640, lp: 1600 });
    },
    lunge() {
      const t = can('lunge', 0.05); if (!t) return;
      noise(t, 0.3, 0.22, sfxBus, { type: 'bandpass', f: 2800, fTo: 500, q: 1.2 });
    },
    shot() {
      const t = can('shot', 0.05); if (!t) return;
      tone('square', 520 * jit(.08), t, 0.1, 0.07, sfxBus, { to: 180, lp: 2200 });
    },
    laser() {
      const t = can('laser', 0.2); if (!t) return;
      tone('sawtooth', 70, t, 1.3, 0.22, sfxBus, { lp: 2600, q: 6, lpTo: 500 });
      tone('sawtooth', 141, t, 1.3, 0.16, sfxBus, { lp: 3600, det: 14 });
      noise(t, 1.3, 0.12, sfxBus, { f: 5000 });
    },
    spawn() {
      const t = can('spawn', 0.08); if (!t) return;
      tone('sine', 300, t, 0.3, 0.06, sfxBus, { to: 90, rev: 0.4 });
    },
    ui() { const t = can('ui', 0.02); if (t) tone('triangle', 660, t, 0.05, 0.08, sfxBus); },
    ok() {
      const t = can('ok', 0.05); if (!t) return;
      tone('triangle', 660, t, 0.08, 0.1, sfxBus); tone('triangle', 990, t + 0.06, 0.14, 0.1, sfxBus, { rev: 0.4 });
    },
    back() { const t = can('back', 0.05); if (t) tone('triangle', 520, t, 0.1, 0.08, sfxBus, { to: 330 }); },
    deny() { const t = can('deny', 0.08); if (t) tone('square', 140, t, 0.14, 0.09, sfxBus, { lp: 700 }); },
    upgrade() {
      const t = can('upgrade', 0.1); if (!t) return;
      [0, 3, 7, 10, 15].forEach((n, i) => tone('triangle', mtof(song.root + 24 + n), t + i * 0.045, 0.5, 0.11, sfxBus, { rev: 0.6, del: 0.4 }));
    },
    wave() {
      const t = can('wave', 0.2); if (!t) return;
      tone('sawtooth', mtof(song.root + 12), t, 0.7, 0.1, sfxBus, { lp: 600, lpTo: 3000, rev: 0.6 });
      tone('sawtooth', mtof(song.root + 19), t, 0.7, 0.08, sfxBus, { lp: 600, lpTo: 3000, rev: 0.6 });
    },
    counter() {
      const t = can('counter', 0.1); if (!t) return;
      [12, 19, 24, 31].forEach((n, i) => tone('square', mtof(song.root + 24 + n), t + i * 0.035, 0.25, 0.07, sfxBus, { lp: 5000, rev: 0.5, del: 0.4 }));
      noise(t, 0.25, 0.25, sfxBus, { f: 4000, rev: 0.5 });
    },
    roar() {
      const t = can('roar', 0.3); if (!t) return;
      tone('sawtooth', 55, t, 2.2, 0.4, sfxBus, { to: 30, lp: 900, lpTo: 150, q: 4, rev: 0.7 });
      tone('sawtooth', 58, t, 2.2, 0.3, sfxBus, { to: 33, lp: 1200, lpTo: 150, rev: 0.7 });
      noise(t, 2, 0.25, sfxBus, { type: 'lowpass', f: 900, fTo: 100, rev: 0.6 });
    },
    glitch() {
      const t = can('glitch', 0.05); if (!t) return;
      for (let i = 0; i < 6; i++) tone('square', 100 + Math.random() * 1800, t + i * 0.045, 0.04, 0.09, sfxBus, { lp: 3000 });
    },
    death() {
      const t = can('death', 0.5); if (!t) return;
      tone('sawtooth', 330, t, 1.8, 0.3, sfxBus, { to: 28, lp: 2500, lpTo: 120, rev: 0.8 });
      noise(t, 1.5, 0.4, sfxBus, { type: 'lowpass', f: 4000, fTo: 80, rev: 0.7 });
    },
    victory() {
      const t = can('victory', 0.5); if (!t) return;
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone('triangle', mtof(song.root + 24 + n), t + i * 0.09, 1.2, 0.12, sfxBus, { rev: 0.8, del: 0.5 }));
    },
  };
  // make every sfx a safe no-op until audio is unlocked
  for (const k in S) { const fn = S[k]; S[k] = function () { if (A.ready) try { fn.apply(null, arguments); } catch (e) { /* never break the game for a sound */ } }; }
})();
