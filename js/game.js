// ============================================================
//  GAME — battle engine: players, forms, demons, hazards
// ============================================================
'use strict';

// ---------------- INPUT ----------------
const Input = { keys: {}, pressed: {}, wheel: 0, click: null };
addEventListener('keydown', e => {
  if (!Input.keys[e.code]) Input.pressed[e.code] = true;
  Input.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  Audio.init();
});
addEventListener('keyup', e => { Input.keys[e.code] = false; });
addEventListener('blur', () => { Input.keys = {}; });
const pressed = (...ks) => ks.some(k => Input.pressed[k]);
const held = (...ks) => ks.some(k => Input.keys[k]);

let G = null;
const AL = 40, AR = W - 40;
const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 2);

// ---------------- ENTITIES ----------------
function makePlayer(key) {
  const ch = CHARS[key];
  return {
    key, ch, look: ch.look, x: 280, y: GY, vx: 0, vy: 0, face: 1, ground: true,
    hp: ch.hp, maxhp: ch.hp, br: ch.br, maxbr: ch.br, styleIdx: 0, formIdx: ch.styles.map(() => 0),
    cast: null, hurtT: 0, inv: 0, buffs: {}, down: false, dashT: 0, dashCd: 0, walk: 0, zen: false,
    poison: 0, sleep: 0, swing: undefined, spin: 0, ghosts: [], scale: ch.scale || 1,
  };
}
const curStyle = P => STYLES[P.ch.styles[P.styleIdx]];
const curForm = P => curStyle(P).forms[P.formIdx[P.styleIdx]];
const activeP = () => G.team[G.ai];

function makeBoss(key, x) {
  const d = BOSSES[key];
  return {
    key, def: d, x, y: GY, face: -1, hp: d.hp, maxhp: d.hp, state: 'move', st: 0, cd: 80 + rnd(0, 60), atk: null,
    walk: 0, hurt: 0, flash: 0, poison: 0, burn: 0, dead: false, deadT: 0, scale: d.minion ? 1 : (key === 'rui' ? 1.05 : 1.25),
    hw: d.w, hh: d.h, swing: 0.9, revived: 0, buffT: 0, mv: null, acc: 0, pending: 0, small: null,
  };
}

function startBattle(si) {
  const S = STAGES[si];
  const bd = BOSSES[S.boss];
  G = {
    si, S, t: 0, team: S.team.map(makePlayer), ai: 0, bosses: [], fx: [], parts: [], amb: [], eproj: [], pproj: [], haz: [], texts: [],
    shake: 0, hitstop: 0, slow: 1, slowT: 0, cutin: null, banner: null, callouts: [], dawn: 0, dawnMax: bd.dawn || 0,
    tilt: 0, tiltT: 0, over: null, overT: 0, lastSay: -999, switchCd: 0, paused: false, bossLine: null,
  };
  G.bosses.push(makeBoss(S.boss, S.boss2 ? 880 : 960));
  if (S.boss2) G.bosses.push(makeBoss(S.boss2, 1080));
  for (let i = 0; i < (S.minions || 0); i++) G.bosses.push(makeBoss('mini', 620 + i * 110));
  G.team.forEach((p, i) => { p.x = 260 - i * 6; });
  if (S.note) banner('', S.note, 300);
  Audio.setMusic(bd.final || bd.rank && bd.rank[0] === '上' ? 'boss' : 'battle');
}

// ---------------- HELPERS ----------------
function banner(jp, vn, dur) { G.banner = { jp, vn, t: 0, dur: dur || 150 }; }
function addText(x, y, s, c, size) { G.texts.push({ x, y, s, c, size: size || 22, life: 50, max: 50 }); }
function particles(theme, x, y, n, spd, opts) {
  const th = THEMES[theme] || THEMES.normal;
  for (let i = 0; i < n; i++) {
    if (G.parts.length > 700) G.parts.shift();
    const a = rnd(0, TAU), s = rnd(0.3, 1) * (spd || 5);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts && opts.up || 0), life: rnd(20, 45), max: 45, s: rnd(2, 5), c: Math.random() < 0.5 ? th.l : th.m, k: (opts && opts.k) || th.p, g: opts && opts.g !== undefined ? opts.g : 0.05 });
  }
}
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}
const bossRect = b => [b.x - b.hw / 2, b.y - b.hh, b.hw, b.hh];
const playerRect = P => [P.x - 16, P.y - 140 * P.scale, 32, 140 * P.scale];
function aliveEnemies() { return G.bosses.filter(b => !b.dead && !b.pending); }
function nearestEnemy(P) {
  let best = null, bd = 1e9;
  for (const b of aliveEnemies()) { const d = Math.abs(b.x - P.x); if (d < bd) { bd = d; best = b; } }
  return best;
}

// ---------------- DAMAGE: PLAYER -> DEMON ----------------
function newGrp(P, dmg, c, extra) {
  const f = c && c.f || {};
  return Object.assign({ hit: new Set(), dmg, P, theme: c ? c.th : 'normal', poison: f.poison, mercy: f.mercy, heavy: dmg >= 60, burn: f.burn }, extra || {});
}
function strike(grp, x, y, r) {
  for (const b of G.bosses) {
    if (b.dead) continue;
    if (b.small && b.small.hp > 0 && !grp.hit.has(b.small) && Math.hypot(b.small.x - x, b.small.y - 14 - y) < r + 20) {
      grp.hit.add(b.small); hitSmall(b, grp, x, y);
    }
    if (grp.hit.has(b)) continue;
    const [rx, ry, rw, rh] = bossRect(b);
    if (circleRect(x, y, r, rx, ry, rw, rh)) { grp.hit.add(b); damageEnemy(b, grp, clamp(x, rx, rx + rw), clamp(y, ry, ry + rh)); }
  }
}
function damageEnemy(b, grp, hx, hy) {
  const P = grp.P;
  let d = grp.dmg * rnd(0.9, 1.1), crit = false;
  if (P && P.buffs.sense && Math.random() < 0.4) { d *= 1.8; crit = true; }
  if (P && P.buffs.invis) { d *= 2; crit = true; P.buffs.invis = 0; }
  if (grp.mercy && b.hp < b.maxhp * 0.3) { d *= 3; crit = true; }
  if (b.pending) d = 0;
  b.hp -= d; b.flash = 4; b.hurt = 10;
  if (grp.poison) { b.poison = Math.min(40, b.poison + grp.poison); addText(hx, hy - 30, '毒 Độc', '#c080ff', 18); Audio.sfx.poison(); }
  if (grp.burn) b.burn = 300;
  if (G.dawnMax) G.dawn += d * 0.6;
  if (P) P.br = Math.min(P.maxbr, P.br + 1.5);
  particles(grp.theme, hx, hy, grp.heavy ? 26 : 12, grp.heavy ? 9 : 6);
  particles('demon', hx, hy, 6, 5, { k: 'blood', g: 0.3 });
  addText(hx + rnd(-20, 20), hy - 10, Math.round(d) + (crit ? '!' : ''), crit ? '#ffdd40' : '#fff', crit ? 30 : 22);
  G.hitstop = Math.max(G.hitstop, grp.heavy ? 5 : 2);
  G.shake = Math.max(G.shake, grp.heavy ? 12 : 4);
  grp.heavy ? Audio.sfx.bigHit() : Audio.sfx.hit();
  if (b.hp <= 0) checkBossDeath(b);
}
function hitSmall(b, grp, x, y) {
  const d = grp.dmg * 2.5;
  b.small.hp -= d; b.hp -= d;
  addText(b.small.x, b.small.y - 40, Math.round(d) + '!!', '#ff6080', 30);
  particles('demon', b.small.x, b.small.y - 14, 20, 7);
  Audio.sfx.bigHit(); G.hitstop = 6;
  if (b.small.hp <= 0) { b.hp = 0; checkBossDeath(b); }
}
function checkBossDeath(b) {
  const d = b.def;
  if (b.dead) return;
  if (b.hp > 0) return;
  if (G.dawnMax && G.dawn < G.dawnMax) {
    b.hp = b.maxhp * 0.15; b.regenBurst = 90;
    banner('再生する…！', 'Hắn tái sinh! Cầm cự tới bình minh!', 120); return;
  }
  if (d.trueBody && !(b.small && b.small.hp <= 0)) {
    b.hp = b.maxhp * 0.12;
    if (!b.small) b.small = { x: b.x < W / 2 ? W - 120 : 120, y: GY, hp: 360, vx: 3 };
    banner('本体を探せ！', 'Đó không phải bản thể! Chém con quỷ nhỏ 「恨」!', 150); return;
  }
  if (d.neckRegen && !b.revived) {
    b.revived = 1; b.hp = b.maxhp * 0.35;
    banner('頸を斬っても…再生する！？', 'Chém cổ rồi mà vẫn tái sinh!? Đánh tiếp!', 150); Audio.sfx.gong(); return;
  }
  if (G.S.boss2 && !d.minion) {
    const other = G.bosses.find(o => o !== b && !o.def.minion);
    if (!b.pending) { b.pending = 240; b.hp = 0; }
    if (other && (other.pending || other.dead)) { killBoss(b); killBoss(other); }
    else banner('もう一体の頸も斬れ！', 'Nhanh! Chém cổ con còn lại trong 4 giây!', 120);
    return;
  }
  killBoss(b);
}
function killBoss(b) {
  if (b.dead) return;
  b.dead = true; b.deadT = 0; b.pending = 0;
  if (!b.def.minion) {
    G.hitstop = 24; G.shake = 26;
    G.bigKanji = { s: '斬', t: 0 };
    Audio.sfx.bigHit(); setTimeout(() => Audio.sfx.gong(), 300);
    particles('demon', b.x, b.y - b.hh, 50, 12, { k: 'blood', g: 0.3 });
  }
}

// ---------------- DAMAGE: DEMON -> PLAYER ----------------
function playerVulnerable(P) {
  if (P.down || P.inv > 0 || P.dashT > 0) return false;
  if (P.buffs.evade) return false;
  if (P.cast && (P.cast.inv || (P.cast.sub && P.cast.sub.inv))) return false;
  return true;
}
function hurtPlayer(P, dmg, sx, opts) {
  if (!playerVulnerable(P)) return false;
  if (P.buffs.guard) dmg *= 0.3;
  P.hp -= dmg; P.inv = 45; P.hurtT = 16; P.cast = null; P.swing = undefined; P.spin = 0;
  P.vx = Math.sign(P.x - sx || 1) * 6; P.vy = -5;
  if (opts && opts.poison) P.poison = 360;
  if (P.sleep) P.sleep = Math.max(0, P.sleep - 0.3);
  addText(P.x, P.y - 160, '-' + Math.round(dmg), '#ff5050', 24);
  particles('demon', P.x, P.y - 80, 10, 5, { k: 'blood', g: 0.3 });
  G.shake = Math.max(G.shake, 10); Audio.sfx.hurt();
  if (P.hp <= 0) downPlayer(P);
  return true;
}
function downPlayer(P) {
  P.hp = 0; P.down = true; P.cast = null;
  const next = G.team.findIndex(p => !p.down);
  if (next < 0) { G.over = 'lose'; G.overT = 0; return; }
  banner(P.ch.name + ' 戦闘不能', P.ch.vn + ' gục ngã!', 120);
  switchTo(next, true);
}
function switchTo(i, forced) {
  if (i === G.ai || i >= G.team.length || G.team[i].down) return;
  if (!forced && G.switchCd > 0) return;
  const old = activeP(), P = G.team[i];
  P.x = old.x; P.y = old.y; P.face = old.face; P.vx = P.vy = 0; P.cast = null; P.hurtT = 0; P.inv = 40; P.sleep = old.sleep;
  G.ai = i; G.switchCd = 40;
  particles('mist', P.x, P.y - 70, 20, 4, { k: 'smoke' });
  addText(P.x, P.y - 170, P.ch.name + ' · ' + P.ch.vn.split(' — ')[0], '#fff', 18);
  Audio.sfx.select();
  sayLine(P.ch.lines.start, P.ch.voice);
}
function sayLine(text, pitch) { if (G) G.lastSay = G.t; Audio.say(text, pitch); }

// ---------------- FX ----------------
function fxSlash(P, r, a0, a1, w, theme, o) {
  o = o || {};
  const f = P.face;
  const A0 = f > 0 ? a0 : Math.PI - a0, A1 = f > 0 ? a1 : Math.PI - a1;
  const dx = (o.dx || 8) * f, dy = o.dy !== undefined ? o.dy : -82 * P.scale;
  const e = { type: 'slash', P: o.follow ? P : null, dx, dy, cx: P.x + dx, cy: P.y + dy, r, a0: A0, a1: A1, w, theme, t: 0, sweep: o.sweep || 7, fadeT: o.fade || 14, sq: o.sq || 1, grp: o.grp || null, prog: 0, fade: 1, alpha: o.alpha || 1 };
  e.life = e.sweep + e.fadeT;
  G.fx.push(e); return e;
}
function fxAt(x, y, r, a0, a1, w, theme, o) { o = o || {}; const e = { type: 'slash', cx: x, cy: y, r, a0, a1, w, theme, t: 0, sweep: o.sweep || 7, fadeT: o.fade || 14, sq: o.sq || 1, grp: o.grp || null, prog: 0, fade: 1, alpha: o.alpha || 1 }; e.life = e.sweep + e.fadeT; G.fx.push(e); return e; }
function fxRing(x, y, r, theme, life, o) { G.fx.push(Object.assign({ type: 'ring', x, y, r, theme, t: 0, life: life || 20, sq: 1, w: 8 }, o || {})); }
function fxStreak(x1, y1, x2, y2, theme, w, life) { G.fx.push({ type: 'streak', x1, y1, x2, y2, theme, w: w || 14, t: 0, life: life || 14 }); }
function fxThrust(x, y, ang, len, theme, life, w) { G.fx.push({ type: 'thrust', x, y, ang, len, theme, t: 0, life: life || 14, w: w || 16 }); }
function fxBolt(x1, y1, x2, y2, life) { G.fx.push({ type: 'bolt', x1, y1, x2, y2, t: 0, life: life || 12 }); }

function updateFx() {
  for (const e of G.fx) {
    e.t++;
    if (e.type === 'slash') {
      if (e.P) { e.cx = e.P.x + e.dx; e.cy = e.P.y + e.dy; }
      e.prog = e.t / e.sweep; e.fade = (e.t < e.sweep ? 1 : 1 - (e.t - e.sweep) / e.fadeT) * e.alpha;
      if (e.grp && e.t <= e.sweep + 1) {
        const head = Math.min(1, e.prog);
        for (let u = Math.max(0, head - 0.5); u <= head + 0.001; u += 0.125) {
          const a = e.a0 + (e.a1 - e.a0) * u, rr = e.r - e.w * 0.4;
          strike(e.grp, e.cx + Math.cos(a) * rr, e.cy + Math.sin(a) * rr * e.sq, e.w * 0.5 + 28);
        }
        if (e.t % 2 === 0) { const a = e.a0 + (e.a1 - e.a0) * head; particles(e.theme, e.cx + Math.cos(a) * e.r, e.cy + Math.sin(a) * e.r * e.sq, 2, 3); }
      }
    } else if (e.type === 'whip') {
      const P = e.P; const u = clamp((e.t - 2) / 8, 0, 1);
      const base = e.sweep ? lerp(-1.4, 0.7, u) : 0.05;
      const A = P.face > 0 ? base : Math.PI - base;
      const L = e.len * (e.sweep ? 1 : easeOut(u));
      e.pts = [];
      const hx = P.x + P.face * 18, hy = P.y - 84;
      for (let i = 0; i <= 20; i++) {
        const s = i / 20, w = Math.sin(s * 9 - e.t * 0.8) * 14 * s;
        e.pts.push([hx + Math.cos(A) * L * s - Math.sin(A) * w, hy + Math.sin(A) * L * s + Math.cos(A) * w]);
      }
      if (e.grp && e.t < 14) for (let i = 4; i <= 20; i += 4) strike(e.grp, e.pts[i][0], e.pts[i][1], 34);
    }
  }
  G.fx = G.fx.filter(e => e.t < e.life);
}

// ---------------- FORM KINDS ----------------
const ARCS = [[-1.9, 0.9], [1.0, -1.7], [-2.6, 0.7], [2.2, -0.5], [-0.9, 1.8], [0.6, -2.4], [-1.4, 1.4], [1.6, -1.2]];
function setSwing(P, a0, a1, u) { P.swing = lerp(a0, a1, clamp(u, 0, 1)); }
function ghost(P) { P.ghosts.push({ x: P.x, y: P.y, face: P.face, swing: P.swing, spin: P.spin, life: 14 }); }

const KINDS = {
  normal: {
    start(P, c) {
      c.dur = P.ch.flailW ? 22 : 15; P.vx = P.face * 2;
      const set = P.ch.kick ? [[0.6, -0.4], [1.2, -0.8], [-0.4, 1.2]] : [[-1.8, 0.9], [1.0, -1.6], [-2.4, 0.9]];
      c.arc = set[c.combo % 3];
    },
    update(P, c) {
      const [a0, a1] = c.arc;
      setSwing(P, a0, a1, (c.t - 2) / 6);
      if (c.t === 3) {
        Audio.sfx.swing();
        const dmg = (P.ch.flailW ? 24 : 14) * (c.combo === 2 ? 1.6 : 1);
        const grp = newGrp(P, dmg, c);
        if (P.ch.kick) fxSlash(P, 60, a0, a1, 16, 'blood', { dy: -50, grp, sweep: 5 });
        else fxSlash(P, P.ch.flailW ? 130 : P.ch.whipBlade ? 140 : 88, a0, a1, P.ch.flailW ? 24 : 16, c.th, { grp, sweep: 6, fade: 8, alpha: 0.75 });
        if (P.ch.dual || P.ch.cleaver) fxSlash(P, 80, a1 * 0.8, a0 * 0.8, 12, c.th, { grp, sweep: 6, fade: 8, alpha: 0.6 });
      }
      if (pressed('KeyJ') && c.t > 5) c.queue = true;
      if (pressed('KeyK') && c.t > 4) { P.cast = null; tryCast(P); }
    },
    end(P, c) { if (c.queue) beginNormal(P, c.combo + 1); }
  },
  slash: {
    start(P, c) { c.dur = 26; P.vx = P.face * 2; const f = c.f; c.a0 = f.flat ? -2.5 : f.a0; c.a1 = f.flat ? 0.9 : f.a1; },
    update(P, c) {
      const f = c.f; setSwing(P, f.flat ? -0.4 : c.a0, f.flat ? 0.4 : c.a1, (c.t - 3) / 8);
      if (c.t === 4) {
        Audio.sfx.heavy(); themeSfx(c.th);
        const grp = newGrp(P, f.dmg, c);
        fxSlash(P, f.flat ? f.r * 1.3 : f.r, c.a0, c.a1, f.w || 30, c.th, { grp, sweep: 8, fade: 18, sq: f.flat ? 0.33 : 1, dx: f.flat ? 30 : 8 });
        if (f.haze) { fxSlash(P, f.r * 0.8, c.a0, c.a1, 20, c.th, { sweep: 10, fade: 20, sq: 0.33, alpha: 0.35, dx: 60 }); fxSlash(P, f.r * 1.15, c.a0, c.a1, 14, 'mist', { sweep: 12, fade: 24, sq: 0.38, alpha: 0.3, dx: 0 }); }
      }
    }
  },
  flip: {
    start(P, c) { c.dur = 36; const f = c.f; P.vy = f.air || !P.ground ? -9 : -12; c.dir = f.back ? -1 : 1; P.vx = P.face * c.dir * f.dist / 34; c.per = Math.max(6, Math.floor(28 / f.hits)); c.inv = !!f.back; },
    update(P, c) {
      const f = c.f;
      P.spin = (c.t / 32) * TAU * c.dir * (f.back ? 1 : 1);
      if (c.t >= 4 && (c.t - 4) % c.per === 0 && c.t < 4 + c.per * f.hits && !(f.back && c.t > 10)) {
        Audio.sfx.swing(); themeSfx(c.th);
        fxSlash(P, 95, -Math.PI / 2, -Math.PI / 2 + TAU * 0.92 * c.dir, 26, c.th, { follow: 1, dy: -75, dx: 0, sweep: c.per, fade: 10, grp: newGrp(P, f.dmg, c) });
      }
      if (f.back && c.t === 22) { P.spin = 0; Audio.sfx.heavy(); fxSlash(P, 190, -2.6, 0.8, 34, c.th, { sweep: 7, fade: 16, sq: 0.3, dx: 40, grp: newGrp(P, f.dmg * 1.4, c) }); }
      if (c.t > 32) P.spin = 0;
    }
  },
  dashSlash: {
    start(P, c) {
      const f = c.f;
      c.mv = f.fast === 2 ? 9 : f.fast ? 12 : 20; c.dur = c.mv + (f.fast ? 18 : 10);
      const t = nearestEnemy(P);
      if (t && Math.sign(t.x - P.x) !== 0) P.face = Math.sign(t.x - P.x);
      c.sx = P.x; c.sy = P.y; c.ex = clamp(P.x + P.face * f.dist, AL, AR); c.inv = true; c.noGrav = true; P.vx = P.vy = 0; c.k = -1;
      if (P.ch.iai) P.swing = 1.6; themeSfx(c.th);
    },
    update(P, c) {
      const f = c.f;
      if (c.t <= c.mv) {
        const u = c.t / c.mv, px = P.x, py = P.y;
        P.x = lerp(c.sx, c.ex, easeOut(u));
        if (f.weave) P.y = c.sy - Math.sin(u * Math.PI * 3) * 26;
        else if (f.hop) P.y = c.sy - Math.abs(Math.sin(u * Math.PI * 4)) * 70;
        else P.y = c.sy;
        P.swing = f.fast ? 0.3 : lerp(-1.2, 0.8, (u * f.hits) % 1);
        const k = Math.min(f.hits - 1, Math.floor(u * f.hits));
        if (k !== c.k) { c.k = k; c.grp = newGrp(P, f.dmg, c, { heavy: f.dmg >= 60 }); if (!f.fast) { Audio.sfx.swing(); fxSlash(P, 90, k % 2 ? 1.2 : -1.6, k % 2 ? -1.4 : 1.0, 22, c.th, { follow: 1, sweep: 5, fade: 9 }); } }
        strike(c.grp, P.x, P.y - 70, f.huge ? 110 : 70);
        ghost(P);
        fxStreak(px, py - 72, P.x, P.y - 72, c.th, f.huge ? 60 : f.fast ? 26 : 14, f.fast ? 20 : 12);
        if (f.drill) { fxSlash(P, 70, c.t * 0.9, c.t * 0.9 + 4, 18, c.th, { follow: 1, dy: -70, sweep: 3, fade: 6 }); particles('wind', P.x, P.y - 70, 3, 6, { k: 'leaf' }); }
        if (c.th === 'thunder') fxBolt(px, py - 70 + rnd(-30, 30), P.x, P.y - 70 + rnd(-30, 30), 10);
        if (f.huge) particles('flame', P.x, P.y - 70, 12, 9, { up: 2 });
        if (f.body) particles('beast', P.x + P.face * 30, P.y - 60, 3, 6);
      } else if (c.t === c.mv + 1 && f.fast) {
        // the delayed flash — 一閃
        P.swing = 0.9;
        const y = c.sy - 72;
        G.fx.push({ type: 'flashline', x1: c.sx, x2: c.ex, y, theme: c.th, t: 0, life: 26, w: f.huge ? 120 : f.fast === 2 ? 50 : 34 });
        if (c.th === 'thunder') { for (let i = 0; i < 5; i++) fxBolt(lerp(c.sx, c.ex, i / 5), y - 160, lerp(c.sx, c.ex, (i + 1) / 5), y + rnd(-20, 20), 18); Audio.sfx.thunder(); }
        if (f.huge) { G.shake = 30; Audio.sfx.boom(); Audio.sfx.fire(); for (let i = 0; i < 6; i++) particles('flame', lerp(c.sx, c.ex, i / 6), y, 30, 12, { up: 3 }); G.flashScreen = { c: '#ff8020', t: 0, life: 20 }; }
        const grp = newGrp(P, f.dmg * 0.25, c);
        for (let x = Math.min(c.sx, c.ex); x <= Math.max(c.sx, c.ex); x += 40) strike(grp, x, y, 60);
        G.shake = Math.max(G.shake, 14);
      }
    },
    end(P) { P.vx = 0; }
  },
  multi: {
    start(P, c) { const f = c.f; c.per = f.n > 6 ? 6 : f.n > 3 ? 8 : 11; c.dur = f.n * c.per + 10; c.i = 0; },
    update(P, c) {
      const f = c.f;
      P.vx = P.face * 1.5;
      if (c.t >= 2 && (c.t - 2) % c.per === 0 && c.i < f.n) {
        let arc = ARCS[(c.i + (c.th === 'sun' ? 0 : 2)) % ARCS.length];
        if (f.cross) arc = c.i % 2 ? [-2.0, 1.0] : [2.0, -1.0];
        if (f.flat) arc = c.i % 2 ? [0.9, -2.5] : [-2.5, 0.9];
        c.arc = arc;
        const grp = newGrp(P, f.dmg, c);
        const r = f.r * (f.wide ? 1.2 : 1) * rnd(0.9, 1.1);
        fxSlash(P, r, arc[0], arc[1], f.whipy ? 14 : 26, c.th, { grp, sweep: Math.max(4, c.per - 2), fade: 12, sq: f.flat || f.wide ? 0.4 : 1, dx: f.whipy ? 30 : 12 });
        if (f.bite) fxSlash(P, r, -arc[0], -arc[1], 26, c.th, { grp: newGrp(P, f.dmg, c), sweep: c.per - 2, fade: 12, dx: 12 });
        if (f.saw) particles('beast', P.x + P.face * 60, P.y - 80, 10, 8);
        Audio.sfx.swing(); if (c.i === 0) themeSfx(c.th);
        c.i++;
      }
      if (c.arc) setSwing(P, c.arc[0], c.arc[1], ((c.t - 2) % c.per) / (c.per - 2));
    }
  },
  spin: {
    start(P, c) { const f = c.f; c.per = 8; c.dur = f.hits * c.per + 8; c.block = !!f.block; c.i = 0; themeSfx(c.th); },
    update(P, c) {
      const f = c.f;
      P.swing = c.t * 0.75;
      if ((c.t - 1) % c.per === 0 && c.i < f.hits) {
        const a0 = rnd(0, TAU);
        fxSlash(P, f.r, a0, a0 + TAU * 0.95 * (c.i % 2 ? -1 : 1), f.whipy ? 16 : 28, c.th, { follow: 1, dx: f.front ? 50 : 0, dy: -75, sweep: c.per, fade: 10, grp: newGrp(P, f.dmg, c), sq: f.front ? 1 : 0.85 });
        Audio.sfx.swing();
        if (f.boom) { const a = rnd(0, TAU); const x = P.x + Math.cos(a) * f.r, y = P.y - 75 + Math.sin(a) * f.r; particles('sound', x, y, 18, 8); fxRing(x, y, 50, 'sound', 14); Audio.sfx.boom(); }
        c.i++;
      }
    }
  },
  thrust: {
    start(P, c) { c.dur = 22; c.ang = c.f.up ? -0.7 : 0; if (c.f.fast) c.dur = 16; },
    update(P, c) {
      const f = c.f;
      P.swing = c.ang;
      if (c.t < 9) P.vx = P.face * (f.len / 22); else P.vx *= 0.7;
      if (f.up && c.t === 5) P.vy = -10;
      if (c.t === 5) {
        const A = P.face > 0 ? c.ang : Math.PI - c.ang;
        const x = P.x + P.face * 20, y = P.y - 82;
        c.line = [x, y, A];
        fxThrust(x, y, A, f.len, c.th, 16, f.twin ? 12 : 18);
        if (f.twin) fxThrust(x, y + 16, A, f.len * 0.95, c.th, 16, 12);
        c.grp = newGrp(P, f.dmg, c);
        Audio.sfx.heavy(); themeSfx(c.th);
        if (c.th === 'water') for (let i = 0; i < 3; i++) fxRing(x + Math.cos(A) * f.len, y + Math.sin(A) * f.len, 30 + i * 20, 'water', 20 + i * 6, { sq: 0.5 });
        if (c.th === 'insect') particles('insect', x + Math.cos(A) * f.len, y + Math.sin(A) * f.len, 8, 3, { k: 'butterfly', g: -0.02 });
      }
      if (c.line && c.t <= 9) { const [x, y, A] = c.line; for (let s = 0; s <= f.len; s += 30) strike(c.grp, x + Math.cos(A) * s, y + Math.sin(A) * s, 30); }
    }
  },
  multiThrust: {
    start(P, c) { c.dur = c.f.n * 6 + 10; c.i = 0; },
    update(P, c) {
      const f = c.f;
      P.vx = P.face * 2.5;
      if ((c.t - 2) % 6 === 0 && c.i < f.n) {
        const a = f.hex ? lerp(-0.7, 0.7, c.i / (f.n - 1)) : rnd(-0.35, 0.35);
        P.swing = a;
        const A = P.face > 0 ? a : Math.PI - a, x = P.x + P.face * 20, y = P.y - 82;
        fxThrust(x, y, A, 170, c.th, 12, 10);
        const grp = newGrp(P, f.dmg, c);
        for (let s = 0; s <= 170; s += 28) strike(grp, x + Math.cos(A) * s, y + Math.sin(A) * s, 26);
        particles('insect', x + Math.cos(A) * 170, y + Math.sin(A) * 170, 3, 2, { k: 'butterfly', g: -0.02 });
        Audio.sfx.swing(); c.i++;
      }
    }
  },
  slam: {
    start(P, c) { c.dur = 44; if (P.ground) P.vy = -13; else P.vy = -4; P.vx = P.face * 3; c.landed = false; },
    update(P, c) {
      const f = c.f;
      setSwing(P, -2.2, 1.0, (c.t - 10) / 8);
      if (c.t === 12) { fxSlash(P, 130, -2.2, 1.0, 40, c.th, { sweep: 8, fade: 14, grp: newGrp(P, f.dmg * 0.4, c) }); Audio.sfx.heavy(); }
      if (c.t === 14) { P.vy = 24; P.vx = 0; }
      if (!c.landed && c.t > 14 && (P.ground || c.t > 34)) {
        c.landed = true;
        const x = P.x + P.face * 50;
        fxRing(x, GY - 6, f.r, c.th, 26, { sq: 0.25, w: 16 }); fxRing(x, GY - 6, f.r * 0.6, c.th, 20, { sq: 0.25, w: 10 });
        particles(c.th, x, GY - 10, 40, 10, { up: 4 });
        particles('stone', x, GY - 4, 14, 8, { k: 'rock', g: 0.4, up: 5 });
        strike(newGrp(P, f.dmg, c, { heavy: true }), x, GY - 50, f.r * 0.7);
        G.shake = 20; Audio.sfx.boom(); themeSfx(c.th);
        if (f.boom) for (let i = 0; i < 5; i++) { const bx = x + rnd(-f.r, f.r), by = GY - rnd(20, 140); fxRing(bx, by, 60, 'sound', 18); particles('sound', bx, by, 15, 7); }
        if (c.th === 'water') for (let i = 0; i < 20; i++) G.parts.push({ x: x + rnd(-80, 80), y: GY - 10, vx: rnd(-4, 4), vy: rnd(-14, -6), life: 40, max: 40, s: 4, c: '#cfeaff', k: 'drop', g: 0.5 });
      }
    }
  },
  rise: {
    start(P, c) { c.dur = 34; P.vy = -16; P.vx = P.face * 3; c.per = Math.max(5, Math.floor(26 / c.f.hits)); c.i = 0; themeSfx(c.th); },
    update(P, c) {
      const f = c.f;
      if (c.t >= 2 && (c.t - 2) % c.per === 0 && c.i < f.hits) {
        const arc = f.arc ? [1.4, -1.9] : f.fan ? [-0.6 - c.i * 0.4, 1.6 + c.i * 0.3] : [1.2 + c.i * 0.5, -1.6 + c.i * 0.5];
        c.arc = arc;
        fxSlash(P, f.arc ? 170 : 110, arc[0], arc[1], f.arc ? 40 : 24, c.th, { follow: 1, sweep: c.per, fade: 12, grp: newGrp(P, f.dmg, c) });
        Audio.sfx.swing(); c.i++;
      }
      if (c.arc) setSwing(P, c.arc[0], c.arc[1], ((c.t - 2) % c.per) / c.per);
    }
  },
  wave: {
    start(P, c) { c.dur = 24; },
    update(P, c) {
      const f = c.f;
      setSwing(P, -2.0, 0.6, (c.t - 2) / 8);
      if (c.t === 7) {
        G.pproj.push({ k: f.tiger ? 'tiger' : f.claws ? 'claws' : 'crescent', x: P.x + P.face * 50, y: P.y - 82, vx: P.face * f.speed, vy: 0, r: f.size, theme: c.th, life: 80, t: 0, face: P.face, grp: newGrp(P, f.dmg, c, { heavy: true }), regrp: f.claws ? 0 : 0 });
        Audio.sfx.heavy(); themeSfx(c.th); if (f.tiger) { Audio.sfx.fire(); G.shake = 10; }
      }
    }
  },
  dragon: {
    start(P, c) {
      const f = c.f;
      c.speed = f.fast ? 34 : 13; c.dur = f.fast ? 26 : f.hits * 8 + 16;
      c.noGrav = true; c.inv = true; c.y0 = Math.min(P.y, GY); c.pts = []; c.pts2 = []; c.k = -1; c.dmg = f.dmg;
      const t = nearestEnemy(P); if (t) P.face = Math.sign(t.x - P.x) || P.face;
      G.fx.push({ type: 'dragon', pts: c.pts, theme: c.th, t: 0, life: c.dur + 30, w: f.big ? 54 : 40, snake: c.th === 'serpent', owner: c });
      if (f.twin) G.fx.push({ type: 'dragon', pts: c.pts2, theme: c.th, t: 0, life: c.dur + 30, w: 34, snake: 1, owner: c });
      themeSfx(c.th); Audio.sfx.heavy();
    },
    update(P, c) {
      const f = c.f;
      if (c.t > c.dur - 8) { P.vy = 0; c.noGrav = false; return; }
      P.x += P.face * c.speed;
      if (P.x < AL + 30 || P.x > AR - 30) { P.face *= -1; P.x = clamp(P.x, AL + 30, AR - 30); }
      P.y = c.y0 - 40 - Math.sin(c.t * 0.16) * 70 - (f.fast ? 30 : 0);
      P.swing = Math.sin(c.t * 0.3) * 1.5;
      c.pts.push([P.x, P.y - 70]); if (c.pts.length > 40) c.pts.shift();
      if (f.twin) { c.pts2.push([P.x - P.face * 20, c.y0 - 40 + Math.sin(c.t * 0.16) * 70 - 70]); if (c.pts2.length > 30) c.pts2.shift(); }
      const k = Math.floor(c.t / Math.max(4, (c.dur - 8) / f.hits));
      if (k !== c.k) { c.k = k; if (f.grow && k > 0) c.dmg *= 1.25; c.grp = newGrp(P, c.dmg, c, { heavy: c.dmg >= 40 }); Audio.sfx.swing(); }
      strike(c.grp, P.x, P.y - 70, 85);
      if (f.twin) { const q = c.pts2[c.pts2.length - 1]; strike(c.grp, q[0], q[1], 60); }
      particles(c.th, P.x, P.y - 70, 3, 4);
      if (c.th === 'thunder') { fxBolt(P.x, P.y - 70, P.x - P.face * 120, P.y - 70 + rnd(-60, 60), 8); if (c.t === c.dur - 9) { Audio.sfx.thunder(); G.flashScreen = { c: '#fff6a0', t: 0, life: 16 }; G.shake = 24; } }
    },
    end(P) { P.vx = 0; }
  },
  whip: {
    start(P, c) { c.dur = 24; G.fx.push({ type: 'whip', P, len: c.f.len, sweep: !!c.f.sweep, theme: c.th, t: 0, life: 18, grp: newGrp(P, c.f.dmg, c) }); Audio.sfx.swing(); themeSfx(c.th); },
    update(P, c) { P.swing = c.f.sweep ? lerp(-1.4, 0.7, clamp((c.t - 2) / 8, 0, 1)) : 0.05; }
  },
  barrage: {
    start(P, c) { c.dur = c.f.n * 5 + 14; c.i = 0; themeSfx(c.th); },
    update(P, c) {
      const f = c.f;
      P.swing = Math.sin(c.t * 0.7) * 1.6;
      if (c.t >= 4 && (c.t - 4) % 5 === 0 && c.i < f.n) {
        const x = P.x + P.face * rnd(90, 430), y = GY - rnd(40, 220);
        const grp = newGrp(P, f.dmg, c);
        if (f.boom) { fxRing(x, y, 70, 'sound', 18); particles('sound', x, y, 24, 9); particles('sound', x, y, 4, 3, { k: 'note', g: -0.05 }); Audio.sfx.boom(); strike(grp, x, y, 75); }
        else if (f.heavy) { fxRing(x, y, 55, 'stone', 16); particles('stone', x, y, 14, 8, { k: 'rock', g: 0.4 }); Audio.sfx.chain(); strike(grp, x, y, 65); G.fx.push({ type: 'chain', P, x, y, t: 0, life: 8 }); }
        else { const a = rnd(0, TAU); fxAt(x, y, 60, a, a + 2.4, 14, c.th, { grp, sweep: 5, fade: 10 }); particles(c.th, x, y, 6, 4, { k: 'heart', g: -0.03 }); Audio.sfx.swing(); }
        c.i++;
      }
    }
  },
  rain: {
    start(P, c) { c.dur = 54; },
    update(P, c) {
      P.swing = -1.6;
      if (c.t === 10 || c.t === 24) {
        const t = nearestEnemy(P); const x = t ? t.x + rnd(-40, 40) : P.x + P.face * 300;
        G.pproj.push({ k: c.t === 10 ? 'meteor' : 'axe', x, y: -60, vx: 0, vy: 26, r: 50, theme: 'stone', life: 60, t: 0, face: P.face, grp: newGrp(P, c.f.dmg, c, { heavy: true }), fall: 1, P });
        Audio.sfx.chain();
      }
    }
  },
  throw: {
    start(P, c) { c.dur = 22; },
    update(P, c) {
      const f = c.f;
      setSwing(P, -1.8, 0.4, (c.t - 2) / 6);
      if (c.t === 6) { G.pproj.push({ k: f.flail ? 'flail' : 'blade', x: P.x + P.face * 30, y: P.y - 85, vx: P.face * 22, vy: 0, r: f.flail ? 30 : 26, theme: c.th, life: 70, t: 0, face: P.face, grp: newGrp(P, f.dmg, c, { heavy: true }), boomer: 1, P, c }); Audio.sfx.chain(); }
      if (f.flail && c.t === 14) fxSlash(P, 120, -2.0, 1.0, 30, 'stone', { sweep: 7, grp: newGrp(P, f.dmg * 0.6, c) });
    }
  },
  aoe: {
    start(P, c) { c.dur = 36; c.inv = true; },
    update(P, c) {
      const f = c.f;
      P.swing = -1.4;
      if (c.t < 8) particles('blood', P.x, P.y - 70, 4, 3, { up: 1 });
      if (c.t === 8) {
        fxRing(P.x, P.y - 70, f.r, 'blood', 30, { w: 30 }); fxRing(P.x, P.y - 70, f.r * 0.6, 'blood', 24, { w: 18 });
        for (let i = 0; i < 80; i++) { const a = rnd(0, TAU), d = rnd(0, f.r); G.parts.push({ x: P.x + Math.cos(a) * d, y: P.y - 70 + Math.sin(a) * d * 0.6, vx: rnd(-1, 1), vy: -rnd(1, 4), life: rnd(30, 60), max: 60, s: rnd(3, 7), c: Math.random() < 0.5 ? '#ff4070' : '#ffb0c8', k: 'ember', g: -0.03 }); }
        strike(newGrp(P, f.dmg, c, { heavy: true, burn: 1 }), P.x, P.y - 70, f.r);
        G.eproj = G.eproj.filter(p => Math.hypot(p.x - P.x, p.y - P.y + 70) > f.r);
        G.team.forEach(p => p.poison = 0);
        G.shake = 18; Audio.sfx.fire(); Audio.sfx.boom();
        G.flashScreen = { c: '#ff3a6a', t: 0, life: 14 };
      }
    }
  },
  zigzag: {
    start(P, c) {
      const f = c.f; c.per = c.th === 'thunder' ? 5 : 7; c.dur = f.n * c.per + 16; c.noGrav = true; c.inv = true; c.i = -1;
      const t = nearestEnemy(P);
      c.pts = [[P.x, P.y]];
      for (let i = 0; i < f.n; i++) {
        if (c.th === 'thunder' && t) { const side = i % 2 ? 1 : -1; c.pts.push([clamp(t.x + side * rnd(130, 220), AL, AR), GY - (i % 3 === 1 ? rnd(120, 220) : rnd(0, 40))]); }
        else c.pts.push([clamp(P.x + P.face * (i + 1) * 70, AL, AR), GY - (i % 2 ? 50 : 0)]);
      }
      themeSfx(c.th);
    },
    update(P, c) {
      const f = c.f;
      const seg = Math.floor((c.t - 1) / c.per);
      if (seg < f.n) {
        if (seg !== c.i) { c.i = seg; c.grp = newGrp(P, f.dmg, c, { heavy: c.th === 'thunder' }); if (c.th === 'thunder') Audio.sfx.thunder(); else Audio.sfx.swing(); }
        const [x0, y0] = c.pts[seg], [x1, y1] = c.pts[seg + 1];
        const u = ((c.t - 1) % c.per + 1) / c.per;
        const px = P.x, py = P.y;
        P.x = lerp(x0, x1, u); P.y = lerp(y0, y1, u); P.face = Math.sign(x1 - x0) || P.face;
        P.swing = 0.3;
        strike(c.grp, P.x, P.y - 70, 70); ghost(P);
        fxStreak(px, py - 70, P.x, P.y - 70, c.th, c.th === 'thunder' ? 22 : 12, 18);
        if (c.th === 'thunder') fxBolt(px, py - 70, P.x, P.y - 70, 14);
        if (c.th === 'insect') particles('insect', P.x, P.y - 70, 1, 2, { k: 'butterfly', g: -0.02 });
      } else if (seg === f.n && c.th === 'thunder' && !c.fin) {
        c.fin = 1; G.flashScreen = { c: '#fff2a0', t: 0, life: 12 }; G.shake = 18;
        const t = nearestEnemy(P); if (t) fxBolt(t.x, 0, t.x, t.y - 60, 20);
      } else { c.noGrav = false; P.swing = 0.9; }
    }
  },
  buff: {
    start(P, c) { c.dur = 26; },
    update(P, c) {
      const f = c.f;
      P.swing = -0.4;
      if (c.t === 4) {
        P.buffs[f.buff] = f.dur;
        if (f.buff === 'slow') { G.slow = 0.35; G.slowT = f.dur; G.flashScreen = { c: '#ff5080', t: 0, life: 18 }; }
        if (f.buff === 'nagi') { fxRing(P.x, P.y - 4, 160, 'water', 40, { sq: 0.18, w: 4 }); }
        if (f.buff === 'evade') { for (let i = 0; i < 4; i++) P.ghosts.push({ x: P.x + rnd(-80, 80), y: P.y, face: P.face, swing: rnd(-2, 1), spin: 0, life: 40, tint: 'sun' }); }
        particles(c.th, P.x, P.y - 70, 30, 6, { g: -0.05 });
        themeSfx(c.th); Audio.sfx.breath();
      }
    }
  },
  combo13: {
    start(P, c) {
      c.dur = 9999; c.inv = true; c.i = 0;
      c.list = STYLES.sun.forms.filter(x => x.kind !== 'combo13' && x.name !== '円舞一閃');
    },
    update(P, c) {
      if (!c.sub || c.sub.t >= c.sub.dur) {
        if (c.sub && KINDS[c.sub.kind].end) KINDS[c.sub.kind].end(P, c.sub);
        P.spin = 0;
        if (c.i >= c.list.length) { c.dur = c.t; c.noGrav = false; G.flashScreen = { c: '#ffd060', t: 0, life: 24 }; G.shake = 24; Audio.sfx.gong(); return; }
        const f = c.list[c.i++];
        c.sub = { kind: f.kind, f, th: 'sun', t: 0, dur: 20, data: {} };
        KINDS[f.kind].start(P, c.sub);
        c.sub.dur = Math.min(c.sub.dur, 30);
        G.callouts.push({ jp: f.name, kata: '', sub: '日の呼吸', t: 0, dur: 40, small: 1, theme: 'sun', x: P.x });
      }
      c.sub.t++;
      KINDS[c.sub.kind].update(P, c.sub);
      c.noGrav = !!c.sub.noGrav;
      if (c.t % 3 === 0) particles('sun', P.x, P.y - 70, 3, 5);
      if (G.dawnMax) G.dawn += 3;
    }
  },
};
function themeSfx(th) {
  const s = Audio.sfx;
  ({ water: s.water, sun: s.fire, flame: s.fire, thunder: s.thunder, wind: s.wind, sound: s.boom, stone: s.chain, blood: s.fire, mist: s.wind, love: s.swing, insect: s.swing, serpent: s.wind, flower: s.wind, beast: s.heavy }[th] || s.swing)();
}

// ---------------- CASTING ----------------
function beginNormal(P, combo) {
  const c = { kind: 'normal', combo: combo % 3, th: P.ch.kick ? 'blood' : curStyle(P).theme, t: 0, dur: 15 };
  KINDS.normal.start(P, c); P.cast = c;
}
function tryCast(P) {
  const st = curStyle(P), f = curForm(P);
  if (P.br < f.cost) { addText(P.x, P.y - 170, '呼吸が足りない！ Hết hơi!', '#9cf', 18); Audio.sfx.select(); return; }
  P.br -= f.cost;
  if (f.hpCost) P.hp = Math.max(1, P.hp - f.hpCost);
  callout(P, f, st);
  if (f.big) { G.cutin = { P, f, st, t: 0, dur: 58 }; Audio.sfx.cutin(); }
  else beginCast(P, f, st);
}
function beginCast(P, f, st) {
  const c = { kind: f.kind, f, th: st.theme, t: 0, dur: 20 };
  P.vx = 0;
  KINDS[f.kind].start(P, c);
  P.cast = c;
}
function styleLabel(st) {
  if (st.theme === 'sun' && G && G.S.boss === 'muzan') return '日の呼吸';
  return st.jp;
}
function callout(P, f, st) {
  const lab = styleLabel(st);
  const pre = st.noZen ? lab : '全集中・' + lab;
  const kana = (st.noZen ? '' : 'ぜんしゅうちゅう、') + (lab === '日の呼吸' ? 'ひのこきゅう' : st.kana) + '、' + (f.kataKana ? f.kataKana + '、' : '') + f.kana;
  G.callouts.push({ sub: pre, kata: f.kata, jp: f.name, vn: f.vn, t: 0, dur: f.big ? 150 : 95, theme: st.theme, big: !!f.big });
  if (G.callouts.length > 2) G.callouts.shift();
  sayLine(kana, P.ch.voice);
}
function runCast(P) {
  const c = P.cast;
  c.t++;
  KINDS[c.kind].update(P, c);
  if (P.cast !== c) return; // cancelled/replaced
  if (c.t >= c.dur) {
    P.cast = null; P.swing = undefined; P.spin = 0;
    if (KINDS[c.kind].end) KINDS[c.kind].end(P, c);
  }
}

// ---------------- PLAYER UPDATE ----------------
function physics(P, noGrav) {
  if (!noGrav) { P.vy = Math.min(18, P.vy + 0.75); }
  P.x += P.vx; P.y += P.vy;
  if (G.tiltT > 0) P.x += G.tilt * 2.2;
  if (P.y >= GY) { P.y = GY; P.vy = 0; P.ground = true; } else P.ground = false;
  P.x = clamp(P.x, AL, AR);
}
function updatePlayer(P) {
  if (P.inv > 0) P.inv--;
  if (P.dashCd > 0) P.dashCd--;
  for (const k in P.buffs) if (P.buffs[k] > 0) P.buffs[k]--;
  P.ghosts.forEach(g => g.life--); P.ghosts = P.ghosts.filter(g => g.life > 0);
  if (P.poison > 0) { P.poison--; if (G.t % 10 === 0) { P.hp -= 1.2; if (P.hp <= 1) P.hp = 1; } }
  if (P.buffs.guard && G.t % 15 === 0) { strike(newGrp(P, 10, { th: 'stone', f: {} }), P.x, P.y - 70, 95); Audio.sfx.chain(); }
  if (P.buffs.evade && G.t % 4 === 0) P.ghosts.push({ x: P.x + rnd(-50, 50), y: P.y, face: P.face, swing: P.swing, spin: 0, life: 18, tint: 'sun' });
  P.zen = false;

  if (P.sleep > 0) {
    P.sleep -= 0.0012;
    if (pressed('KeyJ', 'KeyK')) { P.sleep -= 0.06; particles('blood', P.x, P.y - 120, 5, 3); }
    if (P.sleep <= 0) { P.sleep = 0; banner('目覚めた！', 'Đã tỉnh giấc!', 80); Audio.sfx.gong(); }
    P.vx *= 0.8; physics(P); return;
  }
  if (P.cast) { runCast(P); const c = P.cast; physics(P, c && c.noGrav); if (c && c.noGrav) P.vy = 0; return; }
  if (P.hurtT > 0) { P.hurtT--; P.vx *= 0.9; physics(P); return; }
  if (P.dashT > 0) {
    P.dashT--; P.x += P.face * 15; P.vy = Math.min(P.vy, 2); ghost(P); physics(P, true); P.vx = 0;
    if (P.dashT === 0) P.vy = 0;
    return;
  }
  const mv = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
  if (held('KeyL') && P.ground) {
    P.zen = true; P.vx = 0; P.br = Math.min(P.maxbr, P.br + 0.75);
    if (G.t % 3 === 0) particles(curStyle(P).theme, P.x + rnd(-30, 30), P.y - rnd(20, 140), 1, 1, { g: -0.06 });
    if (G.t % 50 === 0) Audio.sfx.breath();
  } else {
    P.vx = mv * P.ch.speed * (P.buffs.slowed ? 0.6 : 1);
    if (mv) { P.face = mv; P.walk += 0.32; } else P.walk = 0;
  }
  if (pressed('KeyW', 'Space', 'ArrowUp') && P.ground) { P.vy = -15.5; }
  if (pressed('ShiftLeft', 'ShiftRight', 'KeyI') && P.dashCd <= 0) { P.dashT = 11; P.dashCd = 34; P.inv = Math.max(P.inv, 13); if (mv) P.face = mv; Audio.sfx.wind(); }
  if (pressed('KeyJ')) beginNormal(P, 0);
  else if (pressed('KeyK')) tryCast(P);
  P.br = Math.min(P.maxbr, P.br + 0.09);
  physics(P);
}
function handleSelectionInput() {
  const P = activeP();
  if (P.down) return;
  const st = curStyle(P), n = st.forms.length;
  let d = 0;
  if (pressed('KeyE')) d = 1;
  if (pressed('KeyQ')) d = -1;
  if (Input.wheel) { d = Math.sign(Input.wheel); Input.wheel = 0; }
  if (d) { P.formIdx[P.styleIdx] = (P.formIdx[P.styleIdx] + d + n) % n; Audio.sfx.select(); }
  if (pressed('KeyR') && P.ch.styles.length > 1) {
    P.styleIdx = (P.styleIdx + 1) % P.ch.styles.length; Audio.sfx.select();
    const s2 = curStyle(P);
    addText(P.x, P.y - 180, s2.jp + (s2.theme === 'sun' ? ' · Hơi thở Mặt Trời' : ' · Hơi thở của Nước'), '#ffd080', 22);
    if (s2.theme === 'sun') { particles('sun', P.x, P.y - 80, 30, 6); Audio.say('ひのかみかぐら', P.ch.voice); }
  }
  for (let i = 0; i < 10; i++) if (pressed('Digit' + ((i + 1) % 10))) switchTo(i);
  if (pressed('Tab')) { for (let k = 1; k <= G.team.length; k++) { const j = (G.ai + k) % G.team.length; if (!G.team[j].down) { switchTo(j); break; } } }
}

// ---------------- BOSS AI ----------------
function updateBoss(b) {
  const d = b.def, P = activeP();
  if (b.dead) { b.deadT++; if (b.deadT % 2 === 0) G.parts.push({ x: b.x + rnd(-30, 30), y: b.y - rnd(0, b.hh), vx: rnd(-0.5, 1), vy: -rnd(0.5, 2), life: 60, max: 60, s: rnd(2, 5), c: '#2a1a1a', k: 'rock', g: -0.02 }); return; }
  if (b.pending > 0) {
    b.pending--; b.flash = b.pending % 20 < 10 ? 2 : 0;
    if (b.pending === 0) { b.hp = b.maxhp * 0.5; banner('再生した！', 'Chúng đã tái sinh!', 100); Audio.sfx.gong(); }
    return;
  }
  if (b.fleeing) { b.x += 14 * b.face; b.walk += 0.5; return; }
  // regen, poison, burn
  const poisonF = Math.max(0, 1 - b.poison / 20);
  b.hp = Math.min(b.maxhp, b.hp + d.regen * poisonF * (b.regenBurst > 0 ? 6 : 1));
  if (b.regenBurst > 0) b.regenBurst--;
  if (b.poison > 0) { b.hp -= b.poison * 0.035; b.poison = Math.max(0, b.poison - 0.008); if (G.t % 12 === 0) G.parts.push({ x: b.x + rnd(-20, 20), y: b.y - rnd(40, b.hh), vx: 0, vy: -1, life: 30, max: 30, s: 4, c: '#b070ff', k: 'drop', g: -0.02 }); if (b.hp <= 0) checkBossDeath(b); }
  if (b.burn > 0) { b.burn--; b.hp -= 0.25; if (G.t % 4 === 0) particles('blood', b.x + rnd(-25, 25), b.y - rnd(20, b.hh), 1, 2, { g: -0.1 }); if (b.hp <= 0) checkBossDeath(b); }
  if (b.flash > 0) b.flash--; if (b.hurt > 0) b.hurt--; if (b.buffT > 0) b.buffT--;
  if (b.small && b.small.hp > 0) { const s = b.small; s.x += s.vx; if (s.x < AL + 20 || s.x > AR - 20 || Math.random() < 0.01) s.vx *= -1; if (Math.abs(s.x - P.x) < 120) s.vx = Math.sign(s.x - P.x) * 4.5; s.x = clamp(s.x, AL, AR); }
  const phase2 = b.hp < b.maxhp * 0.5;
  const tx = P.buffs.invis ? (b.fakeX || (b.fakeX = rnd(200, 1100))) : P.x;
  if (!P.buffs.invis) b.fakeX = 0;
  const spd = (b.buffT > 0 ? 1.6 : 1) * (phase2 ? 1.2 : 1);
  if (b.state === 'move') {
    b.swing = 0.9 + Math.sin(G.t * 0.05) * 0.1;
    const dx = tx - b.x; b.face = Math.sign(dx) || b.face;
    const want = d.minion ? 50 : 200;
    if (Math.abs(dx) > want + 30) { b.x += Math.sign(dx) * d.speed * spd; b.walk += 0.2; }
    else if (Math.abs(dx) < want - 80 && !d.minion) { b.x -= Math.sign(dx) * d.speed * 0.6; b.walk += 0.15; }
    b.cd -= spd;
    if (d.teleport && Math.random() < 0.004) { particles('water', b.x, b.y - 80, 20, 5); b.x = clamp(P.x + rnd(-400, 400), AL + 60, AR - 60); particles('water', b.x, b.y - 80, 20, 5); }
    if (b.cd <= 0) {
      const pool = d.atks.concat(phase2 && d.p2 ? d.p2 : []);
      b.atk = pool[Math.floor(Math.random() * pool.length)];
      b.state = 'tele'; b.st = 0;
    }
  } else if (b.state === 'tele') {
    b.st++;
    b.swing = lerp(0.9, -2.0, b.st / b.atk.tele);
    if (b.st === 1) onTele(b, b.atk, P);
    if (b.st >= b.atk.tele) { execAttack(b, b.atk, P); b.state = 'recover'; b.st = 0; }
  } else if (b.state === 'recover') {
    b.st++;
    b.swing = lerp(-2.0, 1.2, Math.min(1, b.st / 6));
    if (b.mv) {
      b.x += b.mv.vx; b.mv.n--;
      const [rx, ry, rw, rh] = bossRect(b), [px, py, pw, ph] = playerRect(P);
      if (rx < px + pw && rx + rw > px && ry < py + ph && ry + rh > py && !b.mv.hit) { if (hurtPlayer(P, b.mv.dmg, b.x, b.atk)) b.mv.hit = 1; }
      if (G.t % 2 === 0) G.fx.push({ type: 'bghost', b, x: b.x, y: b.y, face: b.face, t: 0, life: 10 });
      if (b.mv.n <= 0) {
        if (b.mv.again > 0) { const a = b.mv.again - 1; b.face = Math.sign(P.x - b.x) || b.face; b.mv = { vx: b.face * 22, n: 14, dmg: b.mv.dmg, again: a }; }
        else b.mv = null;
      }
    }
    if (b.st >= 34 && !b.mv) { b.state = 'move'; b.cd = b.atk.cd * (phase2 ? 0.75 : 1) * (d.minion ? 1.5 : 1); }
  }
  b.x = clamp(b.x, AL + 20, AR - 20);
  // contact
  if (!d.minion || true) {
    const [rx, ry, rw, rh] = bossRect(b), [px, py, pw, ph] = playerRect(P);
    if (rx + 10 < px + pw && rx + rw - 10 > px && ry < py + ph && ry + rh > py && G.t % 30 === 0) hurtPlayer(P, 6, b.x);
  }
}

function bossCallout(b, a) {
  if (!a.n) return;
  G.bossLine = { s: a.n, t: 0, b };
  if (G.t - G.lastSay > 70) Audio.say(a.n.replace(/・/g, '、'), SPEAKERS[b.key] ? SPEAKERS[b.key].voice : 0.8, 1.2);
}
function onTele(b, a, P) {
  bossCallout(b, a); Audio.sfx.tele();
  const T = a.tele;
  switch (a.type) {
    case 'lines': {
      for (let i = 0; i < a.count; i++) {
        let ang, cx = P.x + rnd(-120, 120), cy = P.y - rnd(20, 160);
        if (a.horiz) { ang = rnd(-0.1, 0.1); cy = P.y - rnd(30, 100); }
        else if (a.vert) { ang = Math.PI / 2 + rnd(-0.15, 0.15); cx = P.x + (i - 1) * 110 + rnd(-30, 30); }
        else if (a.style === 'claw') ang = Math.PI / 4 * (Math.random() < 0.5 ? 1 : 3) + rnd(-0.2, 0.2);
        else ang = rnd(0, Math.PI);
        if (a.style === 'claw') { for (let k = -1; k <= 1; k++) addLine(cx + k * 26, cy, ang, T, a, b); }
        else addLine(cx, cy, ang, T + i * (a.count > 4 ? 3 : 0), a, b);
      }
      break;
    }
    case 'storm': {
      for (let i = 0; i < 14; i++) addLine(rnd(100, W - 100), GY - rnd(30, 300), rnd(0, Math.PI), T + i * 5, Object.assign({}, a, { style: a.moon ? 'moon' : a.whip ? 'whip' : 'storm' }), b);
      break;
    }
    case 'circle': {
      const x = a.self ? b.x : P.x, y = a.self ? b.y - 80 : GY - 60;
      G.haz.push({ type: 'circle', x, y, r: a.r || 140, delay: T, life: 14, dmg: a.dmg, a, src: b.x, follow: a.self ? b : null });
      break;
    }
    case 'arms': {
      for (let i = 0; i < a.count; i++) {
        const x = clamp(P.x + (i - (a.count - 1) / 2) * 90 + rnd(-20, 20), AL, AR);
        G.haz.push({ type: 'arm', x, w: a.dragon ? 80 : 60, h: a.dragon ? 260 : 200, delay: T + i * 4, life: 30, dmg: a.dmg, a, src: b.x });
      }
      break;
    }
    case 'rain': {
      for (let i = 0; i < a.count; i++) G.haz.push({ type: 'rainmark', x: clamp(P.x + rnd(-260, 260), AL, AR), delay: T + i * 4, life: 1, dmg: a.dmg, a, src: b.x });
      break;
    }
    case 'cage': {
      G.haz.push({ type: 'cage', x: P.x, y: P.y - 70, r0: a.tight ? 220 : 300, delay: T, life: 14, dmg: a.dmg, a, src: b.x });
      break;
    }
    case 'sweep': {
      G.haz.push({ type: 'sweep', dir: b.face, delay: T, life: 18, dmg: a.dmg, a, src: b.x, y0: GY - 75 });
      break;
    }
    case 'compass': b.buffT = 420; G.fx.push({ type: 'compass', b, t: 0, life: 420 }); break;
    case 'tilt': G.tiltT = 120; G.tilt = Math.random() < 0.5 ? -1 : 1; Audio.sfx.boom(); break;
    case 'sleep': G.fx.push({ type: 'sleepaura', b, t: 0, life: T }); break;
  }
}
function addLine(cx, cy, ang, delay, a, b) {
  const L = 1600;
  G.haz.push({ type: 'line', x1: cx - Math.cos(ang) * L, y1: cy - Math.sin(ang) * L, x2: cx + Math.cos(ang) * L, y2: cy + Math.sin(ang) * L, w: a.style === 'frost' ? 70 : a.style === 'whip' || a.style === 'obi' ? 26 : 16, delay, life: 12, dmg: a.dmg, a, style: a.style, src: cx });
}
function execAttack(b, a, P) {
  switch (a.type) {
    case 'melee': {
      b.mv = { vx: b.face * 9, n: 10, dmg: 0, hit: 1 };
      const n = a.multi || 1;
      for (let i = 0; i < n; i++) G.haz.push({ type: 'zone', x: b.x + b.face * a.range * 0.55, y: b.y - 90, r: a.range * 0.55, delay: 4 + i * 6, life: 5, dmg: a.dmg, a, src: b.x, follow: b, off: a.range * 0.55 });
      Audio.sfx.heavy();
      break;
    }
    case 'proj': {
      const ox = b.x + b.face * 40, oy = b.y - b.hh * 0.6;
      for (let i = 0; i < a.count; i++) {
        let ang = Math.atan2(P.y - 80 - oy, P.x - ox);
        if (a.spread) ang += (i - (a.count - 1) / 2) * 0.16; else ang += rnd(-0.12, 0.12);
        if (a.ground) ang = b.face > 0 ? 0 : Math.PI;
        const delay = a.spread ? 0 : i * 6;
        G.eproj.push({ x: ox, y: a.ground ? GY - 40 - i * 50 : oy, vx: Math.cos(ang) * a.speed, vy: Math.sin(ang) * a.speed, r: a.size, dmg: a.dmg, shape: a.shape, color: a.color, life: 160, delay, homing: a.homing || 0, bounce: a.bounce, poison: a.poison, t: 0 });
      }
      Audio.sfx.swing();
      break;
    }
    case 'dash': b.face = Math.sign(P.x - b.x) || b.face; b.mv = { vx: b.face * 22, n: 16, dmg: a.dmg, again: a.triple ? 2 : 0 }; Audio.sfx.wind(); break;
    case 'shock':
      for (const s of [-1, 1]) G.haz.push({ type: 'shock', x: b.x, vx: s * 10, delay: 0, life: 110, dmg: a.dmg, a, src: b.x });
      G.shake = 12; Audio.sfx.boom(); break;
    case 'summon':
      for (let i = 0; i < a.count; i++) { const m = makeBoss(a.minion, clamp(b.x + rnd(-200, 200), AL, AR)); G.bosses.push(m); particles('mist', m.x, m.y - 50, 20, 4, { k: 'smoke' }); }
      break;
    case 'sleep':
      for (let i = 0; i < 3; i++) G.eproj.push({ x: b.x + b.face * 30, y: b.y - 120, vx: b.face * 4 + rnd(-1, 1), vy: rnd(-3, 1), r: 18, dmg: 0, shape: 'sleep', color: '#c080ff', life: 260, delay: i * 14, homing: 0.12, sleep: 1, t: 0 });
      break;
  }
}

// ---------------- HAZARDS / PROJECTILES ----------------
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function nagiCut(P, x, y) {
  if (!P.buffs.nagi) return false;
  if (Math.hypot(x - P.x, y - (P.y - 70)) > 200) return false;
  const a = rnd(0, TAU); fxAt(x, y, 40, a, a + 2.5, 10, 'water', { sweep: 4, fade: 10 }); Audio.sfx.swing();
  return true;
}
function updateHazards() {
  const P = activeP();
  const pc = [P.x, P.y - 70];
  for (const h of G.haz) {
    if (h.delay > 0) { h.delay--; if (h.type === 'cage') h.r = lerp(80, h.r0, h.delay / h.a.tele); continue; }
    h.t = (h.t || 0) + 1;
    if (h.t === 1) {
      if (h.type === 'line') { Audio.sfx.swing(); if (h.style === 'bolt') Audio.sfx.thunder(); }
      if (h.type === 'circle') { G.shake = Math.max(G.shake, 12); Audio.sfx.boom(); particles(h.a.ice ? 'mist' : h.a.moon ? 'moon' : 'demon', h.x, h.y, 30, 9, { k: h.a.ice ? 'ice' : undefined }); }
      if (h.type === 'arm' && h.a.dragon) Audio.sfx.heavy();
      if (h.type === 'rainmark') { G.eproj.push({ x: h.x, y: -40, vx: 0, vy: 20, r: h.a.shape === 'moonbeam' ? 30 : 16, dmg: h.dmg, shape: h.a.shape, color: '#ddf', life: 60, t: 0, fall: 1 }); }
      if (h.type === 'sweep') { Audio.sfx.heavy(); G.shake = 14; }
    }
    if (h.done) continue;
    let hit = false;
    switch (h.type) {
      case 'line': hit = segDist(pc[0], pc[1], h.x1, h.y1, h.x2, h.y2) < h.w / 2 + 18; break;
      case 'circle': if (h.follow) { h.x = h.follow.x; } hit = Math.hypot(pc[0] - h.x, pc[1] - h.y) < h.r; break;
      case 'zone': if (h.follow) { h.x = h.follow.x + h.follow.face * h.off; h.src = h.follow.x; } hit = Math.hypot(pc[0] - h.x, pc[1] - h.y) < h.r; if (h.t === 1) fxAt(h.x, h.y, h.r, h.follow && h.follow.face > 0 ? -1.6 : Math.PI + 1.6, h.follow && h.follow.face > 0 ? 1.4 : Math.PI - 1.4, 18, 'demon', { sweep: 4, fade: 8 }); break;
      case 'arm': { const ht = h.h * Math.min(1, h.t / 6); hit = Math.abs(P.x - h.x) < h.w / 2 + 12 && P.y > GY - ht; break; }
      case 'cage': hit = Math.hypot(pc[0] - h.x, pc[1] - h.y) < 80; break;
      case 'sweep': hit = P.y > GY - 70 && h.t < 10; break;
      case 'shock': h.x += h.vx; hit = Math.abs(P.x - h.x) < 26 && P.y > GY - 56; if (h.x < 0 || h.x > W) h.life = 0; break;
    }
    if (hit && h.dmg) {
      if (nagiCut(P, pc[0], pc[1]) && h.type !== 'cage') { h.done = true; continue; }
      if (hurtPlayer(P, h.dmg, h.src, h.a)) h.done = h.type !== 'shock';
    }
  }
  G.haz = G.haz.filter(h => h.delay > 0 || (h.t || 0) < h.life);

  for (const p of G.eproj) {
    if (p.delay > 0) { p.delay--; continue; }
    p.t++;
    if (p.homing) { const a = Math.atan2(pc[1] - p.y, pc[0] - p.x); const sp = Math.hypot(p.vx, p.vy); const cur = Math.atan2(p.vy, p.vx); let da = a - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = cur + clamp(da, -p.homing, p.homing); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
    if (p.bounce) { p.vy += 0.35; if (p.y > GY - p.r) { p.y = GY - p.r; p.vy *= -0.8; } }
    p.x += p.vx; p.y += p.vy;
    if (p.fall && p.y > GY - 10) { p.life = 0; particles(p.shape === 'lotus' || p.shape === 'icicle' ? 'mist' : 'demon', p.x, GY - 10, 12, 6, { k: p.shape === 'lotus' || p.shape === 'icicle' ? 'ice' : undefined }); fxRing(p.x, GY - 4, 50, 'demon', 12, { sq: 0.3 }); }
    p.life--;
    if (p.x < -100 || p.x > W + 100 || p.y < -200 || p.y > H + 50) p.life = 0;
    const [rx, ry, rw, rh] = playerRect(P);
    if (circleRect(p.x, p.y, p.r * 0.8, rx, ry, rw, rh)) {
      if (P.cast && P.cast.block) { p.life = 0; particles(P.cast.th, p.x, p.y, 10, 5); Audio.sfx.hit(); continue; }
      if (nagiCut(P, p.x, p.y)) { p.life = 0; continue; }
      if (p.sleep) { if (playerVulnerable(P)) { P.sleep = 1; P.cast = null; p.life = 0; banner('夢の中… 自分の頸を斬れ！', 'Bị ru ngủ! Bấm J liên tục để tự tỉnh dậy!', 150); } continue; }
      if (hurtPlayer(P, p.dmg, p.x, p)) p.life = 0;
    }
  }
  G.eproj = G.eproj.filter(p => p.life > 0);
}

function updatePProj() {
  for (const p of G.pproj) {
    p.t++;
    if (p.boomer) { p.vx -= p.face * 0.9; p.y += Math.sin(p.t * 0.2) * 0.5; if (p.t % 12 === 0) p.grp = newGrp(p.P, p.grp.dmg, p.c, { heavy: true }); if (p.t > 20 && Math.abs(p.x - p.P.x) < 40) p.life = 0; }
    if (p.fall) {
      if (p.y >= GY - 40) {
        p.life = 0;
        fxRing(p.x, GY - 6, 170, 'stone', 26, { sq: 0.25, w: 18 }); particles('stone', p.x, GY - 20, 40, 12, { k: 'rock', g: 0.4, up: 5 });
        strike(p.grp, p.x, GY - 60, 160); G.shake = 22; Audio.sfx.boom();
        continue;
      }
    }
    p.x += p.vx; p.y += p.vy; p.life--;
    strike(p.grp, p.x, p.y, p.r * 0.8);
    if (p.k === 'tiger' || p.k === 'crescent') particles(p.theme, p.x - p.face * 20, p.y + rnd(-30, 30), 3, 3);
    if (p.x < -200 || p.x > W + 200) p.life = 0;
  }
  G.pproj = G.pproj.filter(p => p.life > 0);
}

// ---------------- MAIN BATTLE STEP ----------------
function battleStep() {
  if (G.paused) return;
  if (G.cutin) { G.cutin.t++; if (G.cutin.t >= G.cutin.dur) { const c = G.cutin; G.cutin = null; beginCast(c.P, c.f, c.st); } return; }
  for (const c of G.callouts) c.t++;
  G.callouts = G.callouts.filter(c => c.t < c.dur);
  if (G.banner) { G.banner.t++; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.bossLine) { G.bossLine.t++; if (G.bossLine.t > 90) G.bossLine = null; }
  if (G.bigKanji) { G.bigKanji.t++; if (G.bigKanji.t > 70) G.bigKanji = null; }
  if (G.flashScreen) { G.flashScreen.t++; if (G.flashScreen.t > G.flashScreen.life) G.flashScreen = null; }
  if (G.hitstop > 0) { G.hitstop--; return; }
  G.t++;
  if (G.shake > 0) G.shake *= 0.86;
  if (G.switchCd > 0) G.switchCd--;
  if (G.slowT > 0) { G.slowT--; if (!G.slowT) G.slow = 1; }
  if (G.tiltT > 0) G.tiltT--;

  if (!G.over) handleSelectionInput();
  const P = activeP();
  if (!G.over || G.over === 'win') updatePlayer(P);
  for (const p of G.team) if (p !== P && !p.down) { p.br = Math.min(p.maxbr, p.br + 0.15); p.hp = Math.min(p.maxhp, p.hp + 0.02); }

  for (const b of G.bosses) {
    b.acc += G.slow;
    while (b.acc >= 1) { b.acc -= 1; updateBoss(b); }
  }
  G.bosses = G.bosses.filter(b => !(b.dead && b.def.minion && b.deadT > 90));
  G.hazAcc = (G.hazAcc || 0) + G.slow;
  while (G.hazAcc >= 1) { G.hazAcc -= 1; if (!G.over) updateHazards(); }
  updatePProj();
  updateFx();
  for (const p of G.parts) { p.x += p.vx; p.y += p.vy; p.vy += p.g || 0; p.vx *= 0.97; p.life--; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const p of G.amb) { p.x += p.vx + Math.sin(p.life * 0.03) * 0.4; p.y += p.vy; p.life--; }
  G.amb = G.amb.filter(p => p.life > 0 && p.y < GY + 10);
  for (const t of G.texts) { t.y -= 0.8; t.life--; }
  G.texts = G.texts.filter(t => t.life > 0);

  // dawn
  if (G.dawnMax && !G.over) {
    G.dawn += 1;
    if (G.dawn >= G.dawnMax) {
      G.dawn = G.dawnMax;
      const boss = G.bosses.find(b => !b.def.minion);
      if (boss.def.flee) { boss.fleeing = true; boss.face = boss.x < W / 2 ? -1 : 1; banner('夜明けだ！', 'BÌNH MINH! Akaza bỏ chạy khỏi ánh mặt trời!', 200); }
      else { killBoss(boss); banner('夜明けだ！！', 'BÌNH MINH! Muzan bị mặt trời thiêu đốt!', 240); boss.burning = true; }
      Audio.sfx.gong(); G.over = 'win'; G.overT = -60;
    }
  }
  // win / lose
  if (!G.over && G.bosses.filter(b => !b.def.minion).every(b => b.dead)) { G.over = 'win'; G.overT = 0; sayLine(P.ch.lines.win, P.ch.voice); }
  if (G.over) G.overT++;
}
