// ============================================================
//  MODEL3D — procedural anime 3D characters (Nendoroid-style chibi):
//  articulated rigid parts, toon shading, inked outlines (inverted hull),
//  painted anime face textures with expressions. One data-driven builder
//  for all 14 slayers + every demon (driven by CHARS[k].look / DEMON_LOOKS),
//  plus custom models (hand demon, Gyokko, training dummy).
//  Static parts are merged per joint so each model is only a few draw calls.
// ============================================================
'use strict';

const CHIBI3D = (() => {
  if (!window.THREE) return { make: () => null };
  const T3 = THREE, INK = 0x1d1422;
  const V3 = (x, y, z) => new T3.Vector3(x, y, z);
  let gradTex = null, softGrad = null;
  function ramp(a, b) {
    const d = new Uint8Array([a, a, a, 255, b, b, b, 255, 255, 255, 255, 255]);
    const t = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); t.minFilter = t.magFilter = T3.NearestFilter; t.needsUpdate = true; return t;
  }
  const toonGrad = () => gradTex || (gradTex = ramp(90, 175));
  const skinGrad = () => softGrad || (softGrad = ramp(175, 225));
  // anime head: sphere with tapered jaw + pointed chin, slightly flattened front
  function headGeo(r) {
    const g = new T3.SphereGeometry(r, 48, 34), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) { const t = -y / r; x *= 1 - 0.32 * t * t; const front = Math.max(0, z / r); z *= 1 - 0.18 * t * t * (1 - front * 0.4); y -= 0.05 * r * t * t * front; }
      z *= 0.92;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  const col = (c) => new T3.Color(c);
  // brightness cap so pale skin / white cloth never trips the bloom threshold (raised during hit flash)
  function capped(m, U) {
    m.onBeforeCompile = (sh) => { sh.uniforms.uCap = U; sh.fragmentShader = 'uniform float uCap;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '{ float mx = max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b); if (mx > uCap) gl_FragColor.rgb *= uCap / mx; }\n#include <dithering_fragment>'); };
    m.customProgramCacheKey = () => 'cap';
    return m;
  }
  // per-vertex root->tip gradient along an axis (for hair / blades)
  function gradColors(geo, axis, from, to, c0, c1, pow) {
    const p = geo.attributes.position, a = col(c0), b = col(c1), out = [];
    for (let i = 0; i < p.count; i++) { const u = clamp((p['get' + axis](i) - from) / (to - from), 0, 1); const c = a.clone().lerp(b, Math.pow(u, pow || 1.6)); out.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new T3.Float32BufferAttribute(out, 3));
    return geo;
  }
  function lockGeo(len, rad, curl, segs) {
    const g = new T3.ConeGeometry(rad, len, segs || 6, 4); g.translate(0, len / 2, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), u = y / len; pos.setZ(i, pos.getZ(i) - curl * u * u * len); }
    g.computeVertexNormals();
    return g;
  }

  // ---------------- merge static meshes per joint (draw-call reduction) ----------------
  function mergeGeos(list) {
    const names = Object.keys(list[0][0].attributes);
    const parts = list.map(([g, m]) => { const n = (g.index ? g.toNonIndexed() : g.clone()); n.applyMatrix4(m); return n; });
    const out = new T3.BufferGeometry();
    for (const nm of names) {
      const size = parts[0].attributes[nm].itemSize; let len = 0;
      for (const p of parts) len += p.attributes[nm].count * size;
      const arr = new Float32Array(len); let off = 0;
      for (const p of parts) { const a = p.attributes[nm].array; arr.set(a, off); off += a.length; }
      out.setAttribute(nm, new T3.BufferAttribute(arr, size));
    }
    for (const p of parts) p.dispose();
    return out;
  }
  function optimize(root, anchors) {
    const keep = new Set(anchors);
    root.updateMatrixWorld(true);
    const inv = new T3.Matrix4(), m = new T3.Matrix4();
    for (const a of anchors) {
      inv.copy(a.matrixWorld).invert();
      const buckets = new Map();
      const visit = (o) => {
        for (const c of o.children) {
          if (keep.has(c)) continue;
          if (c.isMesh && !c.userData.dyn) {
            const key = c.material.uuid + '|' + Object.keys(c.geometry.attributes).sort().join(',');
            let b = buckets.get(key); if (!b) buckets.set(key, b = { mat: c.material, list: [], shadow: false });
            b.list.push([c.geometry, m.clone().multiplyMatrices(inv, c.matrixWorld), c]); b.shadow = b.shadow || c.castShadow;
          }
          visit(c);
        }
      };
      visit(a);
      for (const b of buckets.values()) {
        if (b.list.length < 2) continue;
        const mesh = new T3.Mesh(mergeGeos(b.list), b.mat); mesh.castShadow = b.shadow; mesh.frustumCulled = false;
        for (const [g, , c] of b.list) { c.parent.remove(c); g.dispose(); }
        a.add(mesh);
      }
    }
  }

  // ---------------- anime face painted on the head sphere ----------------
  // sphere UV: u=0.25 is the front (+Z); after translate/scale, 1 unit = 1 degree. +x = character's left
  const ANGRY = { sanemi: 1, obanai: 1, akaza: 1, gyutaro: 1, kokushibo: 1, muzan2: 1 };
  function faceTex(L, expr) {
    return canvasTex(512, 512, (c) => {
      c.fillStyle = L.hair || '#222'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = L.skin; c.beginPath(); c.ellipse(128, 300, 118, 230, 0, 0, TAU); c.fill(); c.fillRect(0, 430, 512, 82);
      c.save(); c.translate(128, 256); c.scale(1.42, 2.84);
      const sh = c.createRadialGradient(0, 4, 10, 0, 4, 60); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(120,60,50,.18)'); c.fillStyle = sh; c.fillRect(-90, -60, 180, 120);
      c.fillStyle = L.blush ? 'rgba(255,100,130,.4)' : 'rgba(255,120,130,.2)'; c.beginPath(); c.ellipse(-19, 19, 6, 2.4, 0, 0, TAU); c.ellipse(19, 19, 6, 2.4, 0, 0, TAU); c.fill();
      c.lineCap = 'round';
      // ---- marks
      if (L.scar) { c.fillStyle = 'rgba(150,30,30,.85)'; c.beginPath(); c.moveTo(4, -21); c.quadraticCurveTo(14, -24, 20, -16); c.quadraticCurveTo(12, -13, 6, -15); c.closePath(); c.fill(); }
      if (L.tattoo) { c.strokeStyle = '#2f5fe0'; c.lineWidth = 1.5; for (const [x1, y1, x2, y2] of [[-8, -26, -8, -14], [0, -27, 0, -16], [8, -26, 8, -14], [-26, 12, -18, 26], [26, 12, 18, 26], [-30, -6, -24, 6], [30, -6, 24, 6]]) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } }
      if (L.marks && !L.tattoo) {
        c.strokeStyle = L.marks; c.lineWidth = 1.8;
        if (L.sixEyes) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 4, -30); c.quadraticCurveTo(s * 20, -26, s * 30, -14); c.quadraticCurveTo(s * 22, -18, s * 12, -20); c.stroke(); c.beginPath(); c.moveTo(s * 28, 18); c.quadraticCurveTo(s * 24, 26, s * 30, 34); c.stroke(); } }
        else for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 24, 8); c.lineTo(s * 30, 18); c.moveTo(s * 20, 22); c.lineTo(s * 26, 30); c.stroke(); }
      }
      if (L.scars) { c.strokeStyle = '#b05a5a'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(-2, -26); c.lineTo(14, 22); c.moveTo(24, -6); c.lineTo(8, 4); c.moveTo(-20, 10); c.lineTo(-12, 24); c.moveTo(-26, -18); c.lineTo(-14, -8); c.stroke(); }
      if (L.paintEye) { c.fillStyle = '#d02a5a'; c.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - 0.3; c.ellipse(16 + Math.cos(a) * 9, 5 + Math.sin(a) * 9, 4, 2.4, a, 0, TAU); } c.fill(); }
      if (L.mask && !L.muzzle) { c.fillStyle = '#f2f0ea'; c.beginPath(); c.moveTo(-34, 12); c.quadraticCurveTo(0, 8, 34, 12); c.lineTo(30, 40); c.quadraticCurveTo(0, 46, -30, 40); c.closePath(); c.fill(); c.strokeStyle = '#c8c4bc'; c.lineWidth = 0.9; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-32, 16 + i * 5); c.quadraticCurveTo(0, 13 + i * 5, 32, 16 + i * 5); c.stroke(); } }
      // ---- eyes
      const ec = L.eye || (typeof EYE_COL !== 'undefined' && EYE_COL[L.style]) || '#9a2a2a';
      const sharp = expr === 'shout' || L.sharpEye ? 1 : 0;
      const pair = (x, y, w, h, cl, cr, o) => {
        c.save(); c.translate(x, 0); animeEye(c, 0, y, w, h, cl, Object.assign({ far: 1 }, o)); c.restore();
        c.save(); c.translate(-x, 0); c.scale(-1, 1); animeEye(c, 0, y, w, h, cr, Object.assign({ far: 1 }, o)); c.restore();
      };
      if (expr === 'hurt') { c.strokeStyle = '#1d1422'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 22, 0); c.lineTo(s * 8, 4); c.lineTo(s * 22, 8); c.stroke(); } }
      else if (expr === 'blink') { c.strokeStyle = '#1d1422'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 14, 2, 8, 0.3, Math.PI - 0.3); c.stroke(); } }
      else if (L.sixEyes) {
        pair(16, 6, 11, 13, '#e8b030', '#e8b030', { demon: 1, sharp: 1 });
        pair(17, -10, 7, 6, '#e8b030', '#e8b030', { demon: 1, sharp: 1 });
        pair(22, 20, 6, 5, '#e8b030', '#e8b030', { demon: 1, sharp: 1 });
      } else if (L.blind) {
        for (const s of [-1, 1]) { c.fillStyle = '#eef0f0'; c.beginPath(); c.ellipse(s * 16, 6, 10, 6, 0, 0, TAU); c.fill(); c.strokeStyle = '#1d1422'; c.lineWidth = 2; c.beginPath(); c.moveTo(s * 5, 2); c.quadraticCurveTo(s * 16, -3, s * 27, 3); c.stroke(); }
        c.strokeStyle = 'rgba(140,200,255,.85)'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 18, 13); c.lineTo(s * 19, 28); c.stroke(); }
      } else {
        const o = { demon: L.demonEye, rainbow: L.rainbow, sharp };
        pair(16, 6, 12, 14, L.hetero ? '#3aa8c8' : ec, ec, o);
        const tag = L.rank || L.kanji;
        if (tag) { c.fillStyle = L.kanji ? '#ffd040' : '#fff'; c.font = 'bold 8px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tag[0], -15.4, 7.6); c.fillText(tag[1] || tag[0], 15.4, 7.6); }
      }
      // ---- brows
      c.strokeStyle = shade(L.hair && L.hair[0] === '#' ? L.hair : '#222', -40); c.lineWidth = L.style === 'rengoku' ? 2.6 : 1.4;
      const ang = expr === 'shout' || expr === 'hurt' || ANGRY[L.style] ? 3 : 0;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7, -11 + ang); c.quadraticCurveTo(s * 16, -14.5, s * 27, -12 - ang * 0.5); c.stroke(); if (L.style === 'rengoku') { c.beginPath(); c.moveTo(s * 22, -13); c.lineTo(s * 27, -18); c.stroke(); } }
      // ---- nose + mouth
      c.strokeStyle = 'rgba(120,60,50,.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 16); c.lineTo(-0.8, 19); c.stroke();
      if (L.muzzle || L.mask) { /* covered */ }
      else if (expr === 'shout') { c.fillStyle = '#5a1822'; c.beginPath(); c.moveTo(-6, 24); c.quadraticCurveTo(0, 22, 6, 24); c.quadraticCurveTo(0, 33, -6, 24); c.fill(); c.fillStyle = '#e06a7a'; c.beginPath(); c.ellipse(0, 28.5, 3, 1.5, 0, 0, TAU); c.fill(); if (L.demonEye) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-5, 24); c.lineTo(-4, 27); c.lineTo(-3, 24); c.moveTo(5, 24); c.lineTo(4, 27); c.lineTo(3, 24); c.fill(); } }
      else { c.strokeStyle = '#6a2a30'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3.5, 25); c.quadraticCurveTo(0, 26.3, 3.5, 25); c.stroke(); if (L.demonEye && L.style !== 'rui') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(2, 25.3); c.lineTo(2.8, 28); c.lineTo(3.6, 25.2); c.fill(); } }
      c.restore();
    });
  }
  const hanafudaTex = () => canvasTex(64, 128, (c) => { c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#d4202a'; c.beginPath(); c.arc(32, 52, 22, 0, TAU); c.fill(); c.fillStyle = '#2a2a2a'; for (let i = 0; i < 4; i++) c.fillRect(0, 86 + i * 9, 64, 4); c.strokeStyle = '#1d1422'; c.lineWidth = 4; c.strokeRect(0, 0, 64, 128); });

  // ---------------- haori textures (u: 0 = front-left edge, 0.5 = back, 1 = front-right edge) ----------------
  function haoriTex(L) {
    const h1 = L.h1 || '#444', h2 = L.h2 || shade(h1, -30);
    const t = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = h1; c.fillRect(0, 0, w, h);
      switch (L.haori) {
        case 'check': { c.fillStyle = h2; c.fillRect(0, 0, w, h); c.fillStyle = h1; const s = 32; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (((x + y) / s) % 2 === 0) c.fillRect(x, y, s, s); break; }
        case 'tri': { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f8d040'); g.addColorStop(1, '#f09018'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; const s = 36; for (let y = h * 0.35; y < h + s; y += s) for (let x = ((y / s) % 2) * s / 2 - s; x < w + s; x += s) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s / 2, y - s * 0.8); c.lineTo(x + s, y); c.fill(); } break; }
        case 'giyu': { // wearer's left half: tortoiseshell; right half: solid burgundy
          c.fillStyle = h2; c.fillRect(0, 0, w / 2, h); c.strokeStyle = L.h3 || '#d8b040'; c.lineWidth = 3; const s = 26;
          for (let y = 0; y < h + s; y += s * 0.86) for (let x = ((Math.round(y / (s * 0.86))) % 2) * s * 0.75; x < w / 2 + s; x += s * 1.5) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.lineTo(x + Math.cos(a) * s * 0.48, y + Math.sin(a) * s * 0.48); } c.closePath(); c.stroke(); }
          c.fillStyle = h1; c.fillRect(w / 2, 0, w / 2, h); break;
        }
        case 'flame': { c.fillStyle = '#f6f2ea'; c.fillRect(0, 0, w, h); for (const [cl, k] of [['#e2421c', 0], ['#ff9a20', 1]]) { c.fillStyle = cl; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 24) { const tip = h * (0.42 + k * 0.18) + Math.sin(x * 0.7) * 18; c.quadraticCurveTo(x + 6, h * 0.8, x + 12, tip); c.quadraticCurveTo(x + 16, h * 0.85, x + 24, h * (0.7 + k * 0.1)); } c.lineTo(w, h); c.fill(); } break; }
        case 'butterfly': { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fbfaf8'); g.addColorStop(0.45, '#f0ecf4'); g.addColorStop(1, h2); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(30,10,50,.55)'; c.lineWidth = 2.5; for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, h * 0.45); c.quadraticCurveTo(x + 10, h * 0.75, x - 6, h); c.moveTo(x + 20, h * 0.55); c.quadraticCurveTo(x + 30, h * 0.8, x + 18, h); c.stroke(); } break; }
        case 'stripe': { c.fillStyle = '#f0f0ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a3a'; for (let x = -h; x < w; x += 28) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 10, h); c.lineTo(x + 10 + h * 0.3, 0); c.lineTo(x + h * 0.3, 0); c.fill(); } break; }
        case 'gyomei': { c.fillStyle = h2; const s = 30; for (let y = 0; y < h + s; y += s) for (let x = ((y / s) % 2) * s / 2 - s; x < w + s; x += s) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s / 2, y - s * 0.7); c.lineTo(x + s, y); c.fill(); } break; }
        case 'cape': { c.fillStyle = '#f8f8f6'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, h * 0.85, w, h * 0.15); break; }
        default: { c.fillStyle = shade(h1, -18); c.fillRect(0, h * 0.9, w, h * 0.1); }
      }
      if (L.backKanji) { c.fillStyle = 'rgba(25,15,15,.85)'; c.font = 'bold 120px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L.backKanji, w / 2, h * 0.42); }
    });
    t.magFilter = T3.LinearFilter;
    return t;
  }
  // torso wrap (u: 0.5 = front after rotating the geometry by PI)
  function torsoTex(L) {
    return canvasTex(256, 256, (c, w, h) => {
      const base = L.shirtless ? L.skin : L.kimono || L.uniform || '#1c1c2a';
      c.fillStyle = base; c.fillRect(0, 0, w, h);
      const fx = w / 2;
      if (L.shirtless) {
        c.strokeStyle = shade(L.skin, -45); c.lineWidth = 3; c.lineCap = 'round';
        c.beginPath(); c.moveTo(fx - 34, 80); c.quadraticCurveTo(fx - 16, 96, fx, 84); c.quadraticCurveTo(fx + 16, 96, fx + 34, 80); c.stroke();
        c.beginPath(); c.moveTo(fx, 90); c.lineTo(fx, 190); for (const y of [120, 148, 174]) { c.moveTo(fx - 16, y); c.lineTo(fx + 16, y); } c.stroke();
        if (L.tattoo) { c.strokeStyle = '#2f5fe0'; c.lineWidth = 4; for (let i = 0; i < 9; i++) { const x = i * 28 + 10; c.beginPath(); c.moveTo(x, 30); c.lineTo(x + 6, 90); c.moveTo(x + 10, 130); c.lineTo(x + 2, 200); c.stroke(); } }
        if (L.spots) { c.fillStyle = '#4a5a3a'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc((i * 97) % w, 30 + (i * 53) % 190, 4 + (i % 3) * 2, 0, TAU); c.fill(); } }
      } else if (L.kimono) {
        if (L.asanoha) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; const s = 22; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s); c.moveTo(x + s, y); c.lineTo(x, y + s); c.moveTo(x + s / 2, y); c.lineTo(x + s / 2, y + s); c.stroke(); } }
        c.strokeStyle = '#f2ece0'; c.lineWidth = 9; c.beginPath(); c.moveTo(fx - 30, 0); c.lineTo(fx + 6, 150); c.moveTo(fx + 30, 0); c.lineTo(fx - 6, 150); c.stroke();
        c.strokeStyle = shade(L.kimono, -40); c.lineWidth = 3; c.beginPath(); c.moveTo(fx + 30, 0); c.lineTo(fx - 6, 150); c.stroke();
      } else {
        c.fillStyle = shade(base, 14); c.fillRect(fx - 2, 0, 4, h);
        if (!L.haori || L.haori === 'none' || L.haori === 'cape') { c.fillStyle = 'rgba(240,240,240,.85)'; c.font = 'bold 64px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L.backKanji || '滅', 0, 110); c.fillText(L.backKanji || '滅', w, 110); }
      }
      if (L.openChest) { c.fillStyle = L.skin; c.beginPath(); c.moveTo(fx - 44, 0); c.lineTo(fx + 44, 0); c.lineTo(fx + 4, 200); c.lineTo(fx - 4, 200); c.closePath(); c.fill(); c.strokeStyle = '#b05a5a'; c.lineWidth = 3; c.beginPath(); c.moveTo(fx - 20, 30); c.lineTo(fx + 10, 110); c.moveTo(fx + 14, 40); c.lineTo(fx - 4, 80); c.moveTo(fx - 8, 120); c.lineTo(fx + 6, 170); c.stroke(); }
    });
  }

  // ---------------- hair data ----------------
  // spike: [dirX, dirY, dirZ, length, radius, curl]   (+Z = face, +Y = up, -X = character's right)
  const SPIKES = [
    [0, 1, -0.35, 0.15, 0.1, 0.08], [0.4, 0.85, -0.4, 0.14, 0.095, 0.08], [-0.4, 0.85, -0.4, 0.14, 0.095, 0.08],
    [0.62, 0.5, -0.6, 0.15, 0.09, 0.06], [-0.62, 0.5, -0.6, 0.15, 0.09, 0.06], [0, 0.55, -0.85, 0.16, 0.1, 0.05],
    [0.35, 0.15, -0.92, 0.15, 0.09, 0.03], [-0.35, 0.15, -0.92, 0.15, 0.09, 0.03], [0, -0.05, -1, 0.14, 0.09, 0],
    [0.85, 0.2, -0.45, 0.12, 0.08, 0.04], [-0.85, 0.2, -0.45, 0.12, 0.08, 0.04],
    [0.55, -0.3, -0.78, 0.12, 0.08, -0.02], [-0.55, -0.3, -0.78, 0.12, 0.08, -0.02], [0, -0.35, -0.94, 0.12, 0.08, 0],
    [0.3, 0.95, 0.15, 0.12, 0.09, -0.06], [-0.3, 0.95, 0.15, 0.12, 0.09, -0.06], [0.75, 0.6, 0.05, 0.11, 0.08, -0.04], [-0.75, 0.6, 0.05, 0.11, 0.08, -0.04],
  ];
  const SOFT = SPIKES.filter((s, i) => i % 2 === 0);
  // bangs: [x, y, length, radius, tilt]  (z is projected onto the head)
  const BANGS = {
    spiky: [[0, 0.2, 0.11, 0.07, 0.05], [0.1, 0.19, 0.1, 0.065, 0.3], [-0.1, 0.19, 0.1, 0.065, -0.3], [0.19, 0.15, 0.1, 0.06, 0.5], [-0.19, 0.15, 0.1, 0.06, -0.5], [0.255, 0.06, 0.15, 0.05, 0.12], [-0.255, 0.06, 0.15, 0.05, -0.12]],
    straight: [[0, 0.2, 0.11, 0.06, 0], [0.08, 0.2, 0.11, 0.06, 0.04], [-0.08, 0.2, 0.11, 0.06, -0.04], [0.16, 0.17, 0.11, 0.06, 0.1], [-0.16, 0.17, 0.11, 0.06, -0.1], [0.23, 0.11, 0.12, 0.055, 0.1], [-0.23, 0.11, 0.12, 0.055, -0.1]],
    parted: [[0.05, 0.21, 0.13, 0.065, 0.55], [-0.05, 0.21, 0.13, 0.065, -0.55], [0.14, 0.18, 0.15, 0.06, 0.45], [-0.14, 0.18, 0.15, 0.06, -0.45], [0.23, 0.1, 0.18, 0.055, 0.15], [-0.23, 0.1, 0.18, 0.055, -0.15]],
    def: [[0.02, 0.2, 0.11, 0.075, 0.15], [0.13, 0.18, 0.11, 0.07, 0.35], [-0.1, 0.19, 0.11, 0.07, -0.3], [0.22, 0.11, 0.13, 0.06, 0.15], [-0.22, 0.12, 0.13, 0.06, -0.15]],
    high: [[0.06, 0.22, 0.06, 0.05, 0.3], [-0.06, 0.22, 0.06, 0.05, -0.3]],
  };
  // per hair style: spikes (scale), bangs, hang (long/bob locks at the back), side (face-framing locks), tail, extra
  const HAIR3D = {
    tanjiro: { spikes: 1, bangs: 'spiky' },
    zenitsu: { spikes: 1.3, bangs: 'spiky' },
    rengoku: { spikes: 1.75, bangs: 'spiky', flare: 0.35 },
    sanemi: { spikes: 1.2, bangs: 'spiky' },
    akaza: { spikes: 0.95, bangs: 'spiky' },
    gyutaro: { spikes: 1.45, bangs: 'spiky', hang: [0.32, 7], flare: 0.2 },
    giyu: { spikes: 0.85, bangs: 'def', tail: [0, -0.14, -0.25, 0.5, 3, 0.35, 0.25] },
    nezuko: { bangs: 'straight', hang: [1.0, 9], side: 0.42 },
    muichiro: { bangs: 'parted', hang: [0.95, 9], side: 0.46 },
    daki: { bangs: 'straight', hang: [1.05, 9], side: 0.4 },
    muzan2: { bangs: 'parted', hang: [1.25, 11, 0.3], side: 0.5 },
    kokushibo: { bangs: 'parted', hang: [0.24, 7], side: 0.45, tail: [0, 0.16, -0.25, 0.95, 4, 0.18, 0.2] },
    kanao: { bangs: 'straight', hang: [0.28, 7], side: 0.34, tail: [0.24, 0.06, -0.12, 0.42, 3, 0.15, 0.1] },
    shinobu: { bangs: 'straight', hang: [0.3, 8], side: 0.3, bun: 1 },
    rui: { bangs: 'straight', hang: [0.3, 8], side: 0.32 },
    mitsuri: { bangs: 'straight', hang: [0.2, 7], side: 0.46, braids: 1 },
    gyomei: { buzz: 1, bangs: 'high' },
    tengen: { spikes: 0.7, bangs: 'high', hang: [0.24, 7] },
    doma: { bangs: 'parted', hang: [0.36, 8], side: 0.36 },
    obanai: { bangs: 'def', hang: [0.34, 8], side: 0.32 },
    default: { soft: 1, bangs: 'def', hang: [0.2, 7] },
  };

  // ---------------- the builder ----------------
  function build(Lin, ch, o) {
    o = o || {};
    const L = Object.assign({}, Lin);
    L.hair = L.hair || '#222'; L.skin = L.skin || '#f3d2b3';
    const inkMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide });
    const mats = [inkMat], cache = {}, U = { value: 0.86 };
    const toon = (color, extra) => { const m = capped(new T3.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad() }, extra || {})), U); mats.push(m); return m; };
    const tc = (c) => cache[c] || (cache[c] = toon(c)); // shared flat-color toon material
    function part(geo, mat, ink, parent, pos, rot) {
      const g = new T3.Group();
      const m = new T3.Mesh(geo, mat); m.castShadow = true; g.add(m);
      if (ink !== 0) { const ol = new T3.Mesh(geo, inkMat); ol.scale.setScalar(1 + (ink || 0.06)); g.add(ol); }
      if (pos) g.position.set(pos[0], pos[1], pos[2]); if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
      if (parent) parent.add(g);
      return g;
    }
    const joint = (parent, x, y, z) => { const j = new T3.Group(); j.position.set(x, y, z); parent.add(j); return j; };
    const anchors = [];
    const J = {};
    const skinM = capped(new T3.MeshToonMaterial({ color: L.skin, gradientMap: skinGrad() }), U); mats.push(skinM);
    const hairV = toon(0xffffff, { vertexColors: true });
    const uniC = L.uniform || '#1c1c2a', pantsC = L.pants || uniC;
    const M = {
      skin: skinM, uni: tc(uniC), pants: tc(pantsC), white: tc('#efece4'), dark: tc('#241c1c'), gold: tc('#d8b450'), hair: tc(L.hair),
      shade: capped(new T3.MeshToonMaterial({ color: shade(L.skin, -30), gradientMap: skinGrad() }), U),
    };
    mats.push(M.shade);
    const hasHaori = L.haori && L.haori !== 'none';
    if (hasHaori) { M.haori = toon(0xffffff, { map: haoriTex(L), side: T3.DoubleSide }); M.sleeve = M.haori; }
    const bulk = L.style === 'gyomei' ? 1.14 : L.style === 'gyutaro' ? 0.88 : 1;
    const root = new T3.Group(), turn = new T3.Group(), spin = new T3.Group(), body = new T3.Group();
    root.add(turn); turn.add(spin); spin.add(body);
    body.scale.set(bulk, 1, bulk);
    anchors.push(body);

    // ---------------- legs ----------------
    J.hips = joint(body, 0, 0.62, 0); anchors.push(J.hips);
    const legC = L.bareLegs ? null : M.pants, legSkin = L.legCol ? tc(L.legCol) : M.skin;
    const wide = L.wide ? 1.4 : 1, bareFeet = L.noWraps && L.shirtless;
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'R' : 'L';
      const up = J['upLeg' + side] = joint(J.hips, s * 0.09, 0, 0); anchors.push(up);
      part(new T3.CapsuleGeometry(0.085 * (L.bareLegs ? 0.8 : wide), 0.2, 4, 10), legC || legSkin, 0.07, up, [0, -0.14, 0]);
      const lo = J['loLeg' + side] = joint(up, 0, -0.3, 0); anchors.push(lo);
      part(new T3.CapsuleGeometry(0.07 * (L.bareLegs ? 0.8 : wide), 0.17, 4, 10), legC || legSkin, 0.07, lo, [0, -0.12, 0]);
      if (L.bareLegs) {
        part(new T3.BoxGeometry(0.085, 0.05, 0.16), legSkin, 0.05, lo, [0, -0.29, 0.03]);
        part(new T3.BoxGeometry(0.1, 0.02, 0.18), tc('#7a4a3a'), 0.05, lo, [0, -0.325, 0.03]); // zori
      } else if (bareFeet) {
        part(new T3.BoxGeometry(0.09, 0.06, 0.17), M.skin, 0.05, lo, [0, -0.3, 0.03]);
      } else if (L.noWraps) {
        part(new T3.BoxGeometry(0.1, 0.07, 0.18), M.dark, 0.05, lo, [0, -0.3, 0.03]);
      } else {
        part(new T3.CylinderGeometry(0.078 * wide, 0.066 * wide, 0.16, 12), M.white, 0.05, lo, [0, -0.2, 0]); // kyahan
        part(new T3.BoxGeometry(0.1, 0.06, 0.17), M.white, 0.05, lo, [0, -0.29, 0.03]); // tabi
        part(new T3.BoxGeometry(0.11, 0.022, 0.19), tc('#7a5e40'), 0.05, lo, [0, -0.325, 0.03]); // waraji
      }
    }
    // kimono skirt / short skirt / boar pelt
    if (L.kimono) { const sk = part(new T3.CylinderGeometry(0.17, 0.25, 0.4, 20, 1, true), toon(L.kimono, { side: T3.DoubleSide }), 0.03, J.hips, [0, -0.17, 0]); sk.scale.z = 0.8; J.skirt = sk; anchors.push(sk); }
    if (L.skirt) { const sk = part(new T3.CylinderGeometry(0.17, 0.24, 0.2, 20, 1, true), toon(L.skirt, { side: T3.DoubleSide }), 0.03, J.hips, [0, -0.06, 0]); sk.scale.z = 0.8; J.skirt = sk; anchors.push(sk); }
    if (L.pelt) { const pg = new T3.CylinderGeometry(0.18, 0.23, 0.17, 16, 2, true); const pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) < -0.08) pp.setY(i, pp.getY(i) - ((i % 3) * 0.03)); pg.computeVertexNormals(); part(pg, toon('#6b5a48', { side: T3.DoubleSide }), 0.04, J.hips, [0, -0.04, 0]).scale.z = 0.8; }

    // ---------------- torso ----------------
    J.spine = joint(J.hips, 0, 0.02, 0); anchors.push(J.spine);
    const tg = new T3.CapsuleGeometry(0.16, 0.2, 4, 16); tg.rotateY(Math.PI);
    part(tg, toon(0xffffff, { map: torsoTex(L) }), 0.05, J.spine, [0, 0.17, 0]).scale.set(1.08, 1, 0.72);
    if (L.kimono) { // obi
      part(new T3.CylinderGeometry(0.172, 0.172, 0.1, 18), tc(L.obi || L.h2 || '#3a2a3a'), 0.04, J.spine, [0, 0.05, 0]).scale.set(1.05, 1, 0.76);
      if (L.obiBand) part(new T3.CylinderGeometry(0.176, 0.176, 0.025, 18), tc(L.obiBand), 0, J.spine, [0, 0.05, 0]).scale.set(1.05, 1, 0.76);
    } else if (L.shirtless) {
      part(new T3.CylinderGeometry(0.168, 0.168, 0.06, 18), tc(L.sash || pantsC), 0.04, J.spine, [0, 0.0, 0]).scale.set(1.04, 1, 0.74);
    } else {
      part(new T3.CylinderGeometry(0.168, 0.168, 0.05, 18), M.white, 0.04, J.spine, [0, 0.03, 0]).scale.set(1.04, 1, 0.74);
      if (!L.openChest) for (let i = 0; i < 3; i++) part(new T3.SphereGeometry(0.012, 6, 6), M.gold, 0, J.spine, [0, 0.13 + i * 0.07, 0.122]);
    }
    // haori / cape
    if (hasHaori) {
      const cape = L.haori === 'cape', len = cape ? 0.26 : L.haori === 'gyomei' ? 0.66 : 0.52;
      const h = new T3.CylinderGeometry(0.2, cape ? 0.25 : 0.3, len, 22, 1, true, 0.55, TAU - 1.1);
      const hao = part(h, M.haori, 0.03, J.spine, [0, 0.34 - len / 2, -0.01]); hao.scale.set(1, 1, 0.8); J.haori = hao; anchors.push(hao);
      hao.userData.len = len;
      if (cape) part(new T3.TorusGeometry(0.02, 0.012, 6, 10), M.gold, 0.1, J.spine, [0, 0.34, 0.13]);
    }
    if (!L.shirtless) part(new T3.CylinderGeometry(0.06, 0.075, 0.07, 12), L.kimono ? M.white : L.openChest ? M.skin : M.uni, 0.05, J.spine, [0, 0.38, 0]); // collar
    if (L.box) { // Nezuko's box
      const box = part(new T3.BoxGeometry(0.26, 0.4, 0.17), tc('#b08250'), 0.04, J.spine, [0, 0.2, -0.25]);
      for (const y of [-0.1, 0.06]) part(new T3.BoxGeometry(0.27, 0.02, 0.18), tc('#6a4a28'), 0, box, [0, y, 0]);
    }
    if (L.beads) for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; part(new T3.SphereGeometry(0.03, 8, 6), tc('#5a4030'), 0.08, J.spine, [Math.sin(a) * 0.19, 0.3 - Math.cos(a) * 0.05 - (Math.cos(a) > 0 ? Math.cos(a) * 0.12 : 0), Math.cos(a) * 0.15]); }

    // ---------------- arms ----------------
    const bareArm = L.shirtless || L.sleeveless, sleeve = hasHaori && L.haori !== 'cape' && !L.sleeveless;
    const armM = bareArm ? M.skin : L.kimono ? tc(L.kimono) : M.uni;
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'R' : 'L';
      const sh = J['upArm' + side] = joint(J.spine, s * 0.2, 0.34, 0); anchors.push(sh);
      if (sleeve) part(new T3.CylinderGeometry(0.085, 0.12, 0.24, 14, 1, true), M.sleeve, 0.05, sh, [0, -0.12, 0]);
      else if (L.kimono) part(new T3.CylinderGeometry(0.07, 0.11, 0.22, 14, 1, true), toon(L.kimono, { side: T3.DoubleSide }), 0.05, sh, [0, -0.13, 0]);
      part(new T3.CapsuleGeometry(0.052, 0.12, 4, 8), armM, 0.08, sh, [0, -0.1, 0]);
      if (L.armband) part(new T3.CylinderGeometry(0.06, 0.06, 0.035, 12), M.gold, 0.06, sh, [0, -0.13, 0]);
      const el = J['loArm' + side] = joint(sh, 0, -0.22, 0); anchors.push(el);
      part(new T3.CapsuleGeometry(0.045, 0.12, 4, 8), bareArm || L.kimono ? M.skin : M.uni, 0.08, el, [0, -0.08, 0]);
      const hand = J['hand' + side] = part(new T3.SphereGeometry(0.05, 10, 8), M.skin, 0.08, el, [0, -0.19, 0]); anchors.push(hand);
    }
    // ---------------- head ----------------
    J.neck = joint(J.spine, 0, 0.4, 0); anchors.push(J.neck);
    part(new T3.CylinderGeometry(0.05, 0.055, 0.08, 10), M.skin, 0.05, J.neck, [0, 0.03, 0]);
    J.head = joint(J.neck, 0, 0.32, 0.01); anchors.push(J.head);
    const HS = HAIR3D[L.style] || HAIR3D.default;
    let headMat = null; const faces = {};
    if (L.style === 'boar') buildBoar(J.head);
    else {
      faces.normal = faceTex(L, 'normal');
      headMat = capped(new T3.MeshToonMaterial({ map: faces.normal, gradientMap: skinGrad() }), U); mats.push(headMat);
      part(headGeo(0.28), headMat, 0.035, J.head);
      for (const s of [-1, 1]) part(new T3.SphereGeometry(0.05, 10, 8), M.skin, 0.05, J.head, [s * 0.275, -0.03, -0.01]).scale.set(0.45, 1, 0.75);
      buildHair(J.head, HS);
    }
    if (L.earring) for (const s of [-1, 1]) { const r = part(new T3.BoxGeometry(0.004, 0.085, 0.042), toon(0xffffff, { map: hanafudaTex() }), 0.08, J.head, [s * 0.285, -0.12, -0.01]); r.userData.dyn = 1; r.children.forEach(m => m.userData.dyn = 1); J['ear' + (s < 0 ? 'R' : 'L')] = r; }
    if (L.muzzle) { // bamboo gag
      const bm = part(new T3.CylinderGeometry(0.032, 0.032, 0.36, 10), tc('#7aa848'), 0.06, J.head, [0, -0.15, 0.2], [0, 0, Math.PI / 2]);
      for (const x of [-0.07, 0.07]) part(new T3.CylinderGeometry(0.035, 0.035, 0.015, 10), tc('#4a7020'), 0, bm, [0, x, 0]);
    }
    if (L.ribbon) { const rb = joint(J.head, 0.08, 0.1, -0.27); for (const s of [-1, 1]) part(new T3.SphereGeometry(0.07, 10, 8), tc(L.ribbon), 0.06, rb, [s * 0.07, 0.01, 0], [0, 0, s * 0.5]).scale.set(1, 0.55, 0.4); part(new T3.SphereGeometry(0.03, 8, 6), tc(shade(L.ribbon, -30)), 0.06, rb); }
    if (L.clip) { const bc = joint(J.head, 0.2, 0.16, -0.12); bc.rotation.set(0, 0.9, 0.3); const wc = L.style === 'kanao' ? '#f590b8' : '#9a5ae0'; for (const s of [-1, 1]) { part(new T3.SphereGeometry(0.06, 10, 6), tc(wc), 0.08, bc, [s * 0.05, 0.02, 0], [0, 0, s * 0.5]).scale.set(1, 0.7, 0.2); part(new T3.SphereGeometry(0.04, 10, 6), tc(shade(wc, 30)), 0.08, bc, [s * 0.04, -0.05, 0], [0, 0, -s * 0.4]).scale.set(1, 0.7, 0.2); } }
    if (L.headband) { part(new T3.TorusGeometry(0.295, 0.03, 6, 28), tc('#d8dae0'), 0.04, J.head, [0, 0.12, -0.01], [Math.PI / 2 + 0.3, 0, 0]); [['#ff4080', -0.12], ['#40e0ff', 0], ['#ffd040', 0.12]].forEach(([c, x]) => part(new T3.OctahedronGeometry(0.035), toon(c, { emissive: col(c).multiplyScalar(0.25) }), 0.06, J.head, [x, 0.2, 0.24 - Math.abs(x) * 0.3])); }
    if (L.horn) part(new T3.ConeGeometry(0.04, 0.2, 8), tc('#ece4d4'), 0.06, J.head, [0.06, 0.32, 0.12], [0.35, 0, -0.15]);
    if (L.bloodTop) part(new T3.SphereGeometry(0.2, 16, 8, 0, TAU, 0, Math.PI / 2), tc('#b8101c'), 0.03, J.head, [0, 0.16, 0.02]).scale.set(1, 0.5, 1);
    if (L.kanzashi) { part(new T3.SphereGeometry(0.13, 14, 10), M.hair, 0.04, J.head, [0, 0.3, -0.12]); for (let i = 0; i < 3; i++) part(new T3.CylinderGeometry(0.008, 0.008, 0.36, 5), M.gold, 0, J.head, [0, 0.32, -0.12], [0, i * 0.5 - 0.5, Math.PI / 2 - 0.2]); part(new T3.SphereGeometry(0.045, 8, 6), tc('#e04070'), 0.06, J.head, [0.14, 0.3, -0.06]); }
    if (L.snake) buildSnake(J.neck);
    if (L.sleepy) {} // expression handled in pose

    // ---------------- weapons ----------------
    if (ch && !L.noSword) {
      J.sword = weapon(J.handR, false);
      if (ch.dual || ch.cleaver) J.sword2 = weapon(J.handL, true);
    }

    // ---------------- hair builders ----------------
    function hangLock(parent, x, y, z, theta, len, rad, tilt, flat, jit) {
      const g = lockGeo(len, rad, 0, 6); g.rotateX(Math.PI); // points down
      g.scale(flat || 1.6, 1, 0.55);
      gradColors(g, 'Y', 0, -len, L.hair, L.hairTip || L.hair, 2);
      const piv = new T3.Group(); piv.position.set(x, y, z); piv.rotation.set(0, theta, 0); parent.add(piv);
      const lk = part(g, hairV, 0.07, piv); lk.rotation.x = -(tilt || 0.15); // tip outward
      return piv;
    }
    function buildHair(head, HS) {
      // skull cap
      if (HS.buzz) { part(new T3.SphereGeometry(0.287, 32, 16, 0, TAU, 0, Math.PI * 0.42), M.hair, 0.02, head, [0, 0.015, -0.02]); return; }
      part(new T3.SphereGeometry(0.295, 36, 18, 0, TAU, 0, Math.PI * 0.44), M.hair, 0.04, head, [0, 0.02, -0.03]).scale.set(1.02, 1.05, 1.02);
      part(new T3.SphereGeometry(0.292, 28, 14, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.4, Math.PI * 0.42), toon(L.hair, { side: T3.DoubleSide }), 0.04, head, [0, 0, -0.01]);
      // spikes
      const spk = HS.spikes ? SPIKES : HS.soft ? SOFT : null;
      if (spk) {
        const k = HS.spikes || 0.8, tipC = col(L.hairTip || L.hair), rootC = col(L.hair);
        for (const [dx, dy, dz, len0, rad0, curl] of spk) {
          const len = len0 * k * (HS.soft ? 0.7 : 1), rad = rad0 * (HS.soft ? 1.1 : Math.min(1.25, 0.85 + k * 0.15));
          const geo = lockGeo(len, rad, (curl || 0) * (HS.flare ? -1 : 1));
          gradColors(geo, 'Y', 0, len, rootC.getStyle(), tipC.getStyle(), 1.6);
          const dir = V3(dx, dy + (HS.flare || 0), dz).normalize();
          const g = part(geo, hairV, 0.09, head);
          g.position.copy(dir.clone().multiplyScalar(0.26));
          g.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
        }
      }
      // back hanging locks (bob / long)
      if (HS.hang) {
        const [len, n, wild] = HS.hang, hb = J.hairBack = joint(head, 0, 0.05, 0); anchors.push(hb);
        for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0.5 : i / (n - 1), th = Math.PI + (u - 0.5) * 2.5;
          const jl = len * (1 - Math.abs(u - 0.5) * (len > 0.5 ? 0.35 : 0.2)) * (0.92 + ((i * 7) % 3) * 0.05);
          hangLock(hb, Math.sin(th) * 0.25, 0.02, Math.cos(th) * 0.25, th, jl, len > 0.5 ? 0.11 : 0.085, len > 0.5 ? 0.06 + (wild || 0) * ((i % 2) - 0.3) : 0.32, 1.7);
        }
      }
      // face-framing side locks
      if (HS.side) for (const s of [-1, 1]) hangLock(head, s * 0.25, 0.04, 0.09, s * 1.25, HS.side, 0.06, 0.08, 1.5);
      // ponytail [x,y,z,len,n,spread,tilt]
      if (HS.tail) {
        const [x, y, z, len, n, spread, tilt] = HS.tail, tl = J.tail = joint(head, x, y, z); anchors.push(tl);
        part(new T3.SphereGeometry(0.045, 8, 6), tc(L.style === 'giyu' ? '#3a2a2a' : shade(L.hair, -20)), 0.06, tl);
        for (let i = 0; i < n; i++) { const u = n === 1 ? 0 : i / (n - 1) - 0.5; hangLock(tl, u * 0.05, 0, 0, Math.PI + u * spread * 3, len * (1 - Math.abs(u) * 0.3), 0.075, tilt + Math.abs(u) * 0.2, 1.3); }
      }
      if (HS.bun) part(new T3.SphereGeometry(0.09, 12, 8), M.hair, 0.05, head, [0, 0.1, -0.29]);
      // braids (Mitsuri): chains of spheres, pink -> green
      if (HS.braids) for (const s of [-1, 1]) for (let b = 0; b < 2; b++) {
        const br = joint(head, s * (0.2 + b * 0.04), -0.06, -0.14 - b * 0.06); anchors.push(br); J['braid' + s + b] = br;
        for (let i = 0; i < 7; i++) { const u = i / 6; part(new T3.SphereGeometry(0.06 - u * 0.012, 10, 8), tc(u < 0.45 ? L.hair : L.hairTip || L.hair), 0.07, br, [s * 0.01 * i, -0.02 - i * 0.085, -0.012 * i]).scale.set(1, 1.15, 1); }
      }
      // bangs
      const bl = BANGS[HS.bangs] || BANGS.def, tip = col(L.hairTip || L.hair).getStyle();
      for (const [x, y, len, rad, tiltZ] of bl) {
        const z = Math.sqrt(Math.max(0.0004, 0.3 * 0.3 - x * x - y * y)) * 0.93;
        const geo = lockGeo(len, rad, -0.04); geo.rotateX(Math.PI);
        gradColors(geo, 'Y', 0, -len, L.hair, HS.bangs === 'straight' ? L.hair : tip, 2);
        const g = part(geo, hairV, 0.08, head, [x, y, z]); g.rotation.set(-0.5, 0, tiltZ);
      }
    }
    function buildBoar(head) {
      const fur = toon('#7a726a'), dk = tc('#4e4640');
      part(new T3.SphereGeometry(0.33, 24, 18), fur, 0.035, head, [0, 0.02, -0.02]).scale.set(1, 0.95, 1.05);
      const sn = part(new T3.CylinderGeometry(0.13, 0.18, 0.24, 14), tc('#9a9288'), 0.04, head, [0, -0.06, 0.3], [Math.PI / 2 + 0.15, 0, 0]);
      part(new T3.CylinderGeometry(0.13, 0.13, 0.02, 14), tc('#b4aca2'), 0.04, sn, [0, -0.13, 0]);
      for (const s of [-1, 1]) {
        part(new T3.SphereGeometry(0.025, 8, 6), tc('#2a2420'), 0, sn, [s * 0.05, -0.14, 0]);
        part(new T3.ConeGeometry(0.07, 0.17, 6), dk, 0.06, head, [s * 0.2, 0.3, -0.04], [0, 0, -s * 0.45]); // ears
        part(new T3.ConeGeometry(0.025, 0.12, 6), tc('#f4f0e4'), 0.06, head, [s * 0.13, -0.17, 0.33], [0.4, 0, s * 0.5]); // tusks
        part(new T3.SphereGeometry(0.055, 10, 8), tc('#0e1620'), 0.06, head, [s * 0.15, 0.08, 0.27]);
        part(new T3.SphereGeometry(0.03, 8, 6), new T3.MeshBasicMaterial({ color: 0x7ac4ff }), 0, head, [s * 0.16, 0.085, 0.31]);
      }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; part(new T3.ConeGeometry(0.06, 0.16, 5), fur, 0.06, head, [Math.sin(a) * 0.28, 0.12 + Math.cos(a * 2) * 0.05, -0.15 + Math.cos(a) * 0.15], [-0.9 - Math.cos(a) * 0.5, 0, Math.sin(a) * 0.8]); }
    }
    function buildSnake(neck) {
      const sm = tc('#f4f2ee'), sg = new T3.TorusGeometry(0.11, 0.028, 8, 24, Math.PI * 1.6);
      part(sg, sm, 0.07, neck, [0, 0.0, 0.0], [Math.PI / 2, 0, 0.6]);
      const hd = part(new T3.SphereGeometry(0.045, 10, 8), sm, 0.07, neck, [0.13, 0.06, 0.08]); hd.scale.set(1.3, 0.8, 1);
      part(new T3.SphereGeometry(0.01, 6, 4), new T3.MeshBasicMaterial({ color: 0xd02020 }), 0, hd, [0.03, 0.02, 0.035]);
    }
    // ---------------- weapon builder ----------------
    function bladeShape(len, w, edge) { // in XY, tip toward -Y
      const s = new T3.Shape(), N = 16; s.moveTo(-w / 2, 0);
      for (let i = 0; i <= N; i++) { const u = i / N, y = -len * u * 0.93, x = -w / 2 + edge.curve(u); s.lineTo(x, y); }
      s.lineTo(edge.curve(1), -len);
      for (let i = N; i >= 0; i--) { const u = i / N, y = -len * u * 0.93; let x = w / 2 * (1 - u * 0.25) + edge.curve(u); if (edge.saw && i % 2 && i < N) x += w * 0.45; if (edge.wave) x += Math.sin(u * Math.PI * 5) * w * 0.25; s.lineTo(x, y); }
      return s;
    }
    function bladeMesh(parent, len, w, opts) {
      const g = new T3.ExtrudeGeometry(bladeShape(len, w, opts), { depth: 0.012, bevelEnabled: false }); g.translate(0, 0, -0.006);
      const p = g.attributes.position, a = col(L.blade || '#888'), b = col(L.edge || '#ddd'), cols = [];
      for (let i = 0; i < p.count; i++) { const u = -p.getY(i) / len, cx = opts.curve(clamp(u, 0, 1)); const t = clamp((p.getX(i) - cx) / w + 0.5, 0, 1); const c = a.clone().lerp(b, t > (opts.edgeAt || 0.7) ? 1 : t * 0.4); cols.push(c.r, c.g, c.b); }
      g.setAttribute('color', new T3.Float32BufferAttribute(cols, 3));
      g.deleteAttribute('uv');
      return part(g, toon(0xffffff, { vertexColors: true, emissive: col(L.edge || '#ddd').multiplyScalar(0.06) }), 0.05, parent);
    }
    function tsuba(parent, type) {
      const y = -0.045;
      switch (type) {
        case 'tanjiro': part(new T3.BoxGeometry(0.11, 0.012, 0.11), M.dark, 0.06, parent, [0, y, 0]); break;
        case 'flame': { const s = new T3.Shape(); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = i % 2 ? 0.035 : 0.065; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } const g = new T3.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }); g.rotateX(Math.PI / 2); part(g, tc('#d8a030'), 0.06, parent, [0, y + 0.006, 0]); break; }
        case 'hex': part(new T3.CylinderGeometry(0.055, 0.055, 0.012, 6), tc('#2a3a6a'), 0.06, parent, [0, y, 0]); break;
        case 'gold': part(new T3.CylinderGeometry(0.05, 0.05, 0.012, 14), M.gold, 0.06, parent, [0, y, 0]).scale.set(1, 1, 0.7); break;
        case 'flower': for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; part(new T3.CylinderGeometry(0.026, 0.026, 0.012, 10), tc('#a05ad0'), 0.06, parent, [Math.cos(a) * 0.026, y, Math.sin(a) * 0.026]); } break;
        default: part(new T3.CylinderGeometry(0.05, 0.05, 0.012, 14), tc('#3a3036'), 0.06, parent, [0, y, 0]);
      }
    }
    function weapon(hand, back) {
      const sw = new T3.Group(); hand.add(sw); anchors.push(sw);
      if (ch.flailW) { // stone axe + chain flail
        part(new T3.CylinderGeometry(0.022, 0.022, 0.42, 8), tc('#3a2a1a'), 0.07, sw, [0, -0.12, 0]);
        const ax = new T3.Shape(); ax.moveTo(0, 0); ax.quadraticCurveTo(0.2, 0.02, 0.2, -0.12); ax.quadraticCurveTo(0.16, -0.2, 0, -0.16); ax.closePath();
        const ag = new T3.ExtrudeGeometry(ax, { depth: 0.03, bevelEnabled: false }); ag.translate(0.01, -0.18, -0.015);
        part(ag, tc('#9aa0a8'), 0.05, sw);
        const ball = J.flail = new T3.Group(); root.add(ball); anchors.push(ball); ball.userData.dyn = 1;
        part(new T3.IcosahedronGeometry(0.1, 1), tc('#7a7e84'), 0.05, ball);
        for (let i = 0; i < 10; i++) { const d = V3(Math.sin(i * 2.4) * Math.cos(i), Math.cos(i * 2.4), Math.sin(i * 1.3)).normalize(); const sp = part(new T3.ConeGeometry(0.03, 0.08, 5), tc('#9aa0a8'), 0.05, ball); sp.position.copy(d.clone().multiplyScalar(0.1)); sp.quaternion.setFromUnitVectors(V3(0, 1, 0), d); }
        const chain = J.chain = new T3.Mesh(new T3.CylinderGeometry(0.008, 0.008, 1, 5), tc('#8a8a90')); chain.userData.dyn = 1; root.add(chain);
        return sw;
      }
      // handle + tsuba
      part(new T3.CylinderGeometry(0.02, 0.022, 0.2, 8), ch.cleaver ? tc('#5a2a3a') : M.dark, 0.08, sw, [0, 0.06, 0]);
      tsuba(sw, ch.cleaver ? 'round' : L.tsuba);
      const bl = new T3.Group(); sw.add(bl); bl.position.set(0, -0.055, 0); anchors.push(bl);
      if (ch.whipBlade) { // flexible blade: chain of segments
        let par = bl; J.whip = [];
        for (let i = 0; i < 12; i++) { const sg = joint(par, 0, i ? -0.085 : 0, 0); part(new T3.BoxGeometry(0.03 - i * 0.0015, 0.09, 0.006), tc(i % 2 ? (L.blade || '#f5a0c0') : (L.edge || '#fff')), 0.08, sg, [0, -0.045, 0]); J.whip.push(sg); anchors.push(sg); par = sg; }
      } else if (ch.cleaver) {
        bladeMesh(bl, 0.68, 0.13, { curve: (u) => u * u * 0.03, edgeAt: 0.86 });
        part(new T3.BoxGeometry(0.03, 0.55, 0.014), M.gold, 0, bl, [-0.035, -0.3, 0]);
      } else if (ch.rapier) {
        bladeMesh(bl, 0.72, 0.014, { curve: () => 0 });
        part(new T3.BoxGeometry(0.03, 0.12, 0.012), tc(L.blade || '#80b0a0'), 0.06, bl, [0, -0.06, 0]);
      } else {
        bladeMesh(bl, 0.86, 0.032, { curve: (u) => (ch.curved ? 0.05 : 0.012) * u * u, saw: L.saw, wave: ch.curved });
      }
      return sw;
    }

    // ---------------- boss extras ----------------
    const extras = [];
    const key = o.look;
    if (key === 'muzan') {
      const tm = toon('#2a0a12'), tip = toon('#8a0a20', { emissive: col('#600010') });
      for (let i = 0; i < 7; i++) { const base = joint(J.spine, 0, 0.25, -0.12); base.rotation.set(-0.9 - i * 0.08, (i - 3) * 0.45, 0); anchors.push(base); const segs = chainSeg(base, 9, 0.11, 0.045, tm, tip); extras.push((t) => { for (let k = 0; k < segs.length; k++) segs[k].rotation.set(Math.sin(t * 0.05 + k * 0.7 + i) * 0.35 - 0.05, Math.sin(t * 0.04 + i + k) * 0.25, 0); }); }
    }
    if (key === 'daki') {
      for (let i = 0; i < 5; i++) { const base = joint(J.spine, 0, 0.05, -0.12); base.rotation.set(-1.3 + (i - 2) * 0.25, (i - 2) * 0.5, 0); anchors.push(base); const m = toon(i % 2 ? '#c03060' : '#3a2a5a', { side: T3.DoubleSide }); const segs = chainSeg(base, 10, 0.12, 0, m, m, 0.1); extras.push((t) => { for (let k = 0; k < segs.length; k++) segs[k].rotation.set(Math.sin(t * 0.08 + k * 0.6 + i) * 0.28, 0, Math.sin(t * 0.05 + i) * 0.1); }); }
    }
    if (key === 'doma') for (const hd of [J.handR, J.handL]) {
      const f = part(new T3.CircleGeometry(0.34, 18, 0, Math.PI * 0.75), toon('#ffd040', { side: T3.DoubleSide, emissive: col('#403000') }), 0.03, hd, [0, -0.02, 0], [0, Math.PI / 2, -Math.PI * 0.6]);
      for (let i = 0; i < 6; i++) part(new T3.BoxGeometry(0.008, 0.33, 0.004), tc('#d02040'), 0, f, [Math.cos(i / 5 * Math.PI * 0.75) * 0.16, Math.sin(i / 5 * Math.PI * 0.75) * 0.16, 0.003], [0, 0, i / 5 * Math.PI * 0.75 - Math.PI / 2]);
    }
    if (key === 'gyutaro') for (const hd of [J.handR, J.handL]) {
      const sk = part(new T3.TorusGeometry(0.2, 0.022, 6, 20, Math.PI * 1.15), toon('#c01030', { emissive: col('#400008') }), 0.06, hd, [0.1, -0.1, 0]); sk.userData.dyn = 1; sk.children.forEach(m => m.userData.dyn = 1);
      extras.push((t) => { sk.rotation.z = Math.sin(t * 0.08) * 0.3; });
    }
    if (key === 'kokushibo') {
      const sw = joint(J.handR, 0, -0.05, 0); anchors.push(sw);
      part(new T3.BoxGeometry(0.05, 1.5, 0.02), tc('#7a1a2a'), 0.05, sw, [0, -0.75, 0]);
      const eyeM = toon('#e8c040', { emissive: col('#806000') });
      for (let i = 0; i < 6; i++) { part(new T3.SphereGeometry(0.025, 8, 6), eyeM, 0.08, sw, [0, -0.25 - i * 0.22, 0.015]); part(new T3.BoxGeometry(0.02, 0.18, 0.012), tc('#7a1a2a'), 0.06, sw, [0.06, -0.3 - i * 0.22, 0], [0, 0, 0.7]); }
    }
    if (key === 'susamaru') {
      const tm = canvasTex(64, 64, (c) => { c.fillStyle = '#e04040'; c.fillRect(0, 0, 64, 64); for (const [cl, y] of [['#e8b030', 10], ['#4080e0', 26], ['#40b060', 42]]) { c.fillStyle = cl; c.fillRect(0, y, 64, 8); } });
      const tmat = toon(0xffffff, { map: tm });
      for (let i = 0; i < 4; i++) {
        const s = i % 2 ? 1 : -1, sh = joint(J.spine, s * 0.17, 0.22 - (i >> 1) * 0.1, -0.04); anchors.push(sh);
        part(new T3.CapsuleGeometry(0.045, 0.3, 4, 8), M.skin, 0.08, sh, [0, -0.17, 0]);
        part(new T3.SphereGeometry(0.1, 12, 10), tmat, 0.05, sh, [0, -0.4, 0]);
        extras.push((t) => { sh.rotation.set(-1.2 - (i >> 1) * 0.5 + Math.sin(t * 0.1 + i) * 0.25, 0, s * (0.9 + (i >> 1) * 0.3)); });
      }
    }
    if (key === 'kyogai') {
      const drumM = tc('#b8864a'), headM = tc('#f0e0c0');
      for (const [par, x, y, z, r] of [[J.spine, 0.18, 0.28, 0.06, 0], [J.spine, -0.18, 0.28, 0.06, 0], [J.spine, 0, 0.12, 0.15, 1], [J.upLegR, -0.06, -0.12, 0.08, 0], [J.upLegL, 0.06, -0.12, 0.08, 0], [J.spine, 0, 0.2, -0.16, 1]]) {
        const d = part(new T3.CylinderGeometry(0.075, 0.075, 0.09, 14), drumM, 0.06, par, [x, y, z], r ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]);
        for (const e of [-1, 1]) part(new T3.CylinderGeometry(0.085, 0.085, 0.01, 14), headM, 0, d, [0, e * 0.05, 0]);
      }
    }
    if (key === 'hantengu') {
      const ring = joint(J.spine, 0, 0.6, -0.35); anchors.push(ring);
      part(new T3.TorusGeometry(0.6, 0.035, 8, 40), tc('#6a4a2a'), 0.05, ring);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const d = part(new T3.CylinderGeometry(0.12, 0.12, 0.08, 14), tc('#c8a070'), 0.05, ring, [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0], [Math.PI / 2, 0, 0]); part(new T3.CircleGeometry(0.05, 12), tc('#d02020'), 0, d, [0, -0.041, 0], [Math.PI / 2, 0, 0]); }
      extras.push((t) => { ring.rotation.z = t * 0.01; });
    }
    if (key === 'enmu') { const e = part(new T3.SphereGeometry(0.05, 10, 8), tc('#e8d0e0'), 0.06, J.handL, [0, -0.02, 0.04]); part(new T3.SphereGeometry(0.03, 8, 6), new T3.MeshBasicMaterial({ color: 0x802040 }), 0, e, [0, 0, 0.035]).scale.set(1, 0.5, 0.5); }
    function chainSeg(base, n, len, r0, mat, tipMat, flat) {
      const segs = []; let par = base;
      for (let k = 0; k < n; k++) {
        const s = joint(par, 0, k ? len : 0, 0); anchors.push(s); segs.push(s);
        const g = flat ? new T3.BoxGeometry(flat, len * 1.05, 0.01) : new T3.CylinderGeometry(r0 * (1 - k / n * 0.6), r0 * (1 - (k + 1) / n * 0.6), len, 6);
        part(g, k === n - 1 ? tipMat : mat, flat ? 0.05 : 0.08, s, [0, len / 2, 0]);
        par = s;
      }
      return segs;
    }

    root.traverse(n => { n.frustumCulled = false; });
    optimize(root, anchors);
    const model = {
      root, turn, spin, J, L, ch, height: 1.66, mats, faces, extras, size: o.size || 1, U,
      setExpr(e) {
        if (!headMat) return;
        let t = faces[e]; if (!t) t = faces[e] = faceTex(L, e);
        if (headMat.map !== t) { headMat.map = t; headMat.needsUpdate = true; }
      },
    };
    return model;
  }

  // ---------------- custom demons ----------------
  function shell() {
    const inkMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide }), mats = [inkMat], anchors = [], U = { value: 0.86 };
    const toon = (color, extra) => { const m = capped(new T3.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad() }, extra || {})), U); mats.push(m); return m; };
    const part = (geo, mat, ink, parent, pos, rot) => { const g = new T3.Group(); const m = new T3.Mesh(geo, mat); m.castShadow = true; g.add(m); if (ink !== 0) { const ol = new T3.Mesh(geo, inkMat); ol.scale.setScalar(1 + (ink || 0.05)); g.add(ol); } if (pos) g.position.set(pos[0], pos[1], pos[2]); if (rot) g.rotation.set(rot[0], rot[1], rot[2]); if (parent) parent.add(g); return g; };
    const joint = (parent, x, y, z) => { const j = new T3.Group(); j.position.set(x, y, z); parent.add(j); anchors.push(j); return j; };
    const root = new T3.Group(), turn = new T3.Group(); root.add(turn); anchors.push(turn);
    return { inkMat, mats, anchors, toon, part, joint, root, turn, U };
  }
  function simpleFace(draw) { return canvasTex(256, 256, draw); }
  function buildHand() {
    const S = shell(), { toon, part, joint, turn } = S;
    const g1 = toon('#5a7a3a'), g2 = toon('#7d9a58'), g3 = toon('#4a6a2a');
    part(new T3.SphereGeometry(0.8, 24, 18), g1, 0.03, turn, [0, 0.95, 0]).scale.set(1, 1.15, 0.85);
    for (let i = 0; i < 6; i++) part(new T3.CapsuleGeometry(0.08, 0.35, 4, 8), g3, 0.06, turn, [-0.55 + i * 0.22, 0.2, 0.1 * Math.sin(i)]);
    const arms = [];
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 1.1 + i / 13 * Math.PI * 1.2, base = joint(turn, Math.cos(a) * 0.45, 1.1 - Math.sin(a) * 0.35, (i % 3 - 1) * 0.3);
      const l = 0.9 + (i % 3) * 0.2; let par = base; const segs = [];
      for (let k = 0; k < 3; k++) { const s = joint(par, 0, k ? l / 3 : 0, 0); part(new T3.CapsuleGeometry(0.07, l / 3, 4, 8), g2, 0.05, s, [0, l / 6, 0]); segs.push(s); par = s; }
      part(new T3.SphereGeometry(0.1, 10, 8), g2, 0.05, par, [0, l / 3 + 0.05, 0]).scale.set(1.2, 0.8, 0.6);
      arms.push([base, segs, a, i]);
    }
    for (let i = 0; i < 5; i++) part(new T3.SphereGeometry(0.11, 10, 8), g2, 0.05, turn, [-0.3 + i * 0.15, 1.55, 0.45]).scale.set(1.1, 0.8, 0.6);
    const face = simpleFace((c) => { c.fillStyle = '#7d9a58'; c.fillRect(0, 0, 256, 256); c.save(); c.translate(64, 128); c.scale(1, 2); c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, -8, 9, 0, TAU); c.arc(14, -8, 9, 0, TAU); c.fill(); c.fillStyle = '#c00'; c.beginPath(); c.arc(-13, -8, 4, 0, TAU); c.arc(15, -8, 4, 0, TAU); c.fill(); c.fillStyle = '#300'; c.beginPath(); c.ellipse(0, 14, 20, 7, 0, 0, Math.PI); c.fill(); c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) c.fillRect(-16 + i * 6, 13, 3, 4); c.restore(); });
    part(new T3.SphereGeometry(0.34, 20, 16), toon(0xffffff, { map: face }), 0.04, turn, [0, 1.85, 0.25]);
    optimize(S.root, S.anchors);
    return Object.assign(S, { height: 2.2, custom: 1, tick(t) { for (const [base, segs, a, i] of arms) { base.rotation.set((i % 3 - 1) * 0.35, 0, -a - Math.PI / 2 + Math.sin(t * 0.05 + i) * 0.12); segs.forEach((s, k) => { if (k) s.rotation.z = Math.sin(t * 0.05 + i + k) * 0.2; }); } } });
  }
  function buildGyokko() {
    const S = shell(), { toon, part, joint, turn } = S;
    const vt = canvasTex(256, 128, (c) => { const g = c.createLinearGradient(0, 0, 256, 0); for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, i % 2 ? '#e8eef8' : '#2a4a8a'); c.fillStyle = '#e8eef8'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#1a3a7a'; c.lineWidth = 5; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(16 + i * 32, 64, 12, 0, TAU); c.stroke(); } c.fillStyle = '#2a4a8a'; c.fillRect(0, 0, 256, 14); c.fillRect(0, 114, 256, 14); });
    const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new T3.Vector2(0.22 + Math.sin(u * Math.PI) * 0.32 - u * 0.05, u * 0.9)); }
    part(new T3.LatheGeometry(pts, 24), toon(0xffffff, { map: vt, side: T3.DoubleSide }), 0.03, turn);
    const bodyM = toon('#d8e0f0'); const segs = [];
    let par = joint(turn, 0, 0.9, 0);
    for (let k = 0; k < 6; k++) { const s = joint(par, 0, k ? 0.16 : 0, 0); part(new T3.SphereGeometry(0.11 - k * 0.004, 12, 10), bodyM, 0.05, s, [0, 0.08, 0]); segs.push(s); par = s; }
    const face = simpleFace((c) => { c.fillStyle = '#e0e8f4'; c.fillRect(0, 0, 256, 256); c.save(); c.translate(64, 128); c.scale(1, 2); c.fillStyle = '#a02040'; c.beginPath(); c.ellipse(-12, -14, 8, 4, 0, 0, TAU); c.ellipse(12, 10, 8, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.fillRect(-18 + i * 3.5, -15, 1.6, 3); c.fillRect(6 + i * 3.5, 9, 1.6, 3); } c.fillStyle = '#ffd040'; c.beginPath(); c.ellipse(-10, 14, 5, 3, 0, 0, TAU); c.ellipse(12, -12, 5, 3, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.font = 'bold 6px serif'; c.textAlign = 'center'; c.fillText('上', -10, 16); c.fillText('伍', 12, -10); c.restore(); });
    const head = part(new T3.SphereGeometry(0.2, 18, 14), toon(0xffffff, { map: face }), 0.04, par, [0, 0.25, 0]);
    const arms = [];
    for (const s of [-1, 1]) { const a = joint(segs[1], s * 0.08, 0.05, 0); part(new T3.CapsuleGeometry(0.035, 0.35, 4, 8), bodyM, 0.06, a, [0, 0.2, 0]); arms.push([a, s]); }
    optimize(S.root, S.anchors);
    return Object.assign(S, { height: 1.9, custom: 1, tick(t) { segs.forEach((s, k) => { s.rotation.z = Math.sin(t * 0.06 + k) * 0.18; s.rotation.x = Math.cos(t * 0.05 + k) * 0.08; }); for (const [a, s] of arms) a.rotation.z = s * (-1.2 + Math.sin(t * 0.1) * 0.25); } });
  }
  function buildDummy() {
    const S = shell(), { toon, part, joint, turn } = S;
    const wob = joint(turn, 0, 0, 0);
    part(new T3.CylinderGeometry(0.07, 0.07, 1.9, 10), toon('#6a4a2a'), 0.05, wob, [0, 0.95, 0]);
    part(new T3.BoxGeometry(0.68, 0.12, 0.68), toon('#6a4a2a'), 0.04, turn, [0, 0.06, 0]);
    const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(new T3.Vector2(0.26 + Math.sin(u * Math.PI) * 0.06, 0.4 + u * 1.3)); }
    const straw = canvasTex(128, 128, (c) => { c.fillStyle = '#d8b868'; c.fillRect(0, 0, 128, 128); c.strokeStyle = 'rgba(110,80,30,.5)'; c.lineWidth = 2; for (let x = 0; x < 128; x += 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 3, 128); c.stroke(); } });
    part(new T3.LatheGeometry(pts, 20), toon(0xffffff, { map: straw }), 0.03, wob);
    for (const y of [0.6, 1.1, 1.5]) part(new T3.TorusGeometry(0.31, 0.04, 6, 20), toon('#5a3a1a'), 0.05, wob, [0, y, 0], [Math.PI / 2, 0, 0]);
    const tal = canvasTex(64, 96, (c) => { c.fillStyle = '#f4ecd8'; c.fillRect(0, 0, 64, 96); c.fillStyle = '#b01828'; c.font = 'bold 48px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('鬼', 32, 50); });
    part(new T3.PlaneGeometry(0.24, 0.3), toon(0xffffff, { map: tal }), 0, wob, [0, 1.32, 0.33]);
    optimize(S.root, S.anchors);
    return Object.assign(S, { height: 1.8, custom: 2, wob, tick(t, a) { wob.rotation.z = a.hurt ? Math.sin(t * 1.3) * 0.08 : 0; } });
  }
  const CUSTOM = { hand: buildHand, gyokko: buildGyokko, dummy: buildDummy };

  // ---------------- material state: hit flash / fade ----------------
  function setFx(M, flash, alpha) {
    const fk = flash ? 1 : 0, ak = Math.round(alpha * 50) / 50;
    if (M._fk === fk && M._ak === ak) return;
    M._fk = fk; M._ak = ak; M.U.value = fk ? 4 : 0.86;
    for (const m of M.mats) {
      if (m.emissive) { if (!m.userData.e0) m.userData.e0 = m.emissive.clone(); m.emissive.copy(fk ? col(0xffffff) : m.userData.e0); }
      m.transparent = ak < 0.99; m.opacity = ak; m.depthWrite = ak > 0.5;
    }
  }

  // ---------------- pose driver (same pose data as the 2D rig) ----------------
  const vA = new T3.Vector3(), down = new T3.Vector3(0, -1, 0), wp = new T3.Vector3();
  function pose(M, a, dt) {
    const p = a.pose || {}, t = p.t || 0;
    const s = (a.scale || 1) * 1.62 / M.height * (M.size || 1);
    M.root.position.set((a.x - 640) * 0.01, (GY - a.y) * 0.01, a.z || 0);
    // facing = a real 3D turn (not a mirror), so kanji/asymmetric outfits stay correct; eased for a quick pivot
    M.root.scale.set(s, s, s);
    const tgt = M.custom === 2 ? 0.3 : a.yaw !== undefined ? a.yaw : (a.face < 0 ? -0.62 : 0.62);
    if (M.turnA === undefined) M.turnA = tgt;
    else { let d = tgt - M.turnA; d = Math.atan2(Math.sin(d), Math.cos(d)); M.turnA += d * Math.min(1, dt * 16); } // shortest-arc turn
    M.turn.rotation.y = M.turnA;
    setFx(M, a.flash, a.alpha === undefined ? 1 : a.alpha);
    if (M.custom) { M.tick(t, p); return; }
    const J = M.J;
    if (p.spin) { M.spin.position.set(0, 0.85, 0); M.spin.children[0].position.set(0, -0.85, 0); M.spin.rotation.x = p.spin; }
    else { M.spin.position.set(0, 0, 0); M.spin.children[0].position.set(0, 0, 0); M.spin.rotation.x = 0; }
    const [tf, bf] = legPose(p, false), [tb, bb] = legPose(p, true);
    J.upLegR.rotation.set(-tf, 0, 0); J.loLegR.rotation.set(bf, 0, 0);
    J.upLegL.rotation.set(-tb, 0, 0); J.loLegL.rotation.set(bb, 0, 0);
    const bob = p.run ? -Math.abs(Math.sin(p.run)) * 0.03 : Math.sin(t * 0.07) * 0.006;
    const footY = (th, b) => 0.62 - 0.3 * Math.cos(th) - 0.33 * Math.cos(th - b);
    const minFoot = Math.min(footY(tf, bf), footY(tb, bb));
    J.hips.position.y = 0.62 - (p.air ? 0 : Math.max(0, minFoot)) + bob - (p.crouch || 0) * 0.08;
    const ang = p.swing !== undefined ? p.swing : 0.95 - Math.sin(p.run || 0) * 0.6;
    const ang2 = p.arm2 !== undefined ? p.arm2 : (p.swing !== undefined ? p.swing + 0.5 : 0.9 + Math.sin(p.run || 0) * 0.6);
    vA.set(-0.3, -Math.sin(ang), Math.cos(ang)).normalize(); J.upArmR.quaternion.setFromUnitVectors(down, vA);
    J.loArmR.rotation.set(-0.35, 0, 0);
    vA.set(0.3, -Math.sin(ang2), Math.cos(ang2)).normalize(); J.upArmL.quaternion.setFromUnitVectors(down, vA);
    J.loArmL.rotation.set(-0.45, 0, 0);
    if (J.sword) J.sword.rotation.set(0.15, 0, 0);
    if (J.sword2) J.sword2.rotation.set(0.15, 0, 0);
    const lean = p.lean || 0;
    J.spine.rotation.set((p.run ? 0.22 : 0.04) + (p.shout ? 0.1 : 0) + lean * 0.25, 0, 0);
    J.head.rotation.set(-(p.run ? 0.12 : 0) - lean * 0.15, a.yaw !== undefined ? 0 : -0.28 * Math.sign(M.turnA || 1), 0);
    // cloth + hair motion
    const fl = (p.run ? 0.25 : 0) + (p.air ? 0.35 : 0) + Math.sin(t * 0.15) * 0.03;
    if (J.haori) { J.haori.rotation.x = -fl * 0.6; J.haori.scale.z = 0.8 + fl * 0.4; }
    if (J.skirt) J.skirt.rotation.x = -fl * 0.3;
    const sway = Math.sin(t * 0.06) * 0.05 + (p.run ? 0.3 : 0) + (p.air ? 0.45 : 0);
    if (J.hairBack) J.hairBack.rotation.x = sway * 0.5;
    if (J.tail) J.tail.rotation.x = sway * 0.8 + 0.1;
    for (const k in J) if (k.startsWith('braid')) J[k].rotation.x = sway * 0.7;
    for (const k of ['earR', 'earL']) if (J[k]) J[k].rotation.z = Math.sin(t * 0.1) * 0.15;
    if (J.whip) J.whip.forEach((sg, i) => { if (i) sg.rotation.set(Math.sin(i * 0.7 + t * 0.3) * 0.18, 0, Math.cos(i * 0.5 + t * 0.2) * 0.12); });
    if (J.flail) { // ball hangs below the front hand, swinging; chain stretched between
      M.root.updateMatrixWorld(true);
      J.handR.getWorldPosition(wp); M.root.worldToLocal(wp);
      const bx = wp.x + Math.sin(t * 0.05) * 0.06, by = Math.max(0.1, wp.y - 0.4), bz = wp.z + 0.05;
      J.flail.position.set(bx, by, bz);
      const dx = bx - wp.x, dy = by - wp.y, dz = bz - wp.z, len = Math.hypot(dx, dy, dz);
      J.chain.position.set((bx + wp.x) / 2, (by + wp.y) / 2, (bz + wp.z) / 2); J.chain.scale.set(1, len, 1);
      J.chain.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(dx / len, dy / len, dz / len));
    }
    for (const f of M.extras) f(t);
    // expression
    M.blink = ((M.blink || 0) + dt) % 3.6;
    M.setExpr(p.hurt ? 'hurt' : p.shout ? 'shout' : (p.sleep || M.blink > 3.45) ? 'blink' : 'normal');
  }

  // a = actor { key, lk (demon look key), look, ch, boss }
  function make(a) {
    const lk = a.lk;
    if (lk && CUSTOM[lk]) return CUSTOM[lk]();
    if (!a.look || typeof a.look !== 'object') return null;
    const ch = a.boss ? null : (a.ch || (typeof CHARS !== 'undefined' && CHARS[a.key]));
    return build(a.look, ch, { look: lk, size: lk === 'icechild' ? 0.78 : 1 });
  }
  return { make, pose, build };
})();
