# Beatforge

**Live: https://bingkunxie.github.io/beatforge/**

A browser-based step sequencer / drum machine. No dependencies, no build step. Every sound is synthesized live with the Web Audio API, so it works fully offline.

## Features

- **8 synthesized instruments** — kick, snare, clap, closed/open hat, tom, rim, bass
- **16-step grid** (switchable to 8 or 32 steps), with per-track volume + mute
- **BPM, swing, and master volume**; 3 kits — Classic, 808, Lo-fi
- **4 pattern banks** (A–D) and **Randomize**
- **Autosave** — your session is restored automatically on reload; **Export/Import** a `.json` kit
- **Optional accounts** — sign in (Google or email/password) to save beats, share via link, and browse a public gallery with likes and remix

## Keyboard

- `Space` — play / stop
- `1`–`4` — switch pattern bank

## Run

Open `index.html` in any browser, or serve the folder (`python3 -m http.server`).

The accounts/gallery features need a Supabase backend — see [SETUP.md](SETUP.md). Without one, the app runs in offline mode and the sequencer works exactly the same.
