# Beatforge Backend (Save & Share) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase-backed accounts so users can save single-pattern "beats," share them by link, and browse/like/remix a public gallery — without breaking the offline sequencer.

**Architecture:** Static frontend (GitHub Pages) talks directly to Supabase via the `supabase-js` UMD client loaded from CDN. Postgres Row Level Security enforces all access rules; there is no custom server. New behavior is added as small global-namespace modules (`window.BF.*`) loaded with `<script>` tags, preserving the no-build setup. `app.js` exposes an engine API so backend modules can read/write the active pattern bank.

**Tech Stack:** Vanilla JS (ES2020), Supabase (Postgres + Auth + RLS), `@supabase/supabase-js` v2 UMD, Node built-in test runner for pure-logic unit tests.

---

## File Structure

**Create:**
- `config.js` — `window.BF_CONFIG = { url, anonKey }` (committed with placeholders)
- `supabase-schema.sql` — schema + RLS, run once in the Supabase SQL editor
- `serialize.js` — pure functions: active-bank ⇄ beat `data`, share encode/decode (UMD: works in browser + Node)
- `auth.js` — `window.BF.auth`: client init, sign in/up/out, session, profile bootstrap
- `beats.js` — `window.BF.beats`: CRUD beats, likes, remix, fetch gallery/mine, load by id
- `ui-account.js` — `window.BF.ui`: auth bar, save dialog, My Beats panel, gallery view
- `tests/serialize.test.js` — Node unit tests for `serialize.js`
- `SETUP.md` — user-performed Supabase/Google setup steps

**Modify:**
- `app.js` — expose `window.BF.engine = { getActiveBank, setActiveBank, getSettings, setSettings, refresh }`
- `index.html` — add CDN script, module `<script>` tags, and container elements
- `style.css` — styles for auth bar, dialog, panels, gallery
- `README.md` — link to SETUP.md and feature list

**Engine API contract** (implemented in Task 2, consumed everywhere after):
- `getActiveBank()` → `{ kick: {steps:boolean[32], vol:number, mute:boolean}, ... }` (deep copy of current bank's `tracks`)
- `getSettings()` → `{ steps:number, bpm:number, swing:number, kit:string }`
- `setActiveBank(tracks)` → replaces the current bank's tracks (deep copy in), then re-renders
- `setSettings({steps,bpm,swing,kit})` → applies settings, syncs controls, re-renders
- `refresh()` → rebuilds the grid/bank UI from state

---

## Task 1: Pure serialization logic (TDD)

**Files:**
- Create: `serialize.js`
- Test: `tests/serialize.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/serialize.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const S = require("../serialize.js");

const sampleBank = {
  kick:  { steps: [true, false, false, false], vol: 0.85, mute: false },
  snare: { steps: [false, false, true, false], vol: 0.7,  mute: true  },
};
const sampleSettings = { steps: 4, bpm: 128, swing: 10, kit: "tr808" };

test("toBeatData bundles settings + tracks", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  assert.strictEqual(d.bpm, 128);
  assert.strictEqual(d.steps, 4);
  assert.strictEqual(d.kit, "tr808");
  assert.deepStrictEqual(d.tracks.kick.steps, [true, false, false, false]);
});

test("toBeatData deep-copies (no shared refs)", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  d.tracks.kick.steps[0] = false;
  assert.strictEqual(sampleBank.kick.steps[0], true);
});

test("fromBeatData splits back into {tracks, settings}", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  const { tracks, settings } = S.fromBeatData(d);
  assert.deepStrictEqual(settings, sampleSettings);
  assert.deepStrictEqual(tracks.snare.steps, [false, false, true, false]);
});

test("encode/decode round-trips share string", () => {
  const d = S.toBeatData(sampleBank, sampleSettings);
  const str = S.encodeShare(d);
  assert.strictEqual(typeof str, "string");
  assert.deepStrictEqual(S.decodeShare(str), d);
});

test("decodeShare returns null on garbage", () => {
  assert.strictEqual(S.decodeShare("!!!not-base64!!!"), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module '../serialize.js'`

- [ ] **Step 3: Implement `serialize.js`**

```js
/* serialize.js — pure pattern/share helpers. UMD: browser + Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BF = root.BF || {}; root.BF.serialize = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function toBeatData(tracks, settings) {
    return {
      steps: settings.steps,
      bpm: settings.bpm,
      swing: settings.swing,
      kit: settings.kit,
      tracks: clone(tracks),
    };
  }

  function fromBeatData(data) {
    return {
      tracks: clone(data.tracks),
      settings: { steps: data.steps, bpm: data.bpm, swing: data.swing, kit: data.kit },
    };
  }

  // base64 of JSON, URL-safe. Browser uses btoa/atob; Node uses Buffer.
  function b64encode(s) {
    if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(s)));
    return Buffer.from(s, "utf8").toString("base64");
  }
  function b64decode(s) {
    if (typeof atob === "function") return decodeURIComponent(escape(atob(s)));
    return Buffer.from(s, "base64").toString("utf8");
  }

  function encodeShare(data) {
    return b64encode(JSON.stringify(data)).replace(/\+/g, "-").replace(/\//g, "_");
  }
  function decodeShare(str) {
    try {
      const b = str.replace(/-/g, "+").replace(/_/g, "/");
      const obj = JSON.parse(b64decode(b));
      if (!obj || typeof obj !== "object" || !obj.tracks) return null;
      return obj;
    } catch { return null; }
  }

  return { toBeatData, fromBeatData, encodeShare, decodeShare };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 5 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
git add serialize.js tests/serialize.test.js
git commit -m "Add pure serialization + share-encoding helpers with tests"
```

---

## Task 2: Expose engine API from app.js

**Files:**
- Modify: `app.js` (inside the existing IIFE, before the `init` section)

- [ ] **Step 1: Add the engine API near the end of the IIFE**

In `app.js`, immediately before the `// ---------- init ----------` block, add:

```js
  // ---------- engine API (consumed by backend modules) ----------
  function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

  window.BF = window.BF || {};
  window.BF.engine = {
    getActiveBank() { return deepCopy(pat().tracks); },
    getSettings() {
      return { steps: state.steps, bpm: state.bpm, swing: state.swing, kit: state.kit };
    },
    setActiveBank(tracks) {
      pat().tracks = deepCopy(tracks);
      buildGrid();
    },
    setSettings(s) {
      if (s.steps) { state.steps = +s.steps; $("#steps").value = state.steps; }
      if (s.bpm)   { state.bpm = +s.bpm; $("#bpm").value = state.bpm; }
      if (s.swing != null) { state.swing = +s.swing; $("#swing").value = state.swing; $("#swingVal").textContent = state.swing + "%"; }
      if (s.kit)   setKit(s.kit);
      buildGrid();
    },
    refresh() { buildBank(); buildGrid(); },
  };
```

- [ ] **Step 2: Verify in the preview that the API is live**

Start the preview server (`beatforge`) if not running, then eval:

```js
JSON.stringify(Object.keys(window.BF.engine))
```

Expected: `["getActiveBank","getSettings","setActiveBank","setSettings","refresh"]`

- [ ] **Step 3: Verify round-trip through the engine works**

Eval:

```js
(() => {
  const b = window.BF.engine.getActiveBank();
  b.kick.steps[1] = true;
  window.BF.engine.setActiveBank(b);
  return document.querySelector('.cell[data-track="kick"][data-idx="1"]').classList.contains('on');
})()
```

Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "Expose engine API for backend modules to read/write the active bank"
```

---

## Task 3: Supabase setup docs + schema SQL + config

**Files:**
- Create: `supabase-schema.sql`
- Create: `config.js`
- Create: `SETUP.md`

- [ ] **Step 1: Write `supabase-schema.sql`**

```sql
-- Beatforge schema + RLS. Run in Supabase SQL editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists beats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  data jsonb not null,
  is_public boolean not null default false,
  remix_of uuid references beats(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists beats_public_idx on beats (is_public, created_at desc);
create index if not exists beats_user_idx on beats (user_id, created_at desc);

create table if not exists likes (
  beat_id uuid references beats(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (beat_id, user_id)
);

-- Auto-create a profile row when a user signs up.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- View exposing like counts for sorting.
-- security_invoker = true: the view respects the querying user's RLS so private
-- beats stay hidden (without it, views run as owner and bypass RLS).
create or replace view beats_with_likes
  with (security_invoker = true)
as
  select b.*, coalesce(l.cnt, 0) as like_count, p.display_name as author
  from beats b
  left join profiles p on p.id = b.user_id
  left join (select beat_id, count(*) cnt from likes group by beat_id) l
    on l.beat_id = b.id;

-- RLS
alter table profiles enable row level security;
alter table beats enable row level security;
alter table likes enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "profiles update own" on profiles for update using (auth.uid() = id);

create policy "beats read public or own" on beats for select
  using (is_public or auth.uid() = user_id);
create policy "beats insert own" on beats for insert
  with check (auth.uid() = user_id);
create policy "beats update own" on beats for update using (auth.uid() = user_id);
create policy "beats delete own" on beats for delete using (auth.uid() = user_id);

create policy "likes readable" on likes for select using (true);
create policy "likes insert own" on likes for insert with check (auth.uid() = user_id);
create policy "likes delete own" on likes for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Write `config.js` (placeholders)**

```js
/* Replace with your Supabase project values (Settings → API).
   Both are safe to expose in client code; RLS protects data. */
window.BF_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-KEY",
};
```

- [ ] **Step 3: Write `SETUP.md`**

````markdown
# Beatforge backend setup

1. **Create a Supabase project** at supabase.com (free tier).
2. **Run the schema:** open SQL Editor → paste `supabase-schema.sql` → Run.
3. **Get API keys:** Settings → API. Copy the Project URL and the `anon` public
   key into `config.js`.
4. **Enable email auth:** Authentication → Providers → Email → enabled.
5. **Enable Google auth (optional):**
   - In Google Cloud Console, create an OAuth 2.0 Client (Web application).
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   - Copy the Client ID + Secret into Supabase → Authentication → Providers → Google.
6. **Allowed redirect URLs:** Authentication → URL Configuration → add your site
   origin (e.g. `https://bingkunxie.github.io` and `http://localhost:4173`).

Accounts require the site to be served over http(s) (GitHub Pages or a local
server); the offline sequencer still works from `file://` without an account.
````

- [ ] **Step 4: Commit**

```bash
git add supabase-schema.sql config.js SETUP.md
git commit -m "Add Supabase schema, RLS, config placeholders, and setup docs"
```

---

## Task 4: Auth module + auth bar UI

**Files:**
- Create: `auth.js`
- Modify: `index.html` (load CDN client + new scripts; add auth bar container)
- Modify: `style.css` (auth bar styles)

- [ ] **Step 1: Add scripts + auth bar container to `index.html`**

In `<head>` after the stylesheet link — nothing needed. Before `</body>`, replace
the single `<script src="app.js"></script>` line with:

```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="config.js"></script>
  <script src="serialize.js"></script>
  <script src="app.js"></script>
  <script src="auth.js"></script>
  <script src="beats.js"></script>
  <script src="ui-account.js"></script>
```

Inside `<header class="topbar">`, as the first child, add the auth bar mount:

```html
      <div id="authBar" class="authbar"></div>
```

- [ ] **Step 2: Implement `auth.js`**

```js
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
      return client.auth.signUp({ email, password });
    },
    async signInEmail(email, password) {
      return client.auth.signInWithPassword({ email, password });
    },
    async signInGoogle() {
      return client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    },
    async signOut() { return client.auth.signOut(); },
  };

  window.BF.auth = auth;
})();
```

- [ ] **Step 3: Add auth bar styles to `style.css`**

```css
.authbar { display:flex; align-items:center; gap:8px; width:100%; order:-1; justify-content:flex-end; font-size:12px; }
.authbar .who { color: var(--accent2); }
.auth-modal-bg { position:fixed; inset:0; background:#000a; display:grid; place-items:center; z-index:50; }
.auth-modal { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:22px; width:300px; display:flex; flex-direction:column; gap:10px; }
.auth-modal input { background:var(--bg); border:1px solid var(--line); color:var(--txt); border-radius:8px; padding:9px; font-family:inherit; }
.auth-modal .err { color:var(--accent); font-size:11px; min-height:14px; }
.auth-modal .google { background:#fff; color:#222; border:none; border-radius:8px; padding:9px; cursor:pointer; font-family:inherit; font-weight:600; }
```

- [ ] **Step 4: Render the auth bar (temporary inline bootstrap in `ui-account.js` placeholder)**

Create `ui-account.js` with the auth-bar renderer (the rest of the UI is added in later tasks):

```js
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
```

- [ ] **Step 5: Verify the auth bar renders in offline mode**

With placeholder `config.js`, reload preview and eval:

```js
document.getElementById("authBar").textContent.trim()
```

Expected: `offline mode` (because config still has the placeholder URL — proves the guard works and nothing throws).

Also confirm no console errors: check `preview_console_logs` level `error` → none.

- [ ] **Step 6: Commit**

```bash
git add index.html auth.js ui-account.js style.css
git commit -m "Add auth module and auth bar UI (Google + email/password)"
```

---

## Task 5: Beats data layer

**Files:**
- Create: `beats.js`

- [ ] **Step 1: Implement `beats.js`**

```js
/* beats.js — data access for beats & likes. window.BF.beats */
(() => {
  "use strict";
  window.BF = window.BF || {};
  const auth = window.BF.auth;
  const c = () => auth.client();

  async function uid() { return (await auth.currentUser())?.id || null; }

  const beats = {
    async save({ title, data, isPublic, remixOf = null }) {
      const user_id = await uid();
      if (!user_id) throw new Error("Not signed in");
      const row = { user_id, title, data, is_public: !!isPublic, remix_of: remixOf };
      const { data: out, error } = await c().from("beats").insert(row).select().single();
      if (error) throw error;
      return out;
    },
    async update(id, patch) {
      const { data, error } = await c().from("beats").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await c().from("beats").delete().eq("id", id);
      if (error) throw error;
    },
    async mine() {
      const user_id = await uid();
      if (!user_id) return [];
      const { data, error } = await c().from("beats")
        .select("*").eq("user_id", user_id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async gallery({ sort = "new", limit = 50 } = {}) {
      let q = c().from("beats_with_likes").select("*").eq("is_public", true).limit(limit);
      q = sort === "popular"
        ? q.order("like_count", { ascending: false })
        : q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async byId(id) {
      const { data, error } = await c().from("beats").select("*").eq("id", id).single();
      if (error) return null;
      return data;
    },
    async like(beatId) {
      const user_id = await uid();
      if (!user_id) throw new Error("Not signed in");
      const { error } = await c().from("likes").insert({ beat_id: beatId, user_id });
      if (error && error.code !== "23505") throw error; // ignore duplicate
    },
    async unlike(beatId) {
      const user_id = await uid();
      if (!user_id) return;
      const { error } = await c().from("likes").delete().eq("beat_id", beatId).eq("user_id", user_id);
      if (error) throw error;
    },
    async likedByMe(beatIds) {
      const user_id = await uid();
      if (!user_id || !beatIds.length) return new Set();
      const { data } = await c().from("likes").select("beat_id").eq("user_id", user_id).in("beat_id", beatIds);
      return new Set((data || []).map((r) => r.beat_id));
    },
  };

  window.BF.beats = beats;
})();
```

- [ ] **Step 2: Verify it loads without throwing**

Reload preview, eval:

```js
JSON.stringify(Object.keys(window.BF.beats))
```

Expected: array containing `save`, `update`, `remove`, `mine`, `gallery`, `byId`, `like`, `unlike`, `likedByMe`.

Check `preview_console_logs` level `error` → none.

- [ ] **Step 3: Commit**

```bash
git add beats.js
git commit -m "Add beats/likes data-access layer"
```

---

## Task 6: Save dialog + My Beats panel

**Files:**
- Modify: `index.html` (toolbar buttons + panel container)
- Modify: `ui-account.js` (save dialog, My Beats panel)
- Modify: `style.css` (panel/dialog styles)

- [ ] **Step 1: Add buttons + panel mount to `index.html`**

In `<footer class="toolbar">`, inside `.group.buttons`, add after the existing
Load button:

```html
        <button id="cloudSave" class="btn ghost">☁ Save</button>
        <button id="myBeats" class="btn ghost">My Beats</button>
        <button id="galleryBtn" class="btn ghost">Gallery</button>
```

Before `</div>` closing `.app`, add a panel overlay mount:

```html
    <div id="panel" class="panel hidden"></div>
```

- [ ] **Step 2: Add styles to `style.css`**

```css
.panel { position:fixed; top:0; right:0; height:100vh; width:380px; max-width:92vw;
  background:var(--panel); border-left:1px solid var(--line); box-shadow:-12px 0 40px #0008;
  z-index:40; padding:18px; overflow-y:auto; transform:translateX(0); }
.panel.hidden { display:none; }
.panel h2 { font-size:14px; letter-spacing:2px; margin-bottom:12px; display:flex; justify-content:space-between; }
.panel .close { cursor:pointer; color:var(--muted); background:none; border:none; font-size:18px; }
.beat-card { border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:10px; background:var(--panel2); }
.beat-card .t { font-size:13px; color:var(--txt); }
.beat-card .meta { font-size:11px; color:var(--muted); margin:4px 0 8px; }
.beat-card .acts { display:flex; gap:6px; flex-wrap:wrap; }
.beat-card .acts .btn { padding:6px 10px; font-size:11px; }
.tabs { display:flex; gap:6px; margin-bottom:12px; }
.tabs button.active { background:var(--accent2); color:#08121a; }
.like.on { color:var(--accent); border-color:var(--accent); }
```

- [ ] **Step 3: Add save dialog + My Beats to `ui-account.js`**

Append inside the IIFE (before the `window.BF.ui = ...` line; then extend that
export). Add:

```js
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

  function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
  function copyShare(id) {
    const url = location.origin + location.pathname + "?beat=" + id;
    navigator.clipboard.writeText(url);
  }

  document.getElementById("cloudSave").onclick = async () => { if (await requireAuth()) openSaveDialog(); };
  document.getElementById("myBeats").onclick = openMyBeats;
```

Update the export line to:

```js
  window.BF.ui = { renderBar, openAuthModal, openMyBeats, loadBeatIntoGrid, closePanel, copyShare, escapeHtml };
```

- [ ] **Step 4: Verify UI wires up (offline guard) in preview**

Reload preview. Eval:

```js
(() => { document.getElementById("cloudSave").click(); return "clicked"; })()
```

In offline mode this triggers the `requireAuth()` alert path. Since `alert` can't
be asserted easily, instead verify the buttons exist and panel toggles:

```js
(() => {
  window.BF.ui.openMyBeats; // exists
  return [!!document.getElementById("cloudSave"), !!document.getElementById("myBeats"), !!document.getElementById("panel")].join(",");
})()
```

Expected: `true,true,true`. Check console errors → none.

- [ ] **Step 5: Commit**

```bash
git add index.html ui-account.js style.css
git commit -m "Add cloud save dialog and My Beats panel"
```

---

## Task 7: Share-link loading on page load

**Files:**
- Modify: `ui-account.js` (read `?beat=<id>` on init)

- [ ] **Step 1: Add share-load on init**

In `ui-account.js`, in the init section at the bottom (before the export), add:

```js
  async function loadFromUrl() {
    const id = new URLSearchParams(location.search).get("beat");
    if (!id || !auth.enabled) return;
    const beat = await window.BF.beats.byId(id);
    if (beat) loadBeatIntoGrid(beat);
  }
  loadFromUrl();
```

- [ ] **Step 2: Verify no errors when no `?beat` param**

Reload preview (no query param). Check `preview_console_logs` level `error` → none.
Eval to confirm function defined:

```js
typeof new URLSearchParams(location.search).get
```

Expected: `"function"` (sanity; the loader is a no-op without a real Supabase config + id).

- [ ] **Step 3: Commit**

```bash
git add ui-account.js
git commit -m "Load a shared beat from ?beat=<id> on page load"
```

---

## Task 8: Gallery with likes and remix

**Files:**
- Modify: `ui-account.js` (gallery view, like toggle, remix)

- [ ] **Step 1: Add gallery to `ui-account.js`**

Append (before the export), and wire the Gallery button:

```js
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
        <div class="meta">♥ <span class="cnt">${b.like_count}</span></div>
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
        try {
          if (on) { await window.BF.beats.unlike(b.id); cnt.textContent = +cnt.textContent - 1; }
          else { await window.BF.beats.like(b.id); cnt.textContent = +cnt.textContent + 1; }
          on = !on;
          likeBtn.classList.toggle("on", on);
          likeBtn.textContent = on ? "♥ Liked" : "♥ Like";
        } catch (e) { alert(e.message); }
      };
      list.appendChild(card);
    });
  }

  // Remix: load into grid, then opening Save will create a new beat crediting origin.
  let pendingRemixOf = null;
  function startRemix(beat) {
    loadBeatIntoGrid(beat);
    pendingRemixOf = beat.id;
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
    const close = () => { bg.remove(); pendingRemixOf = null; };
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
```

Update the export to include the new functions:

```js
  window.BF.ui = { renderBar, openAuthModal, openMyBeats, openGallery, loadBeatIntoGrid, closePanel, copyShare, escapeHtml };
```

- [ ] **Step 2: Verify gallery button + functions exist (offline guard)**

Reload preview. Eval:

```js
[typeof window.BF.ui.openGallery, !!document.getElementById("galleryBtn")].join(",")
```

Expected: `function,true`. Check console errors → none.

- [ ] **Step 3: Commit**

```bash
git add ui-account.js
git commit -m "Add public gallery with likes and remix/fork"
```

---

## Task 9: Live integration verification (requires real Supabase project)

**Files:** none (manual verification once `config.js` has real values)

> This task is the end-to-end check. It can only fully pass after the user
> completes `SETUP.md` and fills in `config.js`. Until then, Tasks 1–8 are
> verified individually (logic via `node --test`, UI wiring via preview without
> throwing). Record results here when run.

- [ ] **Step 1:** Fill `config.js` with real project URL + anon key; run `supabase-schema.sql`.
- [ ] **Step 2:** Serve over http (preview server). Sign up with email/password; confirm the auth bar shows the user and a `profiles` row exists.
- [ ] **Step 3:** Create a pattern, ☁ Save as private. Confirm it appears in My Beats; reload → still listed.
- [ ] **Step 4:** Toggle public; open Gallery → it appears. Copy link, open in a private window (logged out) → loads via `?beat=<id>`.
- [ ] **Step 5:** From a second account, Like it (count increments, persists on reload) and Remix it (new beat with `remix_of` set; verify in Supabase table).
- [ ] **Step 6:** Verify RLS: while logged out, confirm a private beat's id does NOT load.
- [ ] **Step 7:** Commit any fixes found during integration.

---

## Self-Review Notes

- **Spec coverage:** auth (email+Google) → Task 4; single-pattern save unit → Tasks 1,6; public/private → Task 6; share link → Task 7; gallery browse+play → Task 8; likes → Task 8; remix → Task 8; RLS → Task 3; offline-still-works guard (`auth.enabled`) → Tasks 4,6,8. All spec sections mapped.
- **Naming consistency:** engine API (`getActiveBank/setActiveBank/getSettings/setSettings/refresh`), `serialize.{toBeatData,fromBeatData,encodeShare,decodeShare}`, `beats.{save,update,remove,mine,gallery,byId,like,unlike,likedByMe}` used consistently across tasks.
- **Known constraint:** accounts require http(s) origin + completed Supabase setup; the offline sequencer is unaffected (`auth.enabled` is false with placeholder config, so all account UI degrades to "offline mode" without errors).
