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
        <button class="google" id="gbtn">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Google
        </button>
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

  let gallerySort = "new";

  async function openGallery() {
    if (!auth.enabled) { alert("Set up Supabase (see SETUP.md) to use the gallery."); return; }
    panel.classList.remove("hidden");
    panel.innerHTML = `<h2>GALLERY <button class="close">✕</button></h2>
      <div class="tabs">
        <button class="btn" data-s="new">Newest</button>
        <button class="btn" data-s="popular">Popular</button>
      </div><div id="glist">Loading…</div>`;
    panel.querySelector(".close").onclick = closePanel;
    panel.querySelectorAll(".tabs .btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.s === gallerySort);
      b.onclick = () => { gallerySort = b.dataset.s; openGallery(); };
    });
    const rows = await window.BF.beats.gallery({ sort: gallerySort });
    const liked = await window.BF.beats.likedByMe(rows.map((r) => r.id));
    const list = panel.querySelector("#glist");
    if (!rows.length) { list.textContent = "No public beats yet — be the first!"; return; }
    list.innerHTML = "";
    rows.forEach((b) => {
      const isLiked = liked.has(b.id);
      const card = document.createElement("div");
      card.className = "beat-card";
      card.innerHTML = `<div class="t">${escapeHtml(b.title)}</div>
        <div class="meta">by ${escapeHtml(b.author || "anon")} · ♥ <span class="cnt">${Number(b.like_count) || 0}</span></div>
        <div class="acts">
          <button class="btn" data-a="load">Load</button>
          <button class="btn ghost like ${isLiked ? "on" : ""}" data-a="like">♥ ${isLiked ? "Liked" : "Like"}</button>
          <button class="btn ghost" data-a="remix">Remix</button>
          <button class="btn ghost" data-a="share">Copy link</button>
        </div>`;
      card.querySelector('[data-a="load"]').onclick = () => { loadBeatIntoGrid(b); closePanel(); };
      card.querySelector('[data-a="share"]').onclick = () => copyShare(b.id);
      card.querySelector('[data-a="remix"]').onclick = () => startRemix(b);
      const likeBtn = card.querySelector('[data-a="like"]');
      const cnt = card.querySelector(".cnt");
      let on = isLiked;
      likeBtn.onclick = async () => {
        if (!(await requireAuth())) return;
        if (likeBtn.disabled) return;      // guard against double-click races
        likeBtn.disabled = true;
        try {
          if (on) { await window.BF.beats.unlike(b.id); cnt.textContent = +cnt.textContent - 1; }
          else { await window.BF.beats.like(b.id); cnt.textContent = +cnt.textContent + 1; }
          on = !on;
          likeBtn.classList.toggle("on", on);
          likeBtn.textContent = on ? "♥ Liked" : "♥ Like";
        } catch (e) { alert(e.message); }
        finally { likeBtn.disabled = false; }
      };
      list.appendChild(card);
    });
  }

  // Remix: load into grid, then a save dialog creates a new beat crediting origin.
  function startRemix(beat) {
    loadBeatIntoGrid(beat);
    closePanel();
    openSaveDialogForRemix(beat);
  }
  function openSaveDialogForRemix(orig) {
    const bg = document.createElement("div");
    bg.className = "auth-modal-bg";
    bg.innerHTML = `
      <div class="auth-modal">
        <strong>Remix of "${escapeHtml(orig.title)}"</strong>
        <input id="btitle" value="${escapeHtml(orig.title)} (remix)" />
        <label style="font-size:12px;color:var(--muted)">
          <input type="checkbox" id="bpublic" checked /> Make public
        </label>
        <div class="err" id="saveerr"></div>
        <div style="display:flex;gap:8px;">
          <button class="btn" id="dosave" style="flex:1">Save remix</button>
          <button class="btn ghost" id="cancelsave" style="flex:1">Just load it</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector("#cancelsave").onclick = close;
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector("#dosave").onclick = async () => {
      if (!(await requireAuth())) return;
      const title = bg.querySelector("#btitle").value.trim() || "Untitled remix";
      const isPublic = bg.querySelector("#bpublic").checked;
      const data = window.BF.serialize.toBeatData(
        window.BF.engine.getActiveBank(), window.BF.engine.getSettings());
      try {
        await window.BF.beats.save({ title, data, isPublic, remixOf: orig.id });
        close();
      } catch (e) { bg.querySelector("#saveerr").textContent = e.message; }
    };
  }

  document.getElementById("galleryBtn").onclick = openGallery;

  // init
  if (auth.enabled) {
    auth.onChange(renderBar);
    auth.currentUser().then(renderBar);
  } else {
    renderBar(null);
  }

  async function loadFromUrl() {
    const id = new URLSearchParams(location.search).get("beat");
    if (!id || !auth.enabled) return;
    const beat = await window.BF.beats.byId(id);
    if (beat) loadBeatIntoGrid(beat);
  }
  loadFromUrl();

  window.BF.ui = { renderBar, openAuthModal, openMyBeats, openGallery, loadBeatIntoGrid, closePanel, copyShare, escapeHtml };
})();
