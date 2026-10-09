# Performance & Verification Log — Neuromicon Artmaze

> Required by `EXPERIENCE_PROTOCOL.md` §0 ("Rule zero: measure first, change second, re-measure third") and §9.

---

## 1. Before / After Scene Budgets (`2026-10-08`)

| Scene | Metric | Before (`Step 1 Audit`) | After (`Step 3–4 Protocol`) | Budget (`§5.1 & §6`) | Status |
|---|---|---|---|---|---|
| **Threshold Atrium** | Draw Calls | 26 | **17** | ≤ 150 | PASS |
| **Threshold Atrium** | Triangles | 4,820 | **4,140** | ≤ 300,000 | PASS |
| **Threshold Atrium** | Real-Time Lights | 3 (`1 Hemi + 2 Point`) | **2 (`1 Hemi + 1 Point`)** | ≤ 2 | PASS |
| **Threshold Atrium** | Unique Materials | 9 | **7 (`MeshLambert + MeshBasic + Standard`)** | ≤ 12 | PASS |
| **Corridor Segment (`ascend`/`descend`)** | Draw Calls | 34 | **22** (instanced colonnade + merged trims) | ≤ 150 | PASS |
| **Corridor Segment (`ascend`/`descend`)** | Texture Memory (GPU) | ~7.4 MB (non-POT `640×220`) | **~4.2 MB** (POT `512×256` & `512×512` mipmapped) | ≤ 64 MB | PASS |
| **Room API v1 (`ROOM_073`)** | Per-Frame GC Allocations | `2× new THREE.Vector3()` / frame | **0 allocations / frame** (`_scratchOrigin`, `_scratchDir`) | 0 / frame | PASS |
| **Room API v1 (`ROOM_073`)** | 30-Transition GPU Leak Test | Untested | **30 / 30 cycles: 0 geometry/material delta** | 0 leaks | PASS |

---

## 2. Quest 2 WebXR Optimizations Enabled (`§6`)

1. **Fixed Foveated Rendering (`FFR`):** `renderer.xr.setFoveation(0.85)` applied on init and `sessionstart`.
2. **Pixel Ratio Cap:** `1.0` in immersive WebXR (`sessionstart`); `Math.min(devicePixelRatio, 2)` on desktop.
3. **Dynamic Resolution Scaler:** Rolling frame-time monitor targeting `13.9 ms` (72 Hz); steps down resolution scale (`1.0 → 0.75`) if rolling frame time exceeds `13.9 ms` for > 1 s and recovers below `11.5 ms`.
4. **Shader Discipline (`§4.3`):** Static corridor and room walls/vaults use `MeshLambertMaterial` + exponential distance fog (`THREE.FogExp2`); `MeshStandardMaterial` is restricted to hero doors, mirrors, and interactive artifacts.

---

## 3. Onboarding Text Justification Table (`§2.7`)

| String ID | EN / RU Copy | Word Count | Justification ("Why can't space, light, or sound convey this?") |
|---|---|---|---|
| `onboarding.glyph.interact` | `◈` / `◈` | 1 glyph | Confirms raycast focus on the central stone monolith at `LEARN_INTERACT` without imperative text. |
| `onboarding.hint.engraving` | `"Choose the way."` / `«Выбери путь.»` | 3 words | Rung 3 hint-ladder inscription shown only if a player stands inactive for ≥ 45 seconds after light/audio cues (`8s`, `20s`). |
| `onboarding.commit.memory` | `"It remembers you."` / `«Оно помнит тебя.»` | 3 words | Confirms that the chosen vertical branch (`ascend` or `descend`) is permanently written to persistent state. |
