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
