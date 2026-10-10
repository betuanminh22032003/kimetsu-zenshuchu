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
  let renderer, scene, camera, composer, bloom, grade, glc, hemi, moonLight, stageGroup, stageKey = null, stageAnim = [];
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
  const GRADE_FS = `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime; uniform float uVig; uniform float uGrain; uniform vec3 uLift; uniform vec3 uGain; uniform float uSat; uniform float uCon; uniform float uAA; varying vec2 vUv;
    const vec3 LU = vec3(.299, .587, .114);
    vec3 fxaa(vec2 uv){ vec2 px = 1. / uRes;
      vec3 nw = texture2D(tDiffuse, uv + vec2(-1., -1.) * px).rgb, ne = texture2D(tDiffuse, uv + vec2(1., -1.) * px).rgb, sw = texture2D(tDiffuse, uv + vec2(-1., 1.) * px).rgb, se = texture2D(tDiffuse, uv + vec2(1., 1.) * px).rgb, m = texture2D(tDiffuse, uv).rgb;
      float lnw = dot(nw, LU), lne = dot(ne, LU), lsw = dot(sw, LU), lse = dot(se, LU), lm = dot(m, LU);
      float mn = min(lm, min(min(lnw, lne), min(lsw, lse))), mx = max(lm, max(max(lnw, lne), max(lsw, lse)));
      vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), (lnw + lsw) - (lne + lse));
      float red = max((lnw + lne + lsw + lse) * .03125, 1. / 128.), rcp = 1. / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, -8., 8.) * px;
      vec3 a = .5 * (texture2D(tDiffuse, uv + dir * (1. / 3. - .5)).rgb + texture2D(tDiffuse, uv + dir * (2. / 3. - .5)).rgb);
      vec3 b = a * .5 + .25 * (texture2D(tDiffuse, uv - dir * .5).rgb + texture2D(tDiffuse, uv + dir * .5).rgb);
      float lb = dot(b, LU); return (lb < mn || lb > mx) ? a : b; }
    void main(){
      vec3 c = uAA > .5 ? fxaa(vUv) : texture2D(tDiffuse, vUv).rgb;
      c = c * uGain + uLift * (1. - c);
      float l = dot(c, LU); c = mix(vec3(l), c, uSat); c = (c - .5) * uCon + .5;
      vec2 q = (vUv - .5) * vec2(1.15, 1.); c *= 1. - uVig * dot(q, q) * 1.7;
      float n = fract(sin(dot(floor(vUv * uRes) + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453); c += (n - .5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
    }`;
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
      if (p._z === undefined) p._z = p.z !== undefined ? (Math.random() - 0.5) * 0.7 : p.k === 'smoke' ? Math.random() * 0.6 - 0.8 : Math.random() * 1.2 - 0.3;
      const a = s.geometry.attributes;
      a.position.array[i * 3] = toX(p.x); a.position.array[i * 3 + 1] = toY(p.y); a.position.array[i * 3 + 2] = p._z + (p.z || 0) * S;
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
    renderer.setPixelRatio(1); renderer.info.autoReset = false;
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
    scene = new T3.Scene();
    camera = new T3.PerspectiveCamera(FOV, W / H, 0.1, 500);
    camera.position.set(0, CAMY, D);
    hemi = new T3.HemisphereLight(0x8090c0, 0x1a1420, 1.0); scene.add(hemi);
    moonLight = new T3.DirectionalLight(0xc0ccff, 0.9); moonLight.position.set(-8, 14, 10);
    moonLight.castShadow = true; moonLight.shadow.mapSize.set(1024, 1024); moonLight.shadow.bias = -0.0008; moonLight.shadow.normalBias = 0.02; Object.assign(moonLight.shadow.camera, { left: -13, right: 13, top: 11, bottom: -5, near: 1, far: 60 });
    scene.add(moonLight); scene.add(moonLight.target);
    for (let i = 0; i < 4; i++) { const l = new T3.PointLight(0xffffff, 0, 9, 2); l.userData.life = 0; scene.add(l); flashLights.push(l); }
    makeAtlas();
    partAdd = makeParticles(2500, true); partNorm = makeParticles(1500, false);
    composer = new T3.EffectComposer(renderer);
    composer.addPass(new T3.RenderPass(scene, camera));
    bloom = new T3.UnrealBloomPass(new T3.Vector2(W / 2, H / 2), 0.9, 0.55, 0.9);
    composer.addPass(bloom);
    // final pass: FXAA + filmic grade + vignette + grain
    grade = new T3.ShaderPass({ uniforms: { tDiffuse: { value: null }, uRes: { value: new T3.Vector2(W, H) }, uTime: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.028 }, uLift: { value: new T3.Vector3(0.012, 0.014, 0.03) }, uGain: { value: new T3.Vector3(1.04, 1.03, 1.02) }, uSat: { value: 1.08 }, uCon: { value: 1.06 }, uAA: { value: 1 } },
      vertexShader: RIBBON_VS, fragmentShader: GRADE_FS });
    composer.addPass(grade);
    stageGroup = new T3.Group(); scene.add(stageGroup);
    // VRM manifest
    // VRM manifest: the loader libraries (~250KB) are only fetched when a .vrm model is actually listed
    const vrms = (window.ASSET_FILES || []).map(f => f.match(/^vrm\/(\w+)\.vrm$/)).filter(Boolean);
    if (vrms.length) loadScripts(['js/vendor/GLTFLoader.js', 'js/vendor/three-vrm.min.js'], () => { for (const m of vrms) loadVRM(m[1], (window.ASSET_BASE || 'assets/') + m[0]); });
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
  let world = null;
  function buildStage(key) {
    stageKey = key; seed = 7 + key.length * 131;
    while (stageGroup.children.length) { const c = stageGroup.children.pop(); c.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.isSprite) [].concat(o.material).forEach(m => m.dispose()); }); }
    stageAnim = []; world = null;
    if (typeof WORLD3D !== 'undefined' && WORLD3D) { // fully 3D procedural environment
      world = WORLD3D.build(key, { scene, group: stageGroup, camera, renderer, hemi, sun: moonLight, q: api.quality });
      world.setQuality(api.quality); return;
    }
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
  const PROJ3D = { tiger: 1, crescent: 1, claws: 1, flail: 1, meteor: 1, axe: 1, blade: 1 };
  const spikeBall = (r) => { const g = new T3.Group(), m = new T3.MeshToonMaterial({ color: 0x7a7e84 }), sp = new T3.MeshToonMaterial({ color: 0xa0a6ae });
    g.add(new T3.Mesh(new T3.IcosahedronGeometry(r, 1), m));
    for (let i = 0; i < 14; i++) { const d = new T3.Vector3(Math.sin(i * 2.4) * Math.cos(i * 1.1), Math.cos(i * 2.4), Math.sin(i * 1.7)).normalize(); const c = new T3.Mesh(new T3.ConeGeometry(r * 0.28, r * 0.8, 5), sp); c.position.copy(d.clone().multiplyScalar(r * 1.05)); c.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), d); g.add(c); }
    g.traverse(o => { o.castShadow = true; }); return g; };
  api.handlesProj = k => !!PROJ3D[k];
  const projMeshes = new Map();
  function fireMat(theme, mask) {
    const th = THEMES[theme] || THEMES.flame;
    return new T3.ShaderMaterial({ uniforms: { uMask: { value: mask }, uTime: { value: 0 }, uA: { value: 1 }, uC1: { value: col3(th.d) }, uC2: { value: col3(th.m) }, uC3: { value: col3(th.l) }, uSeed: { value: Math.random() * 10 } },
      vertexShader: RIBBON_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide });
  }
  function makeProj(p) {
    const g = new T3.Group(); g.frustumCulled = false;
    if (p.k === 'flail' || p.k === 'meteor') {
      const R = (p.k === 'meteor' ? 46 : 22) * S, ball = spikeBall(R); g.add(ball); g.userData.ball = ball;
      if (p.k === 'flail') { const ch = new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 1, 5), new T3.MeshToonMaterial({ color: 0x9a9aa0 })); ch.frustumCulled = false; scene.add(ch); g.userData.chain = ch; }
      else { const tr = new T3.Mesh(new T3.CylinderGeometry(R * 0.9, R * 0.3, 3, 14, 1, true), new T3.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.4, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide })); tr.position.y = 1.6; g.add(tr); }
    } else if (p.k === 'axe') {
      const m = new T3.MeshToonMaterial({ color: 0x8a8e94 }), hm = new T3.MeshToonMaterial({ color: 0x5a3a1a });
      const sh = new T3.Shape(); sh.moveTo(0, -0.1); sh.quadraticCurveTo(0.6, -0.5, 0.7, 0); sh.quadraticCurveTo(0.6, 0.5, 0, 0.1); sh.closePath();
      const hd = new T3.Mesh(new T3.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }), m); hd.position.z = -0.03; const hl = new T3.Mesh(new T3.BoxGeometry(0.64, 0.1, 0.08), hm); hl.position.x = -0.28;
      const spin = new T3.Group(); spin.add(hd, hl); g.add(spin); g.userData.spin = spin;
    } else if (p.k === 'blade') {
      const m = new T3.MeshToonMaterial({ color: 0xaab0c0, emissive: 0x202430 }), spin = new T3.Group();
      for (const s2 of [1, -1]) { const b = new T3.Mesh(new T3.BoxGeometry(0.44, 0.06, 0.02), m); b.position.x = s2 * 0.22; spin.add(b); }
      const ring = new T3.Mesh(new T3.TorusGeometry(0.44, 0.012, 4, 32), new T3.MeshBasicMaterial({ color: col3((THEMES[p.theme] || THEMES.normal).l), transparent: true, opacity: 0.7, blending: T3.AdditiveBlending, depthWrite: false }));
      spin.add(ring); g.add(spin); g.userData.spin = spin;
    } else if (p.k === 'tiger') {
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
    if (g.userData.ball) {
      g.position.set(toX(p.x), toY(p.y), 0); g.userData.ball.rotation.set(p.t * 0.2, p.t * 0.3, 0);
      const ch = g.userData.chain; if (ch && p.P) { const hx = toX(p.P.x + p.P.face * 20), hy = toY(p.P.y - 85), hz = (p.P.z || 0) * S, bx = toX(p.x), by = toY(p.y), bz = (p.z || 0) * S, len = Math.hypot(bx - hx, by - hy, bz - hz) || 0.01;
        ch.position.set((hx + bx) / 2, (hy + by) / 2, (hz + bz) / 2); ch.scale.set(1, len, 1); ch.quaternion.setFromUnitVectors(new T3.Vector3(0, 1, 0), new T3.Vector3((bx - hx) / len, (by - hy) / len, (bz - hz) / len)); }
      return;
    }
    if (g.userData.spin) { g.position.set(toX(p.x), toY(p.y), 0); g.userData.spin.rotation.z = -p.t * (p.k === 'blade' ? 0.6 : 0.5) * (p.face || 1); return; }
    if (p.k === 'tiger') {
      g.position.set(toX(p.x), toY(p.y), 0.5); g.userData.zfix = 0.5; g.scale.set(p.face * (p.r / 120), p.r / 120, 1);
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
    for (const p of list) { if (!PROJ3D[p.k]) continue; let g = projMeshes.get(p); if (!g) { g = makeProj(p); projMeshes.set(p, g); } updateProj(g, p); if (g.userData.zfix) g.position.z = (p.z || 0) * S + g.userData.zfix; else g.position.z = (p.z || 0) * S; seen.add(p); }
    for (const [p, g] of projMeshes) if (!seen.has(p)) { if (g.userData.chain) disposeFx(g.userData.chain); disposeFx(g); projMeshes.delete(p); }
  }

  // ---------------- 3D demon attacks: enemy projectiles + hazards ----------------
  // telegraphs (dashed lines, warning circles, kanji) stay on the 2D overlay for readability;
  // the actual attacks are real 3D objects lit by the stage.
  api.handlesEProj = () => api.ok;
  api.handlesHaz = () => api.ok;
  const eMeshes = new Map(), hMeshes = new Map(), texCache = {};
  const tmat = (c, o) => new T3.MeshToonMaterial(Object.assign({ color: c }, o || {}));
  const amat = (c, op) => new T3.MeshBasicMaterial({ color: c, transparent: true, opacity: op === undefined ? 0.85 : op, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide, fog: false });
  const cTex = (k, w, h, f) => texCache[k] || (texCache[k] = canvasTex(w, h, f));
  const radialTex = () => cTex('radial', 128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  function crescentGeo() {
    const sh = new T3.Shape(); sh.absarc(0, 0, 1, -1.3, 1.3, false); sh.absarc(-0.35, 0, 0.85, 1.2, -1.2, true);
    return new T3.ShapeGeometry(sh, 10);
  }
  // thick line segments as one quad mesh (WebGL lines are 1px)
  function stripGeo(seg, w) {
    const out = [];
    for (let i = 0; i < seg.length; i += 6) {
      const [x1, y1, z1, x2, y2, z2] = seg.slice(i, i + 6), a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
      out.push(x1 + nx, y1 + ny, z1, x1 - nx, y1 - ny, z1, x2 + nx, y2 + ny, z2, x1 - nx, y1 - ny, z1, x2 - nx, y2 - ny, z2, x2 + nx, y2 + ny, z2);
    }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(out, 3)); return g;
  }
  function glowSprite(c, size) { const m = new T3.Sprite(new T3.SpriteMaterial({ map: radialTex(), color: c, blending: T3.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); m.scale.set(size, size, 1); return m; }
  function makeEProj(p) {
    const g = new T3.Group(), R = (p.r || 12) * S, add = (m) => { g.add(m); return m; };
    g.userData.spin = 0;
    switch (p.shape) {
      case 'temari': { const tx = cTex('temari' + (Math.floor(p.r) % 4), 64, 64, (c) => { const cl = ['#e04040', '#e8b030', '#4080e0', '#40b060']; const k = Math.floor(p.r) % 4; c.fillStyle = cl[k]; c.fillRect(0, 0, 64, 64); for (let i = 0; i < 4; i++) { c.fillStyle = cl[(k + i + 1) % 4]; c.fillRect(0, 6 + i * 15, 64, 6); } c.strokeStyle = '#fff'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(i * 8, 0); c.lineTo(i * 8 + 16, 64); c.stroke(); } });
        add(new T3.Mesh(new T3.SphereGeometry(R, 16, 12), tmat(0xffffff, { map: tx }))).castShadow = true; g.userData.spin = 0.25; break; }
      case 'fist': { const b = add(new T3.Mesh(new T3.SphereGeometry(1, 14, 10), amat('#4aa8ff', 0.55))); b.scale.set(R * 1.8, R, R); b.position.x = -R * 0.6;
        add(new T3.Mesh(new T3.SphereGeometry(R * 0.6, 10, 8), amat('#e8f8ff', 0.9)));
        const r = add(new T3.Mesh(new T3.TorusGeometry(R * 0.85, R * 0.08, 6, 20, 2.4), amat('#bff', 0.9))); r.rotation.z = -1.2; g.userData.dir = 1; break; }
      case 'crescent': { const cg = crescentGeo(); const m = add(new T3.Mesh(cg, amat('#a878ff', 0.8))); m.scale.setScalar(R); const e = add(new T3.Mesh(new T3.TorusGeometry(R, R * 0.04, 4, 20, 2.6), amat('#ffffff', 0.9))); e.rotation.z = -1.3;
        for (let i = 0; i < 3; i++) { const sm = add(new T3.Mesh(new T3.TorusGeometry(0.08, 0.008, 4, 10, 2.2), amat('#f4e8ff', 0.9))); sm.position.set(rnd(-R, R * 0.5), rnd(-R, R), 0.02); sm.rotation.z = rnd(0, 6); }
        g.userData.dir = 1; break; }
      case 'sickle': add(new T3.Mesh(new T3.TorusGeometry(R, R * 0.12, 6, 24, Math.PI * 1.3), new T3.MeshBasicMaterial({ color: 0xff2040 }))); add(glowSprite('#ff0020', R * 3)); g.userData.spin = 0.4; break;
      case 'obi': { const tx = cTex('obi', 128, 16, (c) => { c.fillStyle = '#c03060'; c.fillRect(0, 0, 128, 16); c.fillStyle = '#ffd040'; for (let i = 0; i < 5; i++) c.fillRect(10 + i * 26, 0, 6, 16); c.fillStyle = '#7a1838'; c.fillRect(0, 0, 128, 2); c.fillRect(0, 14, 128, 2); });
        const m = add(new T3.Mesh(new T3.PlaneGeometry(R * 3, 0.16, 12, 1), tmat(0xffffff, { map: tx, side: T3.DoubleSide }))); g.userData.wave = m; g.userData.dir = 1; break; }
      case 'needle': { const m = add(new T3.Mesh(new T3.CylinderGeometry(0.01, 0.004, 0.3, 5), amat('#ffffee', 1))); m.rotation.z = -Math.PI / 2; g.userData.dir = 1; break; }
      case 'thread': { const m = add(new T3.Mesh(new T3.CylinderGeometry(0.008, 0.008, 0.5, 4), amat('#ffffff', 1))); m.rotation.z = -Math.PI / 2; m.position.x = -0.15; add(glowSprite('#ffffff', 0.25)); g.userData.dir = 1; break; }
      case 'fish': { const bm = tmat('#e8b0c0'); const b = add(new T3.Mesh(new T3.SphereGeometry(1, 12, 8), bm)); b.scale.set(0.16, 0.08, 0.07); const t = add(new T3.Mesh(new T3.ConeGeometry(0.08, 0.12, 6), bm)); t.rotation.z = Math.PI / 2; t.position.x = -0.19; t.scale.z = 0.3;
        for (const z of [-0.06, 0.06]) { const e = add(new T3.Mesh(new T3.SphereGeometry(0.018, 6, 4), new T3.MeshBasicMaterial({ color: 0x300000 }))); e.position.set(0.08, 0.02, z); } g.userData.dir = 1; g.userData.wig = 1; break; }
      case 'lotus': { const pm = tmat('#d2f0ff', { emissive: new T3.Color('#305070') }); for (let i = 0; i < 8; i++) { const pv = new T3.Group(); pv.rotation.z = i / 8 * TAU; const pe = new T3.Mesh(new T3.SphereGeometry(1, 8, 6), pm); pe.scale.set(0.06, 0.14, 0.03); pe.position.y = 0.12; pe.rotation.x = 0.3; pv.add(pe); g.add(pv); } add(new T3.Mesh(new T3.SphereGeometry(0.05, 8, 6), amat('#ffffff', 0.9))); g.userData.spin = 0.1; break; }
      case 'icicle': { const m = add(new T3.Mesh(new T3.ConeGeometry(0.1, 0.55, 6), tmat('#dff4ff', { emissive: new T3.Color('#4080b0'), transparent: true, opacity: 0.9 }))); m.rotation.z = -Math.PI / 2; m.castShadow = true; g.userData.dir = 1; break; }
      case 'moonbeam': { const m = add(new T3.Mesh(new T3.CylinderGeometry(R, R, 4.2, 16, 1, true), amat('#b090ff', 0.45))); m.position.y = 1.9; const c = add(new T3.Mesh(new T3.CylinderGeometry(R * 0.35, R * 0.35, 4.2, 10, 1, true), amat('#ffffff', 0.7))); c.position.y = 1.9;
        for (let i = 0; i < 4; i++) { const sm = add(new T3.Mesh(new T3.TorusGeometry(0.14, 0.01, 4, 12, 2.2), amat('#ffffff', 0.9))); sm.position.set(rnd(-0.2, 0.2), rnd(0.3, 3), 0.1); sm.rotation.z = rnd(0, 6); } break; }
      case 'mouth': { add(new T3.Mesh(new T3.SphereGeometry(R, 14, 10), tmat('#c090d0'))).castShadow = true; const mo = add(new T3.Mesh(new T3.CircleGeometry(R * 0.6, 14), new T3.MeshBasicMaterial({ color: 0x601040 }))); mo.position.z = R * 0.98; g.userData.mouth = mo; break; }
      case 'sleep': { add(glowSprite('#c080ff', R * 3.4)); add(new T3.Mesh(new T3.SphereGeometry(R * 0.55, 12, 8), amat('#ffffff', 0.7)));
        const tx = cTex('sleepK', 64, 64, (c) => { c.font = 'bold 44px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#5a1a8a'; c.strokeText('眠', 32, 34); c.fillStyle = '#fff'; c.fillText('眠', 32, 34); });
        const sp = new T3.Sprite(new T3.SpriteMaterial({ map: tx, depthWrite: false, transparent: true, fog: false })); sp.scale.set(0.34, 0.34, 1); sp.position.z = 0.05; g.add(sp); break; }
      case 'wind': for (let i = 0; i < 3; i++) { const m = add(new T3.Mesh(new T3.TorusGeometry(R - i * 0.07, 0.012, 4, 20, 3.5), amat('#eeeeee', 0.8))); m.rotation.z = i; } g.userData.spin = 0.3; break;
      case 'hand': { const hm = tmat('#7d9a58'); add(new T3.Mesh(new T3.SphereGeometry(R, 12, 10), hm)).castShadow = true; for (let i = 0; i < 4; i++) { const f = new T3.Mesh(new T3.CapsuleGeometry(0.04, 0.12, 3, 6), hm); const a = -0.8 + i * 0.5; f.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); f.rotation.z = a - Math.PI / 2; g.add(f); } g.userData.dir = 1; break; }
      default: { add(new T3.Mesh(new T3.SphereGeometry(R, 12, 10), tmat(p.color || '#f44', { emissive: new T3.Color(p.color || '#f44').multiplyScalar(0.4) }))); add(glowSprite(p.color || '#f44', R * 3)); }
    }
    g.traverse(o => { o.frustumCulled = false; });
    scene.add(g); return g;
  }
  function updateEProj(g, p) {
    g.visible = !(p.delay > 0);
    g.position.set(toX(p.x), toY(p.y), (p.z || 0) * S + 0.05);
    const ang = Math.atan2(p.vy || 0, p.vx || 0.0001);
    if (g.userData.dir) g.rotation.z = -ang;
    if (g.userData.spin) g.rotation.z = -(p.t || 0) * g.userData.spin;
    if (p.shape === 'icicle' || p.shape === 'needle') g.rotation.z = -ang;
    if (g.userData.wig) g.rotation.y = Math.sin((p.t || 0) * 0.5) * 0.4;
    if (g.userData.mouth) g.userData.mouth.scale.y = 0.4 + Math.abs(Math.sin((p.t || 0) * 0.3)) * 0.8;
    if (g.userData.wave) { const pos = g.userData.wave.geometry.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 12 + (p.t || 0) * 0.5) * 0.04); pos.needsUpdate = true; }
    if (p.shape === 'moonbeam') g.position.y = 0;
  }
  // ---------------- demon blood-art visuals ----------------
  // Every hazard knows who cast it (h.bk), so each demon has its own colour, crest and shapes:
  // Rui's silk, Daki's obi, Muzan's thorned tentacles, Kokushibo's moons, Douma's ice, Hantengu's
  // wood dragons and lightning, Akaza's compass shockwaves, Gyokko's water pot, Gyutaro's sickles.
  const HAZ_THEME = { thread: 'normal', moon: 'moon', whip: 'blood', obi: 'love', claw: 'stone', arrow: 'demon', frost: 'mist', storm: 'water', bolt: 'thunder' };
  const HCOL = { thread: '#f4f4ff', moon: '#c8a8ff', whip: '#ff1838', obi: '#ff4c8a', claw: '#e0a060', arrow: '#ff3030', bolt: '#fff070', frost: '#bfe8ff', storm: '#7ad0ff' };
  const DCOL = { temoni: '#8fd060', susamaru: '#ff5040', kyogai: '#e0a060', rui: '#f2f2ff', enmu: '#c080ff', akaza: '#5ac8ff', akaza2: '#5ac8ff', daki: '#ff4c8a', gyutaro: '#ff2448', gyokko: '#3aa8ff', hantengu: '#ffe060', doma: '#bfe8ff', mini_doma: '#bfe8ff', kokushibo: '#b48cff', muzan: '#ff1838' };
  const DCREST = { temoni: '鬼', susamaru: '毬', kyogai: '鼓', rui: '糸', enmu: '夢', akaza: '破', akaza2: '破', daki: '帯', gyutaro: '鎌', gyokko: '壺', hantengu: '雷', doma: '氷', mini_doma: '氷', kokushibo: '月', muzan: '無' };
  function hazCol(h) { const a = h.a || {}; return a.ice ? '#cfefff' : a.moon ? '#c8a8ff' : a.water ? '#48a8ff' : a.blood ? '#ff1838' : a.poison ? '#ff2448' : HCOL[h.style] || DCOL[h.bk] || '#ff4040'; }
  const geoC = {};
  const sgeo = (k, f) => { if (!geoC[k]) { geoC[k] = f(); geoC[k].userData.shared = true; } return geoC[k]; };
  const UV_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  // warning band: bright rims, a core that fills in as the strike nears, chevrons streaming along it
  const TELE_FS = `uniform vec3 uC; uniform float uP, uTime, uLen, uA; varying vec2 vUv;
    void main(){ float d = abs(vUv.y - .5) * 2.;
      float edge = smoothstep(.2, 0., abs(d - .8));
      float core = smoothstep(.55, 0., d) * (.12 + .9 * uP * uP);
      float ch = fract(vUv.x * uLen - d * .5 - uTime * 2.4); float chev = smoothstep(0., .1, ch) * smoothstep(.42, .28, ch) * (1. - d);
      float ends = smoothstep(0., .06, vUv.x) * smoothstep(1., .94, vUv.x);
      float pulse = .72 + .28 * sin(uTime * (7. + uP * 28.));
      float a = clamp((edge * .85 + core + chev * .5) * ends * pulse * uA, 0., 1.);
      gl_FragColor = vec4(mix(uC, vec3(1.), core * .55), a); }`;
  // the blow itself: a white-hot core inside a flickering coloured glow
  const ACT_FS = `uniform vec3 uC; uniform float uA, uTime, uLen, uSeed; varying vec2 vUv; ${NOISE}
    void main(){ float d = abs(vUv.y - .5) * 2.;
      float n = vnoise(vec2(vUv.x * uLen - uTime * 9., vUv.y * 3. + uSeed));
      float core = exp(-d * d * 14.), glow = exp(-d * 2.6) * (.45 + n * .8);
      float a = clamp((core * 1.2 + glow) * uA, 0., 1.);
      gl_FragColor = vec4(mix(uC, vec3(1.), core * .75), a); }`;
  const shMat = (fs, u) => new T3.ShaderMaterial({ uniforms: u, vertexShader: UV_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide });
  const teleMat = (c, len) => shMat(TELE_FS, { uC: { value: col3(c) }, uP: { value: 0 }, uTime: { value: 0 }, uLen: { value: len || 40 }, uA: { value: 1 } });
  const actMat = (c, len) => shMat(ACT_FS, { uC: { value: col3(c) }, uA: { value: 1 }, uTime: { value: 0 }, uLen: { value: len || 20 }, uSeed: { value: Math.random() * 10 } });
  const sigilTex = (k) => cTex('sigil' + k, 256, 256, (c) => {
    c.translate(128, 128); c.strokeStyle = c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 6;
    c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 122, 0, TAU); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 108, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 74, 0, TAU); c.stroke();
    c.font = 'bold 19px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const txt = ('血鬼術' + k).repeat(3); for (let i = 0; i < txt.length; i++) { c.save(); c.rotate(i / txt.length * TAU); c.fillText(txt[i], 0, -91); c.restore(); }
    c.lineWidth = 2.5; for (const o of [0, Math.PI / 3]) { c.beginPath(); for (let i = 0; i <= 3; i++) { const a = o + i / 3 * TAU - Math.PI / 2; i ? c.lineTo(Math.cos(a) * 74, Math.sin(a) * 74) : c.moveTo(Math.cos(a) * 74, Math.sin(a) * 74); } c.stroke(); }
    for (let i = 0; i < 24; i++) { c.save(); c.rotate(i / 24 * TAU); c.fillRect(-1.5, -122, 3, i % 2 ? 6 : 13); c.restore(); }
    c.font = 'bold 62px serif'; c.fillText(k, 0, 4);
  });
  const flakeTex = () => cTex('flake', 64, 64, (c) => { c.translate(32, 32); c.strokeStyle = '#fff'; c.lineWidth = 3; c.shadowColor = '#fff'; c.shadowBlur = 4; for (let i = 0; i < 6; i++) { c.save(); c.rotate(i / 6 * TAU); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -28); c.moveTo(0, -15); c.lineTo(-8, -23); c.moveTo(0, -15); c.lineTo(8, -23); c.stroke(); c.restore(); } });
  const barkTex = () => { const t = cTex('bark', 64, 128, (c) => { c.fillStyle = '#6a4a2a'; c.fillRect(0, 0, 64, 128); for (let i = 0; i < 26; i++) { c.strokeStyle = i % 3 ? '#4a3018' : '#8a6a42'; c.lineWidth = rnd(1, 3); c.beginPath(); const x = rnd(0, 64); c.moveTo(x, 0); c.bezierCurveTo(x + rnd(-8, 8), 40, x + rnd(-8, 8), 90, x + rnd(-6, 6), 128); c.stroke(); } }); t.wrapS = t.wrapT = T3.RepeatWrapping; return t; };
  const fleshTex = () => { const t = cTex('flesh', 64, 64, (c) => { c.fillStyle = '#c890a8'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#8a3a5a'; c.lineWidth = 1.5; for (let i = 0; i < 9; i++) { c.beginPath(); let x = rnd(0, 64), y = 0; c.moveTo(x, y); while (y < 64) { x += rnd(-6, 6); y += rnd(4, 9); c.lineTo(x, y); } c.stroke(); } }); t.wrapS = t.wrapT = T3.RepeatWrapping; return t; };
  const obiTex = () => { const t = cTex('obiL', 128, 32, (c) => { c.fillStyle = '#c03060'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#ffd040'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(16 + i * 32, 16, 7, 0, TAU); c.fill(); } c.fillStyle = '#e85a8a'; for (let i = 0; i < 4; i++) c.fillRect(i * 32, 13, 4, 6); c.fillStyle = '#6a1030'; c.fillRect(0, 0, 128, 4); c.fillRect(0, 28, 128, 4); c.fillStyle = '#ffd040'; c.fillRect(0, 4, 128, 1.5); c.fillRect(0, 26.5, 128, 1.5); }); t.wrapS = T3.RepeatWrapping; return t; };
  function spr(tex, c, size, op) { const m = new T3.Sprite(new T3.SpriteMaterial({ map: tex, color: c, blending: T3.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: op === undefined ? 1 : op })); m.scale.set(size, size, 1); m.frustumCulled = false; return m; }
  function groundSigil(k, c, op) { const m = new T3.Mesh(sgeo('gplane', () => new T3.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), new T3.MeshBasicMaterial({ map: sigilTex(k), color: c, transparent: true, opacity: op === undefined ? 0.9 : op, blending: T3.AdditiveBlending, depthWrite: false, fog: false, side: T3.DoubleSide })); m.frustumCulled = false; return m; }
  function groundRing(c, op) { const m = new T3.Mesh(sgeo('gring', () => new T3.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2)), amat(c, op || 0.8)); m.frustumCulled = false; return m; }
  function groundDisc(c, op) { const m = new T3.Mesh(sgeo('gplane', () => new T3.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), new T3.MeshBasicMaterial({ map: radialTex(), color: c, transparent: true, opacity: op === undefined ? 0.6 : op, blending: T3.AdditiveBlending, depthWrite: false, fog: false })); m.frustumCulled = false; return m; }
  // a tube along pts whose radius follows taper(u) — tentacles, wood dragons, silk
  function taperTube(pts, segs, rad, radial, taper) {
    const curve = new T3.CatmullRomCurve3(pts), geo = new T3.TubeGeometry(curve, segs, rad, radial, false), p = geo.attributes.position, c = new T3.Vector3();
    for (let i = 0; i <= segs; i++) { curve.getPointAt(i / segs, c); const k = taper(i / segs); for (let j = 0; j <= radial; j++) { const v = i * (radial + 1) + j; p.setXYZ(v, c.x + (p.getX(v) - c.x) * k, c.y + (p.getY(v) - c.y) * k, c.z + (p.getZ(v) - c.z) * k); } }
    geo.computeVertexNormals(); geo.userData.tip = curve.getPointAt(1); return geo;
  }
  const crescG = () => sgeo('cres', crescentGeo);
  const coneG = () => sgeo('spike', () => new T3.ConeGeometry(0.07, 0.5, 6).translate(0, 0.25, 0));
  const iceMat = () => tmat('#dff4ff', { emissive: new T3.Color('#3a78b0'), transparent: true, opacity: 0.92 });
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

  // ---- active lines: built in the line's own frame (x along it), so they're static meshes
  function makeLine(h, g, add) {
    const U = g.userData, L = Math.hypot(h.x2 - h.x1, h.y2 - h.y1) * S, hl = L / 2, ang = Math.atan2(h.y2 - h.y1, h.x2 - h.x1), c = HCOL[h.style] || DCOL[h.bk] || '#ff4040', w = h.w * S;
    g.position.set(toX((h.x1 + h.x2) / 2), toY((h.y1 + h.y2) / 2), (h.z || 0) * S); g.rotation.z = -ang;
    // the blow travels from the end nearest the demon
    const ex = Math.cos(ang), bx = h.bx !== undefined ? h.bx : h.src, base = (bx - (h.x1 + h.x2) / 2) * ex >= 0 ? 1 : -1;
    const body = new T3.Group(); g.add(body); U.body = body; U.base = base; U.hl = hl;
    const B = (m) => { m.frustumCulled = false; body.add(m); return m; };
    U.mats = [];
    const band = (wid, mat) => { const m = B(new T3.Mesh(new T3.PlaneGeometry(L, wid), mat)); if (mat.uniforms) U.mats.push(mat); return m; };
    const s = h.style;
    if (s === 'thread') { // Rui: three taut steel-silk strands that glint
      band(w * 1.6, actMat(c, 30)).material.uniforms.uA.value = 0.5;
      for (const o of [-1, 0, 1]) { const m = B(new T3.Mesh(new T3.PlaneGeometry(L, 0.018), amat('#ffffff', 1))); m.position.set(0, o * 0.05, o * 0.02); }
      U.glint = []; for (let i = 0; i < 9; i++) { const sp = B(spr(radialTex(), '#ffffff', 0.18)); sp.userData.u = Math.random(); U.glint.push(sp); }
    } else if (s === 'obi') { // Daki: a real silk sash, patterned and rippling
      band(w * 2.4, actMat(c, 20)).material.uniforms.uA.value = 0.55;
      const t = obiTex(), m = B(new T3.Mesh(new T3.PlaneGeometry(L, w * 1.5, 160, 1), tmat(0xffffff, { map: t, side: T3.DoubleSide, emissive: new T3.Color('#401020') })));
      t.repeat.set(L / 0.9, 1); m.castShadow = true; U.obi = m; U.obiX = Float32Array.from({ length: m.geometry.attributes.position.count }, (_, i) => m.geometry.attributes.position.getX(i));
    } else if (s === 'whip') { // Muzan: a thorned flesh tentacle lashing out of the dark
      band(w * 2.2, actMat('#ff1838', 20)).material.uniforms.uA.value = 0.6;
      const sd = Math.random() * 6, pts = []; for (let i = 0; i <= 40; i++) { const x = -hl + L * i / 40; pts.push(new T3.Vector3(x, Math.sin(x * 1.1 + sd) * 0.14, Math.cos(x * 0.7 + sd) * 0.18)); }
      const geo = taperTube(pts, 160, 0.11, 7, (u) => { const k = base > 0 ? u : 1 - u; return 0.25 + 0.75 * k; });
      const tm = tmat('#2a0408', { emissive: new T3.Color('#4a0010') }); B(new T3.Mesh(geo, tm)).castShadow = true;
      const thm = tmat('#9a1028', { emissive: new T3.Color('#500010') });
      for (let i = 0; i < 26; i++) { const x = rnd(-hl * 0.5, hl * 0.5), t = B(new T3.Mesh(coneG(), thm)); t.position.set(x, Math.sin(x * 1.1 + sd) * 0.14, Math.cos(x * 0.7 + sd) * 0.18); t.rotation.set(rnd(-1, 1), 0, (Math.random() < 0.5 ? 1 : -1) * rnd(0.6, 1.4)); t.scale.setScalar(rnd(0.5, 1)); }
    } else if (s === 'moon') { // Kokushibo: crescent moons of every size riding the cut
      band(w * 2.6, actMat(c, 20)); band(Math.max(0.03, w * 0.35), amat('#ffffff', 0.95));
      U.cres = []; for (let i = 0; i < 16; i++) { const big = i < 6, m = B(new T3.Mesh(big ? crescG() : sgeo('moonlet', () => new T3.TorusGeometry(1, 0.08, 4, 14, 2.4)), amat(big ? '#d8c0ff' : '#fff4ff', big ? 0.8 : 0.95)));
        const sc = big ? rnd(0.3, 0.75) : rnd(0.06, 0.16); m.scale.setScalar(sc); m.position.set(rnd(-5, 5) * (big ? 0.7 : 1), rnd(-0.35, 0.35) * (big ? 0.6 : 1.4), rnd(-0.2, 0.2)); m.rotation.z = rnd(0, TAU); m.userData.sc = sc; m.userData.sp = rnd(-0.08, 0.08); U.cres.push(m); }
    } else if (s === 'frost') { // Douma: a breath of frost that grows ice spikes and freezing mist
      band(w * 1.6, actMat('#7ac8ff', 12)).material.uniforms.uA.value = 0.45; band(0.04, amat('#ffffff', 0.8)); const im = iceMat();
      U.ice = []; for (let i = 0; i < 22; i++) { const m = B(new T3.Mesh(coneG(), im)); const up = Math.random() < 0.5 ? 1 : -1; m.position.set(rnd(-6, 6), up * rnd(0, w * 0.4), rnd(-0.3, 0.3)); m.rotation.set(rnd(-0.5, 0.5), 0, (up > 0 ? 0 : Math.PI) + rnd(-0.7, 0.7)); m.userData.sc = rnd(0.8, 2); m.scale.setScalar(0.01); m.castShadow = true; U.ice.push(m); }
      U.mist = []; for (let i = 0; i < 7; i++) { const sp = B(spr(radialTex(), '#a8d8ff', rnd(1, 1.8), 0.15)); sp.position.set(rnd(-5, 5), rnd(-0.3, 0.3), 0.1); U.mist.push(sp); }
    } else if (s === 'bolt') { // Sekido's lightning: a jagged forked bolt, re-struck every couple of frames
      U.zig = B(new T3.Mesh(ribbonGeo(18), ribbonMat('thunder', 0))); U.zigC = B(new T3.Mesh(ribbonGeo(18), amat('#ffffff', 1)));
      U.br = []; for (let i = 0; i < 4; i++) U.br.push(B(new T3.Mesh(ribbonGeo(6), amat('#fff3a0', 0.9))));
      U.mats.push(U.zig.material);
    } else if (s === 'storm') { // Akaza: blue-silver light scattered like snowflakes (青銀乱残光)
      band(w * 2.2, actMat(c, 20)); band(Math.max(0.025, w * 0.3), amat('#ffffff', 0.9));
      U.flakes = []; for (let i = 0; i < 9; i++) { const sp = B(spr(flakeTex(), '#bfeaff', rnd(0.25, 0.5))); sp.position.set(rnd(-5, 5), rnd(-0.3, 0.3), 0.05); sp.userData.r = rnd(-0.2, 0.2); U.flakes.push(sp); }
    } else if (s === 'arrow') { // Yahaba's arrows: red vectors streaming along the line
      band(w * 2, actMat(c, 20));
      U.arrows = []; for (let i = 0; i < 10; i++) { const m = B(new T3.Mesh(sgeo('arrowhead', () => { const sh = new T3.Shape(); sh.moveTo(0.18, 0); sh.lineTo(-0.1, 0.12); sh.lineTo(-0.04, 0); sh.lineTo(-0.1, -0.12); sh.lineTo(0.18, 0); return new T3.ShapeGeometry(sh); }), amat('#ff6060', 0.95))); m.userData.u = i / 10; U.arrows.push(m); }
    } else { // claw marks and anything else
      band(w * 2.2, actMat(c, 20)); band(Math.max(0.03, w * 0.3), amat('#ffffff', 0.9));
    }
    flash((h.x1 + h.x2) / 2, (h.y1 + h.y2) / 2, HAZ_THEME[s] || 'demon', 2.5);
  }
  function fadeAll(g, a) { // glows fade linearly, solid bodies hold then dissolve over the last 40%
    g.traverse(o => { const m = o.material; if (!m || m.uniforms) return; const ud = m.userData; if (ud.o0 === undefined) { ud.o0 = m.opacity; ud.tr = m.transparent; }
      if (m.blending === T3.AdditiveBlending) m.opacity = ud.o0 * a; else { const k = Math.min(1, a / 0.4); m.opacity = ud.o0 * k; if (!ud.tr && (k < 1) !== m.transparent) { m.transparent = k < 1; m.needsUpdate = true; } } });
  }
  function updateLine(g, h, a) {
    const U = g.userData, t = h.t || 0, rev = ease(t / 4);
    U.body.scale.x = Math.max(0.01, rev); U.body.position.x = U.base * U.hl * (1 - rev);
    for (const m of U.mats) { if (m.uniforms.uTime) m.uniforms.uTime.value = time; m.uniforms.uA.value = (m.userData.a0 || (m.userData.a0 = m.uniforms.uA.value)) * a * 1.3; }
    fadeAll(g, a);
    if (U.glint) U.glint.forEach(sp => { sp.userData.u = (sp.userData.u + 0.03) % 1; sp.position.x = (sp.userData.u - 0.5) * 10; sp.scale.setScalar(0.1 + Math.abs(Math.sin(time * 20 + sp.userData.u * 9)) * 0.2); });
    if (U.obi) { const p = U.obi.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = U.obiX[i]; p.setZ(i, Math.sin(x * 2.2 - t * 0.9) * 0.12); p.setY(i, (i < p.count / 2 ? 1 : -1) * h.w * S * 0.75 + Math.sin(x * 1.3 + t * 0.6) * 0.05); } p.needsUpdate = true; }
    if (U.cres) U.cres.forEach(m => { m.rotation.z += m.userData.sp; m.scale.setScalar(m.userData.sc * (0.6 + 0.6 * ease(t / 5))); });
    if (U.ice) U.ice.forEach((m, i) => { const k = ease((t - i * 0.15) / 3); m.scale.set(m.userData.sc * k, m.userData.sc * k * (a < 0.35 ? a / 0.35 : 1), m.userData.sc * k); });
    if (U.mist) U.mist.forEach(sp => { sp.position.x += 0.01; sp.scale.multiplyScalar(1.02); });
    if (U.flakes) U.flakes.forEach(sp => { sp.material.rotation += sp.userData.r; });
    if (U.arrows) U.arrows.forEach(m => { m.userData.u = (m.userData.u + 0.02) % 1; m.position.x = (m.userData.u - 0.5) * 12; });
    if (U.zig && (t % 2 === 0 || !U.zz)) { // re-strike the bolt
      const N = 18, pts = []; for (let i = 0; i <= N; i++) pts.push([(i / N - 0.5) * 14, i && i < N ? rnd(-0.22, 0.22) : 0]);
      const rib = (geo, P, wd) => setRibbon(geo, (i) => { const p = P[Math.min(i, P.length - 1)]; return [p[0], p[1] + wd, 0, p[0], p[1] - wd, 0]; });
      rib(U.zig.geometry, pts, 0.12); rib(U.zigC.geometry, pts, 0.025);
      U.br.forEach(m => { const k = 2 + Math.floor(Math.random() * (N - 4)), P = [pts[k]]; let [x, y] = pts[k]; const dy = Math.random() < 0.5 ? 1 : -1; for (let i = 1; i <= 6; i++) { x += rnd(0.1, 0.35); y += dy * rnd(0.05, 0.2); P.push([x, y]); } rib(m.geometry, P, 0.015); });
      U.zz = 1;
    }
  }

  function makeHaz(h) {
    const g = new T3.Group(), U = g.userData, add = (m) => { m.frustumCulled = false; g.add(m); return m; }, c = hazCol(h), a = h.a || {};
    switch (h.type) {
      case 'line': makeLine(h, g, add); break;
      case 'circle': {
        U.ring = add(groundRing(c, 0.95)); U.disc = add(groundDisc(c, 0.7)); U.sig = add(groundSigil(DCREST[h.bk] || '鬼', c, 0.8));
        if (a.water) { // Gyokko 水獄鉢: a sphere of water that swallows its target
          U.sph = add(new T3.Mesh(new T3.SphereGeometry(1, 28, 18), tmat('#2a8cff', { transparent: true, opacity: 0.42, emissive: new T3.Color('#0a3a80') })));
          U.sph2 = add(new T3.Mesh(new T3.SphereGeometry(0.96, 20, 12), amat('#a0e0ff', 0.18)));
          U.bub = []; for (let i = 0; i < 14; i++) { const b = add(spr(radialTex(), '#e0f6ff', rnd(0.05, 0.12))); b.userData.o = [rnd(-0.6, 0.6), rnd(-0.8, 0.8), rnd(-0.6, 0.6), rnd(0.01, 0.03)]; U.bub.push(b); }
        } else if (a.ice) { // Douma 散り蓮華: ice lotus petals scatter and spikes burst outward
          const im = iceMat(); U.ice = []; for (let i = 0; i < 18; i++) { const m = add(new T3.Mesh(coneG(), im)), an = i / 18 * TAU + rnd(-0.1, 0.1), d = rnd(0.2, 1); m.position.set(Math.cos(an) * d, 0, Math.sin(an) * d); m.rotation.set(Math.sin(an) * rnd(0.3, 0.9), 0, -Math.cos(an) * rnd(0.3, 0.9)); m.userData.sc = rnd(1.5, 3.5); m.castShadow = true; U.ice.push(m); }
          const pm = tmat('#e8f8ff', { emissive: new T3.Color('#4a80b0'), side: T3.DoubleSide }); U.pet = []; for (let i = 0; i < 12; i++) { const m = add(new T3.Mesh(sgeo('petal', () => new T3.CircleGeometry(1, 10).scale(0.06, 0.13, 1)), pm)); m.userData.o = [i / 12 * TAU, rnd(0.3, 1.4), rnd(0.04, 0.09)]; U.pet.push(m); }
        } else if (a.moon) { // Kokushibo 月魄災渦: a vortex of crescents spinning round him
          U.orb = []; for (let i = 0; i < 14; i++) { const pv = new T3.Group(); add(pv); const m = new T3.Mesh(i % 3 ? crescG() : sgeo('moonlet', () => new T3.TorusGeometry(1, 0.08, 4, 14, 2.4)), amat(i % 3 ? '#d8c0ff' : '#ffffff', 0.85)); m.frustumCulled = false; m.scale.setScalar(i % 3 ? rnd(0.3, 0.6) : rnd(0.1, 0.2)); m.rotation.y = Math.PI / 2; pv.add(m); pv.userData.o = [rnd(0, TAU), rnd(0.55, 1), rnd(0.2, 2.4), rnd(0.12, 0.22)]; U.orb.push(pv); }
        } else if (a.blood) { // Muzan: thorned blood spikes erupt from the whole floor around him
          const sm = tmat('#4a0410', { emissive: new T3.Color('#600014') }); U.ice = []; for (let i = 0; i < 26; i++) { const m = add(new T3.Mesh(coneG(), sm)), an = rnd(0, TAU), d = Math.sqrt(Math.random()); m.position.set(Math.cos(an) * d, 0, Math.sin(an) * d); m.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); m.userData.sc = rnd(2, 4.5); m.castShadow = true; U.ice.push(m); }
        } else if (a.poison) { // Gyutaro 円斬旋回: a storm of blood sickles whirling outward
          U.sick = []; for (let i = 0; i < 9; i++) { const pv = new T3.Group(); add(pv); const m = new T3.Mesh(sgeo('sickle', () => new T3.TorusGeometry(1, 0.1, 5, 20, Math.PI * 1.3)), new T3.MeshBasicMaterial({ color: 0xff2040 })); m.frustumCulled = false; m.scale.setScalar(0.28); pv.add(m); const gl = spr(radialTex(), '#ff0020', 0.9, 0.7); pv.add(gl); pv.userData.o = [i / 9 * TAU, rnd(0.4, 1.6)]; U.sick.push(pv); }
        } else { // Akaza 破壊殺・滅式: a pillar of blue force, compass spokes and flying rubble
          U.pil = add(new T3.Mesh(new T3.CylinderGeometry(1, 1, 3, 32, 1, true).translate(0, 1.5, 0), amat(c, 0.45)));
          const pos = []; for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; pos.push(Math.cos(an) * 0.15, 0.04, Math.sin(an) * 0.15, Math.cos(an), 0.04, Math.sin(an)); }
          const sg = []; for (let i = 0; i < pos.length; i += 6) { const [x1, , z1, x2, , z2] = pos.slice(i, i + 6), an = Math.atan2(z2 - z1, x2 - x1), nx = -Math.sin(an) * 0.03, nz = Math.cos(an) * 0.03; sg.push(x1 + nx, 0.04, z1 + nz, x1 - nx, 0.04, z1 - nz, x2 + nx, 0.04, z2 + nz, x1 - nx, 0.04, z1 - nz, x2 - nx, 0.04, z2 - nz, x2 + nx, 0.04, z2 + nz); }
          const lg = new T3.BufferGeometry(); lg.setAttribute('position', new T3.Float32BufferAttribute(sg, 3)); U.spokes = add(new T3.Mesh(lg, amat('#d8f4ff', 0.9)));
          const rm = tmat('#6a6a72'); U.rub = []; for (let i = 0; i < 14; i++) { const m = add(new T3.Mesh(sgeo('rock', () => new T3.DodecahedronGeometry(0.08, 0)), rm)); const an = rnd(0, TAU), sp = rnd(0.04, 0.1); m.userData.v = [Math.cos(an) * sp, rnd(0.06, 0.14), Math.sin(an) * sp]; m.scale.setScalar(rnd(0.6, 1.8)); m.castShadow = true; U.rub.push(m); }
        }
        flash(h.x, h.y, a.ice ? 'mist' : a.moon ? 'moon' : a.water ? 'water' : 'demon', a.ice ? 2 : 4); break; }
      case 'arm': makeArm(h, g, add); break;
      case 'cage': U.cage = add(cageMesh(a.tight ? '#ff3a50' : '#ffffff', 1)); U.glow = add(groundDisc(a.tight ? '#ff2040' : '#e8e8ff', 0.5)); break;
      case 'sweep': {
        if (a.whip) { // Muzan: one colossal tentacle scything across the whole floor
          const L = (AR - AL) * 0.5 * S + 1, sd = Math.random() * 6, pts = []; for (let i = 0; i <= 40; i++) { const x = L * i / 40; pts.push(new T3.Vector3(x, 0.45 + Math.sin(x * 0.6 + sd) * 0.18, Math.sin(x * 0.4 + sd) * 0.35)); }
          const tube = add(new T3.Mesh(taperTube(pts, 160, 0.34, 9, (u) => 1 - u * 0.8), tmat('#2a0408', { emissive: new T3.Color('#4a0010') }))); tube.castShadow = true; U.tube = tube;
          const thm = tmat('#9a1028', { emissive: new T3.Color('#500010') }); for (let i = 0; i < 40; i++) { const x = rnd(0, L), t = new T3.Mesh(coneG(), thm); t.position.set(x, 0.45 + Math.sin(x * 0.6 + sd) * 0.18, Math.sin(x * 0.4 + sd) * 0.35); t.rotation.set(rnd(-1.4, 1.4), 0, rnd(-1.4, 1.4)); t.scale.setScalar(rnd(0.8, 1.6) * (1 - x / L * 0.6)); t.frustumCulled = false; tube.add(t); }
          U.body = add(new T3.Mesh(new T3.SphereGeometry(1, 24, 10), amat('#c01030', 0.4)));
        } else { // Kokushibo 月龍輪尾: a tidal wall of crescents rolling across the room
          U.body = add(new T3.Mesh(new T3.SphereGeometry(1, 24, 10), amat('#b080ff', 0.5))); U.core = add(new T3.Mesh(new T3.SphereGeometry(1, 20, 6), amat('#ffffff', 0.8)));
          U.cres = []; for (let i = 0; i < 12; i++) { const m = add(new T3.Mesh(i % 2 ? crescG() : sgeo('moonlet', () => new T3.TorusGeometry(1, 0.08, 4, 14, 2.4)), amat(i % 2 ? '#d8c0ff' : '#ffffff', 0.85))); m.userData.o = [rnd(-0.6, 0.1), rnd(0.2, 1.8), rnd(-0.5, 0.5), i % 2 ? rnd(0.6, 1.3) : rnd(0.15, 0.3)]; U.cres.push(m); }
        }
        flash(h.src, GY - 40, a.whip ? 'blood' : 'moon', 4); break; }
      case 'shock': {
        const col = DCOL[h.bk] || '#a0dcff'; U.col = col;
        if (h.bk === 'hantengu') { // 狂圧鳴波: rings of crushing sound
          U.rings = []; for (let i = 0; i < 4; i++) { const m = add(new T3.Mesh(sgeo('sring', () => new T3.TorusGeometry(1, 0.04, 4, 32)), amat(i % 2 ? '#fff6c0' : col, 0.8))); m.rotation.y = Math.PI / 2; m.userData.k = i / 4; U.rings.push(m); }
        } else { // a ground rupture: a wave front and a trail of rock (or blood) spikes
          const m = add(new T3.Mesh(new T3.ConeGeometry(0.32, 1, 12, 1, true), amat(col, 0.6))); m.position.y = 0.5; U.front = m;
          const sm = h.bk === 'muzan' ? tmat('#4a0410', { emissive: new T3.Color('#600014') }) : tmat('#7a7068'); U.spk = []; for (let i = 0; i < 9; i++) { const s = add(new T3.Mesh(coneG(), sm)); s.userData.d = (i + 1) * 0.28; s.userData.zo = rnd(-0.25, 0.25); s.userData.sc = rnd(1.2, 2.4); s.rotation.set(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)); s.castShadow = true; U.spk.push(s); }
        }
        add(spr(radialTex(), col, 0.9)).position.y = 0.25; U.lastX = h.x; break; }
      case 'zone': { // melee swipes: an arc of the demon's colour where the blow lands
        const col = DCOL[h.bk] || '#ff4040'; U.arc = add(new T3.Mesh(sgeo('zarc', () => new T3.TorusGeometry(1, 0.05, 4, 24, 2.4)), amat('#ffffff', 0.95)));
        U.fan = add(new T3.Mesh(sgeo('zfan', () => new T3.CircleGeometry(1, 24, 0, 2.4)), amat(col, 0.35))); U.glow = add(spr(radialTex(), col, 1.2, 0.8));
        if (h.bk === 'doma') { const im = iceMat(); U.ice = []; for (let i = 0; i < 7; i++) { const m = add(new T3.Mesh(coneG(), im)); const an = 0.2 + i / 6 * 2; m.position.set(Math.cos(an) * 0.8, Math.sin(an) * 0.8, 0); m.rotation.z = an - Math.PI / 2; m.userData.sc = rnd(0.8, 1.4); U.ice.push(m); } }
        break; }
      default: return null;
    }
    scene.add(g); return g;
  }
  function updateHaz(g, h) {
    const a = clamp(1 - (h.t || 0) / h.life, 0, 1), U = g.userData, t = h.t || 0, z = (h.z || 0) * S;
    switch (h.type) {
      case 'line': updateLine(g, h, a); break;
      case 'circle': { const x = h.follow ? h.follow.x : h.x, r = h.r * S, k = ease(t / 5), cz = h.follow ? (h.follow.z || 0) * S : z, cy = toY(h.y);
        g.position.set(toX(x), 0.03, cz);
        U.ring.scale.setScalar(r * (0.3 + k * 0.9)); U.ring.material.opacity = a; U.disc.scale.setScalar(r * 1.1); U.disc.material.opacity = a * (h.a && (h.a.ice || h.a.water) ? 0.25 : 0.7);
        U.sig.scale.setScalar(r); U.sig.rotation.y = time * 1.5; U.sig.material.opacity = a * 0.8;
        if (U.sph) { U.sph.position.y = U.sph2.position.y = cy; const s = r * 0.8 * ease(t / 4); U.sph.scale.setScalar(Math.max(0.01, s)); U.sph2.scale.setScalar(Math.max(0.01, s)); U.sph.material.opacity = 0.42 * Math.min(1, a * 2.5); U.sph2.material.opacity = 0.18 * a;
          U.bub.forEach(b => { const o = b.userData.o; o[1] += o[3] * 3; if (o[1] > 0.8) o[1] = -0.8; b.position.set(o[0] * s, cy + o[1] * s, o[2] * s); b.material.opacity = a; }); }
        if (U.ice) U.ice.forEach((m, i) => { const e = ease((t - (i % 6) * 0.3) / 3) * (a < 0.3 ? a / 0.3 : 1), d = m.userData.d0 || (m.userData.d0 = [m.position.x, m.position.z]); m.position.set(d[0] * r, 0, d[1] * r); m.scale.set(m.userData.sc * e, m.userData.sc * e * 1.3, m.userData.sc * e); });
        if (U.pet) U.pet.forEach(m => { const o = m.userData.o, rr = r * (0.2 + k * 0.9); m.position.set(Math.cos(o[0] + t * o[2]) * rr, o[1], Math.sin(o[0] + t * o[2]) * rr); m.rotation.set(t * 0.2, o[0] + t * o[2], 0); m.material.opacity = a; });
        if (U.orb) U.orb.forEach(pv => { const o = pv.userData.o; pv.position.y = o[2]; pv.rotation.y = o[0] + t * o[3]; pv.children[0].position.x = r * o[1] * (0.4 + k * 0.6); pv.children[0].rotation.z = t * 0.3; pv.children[0].material.opacity = a * 0.9; });
        if (U.sick) U.sick.forEach(pv => { const o = pv.userData.o; pv.position.y = o[1]; pv.rotation.y = o[0] + t * 0.45; pv.children[0].position.x = pv.children[1].position.x = r * (0.25 + k * 0.75); pv.children[0].rotation.z = -t * 0.9; pv.children[1].material.opacity = a * 0.7; });
        if (U.pil) { U.pil.scale.set(r * (0.25 + k * 0.85), 1 + k * 0.4, r * (0.25 + k * 0.85)); U.pil.material.opacity = a * 0.45; U.spokes.scale.setScalar(r * (0.4 + k * 0.8)); U.spokes.rotation.y = t * 0.02; U.spokes.material.opacity = a;
          U.rub.forEach(m => { const v = m.userData.v; if (t <= 1) m.position.set(rnd(-0.3, 0.3) * r, 0.05, rnd(-0.3, 0.3) * r); m.position.x += v[0] * r * 0.4; m.position.z += v[2] * r * 0.4; m.position.y = Math.max(0.04, m.position.y + v[1]); v[1] -= 0.012; m.rotation.x += 0.2; m.rotation.y += 0.15; }); }
        break; }
      case 'arm': updateArm(g, h); break;
      case 'cage': { g.position.set(toX(h.x), 0.02, z); const r = (h.r || h.r0) * S * (1 - 0.7 * ease(t / h.life)); U.cage.scale.set(r, 1, r); U.cage.rotation.y = t * 0.04; U.cage.material.opacity = a; U.glow.scale.setScalar(r); U.glow.material.opacity = a * 0.5; break; }
      case 'sweep': { const AW = AR - AL, prog = ease(t / 6), cx = h.src + h.dir * AW * 0.5 * prog, rx = (AW * 0.5 * prog + 40) * S;
        if (U.tube) { g.position.set(toX(h.src), 0, z); g.rotation.y = h.dir > 0 ? 0 : Math.PI; U.tube.scale.set(Math.max(0.01, prog), 1, 1); U.tube.position.y = Math.sin(t * 0.5) * 0.08; U.body.position.set(AW * 0.25 * prog * S, 0.45, 0); U.body.scale.set(Math.max(0.01, rx * 0.5), 0.5, 0.6); U.body.material.opacity = a * 0.4; if (a < 0.3) U.tube.scale.y = U.tube.scale.z = a / 0.3; break; }
        g.position.set(toX(cx), toY(GY - 36), z); U.body.scale.set(rx, 34 * S, 0.5); U.core.scale.set(Math.max(0.01, rx - 0.2), 8 * S, 0.3); U.body.material.opacity = a * 0.5; U.core.material.opacity = a * 0.8;
        U.cres.forEach(m => { const o = m.userData.o; m.position.set(h.dir * (rx + o[0]), o[1] - toY(GY - 36), o[2]); m.scale.setScalar(o[3] * (0.6 + prog * 0.6)); m.rotation.z = (h.dir > 0 ? 0 : Math.PI) + Math.sin(t * 0.3 + o[1]) * 0.4; m.material.opacity = a * 0.9; });
        break; }
      case 'shock': { g.position.set(toX(h.x), 0, z); const dir = Math.sign(h.vx || 1);
        if (U.rings) U.rings.forEach(m => { const k = (m.userData.k + t * 0.04) % 1; m.position.set(-dir * k * 0.6, 0.6, 0); m.scale.setScalar(0.2 + k * 1.1); m.material.opacity = (1 - k) * 0.9; });
        if (U.front) { U.front.scale.setScalar(0.85 + Math.sin(time * 30) * 0.15); U.spk.forEach(s => { const d = s.userData.d, life = clamp(1 - Math.abs(Math.sin((t * 0.25 + d) * 1.3)) * 0.5, 0, 1); s.position.set(-dir * d, 0, s.userData.zo); s.scale.set(s.userData.sc * life, s.userData.sc * life * 1.4, s.userData.sc * life); }); }
        break; }
      case 'zone': { const f = h.follow || { x: h.x, face: 1, z: 0 }, face = f.face || 1, r = h.r * S;
        g.position.set(toX(f.x + face * (h.off || 0) * 0.4), toY(h.y), (f.z || 0) * S + 0.1); g.scale.setScalar(r);
        g.rotation.z = (face > 0 ? -1.2 : Math.PI - 1.2) - face * (1 - a) * 0.9 + face * 0.45;
        U.arc.material.opacity = a; U.fan.material.opacity = a * 0.35; U.glow.material.opacity = a * 0.8;
        if (U.ice) U.ice.forEach(m => { const e = ease(t / 2); m.scale.setScalar(m.userData.sc * e * a); });
        break; }
    }
  }
  // ---- arms rising from the floor: Hantengu's wood dragons, Enmu's flesh, Muzan's thorned tendrils
  function makeArm(h, g, add) {
    const U = g.userData, a = h.a || {}, sd = Math.random() * 6, pts = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new T3.Vector3(Math.sin(u * 3 + sd) * 0.35 * u, u, Math.cos(u * 2.4 + sd) * 0.25 * u)); }
    let mat;
    if (a.dragon) { const t = barkTex(); t.repeat.set(1, 3); mat = tmat(0xffffff, { map: t }); }
    else if (a.flesh) { const t = fleshTex(); t.repeat.set(3, 2); mat = tmat(0xffffff, { map: t, emissive: new T3.Color('#301020') }); }
    else if (a.thorn) mat = tmat('#2a0408', { emissive: new T3.Color('#4a0010') });
    else mat = tmat('#6d8a48');
    const stalk = add(new T3.Mesh(taperTube(pts, 24, 0.5, 8, (u) => 1 - u * 0.45), mat)); stalk.castShadow = true; U.stalk = stalk; U.tip = stalk.geometry.userData.tip;
    const top = new T3.Group(); g.add(top); U.top = top;
    if (a.dragon) { // a wooden dragon head: snout, open jaw, horns, glowing eyes
      const hm = tmat('#7a5a38'), hm2 = tmat('#5a3e22');
      const sk = new T3.Mesh(new T3.ConeGeometry(0.2, 0.62, 8), hm); sk.rotation.z = -Math.PI / 2 - 0.25; sk.position.x = 0.12; top.add(sk);
      const jaw = new T3.Mesh(new T3.ConeGeometry(0.12, 0.5, 6), hm2); jaw.rotation.z = -Math.PI / 2 - 0.75; jaw.position.set(0.1, -0.12, 0); top.add(jaw); U.jaw = jaw;
      for (const z of [-0.1, 0.1]) { const e = new T3.Mesh(new T3.SphereGeometry(0.035, 6, 4), new T3.MeshBasicMaterial({ color: 0xffee40 })); e.position.set(0.08, 0.1, z); top.add(e); const eg = spr(radialTex(), '#ffd000', 0.16); eg.position.set(0.08, 0.1, z); top.add(eg); }
      for (const z of [-0.08, 0.08]) { const hn = new T3.Mesh(new T3.ConeGeometry(0.03, 0.35, 5), hm2); hn.position.set(-0.12, 0.2, z); hn.rotation.z = 1.0; top.add(hn); }
      for (let i = 0; i < 4; i++) { const mn = new T3.Mesh(new T3.ConeGeometry(0.025, 0.2, 4), hm2); mn.position.set(-0.2 - i * 0.05, 0.05, 0); mn.rotation.z = 1.4; top.add(mn); }
    } else if (a.thorn) {
      const thm = tmat('#9a1028', { emissive: new T3.Color('#500010') }); U.thorns = []; for (let i = 0; i < 10; i++) { const u = (i + 0.5) / 10, p = new T3.Vector3(Math.sin(u * 3 + sd) * 0.35 * u, u, Math.cos(u * 2.4 + sd) * 0.25 * u), t = new T3.Mesh(coneG(), thm); t.position.copy(p); t.rotation.set(rnd(-1, 1), 0, (i % 2 ? 1 : -1) * rnd(0.9, 1.4)); t.scale.set(4, 0.5, 4); stalk.add(t); }
      const tip = new T3.Mesh(coneG(), thm); tip.scale.set(2, 0.8, 2); top.add(tip);
    } else {
      const m2 = tmat(a.flesh ? '#d8a0b8' : '#7d9a58'); for (let i = 0; i < 5; i++) { const f = new T3.Mesh(new T3.CapsuleGeometry(0.05, 0.22, 3, 6), m2); f.position.set(-0.18 + i * 0.09, 0.15, 0); f.rotation.z = (i - 2) * 0.2; top.add(f); }
      if (a.flesh) { for (let i = 0; i < 3; i++) { const e = new T3.Mesh(new T3.SphereGeometry(0.045, 8, 6), new T3.MeshBasicMaterial({ color: 0xffffff })); e.position.set(rnd(-0.1, 0.1), -0.25 - i * 0.12, 0.13); top.add(e); const pu = new T3.Mesh(new T3.SphereGeometry(0.02, 6, 4), new T3.MeshBasicMaterial({ color: 0x400010 })); pu.position.copy(e.position).add(new T3.Vector3(0, 0, 0.035)); top.add(pu); } }
    }
    U.dust = add(groundDisc(a.dragon ? '#c09060' : a.thorn ? '#ff1838' : '#d0a0c0', 0.6));
    top.traverse(o => { o.frustumCulled = false; if (o.isMesh) o.castShadow = true; });
  }
  function updateArm(g, h) {
    const U = g.userData, t = h.t || 0, ht = h.h * ease(t / 6) * (t > h.life - 8 ? (h.life - t) / 8 : 1) * S, w = h.w * S * 0.5;
    g.position.set(toX(h.x), 0, (h.z || 0) * S + 0.1);
    U.stalk.scale.set(w, Math.max(0.01, ht), w); U.stalk.rotation.z = Math.sin(t * 0.3) * 0.1; U.stalk.rotation.y = Math.sin(t * 0.13) * 0.3;
    U.stalk.updateMatrix(); U.top.position.copy(U.tip).applyMatrix4(U.stalk.matrix); U.top.scale.setScalar(h.w / 60);
    U.top.visible = ht > 0.05; if (U.jaw) U.jaw.rotation.z = -Math.PI / 2 - 0.5 - Math.abs(Math.sin(t * 0.4)) * 0.5;
    U.dust.scale.setScalar(w * 2.4); U.dust.material.opacity = clamp(1 - t / h.life, 0, 1) * 0.6;
  }
  // Rui's thread cage: silk strands drawn from a circle on the floor up to a point over the target
  function cageMesh(c, op) {
    const geo = sgeo('cage', () => {
      const out = [], seg = (x1, y1, z1, x2, y2, z2, w) => { const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w; out.push(x1 + nx, y1, z1 + nz, x1 - nx, y1, z1 - nz, x2 + nx, y2, z2 + nz, x1 - nx, y1, z1 - nz, x2 - nx, y2, z2 - nz, x2 + nx, y2, z2 + nz); };
      const N = 18; for (let i = 0; i < N; i++) { const a = i / N * TAU, a2 = a + 1.1; seg(Math.cos(a), 0, Math.sin(a), Math.cos(a2) * 0.12, 2.6, Math.sin(a2) * 0.12, 0.012); seg(Math.cos(a), 0, Math.sin(a), Math.cos(a - 1.1) * 0.12, 2.6, Math.sin(a - 1.1) * 0.12, 0.012); }
      for (const [y, r] of [[0.05, 1], [0.9, 0.72], [1.7, 0.42]]) for (let i = 0; i < 36; i++) { const a0 = i / 36 * TAU, a1 = (i + 1) / 36 * TAU; seg(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r, 0.01); }
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(out, 3)); return g;
    });
    const m = new T3.Mesh(geo, amat(c, op)); m.frustumCulled = false; return m;
  }
  // ---- 3D telegraphs (warnings before an attack lands)
  function makeTele(h) {
    const g = new T3.Group(), U = g.userData, add = (m) => { m.frustumCulled = false; g.add(m); return m; }, c = hazCol(h), crest = DCREST[h.bk] || '鬼';
    U.d0 = Math.max(1, h.delay);
    switch (h.type) {
      case 'line': { const L = Math.hypot(h.x2 - h.x1, h.y2 - h.y1) * S; U.rib = add(new T3.Mesh(new T3.PlaneGeometry(L, 1), teleMat(c, L * 1.6)));
        g.position.set(toX((h.x1 + h.x2) / 2), toY((h.y1 + h.y2) / 2), (h.z || 0) * S); g.rotation.z = -Math.atan2(h.y2 - h.y1, h.x2 - h.x1); break; }
      case 'circle': U.sig = add(groundSigil(crest, c, 0.85)); U.fill = add(groundDisc(c, 0.5)); U.gr = add(groundRing(c, 0.9)); U.ring = add(new T3.Mesh(sgeo('vring', () => new T3.TorusGeometry(1, 0.02, 4, 48)), amat(c, 0.5))); break;
      case 'arm': U.sig = add(groundSigil(crest, c === '#ff4040' ? '#ff5050' : c, 0.9)); U.fill = add(groundDisc('#ff3030', 0.5)); break;
      case 'rainmark': { const s = h.a && h.a.shape, rc = s === 'lotus' || s === 'icicle' ? '#bfe8ff' : s === 'fish' ? '#70e0ff' : s === 'moonbeam' ? '#c8a8ff' : '#ff6060';
        U.gr = add(groundRing(rc, 0.85)); U.fill = add(groundDisc(rc, 0.5)); U.col = add(new T3.Mesh(sgeo('rcol', () => new T3.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0)), amat(rc, 0.12))); U.tall = s === 'moonbeam' ? 6 : 2.2; break; }
      case 'cage': U.cage = add(cageMesh(h.a && h.a.tight ? '#ff6070' : '#f4f4ff', 0.5)); U.sig = add(groundSigil('糸', h.a && h.a.tight ? '#ff3050' : '#e8e8ff', 0.6)); break;
      case 'sweep': { const W2 = (AR - AL) * S; U.band = add(new T3.Mesh(new T3.PlaneGeometry(W2, 3).rotateX(-Math.PI / 2), teleMat(h.a && h.a.whip ? '#ff2030' : '#b080ff', W2 * 0.8))); U.wall = add(new T3.Mesh(new T3.PlaneGeometry(W2, 0.8), teleMat(h.a && h.a.whip ? '#ff2030' : '#b080ff', W2 * 0.8))); U.wall.position.y = 0.4; break; }
      default: return null;
    }
    scene.add(g); return g;
  }
  function updateTele(g, h) {
    const U = g.userData, z = (h.z || 0) * S, p = clamp(1 - h.delay / U.d0, 0, 1), blink = 0.55 + 0.45 * Math.sin(time * (8 + p * 26));
    switch (h.type) {
      case 'line': { const u = U.rib.material.uniforms; u.uP.value = p; u.uTime.value = time; U.rib.scale.y = lerp(30, 10, p) * S; break; }
      case 'circle': { const x = h.follow ? h.follow.x : h.x, r = h.r * S, cz = h.follow ? (h.follow.z || 0) * S : z; g.position.set(toX(x), 0.03, cz);
        U.sig.scale.setScalar(r); U.sig.rotation.y = time * (0.6 + p * 2); U.sig.material.opacity = 0.35 + 0.55 * p;
        U.fill.scale.setScalar(Math.max(0.01, r * p)); U.fill.material.opacity = 0.5 * blink; U.gr.scale.setScalar(r); U.gr.material.opacity = 0.5 + 0.4 * blink;
        U.ring.position.y = toY(h.y); U.ring.scale.setScalar(r); U.ring.material.opacity = 0.25 * blink; break; }
      case 'arm': { const r = (h.w / 2 + 10) * S; g.position.set(toX(h.x), 0.03, z); U.sig.scale.setScalar(r); U.sig.rotation.y = -time * 2; U.sig.material.opacity = 0.4 + 0.5 * blink; U.fill.scale.setScalar(Math.max(0.01, r * p)); break; }
      case 'rainmark': { g.position.set(toX(h.x), 0.03, z); const r = 0.34; U.gr.scale.setScalar(r); U.gr.material.opacity = 0.4 + 0.5 * blink; U.fill.scale.setScalar(Math.max(0.01, r * p)); U.col.scale.set(r * 0.5, U.tall, r * 0.5); U.col.material.opacity = 0.05 + p * 0.15; break; }
      case 'cage': { g.position.set(toX(h.x), 0.02, z); const r = (h.r || h.r0) * S; U.cage.scale.set(r, 1, r); U.cage.rotation.y = -time * 0.4; U.cage.material.opacity = 0.2 + 0.4 * p; U.sig.scale.setScalar(r); U.sig.rotation.y = time; U.sig.material.opacity = 0.3 + 0.4 * blink; break; }
      case 'sweep': { g.position.set(toX((AL + AR) / 2), 0.03, z); for (const m of [U.band, U.wall]) { const u = m.material.uniforms; u.uP.value = p; u.uTime.value = time * (h.dir > 0 ? 1 : -1); } U.wall.position.z = 0.6; break; }
    }
  }
  // ---- charge-up: while a demon winds up, its crest burns on the floor and power gathers round it
  const auras = new Map();
  function makeAura(b) {
    const g = new T3.Group(), U = g.userData, c = DCOL[b.key] || '#ff3040', add = (m) => { m.frustumCulled = false; g.add(m); return m; };
    U.sig = add(groundSigil(DCREST[b.key] || '鬼', c, 0)); U.glow = add(spr(radialTex(), c, 1.6, 0)); U.core = add(spr(radialTex(), '#ffffff', 0.5, 0));
    U.rings = []; for (let i = 0; i < 2; i++) { const m = add(new T3.Mesh(sgeo('aring', () => new T3.TorusGeometry(1, 0.025, 4, 40).rotateX(Math.PI / 2)), amat(c, 0))); m.userData.k = i * 0.5; U.rings.push(m); }
    U.streaks = []; for (let i = 0; i < 10; i++) { const m = add(new T3.Mesh(sgeo('astreak', () => new T3.PlaneGeometry(0.035, 0.9)), amat(i % 2 ? '#ffffff' : c, 0))); const an = i / 10 * TAU; m.userData.o = [an, rnd(0, 1), rnd(0.5, 0.8)]; U.streaks.push(m); }
    scene.add(g); return g;
  }
  function updateAura(g, b) {
    const U = g.userData, p = clamp(b.st / Math.max(1, b.atk.tele), 0, 1), s = (b.scale || 1) * (b.def.minion ? 0.7 : 1), hh = (b.hh || 170) * S;
    g.position.set(toX(b.x), 0.03, (b.z || 0) * S);
    U.sig.scale.setScalar(1.3 * s * (0.6 + 0.4 * ease(p * 2))); U.sig.rotation.y = time * (1 + p * 3); U.sig.material.opacity = Math.min(1, p * 3) * 0.85;
    U.glow.position.y = hh * 0.55; U.glow.scale.setScalar((1.2 + p * 1.4 + Math.sin(time * 30) * 0.1) * s); U.glow.material.opacity = 0.25 + p * 0.5;
    U.core.position.y = hh * 0.55; U.core.scale.setScalar((0.3 + p * 0.5) * s); U.core.material.opacity = p > 0.85 ? 1 : p * 0.6;
    U.rings.forEach(m => { const k = (m.userData.k + time * 0.9) % 1; m.position.y = k * hh * 1.1; m.scale.setScalar((0.9 - k * 0.5) * s); m.material.opacity = (1 - k) * 0.8 * Math.min(1, p * 4); });
    U.streaks.forEach(m => { const o = m.userData.o, k = (o[1] + time * 1.4) % 1; m.position.set(Math.cos(o[0]) * o[2] * s, k * hh * 1.2, Math.sin(o[0]) * o[2] * s); m.lookAt(camera.position.x, m.position.y + g.position.y, camera.position.z); m.material.opacity = Math.sin(k * Math.PI) * 0.8 * p; });
  }
  function syncEnemy(eproj, haz, bosses) {
    const seen = new Set();
    for (const p of eproj) { let g = eMeshes.get(p); if (!g) { g = makeEProj(p); eMeshes.set(p, g); } updateEProj(g, p); seen.add(p); }
    for (const [p, g] of eMeshes) if (!seen.has(p)) { disposeFx(g); eMeshes.delete(p); }
    const seenH = new Set();
    for (const h of haz) {
      let o = hMeshes.get(h); if (!o) { o = {}; hMeshes.set(h, o); }
      if (h.delay > 0) { if (o.tele === undefined) o.tele = makeTele(h); if (o.tele) updateTele(o.tele, h); }
      else {
        if (o.tele) { disposeFx(o.tele); o.tele = null; }
        if (o.act === undefined) o.act = makeHaz(h);
        if (o.act) updateHaz(o.act, h);
      }
      seenH.add(h);
    }
    for (const [h, o] of hMeshes) if (!seenH.has(h)) { if (o.tele) disposeFx(o.tele); if (o.act) disposeFx(o.act); hMeshes.delete(h); }
    const live = new Set();
    for (const b of bosses || []) if (b.state === 'tele' && b.atk && !b.dead && !b.pending) { let g = auras.get(b); if (!g) { g = makeAura(b); auras.set(b, g); } updateAura(g, b); live.add(b); }
    for (const [b, g] of auras) if (!live.has(b)) { disposeFx(g); auras.delete(b); }
  }

  // ---------------- 3D technique effects ----------------
  const FX3D = { slash: 1, ring: 1, streak: 1, thrust: 1, bolt: 1, flashline: 1, dragon: 1, whip: 1, bghost: 1, chain: 1, compass: 1, sleepaura: 1 };
  api.handles = t => !!FX3D[t];
  function flash(x, y, theme, power) {
    const l = flashLights[flashIdx++ % flashLights.length];
    l.color.set((THEMES[theme] || THEMES.normal).m); l.position.set(toX(x), toY(y), 1.2); l.userData.life = 1; l.userData.power = power || 3;
  }
  function makeFxMesh(e) {
    switch (e.type) {
      case 'chain': { const m = new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 1, 5), new T3.MeshToonMaterial({ color: 0xaaaaaa })); m.frustumCulled = false; scene.add(m); return m; }
      case 'compass': { // Akaza's Destructive Death: Compass Needle — snowflake array on the ground
        const g = new T3.Group(), mat = new T3.MeshBasicMaterial({ color: 0x7ad0ff, transparent: true, opacity: 0.7, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide });
        const segs = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; segs.push(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0); segs.push(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0, Math.cos(a + 0.15) * 0.8, Math.sin(a + 0.15) * 0.8, 0, Math.cos(a + 0.15) * 0.8, Math.sin(a + 0.15) * 0.8, 0, Math.cos(a - 0.15) * 0.8, Math.sin(a - 0.15) * 0.8, 0, Math.cos(a - 0.15) * 0.8, Math.sin(a - 0.15) * 0.8, 0, Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0); }
        const sg = []; for (let i = 0; i < segs.length; i += 6) { const [x1, y1, , x2, y2] = segs.slice(i, i + 6), an = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(an) * 0.02, ny = Math.cos(an) * 0.02; sg.push(x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0, x2 + nx, y2 + ny, 0, x1 - nx, y1 - ny, 0, x2 - nx, y2 - ny, 0, x2 + nx, y2 + ny, 0); }
        const geo = new T3.BufferGeometry(); geo.setAttribute('position', new T3.Float32BufferAttribute(sg, 3));
        const flake = new T3.Mesh(geo, mat); flake.rotation.x = -Math.PI / 2; g.add(flake);
        const ring = new T3.Mesh(new T3.RingGeometry(1.27, 1.32, 64).rotateX(-Math.PI / 2), mat); g.add(ring); g.userData.flake = flake; g.userData.mat = mat;
        g.traverse(o => { o.frustumCulled = false; }); scene.add(g); return g; }
      case 'sleepaura': { const g = new T3.Group(), mat = new T3.MeshBasicMaterial({ color: 0xc080ff, transparent: true, opacity: 0.6, blending: T3.AdditiveBlending, depthWrite: false });
        for (let i = 0; i < 3; i++) g.add(new T3.Mesh(new T3.TorusGeometry(1, 0.012, 4, 40), mat));
        g.traverse(o => { o.frustumCulled = false; }); scene.add(g); return g; }
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
    m.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  }
  function updateFxMesh(m, e) {
    const mat = m.material;
    if (mat && mat.uniforms) mat.uniforms.uTime.value = time;
    switch (e.type) {
      case 'chain': { const P = e.P; if (!P) return; const hx = toX(P.x), hy = toY(P.y - 85), bx = toX(e.x), by = toY(e.y), len = Math.hypot(bx - hx, by - hy) || 0.01; m.position.set((hx + bx) / 2, (hy + by) / 2, 0); m.scale.set(1, len, 1); m.rotation.set(0, 0, Math.atan2(by - hy, bx - hx) - Math.PI / 2); e.z = P.z; return; }
      case 'compass': { const b = e.b; m.visible = !!b && !b.dead; if (!b) return; m.position.set(toX(b.x), 0.04, 0); e.z = b.z; m.userData.flake.rotation.z = e.t * 0.01; m.userData.mat.opacity = 0.7 * Math.min(1, (e.life - e.t) / 30); return; }
      case 'sleepaura': { const b = e.b; if (!b) return; m.position.set(toX(b.x), toY(b.y - 100), 0); e.z = b.z; m.children.forEach((r, i) => { const k = (((e.t * 3 + i * 40) % 120) + 20) * S; r.scale.setScalar(k); }); return; }
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
      updateFxMesh(m, e); m.position.z = (e.z || 0) * S; seen.add(e);
    }
    for (const [e, m] of fxMeshes) if (!seen.has(e)) { disposeFx(m); fxMeshes.delete(e); }
    api.stats.fx = fxMeshes.size;
  }

  // ---------------- actors: VRM or 2D-anime billboard ----------------
  function loadScripts(list, done) {
    if (!list.length) return done();
    const el = document.createElement('script'); el.src = list[0]; el.onload = () => loadScripts(list.slice(1), done); el.onerror = () => console.warn('failed to load', list[0]);
    document.head.appendChild(el);
  }
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
  function disposeModel(M) {
    scene.remove(M.root);
    M.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const m of M.mats) { if (m.map) m.map.dispose(); m.dispose(); }
    for (const k in (M.faces || {})) M.faces[k].dispose();
  }
  function syncActors(actors, dt) {
    const used = new Set(), usedV = new Set(), poolUse = {};
    for (const a of actors) {
      const sh = blob(a.id); used.add(a.id);
      const air = Math.max(0, GY - a.y) * S;
      sh.visible = true; sh.position.set(toX(a.x), 0.02, (a.z || 0) + 0.01); const ss = (a.boss ? 1.2 : 0.8) * (a.scale || 1) * Math.max(0.35, 1 - air * 0.4); sh.scale.set(ss * 1.2, ss * 0.9, 1);
      sh.material.opacity = (a.alpha === undefined ? 1 : a.alpha) * Math.max(0.2, 1 - air * 0.5);
      const E = api.vrm[a.key];
      if (E && !a.custom) { poseVRM(E, a, dt); usedV.add(a.key); if (billboards[a.id]) billboards[a.id].mesh.visible = false; continue; }
      if (!api.no3dChars && typeof CHIBI3D !== 'undefined') {
        const mk = a.lk ? 'b:' + a.lk : a.key, pool = api.chibi[mk] || (api.chibi[mk] = []), n = poolUse[mk] = (poolUse[mk] || 0) + 1;
        let M = pool[n - 1];
        if (M === undefined) { M = pool[n - 1] = CHIBI3D.make(a); if (M) scene.add(M.root); }
        if (M) {
          CHIBI3D.pose(M, a, dt); M.used = time; M.root.visible = true;
          if (billboards[a.id]) billboards[a.id].mesh.visible = false; continue;
        }
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
    for (const k in api.chibi) {
      const pool = api.chibi[k];
      for (let i = 0; i < pool.length; i++) {
        const M = pool[i]; if (!M) continue;
        if (i >= (poolUse[k] || 0)) M.root.visible = false;
        if (time - M.used > 30) { disposeModel(M); pool[i] = undefined; } // free models not seen for 30s
      }
    }
  }

  // ---------------- 3D afterimages: glowing snapshots of the posed model ----------------
  const ghosts = new Map();
  function snapGhost(M, x, color) {
    const c = M.root.clone(), mat = new T3.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: T3.AdditiveBlending, depthWrite: false, fog: false });
    c.traverse(o => { if (o.isMesh) { if (o.material.side === T3.BackSide) o.visible = false; else { o.material = mat; o.castShadow = false; } } });
    if (x !== undefined) c.position.x = toX(x);
    c.userData.mat = mat; scene.add(c); return c;
  }
  function syncGhosts(G) {
    const seen = new Set(), live = [];
    const P = G.team && activeP && G.team[G.ai];
    if (P && P.ghosts) { const pool = api.chibi[P.key], M = pool && pool[0]; if (M) for (const g of P.ghosts) live.push([g, M, g.x, (THEMES[g.tint || (typeof curStyle === 'function' ? curStyle(P).theme : 'normal')] || THEMES.normal).m, g.life / (g.tint ? 40 : 14)]); }
    for (const e of G.fx || []) if (e.type === 'bghost' && e.b) { const pool = api.chibi['b:' + e.b.def.look], M = pool && pool[0]; if (M) live.push([e, M, e.x, '#ff3060', 1 - e.t / e.life]); }
    let made = 0;
    for (const [k, M, x, c, a] of live) {
      let o = ghosts.get(k);
      if (o === undefined) { if (ghosts.size >= 8 || made >= 2) continue; o = snapGhost(M, x, c); ghosts.set(k, o); made++; }
      o.userData.mat.opacity = Math.max(0, a) * 0.45; seen.add(k);
    }
    for (const [k, o] of ghosts) if (!seen.has(k)) { scene.remove(o); o.userData.mat.dispose(); ghosts.delete(k); }
  }

  // ---------------- main render ----------------
  let last = performance.now(), slowAcc = 0, fastAcc = 0;
  api.quality = 2; // 2 full, 1 no shadows, 0 no bloom
  function setQuality(q) {
    api.quality = q;
    renderer.shadowMap.enabled = q >= 2; bloom.enabled = q >= 1;
    if (world) world.setQuality(q);
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  api.setQuality = setQuality;
  api.cam = { fx: 0, fy: CAMY, fz: 0, dist: D, pitch: 0, yaw: 0, fov: FOV };
  // game coords (x, y, depth z in px) -> screen px, for HUD labels anchored in the world
  const _pv = new T3.Vector3();
  api.project = (x, y, z) => { _pv.set(toX(x), toY(y), (z || 0) * S).project(camera); return [(_pv.x + 1) / 2 * W, (1 - _pv.y) / 2 * H, _pv.z]; };
  api.scaleAt = (x, y, z) => { const a = api.project(x, y, z), b = api.project(x + 100, y, z); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100; };
  api.render = function (G, actors, opts) {
    if (!api.ok) return;
    const now = performance.now(), raw = now - last, dt = Math.min(0.05, raw / 1000); last = now; renderer.info.reset();
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
    if (world) { if (G.dawnMax) world.dawn(clamp(G.dawn / G.dawnMax, 0, 1)); }
    else if (G.dawnMax) {
      const d = clamp(G.dawn / G.dawnMax, 0, 1), cfg = STAGE_CFG[key];
      hemi.color.set(cfg.hemi[0]).lerp(new T3.Color(0xffb070), d * 0.8); hemi.intensity = cfg.hemi[2] + d * 0.6;
      scene.fog.color.set(cfg.fog).lerp(new T3.Color(0xd08060), d * 0.7);
      if (backdrop) backdrop.material.color.setRGB(1, 1 - d * 0.15, 1 - d * 0.35);
      if (sunSprite) { sunSprite.visible = d > 0.55; sunSprite.position.y = -4 + (d - 0.55) * 40; }
    }
    // camera: true 3D. In battle an elevated action camera follows the fight (distance from the fighters'
    // separation in x AND depth), swings round on special moves and orbits the fallen demon; menus/dialog
    // use the classic frontal framing. All parameters ease, so transitions are smooth.
    const V = api.cam;
    let T = { fx: 0, fy: CAMY, fz: 0, dist: D, pitch: 0, yaw: 0, fov: FOV };
    if (opts && opts.cam && G.team && G.bosses) {
      const P = G.team[G.ai], foes = G.bosses.filter(b => !b.dead && !b.pending);
      const b = foes.length ? foes.reduce((a, c) => Math.hypot(c.x - P.x, (c.z || 0) - P.z) < Math.hypot(a.x - P.x, (a.z || 0) - P.z) ? c : a) : null;
      T = { fx: toX(P.x), fy: 1.25, fz: (P.z || 0) * S, dist: 9.5, pitch: 0.24, yaw: 0, fov: 40 };
      if (b) { const sep = Math.hypot(b.x - P.x, ((b.z || 0) - P.z) * 1.6), k = sep > 900 ? 450 / sep : 0.5; // far apart: stay on the player, lean toward the demon
        T.fx = toX(P.x + (b.x - P.x) * k); T.fz = ((P.z || 0) + ((b.z || 0) - P.z) * k) * S; T.dist = sep > 900 ? 11.5 : clamp(8 + sep * 0.0085, 8.6, 15.5); T.yaw = clamp(((b.z || 0) - P.z) * S * Math.sign(b.x - P.x || 1) * -0.08, -0.22, 0.22); }
      if (P.y < GY - 150) { T.fy = 1.25 + (GY - P.y) * S * 0.5; T.dist += 1.2; }
      if (G.cutin && G.cutin.P) { const C = G.cutin.P; T = { fx: toX(C.x + C.face * 50), fy: 1.15, fz: (C.z || 0) * S, dist: 5.6, pitch: 0.1, yaw: C.face * (0.55 + G.cutin.t * 0.004), fov: 36 }; }
      if (G.over === 'win' && !b) { const k = G.bosses.find(x => !x.def.minion); if (k) T = { fx: toX(k.x), fy: 1.3, fz: (k.z || 0) * S, dist: 8, pitch: 0.18, yaw: Math.sin(time * 0.25) * 0.6, fov: 38 }; }
      T.fx = clamp(T.fx, toX(AL) + 4, toX(AR) - 4);
    }
    const ek = 1 - Math.exp(-dt * (G.cutin ? 6 : 3));
    for (const k in T) V[k] += (T[k] - V[k]) * ek;
    if (Math.abs(camera.fov - V.fov) > 0.01) { camera.fov = V.fov; camera.updateProjectionMatrix(); }
    const sx = G.shake > 0.5 ? rnd(-G.shake, G.shake) : 0, sy = G.shake > 0.5 ? rnd(-G.shake, G.shake) : 0;
    const cp = Math.cos(V.pitch);
    camera.position.set(V.fx + Math.sin(V.yaw) * cp * V.dist, V.fy + Math.sin(V.pitch) * V.dist, V.fz + Math.cos(V.yaw) * cp * V.dist);
    camera.lookAt(V.fx, V.fy, V.fz);
    camera.position.x -= sx * S; camera.position.y += sy * S;
    if (G.tiltT > 0) camera.rotateZ(G.tilt * 0.12 * Math.sin(Math.PI * G.tiltT / 120));
    camera.updateMatrixWorld();
    api.lastShake = [sx, sy];
    if (api.camOverride) { const o = api.camOverride; camera.position.set(...o.pos); camera.lookAt(...o.look); }
    if (world) world.update(time, camera);
    { const base = moonLight.userData.base; if (base) { moonLight.position.set(base[0] + V.fx, base[1], base[2] + V.fz); moonLight.target.position.set(V.fx, 0, V.fz); moonLight.target.updateMatrixWorld(); } }
    // flash lights
    for (const l of flashLights) { if (l.userData.life > 0) { l.userData.life -= dt * 3; l.intensity = Math.max(0, l.userData.life) * l.userData.power; } else l.intensity = 0; }
    if (G.flashScreen && G.flashScreen.t < 2) flash(activeP ? activeP().x : 640, 420, 'sun', 6);
    syncActors(actors || [], dt);
    syncGhosts(G);
    syncFx((G.fx || []));
    syncProj(G.pproj || []);
    syncEnemy(G.eproj || [], G.haz || [], G.bosses || []);
    updateParticles((G.parts || []).concat(G.amb || []));
    bloom.strength = 0.85 + (G.flashScreen ? 0.5 : 0);
    grade.uniforms.uTime.value = time; grade.uniforms.uAA.value = api.quality >= 1 ? 1 : 0;
    composer.render(dt);
    api.stats.calls = renderer.info.render.calls; api.stats.tris = renderer.info.render.triangles;
  };
  api.loadVRM = loadVRM;
  api.clear = function () {
    for (const [e, m] of fxMeshes) disposeFx(m);
    fxMeshes.clear();
  };
  try { init(); } catch (e) { console.error('3D init failed, using 2D', e); api.ok = false; }
  return api;
})();
