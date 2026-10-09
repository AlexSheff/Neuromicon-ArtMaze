# EXPERIENCE_PROTOCOL.md — Onboarding, Environment, Textures, Optimization, Logic

> Companion to `AGENTS.md`. Binding for any agent or contributor touching the hub (`src/`), the Main Corridor, or room assets.
> If this file conflicts with `AGENTS.md` on performance or comfort, the stricter rule wins. Report conflicts in an issue.

## 0. Status and ground rules

**What was reviewed when this protocol was written:** `README.md`, `GAME_PROJECT_PLAN.md`, and the repository file list. The `src/` code and the rendered game were **not** reviewed. Every claim about current behavior below is therefore an **assumption to verify** in Step 1 (Audit).

**Known problems reported by the owner:** the game *states* everything it expects the player to infer (rules, controls, meaning). It reads as a manual, not as a world. This protocol replaces explanation with **discovery**.

**Numbers in this document are starting budgets**, not facts about the hardware. Validate every one on a real Meta Quest 2 (see §9) and record the result in `docs/perf-log.md`.

**Rule zero:** measure first, change second, re-measure third. No optimization lands without before/after numbers in the PR.

---

## 1. Experience pillars

1. **Show, don't tell.** Space, light, sound, and motion teach. Text confirms, never instructs.
2. **Grandeur with comfort.** Scale is felt through vertical lines, depth, and distant light. Comfort settings are never traded for scale.
3. **Mystery is a feature.** Some things stay unexplained. Never label what the player can be curious about.
4. **Every second is playable.** No unskippable cutscenes, no loading spinners. Loading is diegetic (fog thickens, a door breathes).
5. **The player always knows the next small thing to do** (a light, a sound, a motion), without being told the big picture.
6. **Respect returning players.** Onboarding appears once and never nags.

---

## 2. Onboarding protocol

### 2.1 Entry sequence (before the world)

One minimal HTML screen, not a menu:

1. Title (`NEUROMICON ARTMAZE`) and one primary button: **Enter**. Secondary: a small `VR` button only if `navigator.xr.isSessionSupported('immersive-vr')` resolves true.
2. The button click is the user gesture that unlocks audio and starts the XR session. Use it; do not add a second "click to start" screen.
3. Comfort is chosen by **gesture inside the world**, not a settings page (see §2.4).
4. No instructions page. No hotkey table. No "Rules" wall.

### 2.2 First 90 seconds: beat sheet

| Time | What the player sees/hears | What it teaches | Text |
|---|---|---|---|
| 0–8 s | Darkness; low drone swells; a faint vertical line of light far above and below | "This place is vast, and it is vertical" | none |
| 8–25 s | Light blooms from a source in front; the floor beneath shows a soft pulsing ring at 2–3 m | Look around, then **move** to the ring | none; ring pulses |
| 25–45 s | At the ring: teleport/step triggers; a pedestal glows. Controller model shows the trigger lit (VR) or a cursor glyph (desktop) | **Interact** with a glowing thing | one glyph, no sentence |
| 45–70 s | Interaction opens the floor/ceiling: the atrium reveals both directions. Audio crossfades by head pitch: looking up brings the ascent layer, looking down the descent layer | The two paths; the world responds to *attention* | none |
| 70–90 s | Two lifts/stairs, one each direction, with distinct light and sound. Stepping onto one starts a 3 s gentle hold (reversible by stepping off) | **Choice** and its reversibility | none |

After commit: the first segment of the chosen branch begins. Mirror, radio, zoom, and codex are introduced later by context (§2.5).

### 2.3 Onboarding state machine

```
BOOT → ENTRY → AWAKEN → LEARN_MOVE → LEARN_INTERACT → REVEAL → CHOOSE → COMMITTED
                                                                   ↘ (returning player) COMMITTED
```

- Implement as an explicit FSM in `src/onboarding/` with one file per state and a typed event bus. No ad-hoc booleans in the render loop.
- State persists as `player.onboarding = { version, completedSteps[], skipped }` in the versioned player state (§7.3).
- Returning player (`COMMITTED` reached once): start directly in the last corridor segment; offer no tutorial. Provide a hidden, always-available **replay** in the codex.
- **Skip is implicit:** if the player performs an action ahead of the script (moves, interacts, chooses), advance the FSM. Never block.

### 2.4 Comfort calibration as a ritual

Replace the settings-menu-first approach:

- At `AWAKEN`, two small glowing marks appear at different heights. Reaching toward the lower one (or sitting) selects **seated**; the higher one selects **standing**.
- Locomotion default: **teleport with fade**. Smooth movement is offered later, by a physical switch in the world (and in the `Alt` panel), after the player has teleported at least 5 times.
- Snap turn default on; angle selectable later.
- Comfort choices are written to state immediately and can always be changed.

### 2.5 Contextual discovery (replaces the hotkey table)

Each control is revealed **at the moment it becomes useful**, once:

| Control | Trigger to reveal | How |
|---|---|---|
| Zoom (`C`) | Gaze rests on a distant plaque or artwork > 3 s | A subtle lens glyph near the target; hotkey glyph appears only on desktop |
| Radio/Comments (`T`) | First time another player's signal or a "found item" report exists, or first room entered | The radio object on the belt/wrist hums; glyph on hover |
| Audio/Soundtrack (`Z`) | After 2 minutes in a segment, or if player looks at a sound source > 2 s | A resonating mark near the sound source |
| Settings (`Alt`) / comfort | After discomfort signals (rapid head shakes, repeated snap turns) or on request | Wrist/palm menu in VR; `Alt` is desktop-only |
| Rules (`R`) | **Removed as a "Rules" overlay.** Becomes the **Codex**: a journal that fills in as the player discovers things | Opened by choice; never auto-shown |

VR needs **non-keyboard equivalents** for every control (wrist menu, controller buttons). Any feature that exists only as a hotkey is a bug for the VR target.

### 2.6 Hint ladder (for stuck players)

If the player has not progressed in the current step:

1. **8 s:** a subtle light or sound cue toward the objective.
2. **20 s:** the cue becomes stronger and directional (a light trail, a spatial sound).
3. **45 s:** a single glyph or a ≤ 6-word line in the world (an engraved plaque, not a HUD).
4. **90 s:** offer the in-world "help" (codex entry) once; never repeat.

Hints reset when the player makes progress. Log hint usage locally (§9).

### 2.7 Text budget

- Onboarding text ≤ **3 strings** in the first 2 minutes. Each ≤ **12 words**. Prefer glyphs.
- Never use the imperative on screen ("Press X to…") for core actions. Show the highlighted control (VR controller model) or a glyph.
- Product copy is RU/EN. Strings live in `src/i18n/` keyed by id; no inline literals in game logic.
- Tone: terse, mythic, second person sparingly. Example (EN / RU): *"Choose the way."* / *«Выбери путь.»*; *"It remembers you."* / *«Оно помнит тебя.»*
- Every on-screen string needs a justification line in the PR: "why can't this be conveyed by space, light, or sound?"

---

## 3. Environment protocol

### 3.2 Branch visual language

| | Ascent (`ascend`) | Descent (`descend`) |
|---|---|---|
| Palette | Warm gold, travertine, white | Cold cyan, basalt, black |
| Light | Soft rays from above, dust motes | Pools of glow from below, caustic shimmer |
| Surfaces | Matte stone, subtle sheen | Wet, glossy, reflective |
| Audio | Harmonic, rising partials | Deep drone, sparse sub pulses |
| Motion | Slow upward drift | Slow downward drift |

---

## 5. Geometry and scene protocol

| Metric | Budget |
|---|---|
| Visible triangles | ≤ 500k (corridor); aim for ≤ 300k |
| Draw calls | ≤ 150 (rooms: ≤ 100 each) |
| Unique materials visible | ≤ 12 |
| Real-time lights | ≤ 2 (prefer 0 + baked) |
| Real-time shadows | none in XR; baked only |
| Load time of a segment | ≤ 3 s on Wi-Fi (Quest), no frame drops > 20 ms during load |
