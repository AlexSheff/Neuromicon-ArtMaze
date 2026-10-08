# AGENTS.md — Architectural & Engineering Guidelines

## 1. Core Architectural Invariants

1. **Data-Driven Room Contract (`ROOM_SPEC.md`)**:
   - The engine (`src/engine/`, `src/world/`, `src/systems/`) must never contain room-specific conditionals such as `if (room.id === "ROOM_0042")`.
   - All room-specific behavior—including visit-count mutations, mirror propositions, anomalous shadows, reflection mismatches, and conditional rabbit holes—must be declared in `room.json` and interpreted generically by the engine.

2. **No Executable Code in Room Packages**:
   - Room manifests (`room.json`, `data/*.json`) are strictly declarative JSON.
   - Do not use `eval`, `new Function`, or dynamic script loading for rooms.

3. **An Unfinished World Is a Valid World**:
   - Doors with `"status": "planned"` or `"status": "void"` must resolve gracefully to their declared fallback void (`infinity`, `fractal`, `fog`, `darkness`, `starfield`, `mirror`, `unknown`).
   - Missing destinations are valid states of the universe, never runtime crashes.

4. **Local-First & Offline Architecture**:
   - Player state (`visitedRooms`, `identity`, `discoveries`, `decisions`, `roomStates`) persists locally in `localStorage`.
   - No external accounts, no remote telemetry servers, no API keys, and no fragile CDN asset dependencies.

5. **Comfort & Restraint**:
   - Locomotion must remain smooth and predictable.
   - UI overlays must remain calm, minimal, and unobtrusive so that the architecture, light, paintings, and spatial anomalies remain the primary experience.
