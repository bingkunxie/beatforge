# Beatforge

A browser-based step sequencer / drum machine. No dependencies, no build step — just open `index.html`.

Every sound is synthesized live with the Web Audio API (oscillators + filtered noise), so it works fully offline.

## Features

- **8 synthesized instruments** — kick, snare, clap, closed/open hat, tom, rim, bass
- **16-step grid** (switchable to 8 or 32 steps); click cells to toggle, and they audition as you place them
- **Tight scheduler** using the lookahead-clock pattern for solid timing
- **BPM, swing, and master volume**, plus per-track volume + mute
- **3 kits** — Classic, 808, Lo-fi
- **4 pattern banks** (A–D) with **Save/Load** to `localStorage`
- **Randomize** with musically-aware density (kicks on the downbeat, snare on the backbeat)

## Keyboard

- `Space` — play / stop
- `1`–`4` — switch pattern bank

## Run

Just open `index.html` in any modern browser. (Or serve the folder, e.g. `python3 -m http.server`.)

## Accounts, sharing & gallery (optional backend)

Beatforge can optionally connect to a [Supabase](https://supabase.com) backend so users can:

- **Sign in** with Google or email/password
- **Save** beats to a personal library (My Beats)
- **Share** any beat via a `?beat=<id>` link
- **Browse a public gallery** — play, like, and remix community beats

This is entirely optional: with no backend configured, the app shows "offline mode"
and the sequencer works exactly as before. The credentials in `config.js` are safe
to expose publicly — data is protected by Postgres Row Level Security.

See [SETUP.md](SETUP.md) to wire up your own Supabase project, and
[docs/superpowers/specs](docs/superpowers/specs) / [docs/superpowers/plans](docs/superpowers/plans)
for the design and implementation plan.
