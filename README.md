[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kantousazin/palm-city-heist/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kantousazin/palm-city-heist/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Palm City Heist

A top-down open-world crime game set in **Palmera City**, a sun-soaked coastal
city of palm trees, neon and bad decisions. You are **Ren Solano**, an
ex-delivery driver who takes a chain of jobs from Mara "the Fixer": a simple
delivery, a borrowed car, a marina drop, a full-scale police escape, a turf
fight with the Neon Wolves, and one last score — the Palm City Bank heist.

Everything is original and drawn in code: no libraries, no assets, no network.
Plain Canvas + ES modules.

## What's in the city

- **Four-plus districts** — Downtown towers, the Marina with docks and boats,
  the Neon Strip with glowing club signs, Palm Heights suburbs, Solana Beach.
- **Drive anything** — parked and moving cars can be entered and stolen; cars
  accelerate, drift on the handbrake, collide and smoke when wrecked.
- **Living traffic** — civilian cars follow lanes, stop at traffic lights,
  brake for you and honk when you block them. Pedestrians stroll, chat and
  flee screaming from danger.
- **Wanted system** — crime raises up to five stars; Palm City PD patrols
  spawn, chase and ram you. Break line of sight to cool off, or get busted /
  wasted and wake up at Palm General, poorer.
- **Combat** — mouse-aimed pistol on foot; the Neon Wolves shoot back.
- **Six-mission story** with dialogue, cash rewards and a changing city,
  plus free roam after the finale.
- **HUD & minimap** — health, cash, wanted stars, mission banner, district
  cards and a live minimap with traffic, police and the objective marker.
- **Day cycle** — morning glare, golden dusk, and a neon-lit night.
- **Synthesised sound** — engine, sirens, gunshots, honks and reward jingles
  are all WebAudio; there are no audio files.
- **Saves** — progress and money persist in `localStorage`.

## Play it

```
node serve.ts
```

then open http://localhost:8080 in a desktop browser. Press ENTER to start
(N for a new game when a save exists).

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| SHIFT | Sprint on foot |
| SPACE | Handbrake (drift) |
| E | Enter / exit car |
| Mouse | Aim |
| Click | Shoot (on foot) |
| ENTER | Advance dialogue |

## Layout

- `main.ts` — hands the entry in: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library.
- `game/src/` — the game, one job per file: `world-city.js` (city generation),
  `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `player.js`,
  `combat.js`, `missions.js`, `story.js`, `hud-minimap.js`, `audio-synth.js`,
  `particles.js`, `camera.js`, `save-game.js`, `main.js` (engine & rendering).
- `screenshots/` — four real renders of the game (cover, police chase,
  on-foot gang fight, neon night), staged with the game's own deterministic
  `?shot=<name>&seed=1` scenes and captured headlessly.
