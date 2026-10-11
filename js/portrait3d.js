// ============================================================
//  PORTRAIT3D — snapshots of the in-game chibi 3D models, used as
//  portraits everywhere in the 2D UI (stage cards, HUD, dialog, stats page)
//  so the menus show the same characters you fight with.
//  get(key, 'head' | 'full') → canvas (cached), or null if WebGL is unavailable.
// ============================================================
'use strict';

const PORTRAIT3D = (() => {
  let R = null, scene = null, cam = null, failed = false;
  const cache = {};
  function init() {
    if (R || failed) return !!R;
    try {
      if (!window.THREE || typeof CHIBI3D === 'undefined' || !CHIBI3D.make) throw 0;
      const T3 = THREE, c = document.createElement('canvas');
      R = new T3.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
      scene = new T3.Scene();
      scene.add(new T3.HemisphereLight(0xffffff, 0x5a4a60, 1.15));
      const key = new T3.DirectionalLight(0xffffff, 0.8); key.position.set(2, 5, 6); scene.add(key);
      const rim = new T3.DirectionalLight(0xffd0d8, 0.35); rim.position.set(-4, 3, -4); scene.add(rim);
      cam = new T3.PerspectiveCamera(26, 1, 0.1, 100);
    } catch (e) { failed = true; R = null; }
    return !!R;
  }
  function actorFor(key) {
    if (typeof CHARS !== 'undefined' && CHARS[key]) return { key, look: CHARS[key].look, ch: CHARS[key] };
    if (typeof BOSSES !== 'undefined' && BOSSES[key]) { const d = BOSSES[key]; return { key, lk: d.look, boss: 1, look: DEMON_LOOKS[d.look], custom: !DEMON_LOOKS[d.look] }; }
    if (typeof ALLIES !== 'undefined' && ALLIES[key]) return { key, look: ALLIES[key].look, boss: 1 };
    return null;
  }
  function get(key, framing) {
    framing = framing || 'head';
    const id = key + '|' + framing;
    if (id in cache) return cache[id];
    let out = null;
    try {
      const a = actorFor(key);
      if (a && init()) {
        const T3 = THREE, M = CHIBI3D.make(a);
        if (M) {
          const full = framing === 'full' || M.custom;
          const w = full ? 224 : 192, h = full ? 280 : 192;
          R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
          scene.add(M.root);
          CHIBI3D.pose(M, Object.assign({ x: 640, y: GY, z: 0, yaw: full ? 0.35 : 0.22, scale: 1, pose: { t: 0, swing: 0.9 } }, a), 0.016);
          M.root.updateMatrixWorld(true);
          const box = new T3.Box3().setFromObject(M.root), s = box.getSize(new T3.Vector3()), c = box.getCenter(new T3.Vector3());
          const fov = cam.fov * Math.PI / 180;
          if (full) {
            const d = Math.max(s.y, s.x * 1.25 * h / w) / (2 * Math.tan(fov / 2)) * 1.04;
            cam.position.set(c.x, c.y + s.y * 0.03, c.z + d); cam.lookAt(c);
          } else {
            // chibi heads are ~45% of the body: frame head + shoulders
            const fy = box.max.y - s.y * 0.27, span = s.y * 0.52;
            const d = span / (2 * Math.tan(fov / 2));
            cam.position.set(c.x, fy + span * 0.02, c.z + d); cam.lookAt(c.x, fy, c.z);
          }
          R.render(scene, cam);
          out = document.createElement('canvas'); out.width = w; out.height = h;
          out.getContext('2d').drawImage(R.domElement, 0, 0);
          scene.remove(M.root);
          M.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
          (M.mats || []).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
          for (const k in (M.faces || {})) M.faces[k].dispose && M.faces[k].dispose();
        }
      }
    } catch (e) { out = null; }
    return (cache[id] = out);
  }
  return { get, ok: () => init() };
})();
