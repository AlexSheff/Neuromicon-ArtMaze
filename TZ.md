# TZ — Real Nebula Skies, Lighting & Visuals, Volume Control, Pause

> Technical specification for AI agents and contributors. Read with `AGENTS.md` and `EXPERIENCE_PROTOCOL.md`.
> Where this file and those conflict on performance or comfort, the stricter rule wins.

## 0. Review basis (read this first)

- **Reviewed:** repository root, `README.md`, `GAME_PROJECT_PLAN.md`, file tree.
- **R0 Audit deliverable:** `docs/audit-2026-10-08.md` (exact file paths, line numbers, audio graph, control map, `RoomContext` fields, and baseline Quest 2 measurements).

## 1. Goals

1. Replace the current space/void backdrop with a **real astronomical image per room**: each room has its own nebula (or deep-sky object), plus a shared real star field (`src/systems/sky/nebulaSkySystem.ts`, `content/space/nebulae.json`, `content/space/starfield.json`, `content/space/room-nebulae.json`).
2. Add a **lighting and visual system** driven by each room's nebula (color, mood, reflections, glow), within Quest 2 budgets (`<= 2` real-time lights, `0` real-time shadows, `<= 5` sky draw calls, `<= 32 MB` sky GPU memory).
3. Add **volume control** (`master` / `music` / `ambient` / `sfx`, `mute`) usable on desktop (`Z`, `M`, `[` / `]`) **and in VR** (world-locked 3D panel), persisted in `PlayerState.audio` (`src/systems/audio/mixer.ts`, `src/state/playerState.ts`).
4. Add a real **pause**: freezes game time (`gameDt = 0`) and room logic (`onPause` / `onResume`), pauses audio (`150 ms` ramp + `AudioContext.suspend()`), and **never freezes head tracking** (`P` / `Esc` / VR Controller B/Y Menu button).
5. Preserve all budgets and comfort rules from `AGENTS.md` / `EXPERIENCE_PROTOCOL.md`.

**Non-goals:** AI-generated nebulae in this layer (real observatory imagery only, credited in `CREDITS.md`); new gameplay; post-processing in XR.

---

## 2. Space & Nebula Layer Model (`src/systems/sky/nebulaSkySystem.ts`)

| Layer | Content | Rendering | Budget |
|---|---|---|---|
| **L0 Star field** | Real all-sky equirectangular star map (`content/space/starfield.json`, shared by all rooms) | Inverted sphere, `MeshBasicMaterial`, `depthWrite: false`, rotated per room seed | 1× `2048×1024` POT texture (~2.7 MB), 1 draw call |
| **L1 Nebula** | Room's real astronomical nebula (`content/space/nebulae.json`, 25 curated NASA/ESA/Webb/Hubble objects) | Curved spherical cap (`74° × 54°` FOV — never stretched 360°!) with radial alpha feather mask, `MeshBasicMaterial`, `transparent: true`, `depthWrite: false` | 1× `1024×1024` POT texture (~2.6 MB), 1 draw call |
| **L2 Dust / parallax** | 3-color palette-driven cosmic dust motes | `THREE.Points` with additive blending | 1 draw call |
| **L3 Twinkle** | Subtle star scintillation (`desktop-high` quality tier only) | `THREE.Points` | 0–1 draw call |

- **Vection guard:** Optional sky drift (`<= 0.2°/s`) is strictly **off** in Reduced Motion, Seated mode, and while Paused.

---

## 3. Palette-Driven Lighting Rig (`TZ.md` §4)

- **Light 1 — Hemisphere (`HemisphereLight`):** Sky color = nebula `palette[0]` desaturated 28%; ground color = dark complement at 0.32× luminance.
- **Light 2 — Directional Key (`DirectionalLight`):** Direction aligned with the L1 Nebula Cap center (`rotation`), color = `palette[1]`, `castShadow = false`.
- **Fog (`THREE.FogExp2`):** Tinted to `palette[0] * 0.11`, low density (`0.011`) so the first 8–10 m and overhead nebula cap remain crisp.
- **Environment Cubemap:** Low-res `64×64` per-face cubemap generated from `palette` in `< 1.5 ms` at room mount (`scene.environment`) for hero mirror, frames, and reflective pools.

---

## 4. Audio Bus Mixer & Perceptual Volume (`src/systems/audio/mixer.ts`)

```text
sources -> [music bus]   -\
sources -> [ambient bus] --> [master gain] -> [limiter (DynamicsCompressorNode)] -> destination
sources -> [sfx bus]     -/
```

- **Perceptual Curve:** Slider `v ∈ [0, 1]` maps to linear gain `g = v²` (`sliderToPerceptualGain`), applied via `GainNode.gain.setTargetAtTime(g, ctx.currentTime, 0.04)` (~40 ms time constant, zero clicks/pops).
- **Persistence:** Stored in `PlayerState.audio` (`version: 4` schema with automatic migration from `v1`/`v2`/`v3`) and applied before the first sound plays.

---

## 5. Real Pause System (`src/engine/hubEngine.ts`)

- **Desktop:** `P` or `Escape` toggles Pause; `M` toggles Mute; `[` / `]` adjusts Master Volume `-5%` / `+5%`; `Z` toggles the 4-Bus Audio Mixer drawer.
- **VR:** Controller `B` / `Y` Menu button (`buttons[5]`) or top-right `⏸` button spawns a **world-locked 3D Pause & Audio Mixer Panel** at `1.68 m` in front of the player's gaze.
- **Auto-Pause:** Automatically pauses on `document.visibilitychange` (`hidden`) and WebXR `visibilitychange` (`visible-blurred`), remaining paused with the Resume button visible upon return.
