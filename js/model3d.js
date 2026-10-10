// ============================================================
//  MODEL3D — procedural anime 3D characters (Nendoroid-style chibi):
//  articulated rigid parts, toon shading, inked outlines (inverted hull),
//  painted anime face texture with expressions. Used by R3D when no VRM.
// ============================================================
'use strict';

const CHIBI3D = (() => {
  if (!window.THREE) return {};
  const T3 = THREE, INK = 0x1d1422;
  let gradTex = null, softGrad = null;
  function skinGrad() {
    if (softGrad) return softGrad;
    const d = new Uint8Array([175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
    softGrad = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); softGrad.minFilter = softGrad.magFilter = T3.NearestFilter; softGrad.needsUpdate = true;
    return softGrad;
  }
  // anime head: sphere with tapered jaw + pointed chin, slightly flattened front
  function headGeo(r) {
    const g = new T3.SphereGeometry(r, 56, 40), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) { const t = -y / r; x *= 1 - 0.32 * t * t; const front = Math.max(0, z / r); z *= 1 - 0.18 * t * t * (1 - front * 0.4); y -= 0.05 * r * t * t * front; }
      z *= 0.92;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }
  function toonGrad() {
    if (gradTex) return gradTex;
    const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    gradTex = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); gradTex.minFilter = gradTex.magFilter = T3.NearestFilter; gradTex.needsUpdate = true;
    return gradTex;
  }
  const toon = (color, extra) => new T3.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad() }, extra || {}));
  const inkMat = new T3.MeshBasicMaterial({ color: INK, side: T3.BackSide });
  // mesh + inverted-hull outline
  function part(geo, mat, ink, parent, pos, rot) {
    const g = new T3.Group();
    const m = new T3.Mesh(geo, mat); m.castShadow = true; g.add(m);
    if (ink !== 0) { const o = new T3.Mesh(geo, inkMat); o.scale.setScalar(1 + (ink || 0.06)); g.add(o); }
    if (pos) g.position.set(...pos); if (rot) g.rotation.set(...rot);
    if (parent) parent.add(g);
    return g;
  }
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  const joint = (parent, x, y, z) => { const j = new T3.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  // ---------------- anime face painted on the head sphere ----------------
  // sphere UV: u=0.25 is the front (+Z); 1 degree = 1.42px horizontally, 2.84px vertically on a 512x512 map
  function faceTexture(L, expr) {
    return canvasTex(512, 512, (c) => {
      c.fillStyle = L.hair; c.fillRect(0, 0, 512, 512);
      c.fillStyle = L.skin; c.beginPath(); c.ellipse(128, 300, 118, 230, 0, 0, TAU); c.fill(); c.fillRect(0, 430, 512, 82);
      c.save(); c.translate(128, 256); c.scale(1.42, 2.84);
      // cheek blush + soft shading at the sides
      const sh = c.createRadialGradient(0, 4, 10, 0, 4, 60); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(120,60,50,.18)'); c.fillStyle = sh; c.fillRect(-90, -60, 180, 120);
      c.fillStyle = 'rgba(255,120,130,.22)'; c.beginPath(); c.ellipse(-19, 19, 6, 2.4, 0, 0, TAU); c.ellipse(19, 19, 6, 2.4, 0, 0, TAU); c.fill();
      // forehead scar (Tanjiro)
      if (L.scar) { c.fillStyle = 'rgba(150,30,30,.85)'; c.beginPath(); c.moveTo(4, -21); c.quadraticCurveTo(14, -24, 20, -16); c.quadraticCurveTo(12, -13, 6, -15); c.closePath(); c.fill(); }
      const ec = L.eye || '#9a2a2a';
      if (expr === 'hurt') { c.strokeStyle = '#1d1422'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 22, 0); c.lineTo(s * 8, 4); c.lineTo(s * 22, 8); c.stroke(); } }
      else if (expr === 'blink') { c.strokeStyle = '#1d1422'; c.lineWidth = 1.6; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 14, 2, 8, 0.3, Math.PI - 0.3); c.stroke(); } }
      else {
        animeEye(c, -16, 6, 12, 14, ec, { far: 1, sharp: expr === 'shout' ? 1 : 0 });
        c.save(); c.scale(-1, 1); animeEye(c, -16, 6, 12, 14, ec, { far: 1, sharp: expr === 'shout' ? 1 : 0 }); c.restore();
      }
      // brows
      c.strokeStyle = '#3a1414'; c.lineWidth = 1.4; c.lineCap = 'round';
      const ang = expr === 'shout' || expr === 'hurt' ? 3 : 0;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 7, -11 + ang); c.quadraticCurveTo(s * 16, -14.5, s * 27, -12 - ang * 0.5); c.stroke(); }
      // nose + mouth
      c.strokeStyle = 'rgba(120,60,50,.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 16); c.lineTo(-0.8, 19); c.stroke();
      if (L.muzzle) { c.fillStyle = '#7aa848'; c.fillRect(-14, 22, 28, 5); c.strokeStyle = '#3a5a1a'; c.strokeRect(-14, 22, 28, 5); }
      else if (expr === 'shout') { c.fillStyle = '#5a1822'; c.beginPath(); c.moveTo(-6, 24); c.quadraticCurveTo(0, 22, 6, 24); c.quadraticCurveTo(0, 33, -6, 24); c.fill(); c.fillStyle = '#e06a7a'; c.beginPath(); c.ellipse(0, 28.5, 3, 1.5, 0, 0, TAU); c.fill(); }
      else { c.strokeStyle = '#6a2a30'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, 25); c.quadraticCurveTo(0, 26.3, 3, 25); c.stroke(); }
      c.restore();
    });
  }
  function hanafudaTex() {
    return canvasTex(64, 128, (c) => { c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#d4202a'; c.beginPath(); c.arc(32, 52, 22, 0, TAU); c.fill(); c.fillStyle = '#2a2a2a'; for (let i = 0; i < 4; i++) c.fillRect(0, 86 + i * 9, 64, 4); c.strokeStyle = '#1d1422'; c.lineWidth = 4; c.strokeRect(0, 0, 64, 128); });
  }

  // ---------------- hair: spiky locks with root->tip color gradient ----------------
  function lockGeo(len, rad, curl) {
    const g = new T3.ConeGeometry(rad, len, 6, 4); g.translate(0, len / 2, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), u = y / len; pos.setZ(i, pos.getZ(i) - curl * u * u * len); }
    g.computeVertexNormals();
    return g;
  }
  function hairLocks(parent, L, list, matRoot) {
    const tipCol = new T3.Color(L.hairTip || L.hair), rootCol = new T3.Color(L.hair);
    for (const [dx, dy, dz, len, rad, curl] of list) {
      const geo = lockGeo(len, rad, curl || 0);
      const cols = []; const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const u = pos.getY(i) / len; const c = rootCol.clone().lerp(tipCol, Math.pow(u, 1.6)); cols.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new T3.Float32BufferAttribute(cols, 3));
      const dir = new T3.Vector3(dx, dy, dz).normalize();
      const g = part(geo, matRoot, 0.09, parent);
      g.position.copy(dir.clone().multiplyScalar(0.26));
      g.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), dir);
    }
  }

  // ---------------- character definitions ----------------
  // hair lock: [dirX, dirY, dirZ, length, radius, curl]   (+Z = face, +Y = up, -X = character's right)
  const TANJIRO_HAIR = [
    // crown & back: short swept spikes (shorter, chunkier, swept back/down)
    [0, 1, -0.35, 0.15, 0.1, 0.08], [0.4, 0.85, -0.4, 0.14, 0.095, 0.08], [-0.4, 0.85, -0.4, 0.14, 0.095, 0.08],
    [0.62, 0.5, -0.6, 0.15, 0.09, 0.06], [-0.62, 0.5, -0.6, 0.15, 0.09, 0.06], [0, 0.55, -0.85, 0.16, 0.1, 0.05],
    [0.35, 0.15, -0.92, 0.15, 0.09, 0.03], [-0.35, 0.15, -0.92, 0.15, 0.09, 0.03], [0, -0.05, -1, 0.14, 0.09, 0],
    [0.85, 0.2, -0.45, 0.12, 0.08, 0.04], [-0.85, 0.2, -0.45, 0.12, 0.08, 0.04],
    [0.55, -0.3, -0.78, 0.12, 0.08, -0.02], [-0.55, -0.3, -0.78, 0.12, 0.08, -0.02], [0, -0.35, -0.94, 0.12, 0.08, 0],
    [0.3, 0.95, 0.15, 0.12, 0.09, -0.06], [-0.3, 0.95, 0.15, 0.12, 0.09, -0.06], [0.75, 0.6, 0.05, 0.11, 0.08, -0.04], [-0.75, 0.6, 0.05, 0.11, 0.08, -0.04],
  ];
  const TANJIRO_BANGS = [
    // [x, y, z on head front, length, radius, tilt]  — tips stop above the eyes
    [0, 0.2, 0.22, 0.11, 0.07, 0.05], [0.1, 0.19, 0.21, 0.1, 0.065, 0.3], [-0.1, 0.19, 0.21, 0.1, 0.065, -0.3],
    [0.19, 0.15, 0.17, 0.1, 0.06, 0.5], [-0.19, 0.15, 0.17, 0.1, 0.06, -0.5], [0.255, 0.06, 0.09, 0.15, 0.05, 0.12], [-0.255, 0.06, 0.09, 0.15, 0.05, -0.12],
  ];

  function buildTanjiro(look) {
    const L = Object.assign({}, look, { skin: '#f6d6ba', hair: '#3c1416', hairTip: '#b5352a', eye: '#a0302c' });
    const M = {
      skin: new T3.MeshToonMaterial({ color: L.skin, gradientMap: skinGrad() }), uni: toon(0x1c1c2a), white: toon(0xefece4), wood: toon(0xb08250), dark: toon(0x241c1c), gold: toon(0xd8b450),
      hair: toon(0xffffff, { vertexColors: true }),
      haori: toon(0xffffff, { map: canvasTex(64, 64, (c) => { c.fillStyle = '#121214'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#1d6b4a'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32); }, [6, 3]), side: T3.DoubleSide }),
      blade: toon(0x1a1a1e), edge: new T3.MeshBasicMaterial({ color: 0x9a9aa8 }),
    };
    M.haori.map.magFilter = T3.NearestFilter;
    const root = new T3.Group(), turn = new T3.Group(), spin = new T3.Group(), body = new T3.Group();
    root.add(turn); turn.add(spin); spin.add(body);
    const J = {};
    // ---- legs
    J.hips = joint(body, 0, 0.62, 0);
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'R' : 'L';
      const up = J['upLeg' + side] = joint(J.hips, s * 0.09, 0, 0);
      part(new T3.CapsuleGeometry(0.085, 0.2, 4, 10), M.uni, 0.07, up, [0, -0.14, 0]);
      const lo = J['loLeg' + side] = joint(up, 0, -0.3, 0);
      part(new T3.CapsuleGeometry(0.07, 0.17, 4, 10), M.uni, 0.07, lo, [0, -0.12, 0]);
      part(new T3.CylinderGeometry(0.067, 0.058, 0.15, 12), M.white, 0.06, lo, [0, -0.2, 0]); // kyahan
      part(new T3.BoxGeometry(0.1, 0.06, 0.17), M.white, 0.05, lo, [0, -0.29, 0.03]); // tabi
      part(new T3.BoxGeometry(0.11, 0.022, 0.19), toon(0x7a5e40), 0.05, lo, [0, -0.325, 0.03]); // waraji
    }
    // ---- torso
    J.spine = joint(J.hips, 0, 0.02, 0);
    part(new T3.CapsuleGeometry(0.16, 0.2, 4, 14), M.uni, 0.05, J.spine, [0, 0.17, 0]).scale.set(1.08, 1, 0.72);
    part(new T3.CylinderGeometry(0.168, 0.168, 0.05, 18), M.white, 0.04, J.spine, [0, 0.03, 0]).scale.set(1.04, 1, 0.74); // belt
    for (let i = 0; i < 3; i++) part(new T3.SphereGeometry(0.012, 6, 6), M.gold, 0, J.spine, [0, 0.13 + i * 0.07, 0.122]);
    // haori (open at the front) + collar
    const h = new T3.CylinderGeometry(0.2, 0.3, 0.52, 22, 1, true, 0.55, TAU - 1.1);
    const haori = part(h, M.haori, 0.03, J.spine, [0, 0.08, -0.01]); haori.scale.set(1, 1, 0.8); J.haori = haori;
    part(new T3.CylinderGeometry(0.06, 0.075, 0.07, 12), M.uni, 0.05, J.spine, [0, 0.38, 0]); // collar
    // Nezuko's box on the back
    const box = part(new T3.BoxGeometry(0.26, 0.4, 0.17), M.wood, 0.04, J.spine, [0, 0.2, -0.25]);
    for (const y of [-0.1, 0.06]) part(new T3.BoxGeometry(0.27, 0.02, 0.18), toon(0x6a4a28), 0, box, [0, y, 0]);
    // ---- arms
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'R' : 'L';
      const sh = J['upArm' + side] = joint(J.spine, s * 0.2, 0.34, 0);
      part(new T3.CylinderGeometry(0.085, 0.12, 0.24, 14, 1, true), M.haori, 0.05, sh, [0, -0.12, 0]); // wide haori sleeve
      part(new T3.CapsuleGeometry(0.052, 0.12, 4, 8), M.uni, 0.08, sh, [0, -0.1, 0]);
      const el = J['loArm' + side] = joint(sh, 0, -0.22, 0);
      part(new T3.CapsuleGeometry(0.045, 0.12, 4, 8), M.uni, 0.08, el, [0, -0.08, 0]);
      J['hand' + side] = part(new T3.SphereGeometry(0.05, 10, 8), M.skin, 0.08, el, [0, -0.19, 0]);
    }
    // ---- katana in the right hand (black Nichirin blade)
    const sword = new T3.Group(); J.handR.add(sword); J.sword = sword;
    part(new T3.CylinderGeometry(0.02, 0.022, 0.2, 8), M.dark, 0.08, sword, [0, 0.06, 0]);          // handle (along +Y of hand)
    part(new T3.BoxGeometry(0.11, 0.012, 0.11), M.dark, 0.06, sword, [0, -0.045, 0]);                // square tsuba
    const blade = new T3.Group(); sword.add(blade); blade.position.set(0, -0.06, 0);
    part(new T3.BoxGeometry(0.03, 0.85, 0.01), M.blade, 0.05, blade, [0, -0.425, 0]);
    part(new T3.BoxGeometry(0.008, 0.82, 0.012), M.edge, 0, blade, [0.016, -0.42, 0]);
    // ---- head
    J.neck = joint(J.spine, 0, 0.4, 0);
    part(new T3.CylinderGeometry(0.05, 0.055, 0.08, 10), M.skin, 0.05, J.neck, [0, 0.03, 0]);
    J.head = joint(J.neck, 0, 0.32, 0.01);
    const faces = { normal: faceTexture(L, 'normal'), shout: faceTexture(L, 'shout'), hurt: faceTexture(L, 'hurt'), blink: faceTexture(L, 'blink') };
    const headMat = new T3.MeshToonMaterial({ map: faces.normal, gradientMap: skinGrad() });
    const headG = part(headGeo(0.28), headMat, 0.035, J.head);
    for (const s of [-1, 1]) { // ears + hanafuda earrings
      part(new T3.SphereGeometry(0.05, 10, 8), M.skin, 0.05, J.head, [s * 0.275, -0.03, -0.01]).scale.set(0.45, 1, 0.75);
      const ring = part(new T3.BoxGeometry(0.004, 0.085, 0.042), toon(0xffffff, { map: hanafudaTex() }), 0.08, J.head, [s * 0.285, -0.12, -0.01]);
      J['ear' + (s < 0 ? 'R' : 'L')] = ring;
    }
    // hair: cap + spikes + bangs
    const cap = part(new T3.SphereGeometry(0.295, 40, 20, 0, TAU, 0, Math.PI * 0.44), toon(L.hair), 0.04, J.head, [0, 0.02, -0.03]);
    cap.scale.set(1.02, 1.05, 1.02);
    const back = part(new T3.SphereGeometry(0.292, 32, 16, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.4, Math.PI * 0.42), toon(L.hair, { side: T3.DoubleSide }), 0.04, J.head, [0, 0, -0.01]);
    hairLocks(J.head, L, TANJIRO_HAIR, M.hair);
    for (const [x, y, z, len, rad, tilt] of TANJIRO_BANGS) {
      const geo = lockGeo(len, rad, -0.04); geo.rotateX(Math.PI); // hang downward
      const cols = []; const pos = geo.attributes.position, tip = new T3.Color(L.hairTip), rc = new T3.Color(L.hair);
      for (let i = 0; i < pos.count; i++) { const u = -pos.getY(i) / len; const c = rc.clone().lerp(tip, Math.pow(Math.max(0, u), 2)); cols.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new T3.Float32BufferAttribute(cols, 3));
      const g = part(geo, M.hair, 0.08, J.head, [x, y, z]); g.rotation.set(-0.5, 0, tilt);
    }
    root.traverse(o => { o.frustumCulled = false; });
    return {
      root, turn, spin, J, height: 1.66,
      setExpr(e) { const t = faces[e] || faces.normal; if (headMat.map !== t) { headMat.map = t; headMat.needsUpdate = true; } },
    };
  }

  // ---------------- pose driver (same pose data as the 2D rig) ----------------
  const vA = new T3.Vector3(), down = new T3.Vector3(0, -1, 0), axX = new T3.Vector3(1, 0, 0);
  function pose(M, a, dt) {
    const J = M.J, p = a.pose || {}, s = (a.scale || 1) * 1.62 / M.height;
    M.root.position.set((a.x - 640) * 0.01, (GY - a.y) * 0.01, a.z || 0);
    M.root.scale.set(s * (a.face < 0 ? -1 : 1), s, s);
    M.turn.rotation.y = 0.62;
    if (p.spin) { M.spin.position.set(0, 0.85, 0); M.spin.children[0].position.set(0, -0.85, 0); M.spin.rotation.x = p.spin; }
    else { M.spin.position.set(0, 0, 0); M.spin.children[0].position.set(0, 0, 0); M.spin.rotation.x = 0; }
    const [tf, bf] = legPose(p, false), [tb, bb] = legPose(p, true);
    J.upLegR.rotation.set(-tf, 0, 0); J.loLegR.rotation.set(bf, 0, 0);
    J.upLegL.rotation.set(-tb, 0, 0); J.loLegL.rotation.set(bb, 0, 0);
    const bob = p.run ? -Math.abs(Math.sin(p.run)) * 0.03 : Math.sin((p.t || 0) * 0.07) * 0.006;
    const minFoot = Math.min(...['R', 'L'].map(k => { const th = k === 'R' ? tf : tb, b = k === 'R' ? bf : bb; return 0.62 - 0.3 * Math.cos(th) - 0.33 * Math.cos(th - b); }));
    J.hips.position.y = 0.62 - (p.air ? 0 : Math.max(0, minFoot)) + bob - (p.crouch || 0) * 0.08;
    const ang = p.swing !== undefined ? p.swing : 0.95 - Math.sin(p.run || 0) * 0.6;
    const ang2 = p.arm2 !== undefined ? p.arm2 : (p.swing !== undefined ? p.swing + 0.5 : 0.9 + Math.sin(p.run || 0) * 0.6);
    vA.set(-0.3, -Math.sin(ang), Math.cos(ang)).normalize(); J.upArmR.quaternion.setFromUnitVectors(down, vA);
    J.loArmR.rotation.set(-0.35, 0, 0);
    vA.set(0.3, -Math.sin(ang2), Math.cos(ang2)).normalize(); J.upArmL.quaternion.setFromUnitVectors(down, vA);
    J.loArmL.rotation.set(-0.45, 0, 0);
    // blade points along the arm, slightly forward (like the 2D rig: ang - 0.12)
    J.sword.rotation.set(0.15, 0, 0);
    J.spine.rotation.set((p.run ? 0.22 : 0.04) + (p.shout ? 0.1 : 0), 0, 0);
    J.head.rotation.set(-(p.run ? 0.12 : 0), -0.28, 0);
    // haori flutter
    const fl = (p.run ? 0.25 : 0) + (p.air ? 0.35 : 0) + Math.sin((p.t || 0) * 0.15) * 0.03;
    J.haori.rotation.x = -fl * 0.6; J.haori.scale.z = 0.8 + fl * 0.4;
    for (const k of ['earR', 'earL']) if (J[k]) J[k].rotation.z = Math.sin((p.t || 0) * 0.1) * 0.15;
    // expression
    M.blink = ((M.blink || 0) + dt) % 3.6;
    M.setExpr(p.hurt ? 'hurt' : p.shout ? 'shout' : (p.sleep || M.blink > 3.45) ? 'blink' : 'normal');
  }

  return { tanjiro: buildTanjiro, pose };
})();
