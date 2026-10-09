# Neuromicon Artmaze (WebXR)

**Live WebXR & Desktop Application:** [https://alexsheff.github.io/Neuromicon-ArtMaze/](https://alexsheff.github.io/Neuromicon-ArtMaze/)  
**Repository:** [https://github.com/AlexSheff/Neuromicon-ArtMaze](https://github.com/AlexSheff/Neuromicon-ArtMaze)

**Neuromicon Artmaze** is a multidimensional labyrinth of **1149 unique rooms** explored in **WebXR (Meta Quest 2 / standalone VR)** and **desktop browsers**, hosted as a static site on **GitHub Pages**.

Each room is an independent artwork living in its own repository (`room.json` + ES module `index.js`) and loaded at runtime through the fixed **Room API v1** inside a single page and a single uninterrupted WebXR session.

---

## 1. Main Corridor — The Threshold (First Deliverable)

The player begins at the **Threshold**, a vast vertical atrium split in two vertically. The first act of the game is a physical, diegetic choice:

| Direction | Meaning | Branch ID | Registry `branch` | Visual & Acoustic Direction |
|---|---|---|---|---|
| **Up — Ascent** | Grow, embody (*воплощать, расти*) | `ASCENT` | `ascend` | Sunlit travertine vaults, golden colonnades, celestial harmonic layer |
| **Down — Descent** | Search, explore (*искать, исследовать*) | `DESCENT` | `descend` | Subterranean basalt monoliths, cyan reflection pools, abyssal drone layer |

- **Chunked Corridor Segments:** Each branch (`ascend` and `descend`) consists of colossal segmented halls (`Segment 1`, `Segment 2`). Only the active segment is mounted in GPU memory (`THREE.InstancedMesh` colonnades, ≤ 150 draw calls, 72 FPS target on Meta Quest 2).
- **Door Signage & State Indicators:** Every corridor door displays its room symbol, title, dimension (`D1`–`D9`), and state (`UNVISITED`, `VISITED`, `COMPLETED`, or `SEALED / PLANNED`). Rabbit-hole doors are never indicated in the corridor.
- **Persistent Path & Return:** Choosing Ascent or Descent writes `player.path = "ascend" | "descend"` to `localStorage`. Returning from any room via the Mirror (`BACK`) restores the exact corridor branch and segment where the player left.

---

## 2. Core Room Loop & Room API v1

Behind each corridor door is an independent room (`ROOM_001` .. `ROOM_1149`, including `ROOM_073` *"Archive of Missing Things"*):

1. **Quest & Philosophical Question:** Each room poses a question and an objective completed by interacting with room artifacts or spatial anomalies.
2. **Three Regular Doors (`A`, `B`, `C`):**
   - `Door A` (`identity-accept`)
   - `Door B` (`identity-reject`)
   - `Door C` (`free`)
3. **One Hidden Rabbit Hole (`Door RH`):** Hidden by default (`visibility: "hidden"`). Unlocked only by discovering a rule violation (e.g., interacting with a ghost monolith that exists **only inside the mirror reflection**, `onlyInMirror: true`).
4. **The Identity Mirror:** Displays the room's archetype (`characterState`) and offers three choices: `ACCEPT`, `REJECT`, or `BACK` (return to the Main Corridor).
5. **Non-Portable Objects (`portable: false`):** Interactive objects and busyboards can be inspected or rotated, but never leave the room—only knowledge and identity state travel across thresholds.

```ts
export interface RoomModule {
  preload?(ctx: RoomContext): Promise<void>;   // optional asset preload
  mount(ctx: RoomContext): Promise<void>;      // build scene under ctx.root
  update?(dt: number, ctx: RoomContext): void; // per-frame update
  unmount(ctx: RoomContext): void;             // dispose all geometries, materials, textures
}
```

---

## 3. VR Comfort First (Meta Quest 2 & Desktop)

To prevent motion sickness or "swimming space" vection in WebXR:

- **Blink-Teleport with Comfort Fade (`teleport` mode, default):** Aim the Quest Touch controller ray (or desktop cursor) at any walkable floor/platform to reveal the golden **3D Teleport Ring**, then press Trigger / Click (or push the thumbstick forward) to blink-teleport with a smooth black micro-fade.
- **Discrete Snap Turn (`30°` / `45°`):** Right thumbstick and `Q` / `R` keys rotate in crisp discrete steps rather than continuous rotational swimming.
- **Smooth Locomotion with Peripheral Vignette (`smooth` mode):** Constant-velocity movement (zero camera acceleration) paired with an automatic 3D peripheral comfort vignette and stable horizon reference ticks.
- **Seated Mode (`seated`):** Adds a calibrated `+0.45m` vertical rig offset for seated VR sessions.

---

## 4. Controls & Contextual Discovery (`EXPERIENCE_PROTOCOL.md`)

Controls are discovered contextually inside the world and always have both VR wrist/controller equivalents and desktop bindings:

| Input | Action |
|---|---|
| **Click / VR Trigger on Floor Ring** | Blink-Teleport to floor target with comfort fade |
| **Click / `Space` / VR Trigger on Target** | Interact with Monolith, Door, Mirror choice, Busyboard, or Ghost Reflection |
| **`W` `A` `S` `D` / Left Quest Stick** | Move (Blink-Step in `Teleport` mode, Constant-Velocity in `Smooth` mode) |
| **`Q` `E` / Arrow Left & Right / Right Quest Stick** | Discrete Snap Turn (`30°` or `45°`) — zero collision with `R` |
| **Mouse Drag** | Look around (Desktop) |
| **`R` / Wrist `❖`** | Open **Codex** (Discovery Journal & Awakening Replay; replaces the old Rules wall) |
| **`T` / Wrist `(((·)))`** | Toggle **Radio / Comments** channel (revealed on first room entry or signal) |
| **`C` / Wrist `◎`** | Toggle **Optical Zoom (`65° ↔ 36°` FOV)** (revealed after >3s gaze on distant plaque/art) |
| **`Alt` / Wrist `✥`** | Toggle **Comfort & Accessibility Settings** (`Teleport / Smooth`, `Seated / Standing`, `Snap Turn`, `Reduced Motion`, `Audio Captions`) |
| **`Z` / Wrist `♫`** | Toggle **Audio & Soundtrack Control** (Head-pitch vertical crossfade & room tracks) |

---

## 5. Repository Structure

```text
/
├── AGENTS.md                  # Authoritative architectural specification & roadmap
├── EXPERIENCE_PROTOCOL.md     # Binding onboarding, environment, texture, optimization & logic protocol
├── README.md                  # Project documentation & controls
├── docs/
│   ├── audit-2026-10-08.md    # Step 1 Audit report (strings, hotkey collisions, draw calls, GPU memory)
│   └── perf-log.md            # Before/after frame budgets, Quest 2 FFR & 30-transition leak verification
├── content/
│   ├── world.graph.json       # 1149-room topology, branches (ascend/descend), segments & SHA-256 hashes
│   └── art/manifest.json      # Licensed artwork metadata (id, title, author, license, source, url)
├── schema/
│   ├── room.schema.json       # JSON Schema (draft 2020-12) for Room API v1 manifests
│   └── world.schema.json      # JSON Schema for world.graph.json
├── room-template/
│   ├── room.json              # Canonical Room API v1 manifest (ROOM_073)
│   └── index.ts               # Reference RoomModule (preload, mount, update, unmount)
├── src/
│   ├── onboarding/            # Explicit Onboarding FSM (BOOT → ENTRY → AWAKEN → LEARN_MOVE → LEARN_INTERACT → REVEAL → CHOOSE → COMMITTED)
│   ├── events/                # Typed EventBus (src/events/eventBus.ts)
│   ├── i18n/                  # Authoritative RU/EN strings with justification lines (src/i18n/strings.ts)
│   ├── room-sdk/              # Room API v1 types (RoomModule, RoomContext) & GPU disposal helpers
│   ├── engine/
│   │   ├── hubEngine.ts       # Three.js WebGL2 + WebXR stereo engine, FFR (0.85), dynamic resolution scaler
│   │   ├── comfort/           # ComfortSystem (3D fade sphere, peripheral vignette, floor teleport ring)
│   │   ├── xr/                # Meta Quest 2 WebXR session & Touch controller manager
│   │   └── input/             # Unified Action Input Layer (Q/E snap turn, Space/Click/Trigger interact)
│   ├── corridor/
│   │   └── corridorBuilder.ts # Threshold Hall atrium + chunked Ascent & Descent segments
│   ├── world/
│   │   └── roomStreamer.ts    # Room API v1 streamer, SHA-256 verifier, 8s timeout & Void fallback space
│   ├── systems/
│   │   └── audio/             # WebAudio head-pitch vertical crossfader & room soundtrack synthesizer
│   ├── state/
│   │   └── playerState.ts     # Versioned localStorage state with migration & corruption recovery
│   └── ui/                    # Pre-world Entry gate, Codex journal, contextual drawers & Studio tools
└── tests/
    └── room-validator.test.ts # Manifest & schema validation suite
```

---

## 6. Local Development & Deployment

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check and build static bundle for GitHub Pages
npm run lint
npm run build
```
