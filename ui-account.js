/* ui-account.js — account & gallery UI. window.BF.ui */
(() => {
  "use strict";
  window.BF = window.BF || {};
  const auth = window.BF.auth;
  const bar = document.getElementById("authBar");

  function renderBar(user) {
    if (!auth.enabled) { bar.innerHTML = `<span class="who">offline mode</span>`; return; }
    if (user) {
      bar.innerHTML = `<span class="who">● ${user.email || "signed in"}</span>
        <button class="btn ghost" id="btnSignOut">Sign out</button>`;
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

  // init
  if (auth.enabled) auth.onChange(renderBar);
  auth.currentUser().then(renderBar);

  window.BF.ui = { renderBar, openAuthModal };
})();
