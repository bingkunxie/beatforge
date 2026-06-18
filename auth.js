/* auth.js — Supabase auth wrapper. window.BF.auth */
(() => {
  "use strict";
  window.BF = window.BF || {};
  const cfg = window.BF_CONFIG || {};
  const enabled = cfg.url && !cfg.url.includes("YOUR-PROJECT");
  let client = null;
  const listeners = [];

  if (enabled && window.supabase) {
    client = window.supabase.createClient(cfg.url, cfg.anonKey);
    client.auth.onAuthStateChange((_e, session) => emit(session?.user || null));
  }

  function emit(user) { listeners.forEach((fn) => fn(user)); }
  const notConfigured = { error: { message: "Auth not configured." } };

  const auth = {
    enabled,
    client: () => client,
    onChange(fn) { listeners.push(fn); },
    async currentUser() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data.user || null;
    },
    async signUpEmail(email, password) {
      if (!client) return notConfigured;
      return client.auth.signUp({ email, password });
    },
    async signInEmail(email, password) {
      if (!client) return notConfigured;
      return client.auth.signInWithPassword({ email, password });
    },
    async signInGoogle() {
      if (!client) return notConfigured;
      return client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    },
    async signOut() {
      if (!client) return notConfigured;
      return client.auth.signOut();
    },
  };

  window.BF.auth = auth;
})();
