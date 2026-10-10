// ============================================================
//  CHARA — anime-style character rig (inked outlines, cel shading,
//  layered anime eyes, per-character hair locks) + optional image assets
// ============================================================
'use strict';

const OUT = '#1d1422';
for (const k in CHARS) CHARS[k].key = k;

// ---------------- optional image assets (assets/…) ----------------
const ASSETS = { portrait: {}, cutin: {}, sprite: {} };
(function loadAssets() {
  if (location.search.includes('noassets')) return;
  // only files listed in assets/manifest.js are loaded (avoids hundreds of 404 probes)
  const files = (window.ASSET_FILES || []);
  const load = (path, cb) => { const im = new Image(); im.onload = () => cb(im); im.src = path; };
  for (const f of files) {
    let m;
    if ((m = f.match(/^portraits\/(\w+)\.png$/))) load('assets/' + f, im => ASSETS.portrait[m[1]] = im);
    else if ((m = f.match(/^cutin\/(\w+)\.png$/))) load('assets/' + f, im => ASSETS.cutin[m[1]] = im);
    else if ((m = f.match(/^sprites\/(\w+?)_(idle|run|jump|attack|hurt)\.png$/))) { const k = m[1], p = m[2]; load('assets/' + f, im => { (ASSETS.sprite[k] = ASSETS.sprite[k] || {})[p] = im; }); }
  }
})();
function drawSprite(c, key, x, y, face, pose, alpha, h) {
  const set = ASSETS.sprite[key]; if (!set) return false;
  const p = pose.hurt ? 'hurt' : pose.air ? 'jump' : pose.swing !== undefined && pose.attack ? 'attack' : pose.run ? 'run' : 'idle';
  const im = set[p] || set.idle || Object.values(set)[0];
  if (!im) return false;
  const w = im.width * h / im.height;
  c.save(); c.translate(x, y); c.scale(face, 1);
  if (alpha !== undefined) c.globalAlpha *= alpha;
  c.save(); c.globalAlpha *= 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, (pose.shadowY || 0) + 2, w * 0.3, 7, 0, 0, TAU); c.fill(); c.restore();
  if (pose.spin) { c.translate(0, -h / 2); c.rotate(pose.spin); c.translate(0, h / 2); }
  const bob = pose.run ? -Math.abs(Math.sin(pose.run)) * 4 : Math.sin((pose.t || 0) * 0.08) * 1.5;
  c.drawImage(im, -w / 2, -h + bob, w, h);
  c.restore();
  return true;
}

// ---------------- primitives ----------------
// draw with all line widths multiplied by k (used for big close-ups so ink lines stay thin)
function withLineScale(c, k, fn) {
  const proto = Object.getPrototypeOf(c), d = Object.getOwnPropertyDescriptor(proto, 'lineWidth');
  Object.defineProperty(c, 'lineWidth', { configurable: true, get() { return d.get.call(c) / k; }, set(v) { d.set.call(c, v * k); } });
  try { fn(); } finally { delete c.lineWidth; }
}
function fo(c, fill, lw) { c.fillStyle = fill; c.fill(); if (lw !== 0) { c.lineWidth = lw || 2; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); } }
function limb(c, x1, y1, x2, y2, w1, w2, fill, lw) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
  c.beginPath();
  c.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  c.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  c.arc(x2, y2, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  c.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  c.arc(x1, y1, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  c.closePath();
  fo(c, fill, lw);
}
function lockPath(c, rx, ry, tx, ty, w, bend) {
  const a = Math.atan2(ty - ry, tx - rx), nx = -Math.sin(a), ny = Math.cos(a);
  const mx = (rx + tx) / 2 + nx * bend, my = (ry + ty) / 2 + ny * bend;
  c.moveTo(rx + nx * w / 2, ry + ny * w / 2);
  c.quadraticCurveTo(mx + nx * w * 0.32, my + ny * w * 0.32, tx, ty);
  c.quadraticCurveTo(mx - nx * w * 0.32, my - ny * w * 0.32, rx - nx * w / 2, ry - ny * w / 2);
  c.closePath();
}
// draws a group of hair locks merged (single outer outline), cap optional
function hairGroup(c, L, locks, cap, sway) {
  sway = sway || 0;
  const tip = L.hairTip || L.hair;
  const build = (lk) => { c.beginPath(); lockPath(c, lk[0], lk[1], lk[2] + sway * (lk[5] !== undefined ? 1 : 0) * Math.abs(lk[3] - lk[1]) * 0.04, lk[3], lk[4], lk[5] || 0); };
  // outline pass
  c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = 3.6;
  if (cap) { capPath(c, cap); c.stroke(); }
  for (const lk of locks) { build(lk); c.stroke(); }
  // fill pass
  for (const lk of locks) {
    build(lk);
    const g = c.createLinearGradient(lk[0], lk[1], lk[2], lk[3]);
    g.addColorStop(0, shade(L.hair, 10)); g.addColorStop(0.55, L.hair); g.addColorStop(1, tip);
    c.fillStyle = g; c.fill();
  }
  // soft strand lines
  c.save(); c.globalAlpha = 0.45; c.strokeStyle = shade(L.hair, -40); c.lineWidth = 1;
  for (const lk of locks) { if (lk[4] < 10) continue; c.beginPath(); c.moveTo(lerp(lk[0], lk[2], 0.25), lerp(lk[1], lk[3], 0.25)); c.quadraticCurveTo((lk[0] + lk[2]) / 2 + (lk[5] || 0) * 0.5, (lk[1] + lk[3]) / 2, lerp(lk[0], lk[2], 0.7), lerp(lk[1], lk[3], 0.7)); c.stroke(); }
  c.restore();
  if (cap) {
    capPath(c, cap); const g = c.createLinearGradient(0, -26, 0, 4); g.addColorStop(0, shade(L.hair, 22)); g.addColorStop(0.7, L.hair); g.addColorStop(1, L.hairTip && L.style !== 'nezuko' && L.style !== 'muichiro' ? shade(L.hairTip, -10) : shade(L.hair, -15)); c.fillStyle = g; c.fill();
    // fringe shadow strands
    c.save(); capPath(c, cap); c.clip(); c.globalAlpha = 0.35; c.strokeStyle = shade(L.hair, -50); c.lineWidth = 1.1;
    for (const [x, y] of (FRINGE[curFringe] || FRINGE.default)) { c.beginPath(); c.moveTo(x * 0.7, -18); c.quadraticCurveTo(x * 0.9, -10, x, y - 1); c.stroke(); }
    c.restore();
  }
}
const FRINGE = {
  default: [[21, 0], [17, -9], [14, -2], [10, -11], [6, -4], [2, -12], [-2, -5], [-6, -12], [-10, -4], [-14, -10], [-19, 2]],
  straight: [[21, -1], [18, -6], [14, -3], [10, -7], [6, -3], [2, -7], [-2, -3], [-6, -7], [-10, -4], [-15, -6], [-19, 2]],
  spiky: [[21, 2], [18, -10], [15, 0], [11, -12], [6, -1], [2, -13], [-3, -4], [-7, -12], [-12, -3], [-15, -10], [-19, 3]],
  parted: [[21, 4], [16, -4], [12, -10], [7, -15], [3, -17], [0, -13], [-4, -6], [-8, -10], [-12, -2], [-19, 3]],
  high: [[21, -9], [10, -13], [0, -13], [-19, -6]],
};
const FRINGE_OF = { tanjiro: 'spiky', zenitsu: 'spiky', rengoku: 'spiky', sanemi: 'spiky', akaza: 'spiky', gyutaro: 'spiky', nezuko: 'straight', kanao: 'straight', shinobu: 'straight', rui: 'straight', daki: 'straight', mitsuri: 'straight', muichiro: 'parted', kokushibo: 'parted', muzan2: 'parted', gyomei: 'high', tengen: 'high' };
let curFringe = 'default';
function capPath(c, cap) {
  const [cx, cy, rx, ry] = cap;
  c.beginPath();
  c.moveTo(cx - rx + 2, cy + 6);
  c.bezierCurveTo(cx - rx - 2, cy - ry * 1.3, cx + rx, cy - ry * 1.35, cx + rx, cy + 4);
  const fr = FRINGE[curFringe] || FRINGE.default;
  let px = cx + rx, py = cy + 4;
  for (const [x, y] of fr) { const mx = (px + x) / 2, my = Math.min(py, y) - 1.5; c.quadraticCurveTo(mx, my, x, y); px = x; py = y; }
  c.closePath();
}
function shine(c, L, x, y, w) {
  c.save(); c.globalAlpha = 0.32; c.fillStyle = shade(L.hair, 110);
  c.beginPath(); c.moveTo(x, y);
  for (let i = 0; i <= 6; i++) c.lineTo(x + w * i / 6, y + (i % 2 ? -2.2 : 1.2) - Math.sin(i / 6 * Math.PI) * 2.5);
  for (let i = 6; i >= 0; i--) c.lineTo(x + w * i / 6, y + 2.6 - Math.sin(i / 6 * Math.PI) * 2.5);
  c.fill(); c.restore();
}

// ---------------- HAIR DEFINITIONS ----------------
// lock: [rootX, rootY, tipX, tipY, width, bend]
const HAIR = {
  tanjiro: {
    back: [[-14, -12, -33, -19, 11, 2], [-17, -4, -34, 1, 11, -2], [-15, 4, -29, 14, 10, 2], [-8, -18, -18, -34, 11, -3], [0, -21, 1, -36, 10, 2], [8, -19, 16, -32, 9, 2]],
    front: [[6, -18, 18, -2, 10, 2], [12, -15, 24, -7, 8, 1], [0, -18, 6, -1, 10, -1], [-6, -17, -4, -3, 9, 1], [15, -10, 21, 5, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  zenitsu: {
    back: [[-14, -12, -36, -22, 12, 3], [-17, -3, -37, 4, 11, -2], [-14, 6, -31, 19, 10, 2], [-6, -19, -15, -38, 11, -3], [4, -20, 9, -38, 10, 2], [10, -18, 22, -30, 8, 2]],
    front: [[4, -18, 17, 1, 11, 2], [12, -15, 25, -4, 8, 1], [-2, -18, 4, 3, 10, -2], [-8, -17, -6, 0, 9, 1], [15, -8, 21, 9, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  rengoku: {
    back: [[-12, -14, -40, -32, 15, 5], [-17, -4, -44, -7, 14, -3], [-14, 6, -38, 17, 12, 3], [-4, -20, -13, -46, 14, -4], [6, -20, 10, -44, 13, 3], [14, -16, 30, -32, 11, 2]],
    front: [[4, -18, 19, -4, 11, 2], [10, -16, 27, -13, 9, 2], [-2, -18, 3, -2, 10, -1], [14, -8, 22, 6, 7, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  sanemi: {
    back: [[-14, -12, -34, -20, 11, 3], [-17, -3, -35, 3, 11, -2], [-14, 6, -29, 17, 9, 2], [-6, -19, -14, -36, 10, -3], [4, -20, 8, -36, 9, 2]],
    front: [[4, -18, 16, -1, 10, 2], [12, -15, 24, -6, 8, 1], [-2, -18, 3, 1, 9, -2], [15, -9, 20, 6, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  giyu: {
    back: [[-14, -10, -29, -3, 13, 2], [-16, 0, -27, 15, 11, -2], [-18, 8, -44, 44, 11, 7], [-6, -19, -17, -27, 10, -2], [-12, -14, -26, -18, 10, 2]],
    front: [[4, -18, 15, 3, 10, 2], [10, -15, 21, 1, 8, 1], [-3, -18, 2, 1, 9, -1], [15, -8, 20, 11, 6, 2], [-8, -16, -8, 3, 8, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  nezuko: {
    back: [[-12, -14, -30, 62, 20, 6], [-16, -2, -38, 82, 18, -4], [-8, 0, -18, 92, 18, 5], [-4, -18, -22, 40, 16, 4]],
    front: [[2, -19, 6, -3, 11, 0], [9, -17, 14, -3, 10, 0], [14, -12, 19, -1, 8, 0], [15, -6, 18, 28, 8, 1], [-4, -18, -3, -4, 10, 0]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  kanao: {
    back: [[-14, -8, -24, 8, 13, 2], [-16, -12, -40, 22, 13, 7], [-15, 0, -22, 14, 11, -2]],
    front: [[2, -19, 6, -4, 11, 0], [9, -17, 14, -4, 10, 0], [-4, -18, -3, -4, 10, 0], [15, -7, 17, 16, 6, 0]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  shinobu: {
    back: [[-15, -10, -25, 9, 15, 2], [-16, 0, -23, 15, 13, -2], [-10, -16, -22, -4, 12, 2]],
    front: [[2, -19, 10, -2, 12, 2], [10, -16, 18, -4, 10, 1], [-4, -18, 0, -4, 10, -1], [15, -6, 18, 13, 7, 1]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  mitsuri: {
    back: [[-12, -14, -22, 2, 14, 2], [-15, -4, -20, 10, 12, -2]],
    front: [[2, -19, 10, -2, 11, 2], [10, -16, 18, -3, 9, 1], [-4, -18, -1, -3, 10, -1], [15, -6, 21, 28, 7, 2], [0, -20, 12, -32, 5, 4]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  muichiro: {
    back: [[-12, -14, -30, 60, 20, 6], [-16, -2, -36, 68, 17, -4], [-6, -16, -20, 50, 16, 3]],
    front: [[4, -19, 17, 5, 11, 3], [-2, -19, -4, 1, 10, -2], [14, -10, 21, 18, 8, 2], [9, -18, 22, -5, 7, 2]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  obanai: {
    back: [[-14, -10, -29, 9, 13, 2], [-16, 0, -27, 17, 11, -2], [-6, -19, -18, -24, 10, -2]],
    front: [[4, -18, 16, 3, 11, 2], [10, -15, 21, 1, 8, 1], [-2, -18, 2, -1, 9, -1], [15, -6, 19, 13, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  tengen: {
    back: [[-15, -6, -27, 7, 11, 2], [-12, -14, -26, -10, 10, -2]],
    front: [[4, -12, 14, 1, 8, 2], [-2, -12, 1, 0, 7, -1]],
    cap: [0, -6, 22, 18], shine: [-10, -18, 10],
  },
  gyomei: { back: [], front: [[6, -18, 12, -12, 6, 1], [0, -19, 4, -13, 6, 1]], cap: [0, -7, 21, 15], shine: [-8, -17, 12] },
  akaza: {
    back: [[-14, -10, -29, -15, 11, 2], [-16, -2, -29, 5, 10, -2], [-6, -19, -13, -31, 10, -2], [4, -20, 6, -31, 9, 2]],
    front: [[4, -18, 15, -3, 9, 2], [10, -15, 21, -6, 8, 1], [-2, -18, 2, -3, 9, -1], [15, -8, 19, 5, 5, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
  daki: {
    back: [[-12, -14, -32, 64, 20, 6], [-16, -2, -40, 84, 18, -4], [-6, -16, -22, 56, 16, 4]],
    front: [[2, -19, 7, -3, 11, 0], [9, -17, 15, -3, 10, 1], [15, -8, 19, 24, 7, 1], [-4, -18, -3, -4, 10, 0]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  gyutaro: {
    back: [[-14, -10, -36, -6, 13, 4], [-16, 0, -36, 14, 12, -3], [-8, -18, -22, -34, 12, -3], [2, -20, 4, -36, 10, 2], [-14, 8, -26, 26, 10, 2]],
    front: [[4, -18, 16, 2, 10, 2], [10, -15, 22, -2, 8, 1], [-2, -18, 2, 2, 9, -2]],
    cap: [0, -6, 22, 18],
  },
  doma: {
    back: [[-14, -10, -26, 10, 13, 2], [-16, 0, -24, 18, 11, -2]],
    front: [[4, -18, 15, 0, 10, 2], [10, -15, 21, -1, 8, 1], [-2, -18, 1, -2, 9, -1], [15, -8, 19, 10, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 16],
  },
  kokushibo: {
    back: [[-10, -16, -42, 44, 15, 9], [-14, -8, -30, 20, 12, 3], [-16, 2, -26, 22, 11, -2]],
    front: [[4, -18, 16, 4, 11, 3], [-2, -18, 0, 0, 9, -1], [15, -8, 20, 15, 7, 1], [10, -16, 22, -4, 7, 2]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  muzan2: {
    back: [[-12, -14, -40, 80, 22, 10], [-16, -2, -48, 96, 20, -6], [-6, -16, -26, 70, 18, 6], [-14, 6, -30, 60, 14, 2]],
    front: [[4, -19, 16, 6, 11, 3], [-2, -19, -2, 2, 10, -2], [14, -10, 20, 22, 8, 2], [9, -18, 22, -4, 7, 2]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  rui: {
    back: [[-14, -10, -25, 13, 15, 2], [-16, 0, -22, 18, 13, -2]],
    front: [[2, -19, 8, 6, 12, 1], [10, -16, 16, 4, 10, 1], [-4, -18, -2, 4, 10, 0], [15, -6, 18, 14, 7, 0]],
    cap: [0, -6, 22, 18], shine: [-10, -14, 18],
  },
  default: {
    back: [[-14, -10, -28, 2, 12, 2], [-16, 0, -26, 14, 10, -2], [-6, -19, -16, -28, 10, -2]],
    front: [[4, -18, 15, 0, 10, 2], [10, -15, 21, -2, 8, 1], [-2, -18, 2, -1, 9, -1], [15, -8, 19, 8, 6, 1]],
    cap: [0, -6, 22, 18], shine: [-9, -14, 16],
  },
};
HAIR.muzan = HAIR.default;

// ---------------- HEAD ----------------
const EYE_COL = { tanjiro: '#9a2a2a', zenitsu: '#d48a10', giyu: '#2b4f9a', rengoku: '#f0a020', shinobu: '#8a4fd0', kanao: '#b05ad0', mitsuri: '#4aa060', muichiro: '#3cbcb0', sanemi: '#8a3a6a', tengen: '#b0306a', nezuko: '#e2628a', obanai: '#d8c040', gyomei: '#ddd', akaza: '#e8c050', daki: '#3ad080', gyutaro: '#e8d020', doma: '#9ad', kokushibo: '#e8b030', muzan2: '#d01828', rui: '#c02838', default: '#a03050' };
function drawHead(c, L, x, y, pose, big) {
  c.save(); c.translate(x, y); if (big && big !== 1) c.scale(big, big);
  const s = L.style, H = HAIR[s] || HAIR.default;
  pose = pose || {};
  curFringe = FRINGE_OF[s] || 'default';
  if (s === 'boar') { drawBoar(c, pose); c.restore(); return; }
  const sway = Math.sin((pose.t || 0) * 0.06) * 1.2 + (pose.air ? 4 : 0) + (pose.run ? 3 : 0);
  // back hair
  if (s === 'mitsuri') drawBraids(c, L, pose);
  hairGroup(c, L, H.back.map(l => [l[0], l[1], l[2] - sway * Math.abs(l[3] - l[1]) / 40, l[3], l[4], l[5]]), H.cap ? null : null);
  // neck
  limb(c, 0, 14, -2, 28, 11, 12, shade(L.skin, -22));
  // ear
  c.beginPath(); c.ellipse(-11, 3, 4.5, 6, 0.2, 0, TAU); fo(c, L.skin, 1.6);
  c.beginPath(); c.ellipse(-11, 3.5, 2, 3, 0.2, 0, TAU); c.fillStyle = shade(L.skin, -35); c.fill();
  if (L.earring) { // hanafuda earrings
    c.save(); c.translate(-11, 9);
    c.beginPath(); c.rect(-3.5, 0, 7, 12); fo(c, '#f4f0e6', 1.2);
    c.fillStyle = '#d4202a'; c.beginPath(); c.arc(0, 6, 2.6, 0, TAU); c.fill();
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-3.5, 10); c.lineTo(3.5, 10); c.stroke();
    c.restore();
  }
  // face
  c.beginPath();
  c.moveTo(-16, -6);
  c.bezierCurveTo(-17, 9, -7, 19, 6, 21);
  c.bezierCurveTo(14, 20, 20, 11, 20.5, 0);
  c.bezierCurveTo(21, -14, 11, -21, 1, -21);
  c.bezierCurveTo(-9, -21, -16, -16, -16, -6);
  c.closePath();
  const fg = c.createLinearGradient(-15, 0, 19, 0); fg.addColorStop(0, shade(L.skin, -16)); fg.addColorStop(0.35, L.skin); fg.addColorStop(1, shade(L.skin, 6));
  fo(c, fg, 2.2);
  // cel shadow under bangs
  c.save(); c.clip(); c.fillStyle = shade(L.skin, -28); c.globalAlpha = 0.55;
  c.beginPath(); c.moveTo(-16, -10); for (let i = 0; i <= 8; i++) c.lineTo(-16 + i * 4.6, -9 + (i % 2) * 4); c.lineTo(22, -24); c.lineTo(-16, -24); c.fill();
  c.globalAlpha = 0.35; c.beginPath(); c.ellipse(-12, 8, 6, 14, 0, 0, TAU); c.fill();
  c.restore();
  // marks
  if (L.scar) { c.fillStyle = 'rgba(150,30,30,.85)'; c.beginPath(); c.moveTo(-4, -16); c.quadraticCurveTo(4, -18, 8, -12); c.quadraticCurveTo(2, -9, -3, -11); c.closePath(); c.fill(); }
  if (L.tattoo) { c.strokeStyle = '#2f5fe0'; c.lineWidth = 1.4; for (const [x1, y1, x2, y2] of [[-6, -18, -6, -6], [0, -19, 0, -8], [6, -19, 6, -9], [-10, 6, -4, 16], [14, 8, 10, 16]]) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } }
  if (L.marks && !L.tattoo) { c.strokeStyle = L.marks; c.lineWidth = 1.6; c.beginPath(); c.moveTo(14, -6); c.lineTo(10, -1); c.moveTo(-4, 6); c.lineTo(2, 12); c.moveTo(0, -14); c.quadraticCurveTo(4, -10, 2, -6); c.stroke(); }
  if (L.scars) { c.strokeStyle = '#b05a5a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(2, -14); c.lineTo(12, 14); c.moveTo(17, -4); c.lineTo(4, 4); c.moveTo(-6, 6); c.lineTo(0, 16); c.stroke(); }
  if (L.paintEye) { c.fillStyle = '#d02a5a'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - 0.3; c.ellipse(10 + Math.cos(a) * 6, -1 + Math.sin(a) * 7, 2.8, 1.8, a, 0, TAU); } c.fill(); }
  // eyes
  const ec = L.eye || EYE_COL[s] || '#7a3a3a';
  const shout = pose.shout, closed = pose.hurt ? 'hurt' : pose.sleep ? 'sleep' : null;
  if (L.sixEyes) {
    for (const [ex, ey, sc] of [[9, 1, 1], [-5, 1, 0.75], [10, -9, 0.6], [-4, -9, 0.45], [10, 11, 0.55], [-4, 11, 0.42]]) animeEye(c, ex, ey, 7.5 * sc + 1, 10 * sc + 1, '#e8b030', { demon: 1, flat: sc < 0.7 });
  } else if (L.blind) {
    for (const [ex, w] of [[9.5, 6], [-5, 4.5]]) { c.beginPath(); c.moveTo(ex - w, 3); c.quadraticCurveTo(ex, 0, ex + w, 2); c.quadraticCurveTo(ex, 8, ex - w, 3); c.closePath(); fo(c, '#eef0f0', 1.2); c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(ex - w - 1, 2.5); c.quadraticCurveTo(ex, -1, ex + w + 2, 1.5); c.stroke(); }
    c.strokeStyle = 'rgba(140,200,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(12, 10); c.lineTo(13, 18); c.stroke();
  } else {
    animeEye(c, 9.5, 3, 8.6, 12, ec, { closed, demon: L.demonEye, rainbow: L.rainbow, rank: L.rank, kanji: L.kanji, sharp: L.sharpEye, far: 0, hetero: null });
    animeEye(c, -5.5, 3, 6.2, 11, L.hetero ? '#3aa8c8' : ec, { closed, demon: L.demonEye, rainbow: L.rainbow, rank: L.rank, sharp: L.sharpEye, far: 1 });
  }
  // brows
  c.strokeStyle = shade(L.hair, -40); c.lineCap = 'round';
  const angry = s === 'sanemi' || s === 'obanai' || s === 'akaza' || s === 'gyutaro' || pose.hurt || shout;
  c.lineWidth = s === 'rengoku' ? 3.4 : 2.2;
  c.beginPath(); c.moveTo(3, -10 + (angry ? 1 : 0)); c.quadraticCurveTo(10, -13 + (angry ? 2 : 0), 18, -12 + (angry ? -2 : 0)); c.stroke();
  c.beginPath(); c.moveTo(-10, -10); c.quadraticCurveTo(-5, -12, -1, -9 + (angry ? 1 : 0)); c.stroke();
  if (s === 'rengoku') { c.beginPath(); c.moveTo(14, -11); c.lineTo(18, -14); c.stroke(); }
  // nose + mouth
  c.strokeStyle = shade(L.skin, -60); c.lineWidth = 1.3; c.beginPath(); c.moveTo(17, 4); c.lineTo(15.5, 8); c.stroke();
  if (L.muzzle) drawMuzzle(c);
  else if (L.mask) { c.beginPath(); c.moveTo(-2, 8); c.quadraticCurveTo(10, 6, 19, 6); c.lineTo(17, 17); c.quadraticCurveTo(8, 22, 0, 18); c.closePath(); fo(c, '#f2f0ea', 1.6); c.strokeStyle = '#c8c4bc'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(1, 10 + i * 3.5); c.lineTo(17, 9 + i * 3); c.stroke(); } }
  else if (shout) { c.beginPath(); c.moveTo(7, 12); c.quadraticCurveTo(11, 10, 15, 12); c.quadraticCurveTo(12, 19, 8, 16); c.closePath(); fo(c, '#5a1822', 1.4); c.fillStyle = '#e06a7a'; c.beginPath(); c.ellipse(11, 15.5, 2.6, 1.4, 0, 0, TAU); c.fill(); }
  else { c.strokeStyle = '#6a2a30'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(9, 13); c.quadraticCurveTo(12, 14, 14.5, 12.5); c.stroke(); if (L.demonEye && s !== 'rui') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(13, 13); c.lineTo(14, 16); c.lineTo(14.6, 12.8); c.fill(); } }
  // blush
  if (L.blush) { c.fillStyle = 'rgba(255,110,140,.35)'; c.beginPath(); c.ellipse(11, 8, 4, 2, 0, 0, TAU); c.fill(); }
  // front hair
  hairGroup(c, L, H.front.map(l => [l[0], l[1], l[2], l[3], l[4] * 0.7, l[5]]), H.cap);
  if (H.shine) shine(c, L, H.shine[0], H.shine[1], H.shine[2]);
  // accessories
  if (L.ribbon) { c.save(); c.translate(-16, -9); for (const r of [-0.6, 0.6]) { c.beginPath(); c.ellipse(Math.cos(r - Math.PI / 2) * 7, Math.sin(r - Math.PI / 2) * 7 + 5, 8, 4.5, r, 0, TAU); fo(c, L.ribbon, 1.6); } c.beginPath(); c.arc(0, 0, 3, 0, TAU); fo(c, shade(L.ribbon, -30), 1.2); c.restore(); }
  if (L.clip) drawButterfly(c, -12, -15, s === 'kanao' ? '#f590b8' : '#9a5ae0', 1);
  if (L.headband) { c.beginPath(); c.moveTo(-17, -12); c.quadraticCurveTo(0, -20, 19, -11); c.lineTo(19, -6); c.quadraticCurveTo(0, -15, -17, -6); c.closePath(); fo(c, '#d8dae0', 1.6); for (const [gx, col] of [[-6, '#ff4080'], [3, '#40e0ff'], [12, '#ffd040']]) { c.beginPath(); c.arc(gx, -12, 2.6, 0, TAU); fo(c, col, 1); } c.fillStyle = '#c8b060'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-22 + i * 2, -10 + i * 4, 1.6, 0, TAU); c.fill(); } }
  if (L.horn) { c.beginPath(); c.moveTo(-4, -18); c.quadraticCurveTo(0, -34, 6, -38); c.quadraticCurveTo(4, -26, 6, -17); c.closePath(); fo(c, '#ece4d4', 1.6); }
  if (L.bloodTop) { c.fillStyle = '#b8101c'; c.beginPath(); c.moveTo(-10, -20); c.quadraticCurveTo(0, -30, 12, -20); c.quadraticCurveTo(6, -14, 2, -18); c.quadraticCurveTo(-2, -13, -4, -18); c.quadraticCurveTo(-8, -14, -10, -20); c.fill(); }
  if (L.kanzashi) { c.strokeStyle = '#e8c050'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-12, -16 + i * 4); c.lineTo(-30, -26 + i * 6); c.stroke(); } c.fillStyle = '#e04070'; c.beginPath(); c.arc(-14, -18, 4, 0, TAU); c.fill(); }
  if (L.snake) drawSnake(c, pose);
  c.restore();
}
function animeEye(c, cx, cy, w, h, col, o) {
  o = o || {};
  if (o.closed === 'hurt') { c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx - w, cy - 3); c.lineTo(cx + w * 0.6, cy + 1); c.lineTo(cx - w * 0.6, cy + 4); c.stroke(); return; }
  if (o.closed === 'sleep') { c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.arc(cx, cy - 2, w * 0.9, 0.3, Math.PI - 0.3); c.stroke(); return; }
  const sharp = o.sharp ? 0.75 : 1;
  c.save();
  // sclera
  c.beginPath(); c.moveTo(cx - w, cy - h * 0.25 * sharp); c.quadraticCurveTo(cx, cy - h * 1.05 * sharp, cx + w, cy - h * 0.45 * sharp); c.quadraticCurveTo(cx + w * 1.05, cy + h * 0.7, cx, cy + h * 0.85); c.quadraticCurveTo(cx - w * 1.05, cy + h * 0.6, cx - w, cy - h * 0.25 * sharp); c.closePath();
  c.fillStyle = '#fbfaf6'; c.fill();
  c.save(); c.clip();
  // iris
  const ix = cx + (o.far ? 0.6 : 1.4), iy = cy + 1.2, iw = w * 0.74, ih = h * 0.82;
  const g = c.createLinearGradient(0, iy - ih, 0, iy + ih);
  if (o.rainbow) { g.addColorStop(0, '#5ab0ff'); g.addColorStop(0.35, '#b48aff'); g.addColorStop(0.65, '#ff8ac0'); g.addColorStop(1, '#ffe080'); }
  else { g.addColorStop(0, shade(col, -90)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, 70)); }
  c.beginPath(); c.ellipse(ix, iy, iw, ih, 0, 0, TAU); c.fillStyle = g; c.fill();
  c.strokeStyle = shade(col, -100); c.lineWidth = 1; c.stroke();
  // pupil
  c.fillStyle = shade(col, -110);
  if (o.demon) { c.beginPath(); c.ellipse(ix, iy, iw * 0.18, ih * 0.75, 0, 0, TAU); c.fill(); }
  else { c.beginPath(); c.ellipse(ix, iy - 0.5, iw * 0.45, ih * 0.5, 0, 0, TAU); c.fill(); }
  if (o.rank && !o.far) { c.fillStyle = '#fff'; c.font = `bold ${ih * 0.7}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.rank[1] || o.rank[0], ix, iy + 1); }
  if (o.rank && o.far) { c.fillStyle = '#fff'; c.font = `bold ${ih * 0.7}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.rank[0], ix, iy + 1); }
  if (o.kanji) { c.fillStyle = '#ffd040'; c.font = `bold ${ih * 0.7}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.kanji, ix, iy + 1); }
  // lower glow
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(ix, iy + ih * 0.55, iw * 0.6, ih * 0.25, 0, 0, TAU); c.fill();
  // highlights
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ix - iw * 0.35, iy - ih * 0.45, iw * 0.32, ih * 0.24, -0.4, 0, TAU); c.fill();
  c.beginPath(); c.arc(ix + iw * 0.4, iy + ih * 0.35, iw * 0.15, 0, TAU); c.fill();
  c.restore();
  // upper lash line
  c.strokeStyle = OUT; c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = o.far ? 2.4 : 3;
  c.beginPath(); c.moveTo(cx - w - 0.5, cy - h * 0.2 * sharp); c.quadraticCurveTo(cx, cy - h * 1.08 * sharp, cx + w + 1, cy - h * 0.5 * sharp);
  if (!o.far) c.lineTo(cx + w + 3.5, cy - h * 0.15);
  c.stroke();
  // lower lash
  c.lineWidth = 1.1; c.beginPath(); c.moveTo(cx - w * 0.2, cy + h * 0.86); c.quadraticCurveTo(cx + w * 0.5, cy + h * 0.8, cx + w * 0.85, cy + h * 0.45); c.stroke();
  c.restore();
}
function drawMuzzle(c) {
  c.save();
  c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(-8, 14, -12, 8); c.stroke();
  c.beginPath(); c.moveTo(0, 9); c.lineTo(21, 10.5); c.lineTo(21, 15.5); c.lineTo(0, 14.5); c.closePath();
  const g = c.createLinearGradient(0, 9, 0, 15); g.addColorStop(0, '#9ac25a'); g.addColorStop(1, '#5a8a2a'); fo(c, g, 1.6);
  c.strokeStyle = '#3a5a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, 9.5); c.lineTo(8, 15); c.moveTo(15, 10); c.lineTo(15, 15.3); c.stroke();
  c.restore();
}
function drawButterfly(c, x, y, col, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  for (const r of [-1, 1]) {
    c.beginPath(); c.ellipse(r * 5, -3, 6, 4.5, r * 0.5, 0, TAU); fo(c, col, 1.2);
    c.beginPath(); c.ellipse(r * 4, 3, 4, 3, -r * 0.4, 0, TAU); fo(c, shade(col, 30), 1.2);
  }
  c.fillStyle = OUT; c.fillRect(-0.8, -6, 1.6, 11);
  c.restore();
}
function drawSnake(c, pose) {
  c.save();
  c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 8;
  const path = () => { c.beginPath(); c.moveTo(-16, 26); c.quadraticCurveTo(0, 36, 14, 26); c.quadraticCurveTo(22, 18, 18 + Math.sin((pose.t || 0) * 0.1) * 2, 8); };
  path(); c.stroke(); c.strokeStyle = '#f4f2ee'; c.lineWidth = 5.5; path(); c.stroke();
  c.beginPath(); c.ellipse(19, 6, 5, 3.6, -0.6, 0, TAU); fo(c, '#f4f2ee', 1.4);
  c.fillStyle = '#d02020'; c.beginPath(); c.arc(20.5, 4.5, 1.1, 0, TAU); c.fill();
  c.restore();
}
function drawBraids(c, L, pose) {
  const sway = Math.sin((pose.t || 0) * 0.06) * 2;
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < 7; i++) {
      const u = i / 6;
      const x = -14 - b * 7 - i * 2 + sway * u, y = 2 + b * 4 + i * 9;
      c.beginPath(); c.ellipse(x, y, 6 - u * 1.5, 6, 0.3, 0, TAU);
      const col = u < 0.5 ? L.hair : L.hairTip;
      fo(c, col, 1.6);
    }
  }
}
function drawBoar(c, pose) {
  c.save();
  // neck
  limb(c, 0, 14, -2, 28, 11, 12, '#d8b090');
  // fur mass
  c.beginPath();
  const pts = [[-22, 8], [-28, -2], [-24, -6], [-30, -14], [-22, -16], [-24, -26], [-12, -22], [-8, -32], [2, -24], [10, -28], [14, -18], [24, -12], [30, -2], [26, 14], [10, 20], [-8, 20]];
  c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath();
  const g = c.createLinearGradient(-26, -20, 26, 16); g.addColorStop(0, '#5a524c'); g.addColorStop(0.5, '#7a726a'); g.addColorStop(1, '#8e867c');
  fo(c, g, 2.4);
  // ears
  for (const [x, y] of [[-14, -22], [2, -25]]) { c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x - 3, y - 12); c.lineTo(x + 6, y + 2); c.closePath(); fo(c, '#4e4640', 1.8); c.beginPath(); c.moveTo(x - 3, y + 2); c.lineTo(x - 2, y - 6); c.lineTo(x + 3, y + 1); c.fillStyle = '#8a5a50'; c.fill(); }
  // snout
  c.beginPath(); c.moveTo(14, -6); c.quadraticCurveTo(30, -8, 34, 2); c.quadraticCurveTo(36, 12, 30, 15); c.quadraticCurveTo(20, 18, 12, 12); c.closePath();
  fo(c, '#9a9288', 2);
  c.beginPath(); c.ellipse(32, 6, 4.5, 7, 0.1, 0, TAU); fo(c, '#b4aca2', 1.6);
  c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(31.5, 3.5, 1.3, 2, 0, 0, TAU); c.ellipse(32.5, 8.5, 1.3, 2, 0, 0, TAU); c.fill();
  // tusk
  c.beginPath(); c.moveTo(22, 13); c.quadraticCurveTo(28, 14, 27, 6); c.quadraticCurveTo(25, 11, 21, 10); c.closePath(); fo(c, '#f4f0e4', 1.2);
  // glassy eye
  c.beginPath(); c.ellipse(13, -9, 4.5, 4, 0, 0, TAU); fo(c, '#0e1620', 1.4);
  c.fillStyle = '#7ac4ff'; c.beginPath(); c.arc(13.5, -9, 2.6, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(12.3, -10.4, 1.2, 0, TAU); c.fill();
  // fur tufts
  c.strokeStyle = '#a49c92'; c.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const x = -20 + i * 5, y = -12 + Math.sin(i) * 6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 5); c.stroke(); }
  c.restore();
}

// ---------------- BODY ----------------
function legPose(pose, back) {
  const run = pose.run || 0;
  if (pose.air) return back ? [-0.4, 0.9] : [0.8, 1.35];
  if (run) { const p = run + (back ? Math.PI : 0); return [Math.sin(p) * 0.75, 0.25 + Math.max(0, Math.sin(p + 1.7)) * 1.1]; }
  const cr = pose.crouch || 0;
  return back ? [-0.24 - cr * 0.3, 0.12 + cr * 0.8] : [0.22 + cr * 0.5, 0.2 + cr * 1.0];
}
function legPts(hip, th, bend) {
  const tl = 30, sl = 32;
  const kx = hip.x + Math.sin(th) * tl, ky = hip.y + Math.cos(th) * tl;
  const sa = th - bend;
  return { kx, ky, fx: kx + Math.sin(sa) * sl, fy: ky + Math.cos(sa) * sl };
}
function drawLeg(c, L, hip, p, back) {
  const pants = back ? shade(L.pants || L.uniform || '#1c1c2a', -22) : (L.pants || L.uniform || '#1c1c2a');
  const wide = L.wide ? 1.35 : 1;
  if (L.bareLegs) {
    limb(c, hip.x, hip.y, p.kx, p.ky, 13, 10, back ? shade(L.legCol || L.skin, -20) : (L.legCol || L.skin));
    limb(c, p.kx, p.ky, p.fx, p.fy, 10, 8, back ? shade(L.legCol || L.skin, -20) : (L.legCol || L.skin));
  } else {
    limb(c, hip.x, hip.y, p.kx, p.ky, 18 * wide, 15 * wide, pants);
    limb(c, p.kx, p.ky, p.fx, p.fy, 15 * wide, 11, pants);
    if (!L.noWraps) { // white leg wraps (kyahan)
      const wx = lerp(p.kx, p.fx, 0.38), wy = lerp(p.ky, p.fy, 0.38);
      limb(c, wx, wy, p.fx, p.fy - 2, 12, 10, back ? '#c9c6be' : '#eeebe3', 1.6);
      c.strokeStyle = '#a8a49a'; c.lineWidth = 1; for (let i = 1; i < 3; i++) { const u = i / 3; c.beginPath(); c.moveTo(lerp(wx, p.fx, u) - 5, lerp(wy, p.fy, u) - 1); c.lineTo(lerp(wx, p.fx, u) + 5, lerp(wy, p.fy, u) + 1); c.stroke(); }
    }
  }
  // foot (tabi + waraji)
  c.beginPath(); c.ellipse(p.fx + 5, p.fy + 1, 10, 4, 0, 0, TAU); fo(c, back ? '#5a4632' : '#7a5e40', 1.6);
  c.beginPath(); c.ellipse(p.fx + 4, p.fy - 2, 8, 4.5, 0, Math.PI, TAU); fo(c, L.bareLegs ? L.skin : (back ? '#d8d4cc' : '#f4f2ec'), 1.4);
}
function drawArmSeg(c, L, sx, sy, ang, back, big) {
  const ul = 22 * big, fl = 21 * big;
  const ea = ang + 0.32, ha = ang - 0.22;
  const ex = sx + Math.cos(ea) * ul, ey = sy + Math.sin(ea) * ul;
  const hx = ex + Math.cos(ha) * fl, hy = ey + Math.sin(ha) * fl;
  const uni = back ? shade(L.uniform || '#1c1c2a', -15) : (L.uniform || '#1c1c2a');
  const bare = L.shirtless || L.sleeveless;
  const sk = back ? shade(L.skin, -20) : L.skin;
  limb(c, ex, ey, hx, hy, 9 * big, 8 * big, bare ? sk : (L.kimono ? (back ? shade(L.kimono, -20) : L.kimono) : uni));
  // upper arm / sleeve
  const hasSleeve = L.haori && L.haori !== 'none' && !L.sleeveless;
  if (hasSleeve) {
    const a = Math.atan2(ey - sy, ex - sx), nx = -Math.sin(a), ny = Math.cos(a);
    const w0 = 10 * big, w1 = 13 * big, droop = 10 * big;
    c.beginPath();
    c.moveTo(sx + nx * w0 - ny * 0, sy - Math.abs(ny) * w0);
    c.lineTo(ex + nx * w1, ey + ny * w1);
    c.quadraticCurveTo(ex - nx * w1 + 2, ey + Math.abs(ny * w1) + droop, ex - nx * w1 * 0.4, ey - ny * w1 * 0.4 + droop * 0.6);
    c.quadraticCurveTo(sx - nx * w0, sy + w0 + droop * 0.6, sx - nx * w0, sy + w0 * 0.6);
    c.closePath();
    const f = haoriFillX(c, L, back);
    fo(c, f, 2);
    if (back) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(lerp(sx, ex, 0.3), lerp(sy, ey, 0.3) + 4); c.lineTo(lerp(sx, ex, 0.8), lerp(sy, ey, 0.8) + droop * 0.5); c.stroke();
  } else limb(c, sx, sy, ex, ey, 11 * big, 9 * big, bare ? sk : uni);
  if (L.armband) { limb(c, lerp(sx, ex, 0.55), lerp(sy, ey, 0.55), lerp(sx, ex, 0.7), lerp(sy, ey, 0.7), 12, 12, '#d8b040', 1.4); }
  return { hx, hy };
}
function haoriFillX(c, L, back) {
  switch (L.haori) {
    case 'flame': { const g = c.createLinearGradient(0, -110, 0, -20); g.addColorStop(0, '#fbfaf6'); g.addColorStop(0.6, '#f4f0e8'); g.addColorStop(0.78, '#ffb428'); g.addColorStop(1, '#d8301a'); return g; }
    case 'butterfly': { const g = c.createLinearGradient(0, -110, 0, -10); g.addColorStop(0, '#fbf8ff'); g.addColorStop(0.45, '#e2c8ff'); g.addColorStop(0.75, '#8a4ac8'); g.addColorStop(1, '#30b49a'); return g; }
    case 'cape': return back ? '#d8d6d2' : '#f6f4f0';
    case 'giyu': return back ? L.h1 : haoriFill(c, L);
    case 'gyomei': return '#6e5230';
    case 'plain': return back ? shade(L.h1, -15) : L.h1;
    default: return haoriFill(c, L) || L.h1 || '#444';
  }
}
function drawHaoriBack(c, L, sh, hip, pose) {
  if (!L.haori || L.haori === 'none') return;
  const t = pose.t || 0;
  const flap = Math.sin(t * 0.15) * 3 + (pose.air ? 14 : 0) + Math.abs(Math.sin(pose.run || 0)) * 8 + (pose.run ? 10 : 0);
  const cape = L.haori === 'cape', len = cape ? 18 : L.haori === 'gyomei' ? 46 : 38;
  c.beginPath();
  c.moveTo(sh.x - 17, sh.y - 3);
  c.lineTo(sh.x + 12, sh.y - 3);
  c.quadraticCurveTo(hip.x + 20, hip.y, hip.x + 16, hip.y + len);
  // hem wave
  for (let i = 1; i <= 6; i++) { const u = i / 6; c.lineTo(lerp(hip.x + 16, hip.x - 26 - flap, u), hip.y + len + 4 + Math.sin(u * 9 + t * 0.2) * 2.5 + u * flap * 0.3); }
  c.quadraticCurveTo(sh.x - 26 - flap * 0.5, (sh.y + hip.y) / 2, sh.x - 17, sh.y - 3);
  c.closePath();
  if (L.haori === 'giyu') {
    fo(c, L.h1, 2.2);
    c.save(); c.clip(); c.fillStyle = haoriFill(c, L); c.fillRect(sh.x - 60, sh.y - 10, 58, 200); c.restore();
    c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
  } else fo(c, haoriFillX(c, L, true), 2.2);
  c.save(); c.clip();
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(sh.x - 60, sh.y - 10, 50, 220); // cel shade back side
  if (L.haori === 'flame') { // flame hem
    c.fillStyle = '#e83a14';
    c.beginPath(); c.moveTo(hip.x - 60, hip.y + len + 10);
    for (let i = 0; i <= 10; i++) { const x = hip.x - 40 + i * 6; c.lineTo(x, hip.y + len - 6 - (i % 2 ? 14 : 2) - Math.sin(t * 0.2 + i) * 3); }
    c.lineTo(hip.x + 40, hip.y + len + 10); c.fill();
  }
  if (L.haori === 'butterfly') { c.strokeStyle = 'rgba(40,10,60,.35)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(hip.x - 30 + i * 8, hip.y + 2); c.lineTo(hip.x - 34 + i * 9, hip.y + len); c.stroke(); } }
  if (L.backKanji) { c.fillStyle = 'rgba(30,20,20,.75)'; c.font = 'bold 18px serif'; c.textAlign = 'center'; c.fillText(L.backKanji, sh.x - 10, sh.y + 30); }
  // folds
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(sh.x - 8 + i * 6, sh.y + 6); c.quadraticCurveTo(hip.x - 6 + i * 4, hip.y, hip.x - 12 + i * 6 - flap * 0.4, hip.y + len); c.stroke(); }
  c.restore();
}
function drawTorso(c, L, sh, hip, big) {
  const tw = 15 * big;
  c.beginPath();
  c.moveTo(sh.x - tw, sh.y - 3);
  c.quadraticCurveTo(sh.x, sh.y - 7, sh.x + tw - 2, sh.y - 2);
  c.quadraticCurveTo(sh.x + tw + 2, (sh.y + hip.y) / 2, hip.x + tw - 3, hip.y + 5);
  c.lineTo(hip.x - tw + 1, hip.y + 5);
  c.quadraticCurveTo(sh.x - tw - 3, (sh.y + hip.y) / 2, sh.x - tw, sh.y - 3);
  c.closePath();
  const base = L.shirtless ? L.skin : L.kimono || L.uniform || '#1c1c2a';
  const g = c.createLinearGradient(sh.x - tw, 0, sh.x + tw, 0); g.addColorStop(0, shade(base, -22)); g.addColorStop(0.6, base); g.addColorStop(1, shade(base, 18));
  fo(c, g, 2.2);
  c.save(); c.clip();
  if (L.kimono && L.asanoha) { c.globalAlpha = 0.35; c.fillStyle = typeof P_ASANOHA === 'function' ? P_ASANOHA() : '#fff'; c.fillRect(sh.x - 30, sh.y - 10, 60, 80); c.globalAlpha = 1; }
  if (L.shirtless) { // muscle lines
    c.strokeStyle = shade(L.skin, -45); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(sh.x - 6, sh.y + 10); c.quadraticCurveTo(sh.x + 2, sh.y + 16, sh.x + 12, sh.y + 10); c.stroke();
    c.beginPath(); c.moveTo(sh.x + 2, sh.y + 18); c.lineTo(hip.x + 3, hip.y - 4); c.stroke();
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(sh.x - 3, sh.y + 24 + i * 7); c.lineTo(sh.x + 9, sh.y + 24 + i * 7); c.stroke(); }
    if (L.tattoo) { c.strokeStyle = '#2f5fe0'; c.lineWidth = 1.3; for (const [x1, y1, x2, y2] of [[-8, 4, -2, 14], [6, 2, 10, 12], [-4, 22, 4, 22], [-6, 30, 6, 30], [-5, 38, 5, 38]]) { c.beginPath(); c.moveTo(sh.x + x1, sh.y + y1); c.quadraticCurveTo(sh.x + (x1 + x2) / 2, sh.y + (y1 + y2) / 2 + 3, sh.x + x2, sh.y + y2); c.stroke(); } }
    if (L.spots) { c.fillStyle = '#4a5a3a'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(sh.x - 10 + (i * 37) % 22, sh.y + 6 + (i * 23) % 40, 1.8, 0, TAU); c.fill(); } }
  } else if (!L.kimono) {
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(sh.x + 4, sh.y, 8, hip.y - sh.y);
    c.fillStyle = '#d8b450'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(sh.x + tw - 5, sh.y + 8 + i * 11, 1.8, 0, TAU); c.fill(); }
  }
  if (L.openChest) { c.beginPath(); c.moveTo(sh.x - 2, sh.y - 4); c.lineTo(sh.x + tw, sh.y - 4); c.lineTo(sh.x + 4, sh.y + 34); c.closePath(); c.fillStyle = L.skin; c.fill(); if (L.scars) { c.strokeStyle = '#b05a5a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sh.x + 2, sh.y + 2); c.lineTo(sh.x + 10, sh.y + 22); c.moveTo(sh.x + 12, sh.y); c.lineTo(sh.x + 4, sh.y + 16); c.stroke(); } }
  c.restore();
  // belt / obi
  if (L.kimono) { limb(c, hip.x - tw + 1, hip.y - 10, hip.x + tw - 2, hip.y - 10, 12, 12, L.obi || L.h2 || '#3a2a3a', 1.6); if (L.obiBand) { c.fillStyle = L.obiBand; c.fillRect(hip.x - tw + 1, hip.y - 12, tw * 2 - 3, 3); } }
  else if (L.shirtless) { if (L.pelt) { c.beginPath(); c.moveTo(hip.x - 18, hip.y - 6); for (let i = 0; i <= 8; i++) c.lineTo(hip.x - 18 + i * 4.5, hip.y + 8 + (i % 2) * 7); c.lineTo(hip.x + 18, hip.y - 6); c.closePath(); fo(c, '#6e5a44', 1.8); } else limb(c, hip.x - tw + 1, hip.y - 4, hip.x + tw - 2, hip.y - 4, 8, 8, L.sash || '#2a3a6a', 1.6); }
  else limb(c, hip.x - tw + 1, hip.y - 5, hip.x + tw - 2, hip.y - 5, 7, 7, '#efece4', 1.6);
  if (L.skirt) { c.beginPath(); c.moveTo(hip.x - tw, hip.y - 2); c.lineTo(hip.x + tw, hip.y - 2); c.lineTo(hip.x + tw + 6, hip.y + 22); c.lineTo(hip.x - tw - 8, hip.y + 22); c.closePath(); fo(c, L.skirt, 2); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(hip.x - tw + i * 7, hip.y); c.lineTo(hip.x - tw - 4 + i * 8.5, hip.y + 22); c.stroke(); } }
  // collar
  if (!L.shirtless && !L.kimono && !L.openChest) { limb(c, sh.x - 6, sh.y - 4, sh.x + 8, sh.y - 3, 8, 8, shade(L.uniform || '#1c1c2a', 10), 1.6); }
  if (L.kimono) { c.strokeStyle = '#f2ece0'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(sh.x - 4, sh.y - 4); c.lineTo(sh.x + 6, sh.y + 14); c.stroke(); }
}
function drawHaoriFront(c, L, sh, hip, pose) {
  if (!L.haori || L.haori === 'none' || L.haori === 'cape') return;
  const len = L.haori === 'gyomei' ? 46 : 36;
  c.beginPath(); c.moveTo(sh.x + 4, sh.y - 4); c.lineTo(sh.x + 13, sh.y - 2); c.quadraticCurveTo(hip.x + 16, hip.y, hip.x + 18, hip.y + len - 4); c.lineTo(hip.x + 9, hip.y + len - 2); c.quadraticCurveTo(hip.x + 6, hip.y, sh.x + 4, sh.y - 4); c.closePath();
  fo(c, L.haori === 'giyu' ? haoriFill(c, L) : haoriFillX(c, L, false), 1.8);
}
function drawBeads(c, sh, hip) {
  for (let i = 0; i < 11; i++) { const u = i / 10; const x = lerp(sh.x - 10, sh.x + 12, u), y = sh.y + 2 + Math.sin(u * Math.PI) * 26; c.beginPath(); c.arc(x, y, 3.4, 0, TAU); fo(c, '#7a4420', 1.2); }
}

// ---------------- WEAPONS ----------------
function drawWeapon(c, L, ch, hx, hy, ang, pose, back) {
  if (L.noSword || !ch) return;
  const w = ang - 0.12;
  c.save(); c.translate(hx, hy); c.rotate(w);
  if (ch.flailW) { // axe handle + chain
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 5; c.beginPath(); c.moveTo(-8, 0); c.lineTo(34, 0); c.stroke();
    c.beginPath(); c.moveTo(30, -2); c.quadraticCurveTo(48, -20, 52, -2); c.quadraticCurveTo(48, 14, 30, 4); c.closePath(); fo(c, '#9aa0a8', 1.8);
    c.restore();
    // chain + ball hanging
    const bx = hx + Math.sin((pose.t || 0) * 0.05) * 6 - 10, by = hy + 34;
    c.strokeStyle = '#8a8a90'; c.lineWidth = 2; c.setLineDash([3, 2]); c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx - 4, hy + 20, bx, by); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(bx, by, 9, 0, TAU); fo(c, '#7a7e84', 1.6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(bx + Math.cos(a - 0.3) * 8, by + Math.sin(a - 0.3) * 8); c.lineTo(bx + Math.cos(a) * 14, by + Math.sin(a) * 14); c.lineTo(bx + Math.cos(a + 0.3) * 8, by + Math.sin(a + 0.3) * 8); fo(c, '#9aa0a8', 1); }
    return;
  }
  const bl = ch.cleaver ? 66 : ch.rapier ? 60 : ch.boss ? 0 : 80;
  // handle (behind hand)
  c.beginPath(); c.rect(-20, -3.2, 20, 6.4); fo(c, ch.cleaver ? '#5a2a3a' : '#2a2030', 1.4);
  c.fillStyle = '#e8e4da'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-18 + i * 5, 0); c.lineTo(-15.5 + i * 5, -2.5); c.lineTo(-13 + i * 5, 0); c.lineTo(-15.5 + i * 5, 2.5); c.closePath(); c.fill(); }
  // tsuba
  drawTsuba(c, L.tsuba || 'round');
  // blade
  if (ch.whipBlade) {
    c.strokeStyle = OUT; c.lineWidth = 4; c.beginPath(); c.moveTo(3, 0); for (let i = 0; i <= 16; i++) c.lineTo(3 + i * 9, Math.sin(i * 0.7 + (pose.t || 0) * 0.3) * i * 1.1); c.stroke();
    c.strokeStyle = L.blade; c.lineWidth = 2.2; c.beginPath(); c.moveTo(3, 0); for (let i = 0; i <= 16; i++) c.lineTo(3 + i * 9, Math.sin(i * 0.7 + (pose.t || 0) * 0.3) * i * 1.1); c.stroke();
  } else if (ch.cleaver) {
    c.beginPath(); c.moveTo(3, -5); c.lineTo(bl, -13); c.lineTo(bl + 5, 2); c.lineTo(3, 6); c.closePath(); fo(c, '#c8ccd4', 1.8);
    c.fillStyle = '#d8b040'; c.fillRect(6, -5, bl - 10, 3);
  } else {
    const curve = ch.curved ? 9 : 2.5;
    c.beginPath(); c.moveTo(3, -3.4); c.quadraticCurveTo(bl * 0.5, -3.4 - curve, bl, -1.2 - curve * 0.6); c.lineTo(bl + 4, 1 - curve * 0.6); c.quadraticCurveTo(bl * 0.5, 3 - curve, 3, 3.2); c.closePath();
    const g = c.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, shade(L.blade, -30)); g.addColorStop(0.55, L.blade); g.addColorStop(1, L.edge || '#eee');
    fo(c, g, 1.6);
    if (L.saw) { c.fillStyle = shade(L.blade, 20); for (let i = 10; i < bl - 6; i += 7) { c.beginPath(); c.moveTo(i, 3); c.lineTo(i + 3, 7); c.lineTo(i + 6, 3); fo(c, shade(L.blade, 20), 1); } }
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(8, 1.6 - curve * 0.3); c.quadraticCurveTo(bl * 0.5, 1.6 - curve, bl - 2, -curve * 0.6); c.stroke();
  }
  c.restore();
}
function drawTsuba(c, type) {
  switch (type) {
    case 'tanjiro': c.beginPath(); c.rect(-1, -7.5, 4, 15); fo(c, '#1a1a1a', 1.4); break;
    case 'flame': c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 6 : 10; c.lineTo(1 + Math.cos(a) * 3, Math.sin(a) * r); } c.closePath(); fo(c, '#d8a030', 1.2); break;
    case 'hex': c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; c.lineTo(1 + Math.cos(a) * 3, Math.sin(a) * 8); } c.closePath(); fo(c, '#2a3a6a', 1.2); break;
    case 'gold': c.beginPath(); c.ellipse(1, 0, 3, 8, 0, 0, TAU); fo(c, '#e0b840', 1.2); break;
    case 'flower': for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(1, (i - 1.5) * 4, 3, 2.6, 0, 0, TAU); fo(c, '#a05ad0', 1); } break;
    default: c.beginPath(); c.ellipse(1, 0, 3, 7.5, 0, 0, TAU); fo(c, '#3a3036', 1.4);
  }
}

// ---------------- PERSON ----------------
function drawPerson(c, L, ch, x, y, face, pose, alpha, scale) {
  scale = scale || 1;
  const key = ch && ch.key;
  if (key && ASSETS.sprite[key] && drawSprite(c, key, x, y, face, pose, alpha, 165 * scale)) return;
  c.save();
  c.translate(x, y); c.scale(face * scale, scale);
  if (alpha !== undefined) c.globalAlpha *= alpha;
  // ground shadow
  c.save(); c.globalAlpha *= 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, (pose.shadowY || 0) + 2, 30, 6, 0, 0, TAU); c.fill(); c.restore();
  if (pose.spin) { c.translate(0, -80); c.rotate(pose.spin); c.translate(0, 80); }
  const t = pose.t || 0, big = L.style === 'gyomei' ? 1.15 : 1;
  const lean = pose.lean || 0, crouch = pose.crouch || 0;
  const bob = pose.run ? -Math.abs(Math.sin(pose.run)) * 3 : Math.sin(t * 0.07) * 0.8;
  const hip = { x: lean * 4, y: -66 + crouch * 12 + bob };
  const sh = { x: hip.x + 3 + lean * 10, y: -112 + crouch * 14 + bob * 1.2 };
  const [tf, bf] = legPose(pose, false), [tb, bb] = legPose(pose, true);
  const lf = legPts(hip, tf, bf), lb = legPts(hip, tb, bb);
  if (!pose.air) { const dy = -Math.max(lf.fy, lb.fy); hip.y += dy; sh.y += dy; for (const p of [lf, lb]) { p.ky += dy; p.fy += dy; } }
  c.lineCap = 'round'; c.lineJoin = 'round';
  // back-mounted items
  if (L.longHairBody) { /* hair drawn by head */ }
  drawHaoriBack(c, L, sh, hip, pose);
  if (L.box) { c.save(); c.translate(sh.x - 28, sh.y - 4); c.rotate(-0.05); c.beginPath(); c.rect(-2, 0, 22, 44); const g = c.createLinearGradient(-2, 0, 20, 0); g.addColorStop(0, '#9a7448'); g.addColorStop(1, '#c89a64'); fo(c, g, 2); c.strokeStyle = '#6a4a28'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-2, i * 11); c.lineTo(20, i * 11); c.stroke(); } c.restore(); }
  // back leg, back arm
  drawLeg(c, L, hip, lb, true);
  const arm2 = pose.arm2 !== undefined ? pose.arm2 : (pose.swing !== undefined ? pose.swing + 0.5 : 0.9 + Math.sin(pose.run || 0) * 0.6);
  const bh = drawArmSeg(c, L, sh.x - 7, sh.y + 2, arm2, true, big);
  if (ch && (ch.dual || ch.cleaver)) drawWeapon(c, L, ch, bh.hx, bh.hy, arm2, pose, true);
  c.beginPath(); c.arc(bh.hx, bh.hy, 4.6 * big, 0, TAU); fo(c, shade(L.skin, -20), 1.6);
  // torso + front leg
  drawLeg(c, L, hip, lf, false);
  drawTorso(c, L, sh, hip, big);
  drawHaoriFront(c, L, sh, hip, pose);
  if (L.beads) drawBeads(c, sh, hip);
  // head
  drawHead(c, L, sh.x + 2, sh.y - 28 * big, pose, big * 1.15);
  // front arm + weapon
  const ang = pose.swing !== undefined ? pose.swing : 0.95 - Math.sin(pose.run || 0) * 0.6;
  const fh = drawArmSeg(c, L, sh.x + 6, sh.y + 2, ang, false, big);
  drawWeapon(c, L, ch, fh.hx, fh.hy, ang, pose, false);
  c.beginPath(); c.arc(fh.hx, fh.hy, 4.8 * big, 0, TAU); fo(c, L.skin, 1.6);
  c.restore();
}

// ---------------- LOOK UPGRADES ----------------
const LOOK_PATCH = {
  tanjiro: { tsuba: 'tanjiro', blade: '#202024', edge: '#8a8a94', pants: '#1c1c2a' },
  nezuko: { kimono: '#f0a8bc', asanoha: 1, obi: '#3a2a20', obiBand: '#c84a5a', haori: 'plain', h1: '#6a3a24', bareLegs: 1, blush: 1 },
  zenitsu: { tsuba: 'gold', blade: '#c8ccd8', edge: '#fff4a0' },
  inosuke: { pants: '#5a4a3a', blade: '#8890a0', edge: '#d0d6e0' },
  kanao: { tsuba: 'flower', blade: '#c0c4cc', edge: '#ffb8d8', skirt: '#1c1c2a', blush: 1 },
  giyu: { tsuba: 'hex', blade: '#2a5ab0', edge: '#cfe4ff' },
  rengoku: { tsuba: 'flame', blade: '#c83018', edge: '#ffb070', backKanji: '' },
  shinobu: { tsuba: 'flower', blade: '#7ab0a0', edge: '#d8fff0', blush: 1 },
  tengen: { headband: 1, paintEye: 1, sleeveless: 1, armband: 1, blade: '#ccc', edge: '#ffd27a' },
  mitsuri: { skirt: '#1c1c2a', bareLegs: 1, legCol: '#d8f0c8', openChest: 0, blush: 1, blade: '#f5a0c0' },
  muichiro: { wide: 1, blade: '#cfe8e8', edge: '#fff' },
  obanai: { blade: '#8a7aaa', edge: '#e0d0ff', curved: 1 },
  sanemi: { kanji: null, haori: 'plain', h1: '#f4f2ec', backKanji: '殺', sharpEye: 1, blade: '#3a8a5a', edge: '#d0ffe0' },
  gyomei: { haori: 'gyomei', blade: '#888', pants: '#2a2420' },
};
for (const k in LOOK_PATCH) Object.assign(CHARS[k].look, LOOK_PATCH[k]);
const DEMON_PATCH = {
  akaza: { style: 'akaza', pants: '#f0e8dc', sash: '#2a3a7a', noWraps: 1, eye: '#e8c050', rank: '上参', skin: '#f6dcd2' },
  daki: { style: 'daki', kimono: '#1a1a20', obi: '#c03060', kanzashi: 1, bareLegs: 1, haori: 'none', rank: '上陸', eye: '#3ad080', sharpEye: 1 },
  gyutaro: { style: 'gyutaro', pants: '#2a2a2a', noWraps: 1, spots: 1, rank: '上陸', eye: '#e8d020', sharpEye: 1, sash: '#3a2a2a' },
  doma: { style: 'doma', bloodTop: 1, haori: 'plain', h1: '#d8d4e4', uniform: '#2a2a3a', pants: '#2a2a3a', noWraps: 1, rank: '上弐', blush: 0 },
  kokushibo: { style: 'kokushibo', haori: 'plain', h1: '#4a2a6a', uniform: '#2a1a3a', pants: '#1a1a22', noWraps: 1, wide: 1 },
  muzan: { style: 'muzan2', haori: 'none', uniform: '#141016', pants: '#141016', noWraps: 1, sharpEye: 1, eye: '#d01828' },
  rui: { style: 'rui', kimono: '#f4f2f0', obi: '#c8b8d0', haori: 'none', bareLegs: 1, rank: '下伍' },
  enmu: { style: 'default', uniform: '#2a2236', pants: '#2a2236', noWraps: 1, rank: '下壱', eye: '#b050d0' },
  susamaru: { kimono: '#d07090', obi: '#3a2a40', haori: 'none', bareLegs: 1, eye: '#e04060' },
  kyogai: { kimono: '#7a6a4a', haori: 'none', bareLegs: 1, horn: 1 },
  minion: { pants: '#3a3a2a', noWraps: 1 },
  icechild: { pants: '#bfe8ff', noWraps: 1 },
  hantengu: { kimono: '#3a2a1a', haori: 'none', bareLegs: 1, horn: 1, rank: '上肆' },
};
for (const k in DEMON_PATCH) Object.assign(DEMON_LOOKS[k], DEMON_PATCH[k]);
