# 04. Game Mechanics — Declarative Systems of ArtMaze

**Document ID:** `DOC-04`  
**Layer:** Interactive Systems & Engine Mechanics  
**Version:** 1.0

---

## 1. Core Architectural Rule

Every mechanic in ArtMaze is **declarative** (`room.json` conforming to `ROOM_SPEC.md` v1.0) and interpreted generically by the engine (`src/engine/`, `src/world/`, `src/systems/`). No room package may contain executable JavaScript or room-specific engine hacks.

---

## 2. Primary Mechanics

### 2.1 Doors as Diagnostic Propositions (`A / B / C / Hidden Path`)
A door is not a passive teleport trigger. It is a cognitive proposition:
- **Option A**: Structured / instruction-aligned transition.
- **Option B**: Exploratory / hypothesis-testing transition.
- **Option C**: High-uncertainty / Void transition.
- **Fourth Possibility (`RH` / Rabbit Hole)**: Not presented as a 4th button inside the modal. Instead, it is unlocked in the physical room by observing an environmental contradiction (`SHADOW_WITHOUT_OBJECT`, `REFLECTION_MISMATCH`, `visit-count`, `identity`, `SYMMETRY_SYNTHESIS`, `SYSTEM_RULE_CREATED`).

### 2.2 Attention & Sustained Gaze (`Looking vs. Seeing`)
- Passing a target briefly registers `looking`.
- Holding the reticle on an anomaly or artwork for $\ge 1.6\text{s}$ fills the subtle observation ring and triggers `seeing` (`ObservationSystem`), unlocking latent discoveries without explicit UI checklists.
- Paintings with `"mutatesOnIgnore": true` change their geometric motif only after the player looks at them, turns away, and looks back.

### 2.3 The Three Mirror Modes (`first`, `identity`, `meta`)
Declared via `mirror` in `room.json`:
1. **Entry Mirror (`ROOM_0000` / `first`)**: Captures initial expectation (`guide`, `rival`, `self`, `void`).
2. **Identity Mirror (`ROOM_0107` / `identity`)**: Offers an archetype (`THE_ARCHIVIST`, `THE_OBSERVER`, `THE_CREATOR`) with `ACCEPT`, `REJECT`, `RETURN`.
3. **Meta-Mirror (`ROOM_0999` / `meta`)**: Aggregates the participant's live behavioral ledger (`uncertaintyAvoided`, `hiddenPathsSearched`, `strangersTrusted`, `strategyChanges`, `pathsCreated`) and poses the question: *"Was this truly a labyrinth?"*

### 2.4 Trial Mechanic (`Identity → Action → Consequence`)
Choosing an identity in a Mirror sets a state expectation. Downstream conditional doors and trials verify whether the participant **enacted** that identity (e.g., inspecting archival steles, stepping into unmapped voids, or authoring a room rule).

### 2.5 Group & Asymmetric Intelligence (`ROOM_0204`)
In `ROOM_0204`, information is split across four complementary nodes:
- `Node A (Visual / Space)`: Reveals spatial coordinates;
- `Node B (Acoustic / Signal)`: Reveals harmonic interval;
- `Node C (Rule / Invariant)`: Reveals relational law;
- `Node D (Mechanism / Actuator)`: Applies the combined synthesis.
Followed by the **Trust / Divergence Proposition**:
- Claim unilateral advantage;
- Share credit with the group;
- Forge a mutual covenant;
- Reject the zero-sum dilemma and unlock a systemic third path.

### 2.6 Creator Room Mechanic (`Player → Designer` in `ROOM_0404`)
In a Creator Room (`ROOM_0404`) or via the integrated `Room Validator Studio`:
- The participant can author a new rule, leave a persistent architectural artifact/inscription in the room, or mount a newly validated `room.json` into the live world registry.
- Doing so increments `pathsCreated` and unlocks Creator-tier thresholds.

### 2.7 Reset / New Identity Experiment (`Cycle 2+`)
At `ROOM_0999` (`THE LAST DOOR`), the participant can initiate a **New Cycle (`DEATH / RESET`)**. Unlike a destructive wipe, a New Cycle increments `cycleCount`, preserves historical meta-memory, and measures whether the participant consciously experiments with an alternative cognitive strategy on their next pass.
