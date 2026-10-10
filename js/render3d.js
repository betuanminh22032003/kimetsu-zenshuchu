// ============================================================
//  RENDER3D — WebGL 3D world (Three.js r147): stage scenery, lighting,
//  bloom, 3D technique effects, particles, VRM characters (if provided)
//  with 2D-anime billboard fallback. Gameplay plane z=0 maps 1:1 to the
//  1280x720 game coordinates so the 2D overlay (HUD, telegraphs) stays aligned.
// ============================================================
'use strict';

const R3D = (() => {
  const api = { ok: false, vrm: {}, vrmLoading: {}, chibi: {}, no3dChars: location.search.includes('2dchars'), stats: { fx: 0, parts: 0 } };
  if (!window.THREE || location.search.includes('no3d')) return api;
  const T3 = THREE;
  const S = 0.01;
  const toX = x => (x - 640) * S, toY = y => (GY - y) * S;
  const FOV = 30, D = 3.6 / Math.tan(FOV / 2 * Math.PI / 180), CAMY = toY(360);
  let renderer, scene, camera, composer, bloom, glc, hemi, moonLight, stageGroup, stageKey = null, stageAnim = [];
  let backdrop, flashLights = [], flashIdx = 0, time = 0, sunSprite;
  const fxMeshes = new Map();
  const billboards = {}, shadows = {};

  // ---------------- shaders ----------------
  const NOISE = `
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }`;
  const RIBBON_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
  const RIBBON_FS = `
    uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uA; uniform float uTime; uniform int uTheme; uniform float uTail; uniform float uSeed;
    varying vec2 vUv; ${NOISE}
    void main(){
      float u = vUv.x, v = vUv.y;
      vec3 col = mix(uC1, uC2, smoothstep(0., .55, v)); col = mix(col, uC3, smoothstep(.55, 1., v));
      float a = mix(1., smoothstep(0., .3, u), uTail) * (.5 + .5 * v);
      float edge = smoothstep(.0, .12, v) * smoothstep(1., .82, v);
      if (uTheme == 1) { // water: ukiyo-e foam bands
        float w = smoothstep(.78, .9, fract(u * 7. - v * 1.6 + uSeed)); col = mix(col, vec3(1.), w * smoothstep(.45, 1., v)); a += w * .35 * v;
        col += vec3(.9) * smoothstep(.9, 1., v) * .8;
      } else if (uTheme == 2) { // flame / sun / blood
        float n = vnoise(vec2(u * 9. - uTime * 7., v * 3. + uSeed)); float n2 = vnoise(vec2(u * 23. - uTime * 11., v * 6.));
        a *= .45 + n * .9; col = mix(col, uC3 * 1.4, n2 * v); a *= smoothstep(1., .55 - n * .4, v) + .35;
      } else if (uTheme == 3) { // thunder
        col = mix(col, vec3(1.3), smoothstep(.35, .65, v) * (.6 + .4 * h21(vec2(floor(u * 30.), uTime))));
      } else if (uTheme == 4) { // wind / mist streaks
        a *= .45 + .55 * step(.45, fract(v * 6. + u * 3. + uSeed));
      } else if (uTheme == 5) { a *= .55; }
      gl_FragColor = vec4(col * (1. + v * .7), clamp(a * edge * uA, 0., 1.));
    }`;
  const GLOW_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const GLOW_FS = `uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uA; uniform float uTime; uniform float uScale;
    varying vec3 vN; varying vec3 vV; varying vec2 vUv;
    void main(){
      float fr = pow(1. - abs(dot(vN, vV)), 1.6);
      float sc = uScale > 0. ? smoothstep(.55, .7, fract(vUv.x * uScale - uTime * 2.)) * .5 : 0.;
      vec3 col = mix(uC1 * .9, uC2, .55 + .45 * vN.y) ; col = mix(col, uC3 * 1.15, fr * .85) + uC3 * sc * .35;
      gl_FragColor = vec4(col, clamp(uA * (.82 + fr * .18), 0., 1.));
    }`;
  const PART_VS = `attribute float size; attribute vec3 color; attribute float alpha; attribute float cell; attribute float rot;
    varying vec3 vC; varying float vA; varying float vCell; varying float vRot; uniform float uPR;
    void main(){ vC = color; vA = alpha; vCell = cell; vRot = rot; gl_PointSize = size * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
  const PART_FS = `uniform sampler2D uAtlas; varying vec3 vC; varying float vA; varying float vCell; varying float vRot;
    void main(){ vec2 c = gl_PointCoord - .5; float s = sin(vRot), co = cos(vRot); c = vec2(c.x*co - c.y*s, c.x*s + c.y*co) + .5;
      if (c.x < 0. || c.y < 0. || c.x > 1. || c.y > 1.) discard;
      vec2 auv = (vec2(mod(vCell, 4.), floor(vCell / 4.)) + c) / vec2(4., 2.);
      vec4 t = texture2D(uAtlas, auv); if (t.a * vA < .01) discard; gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`;
  const FIRE_FS = `uniform sampler2D uMask; uniform float uTime; uniform float uA; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uSeed;
    varying vec2 vUv; ${NOISE}
    void main(){ vec4 mk = texture2D(uMask, vUv); float m = mk.a;
      float n = vnoise(vUv * vec2(6., 5.) + vec2(-uTime * 3.2 + uSeed, -uTime * 2.)); float n2 = vnoise(vUv * 15. + vec2(-uTime * 6., -uTime * 4.));
      float f = m * (.5 + .7 * n) * (.75 + .5 * n2);
      vec3 col = mix(uC1, uC2, smoothstep(.15, .55, f)); col = mix(col, uC3 * 1.3, smoothstep(.55, .95, f));
      col = mix(col, vec3(1.), mk.r * .0);
      float eye = mk.g; col = mix(col, vec3(1.4, 1.3, 1.), eye);
      gl_FragColor = vec4(col, clamp(smoothstep(.12, .45, f) + eye, 0., 1.) * uA); }`;
  const THEME_ID = { water: 1, sun: 2, flame: 2, blood: 2, demon: 2, thunder: 3, wind: 4, mist: 5 };
  const col3 = h => new T3.Color(h);

  function ribbonMat(theme, tail) {
    const th = THEMES[theme] || THEMES.normal;
    return new T3.ShaderMaterial({
      uniforms: { uC1: { value: col3(th.d) }, uC2: { value: col3(th.m) }, uC3: { value: col3(th.l) }, uA: { value: 1 }, uTime: { value: 0 }, uTheme: { value: THEME_ID[theme] || 0 }, uTail: { value: tail === undefined ? 1 : tail }, uSeed: { value: Math.random() * 10 } },
      vertexShader: RIBBON_VS, fragmentShader: RIBBON_FS, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide,
    });
  }
  function glowMat(theme, scale) {
    const th = THEMES[theme] || THEMES.normal;
    return new T3.ShaderMaterial({
      uniforms: { uC1: { value: col3(th.d) }, uC2: { value: col3(th.m) }, uC3: { value: col3(th.l) }, uA: { value: 1 }, uTime: { value: 0 }, uScale: { value: scale || 0 } },
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: T3.NormalBlending, side: T3.DoubleSide,
    });
  }
  // ribbon geometry with N segments; positions filled per frame
  function ribbonGeo(N) {
    const g = new T3.BufferGeometry();
    const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
    for (let i = 0; i <= N; i++) { uv.set([i / N, 0, i / N, 1], i * 4); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setAttribute('uv', new T3.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.userData.N = N;
    return g;
  }
  function setRibbon(g, fn) { // fn(i, u) -> [ox,oy,oz, ix,iy,iz]
    const N = g.userData.N, p = g.attributes.position.array;
    for (let i = 0; i <= N; i++) { const r = fn(i, i / N); p[i * 6] = r[3]; p[i * 6 + 1] = r[4]; p[i * 6 + 2] = r[5]; p[i * 6 + 3] = r[0]; p[i * 6 + 4] = r[1]; p[i * 6 + 5] = r[2]; }
    g.attributes.position.needsUpdate = true; g.computeBoundingSphere();
  }

  // ---------------- textures ----------------
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T3.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.anisotropy = 4; return t;
  }
  let atlasTex, blobTex, tigerTex, flameTex;
  function makeAtlas() {
    atlasTex = canvasTex(256, 128, (g) => {
      const cell = (i, fn) => { g.save(); g.translate((i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32); fn(); g.restore(); };
      g.fillStyle = '#fff';
      cell(0, () => { const r = g.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-32, -32, 64, 64); });
      cell(1, () => { g.beginPath(); g.ellipse(0, 0, 26, 13, 0.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(4, 2, 14, 5, 0.5, 0, TAU); g.fill(); });
      cell(2, () => { for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 13, -6, 15, 11, s * 0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(s * 10, 10, 10, 8, -s * 0.4, 0, TAU); g.fill(); } g.fillRect(-2, -16, 4, 32); });
      cell(3, () => { g.beginPath(); g.moveTo(0, 24); g.bezierCurveTo(-34, 0, -18, -26, 0, -10); g.bezierCurveTo(18, -26, 34, 0, 0, 24); g.fill(); });
      cell(4, () => { g.font = 'bold 48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 0, 2); });
      cell(5, () => { g.beginPath(); g.ellipse(0, 0, 28, 10, -0.6, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, 14); g.lineTo(20, -14); g.stroke(); });
      cell(6, () => { const r = g.createRadialGradient(0, 0, 0, 0, 0, 30); r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-32, -32, 64, 64); });
      cell(7, () => { g.beginPath(); g.moveTo(0, -28); g.lineTo(14, 0); g.lineTo(0, 28); g.lineTo(-14, 0); g.closePath(); g.fill(); });
    });
    atlasTex.flipY = false;
    tigerTex = canvasTex(256, 256, (g) => {
      g.filter = 'blur(5px)'; g.fillStyle = '#000';
      g.beginPath(); g.moveTo(230, 120); g.lineTo(170, 70); g.lineTo(150, 30); g.lineTo(128, 62); g.lineTo(96, 40); g.lineTo(90, 76); g.lineTo(30, 70); g.quadraticCurveTo(0, 128, 30, 190); g.lineTo(100, 200); g.lineTo(160, 220); g.lineTo(226, 150); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(236, 132); g.lineTo(170, 140); g.lineTo(226, 152); g.fill();
      g.globalCompositeOperation = 'source-over'; g.filter = 'blur(2px)'; g.fillStyle = 'rgba(0,255,0,1)'; g.beginPath(); g.ellipse(168, 100, 13, 6, -0.4, 0, TAU); g.fill();
    });
    flameTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 70, 4, 64, 64, 60); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(.6, 'rgba(0,0,0,.7)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
    blobTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  }
  const PCELL = { ember: 0, spark: 0, drop: 0, blood: 0, petal: 1, butterfly: 2, heart: 3, note: 4, leaf: 5, smoke: 6, rock: 7, ice: 7 };
  const PADD = { ember: 1, spark: 1, drop: 1 };

  // ---------------- particles ----------------
  function makeParticles(max, additive) {
    const g = new T3.BufferGeometry();
    for (const [n, k] of [['position', 3], ['color', 3], ['size', 1], ['alpha', 1], ['cell', 1], ['rot', 1]]) g.setAttribute(n, new T3.BufferAttribute(new Float32Array(max * k), k).setUsage(T3.DynamicDrawUsage));
    const m = new T3.ShaderMaterial({ uniforms: { uAtlas: { value: atlasTex }, uPR: { value: renderer.getPixelRatio() } }, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: additive ? T3.AdditiveBlending : T3.NormalBlending });
    const pts = new T3.Points(g, m); pts.frustumCulled = false; pts.userData.max = max; scene.add(pts);
    return pts;
  }
  let partAdd, partNorm;
  const tmpC = new T3.Color();
  function updateParticles(list) {
    const sys = [partAdd, partNorm], n = [0, 0];
    for (const p of list) {
      const add = PADD[p.k] || (!p.k) ? 0 : 1;
      const s = sys[add], i = n[add];
      if (i >= s.userData.max) continue;
      if (p._z === undefined) p._z = p.k === 'smoke' ? Math.random() * 0.6 - 0.8 : Math.random() * 1.2 - 0.3;
      const a = s.geometry.attributes;
      a.position.array[i * 3] = toX(p.x); a.position.array[i * 3 + 1] = toY(p.y); a.position.array[i * 3 + 2] = p._z;
      tmpC.set(p.c || '#fff'); a.color.array[i * 3] = tmpC.r; a.color.array[i * 3 + 1] = tmpC.g; a.color.array[i * 3 + 2] = tmpC.b;
      const life = p.max ? p.life / p.max : 1;
      const big = p.k === 'smoke' ? p.s * (2 - life) * 2.2 : p.k === 'note' || p.k === 'heart' ? p.s * 4 : p.k === 'butterfly' ? 14 : p.k === 'petal' || p.k === 'leaf' ? p.s * 3.2 : p.s * 3.2;
      a.size.array[i] = Math.max(2, big);
      a.alpha.array[i] = Math.min(1, life * 1.5) * (p.k === 'smoke' ? 0.5 : 1);
      a.cell.array[i] = PCELL[p.k] !== undefined ? PCELL[p.k] : 0;
      a.rot.array[i] = p.k === 'butterfly' ? Math.sin(p.life * 0.5) * 0.3 : (p.life || 0) * 0.12;
      n[add]++;
    }
    sys.forEach((s, k) => { s.geometry.setDrawRange(0, n[k]); for (const key in s.geometry.attributes) s.geometry.attributes[key].needsUpdate = true; });
    api.stats.parts = n[0] + n[1];
  }

  // ---------------- init ----------------
  function init() {
    glc = document.getElementById('gl');
    if (!glc) return;
    renderer = new T3.WebGLRenderer({ canvas: glc, antialias: false, preserveDrawingBuffer: location.search.includes('debug'), powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFShadowMap; renderer.shadowMap.autoUpdate = true;
    scene = new T3.Scene();
    camera = new T3.PerspectiveCamera(FOV, W / H, 0.1, 500);
    camera.position.set(0, CAMY, D);
    hemi = new T3.HemisphereLight(0x8090c0, 0x1a1420, 1.0); scene.add(hemi);
    moonLight = new T3.DirectionalLight(0xc0ccff, 0.9); moonLight.position.set(-8, 14, 10);
    moonLight.castShadow = true; moonLight.shadow.mapSize.set(512, 512); Object.assign(moonLight.shadow.camera, { left: -10, right: 10, top: 8, bottom: -3, near: 1, far: 50 });
    scene.add(moonLight);
    for (let i = 0; i < 4; i++) { const l = new T3.PointLight(0xffffff, 0, 9, 2); l.userData.life = 0; scene.add(l); flashLights.push(l); }
    makeAtlas();
    partAdd = makeParticles(2500, true); partNorm = makeParticles(1500, false);
    composer = new T3.EffectComposer(renderer);
    composer.addPass(new T3.RenderPass(scene, camera));
    bloom = new T3.UnrealBloomPass(new T3.Vector2(W / 2, H / 2), 0.9, 0.55, 0.9);
    composer.addPass(bloom);
    stageGroup = new T3.Group(); scene.add(stageGroup);
    // VRM manifest
    for (const f of (window.ASSET_FILES || [])) { const m = f.match(/^vrm\/(\w+)\.vrm$/); if (m) loadVRM(m[1], 'assets/' + f); }
    api.ok = true;
  }

  // ---------------- stage scenery ----------------
  let seed = 1; const srnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
  const STAGE_CFG = {
    wisteria: { fog: 0x1a1430, ground: 'grass', sky: 0x0b0a26, hemi: [0x7a70c0, 0x18101c, 1.0], moon: 0xd8d0ff },
    town: { fog: 0x1a1830, ground: 'road', sky: 0x0a1030, hemi: [0x8090c0, 0x201810, 1.0], moon: 0xc8d0ff },
    mansion: { fog: 0x2a1a10, ground: 'tatami', sky: 0x2a1a10, hemi: [0xd8b080, 0x302010, 0.75], moon: 0xffe0b0, indoor: 1 },
    spider: { fog: 0x14080e, ground: 'grass', sky: 0x06060e, hemi: [0x803040, 0x100608, 0.9], moon: 0xff6070 },
    train: { fog: 0x0e1628, ground: 'roof', sky: 0x081028, hemi: [0x7088c0, 0x101018, 1.0], moon: 0xd0dcff },
    dawnfield: { fog: 0x1c2040, ground: 'grass', sky: 0x0a1030, hemi: [0x8090c0, 0x201810, 1.0], moon: 0xc8d0ff },
    yukaku: { fog: 0x2a0a12, ground: 'road', sky: 0x1a0610, hemi: [0xff9080, 0x200810, 1.0], moon: 0xffb0a0 },
    village: { fog: 0x182a30, ground: 'grass', sky: 0x0e1a24, hemi: [0x80b0c0, 0x101810, 1.0], moon: 0xd0f0ff },
    castle: { fog: 0x2a1408, ground: 'wood', sky: 0x1a0a0a, hemi: [0xffb070, 0x201008, 1.1], moon: 0xffd0a0, indoor: 1 },
    castle_ice: { fog: 0x14304a, ground: 'wood', sky: 0x0a1a2a, hemi: [0xa0d0ff, 0x101828, 1.1], moon: 0xd0ecff, indoor: 1 },
    castle_moon: { fog: 0x24102a, ground: 'wood', sky: 0x1a0a14, hemi: [0xc0a0ff, 0x200818, 1.0], moon: 0xe8d8ff, indoor: 1 },
    city: { fog: 0x0e0c1a, ground: 'road', sky: 0x05050c, hemi: [0x7070a0, 0x180808, 0.9], moon: 0xd0c8ff },
  };
  function groundTex(kind) {
    return canvasTex(512, 512, (g, w, h) => {
      const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
      if (kind === 'grass') { fill('#1c2418'); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${60 + Math.random() * 50},${80 + Math.random() * 60},${40 + Math.random() * 30},${Math.random() * 0.5})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 6 + Math.random() * 8); } }
      else if (kind === 'road') { fill('#2a2830'); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); } }
      else if (kind === 'tatami') { fill('#a8a060'); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#b4ac6c' : '#a09858'; g.fillRect(i * 128, j * 256, 128, 256); g.strokeStyle = '#3a3010'; g.lineWidth = 6; g.strokeRect(i * 128, j * 256, 128, 256); } for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, y, w, 1); } }
      else if (kind === 'roof') { fill('#1c1c22'); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#24242c' : '#1a1a20'; g.fillRect(i * 32, 0, 32, h); } g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 16; i++) g.fillRect(i * 32, 0, 2, h); }
      else { fill('#5a3a1c'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#64421f' : '#52341a'; g.fillRect(0, i * 64, w, 64); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, i * 64, w, 3); } for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 1); } }
    }, kind === 'tatami' ? [10, 4] : [24, 10]);
  }
  function windowsTex(lit, color) {
    return canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#10101c'; g.fillRect(0, 0, w, h);
      for (let y = 10; y < h - 10; y += 28) for (let x = 10; x < w - 10; x += 28) { g.fillStyle = Math.random() < lit ? color : '#1a1a2c'; g.fillRect(x, y, 16, 18); }
    });
  }
  function shojiTex(warm) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = warm ? '#f2dcaa' : '#cfe8ff'; g.fillRect(0, 0, w, h);
      g.strokeStyle = warm ? '#5a2a12' : '#3a5a7a'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
      g.lineWidth = 4; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    });
  }
  function inst(geo, mat, n, place, cast) {
    const m = new T3.InstancedMesh(geo, mat, n); const o = new T3.Object3D();
    for (let i = 0; i < n; i++) { place(o, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
    m.castShadow = false; m.receiveShadow = false; stageGroup.add(m); return m;
  }
  function buildStage(key) {
    stageKey = key; seed = 7 + key.length * 131;
    while (stageGroup.children.length) { const c = stageGroup.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    stageAnim = [];
    const cfg = STAGE_CFG[key] || STAGE_CFG.wisteria;
    scene.background = new T3.Color(cfg.sky);
    scene.fog = new T3.Fog(cfg.fog, 16, cfg.indoor ? 60 : 85);
    hemi.color.set(cfg.hemi[0]); hemi.groundColor.set(cfg.hemi[1]); hemi.intensity = cfg.hemi[2] * 0.85;
    moonLight.color.set(cfg.moon);
    // backdrop: existing painted background as far sky plane
    const bgc = typeof bgCanvas === 'function' ? bgCanvas(key) : null;
    if (bgc) {
      const tex = new T3.CanvasTexture(bgc); tex.repeat.set(1, 600 / 720); tex.offset.set(0, 120 / 720);
      const z = -72, hh = (D - z) * Math.tan(FOV / 2 * Math.PI / 180);
      const ph = hh + 4, pw = hh * 2 * (16 / 9) * 1.1;
      backdrop = new T3.Mesh(new T3.PlaneGeometry(pw, ph), new T3.MeshBasicMaterial({ map: tex, fog: false, color: 0xffffff }));
      backdrop.position.set(0, CAMY - 1.2 + ph / 2, z); stageGroup.add(backdrop);
    }
    // ground
    const gt = groundTex(cfg.ground);
    const ground = new T3.Mesh(new T3.PlaneGeometry(220, 90), new T3.MeshLambertMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -32); ground.receiveShadow = true; stageGroup.add(ground);
    if (key === 'train') stageAnim.push(() => { gt.offset.x = (time * 0.9) % 1; });
    const B = PROPS[key] || PROPS.wisteria; B(cfg);
  }
  const darkMat = (c) => new T3.MeshLambertMaterial({ color: c });
  function trees(n, zmin, zmax, color, h, opts) {
    opts = opts || {};
    const cone = new T3.ConeGeometry(1, 1, 7), trunk = new T3.CylinderGeometry(0.12, 0.18, 1, 6);
    const items = []; for (let i = 0; i < n; i++) { const z = srnd(zmin, zmax); items.push({ x: srnd(-30, 30), z, s: srnd(0.7, 1.3) * h }); }
    const fol = inst(cone, darkMat(color), n * 3, (o, i) => { const t = items[Math.floor(i / 3)], k = i % 3; o.position.set(t.x, t.s * (0.45 + k * 0.28), t.z); o.scale.set(t.s * (0.42 - k * 0.1), t.s * 0.45, t.s * (0.42 - k * 0.1)); }, true);
    inst(trunk, darkMat(0x2a1c14), n, (o, i) => { const t = items[i]; o.position.set(t.x, t.s * 0.25, t.z); o.scale.set(1, t.s * 0.5, 1); }, true);
    if (opts.scroll) stageAnim.push(() => { fol.parent && (fol.position.x = 0); });
    return items;
  }
  function moon(color, x, y, z, r) {
    const m = new T3.Mesh(new T3.SphereGeometry(r, 24, 16), new T3.MeshBasicMaterial({ color: new T3.Color(color).multiplyScalar(1.6), fog: false }));
    m.position.set(x, y, z); stageGroup.add(m); return m;
  }
  function buildings(n, zmin, zmax, lit, wcolor, roof) {
    const tex = windowsTex(lit, wcolor);
    const mat = [darkMat(0x161624), darkMat(0x161624), new T3.MeshLambertMaterial({ color: roof || 0x1e1e30 }), darkMat(0x161624), new T3.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.38 }), darkMat(0x161624)];
    const box = new T3.BoxGeometry(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const m = new T3.Mesh(box, mat); const w = srnd(2.5, 4.5), h = srnd(3, 9), d = srnd(2.5, 4);
      m.scale.set(w, h, d); m.position.set(srnd(-26, 26), h / 2, srnd(zmin, zmax)); stageGroup.add(m);
      if (roof) { const r = new T3.Mesh(new T3.ConeGeometry(0.75, 0.35, 4), new T3.MeshLambertMaterial({ color: roof })); r.scale.set(w * 1.05, h * 0.25 + 1, d * 1.05); r.rotation.y = Math.PI / 4; r.position.set(m.position.x, h + (h * 0.25 + 1) * 0.17, m.position.z); stageGroup.add(r); }
    }
  }
  function lanterns(n, zmin, zmax, color, y0, light) {
    const geo = new T3.CylinderGeometry(0.22, 0.22, 0.42, 10);
    const mat = new T3.MeshBasicMaterial({ color: new T3.Color(color).multiplyScalar(1.5) });
    const pos = [];
    inst(geo, mat, n, (o, i) => { const p = [srnd(-14, 14), srnd(y0[0], y0[1]), srnd(zmin, zmax)]; pos.push(p); o.position.set(...p); });
    for (let i = 0; i < Math.min(light || 0, n); i++) { const l = new T3.PointLight(color, 0.9, 7, 2); l.position.set(...pos[i]); stageGroup.add(l); stageAnim.push(() => { l.intensity = 0.8 + Math.sin(time * 3 + i) * 0.15; }); }
  }
  function shojiRooms(n, warm) {
    const tex = shojiTex(warm);
    const mat = new T3.MeshLambertMaterial({ map: tex, emissive: warm ? 0x6a3a10 : 0x20405a, emissiveMap: tex, emissiveIntensity: warm ? 0.4 : 0.2 });
    const box = new T3.BoxGeometry(1, 1, 1);
    const items = []; for (let i = 0; i < n; i++) items.push({ x: srnd(-26, 26), y: srnd(1, 16), z: srnd(-42, -10), s: srnd(2, 5), rx: srnd(0, 3), ry: srnd(0, 3), sp: srnd(-0.15, 0.15) });
    const m = inst(box, mat, n, (o, i) => { const t = items[i]; o.position.set(t.x, t.y, t.z); o.scale.set(t.s * 1.4, t.s, t.s); o.rotation.set(t.rx, t.ry, 0); });
    const o = new T3.Object3D();
    stageAnim.push(() => { for (let i = 0; i < n; i++) { const t = items[i]; o.position.set(t.x, t.y + Math.sin(time * 0.3 + i) * 0.3, t.z); o.scale.set(t.s * 1.4, t.s, t.s); o.rotation.set(t.rx + time * t.sp * 0.3, t.ry + time * t.sp, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } m.instanceMatrix.needsUpdate = true; });
  }
  const PROPS = {
    wisteria(c) {
      trees(46, -30, -3, 0x101a14, 6);
      const geo = new T3.SphereGeometry(0.16, 8, 6), mat = new T3.MeshLambertMaterial({ color: 0xb48ae8, emissive: 0x5a3a90, emissiveIntensity: 0.6 });
      const strands = []; for (let i = 0; i < 70; i++) strands.push({ x: srnd(-16, 16), z: srnd(-14, -2), y: srnd(4.5, 7), n: Math.floor(srnd(6, 14)) });
      const total = strands.reduce((a, s) => a + s.n, 0); let k = 0;
      const m = inst(geo, mat, total, (o) => { let s, j = k++; for (s of strands) { if (j < s.n) break; j -= s.n; } o.position.set(s.x + Math.sin(j) * 0.08, s.y - j * 0.22, s.z); const sc = 1 - j / s.n * 0.6; o.scale.set(sc, sc * 1.2, sc); });
    },
    town(c) { buildings(26, -30, -9, 0.45, '#ffc880', 0x2a2440); lanterns(16, -6, -2, 0xff5030, [2.2, 3.4], 3); },
    mansion(c) {
      const tex = shojiTex(true), mat = new T3.MeshLambertMaterial({ map: tex, color: 0x9a8a70, emissive: 0x4a2a10, emissiveMap: tex, emissiveIntensity: 0.16 });
      for (let i = -6; i <= 6; i++) { const w = new T3.Mesh(new T3.PlaneGeometry(3.2, 4.2), mat); w.position.set(i * 3.3, 2.6, -6); w.receiveShadow = true; stageGroup.add(w); }
      const beam = new T3.Mesh(new T3.BoxGeometry(50, 0.4, 0.4), darkMat(0x2a1a0a)); beam.position.set(0, 4.8, -5.8); stageGroup.add(beam);
      const dg = new T3.CylinderGeometry(0.35, 0.35, 0.5, 16), dm = new T3.MeshLambertMaterial({ color: 0xc89a5a });
      inst(dg, dm, 8, (o, i) => { o.position.set(-10 + i * 3, 0.25, -4 + (i % 2)); o.rotation.x = Math.PI / 2; }, true);
      for (let i = 0; i < 3; i++) { const l = new T3.PointLight(0xffb060, 0.45, 8, 2); l.position.set(-8 + i * 8, 3.5, -3); stageGroup.add(l); }
    },
    spider(c) {
      trees(60, -34, -3, 0x08080c, 8);
      const mat = new T3.LineBasicMaterial({ color: 0xd8d8ff, transparent: true, opacity: 0.35 });
      for (let w = 0; w < 7; w++) {
        const cx = srnd(-12, 12), cy = srnd(2.5, 6), cz = srnd(-10, -3), R = srnd(1, 2.2), pts = [];
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; pts.push(new T3.Vector3(cx, cy, cz), new T3.Vector3(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cz)); }
        for (let r = 0.25; r < R; r += 0.25) for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, b = (k + 1) / 12 * TAU; pts.push(new T3.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz), new T3.Vector3(cx + Math.cos(b) * r, cy + Math.sin(b) * r, cz)); }
        stageGroup.add(new T3.LineSegments(new T3.BufferGeometry().setFromPoints(pts), mat));
      }
    },
    train(c) {
      const car = new T3.Group();
      const body = new T3.Mesh(new T3.BoxGeometry(40, 1.6, 2.8), darkMat(0x22222a)); body.position.set(0, -0.82, -1.4); car.add(body);
      const win = windowsTex(0.7, '#ffd890'); const wm = new T3.Mesh(new T3.PlaneGeometry(40, 0.8), new T3.MeshBasicMaterial({ map: win })); win.wrapS = T3.RepeatWrapping; win.repeat.set(20, 0.3); wm.position.set(0, -0.7, 0.01); car.add(wm);
      stageGroup.add(car);
      const scen = new T3.Group(); stageGroup.add(scen);
      const cone = new T3.ConeGeometry(1, 1, 6), m1 = darkMat(0x14201a);
      const items = []; for (let i = 0; i < 40; i++) items.push({ x: srnd(-40, 40), z: srnd(-30, -6), s: srnd(3, 7) });
      const im = new T3.InstancedMesh(cone, m1, items.length); scen.add(im); const o = new T3.Object3D();
      stageAnim.push(() => { items.forEach((t, i) => { const x = ((t.x - time * 14 * (10 / -t.z)) % 80 + 120) % 80 - 40; o.position.set(x, t.s * 0.5 - 1.6, t.z); o.scale.set(t.s * 0.35, t.s, t.s * 0.35); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.instanceMatrix.needsUpdate = true; });
    },
    dawnfield(c) {
      trees(30, -30, -6, 0x0e1420, 5);
      const cm = darkMat(0x26262e);
      for (const [x, r, z] of [[-7, -0.25, -4], [6, 0.18, -5]]) { const m = new T3.Mesh(new T3.BoxGeometry(6, 2, 2.6), cm); m.position.set(x, 0.6, z); m.rotation.z = r; m.rotation.y = r; m.castShadow = true; stageGroup.add(m); }
      sunSprite = moon(0xffd890, 10, -4, -60, 4); sunSprite.visible = false;
    },
    yukaku(c) { buildings(24, -28, -9, 0.7, '#ff9a60', 0x3a1018); lanterns(28, -8, -1.5, 0xff4030, [2.4, 4.2], 4); },
    village(c) {
      trees(50, -32, -4, 0x0e1c18, 7);
      const steam = new T3.Mesh(new T3.CircleGeometry(4, 32), new T3.MeshBasicMaterial({ color: 0x406070, transparent: true, opacity: 0.5 })); steam.rotation.x = -Math.PI / 2; steam.position.set(7, 0.02, -8); stageGroup.add(steam);
    },
    castle(c) { shojiRooms(40, true); lanterns(30, -20, -3, 0xffa040, [1, 12], 4); },
    castle_ice(c) {
      shojiRooms(30, false);
      const geo = new T3.OctahedronGeometry(1, 0), mat = new T3.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x4080b0, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
      inst(geo, mat, 40, (o) => { o.position.set(srnd(-16, 16), srnd(0, 1.2), srnd(-14, -2)); const s = srnd(0.3, 1.2); o.scale.set(s * 0.6, s * 1.8, s * 0.6); o.rotation.set(srnd(-0.3, 0.3), srnd(0, 3), srnd(-0.3, 0.3)); }, true);
    },
    castle_moon(c) { shojiRooms(30, true); lanterns(16, -20, -3, 0xc0a0ff, [1, 10], 2); },
    city(c) { buildings(36, -34, -10, 0.22, '#ffc070', 0x1a1a24); lanterns(10, -6, -3, 0xff9a40, [3.2, 3.6], 3); },
  };

  // ---------------- 3D projectiles (player) ----------------
  const PROJ3D = { tiger: 1, crescent: 1, claws: 1 };
  api.handlesProj = k => !!PROJ3D[k];
  const projMeshes = new Map();
  function fireMat(theme, mask) {
    const th = THEMES[theme] || THEMES.flame;
    return new T3.ShaderMaterial({ uniforms: { uMask: { value: mask }, uTime: { value: 0 }, uA: { value: 1 }, uC1: { value: col3(th.d) }, uC2: { value: col3(th.m) }, uC3: { value: col3(th.l) }, uSeed: { value: Math.random() * 10 } },
      vertexShader: RIBBON_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide });
  }
  function makeProj(p) {
    const g = new T3.Group(); g.frustumCulled = false;
    if (p.k === 'tiger') {
      const head = new T3.Mesh(new T3.PlaneGeometry(1, 1), fireMat('flame', tigerTex)); head.scale.set(2.6, 2.6, 1); g.add(head);
      for (let i = 0; i < 5; i++) { const f = new T3.Mesh(new T3.PlaneGeometry(1, 1), fireMat('flame', flameTex)); f.userData.k = i; g.add(f); }
      flash(p.x, p.y, 'flame', 5);
    } else {
      const n = p.k === 'claws' ? 4 : 1;
      for (let i = 0; i < n; i++) { const m = new T3.Mesh(ribbonGeo(24), ribbonMat(p.theme, 0)); m.userData.i = i; g.add(m); }
    }
    scene.add(g); return g;
  }
  function updateProj(g, p) {
    const a = Math.min(1, p.life / 12);
    if (p.k === 'tiger') {
      g.position.set(toX(p.x), toY(p.y), 0.5); g.scale.set(p.face * (p.r / 120), p.r / 120, 1);
      g.children.forEach((m, i) => { m.material.uniforms.uTime.value = time; m.material.uniforms.uA.value = a;
        if (i > 0) { const k = m.userData.k; m.position.set(-0.9 - k * 0.55, Math.sin(time * 6 + k) * 0.25, -0.05 * k); const sc = 1.7 - k * 0.22; m.scale.set(sc * 1.4, sc, 1); } });
      flashLights[0].position.set(toX(p.x), toY(p.y), 1.5); flashLights[0].intensity = 4; flashLights[0].color.set('#ff8020'); flashLights[0].userData.life = 0.5; flashLights[0].userData.power = 4;
      return;
    }
    g.children.forEach(m => {
      const i = m.userData.i, R = p.k === 'claws' ? 70 : p.r, cy = p.y + (p.k === 'claws' ? -60 + i * 34 : 0), cx = p.x - (p.k === 'claws' ? 40 * p.face : 0);
      setRibbon(m.geometry, (j, u) => { const an = -1.25 + u * 2.5, w = (p.k === 'claws' ? 10 : 26) * Math.sin(Math.PI * u);
        const ox = cx + Math.cos(an) * R * p.face, oy = cy + Math.sin(an) * R, ix = cx + Math.cos(an) * (R - w) * p.face, iy = cy + Math.sin(an) * (R - w);
        return [toX(ox), toY(oy), 0.45, toX(ix), toY(iy), 0.45]; });
      m.material.uniforms.uA.value = a * 1.3; m.material.uniforms.uTime.value = time;
    });
  }
  function syncProj(list) {
    const seen = new Set();
    for (const p of list) { if (!PROJ3D[p.k]) continue; let g = projMeshes.get(p); if (!g) { g = makeProj(p); projMeshes.set(p, g); } updateProj(g, p); seen.add(p); }
    for (const [p, g] of projMeshes) if (!seen.has(p)) { disposeFx(g); projMeshes.delete(p); }
  }

  // ---------------- 3D technique effects ----------------
  const FX3D = { slash: 1, ring: 1, streak: 1, thrust: 1, bolt: 1, flashline: 1, dragon: 1, whip: 1 };
  api.handles = t => !!FX3D[t];
  function flash(x, y, theme, power) {
    const l = flashLights[flashIdx++ % flashLights.length];
    l.color.set((THEMES[theme] || THEMES.normal).m); l.position.set(toX(x), toY(y), 1.2); l.userData.life = 1; l.userData.power = power || 3;
  }
  function makeFxMesh(e) {
    switch (e.type) {
      case 'slash': case 'ring': case 'streak': case 'thrust': case 'whip': case 'bolt': case 'flashline': {
        const N = e.type === 'slash' || e.type === 'ring' ? 40 : e.type === 'whip' ? 20 : e.type === 'bolt' ? 12 : 4;
        const th = e.type === 'bolt' ? 'thunder' : e.theme;
        const m = new T3.Mesh(ribbonGeo(N), ribbonMat(th, e.type === 'slash' ? 1 : 0));
        m.frustumCulled = false; scene.add(m);
        if (e.type === 'slash' || e.type === 'flashline') flash(e.cx || e.x1 || 640, e.cy || e.y || 400, e.theme, e.type === 'flashline' ? 5 : 2.5);
        return m;
      }
      case 'dragon': {
        const g = new T3.Group(); g.userData.body = new T3.Mesh(new T3.BufferGeometry(), glowMat(e.theme, 36)); g.add(g.userData.body);
        const hm = glowMat(e.theme, 0); g.userData.headMat = hm;
        const head = new T3.Group();
        const skull = new T3.Mesh(new T3.ConeGeometry(0.32, 0.9, 8), hm); skull.rotation.z = -Math.PI / 2; head.add(skull);
        const jaw = new T3.Mesh(new T3.ConeGeometry(0.18, 0.6, 6), hm); jaw.rotation.z = -Math.PI / 2 - 0.35; jaw.position.set(0.05, -0.16, 0); head.add(jaw);
        if (!e.snake) for (const s of [-1, 1]) { const horn = new T3.Mesh(new T3.ConeGeometry(0.06, 0.7, 5), hm); horn.position.set(-0.3, 0.3, s * 0.16); horn.rotation.z = 0.9; head.add(horn); }
        for (const s of [-1, 1]) { const eye = new T3.Mesh(new T3.SphereGeometry(0.06, 6, 6), new T3.MeshBasicMaterial({ color: 0xffffff })); eye.position.set(0.1, 0.12, s * 0.18); head.add(eye); }
        g.add(head); g.userData.head = head; g.frustumCulled = false; scene.add(g);
        flash(e.pts.length ? e.pts[e.pts.length - 1][0] : 640, 400, e.theme, 4);
        return g;
      }
    }
  }
  function disposeFx(m) {
    scene.remove(m);
    m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  }
  function updateFxMesh(m, e) {
    const mat = m.material;
    if (mat && mat.uniforms) mat.uniforms.uTime.value = time;
    switch (e.type) {
      case 'slash': {
        const head = e.a0 + (e.a1 - e.a0) * Math.min(1, e.prog), tail = e.a0 + (e.a1 - e.a0) * Math.max(0, e.prog - 0.9);
        const tilt = (e._tilt === undefined ? (e._tilt = (Math.random() - 0.5) * 0.9) : e._tilt);
        setRibbon(m.geometry, (i, u) => {
          const a = tail + (head - tail) * u, thick = e.w * Math.sin(Math.PI * Math.min(1, u * 1.05)) * (0.4 + 0.6 * u);
          const ox = e.cx + Math.cos(a) * e.r, oy = e.cy + Math.sin(a) * e.r * (e.sq || 1);
          const ix = e.cx + Math.cos(a) * (e.r - thick), iy = e.cy + Math.sin(a) * (e.r - thick) * (e.sq || 1);
          const z = 0.35 + Math.sin(u * Math.PI) * 0.45 + Math.cos(a) * tilt;
          return [toX(ox), toY(oy), z, toX(ix), toY(iy), z - 0.05];
        });
        mat.uniforms.uA.value = e.fade * 1.15;
        break;
      }
      case 'ring': {
        const u0 = e.t / e.life, R = e.r * (0.3 + u0 * 0.8), w = e.w * (1 - u0) + 2, ground = (e.sq || 1) < 0.5;
        setRibbon(m.geometry, (i, u) => {
          const a = u * TAU;
          if (ground) return [toX(e.x + Math.cos(a) * R), 0.03, Math.sin(a) * R * S * 1.2, toX(e.x + Math.cos(a) * (R - w)), 0.03, Math.sin(a) * (R - w) * S * 1.2];
          return [toX(e.x + Math.cos(a) * R), toY(e.y + Math.sin(a) * R), 0.4, toX(e.x + Math.cos(a) * (R - w)), toY(e.y + Math.sin(a) * (R - w)), 0.4];
        });
        mat.uniforms.uA.value = (1 - u0) * 1.2;
        break;
      }
      case 'streak': case 'thrust': case 'flashline': {
        let x1, y1, x2, y2, w;
        if (e.type === 'streak') { x1 = e.x1; y1 = e.y1; x2 = e.x2; y2 = e.y2; w = e.w; }
        else if (e.type === 'thrust') { const L = e.len * Math.min(1, e.t / 3); x1 = e.x; y1 = e.y; x2 = e.x + Math.cos(e.ang) * L; y2 = e.y + Math.sin(e.ang) * L; w = e.w * 2; }
        else { x1 = Math.min(e.x1, e.x2) - 60; x2 = Math.max(e.x1, e.x2) + 60; y1 = y2 = e.y; w = e.w * 2 * (1 - e.t / e.life) + 2; }
        const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
        setRibbon(m.geometry, (i, u) => {
          const x = lerp(x1, x2, u), y = lerp(y1, y2, u), ww = e.type === 'thrust' ? w * (1 - u) : w * Math.sin(Math.PI * Math.max(0.15, u)) * 0.5 + w * 0.25;
          return [toX(x + nx * ww / 2), toY(y + ny * ww / 2), 0.45, toX(x - nx * ww / 2), toY(y - ny * ww / 2), 0.45];
        });
        mat.uniforms.uA.value = (1 - e.t / e.life) * 1.3;
        break;
      }
      case 'bolt': {
        const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([lerp(e.x1, e.x2, u) + (i && i < 12 ? rnd(-14, 14) : 0), lerp(e.y1, e.y2, u) + (i && i < 12 ? rnd(-14, 14) : 0)]); }
        setRibbon(m.geometry, (i) => { const p = pts[i]; return [toX(p[0]), toY(p[1]) + 0.025, 0.5, toX(p[0]), toY(p[1]) - 0.025, 0.5]; });
        mat.uniforms.uA.value = 1.6 * (1 - e.t / e.life);
        break;
      }
      case 'whip': {
        if (!e.pts) return;
        setRibbon(m.geometry, (i, u) => { const p = e.pts[Math.min(e.pts.length - 1, i)]; const w = 6 * (1 - u * 0.6); return [toX(p[0]), toY(p[1] - w), 0.4, toX(p[0]), toY(p[1] + w), 0.4]; });
        mat.uniforms.uA.value = 1.3 * (1 - e.t / e.life);
        break;
      }
      case 'dragon': {
        const pts = e.pts; if (pts.length < 3) { m.visible = false; return; }
        m.visible = true;
        const a = Math.min(1, (e.life - e.t) / 20);
        const v3 = pts.map((p, i) => new T3.Vector3(toX(p[0]), toY(p[1]), Math.sin(i * 0.35 + time * 2) * 0.7));
        const curve = new T3.CatmullRomCurve3(v3);
        const segs = Math.max(8, pts.length * 2), rad = e.w * S * 0.55;
        const tube = new T3.TubeGeometry(curve, segs, rad, 10, false);
        const pos = tube.attributes.position.array, ring = 11;
        for (let s = 0; s <= segs; s++) { const c = curve.getPointAt(s / segs), k = 0.15 + 0.85 * Math.pow(s / segs, 0.7); for (let j = 0; j < ring; j++) { const q = (s * ring + j) * 3; pos[q] = c.x + (pos[q] - c.x) * k; pos[q + 1] = c.y + (pos[q + 1] - c.y) * k; pos[q + 2] = c.z + (pos[q + 2] - c.z) * k; } }
        tube.attributes.position.needsUpdate = true; tube.computeVertexNormals();
        const body = m.userData.body; body.geometry.dispose(); body.geometry = tube;
        body.material.uniforms.uA.value = a; body.material.uniforms.uTime.value = time;
        m.userData.headMat.uniforms.uA.value = a;
        const hp = curve.getPointAt(1), tg = curve.getTangentAt(1);
        const head = m.userData.head; head.position.copy(hp); head.scale.setScalar(e.w / 44);
        // living trail: embers / droplets streaming off the body
        if (G.parts && a > 0.3) { const th = THEMES[e.theme] || THEMES.normal, k = e.theme === 'water' ? 'drop' : e.theme === 'thunder' ? 'spark' : 'ember';
          for (let n = 0; n < 7; n++) { const pp = pts[Math.floor(Math.random() * pts.length)]; G.parts.push({ x: pp[0] + rnd(-14, 14), y: pp[1] + rnd(-14, 14), vx: rnd(-1.5, 1.5), vy: rnd(-2.5, 0.5), life: 26, max: 26, s: rnd(3, 6), c: Math.random() < 0.5 ? th.l : th.m, k, g: k === 'drop' ? 0.15 : -0.04 }); } }
        head.quaternion.setFromUnitVectors(new T3.Vector3(1, 0, 0), tg.normalize());
        break;
      }
    }
  }
  function syncFx(list) {
    const seen = new Set();
    for (const e of list) {
      if (!FX3D[e.type]) continue;
      let m = fxMeshes.get(e);
      if (!m) { m = makeFxMesh(e); if (!m) continue; fxMeshes.set(e, m); }
      updateFxMesh(m, e); seen.add(e);
    }
    for (const [e, m] of fxMeshes) if (!seen.has(e)) { disposeFx(m); fxMeshes.delete(e); }
    api.stats.fx = fxMeshes.size;
  }

  // ---------------- actors: VRM or 2D-anime billboard ----------------
  function loadVRM(key, url) {
    if (!window.THREE_VRM || !T3.GLTFLoader || api.vrmLoading[key]) return;
    api.vrmLoading[key] = 1;
    const loader = new T3.GLTFLoader();
    loader.register(p => new THREE_VRM.VRMLoaderPlugin(p));
    loader.load(url, gltf => {
      const vrm = gltf.userData.vrm; if (!vrm) return;
      THREE_VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene);
      THREE_VRM.VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse(o => { o.frustumCulled = false; if (o.isMesh) { o.castShadow = true; } });
      const box = new T3.Box3().setFromObject(vrm.scene), h = Math.max(0.5, box.max.y - box.min.y);
      const root = new T3.Group(), turn = new T3.Group(), spin = new T3.Group(); root.add(turn); turn.add(spin); spin.add(vrm.scene); scene.add(root);
      const blade = new T3.Mesh(new T3.BoxGeometry(0.035, 0.012, 0.95), new T3.MeshBasicMaterial({ color: 0xdddddd })); blade.visible = false; scene.add(blade);
      api.vrm[key] = { vrm, root, turn, spin, blade, h, blink: 0 };
    }, undefined, err => { console.warn('VRM load failed', key, err); });
  }
  const vUp = new T3.Vector3(), q = new T3.Quaternion(), vA = new T3.Vector3(), vB = new T3.Vector3();
  function poseVRM(E, a, dt) {
    const { vrm, root, turn, spin, blade } = E, H = vrm.humanoid;
    const bone = n => H.getNormalizedBoneNode(n);
    const pose = a.pose, s = (a.scale || 1) * 1.62 / E.h;
    root.visible = true;
    root.position.set(toX(a.x), toY(a.y), 0);
    root.scale.set(s * (a.face < 0 ? -1 : 1), s, s);
    turn.rotation.y = Math.PI / 2 - 0.55;
    spin.rotation.set(0, 0, 0);
    if (pose.spin) { spin.position.set(0, 0.8 / s, 0); spin.rotation.x = pose.spin; vrm.scene.position.set(0, -0.8 / s, 0); } else { spin.position.set(0, 0, 0); vrm.scene.position.set(0, 0, 0); }
    const setDir = (n, rest, x, y, z) => { const b = bone(n); if (!b) return; vA.set(x, y, z).normalize(); b.quaternion.setFromUnitVectors(rest, vA); };
    const restR = new T3.Vector3(-1, 0, 0), restL = new T3.Vector3(1, 0, 0), restD = new T3.Vector3(0, -1, 0);
    const [tf, bf] = legPose(pose, false), [tb, bb] = legPose(pose, true);
    setDir('rightUpperLeg', restD, 0, -Math.cos(tf), Math.sin(tf)); const rl = bone('rightLowerLeg'); if (rl) rl.quaternion.setFromAxisAngle(vUp.set(1, 0, 0), bf);
    setDir('leftUpperLeg', restD, 0, -Math.cos(tb), Math.sin(tb)); const ll = bone('leftLowerLeg'); if (ll) ll.quaternion.setFromAxisAngle(vUp.set(1, 0, 0), bb);
    const ang = pose.swing !== undefined ? pose.swing : 0.95 - Math.sin(pose.run || 0) * 0.6;
    const ang2 = pose.arm2 !== undefined ? pose.arm2 : (pose.swing !== undefined ? pose.swing + 0.5 : 0.9 + Math.sin(pose.run || 0) * 0.6);
    setDir('rightUpperArm', restR, -0.35, -Math.sin(ang), Math.cos(ang)); const rla = bone('rightLowerArm'); if (rla) rla.quaternion.setFromAxisAngle(vUp.set(0, 1, 0), -0.25);
    setDir('leftUpperArm', restL, 0.35, -Math.sin(ang2), Math.cos(ang2)); const lla = bone('leftLowerArm'); if (lla) lla.quaternion.setFromAxisAngle(vUp.set(0, 1, 0), 0.25);
    const sp = bone('spine'); if (sp) sp.quaternion.setFromAxisAngle(vUp.set(1, 0, 0), (pose.run ? 0.25 : 0.05) + (pose.shout ? 0.15 : 0));
    const hd = bone('head'); if (hd) hd.quaternion.setFromAxisAngle(vUp.set(0, 1, 0), 0.35);
    const hips = bone('hips'); if (hips) hips.position.y = (hips.userData.y0 === undefined ? (hips.userData.y0 = hips.position.y) : hips.userData.y0) + (pose.run ? -Math.abs(Math.sin(pose.run)) * 0.03 : 0) - (pose.crouch || 0) * 0.15;
    const em = vrm.expressionManager;
    if (em) {
      E.blink = (E.blink + dt) % 4;
      const set = (n, v) => { try { em.setValue(n, v); } catch (e) { } };
      set('blink', pose.hurt || pose.sleep ? 1 : E.blink > 3.85 ? 1 : 0);
      set('angry', pose.shout ? 1 : 0); set('aa', pose.shout ? 0.8 : 0); set('sad', pose.hurt ? 0.8 : 0);
    }
    vrm.update(dt);
    // sword along forearm
    const hand = H.getRawBoneNode('rightHand'), elbow = H.getRawBoneNode('rightLowerArm');
    if (hand && elbow && a.ch && !(a.look && a.look.noSword) && !a.boss) {
      hand.getWorldPosition(vA); elbow.getWorldPosition(vB);
      const dir = vA.clone().sub(vB).normalize();
      blade.visible = true; blade.material.color.set((a.look && a.look.blade) || '#cccccc');
      blade.position.copy(vA).addScaledVector(dir, 0.48 * (a.scale || 1));
      blade.scale.setScalar(a.scale || 1);
      blade.quaternion.setFromUnitVectors(vUp.set(0, 0, 1), dir);
    } else blade.visible = false;
  }
  function billboard(id, w, h) {
    let B = billboards[id];
    if (!B) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const tex = new T3.CanvasTexture(c); tex.minFilter = T3.LinearFilter;
      const mesh = new T3.Mesh(new T3.PlaneGeometry(w * S, h * S), new T3.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.03, fog: false, color: 0xe0e0e0 }));
      mesh.renderOrder = 1; scene.add(mesh);
      B = billboards[id] = { c, g: c.getContext('2d'), tex, mesh, w, h };
    }
    return B;
  }
  function blob(id) {
    let m = shadows[id];
    if (!m) { m = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); shadows[id] = m; }
    return m;
  }
  function syncActors(actors, dt) {
    const used = new Set(), usedV = new Set(), usedC = new Set();
    for (const a of actors) {
      const sh = blob(a.id); used.add(a.id);
      const air = Math.max(0, GY - a.y) * S;
      sh.visible = true; sh.position.set(toX(a.x), 0.02, 0.05); const ss = (a.boss ? 1.5 : 0.9) * (a.scale || 1) * Math.max(0.35, 1 - air * 0.4); sh.scale.set(ss * 1.4, ss * 0.6, 1);
      sh.material.opacity = (a.alpha === undefined ? 1 : a.alpha) * Math.max(0.2, 1 - air * 0.5);
      const E = api.vrm[a.key];
      if (E && !a.custom) { poseVRM(E, a, dt); usedV.add(a.key); if (billboards[a.id]) billboards[a.id].mesh.visible = false; continue; }
      const build = !api.no3dChars && typeof CHIBI3D !== 'undefined' && !a.custom && CHIBI3D[a.key];
      if (build) {
        let M = api.chibi[a.key];
        if (!M) { M = api.chibi[a.key] = build(a.look || {}); scene.add(M.root); }
        CHIBI3D.pose(M, a, dt); usedC.add(a.key);
        M.root.visible = (a.alpha === undefined || a.alpha > 0.4) || (time * 20 % 2 < 1);
        if (billboards[a.id]) billboards[a.id].mesh.visible = false; continue;
      }
      const big = a.boss ? [600, 480, 300, 440] : [380, 320, 190, 290];
      const B = billboard(a.id, big[0], big[1]);
      B.tick = (B.tick || 0) + 1;
      if (B.tick % 2 === (a.boss ? 0 : 1) || !B.drawn) { B.drawn = 1; const g = B.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, B.w, B.h); a.draw(g, big[2], big[3]); B.tex.needsUpdate = true; }
      B.mesh.visible = true;
      B.mesh.position.set(toX(a.x) + (B.w / 2 - big[2]) * S, toY(a.y) - (B.h / 2 - big[3]) * S, a.z || 0);
    }
    for (const id in billboards) if (!used.has(id)) billboards[id].mesh.visible = false;
    for (const id in shadows) if (!used.has(id)) shadows[id].visible = false;
    for (const k in api.vrm) if (!usedV.has(k)) { api.vrm[k].root.visible = false; api.vrm[k].blade.visible = false; }
    for (const k in api.chibi) if (!usedC.has(k)) api.chibi[k].root.visible = false;
  }

  // ---------------- main render ----------------
  let last = performance.now(), slowAcc = 0, fastAcc = 0;
  api.quality = 2; // 2 full, 1 no shadows, 0 no bloom
  function setQuality(q) {
    api.quality = q;
    renderer.shadowMap.enabled = q >= 2; bloom.enabled = q >= 1;
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  api.setQuality = setQuality;
  api.render = function (G, actors, opts) {
    if (!api.ok) return;
    const now = performance.now(), raw = now - last, dt = Math.min(0.05, raw / 1000); last = now;
    if (!api.lockQuality && raw < 200) { // frame pacing based auto-quality
      if (raw > 24) { slowAcc++; fastAcc = 0; } else if (raw < 15) { fastAcc++; slowAcc = 0; }
      if (slowAcc > 90 && api.quality > 0) { setQuality(api.quality - 1); slowAcc = 0; }
      if (fastAcc > 600 && api.quality < 2) { setQuality(api.quality + 1); fastAcc = 0; }
    }
    time += dt;
    const key = G.S && G.S.bg || 'wisteria';
    if (key !== stageKey) buildStage(key);
    for (const f of stageAnim) f();
    // dawn lighting
    if (G.dawnMax) {
      const d = clamp(G.dawn / G.dawnMax, 0, 1), cfg = STAGE_CFG[key];
      hemi.color.set(cfg.hemi[0]).lerp(new T3.Color(0xffb070), d * 0.8); hemi.intensity = cfg.hemi[2] + d * 0.6;
      scene.fog.color.set(cfg.fog).lerp(new T3.Color(0xd08060), d * 0.7);
      if (backdrop) backdrop.material.color.setRGB(1, 1 - d * 0.15, 1 - d * 0.35);
      if (sunSprite) { sunSprite.visible = d > 0.55; sunSprite.position.y = -4 + (d - 0.55) * 40; }
    }
    // camera: shake + tilt (matches 2D overlay transform)
    const sx = G.shake > 0.5 ? rnd(-G.shake, G.shake) : 0, sy = G.shake > 0.5 ? rnd(-G.shake, G.shake) : 0;
    camera.position.set(-sx * S, CAMY + sy * S, D);
    camera.rotation.set(0, 0, G.tiltT > 0 ? G.tilt * 0.12 * Math.sin(Math.PI * G.tiltT / 120) : 0);
    api.lastShake = [sx, sy];
    if (api.camOverride) { const o = api.camOverride; camera.position.set(...o.pos); camera.lookAt(...o.look); }
    // flash lights
    for (const l of flashLights) { if (l.userData.life > 0) { l.userData.life -= dt * 3; l.intensity = Math.max(0, l.userData.life) * l.userData.power; } else l.intensity = 0; }
    if (G.flashScreen && G.flashScreen.t < 2) flash(activeP ? activeP().x : 640, 420, 'sun', 6);
    syncActors(actors || [], dt);
    syncFx((G.fx || []));
    syncProj(G.pproj || []);
    updateParticles((G.parts || []).concat(G.amb || []));
    bloom.strength = 0.85 + (G.flashScreen ? 0.5 : 0);
    composer.render(dt);
  };
  api.loadVRM = loadVRM;
  api.clear = function () {
    for (const [e, m] of fxMeshes) disposeFx(m);
    fxMeshes.clear();
  };
  try { init(); } catch (e) { console.error('3D init failed, using 2D', e); api.ok = false; }
  return api;
})();
