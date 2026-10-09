# AGENTS.md — Neuromicon Artmaze (WebXR)

> Spec for AI coding agents working in this repository. Read fully before making changes.
> Human owner: Alex. Language of code, comments, commits: English. Product copy may be RU/EN.

## 1. Mission

Build **Neuromicon Artmaze**: a multidimensional labyrinth of **1149 unique rooms** explored in **WebXR (VR) and desktop**, hosted as a static site on **GitHub Pages**. Each room is an immersive, self-contained experience defined by **data** (a room package) rendered by **universal engine code**.

Each room is an independent artwork living in **its own GitHub repository**; the hub loads rooms at runtime. The first deliverable is the **Main Corridor**, where the player chooses to go **up (embody/grow)** or **down (search/explore)** (see §4A).

Core fantasy: a central corridor with doors. Behind each door is a room with a quest, a question, three further doors, one hard-to-notice rabbit hole, a mirror that changes who the player is, a unique soundtrack, and interactive objects that can never leave the room.

## 2. Non-negotiable principles

1. **One room = one repository = one artwork.** A room is a manifest (`room.json`) plus its own module and assets, loaded through the fixed **Room API v1** (§4). Rooms never reach into hub internals; shared behavior (doors, mirror, quest, radio, state) comes from `RoomContext`. If many rooms need a new capability, extend the Room API, do not fork per room.
2. **The maze is a graph, not geometry.** Topology lives in `world.graph.json`. Physical layout may contradict logical connections (non-Euclidean transitions are a feature).
3. **Static-first.** No backend in v1. Everything runs from GitHub Pages. Multiplayer (radios) is a separate, optional phase using an external relay.
4. **Standard primitives only.** WebGL2 / WebXR / WebAudio. No custom native modules, no WASM unless profiled and justified.
5. **Lazy loading.** Never load more than the current room plus its direct neighbors. Unload on exit.
6. **Quest-class budget.** Assume standalone headset (Meta Quest Browser) as the performance floor.
7. **Everything validated in CI.** Invalid room packages must fail the build.
8. **Prefer open-source, self-hostable, privacy-respecting dependencies.** No telemetry, no third-party trackers.
9. **VR comfort first.** Vertical and large-scale motion must use comfort techniques (fade, vignette, stable frame, teleport option). Scale and grandeur never override comfort.
10. **No navigation away from the page.** Room transitions happen inside one page and one XR session via dynamic `import()`.

## 3. Tech stack

| Concern | Choice |
|---|---|
| Build | Vite + TypeScript |
| 3D / XR | Three.js + WebXR Device API (`three/examples/jsm/webxr`) |
| Audio | WebAudio (spatial via `PositionalAudio`), streamed MP3/OGG |
| State | `localStorage` / IndexedDB (player state, visited rooms, identity choices) |
| Schema | JSON Schema (draft 2020-12) + validator |
| CI/CD | GitHub Actions → GitHub Pages |
| Room loading | Dynamic ES module `import()` from room repos, SHA-256 pinned via registry |
| Room distribution | One GitHub repo + Pages site per room, created from `room-template` |
| Tooling | Node 20+, pnpm/npm, ESLint, Prettier, Vitest, Playwright (desktop smoke tests) |

## 4A. Main Corridor — Threshold (first deliverable)

The player begins at the **Threshold**, a vast vertical atrium. The space is split in two vertically, and the first act of the game is a choice:

| Direction | Meaning | Branch id | Registry `branch` |
|---|---|---|---|
| **Up — Ascent** | Grow, embody (воплощать, расти) | `ASCENT` | `ascend` |
| **Down — Descent** | Search, explore (искать, исследовать) | `DESCENT` | `descend` |

## 4B. Room API v1 Contract & Additive Extensions (`src/room-sdk/index.ts`, `schema/room.schema.json`)

Every room package exports a `RoomModule` and is mounted with a `RoomContext`. Per `TZ_NEBULA_LIGHTING_AUDIO_PAUSE.md` (§3.6, §3.7, §4.6, §5.5, §6.4), the following **additive** extensions are part of Room API v1:

- **`RoomModule` lifecycle hooks:**
  - `mount(ctx: RoomContext): Promise<void> | void`
  - `update?(ctx: RoomContext, dt: number): void` — called with `gameDt` (`0` while paused; room modules may also skip work when `ctx.time.paused` is `true`).
  - `onPause?(ctx: RoomContext): void` — optional notification when the player pauses (`P` / `Escape` / VR controller Menu / `visibilitychange`).
  - `onResume?(ctx: RoomContext): void` — optional notification when the player resumes.
  - `unmount(ctx: RoomContext): void`
- **`RoomContext` additive fields:**
  - `ctx.time`: `{ readonly now: number; readonly delta: number; readonly paused: boolean }` (pausable game clock).
  - `ctx.sky`: `{ readonly current: NebulaEntry; set(nebulaId: string, opts?: { rotation?: [number, number, number]; intensity?: number; crossfadeSec?: number }): Promise<void> }`.
  - `ctx.environment`: `{ readonly palette: [string, string, string]; applyRig(root: THREE.Object3D): void }`.
  - `ctx.audio`: `{ playRoomTrack(url: string, baseHz?: number): void; triggerTone(freq: number, durationSec?: number): void; bus(name: 'music' | 'ambient' | 'sfx' | 'voice'): AudioNode | null }`.
- **`room.json` schema (`schema/room.schema.json`):**
  - Optional `"sky"` object: `{ "nebulaId": "NEB_XXXX", "rotation": [rx, ry, rz], "intensity": 0.2..1.5 }`. Validated against `content/space/nebulae.registry.json`.

