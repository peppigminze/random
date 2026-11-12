'use strict';
// LUMEN — Canvas 2D world + HUD (the result is fed through the WebGL post chain)
(function () {
  const L = window.L, G = L.game, F = L.fx, C = L.PAL, TAU = L.TAU;
  const R = L.render = { W: 0, H: 0, s: 1, ratio: 1, fps: 60 };
  let cv, c, stars = [];

  R.init = function (canvas) {
    cv = canvas; c = cv.getContext('2d', { alpha: false });
    const r = new L.RNG(77);
    for (let i = 0; i < 150; i++) stars.push({ x: r.next(), y: r.next(), z: r.range(0.15, 1), p: r.range(0, TAU) });
    R.resize();
  };
  R.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    let ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w * h * ratio * ratio > 2.2e6) ratio = Math.sqrt(2.2e6 / (w * h)); // cap fill rate for stable 60 fps
    R.ratio = ratio; R.W = cv.width = Math.max(320, Math.round(w * ratio)); R.H = cv.height = Math.max(200, Math.round(h * ratio));
    R.s = Math.min(R.H / 800, R.W / 1150);
  };
  R.toWorld = function (mx, my) {
    const k = R.s * G.cam.zoom;
    return { x: G.cam.x + (mx * R.ratio - R.W / 2) / k, y: G.cam.y + (my * R.ratio - R.H / 2) / k };
  };

  const poly = (pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
  const ngon = (n, r, o) => { c.beginPath(); for (let i = 0; i < n; i++) { const a = (o || 0) + i * TAU / n; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };

  function disp(x, y, out) {
    let ox = 0, oy = 0;
    for (const r of G.ripples) {
      const dx = x - r.x, dy = y - r.y, d = Math.sqrt(dx * dx + dy * dy) || 1, w = Math.abs(d - r.r);
      if (w < 110) { const k = r.amp * r.life * (1 - w / 110); ox += dx / d * k; oy += dy / d * k; }
    }
    out[0] = x + ox; out[1] = y + oy;
  }
  function drawArena() {
    const Rr = G.arenaR, danger = G.arenaTarget < 600;
    const g = c.createRadialGradient(0, 0, 40, 0, 0, Rr);
    g.addColorStop(0, '#15123a'); g.addColorStop(0.7, C.floor); g.addColorStop(1, '#0a0818');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, Rr, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(0, 0, Rr, 0, TAU); c.clip();
    c.strokeStyle = C.grid; c.lineWidth = 1.6; c.globalAlpha = 0.55;
    const step = 62, n = Math.ceil(Rr / step), o = [0, 0], any = G.ripples.length > 0;
    c.beginPath();
    for (let i = -n; i <= n; i++) {
      const v = i * step, ext = Math.sqrt(Math.max(0, Rr * Rr - v * v)) + 20;
      if (!any) { c.moveTo(v, -ext); c.lineTo(v, ext); c.moveTo(-ext, v); c.lineTo(ext, v); continue; }
      for (let j = -n; j <= n; j++) { disp(v, j * step, o); c[j === -n ? 'moveTo' : 'lineTo'](o[0], o[1]); }
      for (let j = -n; j <= n; j++) { disp(j * step, v, o); c[j === -n ? 'moveTo' : 'lineTo'](o[0], o[1]); }
    }
    c.stroke();
    c.restore();
    c.globalAlpha = 0.22; c.strokeStyle = danger ? C.red : C.wall; c.lineWidth = 22;
    c.beginPath(); c.arc(0, 0, Rr + 8, 0, TAU); c.stroke();
    c.globalAlpha = 1; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, Rr, 0, TAU); c.stroke();
  }

  function drawTelegraphs() {
    c.lineCap = 'round';
    for (const e of G.enemies) {
      if (e.spawnT > 0) {
        const k = Math.min(1, e.spawnT / 0.75);
        c.globalAlpha = 0.9 - k * 0.6; c.strokeStyle = e.color; c.lineWidth = 2.5;
        c.beginPath(); c.arc(e.x, e.y, e.r * (1 + k * 2.6), 0, TAU); c.stroke();
        c.globalAlpha = 0.5; c.fillStyle = e.color; c.beginPath(); c.arc(e.x, e.y, 3, 0, TAU); c.fill();
        continue;
      }
      if (e.type === 'lancer' && e.state === 'aim') {
        const k = 1 - e.st / 0.62, lock = e.st < 0.16;
        c.globalAlpha = 0.25 + k * 0.6; c.strokeStyle = lock ? '#fff' : e.color; c.lineWidth = lock ? 5 : 2;
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + Math.cos(e.face) * 440, e.y + Math.sin(e.face) * 440); c.stroke();
      }
      if (e.type === 'pyre' && e.fuse > 0) {
        c.globalAlpha = 0.16 + 0.14 * Math.sin(G.time * 40); c.fillStyle = '#ffb23d';
        c.beginPath(); c.arc(e.x, e.y, 128, 0, TAU); c.fill();
        c.globalAlpha = 0.8; c.strokeStyle = '#ffb23d'; c.lineWidth = 2; c.stroke();
      }
      if (e.type === 'seer' && e.cd < 0.55) {
        c.globalAlpha = 0.9; c.strokeStyle = '#fff'; c.lineWidth = 2;
        c.beginPath(); c.arc(e.x, e.y, e.r + 4 + e.cd * 50, 0, TAU); c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  const tints = {};
  function tint(col) { // dark body with a hint of the outline colour
    if (tints[col]) return tints[col];
    const n = parseInt(col.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return tints[col] = 'rgb(' + Math.round(14 + r * 0.24) + ',' + Math.round(8 + g * 0.24) + ',' + Math.round(22 + b * 0.24) + ')';
  }
  function drawEnemy(e) {
    const hc = L.set().contrast;
    c.save(); c.translate(e.x, e.y);
    const fl = e.flash > 0.01;
    c.fillStyle = fl ? '#fff' : hc ? e.color : tint(e.color);
    c.strokeStyle = fl ? '#fff' : hc ? '#fff' : e.color; c.lineWidth = hc ? 3.5 : 3; c.lineJoin = 'round';
    const r = e.r;
    switch (e.type) {
      case 'mote': c.rotate(e.t * 2.2); poly([r * 1.15, 0, 0, r * 0.8, -r * 1.15, 0, 0, -r * 0.8]); c.fill(); c.stroke(); break;
      case 'mite': c.rotate(e.face); poly([r * 1.4, 0, -r, r * 0.9, -r, -r * 0.9]); c.fill(); c.stroke(); break;
      case 'lancer': {
        c.rotate(e.face);
        if (e.state === 'aim') { const j = (1 - e.st / 0.62) * 3; c.translate(L.r(-j, j), L.r(-j, j)); }
        if (e.state === 'charge') c.scale(1.5, 0.7);
        if (e.state === 'stun') c.globalAlpha = 0.6;
        poly([r * 1.7, 0, -r, r * 0.85, -r * 0.4, 0, -r, -r * 0.85]); c.fill(); c.stroke(); break;
      }
      case 'seer': {
        ngon(6, r, e.t * 0.5); c.fill(); c.stroke();
        c.fillStyle = e.cd < 0.55 ? '#fff' : e.color;
        c.beginPath(); c.arc(Math.cos(e.face) * r * 0.35, Math.sin(e.face) * r * 0.35, r * 0.3, 0, TAU); c.fill(); break;
      }
      case 'warden': {
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
        c.strokeStyle = fl ? '#fff' : '#ffe0fb'; c.lineWidth = 6; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, r + 8, e.face - 1.15, e.face + 1.15); c.stroke(); break;
      }
      case 'cell': {
        const w = 1 + Math.sin(e.t * 4) * 0.07; c.scale(w, 2 - w);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = e.color;
        for (let i = 0; i < 3; i++) { const a = e.t + i * TAU / 3; c.beginPath(); c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 4, 0, TAU); c.fill(); }
        break;
      }
      case 'pyre': {
        if (e.fuse > 0 && Math.sin(G.time * 45) > 0) { c.fillStyle = '#fff'; c.strokeStyle = '#fff'; }
        const s = 1 + Math.sin(e.t * 6) * 0.08; c.scale(s, s); c.rotate(e.t);
        c.beginPath();
        for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? r * 0.7 : r * 1.2; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath(); c.fill(); c.stroke(); break;
      }
    }
    c.restore();
  }

  function drawBoss(b) {
    const cfg = L.boss.PH[b.phase], t = G.time;
    c.lineCap = 'butt';
    // lasers
    for (const a of b.lasers) {
      const ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath(); c.moveTo(b.x + ca * b.ringR, b.y + sa * b.ringR); c.lineTo(b.x + ca * 900, b.y + sa * 900);
      if (b.laserOn) {
        c.globalAlpha = 0.55; c.strokeStyle = C.red; c.lineWidth = 30 + Math.sin(t * 50) * 4; c.stroke();
        c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 9; c.stroke();
      } else { c.globalAlpha = 0.25 + b.tele * 0.6 * (0.6 + 0.4 * Math.sin(t * 40)); c.strokeStyle = C.red; c.lineWidth = 2 + b.tele * 3; c.stroke(); }
    }
    for (const q of b.pulses) {
      c.globalAlpha = 0.85; c.strokeStyle = C.red; c.lineWidth = 16; c.beginPath(); c.arc(b.x, b.y, q.r, 0, TAU); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
    }
    c.globalAlpha = 1;
    c.save(); c.translate(b.x, b.y);
    // corona
    c.globalCompositeOperation = 'lighter';
    const tele = b.tele, cr = b.r * (1 + tele * 0.12);
    c.strokeStyle = tele > 0 ? C.red : C.violet; c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 0; i < 36; i++) {
      const a = i * TAU / 36 + t * 0.2, len = 10 + 14 * (0.5 + 0.5 * Math.sin(i * 12.9 + t * 3)) + tele * 26 + b.flash * 30;
      c.moveTo(Math.cos(a) * cr, Math.sin(a) * cr); c.lineTo(Math.cos(a) * (cr + len), Math.sin(a) * (cr + len));
    }
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = b.flash > 0.3 ? '#fff' : '#030108'; c.beginPath(); c.arc(0, 0, cr, 0, TAU); c.fill();
    c.strokeStyle = tele > 0 ? '#ffd0d8' : '#fff'; c.lineWidth = 3 + tele * 3; c.stroke();
    // shield ring
    const blink = b.inv > 0 && Math.sin(t * 40) > 0;
    c.lineCap = 'round'; c.lineWidth = 10;
    c.strokeStyle = b.flash > 0.2 ? '#fff' : C.violet; c.globalAlpha = blink ? 0.35 : b.open > 0 ? 0.6 : 1;
    for (let i = 0; i < cfg.segs; i++) {
      const a = b.rot + i * TAU / cfg.segs;
      c.beginPath(); c.arc(0, 0, b.ringR, a - cfg.arc / 2 + 0.05, a + cfg.arc / 2 - 0.05); c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  function drawEcho(e) {
    const t = G.time;
    // the mirror rule, drawn faintly so it can be read
    c.globalAlpha = 0.16; c.strokeStyle = C.shadow; c.lineWidth = 2; c.setLineDash([10, 14]);
    c.beginPath();
    if (e.sym === 1) { c.moveTo(0, -G.arenaR); c.lineTo(0, G.arenaR); }
    else if (e.sym === 2) { c.moveTo(-G.arenaR, 0); c.lineTo(G.arenaR, 0); }
    else c.arc(0, 0, 26, 0, TAU);
    c.stroke(); c.setLineDash([]);
    for (const s of G.scars) {
      const k = s.life / s.max, armed = s.arm <= 0;
      c.globalAlpha = armed ? 0.75 * k + 0.1 : 0.25; c.strokeStyle = armed ? C.shadow : '#5a4a8a'; c.lineWidth = armed ? 12 * k + 3 : 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
      if (armed) { c.globalAlpha = k; c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
    }
    const n = e.decoy >= 0 ? 2 : 1;
    for (let i = n - 1; i >= 0; i--) {
      const b = e.bodies[i]; if (b.x === undefined) continue;
      const ghost = e.inv > 0 && Math.sin(t * 50) > 0;
      c.globalAlpha = (i ? 0.4 : 1) * (ghost ? 0.3 : 1);
      if (i === 0) {
        c.strokeStyle = C.shadow; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
        for (let k = 0; k < e.trail.length; k += 2) c[k ? 'lineTo' : 'moveTo'](e.trail[k], e.trail[k + 1]);
        c.globalAlpha *= 0.5; c.stroke(); c.globalAlpha *= 2;
        if (e.tele > 0) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, 14 + (1 - e.tele) * 30, 0, TAU); c.stroke(); }
      }
      c.fillStyle = b.dash || e.flash > 0.2 ? '#fff' : '#0b0514'; c.strokeStyle = b.dash ? '#fff' : C.shadow; c.lineWidth = 4;
      c.beginPath(); c.arc(b.x, b.y, b.dash ? 14 : 11, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = C.shadow; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, 19 + Math.sin(t * 6 + i) * 2, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
  }

  function drawPlayer(p) {
    if (p.dead) return;
    const t = G.time;
    // trail
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.strokeStyle = p.color;
    const T = p.trail;
    for (let i = 1; i < T.length; i++) {
      const k = i / T.length;
      c.globalAlpha = k * 0.7; c.lineWidth = k * p.r * 1.7;
      c.beginPath(); c.moveTo(T[i - 1].x, T[i - 1].y); c.lineTo(T[i].x, T[i].y); c.stroke();
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const blink = p.inv > 0 && !p.dashing && Math.sin(t * 46) > 0;
    c.save(); c.translate(p.x, p.y);
    // charge pips orbit the spark: the most important number in the game sits where the eyes are
    const n = p.maxCharges, pr = 24, shake = p.fizz > 0 ? Math.sin(t * 90) * 3 : 0;
    c.lineWidth = 3.5; c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * TAU / n + 0.22, a1 = -Math.PI / 2 + (i + 1) * TAU / n - 0.22;
      c.globalAlpha = 0.22; c.strokeStyle = p.fizz > 0 ? C.red : p.color;
      c.beginPath(); c.arc(shake, 0, pr, a0, a1); c.stroke();
      const fill = i < p.charges ? 1 : i === p.charges ? p.rech / p.rechTime : 0;
      if (fill > 0) { c.globalAlpha = i < p.charges ? 1 : 0.55; c.strokeStyle = i < p.charges ? '#fff' : p.color; c.beginPath(); c.arc(shake, 0, pr, a0, a0 + (a1 - a0) * fill); c.stroke(); }
    }
    if (p.energy >= 1) { c.globalAlpha = 0.5 + 0.4 * Math.sin(t * 8); c.strokeStyle = C.cyan; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 31 + Math.sin(t * 8) * 2, 0, TAU); c.stroke(); }
    c.globalAlpha = blink ? 0.35 : 1;
    c.rotate(p.face);
    // aim chevron
    c.strokeStyle = p.color; c.lineWidth = 2.5; c.beginPath(); c.moveTo(33, -5); c.lineTo(39, 0); c.lineTo(33, 5); c.stroke();
    const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 500), sq = p.dashing ? 1 : p.sq * 0.6 + sp * 0.25;
    c.scale(1 + sq * 0.9, 1 - sq * 0.4);
    c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, p.r + 2.5, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, p.r - 2.5, 0, TAU); c.fill();
    c.restore(); c.globalAlpha = 1;
  }

  function drawWorld() {
    const p = G.player;
    drawArena();
    for (const z of G.zones) {
      const k = Math.min(1, z.life / 0.4);
      c.globalAlpha = 0.2 * k; c.fillStyle = '#ff8a3d'; c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.fill();
      c.globalAlpha = 0.8 * k; c.strokeStyle = '#ff8a3d'; c.lineWidth = 2; c.stroke();
    }
    c.globalAlpha = 1;
    drawTelegraphs();
    for (const s of G.shards) {
      c.save(); c.translate(s.x, s.y); c.rotate(s.t * 3);
      if (s.life < 3 && Math.sin(s.life * 20) > 0) c.globalAlpha = 0.3;
      if (s.heal) { c.fillStyle = C.green; c.fillRect(-7, -2.5, 14, 5); c.fillRect(-2.5, -7, 5, 14); }
      else { c.fillStyle = C.cyan; poly([5, 0, 0, 7, -5, 0, 0, -7]); c.fill(); }
      c.restore();
    }
    if (G.echo) drawEcho(G.echo);
    for (const e of G.enemies) if (e.spawnT <= 0) drawEnemy(e);
    if (G.boss) drawBoss(G.boss);
    for (const b of G.bullets) {
      c.globalAlpha = b.arm > 0 ? 0.35 : 1;
      c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.r + 1.5, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.5, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    c.strokeStyle = C.gold; c.lineWidth = 3; c.lineCap = 'round';
    for (const f of G.flies) {
      c.beginPath(); for (let k = 0; k < f.trail.length; k += 2) c[k ? 'lineTo' : 'moveTo'](f.trail[k], f.trail[k + 1]); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(f.x, f.y, 3.5, 0, TAU); c.fill();
    }
    if (p) drawPlayer(p);
    F.draw(c);
    F.drawTexts(c);
    if (G.mut && G.mut.id === 'dark' && p) {
      const g = c.createRadialGradient(p.x, p.y, 170, p.x, p.y, 400);
      g.addColorStop(0, 'rgba(3,2,8,0)'); g.addColorStop(1, 'rgba(3,2,8,0.95)');
      c.fillStyle = g; c.fillRect(p.x - 2200, p.y - 2200, 4400, 4400);
    }
  }

  // ---------- HUD ----------
  const sp = (v) => { if ('letterSpacing' in c) c.letterSpacing = v + 'px'; };
  function drawHUD() {
    const p = G.player, W = R.W, H = R.H, u = Math.max(0.75, Math.min(R.H / 800, R.W / 1000)), t = G.time;
    const font = (sz, wgt) => { c.font = (wgt || 600) + ' ' + Math.round(sz * u) + 'px ' + L.FONT; };
    c.textBaseline = 'middle';
    // low health pulse
    if (p.hp === 1 && !p.dead) {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
      g.addColorStop(0, 'rgba(255,40,80,0)'); g.addColorStop(1, 'rgba(255,40,80,' + (0.2 + 0.1 * Math.sin(t * 5)) + ')');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    // hearts
    const hx = 28 * u, hy = 34 * u;
    for (let i = 0; i < p.maxHp; i++) {
      c.save(); c.translate(hx + i * 30 * u, hy); c.rotate(Math.PI / 4);
      const s = 9 * u * (i < p.hp && p.hp === 1 ? 1 + 0.15 * Math.sin(t * 10) : 1);
      c.strokeStyle = i < p.hp ? C.red : C.dim; c.lineWidth = 2.5 * u;
      if (i < p.hp) { c.fillStyle = C.red; c.fillRect(-s, -s, s * 2, s * 2); }
      c.strokeRect(-s, -s, s * 2, s * 2); c.restore();
    }
    // nova energy
    const ew = 150 * u, ey = hy + 28 * u, full = p.energy >= 1;
    c.fillStyle = 'rgba(94,242,255,0.15)'; c.fillRect(hx - 9 * u, ey, ew, 6 * u);
    c.fillStyle = full ? (Math.sin(t * 10) > 0 ? '#fff' : C.cyan) : C.cyan; c.fillRect(hx - 9 * u, ey, ew * p.energy, 6 * u);
    c.textAlign = 'left'; font(12, 700); sp(2); c.fillStyle = full ? C.cyan : C.dim;
    c.fillText(full ? 'NOVA READY' : 'NOVA', hx - 9 * u, ey + 19 * u);
    // score + chain
    c.textAlign = 'right'; sp(2);
    font(36 * (1 + G.scorePop * 0.18), 700); c.fillStyle = '#fff'; c.fillText(String(G.score), W - 28 * u, 40 * u);
    font(14, 700); c.fillStyle = C.cyan; c.fillText('◆ ' + Math.floor(G.runShards), W - 28 * u, 72 * u);
    if (G.combo > 1) {
      font(20 + Math.min(10, G.combo * 0.4), 700); c.fillStyle = C.gold;
      c.fillText('×' + G.combo + ' CHAIN', W - 28 * u, 102 * u);
      c.fillStyle = C.gold; c.globalAlpha = 0.8;
      const bw = 110 * u * L.clamp(G.comboT / 2.8, 0, 1); c.fillRect(W - 28 * u - bw, 120 * u, bw, 3 * u); c.globalAlpha = 1;
    }
    // wave / boss
    c.textAlign = 'center';
    const boss = G.boss && !G.boss.dead ? G.boss : null, echo = G.echo;
    if (boss || echo) {
      const o = boss || echo, bw = Math.min(460 * u, W * 0.5), bx = W / 2 - bw / 2, by = 46 * u, n = o.maxHp, col = boss ? C.violet : C.shadow;
      font(15, 700); sp(6); c.fillStyle = '#fff';
      c.fillText(boss ? 'THE ECLIPSE' + ['', ' · II', ' · III'][boss.phase] : 'ECHO', W / 2, 26 * u);
      for (let i = 0; i < n; i++) {
        const x = bx + i * bw / n;
        c.fillStyle = i < o.hp ? (o.flash > 0.2 ? '#fff' : col) : 'rgba(255,255,255,0.12)';
        c.fillRect(x + 2 * u, by, bw / n - 4 * u, 9 * u);
      }
    } else if (G.wave > 0) {
      font(14, 700); sp(5); c.fillStyle = C.dim; c.fillText('WAVE ' + G.wave + (G.depth > 1 ? '  ·  DEPTH ' + G.depth : ''), W / 2, 28 * u);
      if (G.mut) { font(13, 700); c.fillStyle = C.orange; c.fillText(G.mut.name, W / 2, 48 * u); }
    }
    // banner
    const b = G.banner;
    if (b) {
      const k = Math.min(1, (b.max - b.t) / 0.25), out = Math.min(1, b.t / 0.4), a = Math.min(k, out);
      c.globalAlpha = a; const y = H * 0.27 - (1 - L.ease.outCubic(k)) * 30 * u;
      const big = b.title.length > 20 ? 34 : 56;
      font(big, 700); sp(10 + (1 - out) * 14); c.fillStyle = '#fff'; c.fillText(b.title, W / 2, y);
      if (b.sub) { font(17, 600); sp(3); c.fillStyle = C.gold; c.fillText(b.sub, W / 2, y + (big * 0.5 + 22) * u); }
      c.globalAlpha = 1;
    }
    // first-run hint
    if (L.set().hints && L.save.data.stats.runs === 0 && G.wave <= 2 && !p.dead) {
      font(15, 600); sp(2); c.fillStyle = 'rgba(255,255,255,0.7)';
      const kb = L.input.isTouch ? 'Left thumb: move  ·  Tap right: dash  ·  Swipe right: aimed dash'
        : L.input.hasPad ? 'Stick: move  ·  A / RT: dash  ·  X / LT: nova'
        : 'WASD: move  ·  SPACE or CLICK: dash through enemies  ·  E: nova';
      c.fillText(kb, W / 2, H - 46 * u);
      font(13, 600); c.fillStyle = C.gold; c.fillText('Every kill refunds your dash. Chain them.', W / 2, H - 24 * u);
    }
    sp(0);
    if (L.set().fps) { c.textAlign = 'left'; font(12, 600); c.fillStyle = C.dim; c.fillText(Math.round(R.fps) + ' fps · ' + G.enemies.length + ' e · ' + F.parts.length + ' p', 14 * u, H - 16 * u); }
    // touch stick
    const st = L.input.stick;
    if (st.id >= 0) {
      const r = R.ratio;
      c.globalAlpha = 0.35; c.strokeStyle = '#fff'; c.lineWidth = 2 * u; c.beginPath(); c.arc(st.ox * r, st.oy * r, 56 * r, 0, TAU); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc((st.ox + st.x * 56) * r, (st.oy + st.y * 56) * r, 22 * r, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
  }

  R.draw = function () {
    const W = R.W, H = R.H, cam = G.cam, t = F.t;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    // parallax stars
    for (const s of stars) {
      let x = (s.x * W - cam.x * s.z * 0.25 * R.s) % W, y = (s.y * H - cam.y * s.z * 0.25 * R.s) % H;
      if (x < 0) x += W; if (y < 0) y += H;
      c.globalAlpha = 0.25 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(t * 1.5 + s.p));
      c.fillStyle = s.z > 0.8 ? '#cfd6ff' : '#7a74c9';
      const sz = (1 + s.z * 1.6) * R.ratio; c.fillRect(x, y, sz, sz);
    }
    c.globalAlpha = 1;
    if (!G.player) return;
    const k = R.s * cam.zoom * (1 + F.zoom);
    c.translate(W / 2, H / 2); c.rotate(F.srot); c.scale(k, k); c.translate(-cam.x + F.sx, -cam.y + F.sy);
    drawWorld();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!G.attract) drawHUD();
  };
})();
