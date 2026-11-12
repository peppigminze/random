'use strict';
// LUMEN — shared helpers, seeded RNG, palette, savegame
(function () {
  const L = window.L = { TAU: Math.PI * 2 };

  L.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  L.lerp = (a, b, t) => a + (b - a) * t;
  // framerate independent smoothing
  L.damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
  L.angDiff = (a, b) => {
    let d = (a - b) % L.TAU;
    if (d > Math.PI) d -= L.TAU;
    if (d < -Math.PI) d += L.TAU;
    return d;
  };
  L.hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // squared distance from point p to segment a-b
  L.segDist2 = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t - px, cy = ay + dy * t - py;
    return cx * cx + cy * cy;
  };
  // first intersection t (0..1) of segment a-b with circle (c, r), or -1
  L.segCircle = (ax, ay, bx, by, cx, cy, r) => {
    const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
    if (a < 1e-9) return -1;
    let d = b * b - 4 * a * c;
    if (d < 0) return -1;
    d = Math.sqrt(d);
    const t1 = (-b - d) / (2 * a), t2 = (-b + d) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return t1;
    if (t2 >= 0 && t2 <= 1) return t2;
    return -1;
  };

  L.ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };

  // mulberry32
  function RNG(seed) { this.s = (seed >>> 0) || 1; }
  RNG.prototype.next = function () {
    let t = this.s += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + (b - a) * this.next(); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.weighted = function (items, wf) {
    let sum = 0; for (const it of items) sum += wf(it);
    let r = this.next() * sum;
    for (const it of items) { r -= wf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  };
  L.RNG = RNG;
  L.rnd = new RNG((Date.now() ^ 0x9e3779b9) >>> 0); // cosmetic only (particles etc.)
  L.r = (a, b) => L.rnd.range(a, b);

  L.PAL = {
    bg: '#06050d', floor: '#0d0b20', grid: '#2b2470', wall: '#6a5cff',
    gold: '#ffd76a', white: '#fff8e8', cyan: '#5ef2ff', pink: '#ff3d81',
    orange: '#ff8a3d', violet: '#a97bff', green: '#7dff9b', red: '#ff4d6d',
    bullet: '#ff6b9a', shadow: '#8a5cff', dim: '#6f6a9a',
  };

  // ---------- savegame ----------
  const KEY = 'lumen.save.v1';
  const defaults = () => ({
    shards: 0,
    perms: {},
    cores: { spark: true, comet: false, umbra: false },
    core: 'spark',
    scores: [],
    stats: { runs: 0, kills: 0, bestWave: 0, echo: 0 },
    secret: { solar: false, solarOn: false },
    settings: {
      master: 8, music: 7, sfx: 8, shake: 100, flash: true, post: true,
      speed: 100, contrast: false, fps: false, hints: true,
    },
  });
  const merge = (d, s) => {
    for (const k in s) {
      if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object') merge(d[k], s[k]);
      else d[k] = s[k];
    }
    return d;
  };
  L.save = {
    data: defaults(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) merge(this.data, JSON.parse(raw));
      } catch (e) { /* storage unavailable: play without persistence */ }
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
    reset() { this.data = defaults(); this.write(); },
  };
  L.save.load();
  L.set = () => L.save.data.settings;
})();
