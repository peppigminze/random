'use strict';
// LUMEN — boot, main loop, autopilot (attract mode on the title screen + automated playtests)
(function () {
  const L = window.L, G = L.game, I = L.input, R = L.render, P = L.post, U = L.ui, A = L.audio, TAU = L.TAU;

  // ---------- autopilot ----------
  const bot = { cool: 0, t: 0, inp: null };
  function botInput(dt) {
    const p = G.player, inp = { mx: 0, my: 0, ax: 0, ay: 0, hasAim: false, dash: false, nova: false, mouseDash: false, pause: false };
    if (!p || p.dead) return inp;
    bot.t += dt; bot.cool -= dt;
    let fx = Math.cos(bot.t * 0.7) * 0.25, fy = Math.sin(bot.t * 0.9) * 0.25, near = 0, nearB = 0;
    for (const e of G.enemies) {
      if (e.spawnT > 0.25) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, rad = e.type === 'pyre' && e.fuse > 0 ? 210 : 170;
      if (d < rad) { const w = (rad - d) / rad; fx += dx / d * w * 2.4; fy += dy / d * w * 2.4; near++; }
      if (e.type === 'lancer' && (e.state === 'aim' || e.state === 'charge')) {
        // step out of the telegraphed line
        const ca = Math.cos(e.face), sa = Math.sin(e.face), side = (p.x - e.x) * -sa + (p.y - e.y) * ca;
        if (Math.abs(side) < 70 && (p.x - e.x) * ca + (p.y - e.y) * sa > 0) { const s = side >= 0 ? 1 : -1; fx += -sa * s * 2.2; fy += ca * s * 2.2; }
      }
    }
    for (const b of G.bullets) {
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 130) { const w = (130 - d) / 130; fx += dx / d * w * 2; fy += dy / d * w * 2; nearB++; }
    }
    const d0 = Math.hypot(p.x, p.y) || 1;
    const b = G.boss && !G.boss.dead ? G.boss : null, e = G.echo;
    if (b) {
      const want = 205, k = (want - d0) / 80;
      fx += p.x / d0 * k * 2 - p.y / d0 * 0.9; fy += p.y / d0 * k * 2 + p.x / d0 * 0.9;
      for (const q of b.pulses) if (Math.abs(q.r - d0) < 70 && p.charges > 0 && bot.cool <= 0) { inp.dash = true; inp.hasAim = true; inp.ax = (q.r < d0 ? -1 : 1) * p.x / d0; inp.ay = (q.r < d0 ? -1 : 1) * p.y / d0; bot.cool = 0.3; }
    } else if (e) { fx += -p.x / d0 * Math.min(1, d0 / 120) * 1.2; fy += -p.y / d0 * Math.min(1, d0 / 120) * 1.2; }
    else if (d0 > G.arenaR * 0.7) { const k = (d0 - G.arenaR * 0.7) / (G.arenaR * 0.3); fx -= p.x / d0 * k * 3; fy -= p.y / d0 * k * 3; }
    for (const s of G.shards) { const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 260) { fx += dx / d * 0.25; fy += dy / d * 0.25; } }
    const fl = Math.hypot(fx, fy);
    if (fl > 0.15) { inp.mx = fx / fl; inp.my = fy / fl; }

    if (!inp.dash && p.charges > 0 && !p.dashing && bot.cool <= 0) {
      const reach = p.dashDist * 0.93;
      let best = null, bestN = 0;
      for (const t of G.enemies) {
        if (t.spawnT > 0) continue;
        const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
        if (d > reach || d < 1) continue;
        if (t.type === 'warden' && Math.abs(L.angDiff(Math.atan2(-dy, -dx), t.face)) < 1.35) continue;
        if (t.type === 'pyre' && t.fuse > 0) continue;
        const ux = dx / d, uy = dy / d, ex = p.x + ux * p.dashDist, ey = p.y + uy * p.dashDist;
        if (Math.hypot(ex, ey) > G.arenaR - 30) continue;
        let n = 0, bad = 0;
        for (const o of G.enemies) {
          if (o.spawnT > 0) continue;
          if (L.segDist2(o.x, o.y, p.x, p.y, ex, ey) < (o.r + p.dashW) ** 2) n += o.type === 'pyre' ? 0.6 : 1;
          else if (Math.hypot(o.x - ex, o.y - ey) < 70) bad++;
        }
        n -= bad * 0.4;
        if (n > bestN) { bestN = n; best = [ux, uy]; }
      }
      if (b && b.inv <= 0 && b.intro <= 0) {
        const a = Math.atan2(p.y - b.y, p.x - b.x), sh = L.boss.shielded;
        if (d0 < p.dashDist + 20 && !sh(b, a) && !sh(b, a + 0.16) && !sh(b, a - 0.16)) { best = [-p.x / d0, -p.y / d0]; bestN = 9; }
      }
      if (e && e.inv <= 0 && !e.dashing) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d < reach && d > 30) { best = [dx / d, dy / d]; bestN = 9; }
      }
      if (best && bestN >= 0.6) { inp.dash = true; inp.hasAim = true; inp.ax = best[0]; inp.ay = best[1]; bot.cool = G.attract ? L.r(0.16, 0.42) : L.r(0.08, 0.2); }
      else if (nearB >= 3 && fl > 0.15) { inp.dash = true; bot.cool = 0.5; }
    }
    if (p.energy >= 1 && (near >= 4 || nearB >= 7)) inp.nova = true;
    return inp;
  }
  L.botInput = botInput;

  // headless simulation for automated tests: n fixed frames, optionally driven by the autopilot
  L.step = function (n, dt, useBot) {
    const idle = { mx: 0, my: 0, ax: 0, ay: 0, hasAim: false, dash: false, nova: false, mouseDash: false, pause: false };
    for (let i = 0; i < n; i++) { if (G.state !== 'play') break; G.tick(dt || 1 / 60, useBot ? botInput(dt || 1 / 60) : idle); }
    return { state: G.state, wave: G.wave, score: G.score, hp: G.player.hp, enemies: G.enemies.length, time: +G.time.toFixed(1) };
  };

  // ---------- loop ----------
  let last = 0, scene, view;
  const perf = L.perf = { frames: 0, slow: 0, worst: 0, sum: 0 };
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000; last = now;
    const rdt = Math.min(0.05, Math.max(0.001, raw));
    R.fps = L.lerp(R.fps, 1 / rdt, 0.05);
    perf.frames++; perf.sum += raw; if (raw > 0.02) perf.slow++; if (raw < 1 && raw > perf.worst) perf.worst = raw;
    const inp = I.poll(rdt);
    U.update(rdt, inp);
    if (G.state === 'play') G.tick(rdt, L.useBot ? botInput(rdt) : inp);
    else if (G.state === 'menu') G.tick(rdt, botInput(rdt));
    else if (G.state === 'over') { L.fx.update(rdt, rdt * 0.3); P.flash = L.damp(P.flash, 0, 7, rdt); }
    if (G.state === 'menu') { A.target = 0.12; }
    else if (G.state === 'pause' || G.state === 'pick') A.target = Math.min(A.target, 0.35);
    A.update(rdt);
    R.draw();
    if (P.ok) P.render(scene, now / 1000);
    I.endFrame();
  }

  function boot() {
    scene = document.getElementById('scene'); view = document.getElementById('view');
    R.init(scene);
    if (!P.init(view)) document.body.classList.add('nopost');
    const fit = () => { R.resize(); view.width = R.W; view.height = R.H; };
    fit(); window.addEventListener('resize', fit);
    I.attach(document.getElementById('stage'));
    U.init();
    U.toTitle();
    document.addEventListener('visibilitychange', () => { if (document.hidden) U.pause(); });
    window.addEventListener('blur', () => U.pause());
    const q = new URLSearchParams(location.search);
    if (q.has('bot')) { L.useBot = true; G.autoPick = true; U.play(false); if (q.has('god')) G.god = true; }
    last = performance.now();
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
