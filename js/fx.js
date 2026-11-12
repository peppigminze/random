'use strict';
// LUMEN — juice: particles, trauma-based screenshake, shock rings, slashes, lightning, floating text
(function () {
  const L = window.L;
  const F = L.fx = {
    parts: [], rings: [], slashes: [], bolts: [], texts: [],
    trauma: 0, sx: 0, sy: 0, srot: 0, kx: 0, ky: 0, zoom: 0, t: 0,
  };
  const MAXP = 1500;

  F.clear = function () { F.parts.length = F.rings.length = F.slashes.length = F.bolts.length = F.texts.length = 0; };

  // o: speed, life, size, dir, spread, drag, streak
  F.burst = function (x, y, n, color, o) {
    o = o || {};
    const sp = o.speed || 260, life = o.life || 0.5, size = o.size || 3;
    const dir = o.dir, spread = o.spread === undefined ? L.TAU : o.spread;
    for (let i = 0; i < n && F.parts.length < MAXP; i++) {
      const a = dir === undefined ? L.r(0, L.TAU) : dir + L.r(-spread / 2, spread / 2);
      const v = sp * L.r(0.25, 1);
      F.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * L.r(0.5, 1), max: life, size: size * L.r(0.6, 1.3), color,
        drag: o.drag === undefined ? 3.2 : o.drag, streak: o.streak !== false,
      });
    }
  };
  F.dot = function (x, y, color, size, life, vx, vy) {
    if (F.parts.length >= MAXP) return;
    F.parts.push({ x, y, vx: vx || 0, vy: vy || 0, life, max: life, size, color, drag: 2, streak: false });
  };
  F.ring = function (x, y, r0, r1, life, color, width) {
    F.rings.push({ x, y, r0, r1, life, max: life, color, width: width || 3 });
  };
  F.slash = function (ax, ay, bx, by, color, width) {
    F.slashes.push({ ax, ay, bx, by, life: 0.28, max: 0.28, color, width: width || 10 });
  };
  F.bolt = function (ax, ay, bx, by, color) {
    const pts = [[ax, ay]], n = Math.max(2, Math.floor(Math.hypot(bx - ax, by - ay) / 28));
    const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) {
      const t = i / n, j = L.r(-16, 16);
      pts.push([L.lerp(ax, bx, t) + nx / nl * j, L.lerp(ay, by, t) + ny / nl * j]);
    }
    pts.push([bx, by]);
    F.bolts.push({ pts, life: 0.22, max: 0.22, color: color || L.PAL.cyan });
  };
  F.text = function (x, y, str, color, size, life) {
    F.texts.push({ x, y, str, color: color || '#fff', size: size || 18, life: life || 0.9, max: life || 0.9, vy: -46 });
  };
  F.shake = function (amt) { F.trauma = Math.min(1, F.trauma + amt); };
  F.kick = function (dx, dy, amt) { F.kx += dx * amt; F.ky += dy * amt; };
  F.punch = function (z) { F.zoom = Math.max(F.zoom, z); };

  // rdt: real time (camera feel keeps moving during hit-stop), dt: game time
  F.update = function (rdt, dt) {
    F.t += rdt;
    F.trauma = Math.max(0, F.trauma - rdt * 1.5);
    const s = L.set().shake / 100, tr = F.trauma * F.trauma, t = F.t * 42;
    // smooth pseudo-noise so the shake reads as a rattle, not as static
    F.sx = (Math.sin(t * 1.13) + Math.sin(t * 2.71 + 1.3)) * 0.5 * 20 * tr * s + F.kx * s;
    F.sy = (Math.sin(t * 1.57 + 2.1) + Math.sin(t * 2.33 + 0.4)) * 0.5 * 20 * tr * s + F.ky * s;
    F.srot = Math.sin(t * 0.91 + 0.7) * 0.035 * tr * s;
    F.kx = L.damp(F.kx, 0, 14, rdt); F.ky = L.damp(F.ky, 0, 14, rdt);
    F.zoom = L.damp(F.zoom, 0, 7, rdt);

    const P = F.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const upd = (arr, d) => { for (let i = arr.length - 1; i >= 0; i--) { arr[i].life -= d; if (arr[i].life <= 0) arr.splice(i, 1); } };
    upd(F.rings, dt); upd(F.slashes, rdt); upd(F.bolts, dt);
    for (let i = F.texts.length - 1; i >= 0; i--) {
      const tx = F.texts[i]; tx.life -= rdt; tx.y += tx.vy * rdt; tx.vy *= Math.exp(-3 * rdt);
      if (tx.life <= 0) F.texts.splice(i, 1);
    }
  };

  F.draw = function (c) {
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (const s of F.slashes) {
      const k = s.life / s.max;
      c.globalAlpha = k; c.strokeStyle = s.color; c.lineWidth = s.width * k;
      c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
      c.globalAlpha = k * 0.9; c.strokeStyle = '#fff'; c.lineWidth = s.width * k * 0.3;
      c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
    }
    for (const r of F.rings) {
      const k = 1 - r.life / r.max, e = L.ease.outCubic(k);
      c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = r.color; c.lineWidth = r.width * (1 - k * 0.7);
      c.beginPath(); c.arc(r.x, r.y, L.lerp(r.r0, r.r1, e), 0, L.TAU); c.stroke();
    }
    for (const b of F.bolts) {
      const k = b.life / b.max;
      c.globalAlpha = k; c.strokeStyle = b.color; c.lineWidth = 4 * k + 1;
      c.beginPath(); c.moveTo(b.pts[0][0], b.pts[0][1]);
      for (let i = 1; i < b.pts.length; i++) c.lineTo(b.pts[i][0], b.pts[i][1]);
      c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    }
    for (const p of F.parts) {
      const k = p.life / p.max;
      c.globalAlpha = Math.min(1, k * 1.6);
      if (p.streak) {
        c.strokeStyle = p.color; c.lineWidth = p.size * (0.4 + k * 0.6);
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
      } else {
        const s = p.size * (0.3 + k * 0.7);
        c.fillStyle = p.color; c.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  };

  F.drawTexts = function (c) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of F.texts) {
      const k = t.life / t.max, pop = 1 + Math.max(0, (k - 0.8) * 5) * 0.6;
      c.globalAlpha = Math.min(1, k * 2.5);
      c.font = '700 ' + Math.round(t.size * pop) + 'px ' + L.FONT;
      c.fillStyle = t.color; c.fillText(t.str, t.x, t.y);
    }
    c.globalAlpha = 1;
  };
  L.FONT = 'Bahnschrift, "DIN Alternate", "Avenir Next Condensed", "Segoe UI", system-ui, sans-serif';
})();
