// ============================================================
//  UI — bilingual (日本語 / Tiếng Việt) HUD, menus, dialog; main loop
// ============================================================
'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const DISP = '"Yuji Syuku","Shippori Mincho B1","Yu Mincho","MS Mincho",serif';
const JPF = '"Shippori Mincho B1","Yu Mincho","Hiragino Mincho ProN","MS Mincho",serif';
const UIF = '"Be Vietnam Pro","Segoe UI","Noto Sans",sans-serif';
if (document.fonts) ['Yuji Syuku', 'Shippori Mincho B1', 'Be Vietnam Pro'].forEach(f => { document.fonts.load(`30px "${f}"`, '鬼滅の刃 全集中 Việt').catch(() => { }); document.fonts.load(`bold 30px "${f}"`, '鬼滅 Việt').catch(() => { }); });

const COL = { ink: '#0d0b12', ink2: '#17131f', crimson: '#b3122e', crimson2: '#e0324e', gold: '#d9b66a', gold2: '#f3dca0', paper: '#efe4cc', dim: '#9d95ad', wis: '#a68bdc' };
const STYLE_VN = { water: 'Hơi thở của Nước', sun: 'Hơi thở Mặt Trời', thunder: 'Hơi thở Sấm Sét', beast: 'Hơi thở Dã Thú', flame: 'Hơi thở Lửa', insect: 'Hơi thở Côn Trùng', love: 'Hơi thở Tình Yêu', mist: 'Hơi thở Sương Mù', sound: 'Hơi thở Âm Thanh', serpent: 'Hơi thở Rắn', wind: 'Hơi thở Gió', stone: 'Hơi thở Đá', flower: 'Hơi thở Hoa', blood: 'Huyết Quỷ Thuật' };
const BOSS_VN = { temoni: 'Quỷ Tay', susamaru: 'Susamaru', kyogai: 'Kyogai', rui: 'Rui', enmu: 'Enmu', akaza: 'Akaza', akaza2: 'Akaza', daki: 'Daki', gyutaro: 'Gyutaro', gyokko: 'Gyokko', hantengu: 'Zohakuten (Hantengu)', doma: 'Douma', kokushibo: 'Kokushibo', muzan: 'Kibutsuji Muzan', mini: 'Quỷ', mini_doma: 'Búp bê băng', dummy: 'Bù nhìn rơm' };
const TITLE_VN = { '異形の鬼': 'Quỷ dị hình', '十二鬼月を名乗る鬼': 'Tự xưng Thập Nhị Quỷ Nguyệt', '元・下弦の陸': 'Cựu Hạ Huyền Lục', '下弦の伍': 'Hạ Huyền Ngũ', '下弦の壱': 'Hạ Huyền Nhất', '上弦の参': 'Thượng Huyền Tam', '上弦の陸': 'Thượng Huyền Lục', '上弦の伍': 'Thượng Huyền Ngũ', '上弦の肆 半天狗': 'Thượng Huyền Tứ', '上弦の弐': 'Thượng Huyền Nhị', '上弦の壱': 'Thượng Huyền Nhất', '鬼の始祖': 'Thủy tổ loài quỷ', '稽古台': 'Bia tập' };
const BUFF_N = { sense: ['空間識覚', 'Cảm nhận'], evade: ['幻日虹', 'Ảo ảnh'], invis: ['朧', 'Ẩn thân'], guard: ['岩軀の膚', 'Giáp đá'], nagi: ['凪', 'Phong lặng'], slow: ['彼岸朱眼', 'Mắt chậm'] };

let mode = 'title', menuIdx = 0, selIdx = 0, mlIdx = 0, setIdx = 0, gt = 0;
let dlg = null;
let progress = 0;
try { progress = +localStorage.getItem('kny_progress') || 0; } catch (e) { }
try { const s = JSON.parse(localStorage.getItem('kny_settings') || '{}'); if (s.voice === false) Audio.voiceOn = false; if (s.music === false) Audio.musicOn = false; } catch (e) { }
function saveSettings() { try { localStorage.setItem('kny_settings', JSON.stringify({ voice: Audio.voiceOn, music: Audio.musicOn })); } catch (e) { } }
function saveProgress() { try { localStorage.setItem('kny_progress', progress); } catch (e) { } }

cv.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
cv.addEventListener('mousedown', e => {
  Audio.init();
  const r = cv.getBoundingClientRect();
  Input.click = { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  // in battle: left click = slash (hold for auto combo), right click = fire the selected form
  if (mode === 'battle' && Input.click.y < H - 130 && !(Input.click.x < 400 && Input.click.y > H - 200)) {
    if (e.button === 0) { Input.pressed.KeyJ = true; Input.keys.KeyJ = true; }
    if (e.button === 2) Input.pressed.KeyK = true;
  }
});
addEventListener('mouseup', e => { if (e.button === 0) Input.keys.KeyJ = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
// ---- gamepad (standard mapping): stick/D-pad move · A jump · X slash · Y form · B dash · LB/RB choose form · LT palette · RT focus · L3/R3 parry · Back switch · Start pause
const PAD_MAP = [[10, ['KeyG']], [11, ['KeyG']], [0, ['Space', 'Enter']], [1, ['ShiftLeft']], [2, ['KeyJ']], [3, ['KeyK']], [4, ['KeyQ']], [5, ['KeyE']], [6, ['KeyF']], [7, ['KeyL']], [8, ['Tab']], [9, ['Escape']], [12, ['KeyW']], [13, ['KeyS']], [14, ['KeyA']], [15, ['KeyD']]];
const padHeld = {};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; const gp = pads && [...pads].find(p => p && p.connected); if (!gp) return;
  const want = {};
  for (const [bi, codes] of PAD_MAP) if (gp.buttons[bi] && gp.buttons[bi].pressed) codes.forEach(c => want[c] = 1);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (ax < -0.4) want.KeyA = 1; if (ax > 0.4) want.KeyD = 1; if (ay < -0.4) want.KeyW = 1; if (ay > 0.4) want.KeyS = 1;
  for (const c of new Set([...Object.keys(want), ...Object.keys(padHeld)])) {
    if (want[c] && !padHeld[c]) { Input.pressed[c] = true; Input.keys[c] = true; padHeld[c] = 1; Audio.init(); }
    else if (!want[c] && padHeld[c]) { Input.keys[c] = false; delete padHeld[c]; }
  }
}
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  for (const el of [cv, document.getElementById('gl'), document.getElementById('wrap')]) if (el) { el.style.width = W * s + 'px'; el.style.height = H * s + 'px'; }
}
addEventListener('resize', fit); fit();
const clickIn = (x, y, w, h) => Input.click && Input.click.x >= x && Input.click.x <= x + w && Input.click.y >= y && Input.click.y <= y + h;

// ============================================================
//  DESIGN PRIMITIVES
// ============================================================
function txt(s, x, y, size, col, align, font, stroke) { T(s, x, y, { size, col, align, font, stroke }); }
function T(s, x, y, o) {
  o = o || {};
  ctx.font = `${o.weight || ''} ${o.size || 16}px ${o.font || UIF}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.alpha !== undefined) { ctx.save(); ctx.globalAlpha *= o.alpha; }
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowB || 14; }
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeCol || 'rgba(0,0,0,.88)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.col || '#fff'; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
  const w = ctx.measureText(s).width;
  if (o.alpha !== undefined) ctx.restore();
  return w;
}
function measure(s, size, font, weight) { ctx.font = `${weight || ''} ${size}px ${font || UIF}`; return ctx.measureText(s).width; }
function wrap(s, maxW, size, font) {
  ctx.font = `${size}px ${font}`;
  const out = []; let line = '';
  const tokens = /\s/.test(s) ? s.split(/(\s+)/) : [...s];
  for (const tk of tokens) { if (ctx.measureText(line + tk).width > maxW && line) { out.push(line); line = tk.trimStart(); } else line += tk; }
  if (line) out.push(line);
  return out;
}
function vtext(s, x, y, size, col, o) {
  o = o || {};
  ctx.font = `${size}px ${o.font || DISP}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let yy = y;
  for (const ch of s) {
    if (ch === ' ' || ch === '・') { yy += size * 0.45; continue; }
    if (o.stroke !== 0) { ctx.lineWidth = size * 0.12; ctx.strokeStyle = o.strokeCol || '#000'; ctx.lineJoin = 'round'; ctx.strokeText(ch, x, yy); }
    ctx.fillStyle = col; ctx.fillText(ch, x, yy); yy += size * (o.gap || 1.0);
  }
  return yy;
}
// tiled patterns
const pats = {}, patName = new WeakMap();
function pat(key, size, fn) {
  if (pats[key]) return pats[key];
  const c = document.createElement('canvas'); c.width = c.height = size; fn(c.getContext('2d'), size);
  pats[key] = ctx.createPattern(c, 'repeat'); patName.set(pats[key], key);
  return pats[key];
}
// offscreen cache for static UI pieces
const uiCache = new Map();
function cached(key, w, h, draw, x, y) {
  let cv2 = uiCache.get(key);
  if (!cv2) {
    cv2 = document.createElement('canvas'); cv2.width = Math.ceil(w); cv2.height = Math.ceil(h);
    const real = ctx; const c2 = cv2.getContext('2d');
    drawingCtx = c2; draw(c2); drawingCtx = real;
    if (uiCache.size > 400) uiCache.clear();
    uiCache.set(key, cv2);
  }
  ctx.drawImage(cv2, x, y);
}
let drawingCtx = null;
const P_SEIGAIHA = () => pat('sei', 40, (g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = 1.2;
  for (const [cx, cy] of [[0, s / 2], [s, s / 2], [s / 2, s], [0, s * 1.5], [s, s * 1.5], [s / 2, 0]]) for (let r = s / 2; r > 3; r -= 5) { g.beginPath(); g.arc(cx, cy, r, Math.PI, TAU); g.stroke(); }
});
const P_ASANOHA = () => pat('asa', 36, (g, s) => {
  g.strokeStyle = '#fff'; g.lineWidth = 1; const h = s / 2;
  const L = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
  L(0, 0, s, s); L(s, 0, 0, s); L(h, 0, h, s); L(0, h, s, h); L(0, 0, h, h * 0.5); L(s, 0, h, h * 0.5); L(0, s, h, s - h * 0.5); L(s, s, h, s - h * 0.5);
});
const P_ICHI = (a, b) => pat('ichi' + a + b, 16, (g, s) => { g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = b; g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2); });
const P_UROKO = () => pat('uro', 24, (g, s) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, s); g.lineTo(s / 2, 0); g.lineTo(s, s); g.fill(); });

// lacquer panel with gold corner brackets
function panel(x, y, w, h, o) {
  o = o || {};
  const key = ['P', Math.round(w), Math.round(h), o.r, o.top, o.bot, o.pattern ? patName.get(o.pattern) : '', o.patAlpha, o.accent, o.border, o.corner].join('|');
  cached(key, w + 2, h + 2, c2 => panelRaw(c2, 1, 1, w, h, o), x - 1, y - 1);
}
function panelRaw(ctx, x, y, w, h, o) {
  ctx.save();
  roundRect(ctx, x, y, w, h, o.r || 10);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top || 'rgba(30,24,40,.92)'); g.addColorStop(1, o.bot || 'rgba(12,10,18,.94)');
  ctx.fillStyle = g; ctx.fill();
  if (o.pattern) { ctx.save(); ctx.clip(); ctx.globalAlpha = o.patAlpha || 0.05; ctx.fillStyle = o.pattern; ctx.fillRect(x, y, w, h); ctx.restore(); }
  if (o.accent) { ctx.save(); roundRect(ctx, x, y, w, h, o.r || 10); ctx.clip(); ctx.fillStyle = o.accent; ctx.fillRect(x, y, 5, h); ctx.restore(); }
  ctx.strokeStyle = o.border || 'rgba(217,182,106,.55)'; ctx.lineWidth = 1.2; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, o.r || 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(217,182,106,.18)'; roundRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(2, (o.r || 10) - 4)); ctx.stroke();
  ctx.strokeStyle = o.corner || COL.gold; ctx.lineWidth = 2;
  const c = 12;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * 3, cy + sy * (c + 3)); ctx.lineTo(cx + sx * 3, cy + sy * 3); ctx.lineTo(cx + sx * (c + 3), cy + sy * 3); ctx.stroke(); }
  ctx.restore();
}
// slanted gauge with damage trail
function gauge(x, y, w, h, v, trail, c1, c2, o) {
  o = o || {};
  const sk = h * 0.7;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x + sk, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - sk, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fill();
  ctx.save(); ctx.clip();
  if (trail > v) { ctx.fillStyle = 'rgba(255,240,220,.75)'; ctx.fillRect(x, y, w * clamp(trail, 0, 1), h); }
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(x, y, w * clamp(v, 0, 1), h);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x, y, w * clamp(v, 0, 1), h * 0.38);
  if (o.wave) { ctx.globalAlpha = 0.25; ctx.fillStyle = P_SEIGAIHA(); ctx.fillRect(x, y, w * clamp(v, 0, 1), h); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 10; i++) ctx.fillRect(x + w * i / 10, y + h * 0.55, 1, h * 0.45);
  if (o.notch) { ctx.fillStyle = COL.gold2; ctx.fillRect(x + w * o.notch - 1, y, 2, h); }
  ctx.restore();
  ctx.strokeStyle = o.border || 'rgba(217,182,106,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}
function trailOf(obj, key, v) { const k = '_tr_' + key; if (obj[k] === undefined || obj[k] < v) obj[k] = v; else obj[k] = Math.max(v, obj[k] - 0.006); return obj[k]; }
function rndS(a, k) { return a * Math.sin(k * 12.9898 + 4.1); }
// red hanko seal
function seal(x, y, s, text, o) {
  o = o || {};
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(o.rot || 0);
  ctx.fillStyle = o.col || COL.crimson;
  ctx.beginPath(); const j = s * 0.04;
  ctx.moveTo(-s / 2 + rndS(j, 1), -s / 2); ctx.lineTo(s / 2, -s / 2 + rndS(j, 2)); ctx.lineTo(s / 2 - rndS(j, 3), s / 2); ctx.lineTo(-s / 2, s / 2 - rndS(j, 4)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,230,.85)'; ctx.lineWidth = Math.max(1.2, s * 0.04); ctx.strokeRect(-s / 2 + s * 0.09, -s / 2 + s * 0.09, s * 0.82, s * 0.82);
  const chars = [...text];
  ctx.fillStyle = o.txt || '#fff4ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (chars.length <= 1) { ctx.font = `${s * 0.62}px ${DISP}`; ctx.fillText(text, 0, s * 0.04); }
  else if (chars.length === 2) { ctx.font = `${s * 0.38}px ${DISP}`; ctx.fillText(chars[0], 0, -s * 0.18); ctx.fillText(chars[1], 0, s * 0.22); }
  else { ctx.font = `${s * 0.3}px ${DISP}`; ctx.fillText(chars.slice(0, 2).join(''), 0, -s * 0.17); ctx.fillText(chars.slice(2).join(''), 0, s * 0.2); }
  ctx.restore();
}
// brush ink stroke band
function ink(x, y, w, h, col, alpha, seed) {
  seed = seed || 1;
  ctx.save(); ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.5);
  const N = 22;
  for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(x + w * u, y + Math.sin(u * 9 + seed) * h * 0.08 + (u < 0.05 ? h * 0.3 : 0)); }
  ctx.lineTo(x + w + h * 0.3, y + h * 0.35);
  for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(x + w * u + Math.sin(u * 30 + seed) * 6, y + h + Math.cos(u * 7 + seed) * h * 0.1 - (u > 0.9 ? h * (u - 0.9) * 3 : 0)); }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha *= 0.35; ctx.strokeStyle = col; ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) { const yy = y + h * (0.2 + k * 0.2); ctx.beginPath(); ctx.moveTo(x + w * 0.85, yy); ctx.lineTo(x + w + 30 + k * 12, yy + 2); ctx.stroke(); }
  ctx.restore();
}
function keycap(k, x, y, o) {
  o = o || {};
  const sz = o.size || 12;
  ctx.font = `600 ${sz}px ${UIF}`; const w = Math.max(20, ctx.measureText(k).width + 12), h = sz + 10;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; roundRect(ctx, x, y - h + 4, w, h, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(217,182,106,.7)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + 3, y + 2, w - 6, 2);
  T(k, x + w / 2, y - 2, { size: sz, col: COL.gold2, align: 'center', weight: 600 });
  return w;
}
function hint(k, jp, vn, x, y) {
  let w = keycap(k, x, y); w += 6;
  w += T(jp, x + w, y - 2, { size: 14, col: '#fff', font: JPF }) + 4;
  w += T(vn, x + w, y - 2, { size: 12, col: COL.dim });
  return w + 18;
}
function hintsWidth(list) {
  let t = 0;
  for (const [k, jp, vn] of list) { ctx.font = `600 12px ${UIF}`; t += Math.max(20, ctx.measureText(k).width + 12) + 6 + measure(jp, 14, JPF) + 4 + measure(vn, 12, UIF) + 18; }
  return t;
}
function hints(list, x, y, align) {
  const total = hintsWidth(list);
  let xx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const h of list) xx += hint(h[0], h[1], h[2], xx, y);
}
// bilingual stacked label
function bi(jp, vn, x, y, o) {
  o = o || {};
  T(jp, x, y, { size: o.size || 24, col: o.col || '#fff', align: o.align, font: o.font || JPF, stroke: o.stroke, weight: o.weight, glow: o.glow });
  T(vn, x, y + (o.gap || (o.size || 24) * 0.75), { size: o.vsize || Math.max(11, (o.size || 24) * 0.46), col: o.vcol || COL.dim, align: o.align, stroke: o.stroke ? 3 : 0, weight: o.vweight || 600 });
}
function portrait(L, x, y, r, o) {
  o = o || {};
  const ring = o.ring || 5, R = r + ring + 4;
  const key = ['R', o.key || (L && L.style), r, ring, o.active ? 1 : 0, o.grey ? 1 : 0, o.theme, o.fallback, o.key && ASSETS.portrait[o.key] ? 1 : 0].join('|');
  cached(key, R * 2, R * 2, c2 => portraitRaw(c2, L, R, R, r, o), x - R, y - R);
}
function portraitRaw(ctx, L, x, y, r, o) {
  ctx.save();
  const th = THEMES[o.theme] || THEMES.normal;
  ctx.beginPath(); ctx.arc(x, y, r + (o.ring || 5), 0, TAU);
  ctx.fillStyle = (L && haoriFill(ctx, L)) || th.m; ctx.fill();
  ctx.strokeStyle = o.active ? COL.gold2 : 'rgba(217,182,106,.8)'; ctx.lineWidth = o.active ? 3 : 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  const g = ctx.createRadialGradient(x, y - r * 0.3, 2, x, y, r); g.addColorStop(0, shade(th.m, 30)); g.addColorStop(1, shade(th.d, -40));
  ctx.fillStyle = g; ctx.fill(); ctx.clip();
  if (o.grey) ctx.filter = 'grayscale(1) brightness(.5)';
  if (o.key && ASSETS.portrait[o.key]) { const im = ASSETS.portrait[o.key], k = (r * 2) / Math.min(im.width, im.height); ctx.drawImage(im, x - im.width * k / 2, y - im.height * k / 2, im.width * k, im.height * k); }
  else if (L) { ctx.translate(x - r * 0.08, y + r * 0.12); const s = r / 21; ctx.scale(s, s); withLineScale(ctx, Math.min(1, 1.6 / s + 0.25), () => drawHead(ctx, L, 0, 0, { t: 0 }, 1)); }
  else { ctx.font = `${r}px ${DISP}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6070'; ctx.fillText(o.fallback || '鬼', x, y + r * 0.35); }
  ctx.restore();
}
const KN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三'];
function demonLook(key) { const b = BOSSES[key]; return b && DEMON_LOOKS[b.look] || null; }
function sealText(f, st) {
  if (f.kata) return f.kata.replace(/ノ.*$/, '');
  return st.theme === 'sun' ? '日' : st.theme === 'blood' ? '血' : '技';
}
function vnName(f) { return f.vn.split(' — ')[0]; }
function vnDesc(f) { return f.vn.split(' — ')[1] || ''; }
function bgCanvas(key) {
  if (!bgCache[key]) { const c = document.createElement('canvas'); c.width = W; c.height = H; buildBg(c.getContext('2d'), key); bgCache[key] = c; }
  return bgCache[key];
}
function vignette(a) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function patternBg(base, p, a) { ctx.fillStyle = base; ctx.fillRect(0, 0, W, H); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function screenHeader(jp, vn, sealT, right) {
  const g = ctx.createLinearGradient(0, 0, 0, 72); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 72);
  seal(30, 14, 46, sealT, { rot: -0.05 });
  T(jp, 90, 50, { size: 36, font: DISP, col: '#fff', stroke: 4 });
  const w = measure(jp, 36, DISP);
  T(vn, 102 + w, 48, { size: 15, col: COL.gold2, weight: 600 });
  if (right) T(right, W - 30, 46, { size: 13, col: COL.dim, align: 'right', font: JPF });
  ctx.fillStyle = 'rgba(217,182,106,.45)'; ctx.fillRect(30, 70, W - 60, 1);
}

// ============================================================
//  BATTLE
// ============================================================
// 3D facing: turn toward where you run; when standing/attacking, square up to the nearest demon
function yawTo(dx, dz) { return Math.atan2(dx, dz); }
function battleActors() {
  const out = [], P = activeP(), S3 = 0.01;
  G.bosses.forEach((b, i) => {
    const tgt = b.dead ? null : P, yaw = tgt && !b.fleeing ? yawTo(tgt.x - b.x, (tgt.z - b.z) * 1.0 + 110) : b.face * 0.9;
    out.push({ id: 'B' + i, key: b.key, lk: b.def.look, boss: 1, x: b.x, y: b.y, z: (b.z || 0) * S3, yaw, scale: b.scale, face: b.face, look: DEMON_LOOKS[b.def.look], custom: !DEMON_LOOKS[b.def.look], flash: b.flash > 0, alpha: b.dead ? Math.max(0, 1 - b.deadT / 90) : 1,
      pose: { t: G.t, run: b.walk, swing: b.swing !== undefined ? b.swing : 0.9, lean: b.lean || 0, hurt: b.hurt > 0, arm2: b.arm2, shout: b.state === 'tele' },
      draw: (g, ox, oy) => drawBoss(g, Object.assign({}, b, { x: ox, y: oy, small: null }), G) });
  });
  G.bosses.forEach((b, i) => { if (b.def.trueBody && b.small && !b.dead) out.push({ id: 'S' + i, key: 'hantengu_small', lk: 'hantengu_small', boss: 1, x: b.small.x, y: b.small.y, z: (b.small.z || 0) * S3, yaw: yawTo(b.small.vx || 1, b.small.vz || 0), scale: 0.22, face: b.face, look: DEMON_LOOKS.hantengu, pose: { t: G.t, run: G.t * 0.4 }, draw: () => 0 }); });
  if (!P.down) {
    const pose = playerPose(P), alpha = playerAlpha(P);
    let yaw;
    const moving = !P.cast && P.hurtT <= 0 && (Math.abs(P.vx) + Math.abs(P.vz || 0) > 0.5 || P.dashT > 0);
    if (moving) { const dd = P.dashT > 0 && P.dashDir ? P.dashDir : [P.vx, P.vz || 0]; yaw = yawTo(dd[0], dd[1] * 1.15); }
    else { const e = nearestEnemy(P); yaw = e && Math.sign(e.x - P.x) === P.face ? yawTo(e.x - P.x, ((e.z || 0) - P.z) + 90) : P.face * 0.95; if (P.cast) yaw = P.face * 1.2 + (e && Math.sign(e.x - P.x) === P.face ? clamp(-((e.z || 0) - P.z) * 0.004 * P.face, -0.5, 0.5) : 0); }
    out.push({ id: 'P', key: P.key, ch: P.ch, look: P.look, x: P.x, y: P.y, z: (P.z || 0) * S3 + 0.02, yaw, face: P.face, scale: P.scale, pose, alpha,
      draw: (g, ox, oy) => drawPerson(g, P.look, P.ch, ox, oy, P.face, Object.assign({}, pose, { noShadow: 1 }), alpha, P.scale) });
  }
  return out;
}
// draw a 2D label/gauge anchored at a 3D game position, scaled by perspective
function atWorld(x, y, z, fn, minK) {
  const p = R3D.project(x, y, z); if (p[2] > 1) return;
  const k = Math.max(minK || 0.55, R3D.scaleAt(x, y, z));
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(k, k); fn(); ctx.restore();
}
function drawAuras(P) { // guard / Nagi / Zen / sleep effects around the active slayer (local coords, feet at 0,0)
  if (P.buffs.guard) { ctx.save(); ctx.strokeStyle = '#aaa'; ctx.lineWidth = 4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.ellipse(0, -75, 90, 60, 0, G.t * 0.2, G.t * 0.2 + TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(Math.cos(G.t * 0.2) * 90, -75 + Math.sin(G.t * 0.2) * 60, 14, 0, TAU); ctx.fill(); ctx.restore(); }
  if (P.buffs.nagi) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -2, 60 + ((G.t + i * 20) % 60) * 2, 12 + ((G.t + i * 20) % 60) * 0.4, 0, 0, TAU); ctx.stroke(); } ctx.restore(); }
  if (P.zen) { ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(G.t * 0.2) * 0.15; ctx.strokeStyle = THEMES[curStyle(P).theme].l; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -75, 50, 90, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  if (P.sleep > 0) txt('Zzz', 20, -170 - Math.sin(G.t * 0.1) * 5, 20, '#c8a0ff', 'center', UIF, 3);
}
function renderBattle3D() {
  R3D.render(G, battleActors(), { cam: true });
  ctx.clearRect(0, 0, W, H);
  drawHazards(); // 3D mode: only the warning captions (the telegraphs themselves are 3D)
  for (const b of G.bosses) {
    G.cz = b.z || 0;
    if (b.burning || (G.over === 'win' && G.dawnMax && b.def.final)) for (let i = 0; i < 3; i++) particles('flame', b.x + rnd(-30, 30), b.y - rnd(0, b.hh), 1, 3, { g: -0.15 });
    if (b.pending) atWorld(b.x, b.y - b.hh - 60, b.z, () => { seal(-22, -14, 44, '頸', { rot: Math.sin(G.t * 0.2) * 0.1 }); T(Math.ceil(b.pending / 60) + 's', 0, -20, { size: 14, col: '#fff', align: 'center', stroke: 3, weight: 700 }); });
    if (b.def.minion && !b.dead) atWorld(b.x, b.y - b.hh - 16, b.z, () => gauge(-30, 0, 60, 6, b.hp / b.maxhp, trailOf(b, 'hp', b.hp / b.maxhp), '#ff5060', '#a01020'));
    if (b.def.trueBody && b.small && !b.dead) { const sm = b.small; atWorld(sm.x, sm.y, sm.z, () => drawSmallBody(ctx, Object.assign({}, b, { small: Object.assign({}, sm, { x: 0, y: 0 }) }), G.t, true)); }
  }
  const P = activeP(); G.cz = P.z || 0;
  if (!P.down) atWorld(P.x, P.y, P.z, () => drawAuras(P));
  // off-screen demons: arrow + name at the screen edge
  for (const b of G.bosses) {
    if (b.dead || b.def.minion) continue;
    const p = R3D.project(b.x, b.y - b.hh * 0.6, b.z); if (p[0] > 30 && p[0] < W - 30) continue;
    const side = p[0] < 30 ? -1 : 1, x = side < 0 ? 34 : W - 34, y = clamp(p[1], 150, H - 160), pulse = 0.75 + Math.sin(G.t * 0.2) * 0.25;
    ctx.save(); ctx.globalAlpha = pulse; ctx.translate(x, y); ctx.fillStyle = COL.crimson; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(side * 22, 0); ctx.lineTo(-side * 6, -16); ctx.lineTo(-side * 6, 16); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    T(b.def.name, x - side * 26, y + 5, { size: 15, font: JPF, col: '#fff', align: side < 0 ? 'left' : 'right', stroke: 3 });
  }
  for (const t of G.texts) { const jp = /[　-鿿]/.test(t.s); atWorld(t.x, t.y, t.z, () => T(t.s, 0, 0, { size: t.size, col: t.c, align: 'center', font: jp ? JPF : UIF, weight: jp ? '' : 700, stroke: 4, alpha: Math.min(1, t.life / 20) }), 0.7); }
}
function renderBattle() {
  if (R3D.ok) { renderBattle3D(); renderBattleOverlay(); return; }
  ctx.save();
  if (G.shake > 0.5) ctx.translate(rnd(-G.shake, G.shake), rnd(-G.shake, G.shake));
  if (G.tiltT > 0) { ctx.translate(W / 2, H / 2); ctx.rotate(G.tilt * 0.12 * Math.sin(Math.PI * G.tiltT / 120)); ctx.translate(-W / 2, -H / 2); }
  drawBackground(ctx, G.S.bg, G);
  for (const p of G.amb) drawParticle(ctx, p);
  drawHazards();
  for (const b of G.bosses) {
    drawBoss(ctx, b, G);
    if (b.burning || (G.over === 'win' && G.dawnMax && b.def.final)) for (let i = 0; i < 3; i++) particles('flame', b.x + rnd(-30, 30), b.y - rnd(0, b.hh), 1, 3, { g: -0.15 });
    if (b.pending) { seal(b.x - 22, b.y - b.hh - 74, 44, '頸', { rot: Math.sin(G.t * 0.2) * 0.1 }); T(Math.ceil(b.pending / 60) + 's', b.x, b.y - b.hh - 80, { size: 14, col: '#fff', align: 'center', stroke: 3, weight: 700 }); }
    if (b.def.minion && !b.dead) gauge(b.x - 30, b.y - b.hh - 16, 60, 6, b.hp / b.maxhp, trailOf(b, 'hp', b.hp / b.maxhp), '#ff5060', '#a01020');
  }
  for (const p of G.eproj) drawEProj(p);
  const P = activeP();
  if (!P.down) drawPlayerChar(P);
  for (const e of G.fx) drawFx(e);
  for (const p of G.pproj) drawPProj(p);
  for (const p of G.parts) drawParticle(ctx, p);
  for (const t of G.texts) { const jp = /[　-鿿]/.test(t.s); T(t.s, t.x, t.y, { size: t.size, col: t.c, align: 'center', font: jp ? JPF : UIF, weight: jp ? '' : 700, stroke: 4, alpha: Math.min(1, t.life / 20) }); }
  ctx.restore();
  renderBattleOverlay();
}
function renderBattleOverlay() {
  const P = activeP();
  if (G.slow < 1) { const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 800); g.addColorStop(0, 'rgba(255,0,60,0)'); g.addColorStop(1, 'rgba(255,0,60,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (P.sleep > 0) {
    ctx.save(); ctx.globalAlpha = 0.6 * Math.min(1, P.sleep * 2); const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700); g.addColorStop(0, 'rgba(255,200,240,.15)'); g.addColorStop(1, 'rgba(110,30,150,1)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    panel(W / 2 - 280, 300, 560, 110, { pattern: P_ASANOHA(), patAlpha: 0.08, accent: '#c080ff' });
    bi('夢の中… 自分の頸を斬れ！', 'Đang trong mơ… Bấm J liên tục để tự tỉnh dậy!', W / 2, 346, { size: 30, align: 'center', font: DISP, vcol: '#ffd0ff', vsize: 15, gap: 26 });
    gauge(W / 2 - 160, 384, 320, 12, 1 - P.sleep, 1 - P.sleep, '#ffb0ff', '#a060ff');
  }
  if (G.flashScreen) { ctx.save(); ctx.globalAlpha = 0.6 * (1 - G.flashScreen.t / G.flashScreen.life); ctx.fillStyle = G.flashScreen.c; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  if (G.over === 'win' && G.dawnMax) { ctx.save(); ctx.globalAlpha = Math.min(0.7, Math.max(0, G.overT + 60) / 200); ctx.fillStyle = '#fff2c0'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  drawHUD();
  drawTrainingHUD();
  drawCallouts();
  if (G.bossLine) {
    const b = G.bossLine.b, a = Math.min(1, (90 - G.bossLine.t) / 20, G.bossLine.t / 6);
    const bp = R3D.ok ? R3D.project(b.x, b.y - b.hh - 44, b.z) : [b.x, b.y - b.hh - 44];
    const x = clamp(bp[0], 240, W - 240), y = Math.max(150, bp[1]);
    const w = measure(G.bossLine.s, 22, JPF) + 40;
    ctx.save(); ctx.globalAlpha = a; ink(x - w / 2, y - 26, w, 36, 'rgba(60,0,10,.85)', 1, 3); T(G.bossLine.s, x, y, { size: 22, font: JPF, col: '#ffc4cc', align: 'center', stroke: 4, weight: 600 }); ctx.restore();
  }
  if (G.banner) {
    const b = G.banner, a = Math.min(1, b.t / 10, (b.dur - b.t) / 20);
    ctx.save(); ctx.globalAlpha = a;
    const h = b.jp ? 84 : 50, y = 236;
    ink(W / 2 - 400, y, 800, h, 'rgba(8,6,12,.82)', 1, 5);
    ctx.fillStyle = COL.crimson; ctx.fillRect(W / 2 - 360, y + h - 6, 720, 2);
    if (b.jp) bi(b.jp, b.vn, W / 2, y + 42, { size: 34, align: 'center', font: DISP, vcol: COL.gold2, vsize: 17, gap: 30, stroke: 4 });
    else T(b.vn, W / 2, y + 32, { size: 18, col: COL.gold2, align: 'center', weight: 600 });
    ctx.restore();
  }
  if (G.bigKanji) {
    const k = G.bigKanji, s = 1 + Math.max(0, 1 - k.t / 8) * 2;
    ctx.save(); ctx.globalAlpha = Math.min(1, (70 - k.t) / 20); ctx.translate(W / 2, H / 2 - 20); ctx.scale(s, s); ctx.rotate(-0.06);
    T(k.s, 0, 90, { size: 280, font: DISP, col: '#e01020', align: 'center', stroke: 14, glow: '#ff2040', glowB: 30 }); ctx.restore();
    if (k.t > 10) { ctx.save(); ctx.globalAlpha = Math.min(1, (70 - k.t) / 20); bi('頸を斬った！', 'Đã chém đứt cổ quỷ!', W / 2, H / 2 + 170, { size: 38, font: DISP, align: 'center', stroke: 6, vcol: '#fff', vsize: 18, gap: 30 }); ctx.restore(); }
  }
  if (G.palette) drawPalette();
  if (G.cutin) drawCutin(G.cutin);
  if (G.over === 'lose') {
    ctx.fillStyle = `rgba(10,0,4,${Math.min(0.8, G.overT / 70)})`; ctx.fillRect(0, 0, W, H);
    if (G.overT > 30) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (G.overT - 30) / 30);
      ink(W / 2 - 300, H / 2 - 110, 600, 150, 'rgba(120,0,20,.6)', 1, 9);
      T('敗北', W / 2, H / 2, { size: 130, font: DISP, col: '#f2e6e6', align: 'center', stroke: 8 });
      T('THẤT BẠI', W / 2, H / 2 + 44, { size: 20, col: COL.gold2, align: 'center', weight: 700 });
      hints([['Enter', '再挑戦', 'Thử lại'], ['Esc', 'ステージ選択', 'Chọn ải']], W / 2, H / 2 + 100, 'center');
      ctx.restore();
    }
  }
  if (G.paused) drawPause();
}
function drawCallouts() {
  G.callouts.forEach((c, i) => {
    const th = THEMES[c.theme] || THEMES.normal;
    const a = Math.min(1, (c.dur - c.t) / 18), slide = Math.max(0, 1 - c.t / 8);
    if (c.small) { T(c.jp, W / 2 + (i % 2 ? 170 : -170), 170 + (i % 3) * 32, { size: 30, font: DISP, col: th.l, align: 'center', stroke: 5, alpha: a, glow: th.m }); return; }
    const y = 108, h = c.big ? 112 : 96;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(-slide * 320, 0);
    ink(W / 2 - 420, y, 840, h, 'rgba(8,6,12,.86)', 1, 2);
    ink(W / 2 - 380, y + h - 18, 760, 10, th.m, 0.9, 7);
    seal(W / 2 - 400, y + 16, 62, c.kata ? c.kata.replace(/ノ.*$/, '') : (c.theme === 'sun' ? '日' : c.theme === 'blood' ? '血' : '技'), { rot: -0.08 });
    T(c.sub + (STYLE_VN[c.theme] ? '  ·  ' + STYLE_VN[c.theme] : ''), W / 2 + 20, y + 26, { size: 16, col: th.l, align: 'center', font: JPF, stroke: 3 });
    T((c.kata ? c.kata + '　' : '') + c.jp, W / 2 + 20, y + (c.big ? 72 : 64), { size: c.big ? 50 : 42, font: DISP, col: '#fff', align: 'center', stroke: 6, glow: th.m, glowB: 18 });
    if (c.vn) T(c.vn, W / 2 + 20, y + (c.big ? 98 : 86), { size: 15, col: COL.gold2, align: 'center', stroke: 3, weight: 600 });
    ctx.restore();
  });
}
function drawCutin(c) {
  const u = c.t / c.dur, th = THEMES[c.st.theme] || THEMES.normal;
  const ein = Math.min(1, u * 5);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, u * 4)})`; ctx.fillRect(0, 0, W, H);
  // upper band: eyes close-up
  ctx.save(); ctx.translate((1 - ein) * -W, 0);
  ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(W, 110); ctx.lineTo(W, 360); ctx.lineTo(0, 400); ctx.closePath();
  const g = ctx.createLinearGradient(0, 110, 0, 400); g.addColorStop(0, th.d); g.addColorStop(0.5, th.m); g.addColorStop(1, th.d);
  ctx.fillStyle = g; ctx.fill(); ctx.save(); ctx.clip();
  ctx.globalAlpha = 0.12; ctx.fillStyle = P_SEIGAIHA(); ctx.fillRect(0, 100, W, 320); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = 110 + ((i * 53 + c.t * 37) % 300); const x = (i * 97) % W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 260, y - 8); ctx.stroke(); }
  const ci = ASSETS.cutin[c.P.key];
  if (ci) { const k = 300 / ci.height; ctx.drawImage(ci, W / 2 - ci.width * k / 2 + u * 40, 105, ci.width * k, 300); }
  else { ctx.translate(560 + u * 60, 360); ctx.scale(16, 16); withLineScale(ctx, 0.28, () => drawHead(ctx, c.P.look, -10, -4, { t: 0, shout: 1 }, 1)); }
  ctx.restore();
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(W, 110); ctx.moveTo(0, 400); ctx.lineTo(W, 360); ctx.stroke();
  ctx.restore();
  // lower band: technique name
  ctx.save(); ctx.translate((1 - ein) * W, 0);
  ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(W, 395); ctx.lineTo(W, 560); ctx.lineTo(0, 595); ctx.closePath();
  ctx.fillStyle = 'rgba(8,6,12,.95)'; ctx.fill(); ctx.strokeStyle = th.m; ctx.lineWidth = 3; ctx.stroke();
  const lab = (c.st.noZen ? '' : '全集中・') + styleLabel(c.st);
  T(lab + '  ·  ' + (STYLE_VN[c.st.theme] || ''), 120, 456, { size: 20, font: JPF, col: th.l });
  seal(36, 458, 70, sealText(c.f, c.st), { rot: -0.08 });
  T((c.f.kata ? c.f.kata + '　' : '') + (c.f.name || ''), 120, 520, { size: 62, font: DISP, col: '#fff', glow: th.m, glowB: 24 });
  T(c.f.vn, 122, 552, { size: 17, col: COL.gold2, weight: 600 });
  ctx.restore();
  ctx.globalAlpha = Math.min(1, u * 3);
  vtext(c.P.ch.name, W - 60, 150, 34, '#fff');
  ctx.restore();
}
function drawHUD() {
  // ---- boss panels
  const bosses = G.bosses.filter(b => !b.def.minion);
  const twin = bosses.length > 1, pw = twin ? 430 : 780;
  bosses.forEach((b, i) => {
    const x = twin ? (i ? W / 2 + 8 : W / 2 - 8 - pw) : W / 2 - pw / 2, y = 10, h = 68;
    panel(x, y, pw, h, { pattern: P_UROKO(), patAlpha: 0.05, border: 'rgba(200,40,60,.6)' });
    seal(x + 12, y + 10, 48, b.def.rank || '鬼', { rot: -0.04 });
    T(b.def.name, x + 72, y + 32, { size: 26, font: DISP, col: '#fff', stroke: 3 });
    const nw = measure(b.def.name, 26, DISP);
    T(BOSS_VN[b.key] || '', x + 80 + nw, y + 31, { size: 13, col: COL.gold2, weight: 600 });
    if (!twin) T(b.def.title + '  ·  ' + (TITLE_VN[b.def.title] || ''), x + pw - 16, y + 28, { size: 13, col: '#e6b6be', align: 'right', font: JPF });
    const v = b.hp / b.maxhp;
    gauge(x + 72, y + 40, pw - 92, 16, v, trailOf(b, 'hp', v), b.pending ? '#ffa0c0' : '#ff3a4e', b.pending ? '#ff70a0' : '#8a0618', { notch: b.def.p2 ? 0.5 : 0 });
    { const pv = clamp((b.post || 0) / postMax(b), 0, 1), gw = pw - 92; // posture (体勢): full = stunned
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 72, y + 60, gw, 4);
      ctx.fillStyle = b.stunT > 0 ? '#fff6a0' : pv > 0.75 ? '#ffb040' : '#e8c060'; ctx.fillRect(x + 72, y + 60, gw * (b.stunT > 0 ? b.stunT / 180 : pv), 4);
      if (b.stunT > 0) T('隙！ Choáng — dồn đòn!', x + 72 + gw, y + 54, { size: 12, font: JPF, col: '#fff6a0', align: 'right', stroke: 3 });
      else if (b.guardT > 0) T('防 · Đang đỡ đòn chém thường — dùng thức!', x + 72 + gw, y + 54, { size: 12, font: JPF, col: '#a8c8ff', align: 'right', stroke: 3 }); }
    if (b.poison > 0) { ctx.fillStyle = 'rgba(180,100,255,.8)'; ctx.fillRect(x + 72, y + 65, (pw - 92) * clamp(b.poison / 40, 0, 1), 2); T('毒 · Độc', x + pw - 16, y + 66, { size: 10, col: '#d0a0ff', align: 'right', font: JPF }); }
    if (b.small && b.small.hp > 0) { panel(x + 72, y + h + 6, 250, 28, { r: 6, border: 'rgba(255,90,110,.7)' }); T('本体「恨」 · Bản thể  ' + Math.ceil(b.small.hp), x + 86, y + h + 25, { size: 13, col: '#ff8a9a', font: JPF }); }
  });
  // ---- dawn meter
  if (G.dawnMax) {
    const d = G.dawn / G.dawnMax, x = W / 2 - 300, y = 88, w = 600;
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#141a40'); g.addColorStop(0.6, '#5a3a6a'); g.addColorStop(0.85, '#e0703a'); g.addColorStop(1, '#ffd070');
    ctx.save(); roundRect(ctx, x, y, w, 10, 5); ctx.fillStyle = g; ctx.fill(); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + w * d, y, w, 10); ctx.restore();
    ctx.strokeStyle = 'rgba(217,182,106,.6)'; ctx.lineWidth = 1; roundRect(ctx, x, y, w, 10, 5); ctx.stroke();
    ctx.save(); ctx.shadowColor = '#ffb040'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x + w * d, y + 5, 9, 0, TAU); ctx.fill(); ctx.restore();
    T('夜明けまで', x - 12, y + 9, { size: 15, font: JPF, col: '#ffd890', align: 'right', stroke: 3 });
    T('Tới bình minh', x - 12, y + 23, { size: 10, col: COL.dim, align: 'right', stroke: 2 });
    T(Math.max(0, Math.ceil((G.dawnMax - G.dawn) / 60)) + 's', x + w + 12, y + 11, { size: 15, col: '#ffd890', weight: 700, stroke: 3 });
  }
  keycap('Esc', 16, 32, { size: 10 }); T('操作 · Hướng dẫn', 50, 29, { size: 11, col: COL.dim, font: JPF, stroke: 2 });
  // ---- combo counter
  if ((G.combo || 0) >= 3 && G.comboT > 0) {
    const a = Math.min(1, G.comboT / 30), pop = 1 + Math.max(0, (G.comboT - 110) / 10) * 0.25;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W - 40, 210); ctx.scale(pop, pop);
    T(String(G.combo), 0, 0, { size: 54, font: DISP, col: G.combo >= 30 ? '#ffd040' : G.combo >= 15 ? '#ff9a50' : '#fff', align: 'right', stroke: 5, glow: G.combo >= 15 ? '#ff6020' : null, glowB: 14 });
    T('連撃 · Combo  +' + Math.min(G.combo, 50) + '%', 0, 24, { size: 13, font: JPF, col: COL.gold2, align: 'right', stroke: 3 });
    ctx.restore();
  }
  { const P0 = activeP(); // reaction-skill states
    if (P0.counter > 0) T('反撃 · Đòn kế tiếp chí mạng', W - 40, 262, { size: 13, font: JPF, col: '#fff', align: 'right', stroke: 3 });
    if (P0.halfCost > 0) T('見切り · Thức kế tiếp tốn nửa hơi', W - 40, 282, { size: 13, font: JPF, col: '#9fe8ff', align: 'right', stroke: 3 }); }

  // ---- player panel
  const P = activeP(), st = curStyle(P), th = THEMES[st.theme];
  const px = 14, py = H - 102, pw2 = 384, ph = 92;
  panel(px, py, pw2, ph, { pattern: P_ASANOHA(), patAlpha: 0.05, accent: th.m });
  portrait(P.look, px + 50, py + 46, 34, { key: P.key, theme: st.theme, active: 1, ring: 5 });
  T(P.ch.name, px + 100, py + 26, { size: 22, font: DISP, col: '#fff', stroke: 3 });
  T(P.ch.vn, px + 100, py + 40, { size: 11, col: COL.gold2, weight: 600 });
  const hv = P.hp / P.maxhp, bv = P.br / P.maxbr;
  T('体力', px + 100, py + 59, { size: 12, font: JPF, col: '#fff' }); T('Máu', px + 100, py + 69, { size: 9, col: COL.dim });
  gauge(px + 134, py + 49, 236, 14, hv, trailOf(P, 'hp', hv), P.poison > 0 ? '#b8f060' : '#6cf0a0', P.poison > 0 ? '#4a8a10' : '#128a4a');
  T(Math.ceil(P.hp) + ' / ' + P.maxhp, px + 364, py + 60, { size: 10, col: '#fff', align: 'right', weight: 700, stroke: 2 });
  T('呼吸', px + 100, py + 82, { size: 12, font: JPF, col: '#fff' }); T('Hơi thở', px + 100, py + 91, { size: 8, col: COL.dim });
  gauge(px + 134, py + 72, 236, 11, bv, bv, shade(th.l, -20), th.m, { wave: 1 });
  if (P.zen) T('全集中 · Toàn tập trung', px + 250, py + 18, { size: 11, font: JPF, col: th.l, align: 'center', glow: th.m });
  // buffs
  let cx = px + 4; const by = py - 8;
  for (const [k, v] of Object.entries(P.buffs)) {
    if (!(v > 0) || !BUFF_N[k]) continue;
    const s = BUFF_N[k][0] + ' · ' + BUFF_N[k][1] + ' ' + Math.ceil(v / 60) + 's';
    const w = measure(s, 12, JPF) + 16;
    ctx.fillStyle = 'rgba(40,30,10,.88)'; roundRect(ctx, cx, by - 18, w, 20, 10); ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 1; ctx.stroke();
    T(s, cx + 8, by - 4, { size: 12, font: JPF, col: COL.gold2 }); cx += w + 6;
  }
  // team strip
  const ty = py - (cx > px + 4 ? 52 : 28);
  G.team.forEach((p, i) => {
    const x = px + 24 + i * 40, y = ty;
    portrait(p.look, x, y, 15, { key: p.key, theme: curStyle(p).theme, active: i === G.ai, ring: 3, grey: p.down });
    ctx.strokeStyle = p.down ? '#555' : '#6cf0a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * p.hp / p.maxhp); ctx.stroke();
    ctx.fillStyle = i === G.ai ? COL.crimson : 'rgba(0,0,0,.85)'; ctx.beginPath(); ctx.arc(x + 13, y + 13, 7, 0, TAU); ctx.fill();
    T(i === G.ai ? '▶' : '·', x + 13, y + 17, { size: 9, col: '#fff', align: 'center', weight: 700 });
    if (clickIn(x - 18, y - 18, 36, 36)) switchTo(i);
  });
  // ---- technique panel
  const forms = st.forms, fi = P.formIdx[P.styleIdx], f = forms[fi];
  const fx = 412, fy = H - 102, fw = W - fx - 14, fh = 92;
  panel(fx, fy, fw, fh, { pattern: P_SEIGAIHA(), patAlpha: 0.05, accent: th.m });
  const can = P.br >= f.cost;
  forms.forEach((g, i) => { // number-key strip: press the number to fire that form directly
    if (i > 13) return; const x = fx + 8 + i * 46, y = fy - 26, ok = P.br >= g.cost, cur = i === fi;
    ctx.fillStyle = cur ? 'rgba(179,18,46,.92)' : 'rgba(10,8,16,.78)'; ctx.fillRect(x, y, 42, 22);
    ctx.strokeStyle = cur ? COL.gold2 : 'rgba(217,182,106,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 41, 21);
    T(PALETTE_LABELS[i], x + 8, y + 16, { size: 12, col: COL.gold2, align: 'center', weight: 700 });
    T((g.kata || g.name || '').replace(/ノ型.*/, '').slice(0, 2), x + 27, y + 16, { size: 12, font: JPF, col: ok ? '#fff' : '#6a6070', align: 'center' });
    if (clickIn(x, y, 42, 22)) { P.formIdx[P.styleIdx] = i; P.bufK = 12; P.qcast = true; }
  });
  seal(fx + 16, fy + 12, 68, sealText(f, st), { rot: -0.06, col: can ? COL.crimson : '#5a4a50' });
  const lab = (st.noZen ? '' : '全集中・') + styleLabel(st);
  const lw = T(lab, fx + 100, fy + 24, { size: 16, font: JPF, col: th.l, weight: 600 });
  const lw2 = T('·  ' + (STYLE_VN[st.theme] || ''), fx + 108 + lw, fy + 24, { size: 12, col: COL.dim });
  T(`${fi + 1} / ${forms.length}`, fx + 120 + lw + lw2, fy + 24, { size: 11, col: COL.gold, weight: 700 });
  T((f.kata ? f.kata + '　' : '') + (f.name || ''), fx + 100, fy + 60, { size: 32, font: DISP, col: can ? '#fff' : '#8a8090', stroke: 4, glow: can ? th.m : null, glowB: 10 });
  const nv = T(vnName(f), fx + 102, fy + 82, { size: 15, col: COL.gold2, weight: 700 });
  const desc = vnDesc(f), maxD = fw - 300 - 150 - nv;
  T(measure(desc, 12) > maxD ? desc.slice(0, Math.floor(desc.length * maxD / measure(desc, 12)) - 1) + '…' : desc, fx + 110 + nv, fy + 82, { size: 12, col: COL.dim });
  const rx = fx + fw - 290;
  ctx.fillStyle = 'rgba(217,182,106,.25)'; ctx.fillRect(rx - 14, fy + 14, 1, fh - 28);
  const prev = forms[(fi - 1 + forms.length) % forms.length], next = forms[(fi + 1) % forms.length];
  keycap('Q', rx, fy + 26, { size: 10 }); T('◀ ' + (prev.kata ? prev.kata + ' ' : '') + prev.name, rx + 26, fy + 24, { size: 13, font: JPF, col: '#b8a8b0' });
  keycap('E', rx, fy + 47, { size: 10 }); T('▶ ' + (next.kata ? next.kata + ' ' : '') + next.name, rx + 26, fy + 45, { size: 13, font: JPF, col: '#b8a8b0' });
  keycap('K', rx, fy + 68, { size: 10 }); T('/ 1-0', rx + 24, fy + 66, { size: 11, col: COL.gold2, weight: 700 });
  T('Tung chiêu · ' + f.cost + ' hơi' + (f.hpCost ? ' · ' + f.hpCost + ' máu' : ''), rx + 86, fy + 66, { size: 11, col: can ? '#8fd0ff' : '#ff7080', weight: 600 });
  const hk = P.ch.styles.length > 1 ? ['R', '呼吸切替', 'Đổi hơi thở'] : ['L', '全集中', 'Giữ để hồi hơi'];
  keycap(hk[0], rx, fy + 89, { size: 10 }); T(hk[1], rx + 26, fy + 87, { size: 13, font: JPF, col: '#fff' }); T(hk[2], rx + 86, fy + 87, { size: 11, col: COL.dim });
}
function drawPause() {
  ctx.fillStyle = 'rgba(5,3,10,.78)'; ctx.fillRect(0, 0, W, H);
  panel(W / 2 - 420, 70, 840, 580, { pattern: P_ASANOHA(), patAlpha: 0.05 });
  seal(W / 2 - 390, 96, 58, '止', { rot: -0.05 });
  bi('一時停止', 'TẠM DỪNG · Hướng dẫn điều khiển', W / 2 - 316, 132, { size: 40, font: DISP, vcol: COL.gold2, vsize: 15, gap: 28 });
  const rows = [
    ['W A S D', '移動', 'Di chuyển 8 hướng'], ['Space', 'ジャンプ', 'Nhảy'], ['Shift', '回避', 'Lướt né theo hướng đi'],
    ['J / Chuột trái', '斬撃', 'Chém — GIỮ để tự ra combo liên hoàn'], ['1…0 - = [ ]', '技を放つ', 'Tung thẳng thức số đó (khỏi chọn)'], ['K / Chuột phải', '技', 'Tung thức đang chọn (Q/E/lăn chuột)'],
    ['R', '呼吸切替', 'Đổi hơi thở (Tanjiro: Nước ↔ Hinokami)'], ['L (giữ)', '全集中', 'Hồi thanh hơi thở nhanh'], ['Tab / C', '交代', 'Đổi nhân vật (hoặc bấm chân dung)'], ['G', '弾き', 'Chém bật đạn về phía quỷ / gạt đòn → đòn sau chí mạng'],
  ];
  rows.forEach(([k, jp, vn], i) => {
    const y = 204 + i * 39;
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(W / 2 - 380, y - 28, 760, 40); }
    keycap(k, W / 2 - 360, y, { size: 14 }); T(jp, W / 2 - 170, y - 2, { size: 20, font: JPF, col: '#fff', weight: 600 }); T(vn, W / 2 - 30, y - 2, { size: 15, col: '#d8d0e0' });
  });
  hints([['Esc', '再開', 'Tiếp tục'], ['H', '遊び方', 'Hướng dẫn'], ['M', G.S.training ? 'タイトルへ' : 'ステージ選択へ', G.S.training ? 'Về menu' : 'Về chọn ải']], W / 2, 628, 'center');
}

// ============================================================
//  DIALOG
// ============================================================
function startDialog(lines, after) { dlg = { lines, i: 0, t: 0, after }; mode = 'dialog'; speakDlg(); }
function speakDlg() { const l = dlg.lines[dlg.i]; if (!l) return; const sp = SPEAKERS[l[0]]; Audio.say(l[1], sp ? sp.voice : 1, 1.05); }
function advanceDialog() {
  dlg.i++; dlg.t = 0;
  if (dlg.i >= dlg.lines.length) { const a = dlg.after; dlg = null; a(); }
  else speakDlg();
}
function renderDialogScene() {
  const S = G.S;
  const l = dlg.lines[dlg.i] || dlg.lines[dlg.lines.length - 1];
  const spk = l[0];
  if (R3D.ok) {
    const actors = G.team.slice(0, 4).map((p, i) => { const x = 300 - i * 70, pose = { t: G.t + i * 20, swing: 0.9 }, al = spk === p.key ? 1 : 0.75;
      return { id: 'D' + i, key: p.key, ch: p.ch, look: p.look, x, y: GY, face: 1, scale: p.scale, pose, alpha: al, z: -0.3 - i * 0.25, draw: (g, ox, oy) => drawPerson(g, p.look, p.ch, ox, oy, 1, Object.assign({ noShadow: 1 }, pose), al, p.scale) }; });
    G.bosses.forEach((b, i) => actors.push({ id: 'B' + i, key: b.key, lk: b.def.look, boss: 1, x: b.x, y: b.y, scale: b.scale, face: b.face, look: DEMON_LOOKS[b.def.look], custom: !DEMON_LOOKS[b.def.look], pose: { t: G.t, swing: 0.9 }, draw: (g, ox, oy) => drawBoss(g, Object.assign({}, b, { x: ox, y: oy, small: null }), G) }));
    R3D.render(G, actors); ctx.clearRect(0, 0, W, H);
  } else {
    drawBackground(ctx, S.bg, G);
    G.team.slice(0, 4).forEach((p, i) => drawPerson(ctx, p.look, p.ch, 300 - i * 70, GY, 1, { t: G.t + i * 20, swing: 0.9 }, spk === p.key ? 1 : 0.75, p.scale));
    for (const b of G.bosses) drawBoss(ctx, b, G);
  }
  G.t++;
  vignette(0.6);
  // letterbox top
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = 'rgba(217,182,106,.4)'; ctx.fillRect(0, 56, W, 1);
  seal(22, 8, 40, KN[S.id], { rot: -0.05 });
  T(S.arc, 76, 40, { size: 28, font: DISP, col: '#fff' });
  T(S.arcVn + '  ·  ' + S.place, 88 + measure(S.arc, 28, DISP), 38, { size: 13, col: COL.gold2, weight: 600, font: UIF });
  hints([['Enter', '次へ', 'Tiếp'], ['Esc', 'スキップ', 'Bỏ qua']], W - 24, 38, 'right');
  // box
  const bx = 60, by = H - 216, bw = W - 120, bh = 190;
  const isChar = !!CHARS[spk], sp = SPEAKERS[spk];
  panel(bx, by, bw, bh, { pattern: isChar ? P_ASANOHA() : P_UROKO(), patAlpha: 0.06, accent: isChar ? COL.gold : COL.crimson, border: isChar ? undefined : 'rgba(200,40,60,.7)' });
  const L = isChar ? CHARS[spk].look : demonLook(spk);
  portrait(L, bx + 92, by + 98, 62, { key: spk, theme: isChar ? STYLES[CHARS[spk].styles[0]].theme : 'demon', ring: 7, fallback: '鬼' });
  const nm = sp ? sp.name : spk, vnm = isChar ? CHARS[spk].vn.split(' — ')[0] : (BOSS_VN[spk] || '');
  const nw = measure(nm, 24, DISP) + measure(vnm, 13, UIF, 600) + 44;
  ink(bx + 170, by - 22, nw, 42, isChar ? COL.crimson : '#4a0614', 1, 4);
  T(nm, bx + 186, by + 8, { size: 24, font: DISP, col: '#fff' });
  T(vnm, bx + 196 + measure(nm, 24, DISP), by + 6, { size: 13, col: COL.gold2, weight: 600 });
  const shown = Math.floor(dlg.t * 0.8);
  dlg.t++;
  const jl = wrap(l[1], bw - 240, 30, JPF);
  let used = 0;
  jl.forEach((s, i) => { const part = s.slice(0, Math.max(0, shown - used)); used += s.length; T(part, bx + 186, by + 66 + i * 40, { size: 30, font: JPF, col: '#fff', weight: 600 }); });
  if (shown >= l[1].length) {
    ctx.fillStyle = 'rgba(217,182,106,.35)'; ctx.fillRect(bx + 186, by + 50 + jl.length * 40, 60, 1);
    const vl = wrap(l[2], bw - 240, 18, UIF);
    vl.forEach((s, i) => T(s, bx + 186, by + 76 + jl.length * 40 + i * 24, { size: 18, col: '#cfe2ff' }));
    if (G.t % 40 < 26) T('▼', bx + bw - 30, by + bh - 18, { size: 18, col: COL.gold, align: 'center' });
  }
}

// ============================================================
//  MENUS
// ============================================================
function drawKatana(x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(50, -6, 90, -1); ctx.lineTo(90, 2); ctx.quadraticCurveTo(50, 0, 0, 2); ctx.fill();
  ctx.fillStyle = '#c8a040'; ctx.fillRect(-3, -6, 4, 12);
  ctx.fillStyle = P_ICHI('#1d6b4a', '#111'); ctx.fillRect(-26, -2.5, 23, 5);
  ctx.restore();
}
function renderTitle() {
  if (!G || G.si !== -1) { G = { si: -1, t: 0, amb: [], S: { bg: 'wisteria' } }; }
  G.t++; gt++;
  const tPose = { t: G.t, swing: -0.6 + Math.sin(G.t * 0.03) * 0.08 };
  if (R3D.ok) { // 3D title scene: wisteria stage + 3D Tanjiro & Nezuko
    for (const p of G.amb) { p.x += p.vx; p.y += p.vy; p.life--; }
    R3D.render(G, [{ id: 'T0', key: 'nezuko', ch: CHARS.nezuko, look: CHARS.nezuko.look, x: 150, y: GY, face: 1, scale: 1.55, pose: { t: G.t, swing: 0.9 }, z: 0.3, draw: () => 0 },
      { id: 'T1', key: 'tanjiro', ch: CHARS.tanjiro, look: CHARS.tanjiro.look, x: 285, y: GY, face: 1, scale: 1.85, pose: tPose, z: 0.5, draw: () => 0 }]);
    ctx.clearRect(0, 0, W, H);
  } else {
    drawBackground(ctx, 'wisteria', G);
    for (const p of G.amb) { p.x += p.vx; p.y += p.vy; p.life--; drawParticle(ctx, p); }
  }
  G.amb = G.amb.filter(p => p.life > 0);
  const lg = ctx.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, 'rgba(0,0,0,.4)'); lg.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  vignette(0.7);
  if (!R3D.ok) {
    drawPerson(ctx, CHARS.nezuko.look, CHARS.nezuko, 150, GY + 10, 1, { t: G.t, swing: 0.9 }, 1, 1.55);
    drawPerson(ctx, CHARS.tanjiro.look, CHARS.tanjiro, 285, GY + 10, 1, tPose, 1, 1.85);
  }
  ctx.save(); drawSlash(ctx, { cx: 1000, cy: 330, r: 300, a0: -2.6, a1: 0.4, w: 40, theme: 'water', prog: 1, fade: 0.22, sq: 0.55 }); ctx.restore();
  // vertical logo
  ctx.save(); ctx.translate(1102, 40); ctx.rotate(Math.PI / 2); ink(0, 0, 530, 112, 'rgba(150,10,30,.62)', 1, 3); ctx.restore();
  vtext('鬼滅の刃', 1046, 150, 118, '#fff', { gap: 1.02, strokeCol: '#1a0006' });
  vtext('全集中の章', 930, 160, 44, '#ffc6d4', { gap: 1.05 });
  seal(1160, 590, 56, '鬼殺', { rot: 0.08 });
  T('THANH GƯƠM DIỆT QUỶ', 650, 110, { size: 32, col: '#fff', weight: 700, align: 'center', stroke: 5 });
  T('Chương Toàn Tập Trung  ·  Fan game', 650, 140, { size: 15, col: COL.gold2, align: 'center', stroke: 3, weight: 600 });
  T('13 ải theo anime · trận cuối 鬼舞辻無惨', 650, 163, { size: 13, col: '#d8cce8', align: 'center', stroke: 3, font: UIF });
  const items = [['物語', 'Vào truyện', '物'], ['稽古', 'Luyện tập — thử mọi chiêu', '稽'], ['技一覧', 'Danh sách thức & cách dùng', '技'], ['遊び方', 'Hướng dẫn chơi', '遊'], ['設定', 'Cài đặt', '設']];
  items.forEach(([jp, vn, s], i) => {
    const x = 470, y = 236 + i * 72, w = 380, h = 64, sel = i === menuIdx;
    if (clickIn(x, y, w, h)) { if (menuIdx === i) Input.pressed.Enter = true; menuIdx = i; }
    if (sel) { ink(x - 20, y + 2, w + 30, h - 4, 'rgba(179,18,46,.92)', 1, i + 2); drawKatana(x - 58, y + h / 2, 0.9, Math.sin(gt * 0.1) * 0.03); }
    else panel(x, y + 6, w, h - 12, { r: 6 });
    seal(x + 16, y + 13, 38, s, { rot: -0.05, col: sel ? '#1a0a10' : COL.crimson });
    T(jp, x + 68, y + 36, { size: 28, font: DISP, col: '#fff', stroke: sel ? 0 : 3 });
    T(vn, x + 70, y + 54, { size: 13, col: sel ? '#ffe8b0' : COL.dim, weight: 600 });
  });
  hints([['W/S', '選択', 'Chọn'], ['Enter', '決定', 'Xác nhận']], 650, H - 24, 'center');
  if (pressed('KeyW', 'ArrowUp')) { menuIdx = (menuIdx + 4) % 5; Audio.sfx.select(); }
  if (pressed('KeyS', 'ArrowDown')) { menuIdx = (menuIdx + 1) % 5; Audio.sfx.select(); }
  if (pressed('Enter', 'KeyJ', 'Space')) { Audio.init(); Audio.startMusic('calm'); Audio.sfx.gong(); const m = ['select', 'training', 'movelist', 'guide', 'settings'][menuIdx]; if (m === 'training') startTraining('tanjiro'); else if (m === 'guide') openGuide('title'); else mode = m; }
}
function renderSelect() {
  gt++;
  patternBg('#0d0b14', P_SEIGAIHA(), 0.035); vignette(0.6);
  screenHeader('物語', 'Cốt truyện — Con đường diệt quỷ', '道', `討伐 ${Math.min(progress, STAGES.length)} / ${STAGES.length}  ·  Đã hạ`);
  const cols = 5, cw = 232, chh = 150, gx = 12, x0 = (W - (cols * cw + (cols - 1) * gx)) / 2, y0 = 86;
  STAGES.forEach((s, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const sel = i === selIdx, locked = i > progress, cleared = i < progress;
    const x = x0 + c * (cw + gx), y = y0 + r * (chh + 12) - (sel ? 4 : 0);
    if (clickIn(x, y, cw, chh)) { if (selIdx === i) Input.pressed.Enter = true; selIdx = i; }
    if (sel) { ctx.save(); ctx.shadowColor = s.boss === 'muzan' ? '#ff2040' : COL.gold; ctx.shadowBlur = 22; roundRect(ctx, x, y, cw, chh, 10); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore(); }
    cached('card' + i + (locked ? 'L' : ''), cw, chh, c2 => {
      c2.save(); roundRect(c2, 0, 0, cw, chh, 10); c2.fillStyle = '#000'; c2.fill(); c2.clip();
      if (locked) c2.filter = 'grayscale(1) brightness(.35)';
      c2.drawImage(bgCanvas(s.bg), 0, 140, W, 560, -10, 0, cw + 20, (cw + 20) * 560 / W);
      c2.filter = 'none';
      const gg = c2.createLinearGradient(0, 40, 0, chh); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(0,0,0,.92)'); c2.fillStyle = gg; c2.fillRect(0, 0, cw, chh);
      if (!locked) portraitRaw(c2, demonLook(s.boss), cw - 34, 36, 24, { theme: 'demon', ring: 3, fallback: '鬼', key: s.boss });
      c2.restore();
    }, x, y);
    ctx.strokeStyle = sel ? (s.boss === 'muzan' ? '#ff3050' : COL.gold2) : 'rgba(217,182,106,.35)'; ctx.lineWidth = sel ? 2.5 : 1; roundRect(ctx, x, y, cw, chh, 10); ctx.stroke();
    seal(x + 10, y + 10, 36, KN[s.id], { rot: -0.06, col: locked ? '#444' : COL.crimson });
    T('第' + KN[s.id] + '話', x + 52, y + 32, { size: 13, font: JPF, col: locked ? '#666' : '#f3dca0', stroke: 3 });
    T(s.arc, x + 12, y + chh - 30, { size: 22, font: DISP, col: locked ? '#777' : '#fff', stroke: 3 });
    T(s.arcVn, x + 12, y + chh - 12, { size: 11, col: locked ? '#666' : COL.gold2, weight: 600 });
    if (cleared) seal(x + cw - 62, y + chh - 72, 50, '討伐', { rot: 0.18, col: 'rgba(200,20,40,.85)' });
    if (locked) {
      ctx.save(); ctx.translate(x + cw / 2, y + chh / 2 - 6); ctx.rotate(-0.05);
      ctx.fillStyle = '#efe4cc'; ctx.fillRect(-20, -46, 40, 92); ctx.strokeStyle = '#a02020'; ctx.lineWidth = 1.5; ctx.strokeRect(-16, -42, 32, 84);
      vtext('封印', 0, -12, 26, '#a01818', { stroke: 0 }); ctx.restore();
    }
  });
  // detail panel
  const S = STAGES[selIdx], bd = BOSSES[S.boss], locked = selIdx > progress;
  const dy = 572;
  panel(28, dy, W - 56, 136, { pattern: P_ASANOHA(), patAlpha: 0.05, accent: S.boss === 'muzan' ? COL.crimson : COL.gold });
  seal(46, dy + 20, 58, KN[S.id], { rot: -0.05 });
  T(S.arc, 118, dy + 48, { size: 30, font: DISP, col: '#fff' });
  T(S.arcVn + '  ·  ' + S.place, 128 + measure(S.arc, 30, DISP), dy + 46, { size: 14, col: COL.gold2, weight: 600 });
  T('VS', 118, dy + 84, { size: 14, col: '#ff7080', weight: 700 });
  const vs = bd.name + (S.boss2 ? '・' + BOSSES[S.boss2].name : '');
  T(vs, 146, dy + 86, { size: 22, font: DISP, col: '#ffb0b8' });
  T(bd.title + ' · ' + (TITLE_VN[bd.title] || '') + ' — ' + (BOSS_VN[S.boss] || '') + (S.boss2 ? ' & ' + BOSS_VN[S.boss2] : ''), 158 + measure(vs, 22, DISP), dy + 84, { size: 13, col: COL.dim, font: JPF });
  if (S.note) T('※ ' + S.note, 118, dy + 112, { size: 13, col: '#ffd890' });
  T('出陣 · Đội hình', 770, dy + 26, { size: 13, col: COL.dim, font: JPF });
  S.team.forEach((k, j) => { const x = 790 + (j % 10) * 46, y = dy + 60; portrait(CHARS[k].look, x, y, 17, { key: k, theme: STYLES[CHARS[k].styles[0]].theme, ring: 3 }); T(CHARS[k].vn.split(' — ')[0].split(' ').pop(), x, y + 34, { size: 9, col: '#bbb', align: 'center' }); });
  hints(locked ? [['Esc', '戻る', 'Quay lại'], ['U', '全解放', 'Mở tất cả']] : [['Enter', '出陣', 'Xuất trận'], ['Esc', '戻る', 'Quay lại'], ['U', '全解放', 'Mở tất cả']], W - 44, dy + 124, 'right');
  const n = STAGES.length;
  if (pressed('KeyD', 'ArrowRight')) { selIdx = Math.min(n - 1, selIdx + 1); Audio.sfx.select(); }
  if (pressed('KeyA', 'ArrowLeft')) { selIdx = Math.max(0, selIdx - 1); Audio.sfx.select(); }
  if (pressed('KeyS', 'ArrowDown')) { selIdx = Math.min(n - 1, selIdx + cols); Audio.sfx.select(); }
  if (pressed('KeyW', 'ArrowUp')) { selIdx = Math.max(0, selIdx - cols); Audio.sfx.select(); }
  if (pressed('KeyU')) { progress = n - 1; saveProgress(); Audio.sfx.gong(); }
  if (pressed('Escape')) mode = 'title';
  if (pressed('Enter', 'KeyJ', 'Space') && selIdx <= progress) launchStage(selIdx);
}
function launchStage(i) {
  startBattle(i);
  Audio.setMusic('calm');
  startDialog(STAGES[i].intro, () => { mode = 'battle'; const bd = BOSSES[STAGES[i].boss]; Audio.setMusic(bd.final || bd.rank && bd.rank[0] === '上' ? 'boss' : 'battle'); Audio.sfx.gong(); sayLine(activeP().ch.lines.start, activeP().ch.voice); });
}
const CHAR_KEYS = Object.keys(CHARS);
function renderSettings() {
  gt++;
  patternBg('#0d0b14', P_SEIGAIHA(), 0.035); vignette(0.6);
  screenHeader('設定', 'Cài đặt', '設');
  const items = [
    ['音声（日本語の読み上げ）', 'Giọng đọc tiếng Nhật — thoại & tên chiêu', Audio.voiceOn],
    ['音楽', 'Nhạc nền taiko / koto', Audio.musicOn],
    ['全ステージ解放', 'Mở khóa tất cả ải', progress >= STAGES.length - 1],
    ['進行リセット', 'Xóa tiến trình', null],
    ...MUSIC_SLOTS.map(([slot, jp, vn]) => [jp, vn + ' — ' + (Audio.trackName(slot) || 'nhạc mặc định'), 'pick']),
  ];
  panel(W / 2 - 420, 96, 840, 470, { pattern: P_ASANOHA(), patAlpha: 0.05 });
  items.forEach(([jp, vn, v], i) => {
    const y = 104 + i * 64, sel = i === setIdx;
    if (clickIn(W / 2 - 400, y, 800, 64)) { if (setIdx === i) Input.pressed.Enter = true; setIdx = i; }
    if (sel) ink(W / 2 - 410, y + 4, 790, 60, 'rgba(179,18,46,.85)', 1, i);
    bi(jp, vn, W / 2 - 370, y + 34, { size: 22, vcol: sel ? '#ffe0b0' : COL.dim, vsize: 13, gap: 20 });
    const lab = v === 'pick' ? ['選ぶ', 'Chọn file'] : v === null ? ['実行', 'Thực hiện'] : v ? ['有効', 'BẬT'] : ['無効', 'TẮT'];
    ctx.fillStyle = v === true ? 'rgba(60,160,90,.9)' : 'rgba(255,255,255,.08)'; roundRect(ctx, W / 2 + 230, y + 16, 150, 36, 18); ctx.fill(); ctx.strokeStyle = COL.gold; ctx.lineWidth = 1; ctx.stroke();
    T(lab[0] + ' · ' + lab[1], W / 2 + 305, y + 40, { size: 15, col: '#fff', align: 'center', font: JPF, weight: 600 });
  });
  const ja = Audio.hasJa();
  panel(W / 2 - 420, 578, 840, 92, { accent: ja ? '#5c5' : '#e93' });
  T(ja ? '✓ Máy đã có giọng tiếng Nhật.' : 'Chưa có giọng Nhật: Windows Settings → Time & Language → Language → thêm 日本語 (kèm Speech).', W / 2 - 390, 608, { size: 14, col: ja ? '#9e9' : '#fc8' });
  T('Nhạc của bạn: chọn file nhạc trên máy (vd. OST bạn đã mua) — chỉ lưu trong trình duyệt này, không tải lên đâu cả. Delete = bỏ.', W / 2 - 390, 636, { size: 12, col: COL.dim });
  hints([['W/S', '選択', 'Chọn'], ['Enter', '切替', 'Đổi'], ['Del', '削除', 'Bỏ nhạc'], ['Esc', '戻る', 'Quay lại']], W / 2, H - 30, 'center');
  if (pressed('KeyW', 'ArrowUp')) setIdx = (setIdx + items.length - 1) % items.length;
  if (pressed('KeyS', 'ArrowDown')) setIdx = (setIdx + 1) % items.length;
  if (pressed('Enter', 'KeyJ')) {
    if (setIdx === 0) { Audio.voiceOn = !Audio.voiceOn; if (Audio.voiceOn) Audio.say('全集中・水の呼吸', 1.15); }
    if (setIdx === 1) Audio.musicOn = !Audio.musicOn;
    if (setIdx === 2) progress = STAGES.length - 1;
    if (setIdx === 3) { progress = 0; selIdx = 0; }
    if (setIdx >= 4) { Audio.init(); Audio.pickTrack(MUSIC_SLOTS[setIdx - 4][0]); }
    saveSettings(); saveProgress(); Audio.sfx.select();
  }
  if (pressed('Delete', 'Backspace') && setIdx >= 4) { Audio.clearTrack(MUSIC_SLOTS[setIdx - 4][0]); Audio.sfx.select(); }
  if (pressed('Escape')) mode = 'title';
}
const MUSIC_SLOTS = [['calm', '音楽・平時', 'Nhạc menu & hội thoại'], ['battle', '音楽・戦闘', 'Nhạc trận thường'], ['boss', '音楽・上弦', 'Nhạc trận Thượng Huyền / Muzan']];
let clearT = 0;
function renderClear() {
  clearT++;
  drawBackground(ctx, G.S.bg, G); G.t++;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); vignette(0.8);
  ctx.save(); ctx.globalAlpha = Math.min(1, clearT / 20);
  ink(W / 2 - 380, 170, 760, 160, 'rgba(8,6,12,.85)', 1, 6);
  T('討伐完了', W / 2, 286, { size: 110, font: DISP, col: '#fff', align: 'center', glow: '#ff3050', glowB: 20 });
  T('TIÊU DIỆT THÀNH CÔNG', W / 2, 362, { size: 22, col: COL.gold2, align: 'center', weight: 700 });
  T(`第${G.S.id}話 ${G.S.arc} — ${G.S.arcVn}`, W / 2, 394, { size: 16, col: '#ddd', align: 'center', font: JPF });
  if (clearT > 20) { const s = 1 + Math.max(0, 1 - (clearT - 20) / 8) * 1.5; ctx.save(); ctx.translate(W / 2 + 330, 300); ctx.scale(s, s); seal(-48, -48, 96, '滅', { rot: 0.15 }); ctx.restore(); }
  hints(G.si + 1 < STAGES.length ? [['Enter', '次の話へ', 'Ải tiếp theo'], ['Esc', 'ステージ選択', 'Chọn ải']] : [['Esc', 'ステージ選択', 'Chọn ải']], W / 2, 470, 'center');
  ctx.restore();
  if (clearT > 20 && pressed('Enter', 'KeyJ')) { if (G.si + 1 < STAGES.length) { selIdx = G.si + 1; launchStage(G.si + 1); } else mode = 'select'; }
  if (pressed('Escape')) mode = 'select';
}
let endT = 0;
function renderEnding() {
  endT++;
  const d = Math.min(1, endT / 300);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgb(${40 + d * 180},${60 + d * 150},${120 + d * 100})`); g.addColorStop(1, `rgb(255,${150 + d * 80},${100 + d * 60})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.shadowColor = '#fff2b0'; ctx.shadowBlur = 60; ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(W / 2, H - 100 - d * 200, 90, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#2a3a2a'; ctx.fillRect(0, GY, W, H);
  ['tanjiro', 'nezuko', 'zenitsu', 'inosuke', 'kanao'].forEach((k, i) => drawPerson(ctx, CHARS[k].look, CHARS[k], 380 + i * 130, GY, 1, { t: endT, swing: 0.9 }, 1, 1.3));
  const lines = [['鬼のいない世界へ', 'Hướng tới một thế giới không còn quỷ'], ['ありがとう 竈門炭治郎', 'Cảm ơn, Kamado Tanjiro'], ['— 完 —', 'HẾT']];
  lines.forEach(([a, b], i) => { if (endT > 80 + i * 120) { ctx.save(); ctx.globalAlpha = Math.min(1, (endT - 80 - i * 120) / 40); bi(a, b, W / 2, 130 + i * 96, { size: 50, font: DISP, align: 'center', stroke: 6, vcol: '#fff', vsize: 18, gap: 34 }); ctx.restore(); } });
  if (endT > 400) hints([['Enter', 'タイトルへ', 'Về menu']], W / 2, H - 30, 'center');
  if (endT > 400 && pressed('Enter', 'Escape', 'KeyJ')) { mode = 'title'; endT = 0; }
}

// ============================================================
//  MAIN LOOP
// ============================================================
function onBattleFrame() {
  if (pressed('Escape')) G.paused = !G.paused;
  if (G.paused && pressed('KeyM')) { G.paused = false; mode = G.S.training ? 'title' : 'select'; Audio.setMusic('calm'); return; }
  if (G.paused && pressed('KeyH')) { openGuide('battle'); return; }
  battleStep();
  renderBattle();
  if (G.over === 'win' && G.overT > 150) {
    if (G.si >= progress && G.si + 1 < STAGES.length) { progress = G.si + 1; saveProgress(); }
    if (G.si === STAGES.length - 1) { progress = STAGES.length; saveProgress(); }
    Audio.setMusic('calm');
    startDialog(G.S.outro, () => { if (G.S.boss === 'muzan') { mode = 'ending'; endT = 0; } else { mode = 'clear'; clearT = 0; } });
  }
  if (G.over === 'lose' && G.overT > 50) {
    if (pressed('Enter')) launchStage(G.si);
    if (pressed('Escape')) mode = 'select';
  }
}
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - last); last = now;
  pollPad();
  let steps = 0;
  try {
    while (acc >= 1000 / 60 && steps < 4) {
      acc -= 1000 / 60; steps++;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
      switch (mode) {
        case 'title': renderTitle(); break;
        case 'select': renderSelect(); break;
        case 'movelist': renderMoveList(); break;
        case 'guide': renderGuide(); break;
        case 'settings': renderSettings(); break;
        case 'dialog':
          renderDialogScene();
          if (pressed('Enter', 'KeyJ', 'Space') || Input.click) { const l = dlg.lines[dlg.i]; if (Math.floor(dlg.t * 0.8) < l[1].length) dlg.t = 999; else advanceDialog(); }
          if (dlg && pressed('Escape')) { const a = dlg.after; dlg = null; a(); }
          break;
        case 'battle': onBattleFrame(); break;
        case 'clear': renderClear(); break;
        case 'ending': renderEnding(); break;
      }
      Input.pressed = {}; Input.click = null;
    }
  } catch (e) { console.error(e); Input.pressed = {}; Input.click = null; }
}
requestAnimationFrame(frame);
