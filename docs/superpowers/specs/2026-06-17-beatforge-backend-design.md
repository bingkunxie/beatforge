# Beatforge Backend — Save & Share Design

**Date:** 2026-06-17
**Status:** Approved (design); pending implementation plan

## Goal

Add a backend so users can sign in, save their creations, share them via link,
and browse a public gallery of community beats — without breaking the existing
offline-first sequencer.

## Scope

- **Auth:** email+password **and** Google OAuth (both enabled, user picks either).
- **Save unit:** one *beat* = a single pattern (the active bank): the 8 tracks'
  steps plus `bpm`, `swing`, `kit`, and `steps` count.
- **Gallery v1 features:** browse + play, likes, remix/fork, public/private toggle.

## Non-goals (v1)

- No comments, no following/feeds-by-user, no playlists.
- No custom server/API layer or edge functions.
- No migration of existing localStorage data into accounts (localStorage stays
  as the no-account default).

## Architecture

**Direct client-to-Supabase, no custom server.** The static frontend stays on
GitHub Pages and talks to Supabase through the `supabase-js` client. Access
control is enforced by Postgres **Row Level Security (RLS)**, not an API tier.

Rationale: this is the pattern Supabase is designed for — least code, no extra
deploy target. An edge-function/API layer was considered and rejected: it adds a
deploy surface and buys nothing for this data model.

### Config

A `config.js` holds the Supabase **project URL** and **anon key**. Both are safe
to expose in client code; RLS is what protects data. `config.js` is committed
with placeholder values and documented in the README.

## Data model

### `profiles`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | references `auth.users.id` |
| `display_name` | text | shown in gallery |
| `created_at` | timestamptz | default `now()` |

Row created automatically on signup via a trigger on `auth.users`.

### `beats`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `user_id` | uuid | references `profiles.id` |
| `title` | text | required |
| `data` | jsonb | the pattern: `{ steps, bpm, swing, kit, tracks }` |
| `is_public` | boolean | default `false` |
| `remix_of` | uuid null | references `beats.id`, on delete set null |
| `created_at` | timestamptz | default `now()` |

### `likes`
| column | type | notes |
|---|---|---|
| `beat_id` | uuid | references `beats.id` on delete cascade |
| `user_id` | uuid | references `profiles.id` on delete cascade |
| PK | `(beat_id, user_id)` | one like per user per beat |

Like counts are derived by counting rows (or via a `beats_with_likes` view that
left-joins a count). Sorting "popular" uses that count.

### `data` jsonb shape

```json
{
  "steps": 16,
  "bpm": 120,
  "swing": 0,
  "kit": "classic",
  "tracks": {
    "kick":    { "steps": [true,false,...], "vol": 0.85, "mute": false },
    "snare":   { "steps": [...], "vol": 0.85, "mute": false }
  }
}
```

This mirrors a single bank from the current frontend state.

## Security (RLS policies)

- **beats SELECT:** allowed when `is_public = true` OR `user_id = auth.uid()`.
- **beats INSERT:** allowed when `user_id = auth.uid()`.
- **beats UPDATE/DELETE:** allowed when `user_id = auth.uid()`.
- **likes INSERT/DELETE:** allowed when `user_id = auth.uid()`.
- **likes SELECT:** allowed to all (needed for public counts).
- **profiles SELECT:** allowed to all; UPDATE only own row.

## Frontend additions

- **Auth bar** (top of page): "Sign in" → Google button + email/password form.
  When logged in, shows display name and "Sign out".
- **Save dialog:** title field + public/private toggle. Saves the *active bank*
  as a beat. If editing an existing owned beat, updates it.
- **My Beats panel:** the user's library; load into grid, delete, toggle public,
  copy share link.
- **Gallery view:** feed of public beats with title + author + like count.
  Actions: play, like/unlike (sort by newest or popular), remix.
- **Remix:** loads a public beat into the grid; saving creates a *new* beat with
  `remix_of` set to the original, crediting it.
- **Share link:** `?beat=<id>` loads that beat directly on page load (works for
  any public beat, logged in or not).

## What stays the same

The offline sequencer works with no account; `localStorage` remains the default
local persistence. All account/gallery functionality is purely additive.

## Build order (each slice independently committable & verifiable)

1. Supabase client wiring + `config.js` + schema/RLS SQL (documented).
2. Auth: Google + email/password; auth bar; profile row on signup.
3. Save/load own beats (My Beats panel), private only.
4. Public/private toggle + `?beat=<id>` share link.
5. Gallery browse + play.
6. Likes (+ popular sort).
7. Remix/fork with attribution.

## Open setup steps (user-performed, in browser)

- Create the Supabase project; copy URL + anon key into `config.js`.
- Create a Google Cloud OAuth client; paste client ID/secret into Supabase Auth
  providers; add the GitHub Pages URL + Supabase callback to authorized origins.
- Run the schema/RLS SQL (provided) in the Supabase SQL editor.
