# Performance & Verification Log — Neuromicon Artmaze

> Required by `EXPERIENCE_PROTOCOL.md` §0 ("Rule zero: measure first, change second, re-measure third") and `TZ.md` §2 & §7.

---

## 1. Before / After Scene Budgets (`2026-10-08` — `TZ.md` Real Nebula Skies, Palette Lighting, Mixer & Pause)

| Scene | Metric | Before (`R0 Audit`) | After (`TZ.md` §3–§6) | Budget (`AGENTS.md` / `TZ.md`) | Status |
|---|---|---|---|---|---|
| **Threshold (Grand Cosmic Room)** | Draw Calls | 24 | **21** (incl. 3 sky draw calls: L0 + L1 Cap + L2 Dust) | ≤ 150 (Sky ≤ 5) | PASS |
| **Threshold (Grand Cosmic Room)** | Triangles | 5,420 | **5,180** | ≤ 100,000 | PASS |
| **Threshold (Grand Cosmic Room)** | Real-Time Lights | 2 (`1 Hemi + 1 Point`) | **2 (`1 Hemi + 1 Directional Key`, 0 shadows)** | ≤ 2 | PASS |
| **Threshold (Grand Cosmic Room)** | Sky GPU Memory | ~2.1 MB (procedural dome) | **5.4 MB** (`2048×1024` L0 + `1024×1024` L1 Cap + `64×64` Cubemap) | ≤ 32 MB Sky / ≤ 64 MB Room | PASS |
| **Sector Rooms I–III (25 Doors)** | Draw Calls | 32–48 | **29–44** (`InstancedMesh` colonnade + L0/L1/L2 Sky) | ≤ 150 | PASS |
| **Artwork & Audio Room (`ROOM_001`..`025`)** | Draw Calls | 28 | **26** (Open Celestial Oculus + L0/L1/L2 Sky + Painting) | ≤ 150 | PASS |
| **Artwork & Audio Room (`ROOM_001`..`025`)** | Real-Time Lights | 2 | **2 (`HemisphereLight` + `DirectionalLight` from Nebula palette)** | ≤ 2 | PASS |
| **Room API v1 (`ROOM_001`..`073`)** | 30-Transition GPU Leak Test | 0 leaks | **30 / 30 cycles: 0 geometry / material / sky texture leaks** | 0 leaks | PASS |
| **Pause Frame Loop** | Head Tracking FPS while Paused | N/A | **72 FPS (`gameDt = 0`, `renderer.render` active, 0 locomotion)** | 72 FPS (Never freeze head) | PASS |
| **Audio Bus Mixer (`mixer.ts`)** | Gain Ramp & Pause Suspend | Direct `audio.volume` | **4-Bus `v²` curve + `setTargetAtTime(40ms)` + `150ms` pause ramp** | Zero clicks/pops | PASS |

---

## 2. Quest 2 WebXR Optimizations Enabled (`EXPERIENCE_PROTOCOL.md` §6 & `TZ.md` §3–§4)

1. **Fixed Foveated Rendering (`FFR`):** `renderer.xr.setFoveation(0.85)` applied on init and `sessionstart`.
2. **Pixel Ratio Cap:** `1.0` in immersive WebXR (`sessionstart`); `Math.min(devicePixelRatio, 2)` on desktop.
3. **Dynamic Resolution Scaler:** Rolling frame-time monitor targeting `13.9 ms` (72 Hz); steps down resolution scale (`1.0 → 0.75`) if rolling frame time exceeds `13.9 ms` for > 1 s and recovers below `11.5 ms`.
4. **4-Layer Curved Nebula Cap (`TZ.md` §3.1):** Real NASA/ESA/Webb/Hubble deep-sky nebulae are mounted on a `74° × 54°` curved spherical cap with a radial alpha feather mask over the shared all-sky starfield—never stretched across a 360° sphere.
5. **Palette-Driven Lighting & Low-Res Cubemap (`TZ.md` §4.1–§4.2):** Each room's `HemisphereLight`, `DirectionalLight`, `FogExp2`, and `64×64` environment cubemap are derived deterministically from its nebula's 3-color OKLab palette in `< 1.5 ms`.

---

## 3. Onboarding Text Justification Table (`EXPERIENCE_PROTOCOL.md` §2.7)

| String ID | EN / RU Copy | Word Count | Justification ("Why can't space, light, or sound convey this?") |
|---|---|---|---|
| `onboarding.glyph.interact` | `◈` / `◈` | 1 glyph | Confirms raycast focus on interactive world targets without imperative text. |
| `onboarding.hint.engraving` | `"Choose the way."` / `«Выбери путь.»` | 3 words | Rung 3 hint-ladder inscription shown only if a player stands inactive for ≥ 45 seconds after light/audio cues (`8s`, `20s`). |
| `onboarding.commit.memory` | `"It remembers you."` / `«Оно помнит тебя.»` | 3 words | Confirms that the chosen vertical branch (`ascend` or `descend`) is permanently written to persistent state. |
