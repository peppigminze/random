'use strict';
// LUMEN — content rules: enemy table, seeded wave generator, procedural upgrade generator, meta progression
(function () {
  const L = window.L, C = L.PAL;

  L.ENEMY = {
    mote:   { r: 13, hp: 1, speed: 105, score: 10, shards: 1, color: C.pink,    cost: 1,   from: 1 },
    mite:   { r: 8,  hp: 1, speed: 190, score: 5,  shards: 0, color: '#ff7aa8', cost: 0.5, from: 99 },
    lancer: { r: 14, hp: 1, speed: 125, score: 30, shards: 2, color: C.orange,  cost: 3,   from: 2 },
    seer:   { r: 16, hp: 2, speed: 80,  score: 35, shards: 3, color: C.violet,  cost: 3.5, from: 3 },
    pyre:   { r: 15, hp: 1, speed: 88,  score: 20, shards: 2, color: '#ffb23d', cost: 2,   from: 4 },
    warden: { r: 18, hp: 1, speed: 74,  score: 45, shards: 3, color: '#ff5cf0', cost: 4,   from: 5 },
    cell:   { r: 22, hp: 1, speed: 60,  score: 30, shards: 2, color: '#ff6b5c', cost: 4,   from: 6 },
  };

  L.MUTATORS = [
    { id: 'swarm',    name: 'SWARM',    desc: 'Twice as many, half as tough' },
    { id: 'haste',    name: 'HASTE',    desc: 'Everything moves faster' },
    { id: 'barrage',  name: 'BARRAGE',  desc: 'Seers fire far more often' },
    { id: 'dark',     name: 'UMBRAL',   desc: 'You only see what your light reaches' },
    { id: 'volatile', name: 'VOLATILE', desc: 'The dead burst into sparks' },
    { id: 'gilded',   name: 'GILDED',   desc: 'More enemies, double shards' },
  ];

  // A wave = a few pulses; each pulse = groups of enemies with a formation. Positions are resolved at spawn time.
  L.genWave = function (w, depth, rng) {
    const types = Object.keys(L.ENEMY).filter(k => L.ENEMY[k].from <= w);
    let mut = null;
    if (w >= 3 && w % 10 !== 0 && rng.chance(w > 10 ? 0.6 : 0.4)) mut = rng.pick(L.MUTATORS);
    let budget = (5 + w * 2.5) * (1 + (depth - 1) * 0.55);
    if (mut && mut.id === 'gilded') budget *= 1.3;
    const fresh = types.filter(k => L.ENEMY[k].from === w)[0]; // a newly unlocked type always gets a showcase wave
    const special = types.filter(k => k !== 'mote');
    const feat = fresh || (special.length ? rng.pick(special) : 'mote');
    const feat2 = special.length > 1 && rng.chance(0.5) ? rng.pick(special) : feat;
    const nP = w < 3 ? 1 : w < 6 ? 2 : 3, split = [[1], [0.55, 0.45], [0.42, 0.33, 0.25]][nP - 1];
    const pulses = [];
    for (let p = 0; p < nP; p++) {
      let b = budget * split[p];
      const list = [];
      while (b > 0.4 && list.length < 22) {
        let t = rng.chance(0.5) ? (rng.chance(0.6) ? feat : feat2) : rng.chance(0.6) ? 'mote' : rng.pick(types);
        if (L.ENEMY[t].cost > b + 0.6) t = 'mote';
        if (mut && mut.id === 'swarm' && t === 'mote') { list.push('mite', 'mite'); b -= 1; continue; }
        list.push(t); b -= L.ENEMY[t].cost;
      }
      // split the pulse into 1-3 formation groups
      const groups = [], forms = ['ring', 'cluster', 'line', 'sides', 'cluster'];
      const nG = Math.min(list.length, rng.int(1, 3));
      for (let g = 0; g < nG; g++) groups.push({ form: rng.pick(forms), types: [], a: rng.range(0, L.TAU) });
      list.forEach((t, i) => groups[i % nG].types.push(t));
      pulses.push(groups);
    }
    return { pulses, mut };
  };

  // ---------- cores (play styles) & permanent upgrades ----------
  L.CORES = {
    spark: { name: 'SPARK', desc: 'Balanced. Two dash charges.', hp: 3, charges: 2, dash: 1, rech: 1, speed: 1, dmg: 1, shardMul: 1, color: C.gold },
    comet: { name: 'COMET', desc: 'One long, heavy dash that ends in a shockwave.', hp: 3, charges: 1, dash: 1.6, rech: 0.8, speed: 0.95, dmg: 2, shardMul: 1, endNova: true, cost: 350, color: '#7ad7ff' },
    umbra: { name: 'UMBRA', desc: 'Your shadow. Two hearts, three charges, +50% shards.', hp: 2, charges: 3, dash: 0.95, rech: 0.85, speed: 1.08, dmg: 1, shardMul: 1.5, color: '#b592ff', secret: true },
  };
  L.PERMS = [
    { id: 'vital',    name: 'Vitality',     desc: '+1 max heart',                         cost: [120, 420] },
    { id: 'reserve',  name: 'Reserve',      desc: '+1 dash charge',                       cost: [650] },
    { id: 'momentum', name: 'Momentum',     desc: '+8% dash range',                       cost: [60, 150, 320] },
    { id: 'magnet',   name: 'Lodestone',    desc: '+35% pickup radius',                   cost: [40, 100, 220] },
    { id: 'fortune',  name: 'Fortune',      desc: 'Rare upgrades appear more often',      cost: [80, 200, 420] },
    { id: 'reroll',   name: 'Second Guess', desc: '+1 upgrade reroll per run',            cost: [70, 180, 380] },
    { id: 'greed',    name: 'Prospector',   desc: '+15% shards',                          cost: [90, 220, 480] },
    { id: 'start',    name: 'Head Start',   desc: 'Begin every run with a random upgrade', cost: [300] },
  ];
  L.perm = (id) => L.save.data.perms[id] || 0;

  // ---------- upgrades ----------
  const STATS = [
    { id: 'charge', name: 'Twin Flame',   desc: '+1 dash charge',                     rar: 2, max: 2, ap: p => { p.maxCharges++; p.charges++; } },
    { id: 'edge',   name: 'Keen Edge',    desc: '+1 dash damage',                     rar: 2, max: 2, ap: p => { p.dmg++; } },
    { id: 'hp',     name: 'Second Heart', desc: '+1 max heart and heal 1',            rar: 1, max: 3, ap: p => { p.maxHp++; p.hp++; } },
    { id: 'wide',   name: 'Broad Blade',  desc: 'Dash cuts 45% wider',                rar: 1, max: 2, ap: p => { p.dashW *= 1.45; } },
    { id: 'grace',  name: 'Afterglow',    desc: 'Stay invulnerable longer after a dash', rar: 1, max: 2, ap: p => { p.grace += 0.16; } },
    { id: 'energy', name: 'Overflow',     desc: 'Nova charges 40% faster',            rar: 1, max: 3, ap: p => { p.energyRate *= 1.4; } },
    { id: 'range',  name: 'Long Wick',    desc: '+18% dash range',                    rar: 0, max: 4, ap: p => { p.dashDist *= 1.18; } },
    { id: 'rech',   name: 'Quick Kindle', desc: 'Dash recharges 20% faster',          rar: 0, max: 4, ap: p => { p.rechTime *= 0.8; } },
    { id: 'speed',  name: 'Lightfoot',    desc: '+10% move speed',                    rar: 0, max: 3, ap: p => { p.speed *= 1.1; } },
    { id: 'magnet', name: 'Lodestone',    desc: '+70% pickup radius',                 rar: 0, max: 2, ap: p => { p.magnet *= 1.7; } },
    { id: 'heal',   name: 'Rekindle',     desc: 'Heal 2 hearts',                      rar: 0, max: 99, need: p => p.hp < p.maxHp, ap: p => { p.hp = Math.min(p.maxHp, p.hp + 2); } },
  ];
  const TRIG = {
    kill:  { word: 'Reaper',     effs: { nova: 5, arc: 3, swarm: 4, ember: 3, still: 9 } },
    dash:  { word: 'Slipstream', effs: { nova: 2, arc: 2, swarm: 3, ember: 1 } },
    slice: { word: 'Mirror',     effs: { nova: 5, arc: 3, swarm: 3 } },
    hurt:  { word: 'Martyr',     effs: { nova: 1, swarm: 1, still: 1 } },
    combo: { word: 'Rhythm',     effs: { nova: 1, arc: 1, swarm: 1, still: 1 } },
  };
  const EFF = { nova: 'Nova', arc: 'Storm', swarm: 'Fireflies', ember: 'Ember', still: 'Stillness' };
  const RAR = ['common', 'rare', 'epic'], POW = [1, 1.6, 2.4];
  const ord = (n) => n === 1 ? 'every' : n === 2 ? 'every 2nd' : n === 3 ? 'every 3rd' : 'every ' + n + 'th';

  L.procDesc = function (c) {
    const when = {
      kill: 'On ' + ord(c.n) + ' kill', dash: 'After ' + ord(c.n) + ' dash', slice: 'On ' + ord(c.n) + ' bullet sliced',
      hurt: 'When you are hurt', combo: 'Every 8 chain',
    }[c.trig];
    const pw = c.power * (c.trig === 'hurt' ? 2 : 1);
    const what = {
      nova: 'release a shockwave', arc: 'lightning chains to ' + Math.round(2 * pw) + ' enemies',
      swarm: 'launch ' + Math.round(2 * pw) + ' seeking fireflies', ember: 'leave a burning ember (' + (1.6 * pw).toFixed(1) + 's)',
      still: 'time slows for ' + (0.7 * pw).toFixed(1) + 's',
    }[c.eff];
    return when + ': ' + what + '.';
  };

  function rarity(G, rng) {
    const f = L.perm('fortune') * 0.05 + Math.min(0.15, G.wave * 0.008) + (G.epicPick ? 0.5 : 0);
    const x = rng.next();
    return x < 0.08 + f * 0.6 ? 2 : x < 0.36 + f * 1.4 ? 1 : 0;
  }
  function genProc(G, rng) {
    const trig = rng.pick(Object.keys(TRIG)), eff = rng.pick(Object.keys(TRIG[trig].effs));
    const r = rarity(G, rng);
    const n = Math.max(1, TRIG[trig].effs[eff] - (r === 2 ? 1 : 0));
    return {
      kind: 'proc', key: trig + ':' + eff, trig, eff, n, power: POW[r], rarity: RAR[r],
      name: TRIG[trig].word + ' ' + EFF[eff],
    };
  }
  function genStat(G, rng) {
    const p = G.player, r = rarity(G, rng);
    let pool = STATS.filter(s => s.rar === r && (p.taken[s.id] || 0) < s.max && (!s.need || s.need(p)));
    if (!pool.length) pool = STATS.filter(s => s.rar === 0 && (p.taken[s.id] || 0) < s.max && (!s.need || s.need(p)));
    if (!pool.length) return null;
    const s = rng.pick(pool);
    return { kind: 'stat', key: s.id, id: s.id, name: s.name, desc: s.desc, rarity: RAR[s.rar] };
  }
  L.genChoices = function (G, rng) {
    const out = [], seen = {};
    let guard = 0;
    while (out.length < 3 && guard++ < 60) {
      const wantProc = out.length === 0 ? true : rng.chance(0.5);
      const c = wantProc ? genProc(G, rng) : genStat(G, rng);
      if (!c || seen[c.key]) continue;
      seen[c.key] = 1;
      if (c.kind === 'proc') {
        const own = G.player.procs.find(q => q.key === c.key);
        c.desc = L.procDesc(c) + (own ? ' (stacks)' : '');
      }
      out.push(c);
    }
    return out;
  };
  L.applyCard = function (G, c) {
    const p = G.player;
    if (c.kind === 'stat') {
      const s = STATS.find(x => x.id === c.id);
      s.ap(p); p.taken[s.id] = (p.taken[s.id] || 0) + 1;
    } else {
      const own = p.procs.find(q => q.key === c.key);
      if (own) { own.power += c.power * 0.7; own.n = Math.max(1, own.n - 1); }
      else p.procs.push({ key: c.key, trig: c.trig, eff: c.eff, n: c.n, power: c.power, count: 0, name: c.name });
    }
    p.cards.push(c.name);
  };
})();
