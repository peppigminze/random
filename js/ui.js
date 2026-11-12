'use strict';
// LUMEN — DOM menus with keyboard / gamepad / mouse / touch navigation
(function () {
  const L = window.L, G = L.game;
  const U = L.ui = { screen: '', idx: 0, stack: [], eclipseClicks: 0 };
  let root, toastEl, toastT = 0;
  const sfx = () => L.audio.sfx;
  const S = () => L.save.data;
  const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function btn(parent, html, act, o) {
    const b = el('button', 'btn' + (o && o.cls ? ' ' + o.cls : ''), html);
    b.type = 'button'; b._act = act; if (o && o.adj) b._adj = o.adj;
    b.addEventListener('click', (e) => { e.preventDefault(); L.audio.init(); focusEl(b); activate(b); });
    b.addEventListener('mouseenter', () => focusEl(b));
    parent.appendChild(b); return b;
  }
  const items = () => Array.from(root.querySelectorAll('.btn:not(.off)'));
  function focusEl(b) {
    const it = items(), i = it.indexOf(b);
    if (i < 0) return;
    if (i !== U.idx) sfx().ui();
    U.idx = i; it.forEach((x, k) => x.classList.toggle('focus', k === i));
  }
  function activate(b) { if (b._act) b._act(b); }
  function setFocus(i) { const it = items(); if (!it.length) return; U.idx = (i + it.length) % it.length; it.forEach((x, k) => x.classList.toggle('focus', k === U.idx)); it[U.idx].scrollIntoView({ block: 'nearest' }); }

  U.toast = function (msg) { toastEl.textContent = msg; toastEl.classList.add('on'); toastT = 2.6; };

  // ---------- flow ----------
  U.toTitle = function () { G.newRun({ attract: true, seed: G.randomSeed() }); G.state = 'menu'; U.stack = []; U.show('title'); };
  U.play = function (daily) {
    let seed;
    if (daily) { const d = new Date(); seed = 'D' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
    G.newRun({ seed, daily: !!daily }); G.state = 'play'; U.stack = []; U.show('');
  };
  U.pause = function () { if (G.state !== 'play' || G.player.dead) return; G.state = 'pause'; L.audio.muffle(1); U.stack = []; U.show('pause'); };
  U.resume = function () { G.state = 'play'; L.audio.muffle(0); U.show(''); };
  U.push = function (name) { U.stack.push(U.screen); U.show(name); };
  U.back = function () {
    if (U.screen === 'pause') { sfx().back(); U.resume(); return; }
    if (U.stack.length) { sfx().back(); L.save.write(); U.show(U.stack.pop()); }
  };
  function solar(toggleOnly) {
    const s = S().secret;
    if (!s.solar) { s.solar = true; s.solarOn = true; U.toast('☀ SOLAR MODE unlocked — toggle it in Settings'); }
    else if (toggleOnly) { s.solarOn = !s.solarOn; U.toast(s.solarOn ? '☀ SOLAR MODE on' : 'SOLAR MODE off'); }
    sfx().upgrade(); L.save.write();
  }

  // ---------- screens ----------
  const screens = {
    title(r) {
      const top = el('div', 'titleTop');
      const ec = el('div', 'eclipse'); ec.id = 'eclipse';
      ec.addEventListener('click', () => {
        L.audio.init(); U.eclipseClicks++; ec.classList.remove('hit'); void ec.offsetWidth; ec.classList.add('hit'); sfx().block();
        if (U.eclipseClicks % 5 === 0) { ec.classList.add('cracked'); solar(true); }
      });
      top.appendChild(ec);
      top.appendChild(el('h1', 'logo', 'LUMEN'));
      top.appendChild(el('div', 'tag', 'every light casts a shadow'));
      r.appendChild(top);
      const m = el('div', 'menu'); r.appendChild(m);
      btn(m, 'PLAY', () => { sfx().ok(); U.play(false); }, { cls: 'big' });
      btn(m, 'DAILY RUN <small>same seed for everyone today</small>', () => { sfx().ok(); U.play(true); });
      const cores = Object.keys(L.CORES).filter(k => S().cores[k]);
      const core = L.CORES[S().core] || L.CORES.spark;
      const cb = btn(m, '', (b) => cyc(1), { adj: (d) => cyc(d) });
      const paint = () => { const c = L.CORES[S().core]; cb.innerHTML = '‹ CORE · <b style="color:' + c.color + '">' + c.name + '</b> › <small>' + c.desc + '</small>'; };
      function cyc(d) { const i = cores.indexOf(S().core); S().core = cores[(i + d + cores.length) % cores.length]; L.save.write(); sfx().ui(); paint(); }
      paint();
      btn(m, 'FORGE <small>◆ ' + S().shards + ' shards</small>', () => { sfx().ok(); U.push('forge'); });
      btn(m, 'SETTINGS', () => { sfx().ok(); U.push('settings'); });
      btn(m, 'SCORES & HOW TO PLAY', () => { sfx().ok(); U.push('scores'); });
      const best = S().scores[0];
      r.appendChild(el('div', 'foot', (best ? 'BEST ' + best.score + ' · WAVE ' + best.wave + ' &nbsp;·&nbsp; ' : '') + 'WASD + SPACE · mouse · gamepad · touch'));
    },
    forge(r) {
      r.appendChild(el('h2', '', 'FORGE'));
      r.appendChild(el('div', 'sub', 'Permanent upgrades. You have <b class="cy">◆ ' + S().shards + '</b>'));
      const m = el('div', 'menu wide'); r.appendChild(m);
      for (const pm of L.PERMS) {
        const lv = L.perm(pm.id), max = pm.cost.length, cost = pm.cost[lv];
        const pips = '<span class="pips">' + '●'.repeat(lv) + '○'.repeat(max - lv) + '</span>';
        btn(m, '<span>' + pm.name + ' ' + pips + '<small>' + pm.desc + '</small></span><em>' + (lv >= max ? 'MAX' : '◆ ' + cost) + '</em>', () => {
          if (lv >= max || S().shards < cost) { sfx().deny(); return; }
          S().shards -= cost; S().perms[pm.id] = lv + 1; L.save.write(); sfx().upgrade(); const i = U.idx; U.show('forge'); setFocus(i);
        }, { cls: 'row' + (lv >= max ? ' done' : S().shards < cost ? ' poor' : '') });
      }
      for (const k of Object.keys(L.CORES)) {
        const c = L.CORES[k]; if (k === 'spark') continue;
        const own = S().cores[k];
        const label = c.secret && !own ? '<span>??? <small>Something waits behind the Eclipse.</small></span><em>LOCKED</em>'
          : '<span>Core: ' + c.name + '<small>' + c.desc + '</small></span><em>' + (own ? 'OWNED' : '◆ ' + c.cost) + '</em>';
        btn(m, label, () => {
          if (own || c.secret || S().shards < c.cost) { sfx().deny(); return; }
          S().shards -= c.cost; S().cores[k] = true; S().core = k; L.save.write(); sfx().upgrade(); const i = U.idx; U.show('forge'); setFocus(i);
        }, { cls: 'row' + (own ? ' done' : (c.secret || S().shards < c.cost) ? ' poor' : '') });
      }
      btn(m, 'BACK', () => U.back());
    },
    settings(r) {
      r.appendChild(el('h2', '', 'SETTINGS'));
      const m = el('div', 'menu wide'); r.appendChild(m);
      const st = L.set();
      const slider = (label, key, min, max, step, fmt) => {
        const b = btn(m, '', () => adj(1, true), { cls: 'row', adj: (d) => adj(d) });
        const paint = () => { const k = (st[key] - min) / (max - min); b.innerHTML = '<span>' + label + '</span><em><i class="bar"><i style="width:' + (k * 100) + '%"></i></i> ' + fmt(st[key]) + '</em>'; };
        function adj(d, wrap) { let v = st[key] + d * step; if (v > max) v = wrap ? min : max; if (v < min) v = min; st[key] = v; paint(); L.audio.applyVolume(); sfx().ui(); if (key === 'shake') L.fx.shake(0.5); }
        paint();
      };
      const toggle = (label, get, set, hint) => {
        const b = btn(m, '', () => { set(!get()); paint(); sfx().ui(); }, { cls: 'row', adj: () => { set(!get()); paint(); sfx().ui(); } });
        const paint = () => { b.innerHTML = '<span>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><em>' + (get() ? 'ON' : 'OFF') + '</em>'; };
        paint();
      };
      slider('Master volume', 'master', 0, 10, 1, v => v);
      slider('Music', 'music', 0, 10, 1, v => v);
      slider('Sound effects', 'sfx', 0, 10, 1, v => v);
      slider('Screenshake', 'shake', 0, 150, 25, v => v + '%');
      slider('Game speed', 'speed', 70, 100, 10, v => v + '%');
      toggle('Flashes & glitch effects', () => st.flash, v => st.flash = v, 'Turn off to reduce flashing');
      toggle('Bloom & lens effects', () => st.post, v => st.post = v, 'Turn off on slow machines');
      toggle('High-contrast enemies', () => st.contrast, v => st.contrast = v);
      toggle('Control hints', () => st.hints, v => st.hints = v);
      toggle('Show FPS', () => st.fps, v => st.fps = v);
      if (S().secret.solar) toggle('☀ Solar mode', () => S().secret.solarOn, v => S().secret.solarOn = v);
      let arm = false;
      const rs = btn(m, '<span>Erase all progress</span><em></em>', () => {
        if (!arm) { arm = true; rs.innerHTML = '<span>Really erase? Press again</span><em>!</em>'; sfx().deny(); return; }
        L.save.reset(); L.audio.applyVolume(); U.toast('Progress erased'); U.stack = []; U.toTitle();
      }, { cls: 'row poor' });
      btn(m, 'BACK', () => U.back());
    },
    scores(r) {
      r.appendChild(el('h2', '', 'HOW TO PLAY'));
      r.appendChild(el('div', 'help',
        '<p><b>You are the projectile.</b> Dash through enemies to cut them. Every kill refunds the dash — chain them.</p>' +
        '<p><b>Move</b> WASD / arrows / left stick &nbsp;·&nbsp; <b>Dash</b> SPACE (move direction), CLICK (toward cursor), A / RT &nbsp;·&nbsp; <b>Nova</b> E, right click, X / LT &nbsp;·&nbsp; <b>Pause</b> ESC / Start</p>' +
        '<p>While dashing you are invulnerable and you slice bullets into Nova energy. Out of charges you are just a spark.</p>'));
      r.appendChild(el('h2', '', 'BEST RUNS'));
      const list = el('div', 'scores');
      const sc = S().scores;
      list.innerHTML = sc.length ? sc.map((s, i) => '<div><span>' + (i + 1) + '</span><b>' + s.score + '</b><span>wave ' + s.wave + '</span><span>×' + (s.combo || 0) + '</span><span>' + esc((L.CORES[s.core] || {}).name || '') + '</span><span class="dim">' + esc(s.seed) + '</span></div>').join('') : '<div class="dim">No runs yet.</div>';
      r.appendChild(list);
      const st = S().stats;
      r.appendChild(el('div', 'sub', st.runs + ' runs · ' + st.kills + ' cuts · deepest wave ' + st.bestWave));
      const m = el('div', 'menu'); r.appendChild(m);
      btn(m, 'BACK', () => U.back());
    },
    pause(r) {
      r.appendChild(el('h2', '', 'PAUSED'));
      const p = G.player;
      r.appendChild(el('div', 'sub', 'WAVE ' + G.wave + ' · SEED ' + esc(G.seed) + (p.cards.length ? '<br><span class="dim">' + p.cards.map(esc).join(' · ') + '</span>' : '')));
      const m = el('div', 'menu'); r.appendChild(m);
      btn(m, 'RESUME', () => { sfx().ok(); U.resume(); }, { cls: 'big' });
      btn(m, 'SETTINGS', () => { sfx().ok(); U.push('settings'); });
      btn(m, 'RESTART', () => { sfx().ok(); U.play(G.daily); });
      btn(m, 'QUIT TO TITLE', () => { sfx().back(); U.toTitle(); });
    },
    pick(r) {
      r.appendChild(el('h2', '', G.epicPick ? 'THE SHADOW\'S GIFT' : 'CHOOSE'));
      const row = el('div', 'cards'); r.appendChild(row);
      G.choices.forEach((c, i) => {
        const own = c.kind === 'proc' && G.player.procs.find(q => q.key === c.key);
        const b = btn(row, '<i class="rar">' + c.rarity + (own ? ' · stack' : '') + '</i><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + '</span><u>' + (i + 1) + '</u>', () => {
          L.applyCard(G, c); sfx().upgrade(); L.fx.ring(G.player.x, G.player.y, 10, 140, 0.5, '#fff', 5); L.audio.muffle(0); G.afterPick(); U.show('');
        }, { cls: 'card ' + c.rarity });
        b.style.animationDelay = (i * 70) + 'ms';
      });
      const m = el('div', 'menu'); r.appendChild(m);
      if (G.rerolls > 0) btn(m, 'REROLL <small>' + G.rerolls + ' left</small>', () => { G.rerolls--; G.choices = L.genChoices(G, G.upRng); sfx().ui(); U.show('pick'); });
      U.idx = 1;
    },
    over(r) {
      r.appendChild(el('h2', 'dead', 'LIGHT OUT'));
      if (G.newBest) r.appendChild(el('div', 'newbest', 'NEW BEST'));
      r.appendChild(el('div', 'bigscore', String(G.score)));
      r.appendChild(el('div', 'stats',
        '<div><b>' + G.wave + '</b>wave</div><div><b>' + G.kills + '</b>cuts</div><div><b>×' + G.bestCombo + '</b>best chain</div><div><b class="cy">◆ ' + G.earned + '</b>shards</div>'));
      r.appendChild(el('div', 'sub dim', 'SEED ' + esc(G.seed) + (G.counters ? ' · ' + G.counters + ' counters' : '')));
      const m = el('div', 'menu'); r.appendChild(m);
      btn(m, 'AGAIN', () => { sfx().ok(); U.play(G.daily); }, { cls: 'big' });
      btn(m, 'FORGE <small>◆ ' + S().shards + '</small>', () => { sfx().ok(); U.stack = ['title']; G.newRun({ attract: true }); G.state = 'menu'; U.show('forge'); });
      btn(m, 'TITLE', () => { sfx().back(); U.toTitle(); });
    },
  };

  U.show = function (name) {
    U.screen = name; root.innerHTML = ''; root.className = name ? 'on s-' + name : '';
    document.body.classList.toggle('playing', !name);
    if (!name) return;
    U.idx = 0; U.lock = name === 'pick' || name === 'over' ? 0.45 : 0;
    const box = el('div', 'screen'); root.appendChild(box);
    screens[name](box);
    setFocus(U.idx);
  };

  U.init = function () {
    root = document.getElementById('ui'); toastEl = document.getElementById('toast');
    document.getElementById('tNova').addEventListener('touchstart', (e) => { e.preventDefault(); L.input.virt.nova = true; }, { passive: false });
    document.getElementById('tPause').addEventListener('touchstart', (e) => { e.preventDefault(); U.pause(); }, { passive: false });
  };

  U.update = function (rdt, inp) {
    if (toastT > 0) { toastT -= rdt; if (toastT <= 0) toastEl.classList.remove('on'); }
    document.body.classList.toggle('touch', L.input.isTouch);
    if (G.state === 'play') { if (inp.pause) { sfx().back(); U.pause(); } return; }
    if (!U.screen) return;
    if (U.lock > 0) U.lock -= rdt;
    const n = L.input.nav, it = items();
    if (U.screen === 'title' && L.input.typed.endsWith('solar')) { L.input.typed = ''; solar(true); }
    if (U.screen === 'pick') { for (let i = 0; i < 3; i++) if (U.lock <= 0 && L.input.pressed['Digit' + (i + 1)] && it[i]) { activate(it[i]); return; } }
    if (!it.length) return;
    const cur = it[U.idx] || it[0];
    const horiz = U.screen === 'pick';
    if (n.up || (horiz && n.left)) { setFocus(U.idx - 1); sfx().ui(); }
    else if (n.down || (horiz && n.right)) { setFocus(U.idx + 1); sfx().ui(); }
    else if (n.left && cur._adj) cur._adj(-1);
    else if (n.right && cur._adj) cur._adj(1);
    else if (n.ok && U.lock <= 0) activate(cur);
    else if (n.back) U.back();
  };
})();
