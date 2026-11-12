'use strict';
// LUMEN — keyboard, mouse, gamepad and touch folded into one input state
(function () {
  const L = window.L;
  const I = L.input = {
    keys: {}, pressed: {}, typed: '',
    mouse: { x: 0, y: 0, dash: false, nova: false },
    stick: { id: -1, ox: 0, oy: 0, x: 0, y: 0 }, act: { id: -1, sx: 0, sy: 0 },
    tDash: false, tAim: null, virt: {},
    padPrev: [], padNavT: 0, padNavDir: '', hasPad: false, isTouch: false,
    nav: { up: false, down: false, left: false, right: false, ok: false, back: false },
  };
  const wake = () => { if (L.audio) L.audio.init(); };

  window.addEventListener('keydown', (e) => {
    wake();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Tab') e.preventDefault();
    if (!e.repeat) {
      I.pressed[e.code] = true;
      if (e.key && e.key.length === 1) I.typed = (I.typed + e.key.toLowerCase()).slice(-12);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
      I.pressed['R' + e.code] = true; // key repeat is useful for menus/sliders only
    }
    I.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { I.keys[e.code] = false; });
  window.addEventListener('blur', () => { I.keys = {}; I.stick.id = -1; I.stick.x = I.stick.y = 0; });

  I.attach = function (el) {
    I.el = el;
    window.addEventListener('mousemove', (e) => { I.mouse.x = e.clientX; I.mouse.y = e.clientY; });
    el.addEventListener('mousedown', (e) => {
      wake();
      I.mouse.x = e.clientX; I.mouse.y = e.clientY;
      if (e.button === 0) I.mouse.dash = true;
      if (e.button === 2) I.mouse.nova = true;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    el.addEventListener('touchstart', (e) => {
      wake(); I.isTouch = true; e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && I.stick.id < 0) {
          I.stick.id = t.identifier; I.stick.ox = t.clientX; I.stick.oy = t.clientY; I.stick.x = I.stick.y = 0;
        } else if (I.act.id < 0) {
          I.act.id = t.identifier; I.act.sx = t.clientX; I.act.sy = t.clientY;
        }
      }
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === I.stick.id) {
          let dx = t.clientX - I.stick.ox, dy = t.clientY - I.stick.oy;
          const d = Math.hypot(dx, dy), m = 56;
          if (d > m) { dx *= m / d; dy *= m / d; }
          I.stick.x = dx / m; I.stick.y = dy / m;
        }
      }
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === I.stick.id) { I.stick.id = -1; I.stick.x = I.stick.y = 0; }
        if (t.identifier === I.act.id) {
          const dx = t.clientX - I.act.sx, dy = t.clientY - I.act.sy, d = Math.hypot(dx, dy);
          I.tDash = true;
          I.tAim = d > 34 ? { x: dx / d, y: dy / d } : null; // swipe = aimed dash, tap = dash forward
          I.act.id = -1;
        }
      }
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  };

  const DEAD = 0.24;
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    I.hasPad = !!gp;
    const out = { mx: 0, my: 0, ax: 0, ay: 0, b: {} };
    if (!gp) { I.padPrev = []; return out; }
    const ax = gp.axes;
    const dz = (x, y) => { const d = Math.hypot(x, y); if (d < DEAD) return [0, 0]; const k = Math.min(1, (d - DEAD) / (1 - DEAD)) / d; return [x * k, y * k]; };
    [out.mx, out.my] = dz(ax[0] || 0, ax[1] || 0);
    [out.ax, out.ay] = dz(ax[2] || 0, ax[3] || 0);
    const down = gp.buttons.map(b => b.pressed || b.value > 0.5);
    if (down[14]) out.mx = -1; if (down[15]) out.mx = 1; if (down[12]) out.my = -1; if (down[13]) out.my = 1;
    down.forEach((d, i) => { out.b[i] = d && !I.padPrev[i]; });
    if (down.some(Boolean) && !I.padPrev.some(Boolean)) wake();
    I.padPrev = down;
    return out;
  }

  // called once per frame; returns gameplay state and fills I.nav for menus
  I.poll = function (rdt) {
    const k = I.keys, p = I.pressed, pad = pollPad();
    let mx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    let my = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    if (pad.mx || pad.my) { mx = pad.mx; my = pad.my; }
    if (I.stick.id >= 0) { mx = I.stick.x; my = I.stick.y; }
    const st = I.state = {
      mx, my, ax: 0, ay: 0, hasAim: false,
      dash: !!(p.Space || p.KeyJ || pad.b[0] || pad.b[5] || pad.b[7] || I.tDash || I.virt.dash),
      nova: !!(p.KeyE || p.KeyK || p.KeyQ || p.ShiftLeft || p.ShiftRight || pad.b[2] || pad.b[4] || pad.b[6] || I.mouse.nova || I.virt.nova),
      pause: !!(p.Escape || p.KeyP || pad.b[9] || I.virt.pause),
      mouseDash: I.mouse.dash, mouseX: I.mouse.x, mouseY: I.mouse.y,
    };
    if (pad.ax || pad.ay) { st.ax = pad.ax; st.ay = pad.ay; st.hasAim = true; }
    if (I.tDash && I.tAim) { st.ax = I.tAim.x; st.ay = I.tAim.y; st.hasAim = true; }

    // menu navigation edges (keyboard repeat + stick repeat)
    const n = I.nav;
    n.up = !!(p.ArrowUp || p.KeyW || p.RArrowUp || p.RKeyW);
    n.down = !!(p.ArrowDown || p.KeyS || p.RArrowDown || p.RKeyS);
    n.left = !!(p.ArrowLeft || p.KeyA || p.RArrowLeft || p.RKeyA);
    n.right = !!(p.ArrowRight || p.KeyD || p.RArrowRight || p.RKeyD);
    n.ok = !!(p.Enter || p.Space || p.NumpadEnter || pad.b[0]);
    n.back = !!(p.Escape || p.Backspace || pad.b[1]);
    let dir = '';
    if (pad.my < -0.6) dir = 'up'; else if (pad.my > 0.6) dir = 'down';
    else if (pad.mx < -0.6) dir = 'left'; else if (pad.mx > 0.6) dir = 'right';
    if (dir !== I.padNavDir) { I.padNavDir = dir; I.padNavT = 0.32; if (dir) n[dir] = true; }
    else if (dir) { I.padNavT -= rdt; if (I.padNavT <= 0) { I.padNavT = 0.12; n[dir] = true; } }
    return st;
  };

  I.endFrame = function () {
    I.pressed = {}; I.mouse.dash = false; I.mouse.nova = false;
    I.tDash = false; I.tAim = null; I.virt = {};
  };
})();
