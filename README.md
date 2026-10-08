# Neuromicon ArtMaze

**Live WebXR & Desktop Application:** [https://alexsheff.github.io/Neuromicon-ArtMaze/](https://alexsheff.github.io/Neuromicon-ArtMaze/)  
**Repository:** [https://github.com/AlexSheff/Neuromicon-ArtMaze](https://github.com/AlexSheff/Neuromicon-ArtMaze)

**Neuromicon ArtMaze** is a browser-based WebXR and desktop 3D world consisting of a central multidimensional labyrinth (`ROOM_0000`) and independently authored rooms (`ROOM_0001` .. `ROOM_1149`).

Walk. Look. Listen. Choose. Wonder.

---

## Architecture Overview

Every room in the world conforms to [`ROOM_SPEC.md`](./ROOM_SPEC.md) and exists as a self-contained declarative manifest (`room.json`) with its own geometry, rules, paintings, objects, mirrors, quests, and doors.

```text
WORLD
  |
  +-- MAIN MAZE / ROOM_0000 (main-maze/room.json)
  |
  +-- ROOM_0001 repository (rooms/ArtMaze-Room-0001)
  +-- ROOM_0042 repository (rooms/ArtMaze-Room-0042)
  +-- ROOM_0107 repository (rooms/ArtMaze-Room-0107)
  |
  +-- ...
  |
  +-- ROOM_1149 (World scale constant)
```

### Key Principles

1. **One Room = One Repository**: A room defines its space, rules, state, interactions, and meaning purely through declarative JSON data (`room.json`). No room-specific hacks or executable scripts are embedded in room packages.
2. **The Main Maze Is a Room**: `ROOM_0000` is the central architectural labyrinth with corridors, framed artworks, monuments, anomalies, and doors.
3. **Doors Are Propositions**: A door can lead to a ready room, a planned room, a conditional rabbit hole, or a first-class Void (`infinity`, `fractal`, `fog`, `darkness`, `starfield`, `mirror`, `unknown`).
4. **Directed Topology**: $A \to B$ does not imply $B \to A$. Rooms are not required to have an entrance, an exit, or a return path.
5. **Local-First State**: The visitor carries no physical inventory—only discoveries, memories, decisions, and identity state across room visits.

---

## Repository Structure

```text
/
├── README.md
├── AGENTS.md
├── GAME_PROJECT_PLAN.md
├── ROOM_SPEC.md
├── LICENSE
├── package.json
├── vite.config.ts
│
├── src/
│   ├── engine/
│   │   ├── renderer/       # WebGL2 3D renderer, shaders, procedural frames & void raymarchers
│   │   ├── xr/             # WebXR session manager (Meta Quest 2 + fallback)
│   │   ├── input/          # Keyboard, mouse pointer-lock, and gaze/raycast input
│   │   └── locomotion/     # Smooth collision-aware first-person movement
│   │
│   ├── world/
│   │   ├── registry/       # Room registry resolver (registry/rooms.json)
│   │   ├── graph/          # Directed world topology graph (registry/world.graph.json)
│   │   ├── loader/         # Declarative ROOM_SPEC v1.0 manifest loader
│   │   ├── transitions/    # Room-to-room and room-to-void transition coordinator
│   │   └── void/           # First-class Void system (infinity, fractal, fog, darkness, starfield, mirror, unknown)
│   │
│   ├── systems/
│   │   ├── doors/          # Door evaluation, requirements, propositions, and fallbacks
│   │   ├── rooms/          # Dynamic room state & visit-count reconstruction
│   │   ├── interaction/    # Generic interaction verbs (inspect, look, touch, activate, rotate, open, listen, read, observe)
│   │   ├── observation/    # Prolonged gaze & anomaly detection mechanics
│   │   ├── quest/          # Room propositions and multi-option choice handlers
│   │   ├── mirror/         # Identity proposition instrument (ACCEPT / REJECT / RETURN)
│   │   ├── identity/       # Persistent identity vector management
│   │   ├── discovery/      # Anomaly & rabbit-hole unlocking
│   │   ├── audio/          # WebAudio procedural spatial acoustics
│   │   └── state/          # Local-first persistent player & room state store
│   │
│   ├── ui/                 # Minimal semantic HUD, Door Proposition modal, Mirror interface, and Studio tools
│   ├── main.ts             # Engine entry exports
│   └── App.tsx             # Application host
│
├── main-maze/
│   ├── room.json           # Canonical ROOM_0000 manifest
│   ├── geometry/           # Corridor & sector definitions
│   ├── paintings/          # Artwork definitions & procedural plates
│   ├── audio/              # Acoustic preset definitions
│   └── assets/             # Material & frame presets
│
├── rooms/
│   ├── ArtMaze-Room-0001/  # Sample Room 0001: The Hall of Unseen Reflections
│   ├── ArtMaze-Room-0042/  # Sample Room 0042: The Room That Remembers
│   └── ArtMaze-Room-0107/  # Sample Room 0107: The Archivist's Mirror
│
├── registry/
│   ├── rooms.json          # Canonical room registry
│   └── world.graph.json    # Directed world graph
│
├── schema/
│   ├── room.schema.json    # JSON Schema for ROOM_SPEC v1.0
│   ├── registry.schema.json
│   └── world.schema.json
│
├── tools/
│   └── room-validator/     # Schema & contract validator for room.json manifests
│
└── tests/
    └── room-validator.test.ts
```

---

## Controls

- **Walk**: `W`, `A`, `S`, `D` or Arrow Keys
- **Look**: Click viewport to engage Pointer Lock (or drag with mouse), `Esc` to release cursor
- **Observe / Inspect**: Hold reticle on any painting, object, shadow, reflection, or door (`E` or Click to interact)
- **WebXR**: Click **Enter WebXR** on supported headsets (Meta Quest 2+)
