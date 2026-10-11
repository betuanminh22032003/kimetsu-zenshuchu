// ============================================================
//  GAME — battle engine: players, forms, demons, hazards
// ============================================================
'use strict';

// ---------------- INPUT ----------------
const Input = { keys: {}, pressed: {}, wheel: 0, click: null };
// numeric keypad works like the number row: Numpad1-0 fire forms 1-10, - + / * fire forms 11-14, Enter confirms
const NUMPAD = { NumpadSubtract: 'Minus', NumpadAdd: 'Equal', NumpadDivide: 'BracketLeft', NumpadMultiply: 'BracketRight', NumpadEnter: 'Enter', NumpadDecimal: 'Period' };
const keyCode = c => /^Numpad\d$/.test(c) ? 'Digit' + c.slice(6) : NUMPAD[c] || c;
addEventListener('keydown', e => {
  const code = keyCode(e.code);
  if (!Input.keys[code]) Input.pressed[code] = true;
  Input.keys[code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  Audio.init();
});
addEventListener('keyup', e => { Input.keys[keyCode(e.code)] = false; });
addEventListener('blur', () => { Input.keys = {}; });
const pressed = (...ks) => ks.some(k => Input.pressed[k]);
const held = (...ks) => ks.some(k => Input.keys[k]);

let G = null;
let AL = 40, AR = W - 40; // arena bounds (x). The 3D arena is ~2.5x wider than the screen; the camera follows.
const ARENA3D = [-2200, 3480];
// ---- 3D arena depth: every entity has z (game px, + = toward the camera). Only active with the 3D renderer.
const DZ = 50;
const D3 = () => typeof R3D !== 'undefined' && R3D.ok && !(G && G.S && G.S.flat);
const zRange = () => (G && G.S && G.S.bg === 'train') ? [-95, 95] : [-300, 1100]; // wide plaza toward the camera
// arrays that stamp new entries with the depth of whoever is acting (G.cz), so FX/particles/hazards land at the right z
class ZArr extends Array { push(...a) { const z = G ? G.cz || 0 : 0; for (const it of a) if (it && typeof it === 'object' && it.z === undefined) it.z = z; return super.push(...a); } }
const zarr = () => new ZArr();
const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 2);

// ---------------- ENTITIES ----------------
function makePlayer(key) {
  const ch = CHARS[key];
  return {
    key, ch, look: ch.look, x: 280, y: GY, z: 0, vx: 0, vy: 0, vz: 0, face: 1, ground: true,
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
    key, def: d, x, y: GY, z: 0, face: -1, hp: d.hp, maxhp: d.hp, state: 'move', st: 0, cd: 80 + rnd(0, 60), atk: null,
    walk: 0, hurt: 0, flash: 0, poison: 0, burn: 0, dead: false, deadT: 0, scale: d.scale || (d.minion ? 1 : (key === 'rui' ? 1.05 : 1.25)),
    hw: d.w, hh: d.h, swing: 0.9, revived: 0, buffT: 0, mv: null, acc: 0, pending: 0, small: null,
  };
}

function startBattle(si, custom) {
  const S = custom || STAGES[si];
  const bd = BOSSES[S.boss];
  G = {
    si, S, t: 0, team: S.team.map(makePlayer), ai: 0, bosses: [], fx: zarr(), parts: zarr(), amb: zarr(), eproj: zarr(), pproj: zarr(), haz: zarr(), texts: zarr(), cz: 0,
    shake: 0, hitstop: 0, slow: 1, slowT: 0, cutin: null, banner: null, callouts: [], dawn: 0, dawnMax: bd.dawn || 0,
    tilt: 0, tiltT: 0, over: null, overT: 0, lastSay: -999, switchCd: 0, paused: false, bossLine: null,
  };
  if (D3()) { AL = ARENA3D[0]; AR = ARENA3D[1]; } else { AL = 40; AR = W - 40; }
  // story waves: some arcs make you fight through the demons met on the way before the arc's boss steps in
  G.phases = S.phases || []; G.phase = 0; G.waveT = 0; G.subs = []; G.subT = 0;
  if (G.phases.length) { spawnWave(G.phases[0], 0, 960); G.subs = (G.phases[0].lines || []).slice(); }
  else spawnMain(S, 960);
  G.ally = S.ally ? { key: S.ally, x: 120, y: GY, z: 90, face: 1, walk: 0, castT: 0, cd: 300, healCd: 600 } : null;
  G.team.forEach((p, i) => { p.x = 260 - i * 6; });
  if (S.note) banner('', S.note, 300);
  Audio.setMusic(bd.final || bd.rank && bd.rank[0] === '上' ? 'boss' : 'battle');
}

function spawnMain(S, cx) {
  const w = (S.phases || []).length, add = (b) => { b.wave = w; G.bosses.push(b); return b; };
  const b1 = add(makeBoss(S.boss, S.boss2 ? cx - 80 : cx));
  if (S.boss2) { const b2 = add(makeBoss(S.boss2, cx + 120)); if (D3()) { b1.z = -70; b2.z = 70; } }
  for (let i = 0; i < (S.minions || 0); i++) { const m = add(makeBoss('mini', cx - 340 + i * 110)); if (D3()) m.z = rnd(-150, 150); }
}
function spawnWave(ph, w, cx) {
  const keys = ph.bosses || [], n = keys.length;
  keys.forEach((k, i) => { const b = makeBoss(k, cx + (i - (n - 1) / 2) * 170); b.wave = w; if (D3()) b.z = (i - (n - 1) / 2) * 130; G.bosses.push(b); });
  for (let i = 0; i < (ph.minions || 0); i++) { const m = makeBoss('mini', cx - 120 + i * 110); m.wave = w; if (D3()) m.z = rnd(-150, 150); G.bosses.push(m); }
}
function waveCleared() { // the wave's named demons are down (or, for a wave of small fry, all of them)
  const wb = G.bosses.filter(b => (b.wave || 0) === G.phase), core = wb.filter(b => !b.def.minion);
  return (core.length ? core : wb).every(b => b.dead);
}
const WAVE_NO = ['壱', '弐', '参', '肆', '伍'];
function nextWave() {
  G.phase++; G.waveT = 110;
  for (const b of G.bosses) if (!b.dead && b.def.minion) killBoss(b); // the puppets fall with their puppeteer
  G.haz.length = 0; G.eproj.length = 0;
  for (const q of G.team) { if (q.down) continue; q.hp = Math.min(q.maxhp, q.hp + q.maxhp * 0.25); q.br = Math.min(q.maxbr, q.br + 40); }
  const ph = G.phases[G.phase], bd = BOSSES[G.S.boss];
  if (ph) banner('第' + WAVE_NO[G.phase] + '幕 ' + ph.t[0], 'Chặng ' + (G.phase + 1) + ' · ' + ph.t[1] + ' — hồi 25% máu', 150);
  else banner('最終幕 ' + bd.name, 'Chặng cuối · ' + (BOSS_VN[G.S.boss] || bd.name) + ' xuất hiện! — hồi 25% máu', 170);
}
function spawnNextWave() {
  const P = activeP(), dir = P.x < (AL + AR) / 2 ? 1 : -1, cx = clamp(P.x + dir * 620, AL + 200, AR - 200);
  G.bosses = G.bosses.filter(b => !b.dead);
  const ph = G.phases[G.phase];
  if (ph) spawnWave(ph, G.phase, cx); else spawnMain(G.S, cx);
  for (const b of G.bosses) { b.face = -dir; G.cz = b.z || 0; particles('demon', b.x, b.y - 60, 26, 6, { k: 'smoke' }); b.flash = 20; }
  G.subs = ((ph ? ph.lines : G.S.last) || []).slice(); G.subT = 0;
  G.shake = 14; Audio.sfx.gong();
}
// Tamayo: keeps behind the slayer, clouds the demons' senses with her blood art and tends the wounded
function updateAlly(A) {
  const P = activeP(), d3 = D3();
  const gx = P.x - P.face * 150, gz = (P.z || 0) + 90, dx = gx - A.x, dz = gz - A.z;
  if (Math.abs(dx) > 30) { A.x += Math.sign(dx) * Math.min(Math.abs(dx), 6.5); A.walk += 0.25; }
  if (d3 && Math.abs(dz) > 20) A.z += Math.sign(dz) * Math.min(Math.abs(dz), 4.5);
  const e = nearestEnemy(A); A.face = e ? Math.sign(e.x - A.x) || A.face : P.face;
  if (A.castT > 0) A.castT--;
  if (G.waveT || G.over) return;
  if (--A.cd <= 0) { // 惑血「視覚夢幻の香」: a flower-patterned scent that makes the demons see things
    A.cd = 660; A.castT = 40;
    const foes = aliveEnemies(); for (const b of foes) { b.confT = 300; G.cz = b.z || 0; particles('flower', b.x, b.y - b.hh * 0.7, 18, 4, { k: 'petal', g: -0.01 }); }
    G.cz = A.z; particles('flower', A.x, A.y - 90, 30, 6, { k: 'petal', g: -0.01 });
    addText(A.x, A.y - 190, '惑血「視覚夢幻の香」', '#f0a8ff', 22);
    if (foes.length) banner('', 'Tamayo · 惑血 — lũ quỷ bị ảo giác, đánh trật hướng trong 5 giây!', 110);
    Audio.say('わくち、しかくむげんのこう', 1.05, 1.1, 1); Audio.sfx.breath();
  }
  if (--A.healCd <= 0) { // her medicine
    const hurt = G.team.filter(q => !q.down && q.hp < q.maxhp * 0.7);
    if (hurt.length) { A.healCd = 900; A.castT = 30; for (const q of hurt) { q.hp = Math.min(q.maxhp, q.hp + q.maxhp * 0.15); } G.cz = P.z || 0; particles('flower', P.x, P.y - 80, 20, 4, { k: 'petal', g: -0.05 }); addText(P.x, P.y - 170, '珠世の薬 +15%', '#b8ffcf', 20); Audio.sfx.pickup(); }
    else A.healCd = 120;
  }
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
  for (const b of aliveEnemies()) { const d = Math.abs(b.x - P.x) + Math.abs((b.z || 0) - (P.z || 0)) * 1.4; if (d < bd) { bd = d; best = b; } }
  return best;
}

// ---------------- FINISHING RULES ----------------
// Each demon only falls the way it fell in the story (see SECRETS.md, kept out of the repo).
// fin(b, grp, P): may this hit take the demon below 10%?  dawn(b, grp, P): extra seconds of dawn for this hit.
const FIN = {
  temoni: { fin: (b, g) => g.form === '水面斬り' },
  susamaru: { fin: (b, g, P) => P && P.key === 'nezuko' },
  kyogai: { fin: (b, g) => g.form === '水流飛沫・乱' },
  rui: { fin: (b, g, P) => P && P.key === 'giyu' && P.buffs.nagi > 0 },
  enmu: { fin: (b, g) => g.form === '碧羅の天' },
  akaza: { dawn: (b, g, P) => P && P.key === 'rengoku' && g.form === '煉獄' ? 15 : 0 },
  daki: { fin: (b, g, P) => P && (P.key === 'inosuke' || P.key === 'zenitsu') },
  gyutaro: { fin: (b, g, P) => P && P.key === 'tanjiro' },
  gyokko: { fin: (b, g, P) => P && P.key === 'muichiro' && P.buffs.invis > 0 },
  hantengu: { small: (b, g, P) => P && P.key === 'tanjiro' },
  doma: { fin: (b, g, P) => P && P.key === 'kanao' && (b.poisonTotal || 0) >= 30 },
  akaza2: { fin: (b, g, P) => !b.revived || (P && P.key === 'tanjiro' && g.theme === 'sun') },
  kokushibo: { fin: (b, g, P) => P && (P.key === 'gyomei' || P.key === 'sanemi') && b.hitBy && b.hitBy.muichiro },
  muzan: { dawn: (b, g, P) => P && P.key === 'tanjiro' && g.kind === 'combo13' ? 4 : 0 },
  yahaba: { fin: (b, g, P) => P && P.key === 'tanjiro' },
  spider_mother: { fin: (b, g, P) => P && P.key === 'tanjiro' && g.form === '干天の慈雨' },
  spider_father: { fin: (b, g, P) => P && P.key === 'giyu' },
  daki_solo: { fin: (b, g, P) => P && P.key === 'tengen' },
};
const finLocked = (b) => { const r = FIN[b.key]; return !!(r && r.fin && !b.finOpen && !G.S.training); };
function finFloor(b) { return b.maxhp * 0.1; }

// ---------------- DAMAGE: PLAYER -> DEMON ----------------
function newGrp(P, dmg, c, extra) {
  const f = c && c.f || {};
  return Object.assign({ hit: new Set(), dmg, P, form: f.name || null, kind: c ? (c.from13 ? 'combo13' : c.kind) : null, theme: c ? c.th : 'normal', poison: f.poison, mercy: f.mercy, heavy: dmg >= 60, burn: f.burn }, extra || {});
}
function strike(grp, x, y, r) {
  const zc = G.cz || 0, d3 = D3();
  for (const b of G.bosses) {
    if (b.dead) continue;
    if (b.small && b.small.hp > 0 && !grp.hit.has(b.small) && Math.hypot(b.small.x - x, b.small.y - 14 - y) < r + 20 && (!d3 || Math.abs((b.small.z || 0) - zc) < DZ + r * 0.4)) {
      grp.hit.add(b.small); hitSmall(b, grp, x, y);
    }
    if (grp.hit.has(b)) continue;
    if (d3 && Math.abs((b.z || 0) - zc) > DZ + r * 0.4 + b.hw * 0.3) continue; // out of the attack's depth band
    const [rx, ry, rw, rh] = bossRect(b);
    if (circleRect(x, y, r, rx, ry, rw, rh)) { grp.hit.add(b); damageEnemy(b, grp, clamp(x, rx, rx + rw), clamp(y, ry, ry + rh)); }
  }
}
function damageEnemy(b, grp, hx, hy) {
  const P = grp.P, cz0 = G.cz; G.cz = b.z || 0;
  const rule = FIN[b.key]; let finOk = !finLocked(b); // judged before buffs are consumed
  if (!finOk && rule.fin(b, grp, P)) { finOk = true; b.finWin = 240; b.finBy = P && P.key; } // the right move opens a 4s finishing window
  else if (!finOk && b.finWin > 0 && P && P.key === b.finBy) finOk = true;
  let d = grp.dmg * rnd(0.9, 1.1), crit = false;
  if (P && P.buffs.sense && Math.random() < 0.4) { d *= 1.8; crit = true; }
  if (P && P.buffs.invis) { d *= 2; crit = true; P.buffs.invis = 0; }
  if (grp.mercy && b.hp < b.maxhp * 0.3) { d *= 3; crit = true; }
  if (P && P.counter > 0) { d *= 2; crit = true; P.counter = 0; }                       // after a parry: guaranteed crit
  const isNormal = grp.kind === 'normal' || !grp.form, boss = !b.def.minion && !b.def.training;
  // demons read a slash-only string: 6 plain slashes in a row and they start deflecting plain slashes
  if (boss && isNormal && b.guardT > 0 && !(b.stunT > 0)) {
    b.guardT = Math.max(b.guardT, 40); G.cz = b.z || 0; particles('normal', hx, hy, 8, 6, { k: 'spark' }); addText(hx, hy - 20, '弾 · Đỡ', '#c8d8ff', 18); Audio.sfx.hit();
    d *= 0.15; b.hp -= d; if (!finOk && b.hp < finFloor(b)) b.hp = Math.min(b.hp + d, Math.max(b.hp, finFloor(b))); G.combo = Math.max(0, (G.combo || 0) - 2); if (b.hp <= 0) checkBossDeath(b); G.cz = cz0; return;
  }
  if (boss) { if (isNormal) { b.normalRun = (b.normalRun || 0) + 1; if (b.normalRun >= 6 && !(b.stunT > 0)) { b.guardT = 150; b.normalRun = 0; addText(b.x, b.y - b.hh - 30, '見切られた！ Bị đọc đòn!', '#ff9aa8', 20); b.cd = Math.min(b.cd, 12); } } else b.normalRun = 0; }
  // combo chain: every landed hit within 2s extends it; switching technique adds a bonus step
  const mv = grp.form || 'normal';
  G.combo = (G.comboT > 0 ? G.combo || 0 : 0) + (G.lastMove && G.lastMove !== mv ? 2 : 1); G.comboT = 120; G.lastMove = mv; G.comboMax = Math.max(G.comboMax || 0, G.combo);
  d *= 1 + Math.min(G.combo, 50) * 0.01;
  if (b.stunT > 0) { d *= 1.5; crit = true; }
  if (P) d *= P.ch.atk || 1;
  // posture: techniques break a demon's stance far faster than plain slashes
  if (boss && !(b.stunT > 0)) { b.post = (b.post || 0) + d * (isNormal ? 0.18 : 0.75); b.postT = 120; if (b.post >= postMax(b)) stagger(b); }
  if (b.pending) d = 0;
  const hp0 = b.hp;
  if (P) (b.hitBy || (b.hitBy = {}))[P.key] = 1;
  if (grp.poison) b.poisonTotal = (b.poisonTotal || 0) + grp.poison;
  if (rule && rule.dawn && G.dawnMax && !grp.dawnDone) { const sec = rule.dawn(b, grp, P); if (sec) { grp.dawnDone = 1; G.dawn += sec * 60; } }
  b.hp -= d; b.flash = 4; b.hurt = 10;
  if (!finOk && b.hp < finFloor(b)) { b.hp = Math.max(b.hp, Math.min(hp0, finFloor(b))); if (!b.finShown) { b.finShown = 1; banner('頸が斬れない…！', 'Không chém đứt được cổ…!', 110); } } b.noRegen = 300; // no regeneration for 5s after a hit
  if (grp.poison) { b.poison = Math.min(40, b.poison + grp.poison); addText(hx, hy - 30, '毒 Độc', '#c080ff', 18); Audio.sfx.poison(); }
  if (grp.burn) b.burn = 300;
  if (G.dawnMax) G.dawn += d * 0.6;
  if (G.S.training) { G.trainDmg = (G.trainT > 0 ? G.trainDmg : 0) + d; G.trainT = 150; G.trainHits = (G.trainT2 > 0 ? G.trainHits : 0) + 1; G.trainT2 = 150; }
  if (P) P.br = Math.min(P.maxbr, P.br + 1.5);
  particles(grp.theme, hx, hy, grp.heavy ? 26 : 12, grp.heavy ? 9 : 6);
  particles('demon', hx, hy, 6, 5, { k: 'blood', g: 0.3 });
  addText(hx + rnd(-20, 20), hy - 10, Math.round(d) + (crit ? '!' : ''), crit ? '#ffdd40' : '#fff', crit ? 30 : 22);
  G.hitstop = Math.max(G.hitstop, grp.heavy ? 5 : 2);
  G.shake = Math.max(G.shake, grp.heavy ? 12 : 4);
  grp.heavy ? Audio.sfx.bigHit() : Audio.sfx.hit();
  if (b.hp <= 0) checkBossDeath(b);
  G.cz = cz0;
}
const postMax = b => Math.max(120, b.maxhp * 0.11);
function stagger(b) {
  b.post = 0; b.stunT = 180; b.guardT = 0; b.state = 'move'; b.mv = null; b.st = 0; b.cd = Math.max(b.cd, 60);
  G.cz = b.z || 0; addText(b.x, b.y - b.hh - 40, '隙！ CHOÁNG!', '#ffe070', 30); particles('normal', b.x, b.y - b.hh, 24, 7, { k: 'spark' });
  G.hitstop = Math.max(G.hitstop, 8); G.shake = Math.max(G.shake, 14); Audio.sfx.gong();
  G.haz = G.haz.filter(h => h.src !== b.x || !(h.delay > 0)); // a broken stance cancels the attack it was winding up
}
function hitSmall(b, grp, x, y) {
  const d = grp.dmg * 2.5; G.cz = b.small.z || 0;
  const rule = FIN[b.key], ok = !(rule && rule.small) || b.finOpen || rule.small(b, grp, grp.P);
  if (!ok && b.small.hp - d <= 0) { b.small.hp = 1; if (!b.finShown) { b.finShown = 1; banner('頸が斬れない…！', 'Không chém đứt được cổ…!', 110); } Audio.sfx.hit(); return; }
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
  if (d.training) { b.hp = b.maxhp; return; }
  if (G.dawnMax && G.dawn < G.dawnMax) {
    b.hp = b.maxhp * 0.15; b.regenBurst = 90;
    banner('再生する…！', 'Hắn tái sinh! Cầm cự tới bình minh!', 120); return;
  }
  if (d.trueBody && !(b.small && b.small.hp <= 0)) {
    b.hp = b.maxhp * 0.12;
    if (!b.small) b.small = { x: b.x < (AL + AR) / 2 ? clamp(b.x + 700, AL + 80, AR - 80) : clamp(b.x - 700, AL + 80, AR - 80), y: GY, z: D3() ? rnd(-150, 150) : 0, hp: 360, vx: 3, vz: 0 };
    banner('本体を探せ！', 'Đó không phải bản thể! Chém con quỷ nhỏ 「恨」!', 150); return;
  }
  if (d.neckRegen && !b.revived) {
    b.revived = 1; b.hp = b.maxhp * 0.25;
    banner('頸を斬っても…再生する！？', 'Chém cổ rồi mà vẫn tái sinh!? Đánh tiếp!', 150); Audio.sfx.gong(); return;
  }
  if (G.S.boss2 && !d.minion && (b.key === G.S.boss || b.key === G.S.boss2)) {
    const other = G.bosses.find(o => o !== b && (o.key === G.S.boss || o.key === G.S.boss2));
    if (!b.pending) { b.pending = 240; b.hp = 0; }
    if (other && (other.pending || other.dead)) { killBoss(b); killBoss(other); }
    else banner('もう一体の頸も斬れ！', 'Nhanh! Chém cổ con còn lại trong 4 giây!', 120);
    return;
  }
  killBoss(b);
}
function killBoss(b) {
  if (b.dead) return;
  b.dead = true; b.deadT = 0; b.pending = 0; G.cz = b.z || 0;
  if (!b.def.minion) {
    G.hitstop = 24; G.shake = 26;
    G.bigKanji = { s: '斬', t: 0 };
    Audio.sfx.bigHit(); setTimeout(() => Audio.sfx.gong(), 300);
    particles('demon', b.x, b.y - b.hh, 50, 12, { k: 'blood', g: 0.3 });
  }
}

// ---------------- DAMAGE: DEMON -> PLAYER ----------------
function playerVulnerable(P) {
  if (P.down || P.inv > 0) return false;
  if (P.parryT > 0) { parried(P); return false; }
  if (P.dashT > 0) { if (!P.dodged && P.dashAge <= 9) perfectDodge(P); return false; }
  if (P.buffs.evade) return false;
  if (P.cast && (P.cast.inv || (P.cast.sub && P.cast.sub.inv))) return false;
  return true;
}
function deflect(P, p) { // send an enemy projectile back at the nearest demon
  const e = nearestEnemy(P), tx = e ? e.x : P.x + P.face * 600, ty = e ? e.y - e.hh * 0.55 : p.y, tz = e ? e.z || 0 : p.z || 0;
  const dx = tx - p.x, dy = ty - p.y, dz = tz - (p.z || 0), L = Math.hypot(dx, dy, dz) || 1, sp = Math.max(16, Math.hypot(p.vx, p.vy) * 1.4);
  p.vx = dx / L * sp; p.vy = dy / L * sp; p.vz = dz / L * sp; p.reflected = true; p.homing = 0; p.fall = 0; p.bounce = 0; p.life = 140; p.sleep = 0;
  p.grp = newGrp(P, Math.max(22, (p.dmg || 10) * 2.2), { th: curStyle(P).theme, kind: 'deflect', f: { name: '弾き返し' } }, { heavy: true });
  G.cz = p.z || 0; particles('normal', p.x, p.y, 12, 6, { k: 'spark' }); Audio.sfx.hit();
  if (!P.deflected) { P.deflected = 1; addText(P.x, P.y - 170, '弾き返し！ ĐÁNH BẬT!', '#fff2a0', 24); P.br = Math.min(P.maxbr, P.br + 8); G.hitstop = Math.max(G.hitstop, 4); }
}
function parried(P) { // 受け流し: deflect, steal posture from the nearest demon, next hit is a guaranteed crit
  P.parryT = 0; P.inv = Math.max(P.inv, 24); P.counter = 120; P.br = Math.min(P.maxbr, P.br + 12);
  G.cz = P.z || 0; fxRing(P.x, P.y - 80, 70, curStyle(P).theme, 14); particles('normal', P.x + P.face * 30, P.y - 90, 18, 7, { k: 'spark' }); addText(P.x, P.y - 170, '受け流し！ ĐỠ!', '#ffffff', 26);
  G.hitstop = Math.max(G.hitstop, 7); G.shake = Math.max(G.shake, 8); Audio.sfx.chain();
  const e = nearestEnemy(P); if (e && !e.def.minion && Math.abs(e.x - P.x) < 320) { e.post = (e.post || 0) + postMax(e) * 0.4; e.postT = 120; if (e.post >= postMax(e)) stagger(e); }
}
function perfectDodge(P) { // 見切り: slow motion, breath refill, next technique at half cost
  P.dodged = true; P.inv = Math.max(P.inv, 30); P.halfCost = 180; P.br = Math.min(P.maxbr, P.br + 25);
  G.slow = 0.3; G.slowT = 55; G.cz = P.z || 0; addText(P.x, P.y - 170, '見切り！ NÉ HOÀN HẢO', '#9fe8ff', 24); Audio.sfx.wind();
  const e = nearestEnemy(P); if (e && !e.def.minion) { e.post = (e.post || 0) + postMax(e) * 0.15; e.postT = 120; }
}
function hurtPlayer(P, dmg, sx, opts) {
  if (!playerVulnerable(P)) return false;
  if (P.buffs.guard) dmg *= 0.3;
  G.cz = P.z || 0;
  G.combo = 0; G.comboT = 0;
  dmg *= P.ch.def || 1;
  P.hp -= dmg; P.inv = 45; P.hurtT = 16; P.cast = null; P.swing = undefined; P.spin = 0;
  P.vx = Math.sign(P.x - sx || 1) * 6; P.vy = -5;
  if (opts && opts.poison) P.poison = Math.round(360 * (P.ch.poisonRes || 1));
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
  P.x = old.x; P.y = old.y; P.z = old.z; P.face = old.face; P.vx = P.vy = P.vz = 0; P.cast = null; P.hurtT = 0; P.inv = 40; P.sleep = old.sleep;
  G.ai = i; G.switchCd = 40;
  particles('mist', P.x, P.y - 70, 20, 4, { k: 'smoke' });
  addText(P.x, P.y - 170, P.ch.name + ' · ' + P.ch.vn.split(' — ')[0], '#fff', 18);
  Audio.sfx.select();
  sayLine(P.ch.lines.start, P.ch.voice, 2);
}
function sayLine(text, pitch, prio) { if (Audio.say(text, pitch, undefined, prio) && G) G.lastSay = G.t; }

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
    G.cz = e.z || 0;
    if (e.type === 'slash') {
      if (e.P) { e.cx = e.P.x + e.dx; e.cy = e.P.y + e.dy; e.z = e.P.z; }
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
      const P = e.P; e.z = P.z; G.cz = P.z; const u = clamp((e.t - 2) / 8, 0, 1);
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
      if ((P.bufJ > 0 || held('KeyJ')) && c.t > 5) { c.queue = true; P.bufJ = 0; } // hold J = auto combo
      if (P.bufK > 0 && c.t > 4) { P.bufK = 0; P.cast = null; tryCast(P); }          // cancel a slash into a form
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
        c.sub = { kind: f.kind, f, th: 'sun', t: 0, dur: 20, data: {}, from13: 1 };
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
// soft lock-on: attacks turn toward the nearest demon and drift into its depth lane
function aimAt(P) {
  P.vz = 0; P.az = undefined;
  if (!D3()) return;
  const e = nearestEnemy(P); if (!e) return;
  if (Math.abs(e.x - P.x) < 760 && Math.abs((e.z || 0) - P.z) < 300) { P.az = e.z || 0; if (Math.abs(e.x - P.x) > 24) P.face = Math.sign(e.x - P.x); }
}
function beginNormal(P, combo) {
  aimAt(P);
  const c = { kind: 'normal', combo: combo % 3, th: P.ch.kick ? 'blood' : curStyle(P).theme, t: 0, dur: 15 };
  KINDS.normal.start(P, c); P.cast = c;
}
function tryCast(P) {
  const st = curStyle(P), f = curForm(P);
  const cost = P.halfCost > 0 ? Math.ceil(f.cost / 2) : f.cost;
  if (P.br < cost) { addText(P.x, P.y - 170, '呼吸が足りない！ Hết hơi!', '#9cf', 18); Audio.sfx.select(); return; }
  P.br -= cost; if (P.halfCost > 0) P.halfCost = 0;
  if (f.hpCost) P.hp = Math.max(1, P.hp - f.hpCost);
  callout(P, f, st);
  if (f.big) { G.cutin = { P, f, st, t: 0, dur: 58 }; Audio.sfx.cutin(); }
  else beginCast(P, f, st);
}
function beginCast(P, f, st) {
  aimAt(P);
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
  // voice: at the default level only finishers and the odd technique (one every ~6 s) are read out, and only the
  // technique's own name; at full level every technique, still never more often than every 1.5 s
  const lv = Audio.voiceLv, gap = G.t - (G.lastSay || -999);
  if (!lv) return;
  if (f.big) sayLine(kana, P.ch.voice, 2);
  else if (lv === 2 ? gap > 90 : gap > 360) sayLine(lv === 2 ? kana : (f.kataKana ? f.kataKana + '、' : '') + f.kana, P.ch.voice, 1);
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
  if (D3()) { P.z += P.vz || 0; const zr = zRange(); P.z = clamp(P.z, zr[0], zr[1]); }
  if (G.tiltT > 0) P.x += G.tilt * 2.2;
  if (P.y >= GY) { P.y = GY; P.vy = 0; P.ground = true; } else P.ground = false;
  P.x = clamp(P.x, AL, AR);
}
function updatePlayer(P) {
  G.cz = P.z || 0;
  // input buffer: a press made slightly early (during an attack, a hit-stun or a dash) still comes out
  if (pressed('KeyJ')) P.bufJ = 12; else if (P.bufJ > 0) P.bufJ--;
  if (pressed('KeyK')) P.bufK = 12; else if (P.bufK > 0 && !P.qcast) P.bufK--;
  P.qcast = false;
  if (P.inv > 0) P.inv--;
  if (P.dashCd > 0) P.dashCd--;
  if (P.parryT > 0 && --P.parryT === 0) P.swing = undefined; if (P.parryCd > 0) P.parryCd--; if (P.counter > 0) P.counter--; if (P.halfCost > 0) P.halfCost--;
  if (P.dashT > 0) P.dashAge = (P.dashAge || 0) + 1;
  if (G.comboT > 0 && --G.comboT === 0) G.combo = 0;
  if (pressed('KeyG') && P.parryCd <= 0 && !P.down && P.hurtT <= 0) { // 弾き: a quick deflecting slash — bats projectiles back, parries blows
    P.parryT = 16; P.parryCd = 32; P.cast = null; P.swing = -1.6; P.deflected = 0; aimAt(P);
    fxSlash(P, 95, -1.7, 1.1, 18, curStyle(P).theme, { sweep: 5, fade: 9, alpha: 0.9 }); Audio.sfx.swing();
  }
  if (P.parryT > 0) P.swing = lerp(1.1, -1.6, P.parryT / 16);
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
  if (P.cast) { if (P.az !== undefined) P.vz = clamp((P.az - P.z) * 0.2, -9, 9); runCast(P); const c = P.cast; physics(P, c && c.noGrav); if (c && c.noGrav) P.vy = 0; return; }
  if (P.hurtT > 0) { P.hurtT--; P.vx *= 0.9; P.vz *= 0.85; physics(P); return; }
  if (P.dashT > 0) {
    const dd = P.dashDir || [P.face, 0];
    P.dashT--; P.x += dd[0] * 15; P.vz = dd[1] * 13; P.vy = Math.min(P.vy, 2); ghost(P); physics(P, true); P.vx = 0;
    if (P.dashT === 0) P.vy = 0;
    return;
  }
  const mv = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
  const mz = D3() ? (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0) : 0; // 8-direction movement in 3D
  if (held('KeyL') && P.ground) {
    P.zen = true; P.vx = 0; P.vz = 0; P.br = Math.min(P.maxbr, P.br + 0.75);
    if (G.t % 3 === 0) particles(curStyle(P).theme, P.x + rnd(-30, 30), P.y - rnd(20, 140), 1, 1, { g: -0.06 });
    if (G.t % 50 === 0) Audio.sfx.breath();
  } else {
    const len = Math.hypot(mv, mz) || 1, sp = P.ch.speed * (P.buffs.slowed ? 0.6 : 1);
    P.vx = mv / len * sp; P.vz = mz / len * sp * 0.85;
    if (mv) P.face = mv;
    if (mv || mz) P.walk += 0.32; else P.walk = 0;
  }
  if ((D3() ? pressed('Space') : pressed('KeyW', 'Space', 'ArrowUp')) && P.ground) { P.vy = -15.5; }
  if (pressed('ShiftLeft', 'ShiftRight', 'KeyI') && P.dashCd <= 0) { const l = Math.hypot(mv, mz); P.dashDir = l ? [mv / l, mz / l] : [P.face, 0]; P.dashAge = 0; P.dodged = false; P.dashT = 11; P.dashCd = 34; P.inv = Math.max(P.inv, 13); if (mv) P.face = mv; Audio.sfx.wind(); }
  if (P.bufK > 0) { P.bufK = 0; tryCast(P); }
  else if (P.bufJ > 0 || held('KeyJ')) { P.bufJ = 0; beginNormal(P, 0); }
  P.br = Math.min(P.maxbr, P.br + 0.09 * (P.ch.brRegen || 1));
  if (P.ch.hpRegen) P.hp = Math.min(P.maxhp, P.hp + P.ch.hpRegen);
  physics(P);
}
const PALETTE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft', 'BracketRight'];
const PALETTE_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', '[', ']'];
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
    if (s2.theme === 'sun') { particles('sun', P.x, P.y - 80, 30, 6); if (Audio.voiceLv === 2) sayLine('ひのかみかぐら', P.ch.voice, 1); }
  }
  if (G.palette) {
    PALETTE_KEYS.forEach((code, i) => { if (pressed(code) && i < n) { P.formIdx[P.styleIdx] = i; Audio.sfx.select(); } });
    return;
  }
  // number keys fire that form straight away (no need to scroll with Q/E first)
  for (let i = 0; i < Math.min(n, PALETTE_KEYS.length); i++) if (pressed(PALETTE_KEYS[i])) { P.formIdx[P.styleIdx] = i; P.bufK = 12; P.qcast = true; }
  if (pressed('Tab', 'KeyC')) { for (let k = 1; k <= G.team.length; k++) { const j = (G.ai + k) % G.team.length; if (!G.team[j].down) { switchTo(j); break; } } }
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
  if (b.guardT > 0) b.guardT--;
  if (b.postT > 0) b.postT--; else if (b.post > 0) b.post = Math.max(0, b.post - postMax(b) * 0.004);
  if (b.stunT > 0) { b.stunT--; b.swing = 1.5; b.walk = 0; if (b.flash > 0) b.flash--; if (b.hurt > 0) b.hurt--; if (G.t % 8 === 0) { G.cz = b.z || 0; particles('thunder', b.x + rnd(-20, 20), b.y - b.hh - 10, 1, 1, { k: 'spark', g: -0.02 }); } return; }
  // regen, poison, burn
  const poisonF = Math.max(0, 1 - b.poison / 20);
  if (b.noRegen > 0) b.noRegen--;
  if (b.finWin > 0) b.finWin--;
  else b.hp = Math.min(b.maxhp, b.hp + d.regen * (G.dawnMax ? 1 : 0.3) * poisonF * (b.regenBurst > 0 ? 6 : 1) * (G.S.drug && b.key === G.S.boss ? 0.55 : 1)); // demons heal (Muzan: Tamayo's drug slows it), but slowly enough to be outfought
  if (b.regenBurst > 0 && b.noRegen > 0) b.hp = Math.min(b.maxhp, b.hp + d.regen * 4); // dawn-stage forced regeneration still works
  if (b.regenBurst > 0) b.regenBurst--;
  if (finLocked(b) || (FIN[b.key] && FIN[b.key].small && !b.finOpen)) { if (b.hp <= finFloor(b) * 1.15 || (b.small && b.small.hp <= 1)) { b.finT = (b.finT || 0) + 1; if (b.finT > 5400) b.finOpen = true; } } // 90s stuck: any blow may finish
  const floorHp = finLocked(b) ? finFloor(b) : 0;
  if (b.poison > 0) { b.hp -= b.poison * 0.035; b.poison = Math.max(0, b.poison - 0.008); if (G.t % 12 === 0) G.parts.push({ x: b.x + rnd(-20, 20), y: b.y - rnd(40, b.hh), vx: 0, vy: -1, life: 30, max: 30, s: 4, c: '#b070ff', k: 'drop', g: -0.02 }); if (floorHp) b.hp = Math.max(b.hp, Math.min(floorHp, b.hp + b.poison * 0.035)); if (b.hp <= 0) checkBossDeath(b); }
  if (b.burn > 0) { b.burn--; b.hp -= 0.25; if (floorHp && b.hp < floorHp) b.hp = Math.min(floorHp, b.hp + 0.25); if (G.t % 4 === 0) particles('blood', b.x + rnd(-25, 25), b.y - rnd(20, b.hh), 1, 2, { g: -0.1 }); if (b.hp <= 0) checkBossDeath(b); }
  if (b.flash > 0) b.flash--; if (b.hurt > 0) b.hurt--; if (b.buffT > 0) b.buffT--;
  if (b.small && b.small.hp > 0) { const s = b.small; s.x += s.vx; if (s.x < AL + 20 || s.x > AR - 20 || Math.random() < 0.01) s.vx *= -1; if (Math.abs(s.x - P.x) < 120) s.vx = Math.sign(s.x - P.x) * 4.5; s.x = clamp(s.x, AL, AR);
    if (D3()) { if (Math.random() < 0.02) s.vz = rnd(-3, 3); if (Math.abs(s.x - P.x) < 160 && Math.abs((s.z || 0) - P.z) < 120) s.vz = Math.sign((s.z || 0) - P.z || 1) * 3.5; const zr = zRange(); s.z = clamp((s.z || 0) + (s.vz || 0), zr[0], zr[1]); } }
  const phase2 = b.hp < b.maxhp * 0.5;
  if (b.confT > 0) { b.confT--; if (G.t % 10 === 0) { G.cz = b.z || 0; particles('flower', b.x + rnd(-20, 20), b.y - b.hh - 10, 1, 1, { k: 'petal', g: -0.01 }); } }
  const lost = P.buffs.invis || b.confT > 0;
  const tx = lost ? (b.fakeX || (b.fakeX = clamp(P.x + (Math.random() < 0.5 ? -1 : 1) * rnd(260, 520), AL + 60, AR - 60))) : P.x;
  if (!lost) b.fakeX = 0;
  const spd = (b.buffT > 0 ? 1.6 : 1) * (phase2 ? 1.2 : 1);
  if (b.state === 'move') {
    b.swing = 0.9 + Math.sin(G.t * 0.05) * 0.1;
    const dx = tx - b.x; b.face = Math.sign(dx) || b.face;
    const want = d.minion ? 50 : 200;
    if (Math.abs(dx) > want + 30) { b.x += Math.sign(dx) * d.speed * spd; b.walk += 0.2; }
    else if (Math.abs(dx) < want - 80 && !d.minion && !(b.noRegen > 90)) { b.x -= Math.sign(dx) * d.speed * 0.45; b.walk += 0.15; } // backs off only when not under pressure
    if (D3() && d.speed) { // close the depth gap too (demons stalk you around the arena)
      const tz = lost ? (b.fakeZ === undefined ? (b.fakeZ = rnd(-180, 180)) : b.fakeZ) : P.z, dz = tz - b.z;
      if (!lost) b.fakeZ = undefined;
      if (Math.abs(dz) > 14) { b.z += Math.sign(dz) * Math.min(Math.abs(dz), d.speed * spd * 0.75); if (Math.abs(dx) <= want + 30) b.walk += 0.2; }
    }
    b.cd -= spd;
    if (d.teleport && Math.random() < 0.0018) { particles('water', b.x, b.y - 80, 20, 5); b.x = clamp(P.x + (Math.random() < 0.5 ? -1 : 1) * rnd(180, 340), AL + 60, AR - 60); if (D3()) b.z = clamp(P.z + rnd(-140, 140), ...zRange()); G.cz = b.z; particles('water', b.x, b.y - 80, 20, 5); }
    if (b.cd <= 0) {
      const pool = d.atks.concat(phase2 && d.p2 ? d.p2 : []);
      if (!pool.length) { b.cd = 600; return; }
      b.atk = pool[Math.floor(Math.random() * pool.length)];
      b.state = 'tele'; b.st = 0;
    }
  } else if (b.state === 'tele') {
    b.st++;
    b.swing = lerp(0.9, -2.0, b.st / b.atk.tele);
    const nh = G.haz.length;
    const aim = b.confT > 0 && b.fakeX ? Object.assign({}, P, { x: b.fakeX, z: b.fakeZ !== undefined ? b.fakeZ : P.z }) : P; // a phantom target while confused
    if (b.st === 1) onTele(b, b.atk, aim);
    if (b.st >= b.atk.tele) { execAttack(b, b.atk, aim); b.state = 'recover'; b.st = 0; }
    for (let i = nh; i < G.haz.length; i++) { const h = G.haz[i]; h.bk = b.key; h.bx = b.x; h.bz = b.z || 0; } // who cast it (the 3D look is per demon)
  } else if (b.state === 'recover') {
    b.st++;
    b.swing = lerp(-2.0, 1.2, Math.min(1, b.st / 6));
    if (b.mv) {
      b.x += b.mv.vx; b.z += b.mv.vz || 0; b.mv.n--;
      const [rx, ry, rw, rh] = bossRect(b), [px, py, pw, ph] = playerRect(P);
      if (rx < px + pw && rx + rw > px && ry < py + ph && ry + rh > py && !b.mv.hit && (!D3() || Math.abs(b.z - P.z) < DZ + 22)) { if (hurtPlayer(P, b.mv.dmg, b.x, b.atk)) b.mv.hit = 1; }
      if (G.t % 2 === 0) G.fx.push({ type: 'bghost', b, x: b.x, y: b.y, face: b.face, t: 0, life: 10 });
      if (b.mv.n <= 0) {
        if (b.mv.again > 0) { const a = b.mv.again - 1; b.face = Math.sign(P.x - b.x) || b.face; b.mv = { vx: b.face * 22, vz: D3() ? (P.z - b.z) / 14 : 0, n: 14, dmg: b.mv.dmg, again: a }; }
        else b.mv = null;
      }
    }
    if (b.st >= 34 && !b.mv) { b.state = 'move'; b.cd = b.atk.cd * (phase2 ? 0.75 : 1) * (d.minion ? 1.5 : 1); }
  }
  b.x = clamp(b.x, AL + 20, AR - 20);
  if (D3()) { const zr = zRange(); b.z = clamp(b.z, zr[0], zr[1]); }
  // contact
  if (!d.minion || true) {
    const [rx, ry, rw, rh] = bossRect(b), [px, py, pw, ph] = playerRect(P);
    if (rx + 10 < px + pw && rx + rw - 10 > px && ry < py + ph && ry + rh > py && G.t % 30 === 0 && (!D3() || Math.abs(b.z - P.z) < DZ + 10)) hurtPlayer(P, 6, b.x);
  }
}

function bossCallout(b, a) {
  if (!a.n) return;
  G.bossLine = { s: a.n, t: 0, b };
  const gap = Audio.voiceLv === 2 ? 150 : 360; // demons name their blood arts too, but not every single time
  if (G.t - G.lastSay > 70 && G.t - (G.lastBossSay || -999) > gap && Audio.say(a.n.replace(/・/g, '、'), SPEAKERS[b.key] ? SPEAKERS[b.key].voice : 0.8, 1.2, 1)) G.lastBossSay = G.t;
}
function onTele(b, a, P) {
  bossCallout(b, a); Audio.sfx.tele();
  const T = a.tele;
  switch (a.type) {
    case 'lines': {
      for (let i = 0; i < a.count; i++) {
        let ang, cx = P.x + rnd(-120, 120), cy = P.y - rnd(20, 160); G.cz = P.z + (a.count > 2 && D3() ? rnd(-70, 70) : 0);
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
      for (let i = 0; i < 14; i++) { G.cz = D3() ? clamp(P.z + rnd(-160, 160), ...zRange()) : 0; addLine(clamp(P.x + rnd(-560, 560), AL, AR), GY - rnd(30, 300), rnd(0, Math.PI), T + i * 5, Object.assign({}, a, { style: a.moon ? 'moon' : a.whip ? 'whip' : 'storm' }), b); }
      break;
    }
    case 'circle': {
      const x = a.self ? b.x : P.x, y = a.self ? b.y - 80 : GY - 60;
      G.haz.push({ type: 'circle', x, y, z: a.self ? b.z : P.z, r: a.r || 140, delay: T, life: 14, dmg: a.dmg, a, src: b.x, follow: a.self ? b : null });
      break;
    }
    case 'arms': {
      for (let i = 0; i < a.count; i++) {
        const x = clamp(P.x + (i - (a.count - 1) / 2) * 90 + rnd(-20, 20), AL, AR);
        G.haz.push({ type: 'arm', x, z: D3() ? clamp(P.z + (i % 2 ? 1 : -1) * rnd(0, 60), ...zRange()) : 0, w: a.dragon ? 80 : 60, h: a.dragon ? 260 : 200, delay: T + i * 4, life: 30, dmg: a.dmg, a, src: b.x });
      }
      break;
    }
    case 'rain': {
      for (let i = 0; i < a.count; i++) G.haz.push({ type: 'rainmark', x: clamp(P.x + rnd(-260, 260), AL, AR), z: D3() ? clamp(P.z + rnd(-130, 130), ...zRange()) : 0, delay: T + i * 4, life: 1, dmg: a.dmg, a, src: b.x });
      break;
    }
    case 'cage': {
      G.haz.push({ type: 'cage', x: P.x, y: P.y - 70, z: P.z, r0: a.tight ? 220 : 300, delay: T, life: 14, dmg: a.dmg, a, src: b.x });
      break;
    }
    case 'sweep': {
      G.haz.push({ type: 'sweep', dir: b.face, z: b.z, delay: T, life: 18, dmg: a.dmg, a, src: b.x, y0: GY - 75 });
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
      b.mv = { vx: b.face * 9, vz: D3() ? (P.z - b.z) / 16 : 0, n: 10, dmg: 0, hit: 1 };
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
        const vx = Math.cos(ang) * a.speed, tt = Math.max(12, Math.abs(P.x - ox) / Math.max(2, Math.abs(vx)));
        const vz = D3() ? (P.z - b.z) / tt + (a.spread ? (i - (a.count - 1) / 2) * 0.7 : rnd(-0.3, 0.3)) : 0;
        G.eproj.push({ x: ox, y: a.ground ? GY - 40 - i * 50 : oy, vx, vy: Math.sin(ang) * a.speed, vz, r: a.size, dmg: a.dmg, shape: a.shape, color: a.color, life: 160, delay, homing: a.homing || 0, bounce: a.bounce, poison: a.poison, t: 0 });
      }
      Audio.sfx.swing();
      break;
    }
    case 'dash': b.face = Math.sign(P.x - b.x) || b.face; b.mv = { vx: b.face * 22, vz: D3() ? (P.z - b.z) / 16 : 0, n: 16, dmg: a.dmg, again: a.triple ? 2 : 0 }; Audio.sfx.wind(); break;
    case 'shock':
      for (const s of [-1, 1]) G.haz.push({ type: 'shock', x: b.x, vx: s * 10, delay: 0, life: 110, dmg: a.dmg, a, src: b.x });
      G.shake = 12; Audio.sfx.boom(); break;
    case 'summon':
      for (let i = 0; i < a.count; i++) { const m = makeBoss(a.minion, clamp(b.x + rnd(-200, 200), AL, AR)); if (D3()) m.z = clamp(b.z + rnd(-150, 150), ...zRange()); G.cz = m.z; G.bosses.push(m); particles('mist', m.x, m.y - 50, 20, 4, { k: 'smoke' }); }
      break;
    case 'sleep':
      for (let i = 0; i < 3; i++) G.eproj.push({ x: b.x + b.face * 30, y: b.y - 120, vx: b.face * 4 + rnd(-1, 1), vy: rnd(-3, 1), vz: D3() ? (P.z - b.z) / 60 : 0, r: 18, dmg: 0, shape: 'sleep', color: '#c080ff', life: 260, delay: i * 14, homing: 0.12, sleep: 1, t: 0 });
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
  const pc = [P.x, P.y - 70], d3 = D3(), pz = P.z || 0;
  for (const h of G.haz) {
    G.cz = h.z || 0;
    if (h.follow && h.follow.z !== undefined) h.z = h.follow.z;
    if (h.delay > 0) { h.delay--; if (h.type === 'cage') h.r = lerp(80, h.r0, h.delay / h.a.tele); continue; }
    h.t = (h.t || 0) + 1;
    if (h.t === 1) {
      if (h.type === 'line') { Audio.sfx.swing(); if (h.style === 'bolt') Audio.sfx.thunder(); }
      if (h.type === 'circle') { G.shake = Math.max(G.shake, 12); Audio.sfx.boom(); particles(h.a.ice ? 'mist' : h.a.moon ? 'moon' : 'demon', h.x, h.y, 30, 9, { k: h.a.ice ? 'ice' : undefined }); }
      if (h.type === 'arm' && h.a.dragon) Audio.sfx.heavy();
      if (h.type === 'rainmark') { G.eproj.push({ x: h.x, y: -40, z: h.z || 0, vx: 0, vy: 20, r: h.a.shape === 'moonbeam' ? 30 : 16, dmg: h.dmg, shape: h.a.shape, color: '#ddf', life: 60, t: 0, fall: 1 }); }
      if (h.type === 'sweep') { Audio.sfx.heavy(); G.shake = 14; }
    }
    if (h.done) continue;
    let hit = false;
    const dz = d3 ? Math.abs(pz - (h.z || 0)) : 0;
    switch (h.type) {
      case 'line': hit = segDist(pc[0], pc[1], h.x1, h.y1, h.x2, h.y2) < h.w / 2 + 18 && dz < DZ * 0.8 + h.w * 0.5; break;
      case 'circle': if (h.follow) { h.x = h.follow.x; } hit = Math.hypot(pc[0] - h.x, pc[1] - h.y, dz) < h.r; break;
      case 'zone': if (h.follow) { h.x = h.follow.x + h.follow.face * h.off; h.src = h.follow.x; } hit = Math.hypot(pc[0] - h.x, pc[1] - h.y, dz * 1.2) < h.r; if (h.t === 1) fxAt(h.x, h.y, h.r, h.follow && h.follow.face > 0 ? -1.6 : Math.PI + 1.6, h.follow && h.follow.face > 0 ? 1.4 : Math.PI - 1.4, 18, 'demon', { sweep: 4, fade: 8 }); break;
      case 'arm': { const ht = h.h * Math.min(1, h.t / 6); hit = Math.abs(P.x - h.x) < h.w / 2 + 12 && P.y > GY - ht && dz < h.w / 2 + 12; break; }
      case 'cage': hit = Math.hypot(pc[0] - h.x, pc[1] - h.y, dz) < 80; break;
      case 'sweep': hit = P.y > GY - 70 && h.t < 10 && dz < 300; break;
      case 'shock': h.x += h.vx; hit = Math.abs(P.x - h.x) < 26 && P.y > GY - 56 && dz < 40; if (h.x < AL - 100 || h.x > AR + 100) h.life = 0; break;
    }
    if (hit && h.dmg) {
      if (nagiCut(P, pc[0], pc[1]) && h.type !== 'cage') { h.done = true; continue; }
      if (hurtPlayer(P, h.dmg, h.src, h.a)) h.done = h.type !== 'shock';
    }
  }
  G.haz = G.haz.filter(h => h.delay > 0 || (h.t || 0) < h.life);

  for (const p of G.eproj) {
    G.cz = p.z || 0;
    if (p.delay > 0) { p.delay--; continue; }
    p.t++;
    if (p.reflected) { // batted back: flies at the demons and hurts them
      p.x += p.vx; p.y += p.vy; p.z += p.vz || 0; p.life--; G.cz = p.z;
      strike(p.grp, p.x, p.y, Math.max(26, p.r)); if (p.grp.hit.size) p.life = 0;
      if (p.x < AL - 300 || p.x > AR + 300) p.life = 0; continue;
    }
    if (P.parryT > 0 && p.shape !== 'moonbeam' && Math.hypot(p.x - P.x, p.y - (P.y - 80), d3 ? ((p.z || 0) - pz) * 0.8 : 0) < 175) { deflect(P, p); continue; }
    if (d3) { if (p.homing) p.vz = lerp(p.vz || 0, (pz - p.z) * 0.06, Math.min(1, p.homing * 2)); p.z += p.vz || 0; }
    if (p.homing) { const a = Math.atan2(pc[1] - p.y, pc[0] - p.x); const sp = Math.hypot(p.vx, p.vy); const cur = Math.atan2(p.vy, p.vx); let da = a - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = cur + clamp(da, -p.homing, p.homing); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
    if (p.bounce) { p.vy += 0.35; if (p.y > GY - p.r) { p.y = GY - p.r; p.vy *= -0.8; } }
    p.x += p.vx; p.y += p.vy;
    if (p.fall && p.y > GY - 10) { p.life = 0; particles(p.shape === 'lotus' || p.shape === 'icicle' ? 'mist' : 'demon', p.x, GY - 10, 12, 6, { k: p.shape === 'lotus' || p.shape === 'icicle' ? 'ice' : undefined }); fxRing(p.x, GY - 4, 50, 'demon', 12, { sq: 0.3 }); }
    p.life--;
    if (p.x < AL - 200 || p.x > AR + 200 || p.y < -200 || p.y > H + 50) p.life = 0;
    const [rx, ry, rw, rh] = playerRect(P);
    if (circleRect(p.x, p.y, p.r * 0.8, rx, ry, rw, rh) && (!d3 || Math.abs((p.z || 0) - pz) < p.r * 0.8 + 34)) {
      if (P.cast && P.cast.block) { p.life = 0; particles(P.cast.th, p.x, p.y, 10, 5); Audio.sfx.hit(); continue; }
      if (nagiCut(P, p.x, p.y)) { p.life = 0; continue; }
      if (p.sleep) { if (playerVulnerable(P)) { P.sleep = 1; P.cast = null; p.life = 0; banner('夢の中… 自分の頸を斬れ！', 'Bị ru ngủ! Bấm J liên tục để tự tỉnh dậy!', 150); } continue; }
      if (hurtPlayer(P, p.dmg, p.x, p)) p.life = 0;
    }
  }
  G.eproj = G.eproj.filter(p => p.life > 0);
}

function updatePProj() {
  const d3 = D3();
  for (const p of G.pproj) {
    G.cz = p.z || 0;
    p.t++;
    if (d3 && !p.fall) { const e = nearestEnemy(p.P || activeP()); if (e) p.z += clamp(((e.z || 0) - p.z) * 0.1, -7, 7); G.cz = p.z; }
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
    if (p.x < AL - 300 || p.x > AR + 300) p.life = 0;
  }
  G.pproj = G.pproj.filter(p => p.life > 0);
}

// ---------------- MAIN BATTLE STEP ----------------
function battleStep() {
  if (G.paused) return;
  G.palette = held('KeyF') && !G.over && !G.cutin && !activeP().down;
  if (G.palette) { handleSelectionInput(); return; }
  if (G.cutin) { G.cutin.t++; if (G.cutin.t >= G.cutin.dur) { const c = G.cutin; G.cutin = null; beginCast(c.P, c.f, c.st); } return; }
  for (const c of G.callouts) c.t++;
  G.callouts = G.callouts.filter(c => c.t < c.dur);
  if (G.banner) { G.banner.t++; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.bossLine) { G.bossLine.t++; if (G.bossLine.t > 90) G.bossLine = null; }
  if (G.bigKanji) { G.bigKanji.t++; if (G.bigKanji.t > 70) G.bigKanji = null; }
  if (G.flashScreen) { G.flashScreen.t++; if (G.flashScreen.t > G.flashScreen.life) G.flashScreen = null; }
  if (G.hitstop > 0) { G.hitstop--; return; }
  G.t++;
  if (G.S.training) { for (const p of G.team) { p.br = p.maxbr; p.hp = p.maxhp; p.down = false; } if (G.trainT > 0) G.trainT--; if (G.trainT2 > 0) G.trainT2--; }
  if (G.shake > 0) G.shake *= 0.86;
  if (G.switchCd > 0) G.switchCd--;
  if (G.slowT > 0) { G.slowT--; if (!G.slowT) G.slow = 1; }
  if (G.tiltT > 0) G.tiltT--;

  if (!G.over) handleSelectionInput();
  const P = activeP();
  if (!G.over || G.over === 'win') updatePlayer(P);
  for (const p of G.team) if (p !== P && !p.down) { p.br = Math.min(p.maxbr, p.br + 0.15 * (p.ch.brRegen || 1)); p.hp = Math.min(p.maxhp, p.hp + 0.02 + (p.ch.hpRegen || 0)); }

  for (const b of G.bosses) {
    b.acc += G.slow;
    while (b.acc >= 1) { b.acc -= 1; G.cz = b.z || 0; updateBoss(b); }
  }
  G.cz = P.z || 0;
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
      if (boss.def.flee) { boss.fleeing = true; boss.face = boss.x < (AL + AR) / 2 ? -1 : 1; banner('夜明けだ！', 'BÌNH MINH! Akaza bỏ chạy khỏi ánh mặt trời!', 200); }
      else { killBoss(boss); banner('夜明けだ！！', 'BÌNH MINH! Muzan bị mặt trời thiêu đốt!', 240); boss.burning = true; }
      Audio.sfx.gong(); G.over = 'win'; G.overT = -60;
    }
  }
  // win / lose
  if (G.waveT > 0 && --G.waveT === 0) spawnNextWave();
  if (G.ally) updateAlly(G.ally);
  if (G.subs && G.subs.length && !G.over) { // short story lines between waves, spoken and subtitled
    if (G.subT === 0) { const l = G.subs[0], sp = SPEAKERS[l[0]]; Audio.say(l[1], sp ? sp.voice : 1, 1.08, 2); }
    if (++G.subT > 170) { G.subs.shift(); G.subT = 0; }
  }
  if (!G.over && !G.waveT && waveCleared()) {
    if (G.phase < G.phases.length) nextWave();
    else { G.over = 'win'; G.overT = 0; sayLine(P.ch.lines.win, P.ch.voice, 2); }
  }
  if (G.over) G.overT++;
}
