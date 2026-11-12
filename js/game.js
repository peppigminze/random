'use strict';
// LUMEN — simulation: player, dash, enemies, bullets, procs, run flow
(function () {
  const L = window.L, F = L.fx, C = L.PAL, TAU = L.TAU;
  const sfx = () => L.audio.sfx;
  const G = L.game = {
    state: 'menu', attract: false, god: false, time: 0, wave: 0, depth: 1, score: 0,
    enemies: [], bullets: [], shards: [], zones: [], flies: [], scars: [], ripples: [],
    player: null, boss: null, echo: null, cine: null, banner: null, mut: null,
    cam: { x: 0, y: 0, zoom: 1 }, arenaR: 620, arenaTarget: 620, slow: 1, slowT: 0, hitstop: 0,
    phase: 'intro', phaseT: 0, procDepth: 0, combo: 0, comboT: 0,
  };

  const SEEDCH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  G.randomSeed = () => { let s = ''; for (let i = 0; i < 6; i++) s += SEEDCH[Math.floor(Math.random() * SEEDCH.length)]; return s; };

  function makePlayer() {
    const s = L.save.data, c = L.CORES[s.core] || L.CORES.spark;
    return {
      x: 0, y: 140, vx: 0, vy: 0, r: 10, core: c, color: c.color,
      hp: c.hp + L.perm('vital'), maxHp: c.hp + L.perm('vital'),
      charges: c.charges + L.perm('reserve'), maxCharges: c.charges + L.perm('reserve'),
      rech: 0, rechTime: 0.9 * c.rech, dashDist: 235 * c.dash * (1 + 0.08 * L.perm('momentum')), dashDur: 0.115, dashW: 16,
      dashing: false, dT: 0, dsx: 0, dsy: 0, ddx: 0, ddy: -1, hit: null, dashKills: 0,
      inv: 1, grace: 0, energy: 0, energyRate: 1, speed: 335 * c.speed, face: -Math.PI / 2,
      magnet: 95 * (1 + 0.35 * L.perm('magnet')), dmg: c.dmg, novaR: 340,
      procs: [], taken: {}, cards: [], trail: [], sq: 0, buffer: 0, bax: 0, bay: -1, fizz: 0, dead: false,
      shardMul: c.shardMul * (1 + 0.15 * L.perm('greed')), readyFx: 0,
    };
  }

  G.newRun = function (o) {
    o = o || {};
    G.seed = o.seed || G.randomSeed();
    G.rng = new L.RNG(L.hash(G.seed)); G.upRng = new L.RNG(L.hash(G.seed + ':up'));
    G.attract = !!o.attract; G.god = !!o.attract || !!o.god; G.daily = !!o.daily;
    G.time = 0; G.wave = o.wave || 0; G.depth = 1; G.score = 0; G.combo = 0; G.comboT = 0; G.bestCombo = 0;
    G.kills = 0; G.runShards = 0; G.pickStreak = 0; G.pickT = 0; G.scorePop = 0; G.counters = 0;
    G.enemies = []; G.bullets = []; G.shards = []; G.zones = []; G.flies = []; G.scars = []; G.ripples = [];
    G.pending = []; G.boss = null; G.echo = null; G.cine = null; G.banner = null; G.mut = null; G.choices = null;
    G.arenaR = G.arenaTarget = 620; G.slow = 1; G.slowT = 0; G.hitstop = 0; G.epicPick = false;
    G.phase = 'intro'; G.phaseT = o.attract ? 0.3 : 1.3; G.rerolls = L.perm('reroll');
    G.player = makePlayer(); G.cam.x = 0; G.cam.y = 60; G.cam.zoom = 1;
    F.clear(); L.post.glitch = 0;
    L.audio.seedSong(L.hash(G.seed)); L.audio.setMode(o.attract ? 'menu' : 'run'); L.audio.muteSfx = !!o.attract; L.audio.muffle(0);
    if (L.perm('start') && !o.attract) {
      const c = L.genChoices(G, G.upRng)[0]; if (c) L.applyCard(G, c);
    }
    if (o.attract) for (let i = 0; i < 3; i++) { const c = L.genChoices(G, G.upRng)[0]; if (c) L.applyCard(G, c); }
  };

  // ---------- helpers ----------
  G.addScore = function (v) { G.score += Math.round(v); G.scorePop = 1; };
  G.say = function (title, sub, t) { G.banner = { title, sub: sub || '', t: t || 2.2, max: t || 2.2 }; };
  G.ripple = function (x, y, amp) { if (G.ripples.length < 8) G.ripples.push({ x, y, r: 0, amp: amp || 20, life: 1 }); };
  G.fireBullet = function (x, y, ang, speed, o) {
    if (G.bullets.length > 420) return;
    o = o || {};
    G.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: o.r || 6, life: o.life || 7, arm: o.arm || 0, color: o.color || C.bullet });
  };
  G.clearBullets = function (x, y, r) {
    for (const b of G.bullets) {
      if (b.dead) continue;
      const dx = b.x - x, dy = b.y - y;
      if (dx * dx + dy * dy < r * r) { b.dead = true; F.dot(b.x, b.y, C.cyan, 5, 0.3); }
    }
  };
  G.slowmo = function (scale, t) { if (scale < G.slow || G.slowT <= 0) { G.slow = scale; } G.slowT = Math.max(G.slowT, t); };
  G.stop = function (t) { G.hitstop = Math.max(G.hitstop, t); };

  G.spawnEnemy = function (type, x, y, delay) {
    const d = L.ENEMY[type];
    const hasteMul = G.mut && G.mut.id === 'haste' ? 1.28 : 1;
    const e = {
      type, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp, color: d.color, def: d,
      speed: d.speed * (1 + Math.min(0.55, G.wave * 0.022)) * hasteMul, haste: hasteMul,
      t: L.r(0, 10), spawnT: 0.75 + (delay || 0), flash: 0, state: 'stalk', st: L.r(0.8, 1.8),
      face: Math.atan2(G.player.y - y, G.player.x - x), cd: L.r(1.4, 2.6), variant: G.rng.int(0, 1), fuse: 0, wob: L.r(0.7, 1.3),
    };
    G.enemies.push(e);
    return e;
  };

  // shockwave that damages enemies and wipes bullets
  G.shock = function (x, y, r, dmg, color) {
    F.ring(x, y, r * 0.15, r, 0.45, color || C.gold, 6);
    F.ring(x, y, r * 0.1, r * 0.8, 0.6, '#fff', 2);
    G.ripple(x, y, Math.min(34, r * 0.12));
    G.clearBullets(x, y, r);
    for (const e of G.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d < r + e.r) {
        if (dmg > 0) G.hitEnemy(e, 'nova', dmg);
        if (!e.dead && d > 1) { e.vx += dx / d * 380; e.vy += dy / d * 380; }
      }
    }
    if (G.boss && L.boss) L.boss.onShock(x, y, r);
  };

  // ---------- procs: trigger x effect ----------
  function fire(trig, x, y) {
    const p = G.player;
    if (!p || G.procDepth > 1) return;
    G.procDepth++;
    for (const q of p.procs) {
      if (q.trig !== trig) continue;
      if (++q.count >= q.n) { q.count = 0; doEff(q.eff, q.power * (trig === 'hurt' ? 2 : 1), x, y); }
    }
    G.procDepth--;
  }
  G.fire = fire;
  function doEff(eff, pw, x, y) {
    if (eff === 'nova') G.shock(x, y, 80 + 42 * pw, 1, C.gold);
    else if (eff === 'arc') {
      let n = Math.round(2 * pw), fx = x, fy = y; const used = new Set();
      while (n-- > 0) {
        let best = null, bd = 300 * 300;
        for (const e of G.enemies) {
          if (e.dead || e.spawnT > 0 || used.has(e)) continue;
          const d = (e.x - fx) * (e.x - fx) + (e.y - fy) * (e.y - fy);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        used.add(best); F.bolt(fx, fy, best.x, best.y, C.cyan);
        fx = best.x; fy = best.y; G.hitEnemy(best, 'arc', 1);
      }
      if (used.size) sfx().slice();
    } else if (eff === 'swarm') {
      const n = Math.round(2 * pw);
      for (let i = 0; i < n && G.flies.length < 40; i++) {
        const a = L.r(0, TAU);
        G.flies.push({ x, y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 3, trail: [] });
      }
    } else if (eff === 'ember') G.zones.push({ x, y, r: 54, life: 1.6 * pw, max: 1.6 * pw, tick: 0 });
    else if (eff === 'still') G.slowmo(0.35, 0.7 * pw);
  }

  // ---------- damage ----------
  // returns 'block' when a dash is deflected, true when damage landed
  G.hitEnemy = function (e, src, dmg) {
    if (e.dead || e.spawnT > 0) return false;
    const p = G.player;
    if (src === 'dash') {
      if (e.type === 'warden') {
        const a = Math.atan2(p.dsy - e.y, p.dsx - e.x);
        if (Math.abs(L.angDiff(a, e.face)) < 1.15) {
          const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
          G.cancelDash(dx / d, dy / d);
          e.flash = 1; e.vx -= dx / d * 120; e.vy -= dy / d * 120;
          F.burst(p.x, p.y, 14, '#fff', { speed: 420, life: 0.3, dir: Math.atan2(dy, dx), spread: 1.6 });
          F.text(e.x, e.y - 34, 'BLOCKED', '#ff5cf0', 15, 0.7);
          sfx().block(); F.shake(0.25); G.stop(0.05);
          return 'block';
        }
      }
      if (e.type === 'pyre') {
        if (!e.primed) { e.primed = true; e.fuse = 0.6; p.charges = Math.min(p.maxCharges, p.charges + 1); }
        e.vx += p.ddx * 420; e.vy += p.ddy * 420; e.flash = 1;
        sfx().hit(); F.shake(0.12); G.stop(0.03);
        return true;
      }
    } else if (e.type === 'pyre') { if (!e.fuse || e.fuse > 0.25) e.fuse = 0.25; e.primed = true; e.flash = 1; return true; }
    e.hp -= dmg; e.flash = 1;
    if (e.hp <= 0) killEnemy(e, src);
    else {
      sfx().hit(); F.burst(e.x, e.y, 6, e.color, { speed: 200, life: 0.3 });
      if (src === 'dash') { G.stop(0.03); F.shake(0.1); e.vx += p.ddx * 300; e.vy += p.ddy * 300; e.cd = Math.max(e.cd, 0.9); }
    }
    return true;
  };

  function killEnemy(e, src) {
    if (e.dead) return;
    e.dead = true;
    const p = G.player, d = e.def;
    G.combo++; G.comboT = 2.8; G.bestCombo = Math.max(G.bestCombo, G.combo); G.kills++;
    let pts = d.score * (1 + G.combo * 0.1) * G.depth;
    if (src === 'dash') {
      p.charges = Math.min(p.maxCharges, p.charges + 1); p.dashKills++;
      p.energy = Math.min(1, p.energy + 0.05 * p.energyRate);
      G.stop(0.03 + Math.min(G.combo, 20) * 0.0016); F.shake(0.2);
      F.kick(p.ddx, p.ddy, 7);
      if (e.type === 'lancer' && e.state === 'charge') {
        // hidden mechanic: cutting a lancer mid-charge is a counter
        pts *= 3; p.charges = p.maxCharges; p.energy = Math.min(1, p.energy + 0.15); G.counters++;
        F.text(e.x, e.y - 40, 'COUNTER!', C.gold, 26, 1.1); sfx().counter(); G.slowmo(0.3, 0.35); F.punch(0.07);
        F.ring(e.x, e.y, 10, 150, 0.5, C.gold, 5);
      }
    } else p.energy = Math.min(1, p.energy + 0.025 * p.energyRate);
    G.addScore(pts);
    sfx().kill(G.combo);
    const a = src === 'dash' ? Math.atan2(p.ddy, p.ddx) : undefined;
    F.burst(e.x, e.y, 14 + Math.min(10, G.combo), e.color, { speed: 430, life: 0.55, dir: a, spread: 2.2, size: 3.5 });
    F.burst(e.x, e.y, 6, '#fff', { speed: 240, life: 0.3, size: 2.5 });
    F.ring(e.x, e.y, e.r * 0.5, e.r * 3.2, 0.32, e.color, 4);
    G.ripple(e.x, e.y, 10);
    const gild = G.mut && G.mut.id === 'gilded' ? 2 : 1;
    for (let i = 0; i < d.shards; i++) dropShard(e.x, e.y, gild);
    if (p.hp < p.maxHp && Math.random() < 0.035) dropShard(e.x, e.y, 0, true);
    if (e.type === 'cell') {
      for (let i = 0; i < 3; i++) {
        const an = i * TAU / 3 + L.r(0, 1), m = G.spawnEnemy('mite', e.x + Math.cos(an) * 14, e.y + Math.sin(an) * 14, 0);
        m.spawnT = 0.28; m.vx = Math.cos(an) * 300; m.vy = Math.sin(an) * 300;
      }
    }
    if (e.type === 'pyre' && !e.blown) blast(e);
    if (G.mut && G.mut.id === 'volatile' && e.type !== 'mite') {
      const o = L.r(0, TAU);
      for (let i = 0; i < 5; i++) G.fireBullet(e.x, e.y, o + i * TAU / 5, 125, { life: 2.4, arm: 0.4 });
    }
    fire('kill', e.x, e.y);
    if (G.combo % 8 === 0) { fire('combo', p.x, p.y); F.text(p.x, p.y - 46, G.combo + ' CHAIN', C.cyan, 20, 0.9); }
  }

  function blast(e) {
    e.blown = true;
    const R = 128, p = G.player;
    sfx().explode(false); F.shake(0.45); G.stop(0.05);
    F.burst(e.x, e.y, 40, '#ffb23d', { speed: 620, life: 0.6, size: 4 });
    F.burst(e.x, e.y, 16, '#fff', { speed: 300, life: 0.4 });
    F.ring(e.x, e.y, 20, R, 0.4, '#ffb23d', 8); G.ripple(e.x, e.y, 26);
    G.clearBullets(e.x, e.y, R);
    for (const o of G.enemies) {
      if (o === e || o.dead || o.spawnT > 0) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < R + o.r) {
        if (o.type === 'pyre') { o.fuse = Math.min(o.fuse || 9, 0.13); o.primed = true; }
        else G.hitEnemy(o, 'blast', 2);
      }
    }
    if (p && !p.dead && Math.hypot(p.x - e.x, p.y - e.y) < R - 18) G.hurtPlayer(e.x, e.y);
  }

  G.dropShard = dropShard;
  function dropShard(x, y, val, heal) {
    if (G.shards.length > 260) return;
    const a = L.r(0, TAU), v = L.r(80, 260);
    G.shards.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, val: val || 1, heal: !!heal, t: L.r(0, 6), life: heal ? 14 : 22 });
  }

  G.hurtPlayer = function (fx, fy) {
    const p = G.player;
    if (!p || p.dead || p.inv > 0 || p.dashing || G.cine) return false;
    if (G.god) { p.inv = 0.6; F.shake(0.2); return false; }
    p.hp--; p.inv = 1.3; G.combo = 0; G.comboT = 0;
    const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1;
    p.vx = dx / d * 520; p.vy = dy / d * 520;
    F.shake(0.75); G.stop(0.13); F.punch(0.06);
    L.post.flash = 0.5; L.post.flashCol = [1, 0.15, 0.3];
    F.burst(p.x, p.y, 30, C.red, { speed: 520, life: 0.6, size: 4 });
    F.ring(p.x, p.y, 10, 190, 0.45, C.red, 6);
    G.clearBullets(p.x, p.y, 190);
    sfx().hurt();
    fire('hurt', p.x, p.y);
    if (p.hp <= 0) {
      p.dead = true; G.phase = 'dying'; G.phaseT = 1.7; G.slow = 0.12; G.slowT = 1.5;
      F.burst(p.x, p.y, 90, p.color, { speed: 760, life: 1.3, size: 4.5, drag: 1.6 });
      F.burst(p.x, p.y, 40, '#fff', { speed: 420, life: 1, drag: 1.6 });
      for (let i = 0; i < 3; i++) F.ring(p.x, p.y, 10, 240 + i * 150, 0.7 + i * 0.25, p.color, 6);
      sfx().death(); L.audio.muffle(1); F.shake(1);
    }
    return true;
  };

  G.cancelDash = function (bx, by) {
    const p = G.player;
    if (p.dashing) F.slash(p.dsx, p.dsy, p.x, p.y, p.color, 9);
    p.dashing = false; p.vx = bx * 470; p.vy = by * 470; p.inv = Math.max(p.inv, 0.35); p.sq = 1;
  };

  // ---------- player ----------
  function startDash(p) {
    p.charges--; p.buffer = 0;
    p.dashing = true; p.dT = 0; p.dsx = p.x; p.dsy = p.y; p.ddx = p.bax; p.ddy = p.bay;
    p.face = Math.atan2(p.ddy, p.ddx); p.hit = new Set(); p.dashKills = 0; p.sq = 1;
    sfx().dash();
    F.burst(p.x, p.y, 10, p.color, { speed: 300, life: 0.35, dir: p.face + Math.PI, spread: 1.1 });
    F.ring(p.x, p.y, 6, 44, 0.25, p.color, 3);
    F.kick(p.ddx, p.ddy, -5); G.ripple(p.x, p.y, 8);
  }
  function endDash(p) {
    p.dashing = false;
    F.slash(p.dsx, p.dsy, p.x, p.y, p.color, 11 + p.dashKills * 2);
    p.vx = p.ddx * p.speed * 0.55; p.vy = p.ddy * p.speed * 0.55;
    p.inv = Math.max(p.inv, 0.1 + p.grace); p.sq = 0.8;
    if (p.core.endNova) { G.shock(p.x, p.y, 115, 1, p.color); F.shake(0.2); }
    fire('dash', p.x, p.y);
    if (p.dashKills >= 3) { F.text(p.x, p.y - 44, ['', '', '', 'TRIPLE', 'QUAD', 'PENTA'][Math.min(5, p.dashKills)] + ' CUT', '#fff', 20, 0.9); G.addScore(50 * p.dashKills); F.punch(0.05); }
  }
  function dashSweep(p, ax, ay, bx, by) {
    const w = p.dashW;
    if (L.boss && L.boss.dashSweep(ax, ay, bx, by)) return;
    for (const e of G.enemies) {
      if (e.dead || e.spawnT > 0 || p.hit.has(e)) continue;
      const rr = e.r + w;
      if (L.segDist2(e.x, e.y, ax, ay, bx, by) < rr * rr) {
        p.hit.add(e);
        if (G.hitEnemy(e, 'dash', p.dmg) === 'block') return;
      }
    }
    for (const b of G.bullets) {
      if (b.dead) continue;
      const rr = b.r + w + 4;
      if (L.segDist2(b.x, b.y, ax, ay, bx, by) < rr * rr) {
        b.dead = true; p.energy = Math.min(1, p.energy + 0.022 * p.energyRate); G.addScore(2);
        F.burst(b.x, b.y, 5, C.cyan, { speed: 220, life: 0.3 }); sfx().slice();
        fire('slice', b.x, b.y);
      }
    }
  }
  function clampArena(o, pad) {
    const d = Math.hypot(o.x, o.y), m = G.arenaR - pad;
    if (d > m) {
      const nx = o.x / d, ny = o.y / d; o.x = nx * m; o.y = ny * m;
      const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= vn * nx; o.vy -= vn * ny; }
      return true;
    }
    return false;
  }
  G.clampArena = clampArena;

  function updatePlayer(p, dt, inp) {
    p.inv -= dt; p.sq = L.damp(p.sq, 0, 9, dt); p.fizz -= dt; p.readyFx -= dt;
    if (p.buffer > 0) p.buffer -= dt;
    if (inp.dash || inp.mouseDash) {
      let ax = 0, ay = 0;
      if (inp.mouseDash) { const w = L.render.toWorld(inp.mouseX, inp.mouseY); ax = w.x - p.x; ay = w.y - p.y; }
      else if (inp.hasAim) { ax = inp.ax; ay = inp.ay; }
      else { ax = inp.mx; ay = inp.my; }
      const d = Math.hypot(ax, ay);
      if (d > 0.01) { p.bax = ax / d; p.bay = ay / d; } else { p.bax = Math.cos(p.face); p.bay = Math.sin(p.face); }
      p.buffer = 0.15;
      if (p.charges <= 0 && !p.dashing) {
        // no charge: still answer the press within the frame
        sfx().fizzle(); p.fizz = 0.25; p.sq = 0.35;
        F.burst(p.x, p.y, 4, C.dim, { speed: 120, life: 0.25, dir: Math.atan2(p.bay, p.bax), spread: 0.8 });
      }
    }
    if (p.dashing) {
      p.dT += dt;
      const k = Math.min(1, p.dT / p.dashDur), e = L.ease.outQuad(k);
      const px = p.x, py = p.y;
      p.x = p.dsx + p.ddx * p.dashDist * e; p.y = p.dsy + p.ddy * p.dashDist * e;
      const wall = clampArena(p, p.r);
      dashSweep(p, px, py, p.x, p.y);
      if (p.dashing) {
        const steps = 3;
        for (let i = 1; i <= steps; i++) p.trail.push({ x: L.lerp(px, p.x, i / steps), y: L.lerp(py, p.y, i / steps) });
        if (Math.random() < 0.8) F.dot(L.lerp(px, p.x, Math.random()), L.lerp(py, p.y, Math.random()), p.color, 4, 0.35, L.r(-40, 40), L.r(-40, 40));
        if (wall) { F.burst(p.x, p.y, 10, C.wall, { speed: 300, life: 0.3 }); F.shake(0.15); endDash(p); }
        else if (k >= 1) endDash(p);
      }
    } else {
      const moving = inp.mx || inp.my;
      p.vx = L.damp(p.vx, inp.mx * p.speed, moving ? 18 : 12, dt);
      p.vy = L.damp(p.vy, inp.my * p.speed, moving ? 18 : 12, dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.hypot(p.vx, p.vy) > 40) p.face = Math.atan2(p.vy, p.vx);
      clampArena(p, p.r);
      if (L.boss) L.boss.bodyCollide(p);
      p.trail.push({ x: p.x, y: p.y });
      if (p.buffer > 0 && p.charges > 0) startDash(p);
    }
    while (p.trail.length > 18) p.trail.shift();
    if (p.charges < p.maxCharges) {
      p.rech += dt;
      if (p.rech >= p.rechTime) { p.rech = 0; p.charges++; p.readyFx = 0.3; sfx().recharge(); F.ring(p.x, p.y, 26, 12, 0.2, p.color, 2); }
    } else p.rech = 0;
    if (p.energy >= 1 && !p.novaReady) { p.novaReady = true; F.text(p.x, p.y - 40, 'NOVA READY', C.cyan, 16, 1); sfx().ok(); }
    if (inp.nova) {
      if (p.energy >= 1) {
        p.energy = 0; p.novaReady = false; p.inv = Math.max(p.inv, 0.6);
        G.shock(p.x, p.y, p.novaR, 2, C.cyan);
        F.burst(p.x, p.y, 70, C.cyan, { speed: 900, life: 0.7, size: 4, drag: 2.2 });
        F.shake(0.6); F.punch(0.1); G.slowmo(0.3, 0.3); sfx().nova();
        L.post.flash = 0.3; L.post.flashCol = [0.4, 0.95, 1];
      } else sfx().fizzle();
    }
  }

  // ---------- enemies ----------
  function updateEnemy(e, dt, p) {
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      if (e.spawnT <= 0) { F.ring(e.x, e.y, e.r * 3, e.r, 0.2, e.color, 3); F.burst(e.x, e.y, 6, e.color, { speed: 160, life: 0.3 }); }
      return;
    }
    e.t += dt; e.flash = Math.max(0, e.flash - dt * 6);
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    let tx = 0, ty = 0, k = 3;
    switch (e.type) {
      case 'mote': case 'mite': case 'cell': {
        const w = Math.sin(e.t * 2.6 * e.wob) * (e.type === 'mite' ? 0.9 : 0.45);
        tx = (nx - ny * w) * e.speed; ty = (ny + nx * w) * e.speed;
        e.face = Math.atan2(e.vy, e.vx);
        break;
      }
      case 'warden': {
        tx = nx * e.speed; ty = ny * e.speed;
        const want = Math.atan2(dy, dx), df = L.angDiff(want, e.face), turn = 1.35 * e.haste * dt;
        e.face += L.clamp(df, -turn, turn);
        break;
      }
      case 'pyre': {
        tx = nx * e.speed; ty = ny * e.speed;
        if (!e.fuse && d < 78) { e.fuse = 0.95; sfx().telegraph(); }
        if (e.fuse > 0) {
          e.fuse -= dt; tx = ty = 0;
          if (e.fuse <= 0) { e.fuse = 0.0001; if (!e.blown) { blast(e); if (e.primed) killEnemy(e, 'blast'); else { e.dead = true; F.burst(e.x, e.y, 10, e.color, {}); } } }
        }
        break;
      }
      case 'seer': {
        const ideal = 340;
        const radial = d < ideal - 70 ? -1 : d > ideal + 80 ? 1 : 0;
        const dirS = e.variant ? 1 : -1;
        tx = (nx * radial - ny * 0.6 * dirS) * e.speed; ty = (ny * radial + nx * 0.6 * dirS) * e.speed;
        e.face = Math.atan2(dy, dx);
        const rate = G.mut && G.mut.id === 'barrage' ? 1.8 : 1;
        const was = e.cd; e.cd -= dt * rate;
        if (was > 0.55 && e.cd <= 0.55) sfx().charge();
        if (e.cd <= 0) {
          e.cd = L.r(2.3, 3.1);
          const a = Math.atan2(dy, dx);
          if (e.variant) { const o = L.r(0, TAU); for (let i = 0; i < 9; i++) G.fireBullet(e.x, e.y, o + i * TAU / 9, 165); }
          else for (let i = -1; i <= 1; i++) G.fireBullet(e.x, e.y, a + i * 0.2, 235);
          sfx().shot(); e.flash = 0.6; e.vx -= nx * 90; e.vy -= ny * 90;
          F.burst(e.x, e.y, 6, e.color, { speed: 200, life: 0.25, dir: a, spread: 1 });
        }
        break;
      }
      case 'lancer': {
        e.st -= dt;
        if (e.state === 'stalk') {
          const radial = d > 300 ? 1 : d < 200 ? -0.6 : 0;
          tx = (nx * radial - ny * 0.5) * e.speed; ty = (ny * radial + nx * 0.5) * e.speed;
          e.face = Math.atan2(dy, dx);
          if (e.st <= 0 && d < 560) { e.state = 'aim'; e.st = 0.62; sfx().telegraph(); }
        } else if (e.state === 'aim') {
          k = 8;
          if (e.st > 0.16) e.face = Math.atan2(dy, dx);
          if (e.st <= 0) {
            e.state = 'charge'; e.st = 0.5;
            e.vx = Math.cos(e.face) * 840 * e.haste; e.vy = Math.sin(e.face) * 840 * e.haste; sfx().lunge();
          }
        } else if (e.state === 'charge') {
          k = 0; tx = e.vx; ty = e.vy;
          F.dot(e.x, e.y, e.color, 5, 0.3);
          if (e.st <= 0) { e.state = 'recover'; e.st = 0.7; }
        } else { k = 5; if (e.st <= 0) { e.state = 'stalk'; e.st = L.r(0.9, 1.9); } }
        break;
      }
    }
    if (k > 0) { e.vx = L.damp(e.vx, tx, k, dt); e.vy = L.damp(e.vy, ty, k, dt); }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (clampArena(e, e.r) && e.type === 'lancer' && e.state === 'charge') {
      e.state = 'stun'; e.st = 1.4; e.vx = e.vy = 0; F.shake(0.2);
      F.burst(e.x, e.y, 12, e.color, { speed: 300, life: 0.35 }); sfx().hit();
    }
    // contact
    if (!p.dead && !p.dashing && d < e.r + p.r - 3 && e.state !== 'stun') {
      if (e.type === 'pyre') { if (!e.fuse || e.fuse > 0.3) e.fuse = 0.3; }
      else G.hurtPlayer(e.x, e.y);
    }
  }

  function separate() {
    const E = G.enemies, n = E.length;
    for (let i = 0; i < n; i++) {
      const a = E[i]; if (a.spawnT > 0 || a.state === 'charge') continue;
      for (let j = i + 1; j < n; j++) {
        const b = E[j]; if (b.spawnT > 0 || b.state === 'charge') continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r + 4, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), o = (rr - d) * 0.5 / d;
          a.x -= dx * o; a.y -= dy * o; b.x += dx * o; b.y += dy * o;
        }
      }
    }
  }

  // ---------- waves ----------
  function spawnPulse() {
    const groups = G.pending.shift(), p = G.player, R = G.arenaR - 50;
    let idx = 0;
    for (const g of groups) {
      const n = g.types.length;
      const ca = g.a, cr = L.r(120, R - 60);
      let cx = Math.cos(ca) * cr, cy = Math.sin(ca) * cr;
      if (Math.hypot(cx - p.x, cy - p.y) < 280) { cx = -cx; cy = -cy; }
      g.types.forEach((t, i) => {
        let x, y;
        if (g.form === 'ring') { const a = g.a + i * TAU / n, rr = 300 + (i % 2) * 40; x = p.x + Math.cos(a) * rr; y = p.y + Math.sin(a) * rr; }
        else if (g.form === 'line') { const a = g.a, off = (i - (n - 1) / 2) * 48; x = Math.cos(a) * R * 0.75 - Math.sin(a) * off; y = Math.sin(a) * R * 0.75 + Math.cos(a) * off; }
        else if (g.form === 'sides') { const s = i % 2 ? 1 : -1, off = (Math.floor(i / 2) - n / 4) * 50; x = Math.cos(g.a) * R * 0.8 * s - Math.sin(g.a) * off; y = Math.sin(g.a) * R * 0.8 * s + Math.cos(g.a) * off; }
        else { const a = i * 2.4, rr = 16 + Math.sqrt(i) * 30; x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr; }
        const d = Math.hypot(x, y); if (d > R) { x *= R / d; y *= R / d; }
        const pd = Math.hypot(x - p.x, y - p.y);
        if (pd < 200) { const a = pd > 1 ? Math.atan2(y - p.y, x - p.x) : g.a; x = p.x + Math.cos(a) * 210; y = p.y + Math.sin(a) * 210; const d2 = Math.hypot(x, y); if (d2 > R) { x = -x * 0.5; y = -y * 0.5; } }
        G.spawnEnemy(t, x, y, (idx++) * 0.04);
      });
    }
    G.pulseT = 0; sfx().spawn();
  }
  function startWave() {
    if (G.attract && G.wave >= 8) { G.newRun({ attract: true, seed: G.randomSeed() }); return; }
    G.wave++; G.depth = 1 + Math.floor((G.wave - 1) / 10);
    if (G.wave % 10 === 0 && L.boss) { L.boss.start(); return; }
    const def = L.genWave(G.wave, G.depth, G.rng);
    G.mut = def.mut; G.pending = def.pulses; G.phase = 'fight';
    G.say('WAVE ' + G.wave, def.mut ? def.mut.name + ' — ' + def.mut.desc : (G.depth > 1 ? 'DEPTH ' + G.depth : ''), 2.4);
    sfx().wave();
    spawnPulse();
  }
  G.afterPick = function () { G.choices = null; G.phase = 'intro'; G.phaseT = 0.8; G.epicPick = false; if (!G.attract) G.state = 'play'; };
  G.openPick = function (epic) {
    G.epicPick = !!epic;
    G.choices = L.genChoices(G, G.upRng);
    if (!G.choices.length) { G.afterPick(); return; }
    if (G.attract || G.autoPick) { L.applyCard(G, G.choices[0]); G.afterPick(); return; }
    G.state = 'pick';
    if (L.ui) L.ui.show('pick');
  };
  G.waveCleared = function () {
    G.phase = 'clear'; G.phaseT = 1.5; G.mut = null;
    G.slowmo(0.22, 0.55); F.punch(0.09);
    G.say('WAVE CLEAR', '', 1.4); sfx().wave(); G.addScore(100 * G.wave);
    G.clearBullets(0, 0, 2000);
  };

  G.endRun = function () {
    if (G.attract) { G.newRun({ attract: true, seed: G.randomSeed() }); return; }
    const s = L.save.data, earned = Math.floor(G.runShards);
    s.shards += earned; s.stats.runs++; s.stats.kills += G.kills; s.stats.bestWave = Math.max(s.stats.bestWave, G.wave);
    const entry = { score: G.score, wave: G.wave, seed: G.seed, core: s.core, combo: G.bestCombo };
    G.newBest = !s.scores.length || G.score > s.scores[0].score;
    s.scores.push(entry); s.scores.sort((a, b) => b.score - a.score); s.scores = s.scores.slice(0, 8);
    L.save.write();
    G.earned = earned; G.state = 'over';
    if (L.ui) L.ui.show('over');
  };

  // ---------- main update ----------
  function update(dt, inp) {
    const p = G.player;
    G.time += dt;
    if (!p.dead) updatePlayer(p, dt, inp);
    for (let i = 0; i < G.enemies.length; i++) { const e = G.enemies[i]; if (!e.dead) updateEnemy(e, dt, p); }
    separate();
    if (L.boss) L.boss.update(dt);

    for (const b of G.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; b.arm -= dt;
      if (b.life <= 0 || b.x * b.x + b.y * b.y > (G.arenaR - 2) * (G.arenaR - 2)) { b.dead = true; F.dot(b.x, b.y, b.color, 4, 0.2); continue; }
      if (b.arm <= 0 && !p.dead && !p.dashing) {
        const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + p.r - 4;
        if (dx * dx + dy * dy < rr * rr) { if (G.hurtPlayer(b.x, b.y) || p.inv <= 0) b.dead = true; }
      }
    }
    for (const f of G.flies) {
      f.life -= dt;
      let best = null, bd = 420 * 420;
      for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const d = (e.x - f.x) ** 2 + (e.y - f.y) ** 2; if (d < bd) { bd = d; best = e; } }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        f.vx = L.damp(f.vx, (best.x - f.x) / d * 520, 5, dt); f.vy = L.damp(f.vy, (best.y - f.y) / d * 520, 5, dt);
        if (d < best.r + 8) { G.hitEnemy(best, 'fly', 1); f.life = 0; F.burst(f.x, f.y, 5, C.gold, { speed: 160, life: 0.25 }); }
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.trail.push(f.x, f.y); if (f.trail.length > 16) f.trail.splice(0, 2);
    }
    for (const z of G.zones) {
      z.life -= dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.3;
        for (const e of G.enemies) if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) G.hitEnemy(e, 'ember', 1);
      }
      if (Math.random() < 0.5) F.dot(z.x + L.r(-z.r, z.r) * 0.7, z.y + L.r(-z.r, z.r) * 0.7, '#ff8a3d', 4, 0.5, 0, -60);
    }
    for (const s of G.scars) {
      s.life -= dt; s.arm -= dt;
      if (s.arm <= 0 && !p.dead && !p.dashing && L.segDist2(p.x, p.y, s.ax, s.ay, s.bx, s.by) < 15 * 15) G.hurtPlayer((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
    }
    // shards
    const vac = G.phase === 'clear' || G.cine;
    G.pickT -= dt; if (G.pickT <= 0) G.pickStreak = 0;
    for (const s of G.shards) {
      s.life -= dt; s.t += dt;
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (!p.dead && (d < p.magnet || vac)) { const pull = vac ? 2600 : 1500; s.vx += dx / d * pull * dt; s.vy += dy / d * pull * dt; }
      const k = Math.exp(-3.5 * dt); s.vx *= k; s.vy *= k; s.x += s.vx * dt; s.y += s.vy * dt;
      clampArena(s, 8);
      if (!p.dead && d < 20) {
        s.life = 0;
        if (s.heal) { p.hp = Math.min(p.maxHp, p.hp + 1); sfx().heal(); F.text(p.x, p.y - 36, '+1', C.green, 20, 0.9); F.ring(p.x, p.y, 8, 60, 0.4, C.green, 4); }
        else { G.runShards += s.val * p.shardMul; G.addScore(5); G.pickStreak++; G.pickT = 0.5; sfx().pickup(G.pickStreak); p.sq = Math.max(p.sq, 0.25); }
      }
    }
    for (const r of G.ripples) { r.r += 760 * dt; r.life -= dt * 1.1; }
    const alive = (arr, f) => { let j = 0; for (let i = 0; i < arr.length; i++) if (f(arr[i])) arr[j++] = arr[i]; arr.length = j; };
    alive(G.enemies, e => !e.dead); alive(G.bullets, b => !b.dead); alive(G.flies, f => f.life > 0);
    alive(G.zones, z => z.life > 0); alive(G.scars, s => s.life > 0); alive(G.shards, s => s.life > 0); alive(G.ripples, r => r.life > 0);

    if (G.comboT > 0 && (G.phase === 'fight' || G.phase === 'boss')) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    G.arenaR = L.damp(G.arenaR, G.arenaTarget, 1.2, dt);

    // run flow
    if (G.phase === 'intro') { G.phaseT -= dt; if (G.phaseT <= 0) startWave(); }
    else if (G.phase === 'fight') {
      G.pulseT += dt;
      const n = G.enemies.length;
      if (G.pending.length && (n <= 2 || G.pulseT > 11)) spawnPulse();
      else if (!G.pending.length && n === 0) G.waveCleared();
    } else if (G.phase === 'clear') {
      G.phaseT -= dt;
      if (G.phaseT <= 0) { G.phase = 'wait'; G.openPick(false); }
    }
  }

  // real-time tick: time scaling, hit-stop, camera
  G.tick = function (rdt, inp) {
    const p = G.player;
    if (!p) return;
    let dt = 0;
    if (G.hitstop > 0) G.hitstop -= rdt;
    else {
      if (G.slowT > 0) G.slowT -= rdt; else G.slow = L.damp(G.slow, 1, 7, rdt);
      dt = rdt * G.slow * (G.attract ? 1 : L.set().speed / 100);
      update(dt, inp);
      if (G.phase === 'dying') { G.phaseT -= rdt; if (G.phaseT <= 0) { G.phase = 'done'; G.endRun(); } }
    }
    G.scorePop = L.damp(G.scorePop, 0, 8, rdt);
    if (G.banner) { G.banner.t -= rdt; if (G.banner.t <= 0) G.banner = null; }
    // camera: lean toward the player, look ahead, breathe with zoom punches
    const look = p.dashing ? 0 : 0.14;
    const tx = p.x * 0.78 + p.vx * look, ty = p.y * 0.78 + p.vy * look;
    G.cam.x = L.damp(G.cam.x, tx, 5.5, rdt); G.cam.y = L.damp(G.cam.y, ty, 5.5, rdt);
    const tz = (G.boss || G.echo ? 0.9 : 1) * (G.slow < 0.9 ? 1.06 : 1) * (G.attract ? 0.92 : 1);
    G.cam.zoom = L.damp(G.cam.zoom, tz, 3, rdt);
    L.post.ca = L.damp(L.post.ca, F.trauma * 0.022 + (1 - Math.min(1, G.slow)) * 0.006, 12, rdt);
    L.post.flash = L.damp(L.post.flash, 0, 7, rdt);
    F.update(rdt, dt);
    // adaptive music: intensity follows what is on screen
    if (!G.cine && !G.attract) {
      const base = G.boss || G.echo ? 0.82 : G.phase === 'fight' ? 0.4 : 0.26;
      L.audio.target = Math.min(1, base + G.enemies.length * 0.012 + Math.min(G.combo, 30) * 0.012);
    }
    if (!p.dead && G.state === 'play') L.audio.muffle(G.slow < 0.6 ? 0.6 : 0);
  };
})();
