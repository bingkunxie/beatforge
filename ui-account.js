/* ui-account.js — account & gallery UI. window.BF.ui */
(() => {
  "use strict";
  window.BF = window.BF || {};
  const auth = window.BF.auth;
  const bar = document.getElementById("authBar");

  function renderBar(user) {
    if (!auth.enabled) { bar.innerHTML = `<span class="who">offline mode</span>`; return; }
    if (user) {
      bar.innerHTML = `<span class="who">● </span>
        <button class="btn ghost" id="btnSignOut">Sign out</button>`;
      bar.querySelector(".who").append(user.email || "signed in"); // textContent-safe
      document.getElementById("btnSignOut").onclick = () => auth.signOut();
    } else {
      bar.innerHTML = `<button class="btn ghost" id="btnSignIn">Sign in</button>`;
      document.getElementById("btnSignIn").onclick = openAuthModal;
    }
  }

  function openAuthModal() {
    const bg = document.createElement("div");
    bg.className = "auth-modal-bg";
    bg.innerHTML = `
      <div class="auth-modal">
        <button class="google" id="gbtn">Continue with Google</button>
        <input id="email" type="email" placeholder="email" />
        <input id="pass" type="password" placeholder="password" />
        <div class="err" id="autherr"></div>
        <div style="display:flex; gap:8px;">
          <button class="btn" id="login" style="flex:1">Log in</button>
          <button class="btn ghost" id="signup" style="flex:1">Sign up</button>
        </div>
        <button class="btn ghost" id="closeAuth">Cancel</button>
      </div>`;
    document.body.appendChild(bg);
    const err = bg.querySelector("#autherr");
    const email = () => bg.querySelector("#email").value.trim();
    const pass = () => bg.querySelector("#pass").value;
    const close = () => bg.remove();
    bg.querySelector("#closeAuth").onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector("#gbtn").onclick = () => auth.signInGoogle();
    bg.querySelector("#login").onclick = async () => {
      const { error } = await auth.signInEmail(email(), pass());
      if (error) err.textContent = error.message; else close();
    };
    bg.querySelector("#signup").onclick = async () => {
      const { error } = await auth.signUpEmail(email(), pass());
      err.textContent = error ? error.message : "Check your email to confirm, then log in.";
    };
  }

  const panel = document.getElementById("panel");
  function closePanel() { panel.classList.add("hidden"); panel.innerHTML = ""; }

  async function requireAuth() {
    if (!auth.enabled) { alert("Set up Supabase (see SETUP.md) to use accounts."); return false; }
    if (!(await auth.currentUser())) { openAuthModal(); return false; }
    return true;
  }

  function openSaveDialog() {
    const bg = document.createElement("div");
    bg.className = "auth-modal-bg";
    bg.innerHTML = `
      <div class="auth-modal">
        <strong>Save beat</strong>
        <input id="btitle" placeholder="title" />
        <label style="font-size:12px;color:var(--muted)">
          <input type="checkbox" id="bpublic" /> Make public (show in gallery)
        </label>
        <div class="err" id="saveerr"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn" id="dosave" style="flex:1">Save</button>
          <button class="btn ghost" id="cancelsave" style="flex:1">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector("#cancelsave").onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector("#dosave").onclick = async () => {
      const title = bg.querySelector("#btitle").value.trim() || "Untitled";
      const isPublic = bg.querySelector("#bpublic").checked;
      const data = window.BF.serialize.toBeatData(
        window.BF.engine.getActiveBank(), window.BF.engine.getSettings());
      try {
        await window.BF.beats.save({ title, data, isPublic });
        close();
      } catch (e) { bg.querySelector("#saveerr").textContent = e.message; }
    };
  }

  function loadBeatIntoGrid(beat) {
    const { tracks, settings } = window.BF.serialize.fromBeatData(beat.data);
    window.BF.engine.setSettings(settings);
    window.BF.engine.setActiveBank(tracks);
  }

  async function openMyBeats() {
    if (!(await requireAuth())) return;
    panel.classList.remove("hidden");
    panel.innerHTML = `<h2>MY BEATS <button class="close">✕</button></h2><div id="list">Loading…</div>`;
    panel.querySelector(".close").onclick = closePanel;
    const rows = await window.BF.beats.mine();
    const list = panel.querySelector("#list");
    if (!rows.length) { list.textContent = "No saved beats yet."; return; }
    list.innerHTML = "";
    rows.forEach((b) => {
      const card = document.createElement("div");
      card.className = "beat-card";
      card.innerHTML = `<div class="t">${escapeHtml(b.title)}</div>
        <div class="meta">${b.is_public ? "public" : "private"} · ${new Date(b.created_at).toLocaleDateString()}</div>
        <div class="acts">
          <button class="btn" data-a="load">Load</button>
          <button class="btn ghost" data-a="toggle">${b.is_public ? "Make private" : "Make public"}</button>
          <button class="btn ghost" data-a="share">Copy link</button>
          <button class="btn ghost" data-a="del">Delete</button>
        </div>`;
      card.querySelector('[data-a="load"]').onclick = () => { loadBeatIntoGrid(b); closePanel(); };
      card.querySelector('[data-a="toggle"]').onclick = async () => {
        await window.BF.beats.update(b.id, { is_public: !b.is_public }); openMyBeats();
      };
      card.querySelector('[data-a="share"]').onclick = () => copyShare(b.id);
      card.querySelector('[data-a="del"]').onclick = async () => {
        if (confirm("Delete this beat?")) { await window.BF.beats.remove(b.id); openMyBeats(); }
      };
      list.appendChild(card);
    });
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, (ch) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[ch])); }

  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById("bfToast");
    if (!t) { t = document.createElement("div"); t.id = "bfToast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function copyShare(id) {
    const url = location.origin + location.pathname + "?beat=" + id;
    navigator.clipboard.writeText(url)
      .then(() => toast("Link copied to clipboard"))
      .catch(() => window.prompt("Copy this share link:", url));
  }

  document.getElementById("cloudSave").onclick = async () => { if (await requireAuth()) openSaveDialog(); };
  document.getElementById("myBeats").onclick = openMyBeats;

  // init
  if (auth.enabled) {
    auth.onChange(renderBar);
    auth.currentUser().then(renderBar);
  } else {
    renderBar(null);
  }

  window.BF.ui = { renderBar, openAuthModal, openMyBeats, loadBeatIntoGrid, closePanel, copyShare, escapeHtml };
})();
