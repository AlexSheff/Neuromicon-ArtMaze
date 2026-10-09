# TZ — Real Nebula Skies, Lighting & Visuals, Volume Control, Pause

> Technical specification for AI agents and contributors. Read with `AGENTS.md` and `EXPERIENCE_PROTOCOL.md`.
> Where this file and those conflict on performance or comfort, the stricter rule wins.

## 0. Review basis

- **Authoritative Audit:** `docs/audit-2026-10-08.md` (Task R0).
- **Performance & Budget Log:** `docs/perf-log.md`.
- **Space & Astronomical Registry:** `content/space/nebulae.registry.json`, `content/space/room-sky.map.json`, `CREDITS.md`.

## 1. Goals

1. Replace the current space/void backdrop with a **real astronomical image per room**: each room has its own nebula (or deep-sky object), plus a shared real star field.
2. Add a **lighting and visual system** driven by each room's nebula (color, mood, reflections, glow), within Quest 2 budgets.
3. Add **volume control** (master/music/ambient/effects, mute) usable on desktop **and in VR**, persisted.
4. Add a real **pause**: freezes game time and room logic, pauses audio, never freezes head tracking.
5. Preserve all budgets and comfort rules from `AGENTS.md` / `EXPERIENCE_PROTOCOL.md`.

**Non-goals:** AI-generated nebulae in this layer (real imagery only); new gameplay; post-processing in XR.

## 2. Task R0 — Re-audit

Delivered in `docs/audit-2026-10-08.md` with exact file paths, line numbers, audio graph topology, control map, `RoomContext` fields, and baseline GPU/draw-call budgets.

## 3. Space and nebula system (`src/systems/sky/nebulaSkySystem.ts`, `tools/space-assets/pipeline.ts`)

### 3.1 Layer model (per room, per scene)

| Layer | Content | Rendering | Budget |
|---|---|---|---|
| **L0 Star field** | Real all-sky equirectangular star map (`STARFIELD_BESSELL_V1`, shared by all rooms) | Inverted sphere, `MeshBasicMaterial`, `depthWrite:false`, rendered first; rotated per room for variety | `2048×1024`, 1 draw call |
| **L1 Room nebula** | One real astronomical photograph per room (curved spherical cap) | Curved quad (`74°×54°` spherical cap) at radius `R=86m`, `MeshBasicMaterial`, radial alpha feather mask, `depthWrite:false` | `1024×1024` (Quest) / `2048×2048` (desktop), 1 draw call |
| **L2 Parallax dust / bright stars** | 2–3 camera-facing instanced billboards between the room and L1 | Single `InstancedMesh`, additive blend, no per-frame sort | ≤ 1 draw call, ≤ 64 quads |
| **L3 Environment reflection** | Pre-convolved low-res cubemap (`64×64`) generated deterministically from the room's nebula 3-color palette | Assigned to `scene.environment` | < 1.5 ms generation, 0 extra draw calls |

**Total sky cost per room:** **3 draw calls** (≤ 5 budget), **~5.4 MB GPU** (≤ 32 MB budget).

### 3.2 Sources and licensing

Verified public-domain / CC-BY astronomical sources documented in `content/space/nebulae.registry.json` and `CREDITS.md`:
- **NASA / STScI (Hubble, JWST):** Public domain (`PD-USGov-NASA`).
- **ESA / Hubble & ESA / Webb:** `CC-BY-4.0` (`ESA/Hubble`, `ESA/Webb, NASA & CSA`).
- **ESO:** `CC-BY-4.0` (`ESO`).

### 3.3 Registry and 1,149-room mapping

- `content/space/nebulae.registry.json`: 25 real astronomical nebulae (`NEB_0001`..`NEB_0025`) + 1 shared all-sky starfield (`STARFIELD_BESSELL_V1`) with `sourceUrl`, `credit`, `license`, `palette`, `orientation`, and `sha256`.
- `content/space/room-sky.map.json`: maps `THRESHOLD`, `SECTOR_1`, `SECTOR_2`, `SECTOR_3`, `ROOM_001`..`ROOM_025`, and deterministic coverage across `ROOM_0001`..`ROOM_1149`.

### 3.4 Room API v1 Sky & Environment

- `room.json` optional `"sky"` field (`nebulaId`, `rotation`, `intensity`).
- `ctx.sky.current` and `ctx.sky.set(nebulaId, opts)`.
- `ctx.environment.palette` and `ctx.environment.applyRig(root)`.

## 4. Lighting and visual system

- **Palette-driven lighting rig:** 1 `HemisphereLight(palette[0], palette[2], 0.6)` + 1 `DirectionalLight(palette[1], 0.8)` positioned in the direction of the room's L1 nebula cap, **no shadow maps**.
- **Maximum 2 real-time lights** in the entire scene at any time.
- **Distance fog:** `THREE.FogExp2(palette[2], density)` seamlessly matching L0 dark sky tone.
- **Quality tiers (`src/state/playerState.ts`):** `auto` | `quest` | `desktop-low` | `desktop-high`, persisted and switchable in Comfort settings.

## 5. Volume control and audio architecture (`src/systems/audio/mixer.ts`)

```
[room music / MP3]   → musicBus   ─┐
[corridor / drone]   → ambientBus ─┼→ masterBus → limiter (DynamicsCompressorNode) → destination
[doors / UI / quest] → sfxBus     ─┤
[radio / voice]      → voiceBus   ─┘
```

- **Perceptual curve:** `gain = Math.pow(slider, 2)` (`0..1` → `-∞..0 dB`, `0.5` → `-12 dB`).
- **Click-free ramping:** `gainParam.setTargetAtTime(target, ctx.currentTime, 0.04)`.
- **Controls:**
  - Desktop: `Z` drawer (4 sliders + mute), `M` mute toggle, `[` / `]` master volume `-5%` / `+5%`.
  - VR & Desktop: World-locked 3D Pause & Volume Mixer Panel spawned `1.4 m` in front of the viewer when paused (`P` / `Escape` / VR controller Menu / `B` / `Y` button).
- **Persistence:** `playerState.audio` (`master: 0.7`, `music: 0.8`, `ambient: 0.8`, `sfx: 0.8`, `muted: false`) persisted in `localStorage` with schema v4 migration.

## 6. Pause system (`src/engine/hubEngine.ts`, `src/ui/LabyrinthViewport.tsx`)

- **Triggers:** Desktop `P` or `Escape` (when no drawer is open), VR controller Menu / `B` / `Y` button, top-right `⏸ P` HUD button, and automatic pause on `document.visibilitychange` (`hidden`) or `xrSession.visibilityState !== 'visible'`.
- **What stops:** `gameClock` (`ctx.time.delta === 0`, `ctx.time.paused === true`), room `update` loop, onboarding timers, locomotion/turn input, and audio (`150 ms` ramp to 0 + `audioCtx.suspend()`).
- **What continues:** `renderer.setAnimationLoop` keeps rendering at 72/90 Hz so **VR head tracking never freezes**, and the **World-Locked 3D Pause & Volume Panel** remains interactive via VR controller ray or desktop click.
