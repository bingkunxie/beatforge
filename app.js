/* Beatforge — a Web Audio step sequencer.
   No dependencies. Sound is fully synthesized at runtime. */

(() => {
  "use strict";

  // ---------- audio engine ----------
  let ctx = null;
  let masterGain = null;
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = state.master; // honor restored/current master volume
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // small reusable helpers
  function env(gain, t, peak, attack, decay) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function noiseBuffer() {
    const len = audio().sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let _noise = null;
  function noise() { return (_noise ||= noiseBuffer()); }

  // ---------- voices: (time, dest, vol, kit) ----------
  const Voices = {
    kick(t, dest, vol, kit) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f0 = kit === "tr808" ? 150 : kit === "lofi" ? 110 : 165;
      const fEnd = kit === "tr808" ? 45 : 50;
      const dur = kit === "tr808" ? 0.55 : 0.32;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(fEnd, t + 0.12);
      env(g, t, vol, 0.002, dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    },
    snare(t, dest, vol, kit) {
      const n = ctx.createBufferSource(); n.buffer = noise();
      const nf = ctx.createBiquadFilter();
      nf.type = "highpass"; nf.frequency.value = kit === "lofi" ? 1200 : 1800;
      const ng = ctx.createGain();
      env(ng, t, vol * 0.9, 0.001, kit === "tr808" ? 0.22 : 0.16);
      n.connect(nf); nf.connect(ng); ng.connect(dest);
      const o = ctx.createOscillator(); o.type = "triangle";
      o.frequency.setValueAtTime(kit === "tr808" ? 180 : 220, t);
      const og = ctx.createGain();
      env(og, t, vol * 0.5, 0.001, 0.1);
      o.connect(og); og.connect(dest);
      n.start(t); n.stop(t + 0.3); o.start(t); o.stop(t + 0.2);
    },
    clap(t, dest, vol) {
      // three quick noise bursts
      [0, 0.012, 0.024].forEach((off, i) => {
        const n = ctx.createBufferSource(); n.buffer = noise();
        const f = ctx.createBiquadFilter(); f.type = "bandpass";
        f.frequency.value = 1100; f.Q.value = 1.2;
        const g = ctx.createGain();
        env(g, t + off, vol * (i === 2 ? 0.9 : 0.5), 0.001, i === 2 ? 0.14 : 0.03);
        n.connect(f); f.connect(g); g.connect(dest);
        n.start(t + off); n.stop(t + off + 0.2);
      });
    },
    hat(t, dest, vol, kit) {
      const n = ctx.createBufferSource(); n.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = kit === "lofi" ? 6000 : 8500;
      const g = ctx.createGain();
      env(g, t, vol * 0.6, 0.001, 0.045);
      n.connect(f); f.connect(g); g.connect(dest);
      n.start(t); n.stop(t + 0.08);
    },
    openhat(t, dest, vol, kit) {
      const n = ctx.createBufferSource(); n.buffer = noise();
      const f = ctx.createBiquadFilter();
      f.type = "highpass"; f.frequency.value = kit === "lofi" ? 5500 : 7500;
      const g = ctx.createGain();
      env(g, t, vol * 0.5, 0.001, 0.32);
      n.connect(f); f.connect(g); g.connect(dest);
      n.start(t); n.stop(t + 0.4);
    },
    tom(t, dest, vol) {
      const o = ctx.createOscillator(); o.type = "sine";
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
      const g = ctx.createGain();
      env(g, t, vol, 0.002, 0.28);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.35);
    },
    rim(t, dest, vol) {
      const o = ctx.createOscillator(); o.type = "square";
      o.frequency.setValueAtTime(1700, t);
      const g = ctx.createGain();
      env(g, t, vol * 0.4, 0.001, 0.03);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.05);
    },
    bass(t, dest, vol, kit) {
      const o = ctx.createOscillator();
      o.type = kit === "tr808" ? "sine" : "sawtooth";
      o.frequency.setValueAtTime(55, t);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 400; f.Q.value = 6;
      const g = ctx.createGain();
      env(g, t, vol * 0.8, 0.005, 0.3);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.4);
    },
  };

  // ---------- track config ----------
  const TRACKS = [
    { id: "kick",    name: "KICK",  color: "#ff5d73" },
    { id: "snare",   name: "SNARE", color: "#ffce54" },
    { id: "clap",    name: "CLAP",  color: "#ff9f43" },
    { id: "hat",     name: "HAT",   color: "#4ad7d4" },
    { id: "openhat", name: "OPEN",  color: "#54a0ff" },
    { id: "tom",     name: "TOM",   color: "#a55eea" },
    { id: "rim",     name: "RIM",   color: "#26de81" },
    { id: "bass",    name: "BASS",  color: "#fd79a8" },
  ];

  // ---------- state ----------
  const NUM_PATTERNS = 4;
  const state = {
    steps: 16,
    bpm: 120,
    swing: 0,
    master: 0.8,
    kit: "classic",
    current: 0,
    patterns: [], // [{ tracks: { id: { steps:[], vol, mute } } }]
  };

  function blankPattern() {
    const tracks = {};
    TRACKS.forEach(t => {
      tracks[t.id] = { steps: new Array(32).fill(false), vol: 0.85, mute: false };
    });
    return { tracks };
  }
  for (let i = 0; i < NUM_PATTERNS; i++) state.patterns.push(blankPattern());

  function pat() { return state.patterns[state.current]; }

  // ---------- DOM ----------
  const $ = sel => document.querySelector(sel);
  const grid = $("#grid");
  const playBtn = $("#play");

  function buildGrid() {
    grid.innerHTML = "";
    TRACKS.forEach(t => {
      const tr = pat().tracks[t.id];
      const row = document.createElement("div");
      row.className = "row";

      const head = document.createElement("div");
      head.className = "track-head";
      head.innerHTML = `
        <span class="track-dot" style="color:${t.color}"></span>
        <span class="track-name">${t.name}</span>
      `;
      const mute = document.createElement("button");
      mute.className = "mute" + (tr.mute ? " muted" : "");
      mute.textContent = "M";
      mute.title = "Mute";
      mute.onclick = () => { tr.mute = !tr.mute; mute.classList.toggle("muted", tr.mute); scheduleSave(); };
      const vol = document.createElement("input");
      vol.type = "range"; vol.min = 0; vol.max = 100; vol.value = tr.vol * 100;
      vol.className = "track-vol"; vol.title = "Volume";
      vol.oninput = () => { tr.vol = vol.value / 100; scheduleSave(); };
      head.appendChild(mute); head.appendChild(vol);

      const cells = document.createElement("div");
      cells.className = "cells";
      for (let i = 0; i < state.steps; i++) {
        const c = document.createElement("div");
        c.className = "cell" + (tr.steps[i] ? " on" : "");
        c.dataset.track = t.id; c.dataset.idx = i;
        if (tr.steps[i]) c.style.background = t.color, c.style.borderColor = t.color;
        c.onclick = () => toggle(t.id, i, c, t.color);
        cells.appendChild(c);
      }
      row.appendChild(head); row.appendChild(cells);
      grid.appendChild(row);
    });
  }

  function toggle(id, i, cell, color) {
    audio();
    const tr = pat().tracks[id];
    tr.steps[i] = !tr.steps[i];
    cell.classList.toggle("on", tr.steps[i]);
    if (tr.steps[i]) {
      cell.style.background = color; cell.style.borderColor = color;
      // audition the sound
      Voices[id](ctx.currentTime, masterGain, tr.vol, state.kit);
    } else {
      cell.style.background = ""; cell.style.borderColor = "";
    }
    scheduleSave();
  }

  // ---------- scheduler (lookahead) ----------
  let playing = false;
  let currentStep = 0;
  let nextNoteTime = 0;
  let timer = null;
  const LOOKAHEAD = 25;       // ms
  const SCHEDULE_AHEAD = 0.1; // s

  function secondsPerStep() {
    return (60 / state.bpm) / 4; // 16th notes
  }

  function scheduleStep(step, time) {
    TRACKS.forEach(t => {
      const tr = pat().tracks[t.id];
      if (tr.steps[step] && !tr.mute) {
        Voices[t.id](time, masterGain, tr.vol, state.kit);
      }
    });
    // visual playhead
    const ms = (time - ctx.currentTime) * 1000;
    setTimeout(() => paintPlayhead(step), Math.max(ms, 0));
  }

  function paintPlayhead(step) {
    if (!playing) return;
    grid.querySelectorAll(".cell.playhead").forEach(c => c.classList.remove("playhead"));
    grid.querySelectorAll(`.cell[data-idx="${step}"]`).forEach(c => {
      c.classList.add("playhead");
      if (c.classList.contains("on")) {
        c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash");
      }
    });
  }

  function next() {
    const spb = secondsPerStep();
    // swing: delay odd steps
    const swingAmt = (state.swing / 100) * spb * 0.5;
    nextNoteTime += spb;
    if ((currentStep % 2) === 1) nextNoteTime += swingAmt;
    currentStep = (currentStep + 1) % state.steps;
  }

  function loop() {
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(currentStep, nextNoteTime);
      next();
    }
    timer = setTimeout(loop, LOOKAHEAD);
  }

  function play() {
    audio();
    playing = true;
    currentStep = 0;
    nextNoteTime = ctx.currentTime + 0.06;
    playBtn.classList.add("playing");
    playBtn.querySelector(".play-icon").textContent = "■";
    loop();
  }
  function stop() {
    playing = false;
    clearTimeout(timer);
    playBtn.classList.remove("playing");
    playBtn.querySelector(".play-icon").textContent = "▶";
    grid.querySelectorAll(".cell.playhead").forEach(c => c.classList.remove("playhead"));
  }
  function togglePlay() { playing ? stop() : play(); }

  // ---------- pattern bank ----------
  const bank = $("#patternBank");
  function buildBank() {
    bank.innerHTML = "";
    for (let i = 0; i < NUM_PATTERNS; i++) {
      const b = document.createElement("button");
      b.className = "pat" + (i === state.current ? " active" : "");
      b.textContent = String.fromCharCode(65 + i); // A B C D
      b.onclick = () => {
        state.current = i;
        buildBank(); buildGrid(); scheduleSave();
      };
      bank.appendChild(b);
    }
  }

  // ---------- persistence ----------
  // Two layers: (1) autosave the whole working kit to localStorage so nothing is
  // lost on refresh/reopen; (2) Export/Import a .json file for backup & transfer.
  // (The cloud "☁ Save" / gallery is a separate, account-based system.)
  const KEY = "beatforge.v1";

  function snapshot() {
    return {
      steps: state.steps, bpm: state.bpm, swing: state.swing,
      master: state.master, kit: state.kit,
      current: state.current, patterns: state.patterns,
    };
  }

  // Apply a saved/imported kit to live state and re-render.
  function applyState(d) {
    if (!d || !Array.isArray(d.patterns)) throw new Error("invalid kit data");
    Object.assign(state, d);
    $("#bpm").value = state.bpm;
    $("#swing").value = state.swing; $("#swingVal").textContent = state.swing + "%";
    $("#master").value = state.master * 100; $("#masterVal").textContent = Math.round(state.master * 100);
    $("#steps").value = state.steps;
    if (masterGain) masterGain.gain.value = state.master;
    setKit(state.kit);
    buildBank(); buildGrid();
  }

  function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch {} }
  let saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
  // Safety net: flush on the way out even if a mutation was missed.
  window.addEventListener("pagehide", saveNow);
  window.addEventListener("beforeunload", saveNow);

  // ---------- toast feedback ----------
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById("bfToast");
    if (!t) { t = document.createElement("div"); t.id = "bfToast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- export / import a .json kit ----------
  function exportKit() {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "beatforge-kit.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported beatforge-kit.json");
  }
  function importKit() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { applyState(JSON.parse(reader.result)); scheduleSave(); toast("Imported " + file.name); }
        catch { toast("Couldn't import that file"); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }
  // ---------- controls wiring ----------
  function setKit(kit) {
    state.kit = kit;
    document.querySelectorAll("#kit button").forEach(b =>
      b.classList.toggle("active", b.dataset.kit === kit));
    scheduleSave();
  }

  playBtn.onclick = togglePlay;
  $("#bpm").oninput = e => { state.bpm = Math.min(240, Math.max(40, +e.target.value || 120)); scheduleSave(); };
  $("#swing").oninput = e => { state.swing = +e.target.value; $("#swingVal").textContent = state.swing + "%"; scheduleSave(); };
  $("#master").oninput = e => {
    state.master = e.target.value / 100;
    $("#masterVal").textContent = e.target.value;
    if (masterGain) masterGain.gain.value = state.master;
    scheduleSave();
  };
  $("#steps").onchange = e => { state.steps = +e.target.value; currentStep = 0; buildGrid(); scheduleSave(); };
  $("#clear").onclick = () => {
    TRACKS.forEach(t => pat().tracks[t.id].steps.fill(false));
    buildGrid(); scheduleSave();
  };
  $("#random").onclick = () => {
    const density = { kick: .35, snare: .15, clap: .12, hat: .55, openhat: .12, tom: .1, rim: .15, bass: .25 };
    TRACKS.forEach(t => {
      const s = pat().tracks[t.id].steps;
      for (let i = 0; i < state.steps; i++) {
        if (t.id === "kick" && i % 4 === 0) { s[i] = Math.random() < 0.85; continue; }
        if (t.id === "snare" && i % 8 === 4) { s[i] = Math.random() < 0.8; continue; }
        s[i] = Math.random() < density[t.id];
      }
    });
    buildGrid(); scheduleSave();
  };
  $("#exportKit").onclick = exportKit;
  $("#importKit").onclick = importKit;
  document.querySelectorAll("#kit button").forEach(b =>
    b.onclick = () => setKit(b.dataset.kit));

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key >= "1" && e.key <= "4") { state.current = +e.key - 1; buildBank(); buildGrid(); scheduleSave(); }
  });

  // ---------- demo beat so it's alive on first load ----------
  function seedDemo() {
    const k = pat().tracks;
    [0, 4, 8, 10, 12].forEach(i => k.kick.steps[i] = true);
    [4, 12].forEach(i => k.snare.steps[i] = true);
    [0,2,4,6,8,10,12,14].forEach(i => k.hat.steps[i] = true);
    [7, 15].forEach(i => k.openhat.steps[i] = true);
    [0, 8].forEach(i => k.bass.steps[i] = true);
  }

  // ---------- engine API (consumed by other scripts: auth/beats/ui) ----------
  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

  window.BF = window.BF || {};
  // Note: master volume is intentionally excluded from settings — it is a local
  // playback preference, not part of a saved/shared pattern.
  window.BF.engine = {
    getActiveBank() { return deepCopy(pat().tracks); },
    getSettings() {
      return { steps: state.steps, bpm: state.bpm, swing: state.swing, kit: state.kit };
    },
    setActiveBank(tracks) {
      pat().tracks = deepCopy(tracks);
      buildGrid();
      scheduleSave();
    },
    setSettings(s) {
      if (s.steps != null) { state.steps = +s.steps; $("#steps").value = state.steps; }
      if (s.bpm != null)   { state.bpm = +s.bpm; $("#bpm").value = state.bpm; }
      if (s.swing != null) { state.swing = +s.swing; $("#swing").value = state.swing; $("#swingVal").textContent = state.swing + "%"; }
      if (s.kit)   setKit(s.kit);
      buildGrid();
      scheduleSave();
    },
    refresh() { buildBank(); buildGrid(); },
  };

  // ---------- init ----------
  // Restore the last session if there is one; otherwise seed a demo beat.
  const restored = localStorage.getItem(KEY);
  if (restored) {
    try {
      applyState(JSON.parse(restored));
      setTimeout(() => toast("Restored your last session"), 0);
    } catch {
      seedDemo(); buildBank(); buildGrid();
    }
  } else {
    seedDemo(); buildBank(); buildGrid();
  }
})();
