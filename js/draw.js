// ============================================================
//  DRAW — characters, demons, effects, backgrounds
// ============================================================
'use strict';

const W = 1280, H = 720, GY = 612;
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

const THEMES = {
  water: { m: '#3b8ef0', l: '#d6f0ff', d: '#163f96', p: 'drop' },
  sun: { m: '#ff5a1f', l: '#ffe680', d: '#9a1200', p: 'ember' },
  flame: { m: '#ff7a1a', l: '#ffd860', d: '#c02000', p: 'ember' },
  thunder: { m: '#ffd630', l: '#fffbe0', d: '#d08a00', p: 'spark' },
  beast: { m: '#8090b0', l: '#eef2ff', d: '#38405e', p: 'spark' },
  insect: { m: '#a060e0', l: '#f4e6ff', d: '#4d1b8a', p: 'butterfly' },
  love: { m: '#ff70b0', l: '#ffe4f2', d: '#c02a6c', p: 'heart' },
  mist: { m: '#a8e8e0', l: '#ffffff', d: '#4c9890', p: 'smoke' },
  sound: { m: '#ff9a40', l: '#fff2c4', d: '#9a2ac0', p: 'note' },
  serpent: { m: '#b484d8', l: '#f4ecff', d: '#5a3a7a', p: 'spark' },
  wind: { m: '#62d494', l: '#f0fff4', d: '#227a48', p: 'leaf' },
  stone: { m: '#a88e6a', l: '#efe2c4', d: '#544430', p: 'rock' },
  flower: { m: '#ff8ab4', l: '#fff2f6', d: '#c03e6e', p: 'petal' },
  blood: { m: '#ff3a6a', l: '#ffd0dc', d: '#9a0028', p: 'ember' },
  normal: { m: '#d8dde8', l: '#ffffff', d: '#8890a0', p: 'spark' },
  demon: { m: '#d02040', l: '#ffb0c0', d: '#600010', p: 'ember' },
  moon: { m: '#c8a8ff', l: '#fff8ff', d: '#6a3ac0', p: 'spark' },
};

// ---------------- pattern cache ----------------
const patCache = {};
function getPattern(ctx, key, fn, size) {
  if (patCache[key]) return patCache[key];
  const c = document.createElement('canvas'); c.width = c.height = size;
  fn(c.getContext('2d'), size);
  return (patCache[key] = ctx.createPattern(c, 'repeat'));
}
function haoriFill(ctx, L) {
  switch (L.haori) {
    case 'check': return getPattern(ctx, 'check', (g, s) => { g.fillStyle = L.h2; g.fillRect(0, 0, s, s); g.fillStyle = L.h1; g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2); }, 14);
    case 'tri': return getPattern(ctx, 'tri', (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#f8d040'); gr.addColorStop(1, '#f0a020'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, s); g.lineTo(s / 2, s / 2); g.lineTo(s, s); g.fill();
    }, 16);
    case 'giyu': return getPattern(ctx, 'tortoise', (g, s) => {
      g.fillStyle = '#2f7a3c'; g.fillRect(0, 0, s, s); g.strokeStyle = '#d8b040'; g.lineWidth = 1.5;
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45); } g.closePath(); g.stroke();
      g.fillStyle = '#c87b2a'; g.fillRect(0, 0, 3, 3);
    }, 16);
    case 'stripe': return getPattern(ctx, 'stripe', (g, s) => { g.fillStyle = '#eee'; g.fillRect(0, 0, s, s); g.fillStyle = '#555'; g.fillRect(0, 0, 4, s); }, 10);
    default: return null;
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function shade(hex, amt) {
  if (!hex || hex[0] !== '#') return hex;
  let c = hex.slice(1); if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ---------------- DEMON LOOKS ----------------
const DEMON_LOOKS = {
  akaza: { hair: '#f0a0c0', style: 'akaza', haori: 'none', skin: '#f4d8d0', uniform: '#eee', shirtless: 1, tattoo: 1, demonEye: 1, rank: '上参', eye: '#7af', noSword: 1, marks: '#2a6aff' },
  daki: { hair: '#111', hairTip: '#2a8a5a', style: 'daki', haori: 'plain', h1: '#222', h2: '#4a8', kimono: '#1a1a1a', skin: '#fbe4dc', demonEye: 1, rank: '上陸', noSword: 1, eye: '#4f9' },
  gyutaro: { hair: '#2a3a2a', style: 'gyutaro', haori: 'none', skin: '#c8c8b8', shirtless: 1, demonEye: 1, rank: '陸上', noSword: 1, eye: '#ff0', uniform: '#3a3a3a' },
  doma: { hair: '#f0e0c0', style: 'doma', haori: 'plain', h1: '#2a2a3a', h2: '#ccc', skin: '#f8e8e0', uniform: '#eee', rainbow: 1, rank: '上弐', noSword: 1 },
  kokushibo: { noSword: 1, hair: '#111', style: 'kokushibo', haori: 'plain', h1: '#4a2a6a', h2: '#222', skin: '#e8c8b8', uniform: '#2a1a3a', sixEyes: 1, blade: '#6a2a3a', edge: '#e04050', marks: '#c03030' },
  muzan: { hair: '#f0f0f0', hairTip: '#ccc', style: 'muzan2', haori: 'plain', h1: '#111', h2: '#300', skin: '#e8d8d0', uniform: '#111', demonEye: 1, noSword: 1, eye: '#e02020' },
  rui: { hair: '#f4f4f4', style: 'rui', haori: 'plain', h1: '#f4f4f4', h2: '#ddd', kimono: '#f4f4f4', skin: '#f8eeee', marks: '#d03040', demonEye: 1, rank: '下伍', noSword: 1, eye: '#d03040' },
  enmu: { hair: '#1a1a24', hairTip: '#4a4a6a', style: 'default', haori: 'plain', h1: '#2a2a3a', h2: '#555', uniform: '#2a2a3a', skin: '#e8d0e0', demonEye: 1, rank: '下壱', noSword: 1, eye: '#a0c' },
  susamaru: { hair: '#1a1a1a', style: 'default', haori: 'plain', h1: '#e8a0b0', kimono: '#d07090', h2: '#aa4060', skin: '#f8e0d8', demonEye: 1, noSword: 1, horn: 0 },
  kyogai: { hair: '#2a1a1a', style: 'default', haori: 'plain', h1: '#7a6a4a', kimono: '#7a6a4a', h2: '#3a2a1a', skin: '#c8a888', demonEye: 1, noSword: 1, horn: 1 },
  minion: { hair: '#3a3a3a', style: 'default', haori: 'none', skin: '#8a9a7a', shirtless: 1, demonEye: 1, noSword: 1, horn: 1, uniform: '#3a3a2a' },
  icechild: { hair: '#bfe8ff', style: 'doma', haori: 'none', skin: '#dff4ff', shirtless: 1, rainbow: 1, noSword: 1 },
  hantengu: { hair: '#1a3a1a', style: 'default', haori: 'plain', h1: '#2a4a2a', kimono: '#3a2a1a', h2: '#222', skin: '#e8c8a8', demonEye: 1, rank: '上肆', noSword: 1, horn: 1 },
};

function drawBoss(ctx, b, g) {
  const t = g.t;
  const f = b.face;
  const sc = b.scale || 1.25;
  const look = b.def.look;
  ctx.save();
  if (b.flash > 0) ctx.filter = 'brightness(3)';
  if (b.dead) ctx.globalAlpha = Math.max(0, 1 - b.deadT / 90);
  if (look === 'hand') { drawHandDemon(ctx, b, t); ctx.restore(); return; }
  if (look === 'gyokko') { drawGyokko(ctx, b, t); ctx.restore(); return; }
  if (look === 'dummy') { drawDummy(ctx, b, t); ctx.restore(); return; }
  const L = DEMON_LOOKS[look];
  // extras behind
  if (look === 'muzan') {
    ctx.save(); ctx.translate(b.x, b.y - 120);
    ctx.strokeStyle = '#2a0a12'; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      ctx.lineWidth = 10 - i * 0.6; ctx.beginPath(); ctx.moveTo(0, 0);
      const ang = -Math.PI / 2 + (i - 3) * 0.45 + Math.sin(t * 0.04 + i) * 0.2;
      let px = 0, py = 0;
      for (let k = 1; k <= 8; k++) { px += Math.cos(ang + Math.sin(t * 0.05 + k * 0.7 + i) * 0.5) * 16 * -f * (i % 2 ? 1 : -1); py += Math.sin(ang + Math.sin(t * 0.06 + k) * 0.4) * 16; ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = '#8a0a20'; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  if (look === 'hantengu') { // drum ring
    ctx.save(); ctx.translate(b.x - f * 10, b.y - 170); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * 0.01; ctx.fillStyle = '#c8a070'; ctx.beginPath(); ctx.arc(Math.cos(a) * 60, Math.sin(a) * 60, 13, 0, TAU); ctx.fill(); ctx.fillStyle = '#d02020'; ctx.beginPath(); ctx.arc(Math.cos(a) * 60, Math.sin(a) * 60, 5, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (look === 'susamaru') { // extra arms + temari
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(b.x, b.y - 120 * sc); ctx.strokeStyle = L.skin; ctx.lineWidth = 9; const a = -2.4 + i * 0.5 + Math.sin(t * 0.1 + i) * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 50 * f, Math.sin(a) * 50); ctx.stroke(); drawTemari(ctx, Math.cos(a) * 58 * f, Math.sin(a) * 58, 12, i); ctx.restore(); }
  }
  if (look === 'daki') { // obi sashes
    ctx.save(); ctx.translate(b.x, b.y - 110 * sc);
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = i % 2 ? '#c03060' : '#3a2a5a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, 0); for (let k = 1; k < 10; k++) ctx.lineTo(-f * k * 14, Math.sin(t * 0.08 + k * 0.6 + i) * 18 + (i - 2) * 16 - k * 3); ctx.stroke(); }
    ctx.restore();
  }
  if (look === 'kyogai') { ctx.save(); ctx.translate(b.x, b.y - 90 * sc); for (const [dx, dy] of [[-30, -20], [26, -10], [0, 20], [-24, 26], [30, 30]]) drawDrum(ctx, dx, dy, 15); ctx.restore(); }
  const pose = { t, run: b.walk, swing: b.swing !== undefined ? b.swing : 0.9, lean: b.lean || 0, hurt: b.hurt > 0, arm2: b.arm2 };
  if (ASSETS.sprite[b.key] && drawSprite(ctx, b.key, b.x, b.y, f, pose, 1, b.hh * 1.05)) { ctx.restore(); return; }
  drawPerson(ctx, L, { key: b.key, boss: 1 }, b.x, b.y, f, pose, 1, sc);
  if (look === 'kokushibo') { // flesh sword
    ctx.save(); ctx.translate(b.x, b.y - 100 * sc); ctx.rotate(f > 0 ? (b.swing || 0.9) - 0.15 : Math.PI - (b.swing || 0.9) + 0.15);
    ctx.strokeStyle = '#7a1a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(170, 0); ctx.stroke();
    ctx.fillStyle = '#e8c040'; for (let i = 50; i < 170; i += 24) { ctx.beginPath(); ctx.arc(i, -5, 3, 0, TAU); ctx.fill(); }
    for (let i = 60; i < 170; i += 30) { ctx.strokeStyle = '#7a1a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 10, -14); ctx.stroke(); }
    ctx.restore();
  }
  if (look === 'doma') { // fans
    ctx.save(); ctx.translate(b.x + f * 40, b.y - 110 * sc); ctx.rotate(Math.sin(t * 0.05) * 0.3);
    for (let i = 0; i < 2; i++) { ctx.fillStyle = i ? '#f4e0a0' : '#ffd040'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 44, -Math.PI * 0.9 + i * 0.4, -Math.PI * 0.2 + i * 0.4); ctx.fill(); ctx.strokeStyle = '#d02040'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  if (look === 'gyutaro') { // blood sickles
    for (const s of [1, -1]) { ctx.save(); ctx.translate(b.x + f * s * 30, b.y - 100 * sc); ctx.rotate(t * 0.05 * s); ctx.strokeStyle = '#c01030'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 1.2); ctx.stroke(); ctx.restore(); }
  }
  if (look === 'enmu') { ctx.save(); ctx.translate(b.x + f * 34, b.y - 120 * sc); ctx.fillStyle = '#e8d0e0'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#802040'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2 + Math.abs(Math.sin(t * 0.1)) * 3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  if (b.def.trueBody && b.small) drawSmallBody(ctx, b, t);
  ctx.restore();
}
function drawSmallBody(ctx, b, t, noBody) {
  {
    const s = b.small;
    ctx.save(); ctx.translate(s.x, s.y);
    if (!noBody) { ctx.fillStyle = '#e8c8a8'; ctx.beginPath(); ctx.arc(0, -16, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-5, -10, 10, 12); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'; ctx.fillText('恨', 0, -30);
    ctx.strokeStyle = '#ff4060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -10, 16 + Math.sin(t * 0.3) * 3, 0, TAU); ctx.stroke(); ctx.restore();
  }
}
function drawTemari(ctx, x, y, r, i) {
  ctx.fillStyle = ['#e04040', '#e8b030', '#4080e0', '#40b060'][i % 4]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.stroke();
}
function drawDrum(ctx, x, y, r) { ctx.fillStyle = '#b8864a'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f0e0c0'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y, r * 0.5, r * 0.7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a2a1a'; ctx.lineWidth = 1.5; ctx.stroke(); }
function drawHandDemon(ctx, b, t) {
  const x = b.x, y = b.y, f = b.face;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 90, 14, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6d8a48'; ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI + i / 13 * Math.PI + Math.sin(t * 0.05 + i) * 0.12;
    ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, -120);
    const l = 90 + (i % 3) * 20;
    const ex = Math.cos(a) * l, ey = -120 + Math.sin(a) * l * 0.9;
    ctx.quadraticCurveTo(Math.cos(a) * l * 0.4, -120 + Math.sin(a) * 30, ex, ey); ctx.stroke();
    ctx.fillStyle = '#7d9a58'; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#5a7a3a'; ctx.beginPath(); ctx.ellipse(0, -90, 80, 95, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#4a6a2a'; ctx.lineWidth = 16;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 24, -30); ctx.lineTo(-64 + i * 26, 0); ctx.stroke(); }
  // hands wrapping neck
  ctx.fillStyle = '#7d9a58'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 15, -150, 12, 9, 0, 0, TAU); ctx.fill(); }
  // face
  ctx.fillStyle = '#7d9a58'; ctx.beginPath(); ctx.ellipse(f * 10, -185, 34, 30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f * 0 - 8, -192, 7, 0, TAU); ctx.arc(f * 0 + 18, -192, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#c00'; ctx.beginPath(); ctx.arc(-8 + f * 2, -192, 3, 0, TAU); ctx.arc(18 + f * 2, -192, 3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#300'; ctx.beginPath(); ctx.ellipse(f * 6, -170, 16, 6, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) ctx.fillRect(f * 6 - 14 + i * 6, -171, 3, 4);
  ctx.restore();
}
function drawGyokko(ctx, b, t) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 50, 10, 0, 0, TAU); ctx.fill();
  // vase
  const g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, '#2a4a8a'); g.addColorStop(0.5, '#e8eef8'); g.addColorStop(1, '#2a4a8a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-55, -50, -18, -90); ctx.lineTo(18, -90); ctx.quadraticCurveTo(55, -50, 20, 0); ctx.fill();
  ctx.strokeStyle = '#1a3a7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -45, 16, 0, TAU); ctx.stroke();
  // serpentine body
  ctx.strokeStyle = '#d8e0f0'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -90);
  for (let k = 1; k <= 6; k++) ctx.lineTo(Math.sin(t * 0.06 + k) * 16, -90 - k * 16); ctx.stroke();
  const hx = Math.sin(t * 0.06 + 6) * 16, hy = -190;
  ctx.fillStyle = '#e0e8f4'; ctx.beginPath(); ctx.arc(hx, hy, 20, 0, TAU); ctx.fill();
  // eyes = mouths
  ctx.fillStyle = '#a02040'; ctx.beginPath(); ctx.ellipse(hx - 6, hy - 14, 5, 3, 0, 0, TAU); ctx.ellipse(hx + 6, hy + 6, 5, 3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px serif'; ctx.fillText('上伍', hx - 9, hy - 2);
  for (const s of [-1, 1]) { ctx.strokeStyle = '#d8e0f0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -130); ctx.quadraticCurveTo(s * 40, -140, s * 50, -110 + Math.sin(t * 0.1) * 10); ctx.stroke(); }
  ctx.restore();
}

// ---------------- EFFECTS ----------------
// slash arc: center cx,cy radius r from a0..a1 (world angles), thickness w, progress p (0..1 sweep), fade f(1..0)
function drawSlash(ctx, e) {
  const th = THEMES[e.theme] || THEMES.normal;
  const p = e.prog, fade = e.fade;
  const a0 = e.a0, a1 = e.a1;
  const head = a0 + (a1 - a0) * Math.min(1, p);
  const tail = a0 + (a1 - a0) * Math.max(0, p - 0.9);
  const N = 28;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = 'lighter';
  const outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N; const a = tail + (head - tail) * u;
    const thick = e.w * Math.sin(Math.PI * Math.min(1, u * 1.05)) * (0.4 + 0.6 * u);
    outer.push([e.cx + Math.cos(a) * e.r, e.cy + Math.sin(a) * e.r * (e.sq || 1)]);
    inner.push([e.cx + Math.cos(a) * (e.r - thick), e.cy + Math.sin(a) * (e.r - thick) * (e.sq || 1)]);
  }
  const grad = ctx.createRadialGradient(e.cx, e.cy, Math.max(1, e.r - e.w), e.cx, e.cy, e.r);
  grad.addColorStop(0, th.d); grad.addColorStop(0.6, th.m); grad.addColorStop(1, th.l);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(outer[0][0], outer[0][1]);
  for (const q of outer) ctx.lineTo(q[0], q[1]);
  for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
  ctx.closePath(); ctx.fill();
  // bright edge
  ctx.strokeStyle = th.l; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = Math.floor(N * 0.3); i <= N; i++) { const q = outer[i]; i === Math.floor(N * 0.3) ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1]); }
  ctx.stroke();
  // theme decoration
  const T = e.theme;
  if (T === 'water') {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    for (let i = 4; i < N; i += 4) { const q = outer[i], a = tail + (head - tail) * i / N; ctx.beginPath(); ctx.arc(q[0] + Math.cos(a) * 6, q[1] + Math.sin(a) * 6, 7, a - 0.5, a + 2.6); ctx.stroke(); }
    ctx.strokeStyle = th.d; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= N; i++) { const q = inner[i]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
  } else if (T === 'sun' || T === 'flame' || T === 'blood') {
    for (let i = 2; i < N; i += 2) {
      const q = outer[i], a = tail + (head - tail) * i / N, len = rnd(10, 30) * (i / N);
      ctx.fillStyle = i % 4 ? th.l : th.m;
      ctx.beginPath(); ctx.moveTo(q[0] + Math.cos(a + 1.5) * 5, q[1] + Math.sin(a + 1.5) * 5);
      ctx.quadraticCurveTo(q[0] + Math.cos(a) * len, q[1] + Math.sin(a) * len - 8, q[0] + Math.cos(a - 0.3) * len * 1.3, q[1] + Math.sin(a - 0.3) * len * 1.3 - 10);
      ctx.lineTo(q[0] + Math.cos(a - 1.5) * 5, q[1] + Math.sin(a - 1.5) * 5); ctx.fill();
    }
  } else if (T === 'thunder') {
    ctx.strokeStyle = th.l; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= N; i += 2) { const q = outer[i]; ctx.lineTo(q[0] + rnd(-12, 12), q[1] + rnd(-12, 12)); } ctx.stroke(); }
  } else if (T === 'wind') {
    ctx.strokeStyle = 'rgba(240,255,240,.8)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let i = 0; i <= N; i++) { const a = tail + (head - tail) * i / N; const rr = e.r + 10 + k * 8; ctx.lineTo(e.cx + Math.cos(a) * rr, e.cy + Math.sin(a) * rr * (e.sq || 1)); } ctx.stroke(); }
  } else if (T === 'beast') {
    ctx.fillStyle = th.l;
    for (let i = 2; i < N; i += 3) { const q = outer[i], a = tail + (head - tail) * i / N; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a + 0.4) * 14, q[1] + Math.sin(a + 0.4) * 14); ctx.lineTo(q[0] + Math.cos(a - 0.2) * 4, q[1] + Math.sin(a - 0.2) * 4); ctx.fill(); }
  } else if (T === 'mist') {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < N; i += 3) { const q = outer[i]; ctx.fillStyle = 'rgba(230,255,250,.25)'; ctx.beginPath(); ctx.arc(q[0], q[1], 18, 0, TAU); ctx.fill(); }
  } else if (T === 'moon') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    for (let i = 3; i < N; i += 5) { const q = inner[i]; ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0.5, 2.7); ctx.stroke(); }
  }
  ctx.restore();
}

// Serpent / dragon body following a path
function drawDragon(ctx, pts, theme, alpha, width, kind) {
  if (pts.length < 2) return;
  const th = THEMES[theme] || THEMES.normal;
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.strokeStyle = [th.d, th.m, th.l][pass];
    for (let i = 1; i < pts.length; i++) {
      const u = i / pts.length;
      ctx.lineWidth = width * u * [1, 0.7, 0.3][pass];
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  }
  // scales / fins
  ctx.fillStyle = th.l;
  for (let i = 3; i < pts.length - 1; i += 3) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1]; const a = Math.atan2(y2 - y, x2 - x); const u = i / pts.length;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - 2) * width * 0.7 * u, y + Math.sin(a - 2) * width * 0.7 * u); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.fill();
  }
  // head
  const [hx, hy] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
  const a = Math.atan2(hy - py, hx - px);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
  ctx.fillStyle = th.m; ctx.beginPath(); ctx.moveTo(width * 0.9, 0); ctx.lineTo(-width * 0.3, -width * 0.55); ctx.lineTo(-width * 0.6, 0); ctx.lineTo(-width * 0.3, width * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = th.l; ctx.beginPath(); ctx.moveTo(width * 0.2, -width * 0.3); ctx.lineTo(-width * 0.9, -width * 0.8); ctx.lineTo(-width * 0.2, -width * 0.1); ctx.fill();
  if (kind !== 'snake') { ctx.beginPath(); ctx.moveTo(width * 0.2, width * 0.3); ctx.lineTo(-width * 0.9, width * 0.8); ctx.lineTo(-width * 0.2, width * 0.1); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(width * 0.25, -width * 0.15, width * 0.09, 0, TAU); ctx.fill();
  // whiskers
  if (kind !== 'snake') { ctx.strokeStyle = th.l; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(width * 0.7, 0); ctx.quadraticCurveTo(width * 1.2, -width * 0.6, width * 0.8, -width * 1.1); ctx.moveTo(width * 0.7, 0); ctx.quadraticCurveTo(width * 1.2, width * 0.6, width * 0.8, width * 1.1); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

function drawLightning(ctx, x1, y1, x2, y2, col, w, jag) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1);
  const n = 10; for (let i = 1; i < n; i++) { const u = i / n; ctx.lineTo(lerp(x1, x2, u) + rnd(-jag, jag), lerp(y1, y2, u) + rnd(-jag, jag)); }
  ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}

function drawParticle(ctx, p) {
  const a = p.life / p.max;
  ctx.globalAlpha = Math.min(1, a * 1.5);
  ctx.fillStyle = p.c;
  switch (p.k) {
    case 'butterfly': {
      const fl = Math.abs(Math.sin(p.life * 0.5));
      ctx.beginPath(); ctx.ellipse(p.x - 4 * fl, p.y, 5 * fl + 1, 4, -0.5, 0, TAU); ctx.ellipse(p.x + 4 * fl, p.y, 5 * fl + 1, 4, 0.5, 0, TAU); ctx.fill(); break;
    }
    case 'petal': ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s, p.s * 0.5, p.life * 0.2, 0, TAU); ctx.fill(); break;
    case 'heart': ctx.font = `${p.s * 3}px serif`; ctx.fillText('♥', p.x, p.y); break;
    case 'note': ctx.font = `${p.s * 3}px serif`; ctx.fillText('♪', p.x, p.y); break;
    case 'leaf': ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 1.4, p.s * 0.5, p.life * 0.3, 0, TAU); ctx.fill(); break;
    case 'smoke': ctx.globalAlpha = a * 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (2 - a), 0, TAU); ctx.fill(); break;
    case 'rock': ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); break;
    case 'drop': ctx.beginPath(); ctx.arc(p.x, p.y, p.s * a + 0.5, 0, TAU); ctx.fill(); break;
    case 'ember': ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * a + 0.5, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; break;
    case 'blood': ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); break;
    case 'ice': ctx.beginPath(); ctx.moveTo(p.x, p.y - p.s); ctx.lineTo(p.x + p.s * 0.5, p.y); ctx.lineTo(p.x, p.y + p.s); ctx.lineTo(p.x - p.s * 0.5, p.y); ctx.fill(); break;
    default: ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// ---------------- BACKGROUNDS ----------------
const bgCache = {};
function drawBackground(ctx, key, g) {
  if (!bgCache[key]) { const c = document.createElement('canvas'); c.width = W; c.height = H; buildBg(c.getContext('2d'), key); bgCache[key] = c; }
  // dynamic sky for dawn stages
  ctx.drawImage(bgCache[key], 0, 0);
  const t = g.t;
  if (g.dawnMax) {
    const d = clamp(g.dawn / g.dawnMax, 0, 1);
    const gr = ctx.createLinearGradient(0, 0, 0, GY);
    gr.addColorStop(0, `rgba(255,${120 + d * 100},${60 + d * 80},${d * 0.55})`); gr.addColorStop(1, `rgba(255,${180 + d * 60},120,${d * 0.75})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, GY);
    if (d > 0.6) { ctx.fillStyle = `rgba(255,240,180,${(d - 0.6) * 2})`; ctx.beginPath(); ctx.arc(W * 0.82, GY - (d - 0.6) * 300, 60, 0, TAU); ctx.fill(); }
  }
  // ambient particles
  if (key === 'wisteria' && Math.random() < 0.3) g.amb.push({ x: rnd(0, W), y: -10, vx: rnd(-0.5, 0.5), vy: rnd(0.6, 1.4), life: 600, max: 600, s: 3, c: '#c8a0f0', k: 'petal' });
  if (key === 'castle_ice' && Math.random() < 0.3) g.amb.push({ x: rnd(0, W), y: -10, vx: rnd(-0.3, 0.3), vy: rnd(0.5, 1.2), life: 700, max: 700, s: 3, c: '#e8f6ff', k: 'ice' });
  if (key === 'village' && Math.random() < 0.15) g.amb.push({ x: rnd(0, W), y: GY - rnd(0, 60), vx: rnd(-0.2, 0.2), vy: -rnd(0.2, 0.5), life: 300, max: 300, s: 18, c: '#fff', k: 'smoke' });
  if (key === 'train') { // scrolling ground
    ctx.fillStyle = '#20202a'; for (let i = 0; i < 12; i++) { const x = ((i * 140 - t * 14) % (W + 140) + W + 140) % (W + 140) - 140; ctx.fillRect(x, GY + 70, 70, 6); }
    ctx.fillStyle = 'rgba(40,60,40,.8)'; for (let i = 0; i < 8; i++) { const x = ((i * 220 - t * 6) % (W + 220) + W + 220) % (W + 220) - 220; ctx.beginPath(); ctx.moveTo(x, GY - 20); ctx.lineTo(x + 40, GY - 140); ctx.lineTo(x + 80, GY - 20); ctx.fill(); }
  }
  if (key === 'yukaku') { for (let i = 0; i < 9; i++) { const x = 80 + i * 140, y = 150 + Math.sin(t * 0.03 + i) * 4; ctx.fillStyle = `rgba(255,${80 + (i % 2) * 40},60,${0.18 + Math.sin(t * 0.05 + i) * 0.05})`; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill(); } }
}
function buildBg(c, key) {
  const sky = (a, b, cc) => { const g = c.createLinearGradient(0, 0, 0, GY); g.addColorStop(0, a); g.addColorStop(0.7, b); g.addColorStop(1, cc || b); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  const moon = (x, y, r, col) => { c.fillStyle = col || '#fff6dc'; c.shadowColor = col || '#fff6dc'; c.shadowBlur = 40; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowBlur = 0; };
  const stars = n => { c.fillStyle = '#fff'; for (let i = 0; i < n; i++) { c.globalAlpha = Math.random(); c.fillRect(Math.random() * W, Math.random() * GY * 0.7, 1.5, 1.5); } c.globalAlpha = 1; };
  const mountains = (col, base, amp, seed) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, GY); for (let x = 0; x <= W; x += 20) c.lineTo(x, base - Math.abs(Math.sin(x * 0.004 + seed) * amp) - Math.sin(x * 0.013 + seed * 2) * amp * 0.3); c.lineTo(W, GY); c.fill(); };
  const trees = (col, n, h) => { c.fillStyle = col; for (let i = 0; i < n; i++) { const x = Math.random() * W, hh = h * rnd(0.6, 1.2); c.beginPath(); c.moveTo(x, GY); c.lineTo(x - 30, GY); c.lineTo(x - 4, GY - hh); c.lineTo(x + 26, GY); c.fill(); c.fillRect(x - 4, GY - hh, 6, hh); } };
  const ground = (top, bot) => { const g = c.createLinearGradient(0, GY, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, GY, W, H - GY); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, GY, W, 2); };
  switch (key) {
    case 'wisteria':
      sky('#0b0a26', '#2a1a4a'); stars(150); moon(980, 130, 50); mountains('#1a1430', 420, 120, 1); trees('#0e0c1c', 30, 260);
      for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * 200; for (let k = 0; k < 14; k++) { c.fillStyle = `rgba(${170 + Math.random() * 40},${120 + Math.random() * 40},240,.7)`; c.beginPath(); c.arc(x + rnd(-6, 6), y + k * 7, 5 - k * 0.25, 0, TAU); c.fill(); } }
      ground('#1e1a2e', '#0a0812'); break;
    case 'town':
      sky('#0a1030', '#2a2050'); stars(100); moon(200, 110, 36);
      for (let i = 0; i < 12; i++) { const x = i * 115, h = rnd(140, 260); c.fillStyle = '#141428'; c.fillRect(x, GY - h, 100, h); c.fillStyle = '#1e1e36'; c.beginPath(); c.moveTo(x - 10, GY - h); c.lineTo(x + 50, GY - h - 40); c.lineTo(x + 110, GY - h); c.fill(); for (let w = 0; w < 4; w++) { c.fillStyle = Math.random() < 0.6 ? 'rgba(255,200,120,.7)' : '#222'; c.fillRect(x + 12 + w * 22, GY - h + 30, 14, 20); } }
      for (let i = 0; i < 10; i++) { c.fillStyle = '#e04030'; c.beginPath(); c.ellipse(60 + i * 130, 330, 12, 16, 0, 0, TAU); c.fill(); }
      ground('#2a2830', '#101016'); break;
    case 'mansion':
      sky('#3a2a1a', '#2a1a10');
      for (let i = 0; i < 8; i++) { c.fillStyle = '#e8dcc0'; c.fillRect(i * 165 + 10, 120, 150, 380); c.strokeStyle = '#4a3020'; c.lineWidth = 4; c.strokeRect(i * 165 + 10, 120, 150, 380); c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(i * 165 + 10 + k * 37, 120); c.lineTo(i * 165 + 10 + k * 37, 500); c.stroke(); } for (let k = 1; k < 7; k++) { c.beginPath(); c.moveTo(i * 165 + 10, 120 + k * 54); c.lineTo(i * 165 + 160, 120 + k * 54); c.stroke(); } }
      c.fillStyle = '#2a1a0a'; c.fillRect(0, 0, W, 110); c.fillRect(0, 500, W, GY - 500);
      for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#b8b070' : '#a8a060'; c.fillRect(i * 80, GY, 80, H - GY); c.strokeStyle = '#3a3010'; c.strokeRect(i * 80, GY, 80, H - GY); }
      for (let i = 0; i < 4; i++) drawDrum(c, 200 + i * 280, GY - 20, 20); break;
    case 'spider':
      sky('#06060e', '#1a0a14'); moon(640, 140, 70, '#e83040'); mountains('#100810', 400, 100, 3); trees('#05050a', 45, 380);
      c.strokeStyle = 'rgba(230,230,255,.35)'; c.lineWidth = 1;
      for (let w = 0; w < 4; w++) { const cx = rnd(100, W - 100), cy = rnd(80, 300), R = rnd(60, 120); for (let k = 0; k < 10; k++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(k / 10 * TAU) * R, cy + Math.sin(k / 10 * TAU) * R); c.stroke(); } for (let r = 15; r < R; r += 15) { c.beginPath(); for (let k = 0; k <= 10; k++) c.lineTo(cx + Math.cos(k / 10 * TAU) * r, cy + Math.sin(k / 10 * TAU) * r); c.stroke(); } }
      ground('#140c12', '#050305'); break;
    case 'train':
      sky('#081028', '#1a2a4a'); stars(200); moon(1050, 120, 40); mountains('#0c1424', 460, 90, 5);
      c.fillStyle = '#1a1a1e'; c.fillRect(0, GY, W, 60); c.fillStyle = '#2a2a30'; for (let i = 0; i < W; i += 160) { c.fillRect(i + 10, GY + 6, 140, 40); c.fillStyle = 'rgba(255,220,140,.5)'; c.fillRect(i + 24, GY + 14, 30, 20); c.fillRect(i + 70, GY + 14, 30, 20); c.fillStyle = '#2a2a30'; }
      c.fillStyle = '#101014'; c.fillRect(0, GY + 60, W, H); break;
    case 'dawnfield':
      sky('#0a1030', '#30305a'); stars(120); mountains('#141830', 450, 110, 2); trees('#0a0c18', 25, 200);
      c.fillStyle = '#2a2a30'; c.save(); c.translate(150, GY - 40); c.rotate(-0.2); c.fillRect(0, 0, 260, 60); c.restore(); c.save(); c.translate(900, GY - 50); c.rotate(0.15); c.fillRect(0, 0, 300, 60); c.restore();
      ground('#2a2a24', '#0a0a08'); break;
    case 'yukaku':
      sky('#1a0610', '#4a1020');
      for (let i = 0; i < 10; i++) { const x = i * 130, h = rnd(220, 340); c.fillStyle = '#2a0a12'; c.fillRect(x, GY - h, 125, h); c.fillStyle = '#4a1018'; c.beginPath(); c.moveTo(x - 15, GY - h); c.lineTo(x + 62, GY - h - 30); c.lineTo(x + 140, GY - h); c.fill(); for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(255,150,100,.6)'; c.fillRect(x + 10, GY - h + 40 + k * 80, 105, 40); c.fillStyle = '#2a0a12'; for (let j = 1; j < 6; j++) c.fillRect(x + 10 + j * 17, GY - h + 40 + k * 80, 2, 40); } }
      ground('#3a1a1a', '#100505'); break;
    case 'village':
      sky('#0e1a24', '#304a50'); moon(300, 120, 44); mountains('#14262a', 430, 120, 4); trees('#0c1a18', 40, 300);
      c.fillStyle = '#1a2a3a'; c.beginPath(); c.ellipse(900, GY + 40, 300, 50, 0, 0, TAU); c.fill();
      ground('#2a3028', '#0c100c'); break;
    case 'castle': case 'castle_ice': case 'castle_moon':
      sky(key === 'castle_ice' ? '#0a1a2a' : '#1a0a0a', key === 'castle_ice' ? '#204060' : '#3a1a10');
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 9; i++) {
          c.save(); c.translate(rnd(0, W), rnd(0, GY - 100)); c.rotate((Math.random() < 0.5 ? 0 : Math.PI / 2) + (Math.random() < 0.3 ? Math.PI : 0));
          c.globalAlpha = 0.3 + layer * 0.25; c.fillStyle = key === 'castle_ice' ? '#3a5a7a' : '#5a2a14'; c.fillRect(-90, -60, 180, 120);
          c.fillStyle = key === 'castle_ice' ? '#cfe8ff' : '#f0d8a0'; for (let k = 0; k < 4; k++) c.fillRect(-82 + k * 42, -50, 36, 100);
          c.fillStyle = key === 'castle_ice' ? '#3a5a7a' : '#5a2a14'; for (let k = 0; k < 4; k++) for (let j = 1; j < 4; j++) c.fillRect(-82 + k * 42, -50 + j * 25, 36, 2);
          c.restore();
        }
      }
      c.globalAlpha = 1;
      if (key === 'castle_moon') moon(640, 170, 90, '#f0e0ff');
      for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,180,90,.6)'; c.beginPath(); c.arc(rnd(0, W), rnd(40, 300), 6, 0, TAU); c.fill(); }
      if (key === 'castle_ice') { c.fillStyle = 'rgba(200,230,255,.5)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(rnd(0, W), GY - 4, 50, 10, 0, 0, TAU); c.fill(); } }
      for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#6a4a2a' : '#5a3a1a'; c.fillRect(i * 80, GY, 80, H - GY); }
      break;
    case 'city':
      sky('#05050c', '#1a1430'); stars(80);
      for (let i = 0; i < 14; i++) { const x = i * 95, h = rnd(160, 320); c.fillStyle = '#0e0e18'; c.fillRect(x, GY - h, 90, h); for (let w = 0; w < 3; w++) for (let k = 0; k < 6; k++) { c.fillStyle = Math.random() < 0.2 ? 'rgba(255,200,120,.5)' : '#16162a'; c.fillRect(x + 10 + w * 26, GY - h + 20 + k * 40, 16, 22); } }
      c.fillStyle = 'rgba(120,20,30,.3)'; c.fillRect(0, GY - 40, W, 40);
      ground('#1a1a20', '#060608'); break;
  }
}

function drawDummy(ctx, b, t) {
  const wob = b.hurt > 0 ? Math.sin(b.hurt * 1.3) * 0.08 : 0;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 40, 8, 0, 0, TAU); ctx.fill();
  ctx.rotate(wob);
  const ol = '#1d1422';
  // pole + base
  ctx.fillStyle = '#6a4a2a'; ctx.strokeStyle = ol; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(-7, -190, 14, 190); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-34, -10, 68, 12); ctx.fill(); ctx.stroke();
  // straw bundle
  const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#b8964a'); g.addColorStop(0.5, '#e6cc80'); g.addColorStop(1, '#a8863e');
  ctx.beginPath(); ctx.moveTo(-26, -40); ctx.quadraticCurveTo(-34, -110, -24, -170); ctx.lineTo(24, -170); ctx.quadraticCurveTo(34, -110, 26, -40); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(110,80,30,.6)'; ctx.lineWidth = 1;
  for (let i = -22; i <= 22; i += 5) { ctx.beginPath(); ctx.moveTo(i, -44); ctx.quadraticCurveTo(i * 1.25, -110, i * 0.9, -166); ctx.stroke(); }
  // rope bands
  ctx.strokeStyle = ol; ctx.lineWidth = 2.5;
  for (const y of [-60, -110, -150]) { ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.rect(-30, y - 4, 60, 8); ctx.fill(); ctx.stroke(); }
  // paper talisman face
  ctx.fillStyle = '#f4ecd8'; ctx.beginPath(); ctx.rect(-12, -146, 24, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b01828'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.fillText('鬼', 0, -125);
  ctx.restore();
}
