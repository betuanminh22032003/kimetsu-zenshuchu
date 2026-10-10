// ============================================================
//  WORLD RENDER — hazards, projectiles, fx, player sprite
// ============================================================
'use strict';

function drawHazards() {
  const in3d = R3D.ok; // active attacks are real 3D objects; overlay keeps only telegraphs + text
  for (const h of G.haz) {
    const tele = h.delay > 0, blink = (G.t % 8) < 4;
    if (in3d && !tele && h.type !== 'cage') { if (h.type === 'shock') particles('mist', h.x, GY - 10, 1, 3, { k: 'rock', g: 0.3 }); continue; }
    ctx.save();
    switch (h.type) {
      case 'line': {
        const st = h.style;
        const col = { thread: '#f4f4ff', moon: '#d0b0ff', whip: '#c01030', obi: '#ff4c8a', claw: '#d09050', arrow: '#ff3030', bolt: '#fff070', frost: '#bfe8ff', storm: '#8fd8ff' }[st] || '#ff4040';
        if (tele) { ctx.globalAlpha = blink ? 0.6 : 0.25; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke(); ctx.setLineDash([]); break; }
        const a = 1 - h.t / h.life;
        ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
        if (st === 'bolt') { drawLightning(ctx, h.x1, h.y1, h.x2, h.y2, col, 5, 18); break; }
        ctx.strokeStyle = col; ctx.lineWidth = h.w * (st === 'thread' ? 0.3 : 1); ctx.lineCap = 'round';
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke();
        ctx.lineWidth = Math.max(2, h.w * 0.25); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(h.x1, h.y1); ctx.lineTo(h.x2, h.y2); ctx.stroke();
        ctx.shadowBlur = 0;
        if (st === 'moon') { // little crescents scattered along the cut
          const ang = Math.atan2(h.y2 - h.y1, h.x2 - h.x1);
          for (let i = 0; i < 18; i++) { const u = (i * 0.618 + h.x1 * 0.001) % 1; const x = lerp(h.x1, h.x2, u), y = lerp(h.y1, h.y2, u); if (x < 0 || x > W || y < 0 || y > H) continue; ctx.strokeStyle = '#f4e8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + Math.cos(ang + 1.6) * 20 * Math.sin(i), y + Math.sin(ang + 1.6) * 20 * Math.sin(i), 10 + (i % 3) * 5, i, i + 2.4); ctx.stroke(); }
        }
        if (st === 'arrow') { const ang = Math.atan2(h.y2 - h.y1, h.x2 - h.x1); for (let i = 1; i < 12; i++) { const x = lerp(h.x1, h.x2, i / 12), y = lerp(h.y1, h.y2, i / 12); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * 14, y + Math.sin(ang) * 14); ctx.lineTo(x + Math.cos(ang + 2.5) * 12, y + Math.sin(ang + 2.5) * 12); ctx.lineTo(x + Math.cos(ang - 2.5) * 12, y + Math.sin(ang - 2.5) * 12); ctx.fill(); } }
        break;
      }
      case 'circle': {
        const col = h.a.ice ? '#cfefff' : h.a.moon ? '#d0b0ff' : h.a.water ? '#60b0ff' : h.a.blood ? '#ff2040' : h.a.self ? '#7ad0ff' : '#ff4040';
        if (tele) {
          const p = 1 - h.delay / h.a.tele;
          ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.follow ? h.follow.x : h.x, h.y, h.r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(h.follow ? h.follow.x : h.x, h.y, h.r * p, 0, TAU); ctx.fill();
        } else {
          const a = 1 - h.t / h.life; ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r); g.addColorStop(0, '#fff'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * (1 + (1 - a) * 0.2), 0, TAU); ctx.fill();
          if (h.a.self && !h.a.moon && !h.a.blood) { ctx.strokeStyle = '#bff'; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(an) * h.r, h.y + Math.sin(an) * h.r); ctx.stroke(); } }
        }
        break;
      }
      case 'arm': {
        if (tele) { ctx.globalAlpha = blink ? 0.7 : 0.3; ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.ellipse(h.x, GY + 2, h.w / 2 + 6, 8, 0, 0, TAU); ctx.fill(); break; }
        const ht = h.h * Math.min(1, h.t / 6) * (h.t > h.life - 8 ? (h.life - h.t) / 8 : 1);
        const a = h.a;
        const col = a.dragon ? '#7a5a3a' : a.flesh ? '#c890a8' : a.thorn ? '#3a0a14' : '#6d8a48';
        ctx.fillStyle = col; ctx.strokeStyle = shade(col, -30); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(h.x - h.w / 2, GY); ctx.quadraticCurveTo(h.x - h.w / 2 + Math.sin(h.t * 0.3) * 6, GY - ht / 2, h.x - h.w / 4, GY - ht); ctx.lineTo(h.x + h.w / 4, GY - ht); ctx.quadraticCurveTo(h.x + h.w / 2, GY - ht / 2, h.x + h.w / 2, GY); ctx.fill(); ctx.stroke();
        if (a.dragon) { ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.ellipse(h.x + 10, GY - ht, 34, 22, -0.3, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(h.x + 22, GY - ht - 8, 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) ctx.fillRect(h.x + 18 + i * 5, GY - ht + 8, 3, 6); }
        else if (a.thorn) { ctx.fillStyle = '#8a0a20'; for (let i = 0; i < 6; i++) { const y = GY - ht * i / 6; ctx.beginPath(); ctx.moveTo(h.x - h.w / 3, y); ctx.lineTo(h.x - h.w, y - 10); ctx.lineTo(h.x - h.w / 3, y - 16); ctx.fill(); ctx.beginPath(); ctx.moveTo(h.x + h.w / 3, y - 8); ctx.lineTo(h.x + h.w, y - 18); ctx.lineTo(h.x + h.w / 3, y - 24); ctx.fill(); } }
        else { ctx.fillStyle = shade(col, 15); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(h.x - 18 + i * 9, GY - ht - 8, 4, 14, (i - 2) * 0.2, 0, TAU); ctx.fill(); } if (a.flesh) { ctx.fillStyle = '#802040'; ctx.beginPath(); ctx.ellipse(h.x, GY - ht + 20, 10, 5, 0, 0, TAU); ctx.fill(); } }
        break;
      }
      case 'rainmark': if (tele) { ctx.globalAlpha = blink ? 0.8 : 0.3; ctx.strokeStyle = '#ff6060'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, GY + 2, 30, 7, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(h.x, GY - 30); ctx.lineTo(h.x, GY - 6); ctx.stroke(); } break;
      case 'cage': {
        if (in3d && !tele) break;
        const r = tele ? h.r : 80;
        ctx.globalAlpha = tele ? 0.75 : 1 - h.t / h.life; ctx.strokeStyle = '#f4f4ff'; ctx.lineWidth = tele ? 1.5 : 4; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r); ctx.lineTo(h.x + Math.cos(a) * (r + 900), h.y + Math.sin(a) * (r + 900)); ctx.stroke(); }
        for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU; ctx.lineTo(h.x + Math.cos(a) * (r + k * 50), h.y + Math.sin(a) * (r + k * 50)); } ctx.stroke(); }
        ctx.shadowBlur = 0;
        if (tele) txt('刻糸牢', h.x, h.y - r - 16, 22, '#fff', 'center', JPF, 4);
        break;
      }
      case 'sweep': {
        if (tele) { ctx.globalAlpha = blink ? 0.45 : 0.15; ctx.fillStyle = '#ff2020'; ctx.fillRect(0, GY - 70, W, 70); txt('▲ 跳べ！ NHẢY!', W / 2, GY - 80, 22, '#fff', 'center', JPF, 4); break; }
        const a = 1 - h.t / h.life; ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
        const col = h.a.whip ? '#c01030' : '#c8a0ff';
        const x0 = h.dir > 0 ? h.src : h.src - W * 1.5, prog = Math.min(1, h.t / 6);
        ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(h.src + h.dir * W * 0.75 * prog, GY - 36, W * 0.75 * prog + 40, 34, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(h.src + h.dir * W * 0.75 * prog, GY - 36, W * 0.75 * prog + 20, 8, 0, 0, TAU); ctx.fill();
        if (!h.a.whip) for (let i = 0; i < 14; i++) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(rnd(0, W), GY - rnd(20, 120), rnd(10, 30), 0.3, 2.6); ctx.stroke(); }
        break;
      }
      case 'shock': {
        if (tele) break;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, GY - 70, 0, GY); g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(1, 'rgba(160,220,255,.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(h.x - 30, GY); ctx.quadraticCurveTo(h.x, GY - 90, h.x + 30, GY); ctx.fill();
        particles('mist', h.x, GY - 10, 1, 3, { k: 'rock', g: 0.3 });
        break;
      }
    }
    ctx.restore();
  }
}
function drawEProj(p) {
  if (p.delay > 0 || R3D.ok) return;
  ctx.save(); ctx.translate(p.x, p.y);
  const ang = Math.atan2(p.vy, p.vx);
  switch (p.shape) {
    case 'temari': drawTemari(ctx, 0, 0, p.r, Math.floor(p.r)); break;
    case 'fist': ctx.globalCompositeOperation = 'lighter'; ctx.rotate(ang); { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.4); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#7ad0ff'); g.addColorStop(1, 'rgba(60,120,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-p.r * 0.6, 0, p.r * 1.8, p.r, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.8, -1.2, 1.2); ctx.stroke(); } break;
    case 'crescent': ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#c8a0ff'; ctx.beginPath(); ctx.arc(0, 0, p.r, -1.3, 1.3); ctx.arc(-p.r * 0.35, 0, p.r * 0.85, 1.2, -1.2, true); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r, -1.3, 1.3); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(rnd(-p.r, p.r * 0.5), rnd(-p.r, p.r), 8, 0.4, 2.6); ctx.stroke(); } break;
    case 'sickle': ctx.rotate(p.t * 0.4); ctx.strokeStyle = '#ff2040'; ctx.lineWidth = 6; ctx.shadowColor = '#f00'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 1.3); ctx.stroke(); break;
    case 'obi': ctx.rotate(ang); ctx.fillStyle = '#c03060'; ctx.fillRect(-p.r * 1.5, -8, p.r * 3, 16); ctx.fillStyle = '#ffd040'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * p.r * 0.6 - 3, -8, 6, 16); break;
    case 'needle': ctx.rotate(ang); ctx.strokeStyle = '#ffe'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(12, 0); ctx.stroke(); break;
    case 'thread': ctx.rotate(ang); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(10, 0); ctx.stroke(); break;
    case 'fish': ctx.rotate(ang); ctx.fillStyle = '#e8b0c0'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-24, -8); ctx.lineTo(-24, 8); ctx.fill(); ctx.fillStyle = '#300'; ctx.beginPath(); ctx.arc(8, -2, 2, 0, TAU); ctx.fill(); break;
    case 'lotus': ctx.rotate(p.t * 0.1); ctx.fillStyle = 'rgba(210,240,255,.9)'; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.ellipse(0, -12, 6, 14, 0, 0, TAU); ctx.fill(); } break;
    case 'icicle': ctx.rotate(ang - Math.PI / 2); ctx.fillStyle = '#dff4ff'; ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(10, -30); ctx.lineTo(0, 24); ctx.fill(); break;
    case 'moonbeam': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,170,255,.7)'; ctx.fillRect(-p.r, -400, p.r * 2, 420); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(rnd(-20, 20), rnd(-300, 0), 14, 0.4, 2.6); ctx.stroke(); } break;
    case 'mouth': ctx.fillStyle = '#c090d0'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#601040'; ctx.beginPath(); ctx.ellipse(0, 2, p.r * 0.6, 3 + Math.abs(Math.sin(p.t * 0.3)) * 5, 0, 0, TAU); ctx.fill(); break;
    case 'sleep': ctx.globalCompositeOperation = 'lighter'; { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.6); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#c080ff'); g.addColorStop(1, 'rgba(120,40,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r * 1.6, 0, TAU); ctx.fill(); } txt('眠', 0, 7, 18, '#fff', 'center', JPF); break;
    case 'wind': ctx.rotate(p.t * 0.3); ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, p.r - i * 7, i, i + 3.5); ctx.stroke(); } break;
    case 'hand': ctx.fillStyle = '#7d9a58'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(Math.cos(ang - 0.8 + i * 0.5) * p.r, Math.sin(ang - 0.8 + i * 0.5) * p.r, 4, 10, ang - 0.8 + i * 0.5 + Math.PI / 2, 0, TAU); ctx.fill(); } break;
    default: ctx.fillStyle = p.color || '#f44'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawPProj(p) {
  const th = THEMES[p.theme] || THEMES.normal;
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.k === 'flail' || p.k === 'meteor') {
    if (p.k === 'flail') { ctx.restore(); ctx.save(); ctx.strokeStyle = '#999'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(p.P.x + p.P.face * 20, p.P.y - 85); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]); ctx.translate(p.x, p.y); }
    const r = p.k === 'meteor' ? 46 : 22;
    ctx.rotate(p.t * 0.3); ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#999';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.2) * r, Math.sin(a - 0.2) * r); ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); ctx.lineTo(Math.cos(a + 0.2) * r, Math.sin(a + 0.2) * r); ctx.fill(); }
    if (p.k === 'meteor') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,120,.35)'; ctx.fillRect(-r, -300, r * 2, 300); }
  } else if (p.k === 'axe') {
    ctx.rotate(p.t * 0.5); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(60, -50, 70, 0); ctx.quadraticCurveTo(60, 50, 0, 10); ctx.fill(); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-60, -6, 64, 12);
  } else if (p.k === 'blade') {
    ctx.rotate(p.t * 0.6); for (let i = 0; i < 2; i++) { ctx.rotate(Math.PI); ctx.fillStyle = '#aab'; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(40, -2); ctx.lineTo(44, 4); ctx.lineTo(0, 3); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = th.l; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.stroke();
  } else if (p.k === 'tiger') {
    ctx.scale(p.face, 1); ctx.globalCompositeOperation = 'lighter';
    const R = p.r;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ff9a20'); g.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-R * 0.4, 0, R * 1.5, R, 0, 0, TAU); ctx.fill();
    // tiger head silhouette
    ctx.fillStyle = '#ff7a10'; ctx.beginPath(); ctx.moveTo(R * 0.9, 0); ctx.lineTo(R * 0.3, -R * 0.7); ctx.lineTo(R * 0.1, -R * 0.95); ctx.lineTo(-R * 0.1, -R * 0.6); ctx.lineTo(-R * 0.6, -R * 0.5); ctx.lineTo(-R * 0.3, 0); ctx.lineTo(-R * 0.6, R * 0.5); ctx.lineTo(R * 0.3, R * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(R * 0.4, -R * 0.3, R * 0.14, R * 0.06, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4b0'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(R * (0.5 + i * 0.12), R * 0.1); ctx.lineTo(R * (0.55 + i * 0.12), R * 0.35); ctx.lineTo(R * (0.6 + i * 0.12), R * 0.1); ctx.fill(); }
    ctx.strokeStyle = '#a01000'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-R * 0.1 + i * 20, -R * 0.55); ctx.lineTo(-R * 0.2 + i * 20, -R * 0.2); ctx.stroke(); }
  } else if (p.k === 'claws') {
    ctx.scale(p.face, 1); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? th.l : th.m; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(-40, -60 + i * 34, 70, -0.7, 0.7); ctx.stroke(); }
  } else { // crescent
    ctx.scale(p.face, 1); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = th.m; ctx.beginPath(); ctx.arc(0, 0, p.r, -1.3, 1.3); ctx.arc(-p.r * 0.4, 0, p.r * 0.9, 1.2, -1.2, true); ctx.fill();
    ctx.strokeStyle = th.l; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, p.r, -1.3, 1.3); ctx.stroke();
  }
  ctx.restore();
}
function drawFx(e) {
  switch (e.type) {
    case 'slash': drawSlash(ctx, e); break;
    case 'ring': {
      const th = THEMES[e.theme] || THEMES.normal, u = e.t / e.life;
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = th.l; ctx.lineWidth = e.w * (1 - u) + 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (0.3 + u * 0.8), e.r * (0.3 + u * 0.8) * e.sq, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = th.m; ctx.lineWidth = (e.w * (1 - u) + 1) * 2.2; ctx.globalAlpha = (1 - u) * 0.4; ctx.stroke(); ctx.restore(); break;
    }
    case 'streak': {
      const th = THEMES[e.theme] || THEMES.normal, a = 1 - e.t / e.life;
      ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = th.m; ctx.lineWidth = e.w * a; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      ctx.strokeStyle = th.l; ctx.lineWidth = e.w * a * 0.35; ctx.stroke(); ctx.restore(); break;
    }
    case 'thrust': {
      const th = THEMES[e.theme] || THEMES.normal, a = 1 - e.t / e.life, ext = Math.min(1, e.t / 3);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      const L = e.len * ext;
      const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, th.m); g.addColorStop(1, th.l);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -e.w); ctx.lineTo(L, 0); ctx.lineTo(0, e.w); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(L * 0.3, -2); ctx.lineTo(L + 10, 0); ctx.lineTo(L * 0.3, 2); ctx.fill();
      ctx.restore(); break;
    }
    case 'bolt': drawLightning(ctx, e.x1, e.y1, e.x2, e.y2, `rgba(255,240,120,${1 - e.t / e.life})`, 3, 14); break;
    case 'flashline': {
      const th = THEMES[e.theme] || THEMES.normal, a = 1 - e.t / e.life;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      const x1 = Math.min(e.x1, e.x2) - 60, x2 = Math.max(e.x1, e.x2) + 60;
      const g = ctx.createLinearGradient(0, e.y - e.w, 0, e.y + e.w); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, th.l); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x1, e.y - e.w * a, x2 - x1, e.w * 2 * a);
      ctx.fillStyle = '#fff'; ctx.fillRect(x1, e.y - 2, x2 - x1, 4); ctx.restore(); break;
    }
    case 'dragon': drawDragon(ctx, e.pts, e.theme, Math.min(1, (e.life - e.t) / 20), e.w, e.snake ? 'snake' : 'dragon'); break;
    case 'whip': {
      if (!e.pts) break; const th = THEMES[e.theme] || THEMES.normal;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - e.t / e.life; ctx.lineCap = 'round';
      for (const [col, w] of [[th.m, 10], [th.l, 3]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); e.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'chain': ctx.save(); ctx.strokeStyle = '#aaa'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(e.P.x, e.P.y - 85); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); break;
    case 'compass': {
      const b = e.b; if (b.dead) break; ctx.save(); ctx.translate(b.x, GY); ctx.scale(1, 0.25); ctx.globalAlpha = 0.7 * Math.min(1, (e.life - e.t) / 30); ctx.strokeStyle = '#7ad0ff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + e.t * 0.01; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * 130, Math.sin(a) * 130); ctx.stroke(); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 100, Math.sin(a) * 100); ctx.lineTo(Math.cos(a + 0.15) * 80, Math.sin(a + 0.15) * 80); ctx.lineTo(Math.cos(a - 0.15) * 80, Math.sin(a - 0.15) * 80); ctx.closePath(); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'sleepaura': { const b = e.b; ctx.save(); ctx.strokeStyle = '#c080ff'; ctx.globalAlpha = 0.6; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(b.x, b.y - 100, ((e.t * 3 + i * 40) % 120) + 20, 0, TAU); ctx.stroke(); } ctx.restore(); break; }
    case 'bghost': { ctx.save(); ctx.globalAlpha = 0.25 * (1 - e.t / e.life); drawBoss(ctx, Object.assign({}, e.b, { x: e.x, face: e.face, flash: 0, small: null }), G); ctx.restore(); break; }
  }
}
function playerPose(P) { return { t: G.t, run: P.walk, air: !P.ground, swing: P.swing, spin: P.spin, hurt: P.hurtT > 0, sleep: P.sleep > 0 || (P.ch.look.sleepy && P.cast), shadowY: GY - P.y, shout: !!(P.cast && P.cast.kind !== 'normal'), attack: !!P.cast }; }
function playerAlpha(P) { let a = 1; if (P.buffs.invis) a = 0.22; if (P.inv > 0 && !P.cast && G.t % 6 < 3) a *= 0.5; return a; }
function drawPlayerChar(P, noBody) {
  if (!noBody) for (const g of P.ghosts) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    drawPerson(ctx, P.look, P.ch, g.x, g.y, g.face, { t: G.t, swing: g.swing, spin: g.spin, air: g.y < GY }, (g.life / 18) * 0.35, P.scale);
    ctx.restore();
  }
  let alpha = 1;
  if (P.buffs.invis) alpha = 0.22;
  if (P.inv > 0 && !P.cast && G.t % 6 < 3) alpha *= 0.5;
  if (P.buffs.guard) { ctx.save(); ctx.strokeStyle = '#aaa'; ctx.lineWidth = 4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.ellipse(P.x, P.y - 75, 90, 60, 0, G.t * 0.2, G.t * 0.2 + TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(P.x + Math.cos(G.t * 0.2) * 90, P.y - 75 + Math.sin(G.t * 0.2) * 60, 14, 0, TAU); ctx.fill(); ctx.restore(); }
  if (P.buffs.nagi) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(P.x, P.y - 2, 60 + ((G.t + i * 20) % 60) * 2, 12 + ((G.t + i * 20) % 60) * 0.4, 0, 0, TAU); ctx.stroke(); } ctx.restore(); }
  if (P.zen) { ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(G.t * 0.2) * 0.15; ctx.strokeStyle = THEMES[curStyle(P).theme].l; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y - 75, 50, 90, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  const pose = { t: G.t, run: P.walk, air: !P.ground, swing: P.swing, spin: P.spin, hurt: P.hurtT > 0, sleep: P.sleep > 0 || (P.ch.look.sleepy && P.cast), shadowY: GY - P.y, shout: !!(P.cast && P.cast.kind !== 'normal'), attack: !!P.cast };
  if (!noBody) drawPerson(ctx, P.look, P.ch, P.x, P.y, P.face, pose, alpha, P.scale);
  if (P.sleep > 0) txt('Zzz', P.x + 20, P.y - 170 - Math.sin(G.t * 0.1) * 5, 20, '#c8a0ff', 'center', UIF, 3);
  if (P.poison > 0 && G.t % 10 === 0) G.parts.push({ x: P.x + rnd(-15, 15), y: P.y - rnd(30, 130), vx: 0, vy: -1, life: 25, max: 25, s: 3, c: '#80ff60', k: 'drop', g: 0 });
}
