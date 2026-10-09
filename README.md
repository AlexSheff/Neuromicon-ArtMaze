# Neuromicon Artmaze (WebXR)

**Live WebXR & Desktop Application:** [https://alexsheff.github.io/Neuromicon-ArtMaze/](https://alexsheff.github.io/Neuromicon-ArtMaze/)  
**Repository:** [https://github.com/AlexSheff/Neuromicon-ArtMaze](https://github.com/AlexSheff/Neuromicon-ArtMaze)

**Neuromicon Artmaze** is a multidimensional labyrinth of **1149 unique rooms** explored in **WebXR (Meta Quest 2 / standalone VR)** and **desktop browsers**, hosted as a static site on **GitHub Pages**.

Each room is an independent artwork living in its own repository (`room.json` + ES module `index.js`) and loaded at runtime through the fixed **Room API v1** inside a single page and a single uninterrupted WebXR session.

---

## 1. Grand Cosmic Starting Room & 3 Sector Rooms (25 Neuromicon Artworks & MP3 Tracks)

The player begins in the **Grand Cosmic Starting Room (The Threshold)** beneath a 4-layer astronomical sky (**Carina Nebula Cosmic Cliffs `NEB_0001`** + NASA/SVS all-sky starfield) and rotating celestial astrolabe rings. Before the player stand **3 Grand Cosmic Doors** leading into the **3 Sector Rooms**:

| Sector Room | Branch | Nebula Sky & Palette | Doors Inside |
|---|---|---|---|
| **Room I · The Source Code** | `ascend` (Segment 1) | `NEB_0002` Pillars of Creation (Eagle Nebula M16, Warm Gold/Amber) | **11 Doors** → `ROOM_001` (`01 · Purpose`) through `ROOM_011` (`11 · Action`) |
| **Room II · Operating System** | `descend` (Segment 2) | `NEB_0012` Veil Nebula Cygnus Loop (Cool Cyan/Cobalt) | **8 Doors** → `ROOM_012` (`12 · Solitude`) through `ROOM_019` (`19 · Algorithm`) |
| **Room III · Upgrade & Mirror** | `ascend` (Segment 3) | `NEB_0024` Webb First Deep Field (`SMACS 0723`, Deep Astral Violet/Gold) | **6 Doors** → `ROOM_020` (`20 · Signal vs Noise`) through `ROOM_025` (`25 · The Mirror`) |

- **Strict Room-Only Audio Isolation:** Each of the 25 rooms streams its own unique MP3 track and framed artwork from [`AlexSheff/Neuromicon`](https://github.com/AlexSheff/Neuromicon). Tracks play **exclusively inside rooms** and **never overlap**—exiting to a Sector Room or the Grand Cosmic Starting Room immediately halts the room track.

---

## 2. Real Astronomical Nebula Skies & Palette-Driven Lighting (`TZ.md` §3 & §4)

Every room (`ROOM_001`..`ROOM_025` and deterministic variants across all `1,149` rooms) features an open celestial oculus looking up into a **4-layer astronomical sky** (`src/systems/sky/nebulaSkySystem.ts`):

1. **L0 All-Sky Star Map:** Shared equirectangular starfield (`NASA/GSFC SVS 2020`, `PD-NASA`) rotated deterministically per room seed (`1` draw call).
2. **L1 Curved Nebula Cap:** Curated NASA / ESA / Webb / Hubble deep-sky photography (`content/space/nebulae.json`, credited in `CREDITS.md`) rendered on a `74° × 54°` curved spherical cap with a radial alpha feather mask—never stretched 360° (`1` draw call).
3. **L2 Cosmic Dust Parallax:** Additive 3D particle motes tinted by the room's 3-color OKLab nebula palette (`1` draw call).
4. **Palette-Driven Lighting Rig (`<= 2` Lights, `0` Shadows):** Each room's `HemisphereLight`, `DirectionalLight` (aligned with the nebula cap), `FogExp2`, and `64×64` environment reflection cubemap (`scene.environment`) are driven by its nebula's 3-color palette.

---

## 3. 4-Bus Perceptual Audio Mixer & Real Pause (`TZ.md` §5 & §6)

- **4-Bus WebAudio Mixer (`src/systems/audio/mixer.ts`):** All audio routes through `[music bus]`, `[ambient bus]`, and `[sfx bus]` → `[master gain]` → `[brickwall limiter (DynamicsCompressorNode)]` → `AudioContext.destination`.
- **Perceptual `v²` Volume Curve:** Sliders map `v ∈ [0, 1]` to `g = v²` via `setTargetAtTime(g, now, 0.04)` (zero clicks/pops) and persist in `PlayerState.audio` (`localStorage` schema `v4`).
- **Real Pause (`P` / `Esc` / VR Controller `B`/`Y` Menu Button):**
  - Freezes the game clock (`ctx.time.delta = 0`, `ctx.time.paused = true`), halts locomotion and room animations (`onPause` / `onResume`), and smoothly ramps master audio to `0` over `150 ms` before suspending `AudioContext` (preserving exact MP3 playback timestamp on resume).
  - **Never freezes head tracking:** The WebXR stereo render loop continues at 72 FPS while displaying a **world-locked 3D VR Pause & Volume Mixer Panel** `1.68 m` in front of the player.
  - Automatically pauses when the browser tab is hidden (`visibilitychange`) or when the Quest headset is removed (`visible-blurred`).

---

## 4. Controls (`EXPERIENCE_PROTOCOL.md` & `TZ.md`)

| Input | Action |
|---|---|
| **Click / VR Trigger on Floor Ring** | Blink-Teleport to floor target with comfort fade |
| **Click / `Space` / VR Trigger on Target** | Interact with Pedestal, Door, Painting Essay, Mirror, Anomaly, or 3D Pause Panel |
| **`W` `A` `S` `D` / Left Quest Stick** | Move (Blink-Step in `Teleport` mode, Constant-Velocity in `Smooth` mode) |
| **`Q` `E` / Arrow Left & Right / Right Quest Stick** | Discrete Snap Turn (`30°` or `45°`) — zero collision with `R` |
| **`P` / `Esc` / VR `B`/`Y` Button / Top-Right `⏸`** | **Pause / Resume** (freezes game clock & audio, spawns 3D world-locked VR panel) |
| **`M` / Top-Right `🔊`/`🔇`** | **Mute / Unmute** all audio buses (`40 ms` smooth ramp) |
| **`[` / `]`** | **Master Volume Down / Up** (`-5%` / `+5%` step) |
| **`Z` / Top-Right `♫`** | Toggle **4-Bus Audio Mixer** (`Master`, `Music`, `Ambient`, `Effects`) |
| **`R` / Top-Right `❖`** | Toggle **Codex** (Discovery Journal, 3 Sector Rooms quick jump, Nebula credits & 30-transition GPU test) |
| **`T` / Top-Right `(((·)))`** | Toggle **Radio / Comments** channel |
| **`C` / Top-Right `◎`** | Toggle **Optical Zoom (`65° ↔ 36°` FOV)** |
| **`Alt` / Top-Right `✥`** | Toggle **Comfort & Quality Tier** (`Teleport / Smooth`, `Seated / Standing`, `Snap Turn`, `Reduced Motion`, `Captions`, `Quality Tier: auto / quest / desktop-low / desktop-high`) |

---

## 5. Repository Structure

```text
/
├── AGENTS.md                  # Authoritative architectural specification & roadmap
├── EXPERIENCE_PROTOCOL.md     # Binding onboarding, environment, texture, optimization & logic protocol
├── TZ.md                      # Technical specification: Real Nebula Skies, Palette Lighting, Mixer & Pause
├── CREDITS.md                 # Full NASA / ESA / Webb / Hubble / SVS 2020 & Neuromicon attributions
├── README.md                  # Project documentation & controls
├── docs/
│   ├── audit-2026-10-08.md    # R0 Re-Audit report (backdrop, lights, audio graph, pause, RoomContext, Quest 2 metrics)
│   └── perf-log.md            # Before/after frame budgets, Quest 2 FFR & 30-transition leak verification
├── content/
│   ├── world.graph.json       # 1149-room topology, 3 Sector Rooms (25 Neuromicon rooms) & SHA-256 hashes
│   ├── art/manifest.json      # Licensed artwork metadata
│   └── space/                 # Curated 25 astronomical nebulae (nebulae.json), starfield.json & room-nebulae.json
├── tools/
│   ├── room-validator/        # Room API v1 JSON Schema validator
│   └── space-assets/          # OKLab palette extractor, deterministic 1,149-room mapper & license validator
├── room-template/
│   ├── room.json              # Canonical Room API v1 manifest (with sky config)
│   └── index.ts               # Reference RoomModule (preload, mount, update, onPause, onResume, unmount)
├── src/
│   ├── room-sdk/              # Room API v1 types (RoomModule, RoomContext with time, sky, environment, audio.bus)
│   ├── engine/
│   │   ├── hubEngine.ts       # Three.js WebGL2 + WebXR engine, Pausable Clock & 3D World-Locked Pause Panel
│   │   ├── comfort/           # ComfortSystem (3D fade sphere, peripheral vignette, floor teleport ring)
│   │   ├── xr/                # Meta Quest 2 WebXR session, B/Y pause button & visibilitychange blur handler
│   │   └── input/             # Unified Action Input Layer (Q/E snap turn, Space/Click/Trigger interact)
│   ├── corridor/
│   │   └── corridorBuilder.ts # Grand Cosmic Starting Room + 3 Sector Rooms (25 Doors)
│   ├── world/
│   │   └── roomStreamer.ts    # Room API v1 streamer, Celestial Oculus, Painting & MP3 carrier
│   ├── systems/
│   │   ├── sky/               # 4-Layer Real Astronomical Nebula Sky & Palette Lighting System
│   │   └── audio/             # 4-Bus WebAudio Mixer & Limiter (mixer.ts) + Room MP3 Streamer (spatialAudioSystem.ts)
│   ├── state/
│   │   └── playerState.ts     # Versioned localStorage state (v4) with audio bus persistence & migration
│   └── ui/                    # Pre-world Entry gate, Pause overlay, 4-Bus Mixer, Codex & Studio tools
└── tests/
    └── room-validator.test.ts # Manifest, Nebula Registry, Perceptual Mixer & Migration test suite
```

---

## 6. Local Development & Verification

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check and build static bundle for GitHub Pages
npm run lint
npm run build
```
