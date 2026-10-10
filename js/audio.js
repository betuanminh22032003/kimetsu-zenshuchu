// ============================================================
//  AUDIO — procedural SFX, taiko/koto BGM, Japanese TTS
// ============================================================
'use strict';

const Audio = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  let voiceOn = true, musicOn = true, jaVoice = null, voiceLv = 1, curPrio = 0; // voiceLv: 1 = sparing (default), 2 = every callout
  let musTimer = null, musStep = 0, musMode = 'calm';

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.32; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pickVoice();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = pickVoice;
  }
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices().filter(v => /ja/i.test(v.lang));
    jaVoice = vs.find(v => /Nanami|Keita|Natural|Online/i.test(v.name)) || vs[0] || null;
  }
  function hasJa() { return !!jaVoice; }

  function noise(dur, freq, q, type, vol, sweepTo) {
    if (!ac) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, type, vol, slideTo, bus, when) {
    if (!ac) return;
    const t = (when || ac.currentTime);
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  const sfx = {
    swing() { noise(0.16, 2400, 0.8, 'bandpass', 0.35, 900); },
    heavy() { noise(0.28, 1400, 0.7, 'bandpass', 0.5, 400); },
    hit() { noise(0.12, 600, 1, 'lowpass', 0.7); tone(140, 0.12, 'square', 0.18, 60); },
    bigHit() { noise(0.35, 400, 0.7, 'lowpass', 0.9); tone(90, 0.3, 'sawtooth', 0.25, 40); },
    hurt() { tone(220, 0.15, 'square', 0.15, 110); noise(0.1, 900, 1, 'bandpass', 0.4); },
    water() { noise(0.5, 1200, 0.6, 'bandpass', 0.35, 300); tone(600, 0.3, 'sine', 0.08, 1200); },
    fire() { noise(0.6, 500, 0.5, 'lowpass', 0.6, 2000); },
    thunder() { noise(0.08, 5000, 0.5, 'highpass', 0.8); noise(0.7, 300, 0.5, 'lowpass', 0.7, 80); tone(1800, 0.1, 'square', 0.1, 200); },
    wind() { noise(0.6, 800, 2, 'bandpass', 0.4, 3000); },
    boom() { noise(0.6, 200, 0.5, 'lowpass', 1.0, 50); tone(60, 0.5, 'sine', 0.5, 30); },
    chain() { for (let i = 0; i < 4; i++) tone(1800 + i * 300, 0.05, 'square', 0.05, 900, sfxBus, ac && ac.currentTime + i * 0.04); },
    poison() { tone(900, 0.1, 'sine', 0.12, 1800); },
    pickup() { tone(880, 0.1, 'sine', 0.15); tone(1320, 0.15, 'sine', 0.12, null, sfxBus, ac && ac.currentTime + 0.08); },
    tele() { tone(400, 0.2, 'triangle', 0.08, 800); },
    gong() { tone(110, 2.0, 'sine', 0.4); tone(220.5, 1.6, 'sine', 0.15); tone(331, 1.2, 'sine', 0.08); },
    breath() { noise(0.8, 700, 0.6, 'bandpass', 0.18, 300); },
    cutin() { noise(0.4, 3000, 0.4, 'highpass', 0.4, 600); tone(55, 0.6, 'sine', 0.5); },
    select() { tone(660, 0.06, 'square', 0.06); },
  };
  // the same sound fired many times in one instant just piles up into noise: keep one per 45 ms, and at most 10 a second overall
  { const last = {}; let win = 0, n = 0;
    for (const k in sfx) { const f = sfx[k]; sfx[k] = function () { const now = performance.now(); if (now - (last[k] || 0) < 45) return; if (now - win > 1000) { win = now; n = 0; } if (++n > 10 && k !== 'gong' && k !== 'cutin') return; last[k] = now; f.apply(this, arguments); }; } }

  // ---- BGM: pentatonic koto + taiko
  const scale = [0, 1, 5, 7, 8, 12, 13, 17]; // miyako-bushi
  function koto(midi, when, vol) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    tone(f, 0.9, 'triangle', vol, null, musBus, when);
    tone(f * 2, 0.4, 'sine', vol * 0.3, null, musBus, when);
  }
  function taiko(when, vol) {
    if (!ac) return;
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(120, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.25);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
    o.connect(g); g.connect(musBus); o.start(when); o.stop(when + 0.4);
  }
  function startMusic(mode) {
    musMode = mode || 'battle';
    if (!ac || musTimer) return;
    let next = ac.currentTime + 0.1;
    musTimer = setInterval(() => {
      syncCustom();
      if (!musicOn || custom[musMode]) { next = Math.max(next, ac.currentTime + 0.05); return; }
      const bpm = musMode === 'battle' ? 138 : musMode === 'boss' ? 156 : 84;
      const step = 60 / bpm / 2;
      while (next < ac.currentTime + 0.3) {
        const s = musStep % 32;
        if (musMode !== 'calm') {
          if (s % 8 === 0 || s % 8 === 3 || (musMode === 'boss' && s % 4 === 2)) taiko(next, 0.7);
          if (s % 8 === 6) taiko(next, 0.35);
        } else if (s % 16 === 0) taiko(next, 0.4);
        const root = musMode === 'boss' ? 50 : 52;
        if (s % 2 === 0 && Math.random() < (musMode === 'calm' ? 0.5 : 0.75)) {
          const n = scale[(Math.floor(musStep / 2) * 3 + (s % 5) + Math.floor(Math.random() * 2)) % scale.length];
          koto(root + 12 + n, next, 0.08);
        }
        if (s === 0) koto(root + scale[(Math.floor(musStep / 32)) % 4], next, 0.1);
        musStep++; next += step;
      }
    }, 60);
  }
  function setMusic(mode) { musMode = mode; syncCustom(); }
  function stopMusic() { clearInterval(musTimer); musTimer = null; for (const k in custom) custom[k].el.pause(); }

  // ---- "Your music": tracks the player picks from THEIR OWN computer, per mood (calm / battle / boss).
  // Stored only in this browser (IndexedDB) — never uploaded, never part of the game files.
  const custom = {};
  const DB = () => new Promise((res, rej) => { const r = indexedDB.open('kny_music', 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  function attach(slot, blob, name) {
    if (custom[slot]) { custom[slot].el.pause(); URL.revokeObjectURL(custom[slot].el.src); }
    const el = new window.Audio(URL.createObjectURL(blob)); el.loop = true; el.volume = 0.55;
    custom[slot] = { el, name };
  }
  function syncCustom() {
    for (const k in custom) { const c = custom[k], on = musicOn && k === musMode && musTimer; if (on && c.el.paused) c.el.play().catch(() => {}); if (!on && !c.el.paused) c.el.pause(); }
  }
  async function setTrack(slot, file) {
    try { const db = await DB(); db.transaction('t', 'readwrite').objectStore('t').put({ blob: file, name: file.name }, slot); } catch (e) { }
    attach(slot, file, file.name); syncCustom();
  }
  async function clearTrack(slot) {
    if (custom[slot]) { custom[slot].el.pause(); URL.revokeObjectURL(custom[slot].el.src); delete custom[slot]; }
    try { const db = await DB(); db.transaction('t', 'readwrite').objectStore('t').delete(slot); } catch (e) { }
  }
  (async () => { try { const db = await DB(); for (const slot of ['calm', 'battle', 'boss']) { const rq = db.transaction('t').objectStore('t').get(slot); rq.onsuccess = () => { if (rq.result) attach(slot, rq.result.blob, rq.result.name); }; } } catch (e) { } })();
  function pickTrack(slot) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*';
    inp.onchange = () => { if (inp.files[0]) setTrack(slot, inp.files[0]); }; inp.click();
  }

  // ---- Japanese voice
  // prio: 0 filler, 1 normal, 2 important (finishers, dialogue). A line never cuts off a more important one still being spoken.
  function say(text, pitch, rate, prio) {
    if (!voiceOn || !window.speechSynthesis || !text) return false;
    prio = prio === undefined ? 1 : prio;
    if (speechSynthesis.speaking && prio < curPrio) return false;
    if (speechSynthesis.speaking && prio === curPrio && prio < 2) return false; // don't chop a line for another of the same weight
    try {
      speechSynthesis.cancel(); curPrio = prio;
      const u = new SpeechSynthesisUtterance(text); u.onend = u.onerror = () => { curPrio = 0; };
      u.lang = 'ja-JP'; if (jaVoice) u.voice = jaVoice;
      u.pitch = Math.max(0.1, Math.min(2, pitch || 1)); u.rate = rate || 1.15; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) { return false; }
    return true;
  }
  return {
    init, sfx, say, hasJa, startMusic, stopMusic, setMusic, pickTrack, clearTrack, trackName: (slot) => custom[slot] ? custom[slot].name : null,
    get voiceLv() { return voiceOn ? voiceLv : 0; }, set voiceLv(v) { voiceLv = v || 1; this.voiceOn = !!v; },
    get voiceOn() { return voiceOn; }, set voiceOn(v) { voiceOn = v; if (!v && window.speechSynthesis) speechSynthesis.cancel(); },
    get musicOn() { return musicOn; }, set musicOn(v) { musicOn = v; syncCustom(); },
  };
})();
