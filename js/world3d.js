// ============================================================
//  WORLD3D — fully 3D procedural stage environments.
//  Shader sky (stars, moon halo, drifting clouds, dawn), displaced terrain
//  with distant mountains + aerial perspective, instanced vegetation that
//  sways in the wind (pines, cedars, broadleaf, wisteria racemes, grass,
//  ferns), rocks, ground mist, GPU weather (petals, snow, embers, fireflies,
//  steam, smoke), water, and per-arc architecture. Everything is generated
//  in code — no model or texture downloads.
// ============================================================
'use strict';

const WORLD3D = (() => {
  if (!window.THREE) return null;
  const T3 = THREE;
  const U = { uTime: { value: 0 } };            // shared animated uniform
  let E = null, G3 = null, anim = [], detail = [], rs = 1;
  const rnd = (a, b) => { rs = (rs * 16807) % 2147483647; return a + (rs / 2147483647) * (b - a); };
  const pick = (arr) => arr[Math.floor(rnd(0, arr.length - 0.0001))];
  const C = (c) => new T3.Color(c);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // ---------------- noise ----------------
  function h2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return lerp(lerp(h2(ix, iy), h2(ix + 1, iy), u), lerp(h2(ix, iy + 1), h2(ix + 1, iy + 1), u), v); }
  function fbm(x, y, o) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < (o || 4); i++) { s += a * vn(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
  function ridge(x, y) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < 5; i++) { s += a * (1 - Math.abs(vn(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; } return s; }
  const GLSL_NOISE = `
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float hs3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
    float vno(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }
    float fbm2(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vno(p); p*=2.03; a*=.5; } return s; }`;

  // ---------------- textures (generated once, cached) ----------------
  const TX = {};
  function tex(key, w, h, draw, rep) {
    if (!TX[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = 8; TX[key] = t; }
    const t = TX[key]; if (rep) t.repeat.set(rep[0], rep[1]); return t;
  }
  const speck = (g, w, h, n, col, s0, s1) => { for (let i = 0; i < n; i++) { g.fillStyle = col(); const s = s0 + Math.random() * (s1 - s0); g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
  const T = {
    grass: () => tex('grass', 512, 512, (g, w, h) => { g.fillStyle = '#6f7f5a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 90 + Math.random() * 90; g.fillStyle = `rgba(${v * 0.75 | 0},${v | 0},${v * 0.55 | 0},${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3 + Math.random() * 7); } speck(g, w, h, 600, () => `rgba(60,50,30,${Math.random() * 0.3})`, 2, 6); }),
    dirt: () => tex('dirt', 512, 512, (g, w, h) => { g.fillStyle = '#7a6a54'; g.fillRect(0, 0, w, h); speck(g, w, h, 7000, () => { const v = 80 + Math.random() * 90; return `rgba(${v | 0},${v * 0.85 | 0},${v * 0.65 | 0},.5)`; }, 1, 4); speck(g, w, h, 300, () => 'rgba(40,30,20,.35)', 3, 9); }),
    cobble: () => tex('cobble', 512, 512, (g, w, h) => { g.fillStyle = '#3a3634'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 20; x < w + 40; x += 40) { const v = 85 + Math.random() * 50; g.fillStyle = `rgb(${v | 0},${v * 0.96 | 0},${v * 0.92 | 0})`; g.beginPath(); g.ellipse(x, y + 16, 17, 13, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(x - 4, y + 11, 8, 4, 0, 0, TAU); g.fill(); } }),
    wood: () => tex('wood', 256, 256, (g, w, h) => { g.fillStyle = '#9a7650'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const v = 0.8 + Math.random() * 0.35; g.fillStyle = `rgba(${150 * v | 0},${112 * v | 0},${74 * v | 0},1)`; g.fillRect(0, i * 32, w, 31); g.fillStyle = 'rgba(30,18,8,.55)'; g.fillRect(0, i * 32 + 31, w, 1.5); } for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(60,36,18,${Math.random() * 0.2})`; g.lineWidth = 1; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rnd(-3, 3), w * 0.6, y + rnd(-3, 3), w, y); g.stroke(); } }),
    bark: () => tex('bark', 128, 256, (g, w, h) => { g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${20 + Math.random() * 30},${14 + Math.random() * 20},10,.7)`; g.lineWidth = 1 + Math.random() * 3; const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rnd(-6, 6), h); g.stroke(); } }),
    plaster: () => tex('plaster', 256, 256, (g, w, h) => { g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, w, h); speck(g, w, h, 3000, () => `rgba(120,110,90,${Math.random() * 0.08})`, 1, 4); }),
    tile: () => tex('tile', 256, 256, (g, w, h) => { g.fillStyle = '#3a3c44'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, '#2a2c34'); gr.addColorStop(0.5, '#5a5e6a'); gr.addColorStop(1, '#24262e'); g.fillStyle = gr; g.fillRect(x, 0, 32, h); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y, w, 3); } }),
    thatch: () => tex('thatch', 256, 256, (g, w, h) => { g.fillStyle = '#7a6440'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { const v = 80 + Math.random() * 90; g.strokeStyle = `rgba(${v | 0},${v * 0.8 | 0},${v * 0.5 | 0},.6)`; g.lineWidth = 1; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2), y + 14); g.stroke(); } }),
    brick: () => tex('brick', 256, 256, (g, w, h) => { g.fillStyle = '#6a6058'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 16 - 16; x < w; x += 32) { const v = 0.8 + Math.random() * 0.35; g.fillStyle = `rgb(${150 * v | 0},${70 * v | 0},${50 * v | 0})`; g.fillRect(x + 1, y + 1, 30, 14); } }),
    stone: () => tex('stone', 256, 256, (g, w, h) => { g.fillStyle = '#8a8680'; g.fillRect(0, 0, w, h); speck(g, w, h, 5000, () => { const v = 90 + Math.random() * 80; return `rgba(${v | 0},${v | 0},${v * 0.95 | 0},.5)`; }, 1, 5); for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(40,40,40,.25)'; g.beginPath(); g.moveTo(Math.random() * w, Math.random() * h); g.lineTo(Math.random() * w, Math.random() * h); g.stroke(); } }),
    tatami: () => tex('tatami', 256, 512, (g, w, h) => { g.fillStyle = '#b8b070'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(80,70,20,${0.06 + Math.random() * 0.08})`; g.fillRect(0, y, w, 1.5); } g.fillStyle = '#2a3a2a'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); }),
    shoji: () => tex('shoji', 256, 256, (g, w, h) => { g.fillStyle = '#fff4dc'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2412'; g.lineWidth = 12; g.strokeRect(0, 0, w, h); g.lineWidth = 4; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * h / 6); g.lineTo(w, i * h / 6); g.stroke(); } }),
    lattice: () => tex('lattice', 256, 256, (g, w, h) => { g.fillStyle = '#ffcf8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1414'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 7, h); g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); }),
    windows: () => tex('windows', 256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { if (Math.random() < 0.45) continue; const gr = g.createLinearGradient(0, y * 64 + 12, 0, y * 64 + 52); gr.addColorStop(0, '#ffd890'); gr.addColorStop(1, '#ff9a40'); g.fillStyle = gr; g.fillRect(x * 64 + 14, y * 64 + 12, 36, 40); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x * 64 + 31, y * 64 + 12, 2, 40); g.fillRect(x * 64 + 14, y * 64 + 30, 36, 2); } }),
    ice: () => tex('ice', 512, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#a8d8f0'); gr.addColorStop(1, '#7ab8e0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`; g.lineWidth = Math.random() * 1.5 + 0.3; let x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-40, 40); y += rnd(-40, 40); g.lineTo(x, y); } g.stroke(); } }),
    moon: () => tex('moon', 256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2 - 20, h / 2 - 20, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fffef4'); gr.addColorStop(0.85, '#e8e2d0'); gr.addColorStop(1, '#c8c0b0'); g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU); g.fill(); g.save(); g.clip(); for (let i = 0; i < 28; i++) { g.fillStyle = `rgba(120,115,110,${0.08 + Math.random() * 0.18})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 0, TAU); g.fill(); } g.restore(); }),
    glow: () => tex('glow', 128, 128, (g, w, h) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }),
    banner: (s, bg, fg) => tex('banner' + s + bg, 64, 256, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = 'bold 50px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [...s].forEach((ch, i) => g.fillText(ch, w / 2, 40 + i * 58)); }),
  };

  // ---------------- static batches (merge many parts → few draw calls) ----------------
  const _m = new T3.Matrix4(), _q = new T3.Quaternion(), _e = new T3.Euler(), _p = new T3.Vector3(), _s = new T3.Vector3();
  function M(x, y, z, ry, sx, sy, sz, rx, rz) { _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _p.set(x || 0, y || 0, z || 0); _s.set(sx || 1, sy || sx || 1, sz || sx || 1); return _m.clone().compose(_p, _q, _s); }
  function flipWinding(g) { // mirrored transforms turn triangles inside-out: swap 2nd/3rd vertex of every triangle
    for (const nm in g.attributes) { const a = g.attributes[nm], k = a.itemSize, arr = a.array; for (let t = 0; t < a.count; t += 3) for (let c = 0; c < k; c++) { const i1 = (t + 1) * k + c, i2 = (t + 2) * k + c, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; } }
  }
  function Batch() {
    const groups = new Map();
    return {
      add(geo, key, color, m) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        if (m) { g.applyMatrix4(m); if (m.determinant() < 0) flipWinding(g); }
        if (!g.attributes.uv) g.setAttribute('uv', new T3.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (!g.attributes.color) { const c = C(color === undefined ? 0xffffff : color), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new T3.BufferAttribute(a, 3)); }
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
        (groups.get(key) || groups.set(key, []).get(key)).push(g);
      },
      build(mats, opts) {
        opts = opts || {};
        for (const [key, list] of groups) {
          const out = new T3.BufferGeometry();
          for (const nm of ['position', 'normal', 'uv', 'color']) {
            const size = list[0].attributes[nm].itemSize; let n = 0; for (const p of list) n += p.attributes[nm].array.length;
            const arr = new Float32Array(n); let o = 0; for (const p of list) { arr.set(p.attributes[nm].array, o); o += p.attributes[nm].array.length; }
            out.setAttribute(nm, new T3.BufferAttribute(arr, size));
          }
          list.forEach(p => p.dispose());
          const mesh = new T3.Mesh(out, mats[key] || mats.def); mesh.receiveShadow = opts.receive !== false; mesh.castShadow = !!(opts.cast && opts.cast[key]);
          add(mesh);
        }
      },
    };
  }
  // box with world-scaled UVs (texture tiles every `t` units)
  function boxG(w, h, d, t) {
    t = t || 1; const g = new T3.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / t, uv.getY(k) * dims[f][1] / t); }
    return g;
  }
  function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
  const lam = (o) => new T3.MeshLambertMaterial(Object.assign({ vertexColors: true }, o || {}));
  const basic = (o) => new T3.MeshBasicMaterial(Object.assign({ vertexColors: true }, o || {}));
  function add(o) { G3.add(o); return o; }

  // ---------------- wind ----------------
  // kind: 'tree' (bends with height), 'grass' (tips flutter), 'hang' (pivot at top, swings below)
  function windify(mat, kind, amp) {
    const k = kind === 'grass' ? `pow(max(position.y, 0.), 2.) * ${amp || 0.18}` : kind === 'hang' ? `pow(max(-position.y, 0.), 1.4) * ${amp || 0.14}` : `pow(max(position.y, 0.), 2.) * ${amp || 0.035}`;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ipos = vec3(0.);
        #endif
        float wph = ipos.x * .37 + ipos.z * .23;
        float wk = ${k};
        float gust = .65 + .35 * sin(uTime * .4 + ipos.x * .05);
        transformed.x += (sin(uTime * 1.6 + wph) * .7 + sin(uTime * 3.7 + wph * 2.1) * .3) * wk * gust;
        transformed.z += cos(uTime * 1.2 + wph * 1.3) * wk * .35;`);
    };
    mat.customProgramCacheKey = () => 'wind-' + kind + (amp || '');
    return mat;
  }
  function instanced(geo, mat, list, place, opts) {
    opts = opts || {};
    const m = new T3.InstancedMesh(geo, mat, list.length), o = new T3.Object3D();
    list.forEach((it, i) => { place(o, it, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (it.col) m.setColorAt(i, it.col); });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = !!opts.cast; m.receiveShadow = opts.receive !== false; m.frustumCulled = false;
    add(m); if (opts.detail) detail.push(m);
    return m;
  }

  // ---------------- sky dome ----------------
  const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`;
  const SKY_FS = `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uFog; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform vec3 uSunDir; uniform vec3 uSunCol;
    uniform float uTime; uniform float uStars; uniform float uCloud; uniform float uSun; uniform vec3 uCloudCol;
    varying vec3 vDir; ${GLSL_NOISE}
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uHor, uZen, pow(smoothstep(-0.02, 0.6, h), 0.7));
      float sd = max(dot(d, uSunDir), 0.);
      col += uSunCol * uSun * (pow(sd, 8.) * .6 + pow(sd, 2.) * .25) * smoothstep(-.1, .3, 1. - h);
      if (uStars > 0.) {
        vec3 p = d * 260.; vec3 c = floor(p); float r = hs3(c);
        if (r > .9965) { vec3 f = fract(p) - .5; float s = smoothstep(.16, 0., length(f)); float tw = .55 + .45 * sin(uTime * (2. + r * 3.) + r * 90.);
          col += vec3(.85, .9, 1.) * s * tw * uStars * smoothstep(0.02, .3, h) * (1. - uSun); }
        float mw = fbm2(d.xz / (h + .6) * 3. + 4.); col += vec3(.5, .45, .7) * pow(mw, 3.) * .18 * uStars * smoothstep(.1, .7, h) * (1. - uSun);
      }
      float md = max(dot(d, uMoonDir), 0.);
      col += uMoonCol * (pow(md, 900.) * 1.2 + pow(md, 60.) * .35 + pow(md, 8.) * .12) * (1. - uSun * .8);
      if (uCloud > 0. && h > -.05) {
        vec2 uv = d.xz / (h + .18) * 1.3 + vec2(uTime * .008, uTime * .002);
        float n = fbm2(uv * 1.4); float n2 = fbm2(uv * 3.1 + 7.);
        float cl = smoothstep(.48, .78, n * .75 + n2 * .35) * uCloud;
        vec3 cc = mix(uCloudCol, uMoonCol * .9 + uSunCol * uSun, clamp(pow(md, 5.) + pow(sd, 3.) * uSun, 0., 1.) * .7);
        cc *= .75 + .4 * n2;
        col = mix(col, cc, cl * smoothstep(-.05, .12, h));
      }
      col = mix(uFog, col, smoothstep(-.06, .14, h));
      gl_FragColor = vec4(col, 1.);
    }`;
  let sky = null, moonMesh = null, moonGlow = null;
  function makeSky(o) {
    const mat = new T3.ShaderMaterial({
      uniforms: { uZen: { value: C(o.zen) }, uHor: { value: C(o.hor) }, uFog: { value: C(o.fog) }, uMoonDir: { value: new T3.Vector3(...(o.moonDir || [0.45, 0.42, -1])).normalize() }, uMoonCol: { value: C(o.moon || '#d8d8ff') },
        uSunDir: { value: new T3.Vector3(0.5, -0.1, -1).normalize() }, uSunCol: { value: C('#ff9a50') }, uSun: { value: 0 }, uTime: U.uTime, uStars: { value: o.stars === undefined ? 1 : o.stars }, uCloud: { value: o.cloud === undefined ? 0.5 : o.cloud }, uCloudCol: { value: C(o.cloudCol || o.hor) } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T3.BackSide, depthWrite: false, fog: false,
    });
    sky = new T3.Mesh(new T3.SphereGeometry(400, 48, 24), mat); sky.renderOrder = -10; sky.frustumCulled = false; add(sky);
    if (o.moonSize !== 0) {
      const md = mat.uniforms.uMoonDir.value, R = 380;
      moonMesh = new T3.Sprite(new T3.SpriteMaterial({ map: T.moon(), color: C(o.moon || '#fff').lerp(C('#ffffff'), 0.5), fog: false, depthWrite: false }));
      const ms = (o.moonSize || 1) * 26; moonMesh.scale.set(ms, ms, 1); moonMesh.position.copy(md).multiplyScalar(R); moonMesh.renderOrder = -9; add(moonMesh);
      moonGlow = new T3.Sprite(new T3.SpriteMaterial({ map: T.glow(), color: C(o.moon || '#fff'), fog: false, depthWrite: false, blending: T3.AdditiveBlending, transparent: true, opacity: 0.55 }));
      moonGlow.scale.set(ms * 4.5, ms * 4.5, 1); moonGlow.position.copy(moonMesh.position); moonGlow.renderOrder = -9; add(moonGlow);
    }
    return mat;
  }

  // ---------------- terrain ----------------
  // height: flat gameplay band near the camera, rolling hills behind, mountains at the horizon
  let HF = () => 0;
  function terrain(o) {
    const amp = o.amp === undefined ? 1 : o.amp, y0 = o.y || 0, flatZ = o.flatZ === undefined ? -3.5 : o.flatZ;
    HF = (x, z) => {
      if (z > flatZ) return y0;
      const t = smooth(flatZ, flatZ - 18, z), far = smooth(-45, -150, z);
      let hh = (fbm(x * 0.05 + 3, z * 0.05) - 0.35) * 5 * t * amp;
      hh += ridge(x * 0.012 + 1.7, z * 0.012) * far * 38 * (o.mount === undefined ? 1 : o.mount);
      if (o.valley) hh -= smooth(flatZ - 2, flatZ - 12, z) * o.valley * (1 - far);
      return y0 + Math.max(hh, o.floor === undefined ? -2 : o.floor);
    };
    const W = 340, D = 190, g = new T3.PlaneGeometry(W, D, 170, 95); g.rotateX(-Math.PI / 2); g.translate(0, 0, 12 - D / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), uv = g.attributes.uv;
    const cA = C(o.c1 || '#3a4a2c'), cB = C(o.c2 || '#5a6a3a'), cR = C(o.rock || '#5a5650'), cS = C(o.snow || o.rock || '#5a5650'), tmp = new T3.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), hgt = HF(x, z); p.setY(i, hgt);
      uv.setXY(i, x / (o.tile || 3), z / (o.tile || 3));
      const n = fbm(x * 0.15, z * 0.15, 3);
      tmp.copy(cA).lerp(cB, n);
      const steep = clamp((hgt - y0) / 26, 0, 1); tmp.lerp(cR, smooth(0.15, 0.6, steep)); if (o.snow) tmp.lerp(cS, smooth(0.55, 0.85, steep));
      if (o.path && Math.abs(z - (o.path.z || 0)) < (o.path.w || 1.6) + n * 0.6) tmp.lerp(C(o.path.c || '#6a5a44'), 0.75);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new T3.BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new T3.Mesh(g, lam({ map: o.map || T.grass() })); m.receiveShadow = true; add(m);
    return m;
  }
  // flat ground slab (indoor floors, roads, roofs)
  function floor(o) {
    const g = new T3.PlaneGeometry(o.w || 120, o.d || 30, 1, 1); g.rotateX(-Math.PI / 2); scaleUV(g, (o.w || 120) / (o.tile || 2), (o.d || 30) / (o.tile || 2));
    const m = new T3.Mesh(g, new T3.MeshLambertMaterial({ map: o.map, color: o.color || 0xffffff })); m.position.set(o.x || 0, o.y || 0, o.z === undefined ? -(o.d || 30) / 2 + 6 : o.z); m.receiveShadow = true; add(m);
    return m;
  }

  // ---------------- vegetation geometry ----------------
  function colorize(g, c0, c1, axis, from, to, pow) {
    const p = g.attributes.position, a = C(c0), b = C(c1), arr = new Float32Array(p.count * 3), t = new T3.Color();
    for (let i = 0; i < p.count; i++) { const u = clamp((p['get' + (axis || 'Y')](i) - from) / (to - from), 0, 1); t.copy(a).lerp(b, Math.pow(u, pow || 1)); arr[i * 3] = t.r; arr[i * 3 + 1] = t.g; arr[i * 3 + 2] = t.b; }
    g.setAttribute('color', new T3.BufferAttribute(arr, 3)); return g;
  }
  function mergeList(list) { const b = []; for (const g of list) { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.uv) n.setAttribute('uv', new T3.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); b.push(n); }
    const out = new T3.BufferGeometry(); for (const nm of ['position', 'normal', 'uv', 'color']) { let n = 0; for (const g of b) n += g.attributes[nm].array.length; const arr = new Float32Array(n); let o = 0; for (const g of b) { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; } out.setAttribute(nm, new T3.BufferAttribute(arr, b[0].attributes[nm].itemSize)); } return out; }
  function jitter(g, k, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = vn(x * 7 + seed, z * 7 + y * 3) - 0.5; p.setXYZ(i, x * (1 + n * k), y + n * k * 0.3, z * (1 + n * k)); } g.computeVertexNormals(); return g; }
  // conifer: stacked drooping skirts, height 1
  const geoCache = {};
  function pineGeo(dark, light, lod) { // lod: 0 = near (detailed), 1 = far (light)
    const ck = 'pine' + dark + light + (lod || 0); if (geoCache[ck]) return geoCache[ck];
    const parts = [colorize(new T3.CylinderGeometry(0.02, 0.05, 1, lod ? 4 : 6).translate(0, 0.5, 0), '#2a1e16', '#3a2a1e', 'Y', 0, 1)];
    const N = lod ? 6 : 9;
    for (let i = 0; i < N; i++) {
      const u = i / N, r = 0.36 * (1 - u) + 0.05, y = 0.18 + u * 0.78, hgt = (0.25 - u * 0.08) * (lod ? 1.3 : 1);
      const c = new T3.ConeGeometry(r, hgt, lod ? 8 : 13, lod ? 1 : 2, false); const p = c.attributes.position;
      for (let k = 0; k < p.count; k++) { const yy = p.getY(k); if (yy < 0) { const a = Math.atan2(p.getZ(k), p.getX(k)); const jag = 1 + (Math.sin(a * 5 + i) * 0.12) + (vn(a * 3, i) - 0.5) * 0.2; p.setXYZ(k, p.getX(k) * jag, yy - 0.03 * jag, p.getZ(k) * jag); } }
      c.computeVertexNormals(); c.translate(0, y + hgt / 2, 0);
      parts.push(colorize(c, shade(dark, -6 + i * 2), shade(light, i * 3), 'Y', y, y + hgt, 0.8));
    }
    const g = mergeList(parts); g.userData.shared = 1; return (geoCache[ck] = g);
  }
  // tall cedar: long bare trunk + high narrow canopy
  function cedarGeo() {
    const parts = [colorize(new T3.CylinderGeometry(0.03, 0.06, 1, 7).translate(0, 0.5, 0), '#2a1c14', '#3a281c', 'Y', 0, 1)];
    for (let i = 0; i < 6; i++) { const u = i / 6, y = 0.5 + u * 0.48, r = 0.16 * (1 - u * 0.7) + 0.03; const c = jitter(new T3.IcosahedronGeometry(1, 1), 0.28, i * 3.1); c.scale(r, 0.11, r); c.translate(Math.sin(i * 2.3) * 0.03, y, Math.cos(i * 1.7) * 0.03); parts.push(colorize(c, '#0c1610', '#22301e', 'Y', y - 0.1, y + 0.1)); }
    return mergeList(parts);
  }
  function broadleafGeo(c0, c1) {
    const parts = [colorize(new T3.CylinderGeometry(0.035, 0.07, 0.55, 7).translate(0, 0.275, 0), '#3a2a1e', '#4a3626', 'Y', 0, 0.5)];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = 0.18 + (i % 3) * 0.04; const c = jitter(new T3.IcosahedronGeometry(1, 1), 0.3, i * 1.7); c.scale(r * 1.2, r, r * 1.2); const y = 0.62 + Math.sin(i * 1.9) * 0.1; c.translate(Math.cos(a) * 0.17, y, Math.sin(a) * 0.17); parts.push(colorize(c, c0, c1, 'Y', y - r, y + r)); }
    const top = jitter(new T3.IcosahedronGeometry(1, 1), 0.3, 9); top.scale(0.24, 0.2, 0.24); top.translate(0, 0.86, 0); parts.push(colorize(top, c0, c1, 'Y', 0.66, 1.06));
    return mergeList(parts);
  }
  function grassGeo() { // clump of 3 curved blades, height 1
    const parts = [];
    for (let b = 0; b < 3; b++) {
      const g = new T3.PlaneGeometry(0.07, 1, 1, 4); g.translate(0, 0.5, 0); const p = g.attributes.position;
      const bend = 0.15 + b * 0.08;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.85) + bend * y * y); }
      g.rotateY(b * 2.1 + 0.3); g.computeVertexNormals();
      parts.push(colorize(g, '#2a3a1a', '#9ab060', 'Y', 0, 1, 1.2));
    }
    return mergeList(parts);
  }
  function fernGeo() {
    const parts = [];
    for (let b = 0; b < 7; b++) { const g = new T3.PlaneGeometry(0.16, 1, 1, 5); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, y * 1.1))); p.setZ(i, -y * y * 0.5); } g.rotateY(b / 7 * TAU); g.computeVertexNormals(); parts.push(colorize(g, '#1a2a14', '#4a6a30', 'Y', 0, 1)); }
    return mergeList(parts);
  }
  function racemeGeo(c0, c1) { // hanging wisteria flower cluster, top at y=0, length 1
    const parts = [];
    for (let i = 0; i < 26; i++) { const u = i / 26, a = i * 2.6, r = 0.13 * (1 - u) + 0.02; const g = new T3.OctahedronGeometry(0.05 * (1 - u * 0.5), 0); g.scale(1, 0.7, 1); g.translate(Math.cos(a) * r, -u, Math.sin(a) * r); parts.push(colorize(g, c0, c1, 'Y', 0, -1, 1.3)); }
    parts.push(colorize(new T3.CylinderGeometry(0.008, 0.008, 1, 3).translate(0, -0.5, 0), '#3a4a2a', '#3a4a2a', 'Y', 0, 1));
    return mergeList(parts);
  }
  function rockGeo() { const g = jitter(new T3.IcosahedronGeometry(1, 2), 0.45, 4.2); g.scale(1, 0.62, 0.9); g.translate(0, 0.25, 0); return colorize(g, '#4a4844', '#8a8680', 'Y', -0.3, 0.9); }

  // forest: place trees on the terrain
  function forest(geo, n, o) {
    const mat = windify(lam({ map: o.map || null }), 'tree', o.sway);
    const list = []; let guard = 0;
    while (list.length < n && guard++ < n * 20) {
      const z = rnd(o.z0, o.z1), x = rnd(-(o.w || 60), o.w || 60);
      if (o.avoid && o.avoid(x, z)) continue;
      const s = rnd(o.s0, o.s1) * (o.grow ? 1 + smooth(o.z1, o.z0, z) * o.grow : 1);
      list.push({ x, z, s, ry: rnd(0, TAU), col: C('#ffffff').multiplyScalar(rnd(0.75, 1.15)) });
    }
    return instanced(geo, mat, list, (ob, t) => { ob.position.set(t.x, HF(t.x, t.z) - 0.05 * t.s, t.z); ob.rotation.set(0, t.ry, 0); ob.scale.set(t.s * (o.wide || 1), t.s, t.s * (o.wide || 1)); }, { cast: o.cast });
  }
  function grass(n, o) {
    o = o || {};
    const mat = windify(lam({ side: T3.DoubleSide }), 'grass', o.amp);
    const list = [];
    n = Math.round(n * 1.5); for (let i = 0; i < n; i++) { const z = Math.pow(rnd(0, 1), 1.6) * (o.z1 === undefined ? -16 : o.z1) + (o.z0 === undefined ? 4 : o.z0); const half = (13.4 - z) * 0.45 + 17; const x = rnd(-half, half); if (o.avoid && o.avoid(x, z)) continue; list.push({ x, z, s: rnd(0.12, 0.3) * (o.h || 1), ry: rnd(0, TAU), col: C(o.tint || '#ffffff').multiplyScalar(rnd(0.7, 1.15)) }); }
    return instanced(grassGeo(), mat, list, (ob, t) => { ob.position.set(t.x, HF(t.x, t.z), t.z); ob.rotation.set(0, t.ry, 0); ob.scale.set(t.s * 1.3, t.s, t.s * 1.3); }, { detail: 1 });
  }
  function rocks(n, o) {
    const list = []; for (let i = 0; i < n; i++) { const z = rnd(o.z0, o.z1), x = rnd(-(o.w || 30), o.w || 30); if (o.avoid && o.avoid(x, z)) continue; list.push({ x, z, s: rnd(o.s0 || 0.2, o.s1 || 0.8), ry: rnd(0, 6), col: C(o.tint || '#ffffff').multiplyScalar(rnd(0.7, 1.1)) }); }
    return instanced(rockGeo(), lam({ map: T.stone() }), list, (ob, t) => { ob.position.set(t.x, HF(t.x, t.z) - t.s * 0.1, t.z); ob.rotation.set(rnd(-0.2, 0.2), t.ry, rnd(-0.2, 0.2)); ob.scale.set(t.s, t.s, t.s); }, { cast: true });
  }
  const bandFree = (x, z) => z > -3.6 && z < 4; // keep the fighting lane clear

  // ---------------- atmosphere ----------------
  const MIST_FS = `uniform float uTime; uniform vec3 uCol; uniform float uA; uniform float uSeed; varying vec2 vUv; ${GLSL_NOISE}
    void main(){ vec2 p = vUv * vec2(6., 2.) + vec2(uTime * .03 + uSeed, uSeed); float n = fbm2(p + fbm2(p * 1.7 - uTime * .02));
      float edge = smoothstep(0., .25, vUv.x) * smoothstep(1., .75, vUv.x) * smoothstep(0., .3, vUv.y) * smoothstep(1., .55, vUv.y);
      gl_FragColor = vec4(uCol, smoothstep(.35, .85, n) * edge * uA); }`;
  function mist(o) {
    const mat = new T3.ShaderMaterial({ uniforms: { uTime: U.uTime, uCol: { value: C(o.col) }, uA: { value: o.a || 0.5 }, uSeed: { value: rnd(0, 50) } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: MIST_FS, transparent: true, depthWrite: false, fog: false, side: T3.DoubleSide, blending: o.add ? T3.AdditiveBlending : T3.NormalBlending });
    const m = new T3.Mesh(new T3.PlaneGeometry(o.w || 90, o.h || 6), mat);
    if (o.flat) m.rotation.x = -Math.PI / 2;
    m.position.set(o.x || 0, o.y || 2, o.z || -10); add(m); detail.push(m); return m;
  }
  function mistLayers(col, a, zs, y, h) { for (const z of zs) mist({ col, a, z, y: (y || 1.5) + HF(0, z) * 0.6, h: h || 5, w: 120 + Math.abs(z) * 2 }); }
  // GPU particles: kind 'fall' (petals/snow/ash), 'rise' (embers/steam/smoke), 'fly' (fireflies)
  const PTS_VS = `uniform float uTime; uniform float uDrift; uniform float uSize; uniform vec3 uBox; uniform vec3 uOrigin; uniform float uSpeed; uniform int uKind; attribute vec4 seed; varying float vA; varying float vR; varying float vS;
    void main(){ vec3 p = seed.xyz * uBox; float t = uTime * uSpeed * (.6 + seed.w * .8);
      if (uKind == 0) { p.y = mod(p.y - t, uBox.y); p.x += sin(t * .9 + seed.w * 20.) * .8 + t * .25; p.z += cos(t * .7 + seed.x * 9.) * .5; }
      else if (uKind == 1) { p.y = mod(p.y + t, uBox.y); p.x += sin(t * 1.3 + seed.w * 30.) * .3 * (p.y / uBox.y + .2); }
      else { p += vec3(sin(t * .7 + seed.w * 40.), sin(t * 1.1 + seed.x * 17.) * .5, cos(t * .6 + seed.y * 23.)) * 1.2; }
      p.x = mod(p.x + uTime * uDrift, uBox.x); vec3 wp = uOrigin + p - vec3(uBox.x * .5, 0., uBox.z * .5);
      vec4 mv = modelViewMatrix * vec4(wp, 1.); gl_Position = projectionMatrix * mv;
      float life = uKind == 1 ? 1. - p.y / uBox.y : 1.; vS = life;
      vA = (uKind == 2 ? .5 + .5 * sin(uTime * 3. + seed.w * 50.) : 1.) * smoothstep(0., .1, life);
      vR = seed.w * 6.28 + uTime * (seed.x - .5) * 3.;
      gl_PointSize = uSize * (uKind == 1 ? (1.6 - life) : 1.) * (40. / -mv.z) * (.6 + seed.y * .8); }`;
  const PTS_FS = `uniform vec3 uCol; uniform vec3 uCol2; uniform int uShape; uniform float uA; varying float vA; varying float vR; varying float vS;
    void main(){ vec2 c = gl_PointCoord - .5; float s = sin(vR), co = cos(vR); c = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
      float a; if (uShape == 1) a = smoothstep(.5, .3, length(c * vec2(1., 2.2))); else if (uShape == 2) a = smoothstep(.5, .0, length(c)) * .6; else a = smoothstep(.5, .1, length(c));
      gl_FragColor = vec4(mix(uCol2, uCol, vS), a * vA * uA); }`;
  function particles(o) {
    if (o.origin && o.origin[0] === 0 && o.box && o.box[0] < 56) { o.n = Math.round((o.n || 300) * 56 / o.box[0]); o.box = [56, o.box[1], o.box[2]]; } // cover the wide arena
    const n = o.n || 300, g = new T3.BufferGeometry(), seed = new Float32Array(n * 4), pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 4; i++) seed[i] = Math.random();
    g.setAttribute('seed', new T3.BufferAttribute(seed, 4)); g.setAttribute('position', new T3.BufferAttribute(pos, 3));
    const kind = { fall: 0, rise: 1, fly: 2 }[o.kind || 'fall'];
    const mat = new T3.ShaderMaterial({ uniforms: { uTime: U.uTime, uDrift: { value: o.drift || 0 }, uSize: { value: o.size || 6 }, uBox: { value: new T3.Vector3(...(o.box || [40, 12, 20])) }, uOrigin: { value: new T3.Vector3(...(o.origin || [0, 0, -6])) }, uSpeed: { value: o.speed || 1 }, uKind: { value: kind }, uCol: { value: C(o.col || '#fff') }, uCol2: { value: C(o.col2 || o.col || '#fff') }, uShape: { value: o.shape || 0 }, uA: { value: o.a || 1 } },
      vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false, blending: o.add ? T3.AdditiveBlending : T3.NormalBlending });
    const pts = new T3.Points(g, mat); pts.frustumCulled = false; add(pts); detail.push(pts); return pts;
  }
  // light shafts (god rays) — additive tapered planes
  function shafts(n, o) {
    const mat = new T3.ShaderMaterial({ uniforms: { uCol: { value: C(o.col) }, uA: { value: o.a || 0.12 }, uTime: U.uTime }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; uniform float uTime; varying vec2 vUv; void main(){ float a = smoothstep(0., .5, vUv.x) * smoothstep(1., .5, vUv.x) * pow(vUv.y, 1.5) * (.75 + .25 * sin(uTime * .5 + vUv.x * 3.)); gl_FragColor = vec4(uCol, a * uA); }',
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending, fog: false, side: T3.DoubleSide });
    for (let i = 0; i < n; i++) { const g = new T3.PlaneGeometry(rnd(1.5, 4), o.h || 18); const m = new T3.Mesh(g, mat); m.position.set(rnd(-26, 26), (o.h || 18) / 2 - 1, rnd(o.z0 || -16, o.z1 || -5)); m.rotation.z = o.tilt === undefined ? -0.35 : o.tilt; add(m); detail.push(m); }
  }
  // glowing lantern with halo sprite (+ optional real light)
  function glowSprite(x, y, z, col, size, op) { const s = new T3.Sprite(new T3.SpriteMaterial({ map: T.glow(), color: C(col), blending: T3.AdditiveBlending, depthWrite: false, transparent: true, opacity: op || 0.6, fog: true })); s.position.set(x, y, z); s.scale.set(size, size, 1); add(s); return s; }
  const lights = [];
  function pointLight(x, y, z, col, inten, dist, flicker) {
    if (lights.length >= 4) return null;
    const l = new T3.PointLight(col, inten, dist || 8, 2); l.position.set(x, y, z); add(l); lights.push(l);
    if (flicker) { const ph = rnd(0, 9); anim.push((t) => { l.intensity = inten * (0.85 + Math.sin(t * 9 + ph) * 0.06 + Math.sin(t * 23 + ph) * 0.05); }); }
    return l;
  }
  // water surface: fresnel sky reflection + moving glints from the key light
  function water(o) {
    const mat = new T3.ShaderMaterial({ uniforms: { uTime: U.uTime, uDeep: { value: C(o.deep || '#0a1a24') }, uSky: { value: C(o.sky || '#4a6a88') }, uGlint: { value: C(o.glint || '#fff6e0') }, uA: { value: o.a || 0.92 } },
      vertexShader: 'varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uGlint; uniform float uA; varying vec3 vW; varying vec2 vUv; ${GLSL_NOISE}
        void main(){ vec3 v = normalize(cameraPosition - vW); float fr = pow(1. - max(v.y, 0.), 4.);
          vec2 p = vW.xz * 1.5; float n = fbm2(p + vec2(uTime * .3, uTime * .2)) - fbm2(p * 1.7 - vec2(uTime * .25, -uTime * .15));
          vec3 col = mix(uDeep, uSky, clamp(fr + n * .25, 0., 1.)); float gl = pow(max(n, 0.) * 2.2, 6.) * 1.5; col += uGlint * gl;
          float e = smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x) * smoothstep(0., .08, vUv.y) * smoothstep(1., .92, vUv.y);
          gl_FragColor = vec4(col, uA * e); }`, transparent: true });
    const m = new T3.Mesh(o.geo || new T3.PlaneGeometry(o.w || 8, o.d || 4), mat); m.rotation.x = -Math.PI / 2; m.position.set(o.x || 0, o.y || 0.02, o.z || -6); add(m); return m;
  }
  // sagging wires/ropes between points
  function wire(b, a, c, sag, col, r) { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new T3.Vector3(lerp(a[0], c[0], u), lerp(a[1], c[1], u) - Math.sin(Math.PI * u) * sag, lerp(a[2], c[2], u))); } b.add(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 12, r || 0.015, 4), 'def', col || '#111'); }

  // ---------------- architecture kits ----------------
  // Japanese gabled roof (kirizuma) with flared eaves
  function roofJP(b, x, y, z, w, d, h, key, col) {
    const s = new T3.Shape(); s.moveTo(-d / 2 - 0.35, 0); s.quadraticCurveTo(-d / 4, h * 0.35, 0, h); s.quadraticCurveTo(d / 4, h * 0.35, d / 2 + 0.35, 0); s.lineTo(d / 2 + 0.2, -0.12); s.quadraticCurveTo(d / 4, h * 0.25, 0, h - 0.14); s.quadraticCurveTo(-d / 4, h * 0.25, -d / 2 - 0.2, -0.12); s.closePath();
    const g = new T3.ExtrudeGeometry(s, { depth: w + 0.6, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -(w + 0.6) / 2); g.rotateY(Math.PI / 2); scaleUV(g, 0.5, 0.5);
    b.add(g, key || 'tile', col || '#ffffff', M(x, y, z));
    b.add(boxG(w + 0.7, 0.12, 0.12), 'def', '#1a1a1e', M(x, y + h, z)); // ridge
  }
  // traditional house: plaster+timber walls, lit shoji, tiled/thatched roof, optional 2nd floor & balcony
  function houseJP(b, x, z, o) {
    o = o || {}; const w = o.w || 4, d = o.d || 3, h = o.h || 2.4, y = HF(x, z);
    b.add(boxG(w, h, d, 1.5), 'plaster', o.wall || '#ece4d2', M(x, y + h / 2, z));
    for (let i = 0; i <= Math.round(w / 1.2); i++) b.add(boxG(0.14, h, 0.16), 'wood', '#3a2618', M(x - w / 2 + i * w / Math.round(w / 1.2), y + h / 2, z + d / 2 + 0.02));
    b.add(boxG(w + 0.1, 0.16, d + 0.1), 'wood', '#3a2618', M(x, y + h - 0.08, z)); b.add(boxG(w + 0.2, 0.3, d + 0.3, 1), 'stone', '#6a6660', M(x, y + 0.15, z));
    const nWin = Math.max(1, Math.round(w / 1.6));
    for (let i = 0; i < nWin; i++) { const wx = x - w / 2 + (i + 0.5) * w / nWin; b.add(new T3.PlaneGeometry(w / nWin * 0.62, h * 0.48), o.litKey || 'shojiLit', '#ffffff', M(wx, y + h * 0.5, z + d / 2 + 0.03)); }
    let top = y + h;
    if (o.floors === 2) { b.add(boxG(w * 0.92, h * 0.85, d * 0.85, 1.5), 'plaster', o.wall || '#ece4d2', M(x, top + h * 0.42, z - 0.1)); for (let i = 0; i < nWin; i++) b.add(new T3.PlaneGeometry(w / nWin * 0.55, h * 0.36), o.litKey || 'shojiLit', '#ffffff', M(x - w * 0.46 + (i + 0.5) * w * 0.92 / nWin, top + h * 0.45, z - 0.1 + d * 0.425 + 0.03));
      if (o.balcony) { b.add(boxG(w * 0.96, 0.08, 0.5), 'wood', '#5a3a22', M(x, top + 0.05, z + d / 2 + 0.1)); for (let i = 0; i <= 10; i++) b.add(boxG(0.04, 0.5, 0.04), 'def', o.rail || '#7a1a14', M(x - w * 0.48 + i * w * 0.096, top + 0.3, z + d / 2 + 0.33)); b.add(boxG(w * 0.96, 0.05, 0.06), 'def', o.rail || '#7a1a14', M(x, top + 0.55, z + d / 2 + 0.33)); }
      roofJP(b, x, top + h * 0.06, z, w * 0.98, d, 0.35, 'tile', '#d0d0d8'); top += h * 0.85; }
    roofJP(b, x, top, z, w, d, o.roofH || 1.1, o.thatch ? 'thatch' : 'tile', o.roofCol || '#ffffff');
  }
  // western brick/stone building (Taisho era)
  function houseWest(b, x, z, o) {
    o = o || {}; const w = o.w || 5, d = o.d || 4, fl = o.floors || 3, fh = 1.6, y = HF(x, z), h = fl * fh;
    b.add(boxG(w, h, d, 2), o.mat || 'brick', o.col || '#ffffff', M(x, y + h / 2, z));
    for (let f = 0; f < fl; f++) { b.add(boxG(w + 0.12, 0.1, d + 0.12), 'stone', '#d8d0c0', M(x, y + f * fh + 0.05, z)); const n = Math.max(2, Math.round(w / 1.1)); for (let i = 0; i < n; i++) { const wx = x - w / 2 + (i + 0.5) * w / n, lit = h2(wx * 3.1 + f, z) < (o.lit === undefined ? 0.55 : o.lit); b.add(new T3.PlaneGeometry(0.5, 0.95), lit ? 'winLit' : 'winDark', '#ffffff', M(wx, y + f * fh + 0.85, z + d / 2 + 0.02)); b.add(boxG(0.66, 0.1, 0.1), 'stone', '#d8d0c0', M(wx, y + f * fh + 1.37, z + d / 2 + 0.05)); } }
    b.add(boxG(w + 0.3, 0.3, d + 0.3), 'stone', '#cfc6b4', M(x, y + h + 0.15, z));
    if (o.dome) { const g = new T3.SphereGeometry(w * 0.22, 16, 10, 0, TAU, 0, Math.PI / 2); b.add(g, 'def', '#3a5a5a', M(x, y + h + 0.3, z)); b.add(new T3.ConeGeometry(0.06, 0.8, 6), 'def', '#2a2a2a', M(x, y + h + 0.3 + w * 0.22 + 0.4, z)); }
    if (o.broken) { for (let i = 0; i < 6; i++) b.add(jitter(boxG(rnd(0.4, 1), rnd(0.3, 0.7), rnd(0.4, 0.9)), 0.3, i), 'brick', '#c0b0a0', M(x + rnd(-w / 2, w / 2), y + 0.2, z + d / 2 + rnd(0.3, 1.5), rnd(0, 3), 1, 1, 1, rnd(-0.4, 0.4))); }
  }
  function stoneLantern(b, x, z, s) {
    s = s || 1; const y = HF(x, z), K = 'stone', c = '#a8a49c';
    b.add(new T3.CylinderGeometry(0.28 * s, 0.34 * s, 0.14 * s, 8), K, c, M(x, y + 0.07 * s, z));
    b.add(new T3.CylinderGeometry(0.1 * s, 0.13 * s, 0.7 * s, 8), K, c, M(x, y + 0.49 * s, z));
    b.add(new T3.CylinderGeometry(0.26 * s, 0.2 * s, 0.1 * s, 6), K, c, M(x, y + 0.88 * s, z));
    b.add(boxG(0.32 * s, 0.3 * s, 0.32 * s), 'lampLit', '#ffffff', M(x, y + 1.08 * s, z));
    b.add(new T3.ConeGeometry(0.42 * s, 0.32 * s, 6), K, c, M(x, y + 1.38 * s, z));
    b.add(new T3.SphereGeometry(0.07 * s, 8, 6), K, c, M(x, y + 1.58 * s, z));
  }
  function paperLantern(b, x, y, z, col, s) { s = s || 1; b.add(new T3.SphereGeometry(0.22 * s, 12, 8).scale(1, 1.25, 1), 'glowV', col || '#ff5030', M(x, y, z)); b.add(new T3.CylinderGeometry(0.14 * s, 0.14 * s, 0.06 * s, 10), 'def', '#1a1010', M(x, y + 0.28 * s, z)); b.add(new T3.CylinderGeometry(0.14 * s, 0.14 * s, 0.06 * s, 10), 'def', '#1a1010', M(x, y - 0.28 * s, z)); }
  function streetLamp(b, x, z, h) { const y = HF(x, z); h = h || 3.2; b.add(new T3.CylinderGeometry(0.05, 0.08, h, 8), 'def', '#1c1e22', M(x, y + h / 2, z)); b.add(new T3.CylinderGeometry(0.16, 0.12, 0.08, 8), 'def', '#1c1e22', M(x, y + h, z)); b.add(new T3.CylinderGeometry(0.13, 0.1, 0.32, 6), 'glowV', '#ffd890', M(x, y + h + 0.2, z)); b.add(new T3.ConeGeometry(0.2, 0.16, 6), 'def', '#1c1e22', M(x, y + h + 0.44, z)); glowSprite(x, y + h + 0.2, z, '#ffc070', 2.2, 0.7); }
  function pole(b, x, z, h) { const y = HF(x, z); b.add(new T3.CylinderGeometry(0.06, 0.09, h, 7), 'wood', '#5a4a3a', M(x, y + h / 2, z)); b.add(boxG(1.1, 0.08, 0.08), 'wood', '#4a3a2a', M(x, y + h - 0.3, z)); return [x, y + h - 0.3, z]; }
  function stdMats(extra) {
    return Object.assign({
      def: lam(), wood: lam({ map: T.wood() }), plaster: lam({ map: T.plaster() }), tile: lam({ map: T.tile() }), thatch: lam({ map: T.thatch() }), brick: lam({ map: T.brick() }), stone: lam({ map: T.stone() }), bark: lam({ map: T.bark() }),
      shojiLit: basic({ map: T.shoji(), color: 0xffe0a8 }), lampLit: basic({ color: 0xffd090 }), glowV: basic(), winLit: basic({ map: T.windows(), color: 0xffe2b0 }), winDark: lam({ color: 0x20242c }), lattice: basic({ map: T.lattice() }),
    }, extra || {});
  }

  // ---------------- environment setup ----------------
  function setup(o) {
    E.scene.background = C(o.fog);
    E.scene.fog = new T3.Fog(o.fog, o.fogNear || 18, o.fogFar || 140);
    E.hemi.color.set(o.hemi[0]); E.hemi.groundColor.set(o.hemi[1]); E.hemi.intensity = o.hemi[2];
    E.sun.color.set(o.key[0]); E.sun.intensity = o.key[1]; E.sun.position.set(...(o.keyPos || [-6, 12, 9])); E.sun.userData.base = (o.keyPos || [-6, 12, 9]).slice();
    if (o.sky !== false) makeSky(o);
  }

  // ============================================================
  //  STAGES
  // ============================================================
  const STAGES = {
    // ---- Mt. Fujikasane: wisteria in full bloom under the moon ----
    wisteria() {
      setup({ zen: '#07061c', hor: '#33264e', fog: '#221a36', moon: '#e4dcff', moonDir: [0.42, 0.2, -1], moonSize: 1.1, stars: 1, cloud: 0.45, cloudCol: '#2a2244', hemi: ['#8c80d0', '#1a1222', 0.95], key: ['#cfc8ff', 0.85], fogNear: 14, fogFar: 150 });
      terrain({ amp: 1, c1: '#2a3424', c2: '#46523a', rock: '#3c3a44', path: { z: 0.3, w: 1.3, c: '#6a6050' } });
      forest(pineGeo('#0e1a14', '#2a3c2c', 1), 260, { z0: -60, z1: -16, s0: 4, s1: 8, w: 90 });
      forest(pineGeo('#0e1a14', '#2a3c2c'), 14, { z0: -24, z1: -14, s0: 5, s1: 8, w: 30, cast: 1 });
      // wisteria trees: gnarled trunks, leafy canopies, hundreds of hanging racemes
      const b = Batch(), racemes = [];
      for (let i = 0; i < 13; i++) {
        const x = -27 + i * 4.5 + rnd(-1, 1), z = rnd(-13, -5.5), y = HF(x, z), th = rnd(2.6, 3.6);
        const pts = [new T3.Vector3(x, y, z), new T3.Vector3(x + rnd(-0.4, 0.4), y + th * 0.4, z + rnd(-0.3, 0.3)), new T3.Vector3(x + rnd(-0.6, 0.6), y + th * 0.8, z), new T3.Vector3(x + rnd(-0.3, 0.3), y + th, z)];
        b.add(new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 10, 0.16, 7), 'bark', '#8a7a6a');
        for (let k = 0; k < 3; k++) { const a = rnd(0, TAU), bp = [pts[2].clone(), pts[2].clone().add(new T3.Vector3(Math.cos(a) * 1.3, 0.5, Math.sin(a) * 0.8))]; b.add(new T3.TubeGeometry(new T3.CatmullRomCurve3(bp), 4, 0.07, 5), 'bark', '#8a7a6a'); }
        const cw = rnd(2.4, 3.2);
        for (let k = 0; k < 5; k++) { const c = jitter(new T3.IcosahedronGeometry(1, 1), 0.35, i * 7 + k); b.add(colorize(c, '#1a2418', '#3c4a34', 'Y', -1, 1), 'def', undefined, M(x + rnd(-cw / 2, cw / 2), y + th + rnd(0, 0.4), z + rnd(-0.7, 0.7), rnd(0, 3), rnd(0.7, 1.0), 0.4, rnd(0.6, 0.9))); }
        for (let k = 0; k < 64; k++) racemes.push({ x: x + rnd(-cw * 0.7, cw * 0.7), y: y + th - rnd(-0.1, 0.25), z: z + rnd(-0.9, 0.9), s: rnd(0.6, 1.25) });
      }
      for (let i = 0; i < 7; i++) stoneLantern(b, -24 + i * 8 + rnd(-1, 1), -4.4 + rnd(-0.4, 0.2), 1.1);
      b.build(stdMats(), { cast: { bark: 1, def: 1, stone: 1 } });
      const rm = windify(lam({ emissive: 0x3a1c6a, emissiveIntensity: 0.55 }), 'hang', 0.12);
      instanced(racemeGeo('#9a72e0', '#f0e6ff'), rm, racemes, (o, t) => { o.position.set(t.x, t.y, t.z); o.rotation.set(0, rnd(0, 6), 0); o.scale.set(t.s * 1.1, t.s, t.s * 1.1); });
      rocks(26, { z0: -14, z1: -2.5, s0: 0.2, s1: 0.7, avoid: bandFree });
      grass(E.q >= 2 ? 6000 : 2500, { tint: '#d8d0ff' });
      particles({ kind: 'fall', n: 220, col: '#d8b8ff', col2: '#b890f0', size: 3.2, box: [36, 9, 12], origin: [0, 0, -5], speed: 0.5, shape: 1, a: 0.85 });
      mistLayers('#5a4a80', 0.35, [-9, -18, -30], 0.8, 4);
      pointLight(-8, 1.6, -3.2, 0xffb070, 1.2, 6, 1); pointLight(8, 1.6, -3.4, 0xffb070, 1.2, 6, 1);
    },
    // ---- Asakusa, Taisho Tokyo at night ----
    town() {
      setup({ zen: '#040a1c', hor: '#1c2a48', fog: '#182238', moon: '#d0d8ff', moonDir: [-0.5, 0.21, -1], stars: 0.7, cloud: 0.55, cloudCol: '#1a2238', hemi: ['#8090c8', '#2a2018', 0.85], key: ['#c0ccff', 0.7], fogNear: 16, fogFar: 120 });
      terrain({ amp: 0.15, mount: 0.35, c1: '#3a3634', c2: '#4a4440', map: T.cobble(), tile: 1.6 });
      const b = Batch(), mats = stdMats();
      // front row: alternating machiya and western shops
      for (let i = 0; i < 9; i++) { const x = -24 + i * 6 + rnd(-0.3, 0.3); if (i % 3 === 1) houseWest(b, x, -9.6, { w: 5.2, d: 3.5, floors: 3, lit: 0.6 }); else houseJP(b, x, -9.2, { w: 5, d: 3.4, floors: 2, balcony: i % 2 === 0, rail: '#2a1a12' }); }
      for (let i = 0; i < 12; i++) { const x = -33 + i * 6 + rnd(-1, 1); if (i % 2) houseWest(b, x, -16 - rnd(0, 4), { w: 5, d: 4, floors: 4 + (i % 3), lit: 0.4 }); else houseJP(b, x, -15 - rnd(0, 3), { w: 5.5, d: 4, floors: 2 }); }
      // Ryounkaku (12-storey tower) on the skyline
      { const x = 14, z = -60, y = HF(x, z); for (let f = 0; f < 12; f++) { const r = 2.4 - f * 0.08; b.add(new T3.CylinderGeometry(r, r, 1.5, 8), f < 10 ? 'brick' : 'plaster', '#ffffff', M(x, y + f * 1.55 + 0.75, z)); b.add(new T3.CylinderGeometry(r + 0.15, r + 0.15, 0.1, 8), 'stone', '#d8d0c0', M(x, y + f * 1.55 + 1.5, z)); for (let k = 0; k < 8; k++) if (h2(f, k) < 0.5) b.add(new T3.PlaneGeometry(0.5, 0.8), 'winLit', '#ffffff', M(x + Math.sin(k / 8 * TAU) * (r + 0.02), y + f * 1.55 + 0.8, z + Math.cos(k / 8 * TAU) * (r + 0.02), k / 8 * TAU)); }
        b.add(new T3.ConeGeometry(1.4, 3, 8), 'def', '#3a3a44', M(x, y + 12 * 1.55 + 1.5, z)); glowSprite(x, y + 21, z, '#ff3030', 1.5, 0.8); }
      // gas lamps + telegraph poles with wires
      for (let i = 0; i < 9; i++) streetLamp(b, -24 + i * 6, -4.3);
      let prev = null; for (let i = 0; i < 8; i++) { const p = pole(b, -24 + i * 7, -5.6, 5); if (prev) { wire(b, [prev[0] - 0.5, prev[1], prev[2]], [p[0] - 0.5, p[1], p[2]], 0.4); wire(b, [prev[0] + 0.5, prev[1], prev[2]], [p[0] + 0.5, p[1], p[2]], 0.45); } prev = p; }
      for (let i = 0; i < 10; i++) paperLantern(b, -22 + i * 4.8, 2.3, -6.1, '#ff6030', 0.9);
      b.build(mats, { cast: { def: 1, wood: 1 } });
      pointLight(-6, 3.3, -4.3, 0xffc070, 1.6, 7, 1); pointLight(6, 3.3, -4.3, 0xffc070, 1.6, 7, 1); pointLight(0, 2.4, -6, 0xff6030, 0.8, 6, 1);
      mistLayers('#2a3450', 0.25, [-12, -24], 1, 4);
    },
    // ---- Tsuzumi mansion interior ----
    mansion() {
      setup({ sky: false, fog: '#2a1a0e', fogNear: 10, fogFar: 40, hemi: ['#d8b080', '#2a1a0a', 0.7], key: ['#ffd8a0', 0.55], keyPos: [-4, 10, 8] });
      HF = () => 0;
      floor({ map: T.tatami(), w: 60, d: 22, tile: 1.8, color: 0xd8d0a0 });
      const b = Batch(), mats = stdMats();
      // back wall of shoji + timber posts, a second room behind open panels
      for (let i = -9; i <= 9; i++) { const x = i * 2.2, open = i % 4 === 0; if (!open) b.add(new T3.PlaneGeometry(2.0, 3.6), 'shojiLit', '#ffffff', M(x, 1.9, -6)); b.add(boxG(0.22, 4.6, 0.22), 'wood', '#4a2a16', M(x - 1.1, 2.3, -6)); }
      b.add(boxG(44, 0.3, 0.3), 'wood', '#3a2010', M(0, 3.75, -6)); b.add(boxG(44, 0.8, 0.2), 'plaster', '#d8ccb0', M(0, 4.2, -6.05)); b.add(boxG(44, 0.12, 0.3), 'wood', '#3a2010', M(0, 0.06, -6));
      for (let i = -9; i <= 9; i += 4) { const x = i * 2.2; b.add(new T3.PlaneGeometry(2.0, 3.6), 'shojiLit', '#ffe0b0', M(x + rnd(-0.3, 0.3), 1.9, -12)); b.add(new T3.PlaneGeometry(2.2, 6), 'def', '#2a1a0e', M(x, 2.5, -12.2)); }
      b.add(new T3.PlaneGeometry(60, 8).rotateX(-Math.PI / 2), 'def', '#6a6030', M(0, 0.005, -10));
      // ceiling: planks + beams
      const ceil = new T3.PlaneGeometry(60, 26).rotateX(Math.PI / 2); scaleUV(ceil, 20, 9); b.add(ceil, 'wood', '#6a4a30', M(0, 5, -4));
      for (let i = -10; i <= 10; i++) b.add(boxG(0.25, 0.3, 26), 'wood', '#3a2010', M(i * 3, 4.85, -4));
      // scattered tsuzumi drums + andon lamps
      for (let i = 0; i < 9; i++) { const x = -14 + i * 3.5 + rnd(-0.6, 0.6), z = rnd(-5.6, -4.3), ry = rnd(0, 3); b.add(new T3.CylinderGeometry(0.13, 0.2, 0.25, 12).translate(0, 0.125, 0), 'wood', '#a06a3a', M(x, 0.36, z, ry, 1, 1, 1, Math.PI / 2)); b.add(new T3.CylinderGeometry(0.2, 0.13, 0.25, 12).translate(0, -0.125, 0), 'wood', '#a06a3a', M(x, 0.36, z, ry, 1, 1, 1, Math.PI / 2)); for (const e of [-0.25, 0.25]) b.add(new T3.CylinderGeometry(0.34, 0.34, 0.05, 18).translate(0, e, 0), 'def', '#efe4c8', M(x, 0.36, z, ry, 1, 1, 1, Math.PI / 2)); }
      for (const x of [-11, 0, 11]) { b.add(boxG(0.4, 0.7, 0.4), 'shojiLit', '#ffffff', M(x, 0.45, -5.2)); b.add(boxG(0.5, 0.08, 0.5), 'wood', '#3a2010', M(x, 0.84, -5.2)); glowSprite(x, 0.5, -5.1, '#ffb060', 2.4, 0.6); }
      b.build(mats, { cast: { def: 1, wood: 1 } });
      pointLight(-11, 1, -4.8, 0xffb060, 1.5, 7, 1); pointLight(0, 1, -4.8, 0xffb060, 1.5, 7, 1); pointLight(11, 1, -4.8, 0xffb060, 1.5, 7, 1);
      particles({ kind: 'fly', n: 140, col: '#ffe0b0', size: 2, box: [30, 4, 8], origin: [0, 0.5, -3], speed: 0.15, a: 0.5 });
    },
    // ---- Natagumo mountain: blood moon, cedar forest, giant webs ----
    spider() {
      setup({ zen: '#040206', hor: '#2c0a12', fog: '#1a070c', moon: '#ff4a4a', moonDir: [-0.3, 0.2, -1], moonSize: 1.7, stars: 0.35, cloud: 0.7, cloudCol: '#2a0c14', hemi: ['#7a3040', '#0c0406', 0.75], key: ['#ff8a8a', 0.6], fogNear: 8, fogFar: 70 });
      terrain({ amp: 1.6, mount: 1.2, c1: '#1a1c14', c2: '#2a2a1c', rock: '#2a2424' });
      const cg = cedarGeo();
      forest(cg, 320, { z0: -55, z1: -9, s0: 9, s1: 15, w: 70 });
      forest(cg, 18, { z0: -9, z1: -4.5, s0: 15, s1: 19, w: 22, cast: 1, wide: 0.8 });
      // giant webs strung between trunks + hanging cocoons
      const b = Batch(), webSeg = [];
      for (let w = 0; w < 6; w++) {
        const cx = rnd(-15, 15), cy = rnd(2.5, 5.5), cz = rnd(-10, -5), R = rnd(1, 2), K = 12;
        for (let k = 0; k < K; k++) { const a = k / K * TAU; webSeg.push([cx, cy, cz, cx + Math.cos(a) * R * 1.3, cy + Math.sin(a) * R, cz]); }
        for (let r = 0.3; r < R; r += 0.26 + r * 0.05) for (let k = 0; k < K; k++) { const a = k / K * TAU, a2 = (k + 1) / K * TAU, s = 1 - Math.sin(k * 1.3 + r * 4) * 0.08; webSeg.push([cx + Math.cos(a) * r * 1.3 * s, cy + Math.sin(a) * r * s, cz, cx + Math.cos(a2) * r * 1.3, cy + Math.sin(a2) * r, cz]); }
      }
      const wpos = []; for (const [x1, y1, z1, x2, y2, z2] of webSeg) { const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * 0.012, ny = Math.cos(a) * 0.012; wpos.push(x1 + nx, y1 + ny, z1, x1 - nx, y1 - ny, z1, x2 + nx, y2 + ny, z2, x1 - nx, y1 - ny, z1, x2 - nx, y2 - ny, z2, x2 + nx, y2 + ny, z2); }
      const wg = new T3.BufferGeometry(); wg.setAttribute('position', new T3.Float32BufferAttribute(wpos, 3));
      add(new T3.Mesh(wg, new T3.MeshBasicMaterial({ color: 0xd8d0e8, transparent: true, opacity: 0.3, side: T3.DoubleSide, depthWrite: false })));
      for (let i = 0; i < 12; i++) { const x = rnd(-16, 16), z = rnd(-10, -4), y = rnd(3, 6); b.add(new T3.CylinderGeometry(0.008, 0.008, 9 - y, 3), 'def', '#d8d0e0', M(x, y + (9 - y) / 2, z)); b.add(jitter(new T3.SphereGeometry(0.3, 10, 8), 0.2, i), 'def', '#d8d0d0', M(x, y - 0.3, z, 0, 1, 1.8, 1)); }
      for (let i = 0; i < 40; i++) b.add(new T3.TubeGeometry(new T3.CatmullRomCurve3([new T3.Vector3(rnd(-18, 18), 0, rnd(-12, -3)), new T3.Vector3(rnd(-18, 18), 0.3, rnd(-12, -3))]), 3, 0.05, 4), 'bark', '#4a3a2a', M(0, HF(0, -5) + 0.02, 0)); // roots
      b.build(stdMats(), { cast: { def: 1 } });
      forest(fernGeo(), 160, { z0: -12, z1: -2.4, s0: 0.5, s1: 1.1, w: 20, sway: 0.08 });
      rocks(30, { z0: -14, z1: -2.5, s0: 0.3, s1: 1, avoid: bandFree, tint: '#c8b0b0' });
      grass(E.q >= 2 ? 4000 : 1600, { tint: '#a0a080', h: 1.2 });
      particles({ kind: 'fly', n: 160, col: '#c8ff9a', size: 4, box: [36, 5, 14], origin: [0, 0.3, -5], speed: 0.25, add: 1 });
      mistLayers('#4a1018', 0.45, [-6, -12, -22, -34], 1.2, 5);
      shafts(7, { col: '#ff5a5a', a: 0.1, z0: -14, z1: -6, tilt: 0.35 });
    },
    // ---- On the roof of the Mugen Train, rushing through the night ----
    train() {
      setup({ zen: '#030a1c', hor: '#22304e', fog: '#192440', moon: '#d8e4ff', moonDir: [0.4, 0.22, -1], stars: 1, cloud: 0.6, cloudCol: '#1c2640', hemi: ['#7890c8', '#141018', 0.9], key: ['#c8d4ff', 0.8], fogNear: 14, fogFar: 150 });
      // the countryside sits below the train and scrolls past
      const land = terrain({ y: -3.2, amp: 1.2, flatZ: -4, c1: '#1e2a1c', c2: '#2c3a26', rock: '#2a2c30' });
      const gt = land.material.map; anim.push((t) => { gt.offset.x = t * 2.6 / 3; });
      // the train: three cars with curved roofs, lit windows, couplings; locomotive smoke streaming back
      const b = Batch(), mats = stdMats({ car: lam({ color: 0xffffff }), roof: lam({ map: T.wood(), color: 0x2e2422 }) });
      for (let c = -1; c <= 1; c++) {
        const x = c * 15;
        b.add(boxG(14, 2.6, 2.34), 'car', '#3a1c18', M(x, -1.83, 0));
        const rg = new T3.CylinderGeometry(1.55, 1.55, 14, 24, 1, true, Math.PI / 2 - 0.85, 1.7); rg.rotateZ(Math.PI / 2); scaleUV(rg, 1, 6); b.add(rg, 'roof', '#ffffff', M(x, -1.55, 0));
        for (const sz of [-1, 1]) b.add(boxG(14.2, 0.1, 0.14), 'def', '#1a1010', M(x, -0.55, sz * 1.2));
        for (let i = 0; i < 9; i++) b.add(new T3.PlaneGeometry(0.9, 0.7), 'winLit', '#ffffff', M(x - 6 + i * 1.5, -1.25, 1.18));
        b.add(boxG(14.05, 0.08, 2.38), 'def', '#a8862a', M(x, -0.75, 0)); // gold stripe
        for (let k = -1; k <= 1; k += 2) b.add(new T3.CylinderGeometry(0.42, 0.42, 0.18, 14), 'def', '#111', M(x + k * 5, -3.2, 1.1, 0, 1, 1, 1, Math.PI / 2));
        b.add(boxG(0.8, 1.8, 1.6), 'def', '#1a1010', M(x + 7.4, -1.5, 0));
        for (let v = 0; v < 3; v++) b.add(new T3.CylinderGeometry(0.08, 0.08, 0.2, 8), 'def', '#2a2a2a', M(x - 4 + v * 4, 0.02, 0.2)); // roof vents
      }
      b.build(mats, { cast: { car: 1, def: 1 }, receive: true });
      // scenery rushing by: trees, telegraph poles, hills
      const pg = pineGeo('#0e1a14', '#26382a', 1), list = [];
      for (let i = 0; i < 160; i++) list.push({ x: rnd(-60, 60), z: rnd(-50, -5), s: rnd(3, 7) });
      const tm = windify(lam(), 'tree'), im = new T3.InstancedMesh(pg, tm, list.length); im.frustumCulled = false; add(im); const o = new T3.Object3D();
      const poleG = new T3.CylinderGeometry(0.07, 0.09, 5, 6), pm = new T3.InstancedMesh(poleG, lam({ color: 0x3a2e24 }), 14); pm.frustumCulled = false; add(pm);
      anim.push((t) => {
        list.forEach((it, i) => { const sp = 26 * (8 / Math.max(6, -it.z)); const x = ((it.x - t * sp) % 120 + 180) % 120 - 60; o.position.set(x, HF(x, it.z) - 0.2, it.z); o.rotation.set(0, i, 0); o.scale.set(it.s, it.s, it.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
        im.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 14; i++) { const x = ((i * 9 - t * 26 * 1.6) % 126 + 189) % 126 - 63; o.position.set(x, -3.2 + 2.5, -4.5); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }
        pm.instanceMatrix.needsUpdate = true;
      });
      particles({ kind: 'rise', n: 240, col: '#9a9ea8', col2: '#3a3c44', size: 90, box: [80, 5, 4], origin: [0, 0.6, -1.2], speed: 0.5, drift: -9, shape: 2, a: 0.28 }); // locomotive smoke streaming back
      particles({ kind: 'fall', n: 120, col: '#ffffff', size: 3, box: [60, 6, 10], origin: [0, 0, -2], speed: 1, drift: -30, a: 0.3 }); // wind-blown motes
      mistLayers('#2a3a5a', 0.3, [-14, -30], -2, 5);
    },
    // ---- Field beside the wrecked train, waiting for the dawn ----
    dawnfield() {
      setup({ zen: '#060c22', hor: '#1c2440', fog: '#1c2440', moon: '#d0d8ff', moonDir: [-0.55, 0.22, -1], stars: 1, cloud: 0.55, cloudCol: '#1e2440', hemi: ['#8090c0', '#201a14', 0.9], key: ['#c8d0ff', 0.75], fogNear: 18, fogFar: 160 });
      terrain({ amp: 0.8, c1: '#28321e', c2: '#3e4a2a', rock: '#3a3a40', path: { z: -6.2, w: 0.9, c: '#4a4238' } });
      forest(pineGeo('#0e1a14', '#283a2a', 1), 200, { z0: -70, z1: -18, s0: 4, s1: 8, w: 90 });
      const b = Batch(), mats = stdMats({ iron: lam({ color: 0xffffff }) });
      // rails (twisted near the wreck)
      for (const dz of [-0.5, 0.5]) for (let i = -30; i < 30; i++) { const x = i, bend = Math.abs(x + 3) < 4 ? Math.sin((x + 3) * 0.8) * 0.6 : 0; b.add(boxG(1.02, 0.08, 0.08), 'iron', '#6a6a70', M(x + 0.5, HF(x, -6.2) + 0.12, -6.2 + dz + bend, bend * 0.3)); if (dz > 0) b.add(boxG(0.22, 0.08, 1.5, 1), 'wood', '#3a2a1e', M(x + 0.5, HF(x, -6.2) + 0.05, -6.2 + bend)); }
      // derailed locomotive on its side
      { const x = -8, z = -10, y = HF(x, z), R = M(x, y + 1.1, z, 0.35, 1, 1, 1, 0, 1.25);
        const parts = [[new T3.CylinderGeometry(1.0, 1.0, 6, 18).rotateZ(Math.PI / 2), '#1a1a1e', 0, 0, 0], [boxG(2.4, 2.6, 2.4), '#1c1a1e', -3.6, 0.3, 0], [new T3.CylinderGeometry(0.35, 0.45, 1.2, 12), '#141418', 2, 1.4, 0], [new T3.CylinderGeometry(1.05, 1.05, 0.2, 18).rotateZ(Math.PI / 2), '#8a1a14', 3, 0, 0]];
        for (const [g, c, px, py, pz] of parts) b.add(g, 'iron', c, R.clone().multiply(new T3.Matrix4().makeTranslation(px, py, pz)));
        for (let k = 0; k < 4; k++) b.add(new T3.CylinderGeometry(0.6, 0.6, 0.15, 16).rotateX(Math.PI / 2), 'iron', '#2a2a2e', R.clone().multiply(new T3.Matrix4().makeTranslation(-2 + k * 1.5, -1.1, 1.1))); }
      for (const [x, z, r] of [[6, -9, -0.6], [12, -12, 0.4], [18, -10, 1.3]]) { const y = HF(x, z); b.add(boxG(9, 2.6, 2.8), 'iron', '#3a1c18', M(x, y + 1.0, z, r, 1, 1, 1, 0, rnd(-0.3, 0.3))); for (let i = 0; i < 6; i++) b.add(new T3.PlaneGeometry(0.9, 0.7), 'winDark', '#ffffff', M(x, y + 1.2, z, r).multiply(new T3.Matrix4().makeTranslation(-3.6 + i * 1.4, 0, 1.42))); }
      for (let i = 0; i < 14; i++) b.add(jitter(boxG(rnd(0.3, 0.9), rnd(0.1, 0.3), rnd(0.3, 0.8)), 0.3, i), 'iron', '#2a2420', M(rnd(-18, 18), HF(0, -5) + 0.1, rnd(-8, -4.2), rnd(0, 6)));
      b.build(mats, { cast: { iron: 1 } });
      rocks(20, { z0: -14, z1: -3, avoid: bandFree });
      grass(E.q >= 2 ? 6500 : 2600, { h: 1.0 });
      particles({ kind: 'rise', n: 160, col: '#4a4a50', col2: '#1a1a1e', size: 80, box: [6, 9, 3], origin: [-8, 1, -10], speed: 0.5, shape: 2, a: 0.3 });
      particles({ kind: 'rise', n: 80, col: '#ffb060', col2: '#ff4010', size: 4, box: [8, 4, 3], origin: [-8, 0.5, -9], speed: 0.8, add: 1 });
      mistLayers('#3a4466', 0.3, [-12, -26], 0.8, 4);
      STAGE_DAWN = dawnfieldDawn;
    },
    // ---- Yoshiwara entertainment district ----
    yukaku() {
      setup({ zen: '#0c0308', hor: '#3a1018', fog: '#2a0c14', moon: '#ffc0b0', moonDir: [0.45, 0.24, -1], moonSize: 0.9, stars: 0.3, cloud: 0.5, cloudCol: '#3a1420', hemi: ['#ff9080', '#200810', 0.85], key: ['#ffb0a0', 0.6], fogNear: 14, fogFar: 110 });
      terrain({ amp: 0.1, mount: 0.4, c1: '#4a3a30', c2: '#5a4838', map: T.dirt(), tile: 2 });
      const b = Batch(), mats = stdMats();
      for (let i = 0; i < 9; i++) { const x = -24 + i * 6; houseJP(b, x, -7.8, { w: 5.6, d: 3.4, floors: 2, balcony: true, litKey: 'lattice', wall: '#d8c8b0', rail: '#8a1a14', roofH: 0.9 }); b.add(new T3.PlaneGeometry(0.7, 2.6), 'banner' + (i % 3), '#ffffff', M(x - 2.2, 2.1, -6.05)); }
      for (let i = 0; i < 12; i++) houseJP(b, -33 + i * 6 + rnd(-1, 1), -15 - rnd(0, 4), { w: 5.5, d: 4, floors: 2, litKey: 'lattice', balcony: true, wall: '#c8b8a0', rail: '#6a1410' });
      for (let i = 0; i < 26; i++) paperLantern(b, -25 + i * 2, 2.5 + Math.sin(i * 0.5) * 0.15, -5.9, '#ff3a20', 0.8);
      for (let i = 0; i < 18; i++) paperLantern(b, -25 + i * 3, 4.4, -6.3, '#ff6030', 0.7);
      for (let s = 0; s < 3; s++) { const z = -2 - s * 4, pts = []; for (let i = 0; i < 9; i++) pts.push([-20 + i * 5, 4.6 - Math.sin(i / 8 * Math.PI) * 0.6, z]); wire(b, [-22, 4.8, z], [22, 4.8, z], 0.8, '#2a1a10', 0.012); for (let i = 1; i < 11; i++) paperLantern(b, -22 + i * 4, 4.8 - Math.sin(i / 11 * Math.PI) * 0.8 - 0.3, z, i % 2 ? '#ff4020' : '#ffb040', 0.55); }
      b.build(Object.assign(mats, { banner0: basic({ map: T.banner('京極屋', '#2a1a14', '#f0d8a0') }), banner1: basic({ map: T.banner('ときと屋', '#5a1010', '#ffe0b0') }), banner2: basic({ map: T.banner('荻本屋', '#1a2030', '#f0e0c0') }) }), { cast: { def: 1, wood: 1 } });
      pointLight(-7, 2.6, -5, 0xff5030, 1.6, 8, 1); pointLight(7, 2.6, -5, 0xff5030, 1.6, 8, 1); pointLight(0, 4, -2, 0xffa050, 0.9, 8, 1);
      particles({ kind: 'fly', n: 120, col: '#ffb070', size: 2.5, box: [30, 5, 8], origin: [0, 1, -4], speed: 0.2, add: 1 });
      mistLayers('#5a1a24', 0.25, [-11, -22], 1, 4);
    },
    // ---- Swordsmith village: hot springs in the mountains ----
    village() {
      setup({ zen: '#05101a', hor: '#1e3a44', fog: '#18303a', moon: '#e0f4ff', moonDir: [-0.4, 0.22, -1], stars: 1, cloud: 0.4, cloudCol: '#1c3440', hemi: ['#80b0c8', '#10180e', 0.9], key: ['#d0ecff', 0.8], fogNear: 14, fogFar: 140 });
      terrain({ amp: 1.4, mount: 1.2, c1: '#22301e', c2: '#3a4a2c', rock: '#3a4040', path: { z: 0.2, w: 1.2, c: '#5a5040' } });
      forest(pineGeo('#0c1a16', '#24382e', 1), 200, { z0: -70, z1: -20, s0: 4, s1: 8, w: 90 });
      forest(broadleafGeo('#1a2a18', '#3a5228'), 60, { z0: -20, z1: -8, s0: 3, s1: 5, w: 40, cast: 1 });
      const b = Batch(), mats = stdMats();
      for (const [x, z, f] of [[-15, -9, 1], [-7, -12, 2], [4, -14, 1], [13, -10, 2], [21, -13, 1], [-23, -14, 2]]) houseJP(b, x, z, { w: 4.4, d: 3.4, floors: f, thatch: f === 1, roofH: 1.4 });
      for (let i = 0; i < 6; i++) stoneLantern(b, -23 + i * 9, -4.8 + rnd(-0.3, 0.3), 1);
      // hot spring pool with rock rim
      const px = 7, pz = -5.5;
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; b.add(jitter(new T3.IcosahedronGeometry(0.4, 1), 0.4, i), 'stone', '#9a9690', M(px + Math.cos(a) * 3.2, -0.05, pz + Math.sin(a) * 1.4, rnd(0, 6), rnd(0.8, 1.3), 0.6, 1)); }
      for (let i = 0; i < 30; i++) b.add(boxG(0.06, rnd(1, 1.6), 0.06), 'def', '#6a7a3a', M(-20 + i * 0.25, 0.6, -4.2, 0, 1, 1, 1, rnd(-0.05, 0.05))); // bamboo fence
      b.build(mats, { cast: { def: 1, stone: 1 } });
      water({ x: px, z: pz, w: 6, d: 2.6, deep: '#0c2a30', sky: '#4a7a88', glint: '#e0f4ff', geo: new T3.CircleGeometry(1, 32).scale(3.1, 1.3, 1) });
      particles({ kind: 'rise', n: 90, col: '#e8f0f0', col2: '#a0b0b0', size: 45, box: [5, 3.5, 2], origin: [px, 0, pz], speed: 0.3, shape: 2, a: 0.13 });
      rocks(30, { z0: -16, z1: -2.5, avoid: (x, z) => bandFree(x, z) || Math.hypot(x - px, (z - pz) * 2) < 4 });
      grass(E.q >= 2 ? 5000 : 2000, { avoid: (x, z) => Math.hypot(x - px, (z - pz) * 2) < 3.4 });
      particles({ kind: 'fly', n: 90, col: '#d8ffb0', size: 3.5, box: [34, 4, 12], origin: [0, 0.4, -6], speed: 0.2, add: 1 });
      mistLayers('#406a74', 0.3, [-10, -20, -34], 1, 5);
      pointLight(px, 1.5, pz, 0x9ad0ff, 0.8, 7); pointLight(-14, 1.4, -4, 0xffb060, 1, 6, 1);
    },
    // ---- Infinity Castle ----
    castle() { infinityCastle({ fog: '#2a1408', hemi: ['#ffb070', '#1a0a04', 0.85], key: ['#ffd0a0', 0.55], warm: 1, lantern: '#ffa040', floorCol: 0x7a5636 }); },
    castle_moon() { infinityCastle({ fog: '#1e0c22', hemi: ['#c0a0ff', '#140818', 0.85], key: ['#e8d8ff', 0.75], warm: 0, lantern: '#c8a8ff', floorCol: 0x5a4a66, moonBeams: 1 }); },
    // ---- Doma's frozen lotus chamber ----
    castle_ice() {
      setup({ sky: false, fog: '#10283c', fogNear: 10, fogFar: 70, hemi: ['#a8d8ff', '#0a1424', 0.7], key: ['#e0f4ff', 0.65] });
      HF = () => 0;
      const ice = floor({ map: T.ice(), w: 80, d: 40, tile: 6, color: 0xc8e8ff });
      ice.material = new T3.MeshPhongMaterial({ map: T.ice(), color: 0x34536e, specular: 0x6aa8d8, shininess: 110 });
      const b = Batch(), mats = stdMats({ shojiIce: basic({ map: T.shoji(), color: 0x6a8cb0 }), crystal: new T3.MeshPhongMaterial({ vertexColors: true, color: 0xffffff, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.82, emissive: 0x1a4060 }) });
      for (let i = 0; i < 26; i++) { const x = rnd(-22, 22), z = rnd(-14, -4.3), s = rnd(0.6, 1.4); b.add(new T3.CylinderGeometry(0.9 * s, 0.9 * s, 0.05, 20), 'crystal', '#4a7a9a', M(x, 0.03, z, 0, 1, 1, 1, 0, rnd(-0.1, 0.1))); if (i % 2) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.add(new T3.ConeGeometry(0.12 * s, 0.6 * s, 4).translate(0, 0.3 * s, 0).rotateX(0.55), 'crystal', '#e8f6ff', M(x, 0.05, z, a)); } }
      for (let i = 0; i < 40; i++) { const x = rnd(-24, 24), z = rnd(-18, -6), s = rnd(0.5, 2.2); b.add(new T3.ConeGeometry(0.25 * s, 2.2 * s, 5).translate(0, 1.1 * s, 0), 'crystal', '#c8ecff', M(x, 0, z, rnd(0, 6), 1, 1, 1, rnd(-0.25, 0.25), rnd(-0.25, 0.25))); }
      for (let i = -8; i <= 8; i++) { b.add(new T3.PlaneGeometry(2.6, 5), 'shojiIce', '#ffffff', M(i * 2.8, 2.5, -18)); b.add(boxG(0.25, 6, 0.25), 'wood', '#1a2a3a', M(i * 2.8 - 1.4, 3, -17.9)); }
      b.add(boxG(50, 0.4, 0.4), 'wood', '#1a2a3a', M(0, 5.2, -17.8));
      b.build(mats, { cast: { crystal: 1 } });
      particles({ kind: 'fall', n: 600, col: '#ffffff', col2: '#cfeaff', size: 3.5, box: [36, 10, 16], origin: [0, 0, -4], speed: 0.5, add: 1, a: 0.8 });
      mistLayers('#5a90b8', 0.3, [-6, -12], 0.4, 2.5);
      mist({ col: '#8ac0e0', a: 0.25, flat: 1, y: 0.15, z: -6, w: 60, h: 18 });
      shafts(6, { col: '#9ad8ff', a: 0.08, z0: -16, z1: -6, tilt: -0.2 });
      pointLight(-8, 3, -3, 0x9ad8ff, 1.2, 10); pointLight(8, 3, -3, 0x9ad8ff, 1.2, 10);
    },
    // ---- Final battle in the streets of Tokyo ----
    city() {
      setup({ zen: '#04040a', hor: '#20182a', fog: '#18121e', moon: '#d8d0ff', moonDir: [-0.45, 0.23, -1], stars: 0.5, cloud: 0.6, cloudCol: '#1e1828', hemi: ['#7070a8', '#180808', 0.85], key: ['#d0c8ff', 0.7], fogNear: 14, fogFar: 130 });
      terrain({ amp: 0.1, mount: 0.3, c1: '#3a3634', c2: '#4a4440', map: T.cobble(), tile: 1.6 });
      const b = Batch(), mats = stdMats({ iron: lam({ color: 0xffffff }) });
      for (let i = 0; i < 8; i++) houseWest(b, -24 + i * 6.6, -11 - rnd(0, 1.5), { w: 6, d: 4, floors: 3 + (i % 3), dome: i === 3, broken: i % 3 === 2, lit: 0.35, mat: i % 2 ? 'brick' : 'plaster', col: i % 2 ? '#ffffff' : '#d8d0c0' });
      for (let i = 0; i < 12; i++) houseWest(b, -36 + i * 6.5, -21 - rnd(0, 8), { w: 6, d: 5, floors: 4 + (i % 4), lit: 0.3, dome: i === 7 });
      for (const dz of [-2.9, -2.1]) b.add(boxG(80, 0.03, 0.06), 'iron', '#8a8a90', M(0, 0.015, dz)); // streetcar rails
      for (let i = 0; i < 8; i++) streetLamp(b, -23 + i * 6.5, -4.4);
      let prev = null; for (let i = 0; i < 8; i++) { const p = pole(b, -24 + i * 7, -6.5, 5.5); if (prev) wire(b, prev, p, 0.5); prev = p; }
      for (let i = 0; i < 18; i++) b.add(jitter(boxG(rnd(0.3, 0.9), rnd(0.2, 0.5), rnd(0.3, 0.8)), 0.3, i), 'brick', '#a89080', M(rnd(-20, 20), 0.12, rnd(-7, -4.3), rnd(0, 6)));
      b.build(mats, { cast: { def: 1, iron: 1 } });
      pointLight(-3, 3.4, -4.4, 0xffc070, 1.4, 8, 1); pointLight(10, 3.4, -4.4, 0xffc070, 1.4, 8, 1);
      particles({ kind: 'rise', n: 100, col: '#ffb060', col2: '#ff3010', size: 4, box: [30, 6, 6], origin: [0, 0, -6], speed: 0.6, add: 1 });
      particles({ kind: 'fall', n: 200, col: '#8a8080', size: 3, box: [36, 8, 10], origin: [0, 0, -3], speed: 0.4, a: 0.5 });
      mistLayers('#2a2030', 0.3, [-12, -24], 1, 4);
      STAGE_DAWN = cityDawn;
    },
  };
  // Infinity Castle: floating floors, endless shoji walls and stairs above and below
  function infinityCastle(o) {
    setup({ sky: false, fog: o.fog, fogNear: 12, fogFar: 85, hemi: o.hemi, key: o.key });
    HF = () => 0;
    const b = Batch(), mats = stdMats({ lac: lam({ color: 0xffffff }), paper: basic({ map: T.shoji(), color: o.warm ? 0xffd8a0 : 0xc8b0ff }) });
    const lacC = o.warm ? '#6a1a10' : '#2a1a44', woodC = o.warm ? '#8a6040' : '#6a5a7a';
    // fighting floor: polished boards with a railing at the back edge, supports dropping into the abyss
    b.add(boxG(80, 0.5, 9, 1.4), 'wood', '#' + C(o.floorCol).getHexString(), M(0, -0.25, 0.5));
    for (let i = -20; i <= 20; i++) b.add(boxG(0.08, 0.6, 0.08), 'lac', lacC, M(i * 2, 0.3, -3.9));
    b.add(boxG(80, 0.08, 0.1), 'lac', lacC, M(0, 0.62, -3.9));
    for (let i = -9; i <= 9; i++) b.add(boxG(0.45, 60, 0.45), 'lac', lacC, M(i * 4.4, -30.5, -3.6));
    // a lattice of rooms in every direction: rows of shoji houses at many levels, some upside down
    const level = (y, z, flip, n) => {
      for (let i = 0; i < n; i++) {
        const w = rnd(3.5, 7), d = rnd(2.5, 4.5), h = rnd(2.6, 3.6), x = -40 + i * (80 / n) + rnd(-1, 1);
        const M0 = M(x, y, z, 0, 1, flip ? -1 : 1, 1);
        b.add(boxG(w, 0.35, d, 1.4), 'wood', woodC, M0);
        const k = Math.max(2, Math.round(w / 1.4));
        for (let j = 0; j < k; j++) { const wx = -w / 2 + (j + 0.5) * w / k; b.add(new T3.PlaneGeometry(w / k * 0.92, h * 0.82), 'paper', '#ffffff', M0.clone().multiply(M(wx, h / 2, d / 2))); }
        for (let j = 0; j <= k; j++) b.add(boxG(0.16, h, 0.16), 'lac', lacC, M0.clone().multiply(M(-w / 2 + j * w / k, h / 2, d / 2)));
        b.add(boxG(w + 0.2, 0.22, d + 0.2), 'lac', lacC, M0.clone().multiply(M(0, h, 0)));
        if (h2(i, y) < 0.35) { const dir = h2(y, i) < 0.5 ? 1 : -1; for (let s2 = 0; s2 < 12; s2++) b.add(boxG(1.3, 0.16, 0.45), 'wood', woodC, M0.clone().multiply(M(w / 2 + 0.7 + s2 * 0.42 * dir, -s2 * 0.3, d / 2 - 0.3))); }
      }
    };
    for (const [y, z, flip, n] of [[7, -12, 0, 9], [-7, -14, 0, 8], [14, -20, 1, 8], [3, -24, 0, 10], [-12, -24, 0, 9], [20, -30, 0, 9], [-4, -34, 1, 10], [10, -40, 0, 11], [-18, -40, 0, 10], [28, -46, 1, 10], [0, -52, 0, 12], [-26, -56, 0, 11], [18, -60, 0, 12]]) level(y, z, flip, n);
    for (let i = 0; i < 26; i++) b.add(boxG(0.5, 90, 0.5), 'lac', lacC, M(rnd(-45, 45), 0, rnd(-60, -10)));
    for (let i = 0; i < 40; i++) paperLantern(b, rnd(-32, 32), rnd(-10, 16), rnd(-40, -6), o.lantern, 1.3);
    b.build(mats, { cast: { lac: 1 } });
    for (let i = 0; i < 12; i++) glowSprite(rnd(-25, 25), rnd(-6, 12), rnd(-30, -8), o.lantern, 3.5, 0.3);
    pointLight(-9, 3, -3, C(o.lantern).getHex(), 1.3, 10, 1); pointLight(9, 3, -3, C(o.lantern).getHex(), 1.3, 10, 1);
    particles({ kind: 'rise', n: 180, col: o.warm ? '#ffb060' : '#d8c0ff', col2: o.warm ? '#ff6020' : '#8a60ff', size: 3, box: [44, 16, 24], origin: [0, -6, -12], speed: 0.35, add: 1 });
    mistLayers(o.warm ? '#5a2a10' : '#3a1a50', 0.35, [-10, -20, -32, -46], -3, 12);
    if (o.moonBeams) shafts(8, { col: '#d0b8ff', a: 0.12, z0: -22, z1: -6, tilt: 0.25, h: 34 });
  }
  // dawn hooks: d in 0..1
  let STAGE_DAWN = null, SKYMAT = null;
  function skyDawn(d, o) {
    const u = SKYMAT && SKYMAT.uniforms; if (!u) return;
    u.uZen.value.set(o.zen).lerp(C(o.zen2), d); u.uHor.value.set(o.hor).lerp(C(o.hor2), d); u.uFog.value.set(o.fog).lerp(C(o.fog2), d);
    u.uSun.value = smooth(0.35, 1, d); u.uSunDir.value.set(0.55, -0.15 + d * 0.3, -1).normalize(); u.uCloudCol.value.set(o.cloud).lerp(C('#c07060'), d);
    E.scene.fog.color.copy(u.uFog.value); E.scene.background.copy(u.uFog.value);
    E.hemi.color.set(o.hemiA).lerp(C('#ffc8a0'), d); E.hemi.intensity = 0.9 + d * 0.5;
    E.sun.color.set(o.keyA).lerp(C('#ffb070'), d); E.sun.intensity = 0.75 + d * 0.6; E.sun.userData.base = [-6 + d * 16, 12 - d * 6, 9 - d * 4];
    if (sunSprite) { sunSprite.visible = d > 0.45; sunSprite.position.copy(u.uSunDir.value).multiplyScalar(370); }
    if (moonMesh) { moonMesh.material.opacity = 1 - d * 0.8; moonGlow.material.opacity = 0.55 * (1 - d); }
  }
  const dawnfieldDawn = (d) => skyDawn(d, { zen: '#060c22', zen2: '#3a5a9a', hor: '#1c2440', hor2: '#ff9a50', fog: '#1c2440', fog2: '#c08a70', cloud: '#1e2440', hemiA: '#8090c0', keyA: '#c8d0ff' });
  const cityDawn = (d) => skyDawn(d, { zen: '#04040a', zen2: '#34507e', hor: '#20182a', hor2: '#ff8a50', fog: '#18121e', fog2: '#a07060', cloud: '#1e1828', hemiA: '#7070a8', keyA: '#d0c8ff' });
  let sunSprite = null;

  // ============================================================
  //  public API
  // ============================================================
  function build(key, env) {
    E = env; G3 = env.group; anim = []; detail = []; lights.length = 0; rs = 7 + key.length * 131; HF = () => 0;
    moonMesh = moonGlow = sky = null; STAGE_DAWN = null; sunSprite = null;
    (STAGES[key] || STAGES.wisteria)();
    SKYMAT = sky && sky.material;
    if (SKYMAT && STAGE_DAWN) { sunSprite = new T3.Sprite(new T3.SpriteMaterial({ map: T.glow(), color: C('#ffe0a0'), blending: T3.AdditiveBlending, fog: false, depthWrite: false, transparent: true })); sunSprite.scale.set(60, 60, 1); sunSprite.visible = false; sunSprite.renderOrder = -9; add(sunSprite); }
    const dawnFn = STAGE_DAWN;
    return {
      update(t, cam) { U.uTime.value = t; for (const f of anim) f(t); if (sky) sky.position.copy(cam.position); if (moonMesh) { const md = SKYMAT.uniforms.uMoonDir.value; moonMesh.position.copy(md).multiplyScalar(380).add(cam.position); moonGlow.position.copy(moonMesh.position); } if (sunSprite && sunSprite.visible) sunSprite.position.copy(SKYMAT.uniforms.uSunDir.value).multiplyScalar(370).add(cam.position); },
      dawn(d) { if (dawnFn) dawnFn(d); },
      setQuality(q) { for (const m of detail) m.visible = q >= 1; },
      height: HF,
    };
  }
  return { build };
})();
