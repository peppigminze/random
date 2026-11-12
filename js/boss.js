'use strict';
// LUMEN — THE ECLIPSE (three phases, telegraphed attacks) and what comes after it
(function () {
  const L = window.L, G = L.game, F = L.fx, C = L.PAL, TAU = L.TAU;
  const sfx = () => L.audio.sfx;
  const B = L.boss = {};
  const PH = B.PH = [
    { hp: 4, segs: 3, arc: 1.50, rot: 0.75, gap: 1.5,  atks: ['fan', 'ring', 'motes'] },
    { hp: 5, segs: 4, arc: 1.08, rot: -1.05, gap: 1.2, atks: ['lasers', 'fan', 'ring', 'lancers'] },
    { hp: 6, segs: 5, arc: 0.84, rot: 1.3, gap: 0.95,  atks: ['spiral', 'pulse', 'lasers', 'ring'] },
  ];

  B.start = function () {
    const p = G.player, d = Math.hypot(p.x, p.y);
    if (d < 260) { const a = d > 1 ? Math.atan2(p.y, p.x) : Math.PI / 2; p.x = Math.cos(a) * 300; p.y = Math.sin(a) * 300; F.ring(p.x, p.y, 60, 10, 0.3, p.color, 3); }
    G.phase = 'boss'; G.mut = null; G.arenaTarget = 620;
    G.boss = {
      x: 0, y: 0, r: 42, ringR: 100, phase: 0, hp: 0, maxHp: 0, rot: 0, dir: 1, inv: 2.8, intro: 2.8, t: 0,
      atk: null, atkT: 0.6, seq: G.rng.int(0, 2), flash: 0, open: 0, tele: 0, lasers: [], laserOn: false, pulses: [], dead: false,
    };
    setPhase(G.boss, 0);
    G.say('THE ECLIPSE', 'Dash through the gaps in its ring', 3.4);
    sfx().roar(); L.audio.setMode('boss'); F.shake(0.7); G.ripple(0, 0, 40);
    F.ring(0, 0, 500, 100, 1.2, C.violet, 6);
  };
  function setPhase(b, n) {
    b.phase = n; b.maxHp = PH[n].hp + (G.depth - 1) * 2; b.hp = b.maxHp;
    b.atk = null; b.lasers = []; b.laserOn = false; b.pulses = [];
  }
  const shielded = (b, ang) => {
    const c = PH[b.phase];
    for (let i = 0; i < c.segs; i++) if (Math.abs(L.angDiff(ang, b.rot + i * TAU / c.segs)) < c.arc / 2) return true;
    return false;
  };
  B.shielded = shielded;
  B.onShock = function () {};

  // ---------- attacks: each returns true when finished ----------
  const ATK = {
    fan(b, a, dt) {
      b.tele = a.t < 0.6 ? a.t / 0.6 : 0;
      const n = Math.floor((a.t - 0.6) / 0.32);
      if (a.t >= 0.6 && n >= a.shots && a.shots < 3 + b.phase) {
        a.shots++;
        const p = G.player, ang = Math.atan2(p.y - b.y, p.x - b.x), cnt = b.phase ? 7 : 5;
        for (let i = 0; i < cnt; i++) {
          const s = ang + (i - (cnt - 1) / 2) * 0.17;
          G.fireBullet(b.x + Math.cos(s) * b.ringR, b.y + Math.sin(s) * b.ringR, s, 240 + b.phase * 30);
        }
        sfx().shot(); b.flash = 0.4;
      }
      return a.t > 0.6 + (3 + b.phase) * 0.32;
    },
    ring(b, a) {
      b.tele = a.t < 0.6 ? a.t / 0.6 : 0;
      const rings = 2 + b.phase, n = Math.floor((a.t - 0.6) / 0.42);
      if (a.t >= 0.6 && n >= a.shots && a.shots < rings) {
        const cnt = 14 + b.phase * 3, o = a.shots * Math.PI / cnt + b.rot;
        for (let i = 0; i < cnt; i++) { const s = o + i * TAU / cnt; G.fireBullet(b.x + Math.cos(s) * b.ringR, b.y + Math.sin(s) * b.ringR, s, 170 + a.shots * 18); }
        a.shots++; sfx().shot(); b.flash = 0.4; G.ripple(b.x, b.y, 12);
      }
      return a.t > 0.6 + rings * 0.42;
    },
    motes(b, a) {
      b.tele = a.t < 0.5 ? a.t / 0.5 : 0;
      if (a.t >= 0.5 && !a.shots) {
        a.shots = 1; const o = L.r(0, TAU);
        for (let i = 0; i < 4; i++) G.spawnEnemy('mote', Math.cos(o + i * TAU / 4) * 190, Math.sin(o + i * TAU / 4) * 190, i * 0.05);
        sfx().spawn();
      }
      return a.t > 0.7;
    },
    lancers(b, a) {
      b.tele = a.t < 0.5 ? a.t / 0.5 : 0;
      if (a.t >= 0.5 && !a.shots) {
        a.shots = 1; const o = L.r(0, TAU);
        for (let i = 0; i < 2; i++) G.spawnEnemy('lancer', Math.cos(o + i * Math.PI) * 420, Math.sin(o + i * Math.PI) * 420, 0);
        sfx().spawn();
      }
      return a.t > 0.7;
    },
    lasers(b, a, dt) {
      const n = b.phase === 1 ? 3 : 4, p = G.player;
      if (!a.init) {
        a.init = 1; a.spin = (G.rng.chance(0.5) ? 1 : -1) * (b.phase === 1 ? 0.4 : 0.52);
        const base = Math.atan2(p.y - b.y, p.x - b.x) + Math.PI / n; // the player always starts between two beams
        b.lasers = []; for (let i = 0; i < n; i++) b.lasers.push(base + i * TAU / n);
        sfx().charge();
      }
      b.tele = a.t < 1 ? a.t : 0;
      if (a.t >= 1 && !b.laserOn) { b.laserOn = true; sfx().laser(); F.shake(0.3); }
      if (b.laserOn) {
        for (let i = 0; i < n; i++) {
          b.lasers[i] += a.spin * dt;
          const ca = Math.cos(b.lasers[i]), sa = Math.sin(b.lasers[i]);
          if (!p.dead && !p.dashing && L.segDist2(p.x, p.y, b.x + ca * b.ringR, b.y + sa * b.ringR, b.x + ca * 900, b.y + sa * 900) < 17 * 17) G.hurtPlayer(b.x, b.y);
          const d = L.r(b.ringR, G.arenaR);
          if (Math.random() < 0.5) F.dot(b.x + ca * d, b.y + sa * d, C.red, 4, 0.3, L.r(-60, 60), L.r(-60, 60));
        }
        F.shake(0.02);
      }
      if (a.t > 2.7) { b.lasers = []; b.laserOn = false; return true; }
      return false;
    },
    spiral(b, a, dt) {
      b.tele = a.t < 0.5 ? a.t / 0.5 : 0;
      if (!a.init) { a.init = 1; a.ang = L.r(0, TAU); a.dir = G.rng.chance(0.5) ? 1 : -1; a.acc = 0; }
      if (a.t >= 0.5) {
        a.acc += dt;
        while (a.acc > 0.085) {
          a.acc -= 0.085; a.ang += 0.23 * a.dir;
          const arms = G.depth > 1 ? 3 : 2;
          for (let i = 0; i < arms; i++) { const s = a.ang + i * TAU / arms; G.fireBullet(b.x + Math.cos(s) * b.ringR, b.y + Math.sin(s) * b.ringR, s, 185); }
          sfx().shot();
        }
      }
      return a.t > 3.4;
    },
    pulse(b, a) {
      const k = (a.t % 1.0);
      b.tele = a.t < 2 && k < 0.75 ? k / 0.75 : 0;
      const n = Math.floor(a.t / 1.0 + 0.25);
      if (n > a.shots && a.shots < 2 && k >= 0.75) {
        a.shots++; b.pulses.push({ r: b.ringR, life: 1 });
        sfx().explode(false); F.shake(0.3); b.flash = 0.6; G.ripple(b.x, b.y, 30);
      }
      return a.t > 2.4;
    },
  };

  function updateBoss(b, dt) {
    const c = PH[b.phase], p = G.player;
    b.t += dt; b.inv -= dt; b.open -= dt; b.flash = Math.max(0, b.flash - dt * 4);
    b.rot += c.rot * b.dir * (b.open > 0 ? 0.25 : 1) * (1 + (G.depth - 1) * 0.12) * dt;
    for (const q of b.pulses) {
      q.r += 310 * dt;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (!p.dead && !p.dashing && Math.abs(d - q.r) < 13) G.hurtPlayer(b.x, b.y);
    }
    b.pulses = b.pulses.filter(q => q.r < G.arenaR + 20);
    if (b.intro > 0) { b.intro -= dt; b.tele = 0; return; }
    if (b.atk) {
      b.atk.t += dt;
      if (ATK[b.atk.name](b, b.atk, dt)) { b.atk = null; b.tele = 0; b.atkT = c.gap; b.open = 1.3; }
    } else {
      b.atkT -= dt;
      if (b.atkT <= 0) {
        const name = c.atks[b.seq++ % c.atks.length];
        b.atk = { name, t: 0, shots: 0 };
        if (name !== 'lasers') sfx().telegraph();
      }
    }
  }

  function damageBoss(b) {
    const p = G.player;
    b.hp -= Math.min(2, p.dmg); b.inv = 0.85; b.flash = 1; b.dir *= -1;
    p.charges = p.maxCharges; p.energy = Math.min(1, p.energy + 0.1 * p.energyRate); p.inv = Math.max(p.inv, 0.5);
    G.combo++; G.comboT = 5; G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.addScore(300 * G.depth * (1 + G.combo * 0.1));
    G.stop(0.11); F.shake(0.55); F.punch(0.06); F.kick(p.ddx, p.ddy, 10);
    F.burst(b.x, b.y, 44, C.violet, { speed: 640, life: 0.7, size: 4, dir: Math.atan2(p.ddy, p.ddx), spread: 2.4 });
    F.burst(b.x, b.y, 18, '#fff', { speed: 360, life: 0.4 });
    F.ring(b.x, b.y, 30, 240, 0.5, '#fff', 6); G.ripple(b.x, b.y, 30);
    sfx().kill(G.combo); sfx().explode(false);
    if (b.hp > 0) return;
    if (b.phase < 2) {
      setPhase(b, b.phase + 1);
      b.inv = 2.5; b.atkT = 1.4; b.intro = 1.6;
      G.clearBullets(0, 0, 3000);
      for (const e of G.enemies) if (!e.dead) G.hitEnemy(e, 'nova', 9);
      F.ring(0, 0, 60, 900, 0.9, C.violet, 10); G.ripple(0, 0, 44); F.shake(0.8);
      L.post.flash = 0.45; L.post.flashCol = [0.7, 0.5, 1];
      const d = Math.hypot(p.x, p.y) || 1; p.vx += p.x / d * 500; p.vy += p.y / d * 500;
      sfx().roar();
      if (b.phase === 1) G.say('PHASE II', 'Stay between the beams', 2.6);
      else { G.say('PHASE III', 'The dark closes in — dash through the rings', 3); G.arenaTarget = 450; }
    } else {
      b.dead = true; b.lasers = []; b.pulses = []; b.laserOn = false; b.tele = 0;
      G.cine = { name: 'bossdeath', t: 0, s: 0, acc: 0 };
      G.clearBullets(0, 0, 3000); G.arenaTarget = 620;
      for (const e of G.enemies) if (!e.dead) G.hitEnemy(e, 'nova', 9);
      G.slowmo(0.15, 1.4); L.audio.setMode('silence'); L.audio.target = 0.1;
    }
  }

  // ---------- dash interaction ----------
  B.dashSweep = function (ax, ay, bx, by) {
    const p = G.player, e = G.echo, b = G.boss;
    if (e && e.inv <= 0 && !p.hit.has(e)) {
      const rr = 16 + p.dashW;
      if (L.segDist2(e.x, e.y, ax, ay, bx, by) < rr * rr) {
        p.hit.add(e);
        if (e.dashing) {
          G.cancelDash(-p.ddx, -p.ddy); e.inv = 0.45;
          F.burst(p.x, p.y, 34, '#fff', { speed: 620, life: 0.45 }); F.ring(p.x, p.y, 10, 170, 0.4, '#fff', 6);
          F.text(p.x, p.y - 44, 'CLASH', '#fff', 26, 1); sfx().block(); sfx().counter();
          F.shake(0.6); G.stop(0.12); p.energy = Math.min(1, p.energy + 0.2); p.charges = p.maxCharges;
          return true;
        }
        hitEcho(e);
      }
    }
    if (!b || b.dead) return false;
    const da = Math.hypot(ax - b.x, ay - b.y);
    if (da > b.ringR) {
      const t = L.segCircle(ax, ay, bx, by, b.x, b.y, b.ringR);
      if (t >= 0) {
        const ix = L.lerp(ax, bx, t), iy = L.lerp(ay, by, t), ang = Math.atan2(iy - b.y, ix - b.x);
        if (shielded(b, ang)) {
          const nx = Math.cos(ang), ny = Math.sin(ang);
          p.x = ix + nx * 14; p.y = iy + ny * 14;
          G.cancelDash(nx, ny);
          F.burst(ix, iy, 16, '#fff', { speed: 460, life: 0.35, dir: ang, spread: 1.8 });
          F.text(ix + nx * 30, iy + ny * 30 - 10, 'BLOCKED', C.violet, 15, 0.7);
          sfx().block(); F.shake(0.3); G.stop(0.05); b.flash = 0.5;
          return true;
        }
      }
    }
    if (!p.hit.has(b) && b.inv <= 0 && b.intro <= 0) {
      const rr = b.r + p.dashW;
      if (L.segDist2(b.x, b.y, ax, ay, bx, by) < rr * rr) { p.hit.add(b); damageBoss(b); }
    }
    return false;
  };
  B.bodyCollide = function (p) {
    const b = G.boss;
    if (!b || b.dead) return;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, m = b.ringR + p.r + 2;
    if (d < m) {
      const hurt = p.inv <= 0;
      p.x = b.x + dx / d * m; p.y = b.y + dy / d * m; p.vx = dx / d * 380; p.vy = dy / d * 380;
      F.burst(p.x, p.y, 6, C.violet, { speed: 200, life: 0.25 });
      if (hurt) G.hurtPlayer(b.x, b.y);
    }
  };

  // ---------- ECHO: the shadow replays the player, mirrored and delayed ----------
  const tf = (s, x, y) => s === 0 ? [-x, -y] : s === 1 ? [-x, y] : s === 2 ? [x, -y] : s === 3 ? [-y, x] : [y, -x];
  function spawnEcho() {
    const p = G.player;
    const hp = 8 + (G.depth - 1) * 3;
    G.echo = {
      hp, maxHp: hp, x: -p.x, y: -p.y, sym: 0, decoy: -1, dx: 0, dy: 0, delay: 1.1, inv: 2.2, flash: 0, t: 0,
      dashing: false, shootT: 4, tele: 0, hist: [], bodies: [{}, {}], trail: [],
    };
    G.phase = 'boss'; G.scars = [];
    F.ring(-p.x, -p.y, 420, 12, 0.9, C.shadow, 7); F.ring(-p.x, -p.y, 260, 12, 0.7, '#fff', 3);
    G.say('ECHO', 'Your shadow moves as you moved. Cut it while it is not dashing.', 4);
    sfx().roar(); sfx().glitch(); L.audio.setMode('echo'); L.post.glitch = 0.7; F.shake(0.5);
  }
  function hitEcho(e) {
    const p = G.player;
    e.hp -= Math.min(2, p.dmg); e.inv = 1.5; e.flash = 1; e.delay = Math.max(0.5, e.delay - 0.07);
    G.combo++; G.comboT = 6; G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.addScore(500 * G.depth * (1 + G.combo * 0.1)); p.charges = p.maxCharges;
    G.stop(0.13); F.shake(0.65); F.punch(0.08); L.post.glitch = 0.8; sfx().kill(G.combo); sfx().glitch();
    F.burst(e.x, e.y, 50, C.shadow, { speed: 700, life: 0.7, size: 4 }); F.burst(e.x, e.y, 20, '#fff', { speed: 380, life: 0.4 });
    F.ring(e.x, e.y, 20, 260, 0.5, C.shadow, 7); G.ripple(e.x, e.y, 30);
    if (e.hp <= 0) {
      G.echo = null; G.scars = []; G.clearBullets(0, 0, 3000);
      G.cine = { name: 'victory', t: 0, s: 0, x: e.x, y: e.y };
      G.slowmo(0.12, 1.5); L.audio.setMode('silence'); L.post.flash = 0.8; L.post.flashCol = [1, 1, 1];
      F.burst(e.x, e.y, 120, C.shadow, { speed: 900, life: 1.4, size: 5, drag: 1.5 });
      sfx().explode(true);
      return;
    }
    const o = L.r(0, TAU);
    for (let i = 0; i < 10; i++) G.fireBullet(e.x, e.y, o + i * TAU / 10, 165, { arm: 0.3, color: '#b592ff' });
    let ns = e.sym; while (ns === e.sym || ns === e.decoy) ns = G.rng.int(0, 4);
    e.sym = ns; e.skip = true;
    if (e.hp <= e.maxHp / 2 && e.decoy < 0) {
      let ds = e.sym; while (ds === e.sym) ds = G.rng.int(0, 4);
      e.decoy = ds; G.say('IT MULTIPLIES', 'Only the bright one is real', 2.4);
    }
  }
  function updateEcho(e, dt) {
    const p = G.player;
    e.t += dt; e.inv -= dt; e.flash = Math.max(0, e.flash - dt * 4);
    L.post.glitch = L.damp(L.post.glitch, e.hp <= e.maxHp / 2 ? 0.1 : 0.03, 3, dt);
    const H = e.hist;
    H.push({ t: G.time, x: p.x, y: p.y, d: p.dashing });
    while (H.length > 2 && H[0].t < G.time - 2.5) H.shift();
    const target = G.time - e.delay;
    let s = H[0];
    for (let i = 0; i < H.length; i++) { if (H[i].t >= target) { s = H[i]; break; } }
    const syms = e.decoy >= 0 ? [e.sym, e.decoy] : [e.sym];
    const low = e.hp <= e.maxHp / 2;
    syms.forEach((sym, i) => {
      const bd = e.bodies[i], [x, y] = tf(sym, s.x, s.y);
      const px = e.skip || bd.x === undefined ? x : bd.x, py = e.skip || bd.y === undefined ? y : bd.y;
      const was = bd.dash && !e.skip;
      bd.x = x; bd.y = y; bd.dash = s.d;
      if (s.d && !was) { bd.sx = px; bd.sy = py; }
      const solid = e.inv <= 0;
      if (s.d) {
        if (solid && !p.dead && !p.dashing && L.segDist2(p.x, p.y, px, py, x, y) < 20 * 20) G.hurtPlayer(x, y);
        F.dot(L.lerp(px, x, Math.random()), L.lerp(py, y, Math.random()), C.shadow, 5, 0.4, L.r(-30, 30), L.r(-30, 30));
      } else {
        if (was && bd.sx !== undefined) {
          // its dash is over: the path lingers as a scar, and the real one bursts
          G.scars.push({ ax: bd.sx, ay: bd.sy, bx: px, by: py, life: 1.5, max: 1.5, arm: 0.35 });
          F.slash(bd.sx, bd.sy, px, py, C.shadow, 12);
          if (i === 0 && solid) {
            const n = low ? 8 : 6, o = L.r(0, TAU);
            for (let k = 0; k < n; k++) G.fireBullet(x, y, o + k * TAU / n, 150, { arm: 0.2, color: '#b592ff' });
            sfx().shot();
          }
        }
        if (solid && !p.dead && !p.dashing && Math.hypot(p.x - x, p.y - y) < 22) G.hurtPlayer(x, y);
      }
    });
    e.skip = false;
    e.x = e.bodies[0].x; e.y = e.bodies[0].y; e.dashing = e.bodies[0].dash;
    e.trail.push(e.x, e.y); if (e.trail.length > 28) e.trail.splice(0, 2);
    // it also remembers how to shoot
    e.shootT -= dt; e.tele = e.shootT < 0.5 ? 1 - e.shootT / 0.5 : 0;
    if (e.shootT <= 0) {
      e.shootT = low ? 1.9 : 2.7;
      if (e.inv <= 0) {
        const a = Math.atan2(p.y - e.y, p.x - e.x), n = low ? 2 : 1;
        for (let i = -n; i <= n; i++) G.fireBullet(e.x, e.y, a + i * 0.22, 245, { color: '#b592ff' });
        sfx().shot();
      }
    }
  }

  // ---------- cinematics ----------
  function updateCine(c, dt) {
    const p = G.player;
    c.t += dt;
    if (c.name === 'bossdeath') {
      const b = G.boss;
      if (c.s === 0) {
        c.acc += dt;
        if (c.acc > 0.05) {
          c.acc = 0; const a = L.r(0, TAU), d = L.r(0, 90);
          F.burst(Math.cos(a) * d, Math.sin(a) * d, 12, Math.random() < 0.5 ? C.violet : '#fff', { speed: 420, life: 0.5 });
          F.shake(0.12); if (b) { b.flash = 1; b.rot += 0.3; }
          if (Math.random() < 0.4) sfx().hit();
        }
        if (c.t > 0.9) {
          c.s = 1; G.boss = null;
          F.burst(0, 0, 160, '#fff', { speed: 1100, life: 1.5, size: 5, drag: 1.4 });
          F.burst(0, 0, 100, C.gold, { speed: 700, life: 1.8, size: 4, drag: 1.2 });
          for (let i = 0; i < 4; i++) F.ring(0, 0, 40, 400 + i * 220, 0.8 + i * 0.3, i % 2 ? C.gold : '#fff', 9);
          G.ripple(0, 0, 60); F.shake(1); L.post.flash = 0.85; L.post.flashCol = [1, 1, 1];
          sfx().explode(true); G.addScore(2000 * G.depth);
          for (let i = 0; i < 30; i++) G.dropShard(L.r(-40, 40), L.r(-40, 40), 2);
        }
      } else if (G.depth === 1) {
        // the false ending
        if (c.s === 1 && c.t > 2.0) { c.s = 2; G.say('THE ECLIPSE IS BROKEN', 'Light returns.', 3.2); sfx().victory(); }
        if (c.s === 2 && c.t > 5.6) { c.s = 3; G.say('…but every light casts a shadow.', '', 2.6); L.post.glitch = 0.9; sfx().glitch(); F.shake(0.4); }
        if (c.s === 3) { L.post.glitch = Math.max(0.35, L.post.glitch - dt * 0.2); if (Math.random() < dt * 4) sfx().glitch(); }
        if (c.s === 3 && c.t > 8.0) { G.cine = null; spawnEcho(); }
      } else {
        if (c.s === 1 && c.t > 1.8) { c.s = 3; G.say('IT FOLLOWED YOU DOWN', '', 1.8); L.post.glitch = 0.8; sfx().glitch(); }
        if (c.s === 3 && c.t > 3.6) { G.cine = null; spawnEcho(); }
      }
    } else if (c.name === 'victory') {
      if (c.s === 0 && c.t > 0.5) {
        c.s = 1; L.post.glitch = 0;
        const sd = L.save.data, first = !sd.cores.umbra;
        sd.cores.umbra = true; sd.stats.echo++; L.save.write();
        G.say('SHADOW EMBRACED', first ? 'UMBRA core unlocked — DEPTH ' + G.depth + ' cleared' : 'DEPTH ' + G.depth + ' cleared', 3.4);
        sfx().victory(); G.addScore(5000 * G.depth);
        p.hp = p.maxHp; F.ring(p.x, p.y, 10, 120, 0.6, C.green, 5);
        for (let i = 0; i < 40; i++) G.dropShard(c.x + L.r(-50, 50), c.y + L.r(-50, 50), 2);
        for (let i = 0; i < 3; i++) F.ring(c.x, c.y, 30, 300 + i * 200, 0.8 + i * 0.3, C.gold, 8);
      }
      if (c.s === 1 && c.t > 4.0) { G.cine = null; L.audio.setMode('run'); G.phase = 'wait'; G.openPick(true); }
    }
  }

  B.update = function (dt) {
    if (G.cine) updateCine(G.cine, dt);
    if (G.boss && !G.boss.dead) updateBoss(G.boss, dt);
    if (G.echo && !G.player.dead) updateEcho(G.echo, dt);
  };
  // debug helper: jump straight to the finale
  B.debugEcho = function () { G.boss = null; G.enemies.length = 0; spawnEcho(); };
})();
