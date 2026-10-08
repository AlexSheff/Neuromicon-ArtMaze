# 06. Room Bible — Complete Catalog of Protocol Rooms

**Document ID:** `DOC-06`  
**Layer:** Canonical Room Specifications (`ROOM_0000` .. `ROOM_1149`)  
**Version:** 1.0

---

## Overview of Canonical Rooms

| Room ID | Title (EN / RU) | Protocol Stage(s) | Primary Cognitive Modality | Hidden Layer / Rabbit Hole |
|---|---|---|---|---|
| `ROOM_0000` | The Central Labyrinth / Центральный Лабиринт | `I. ENTRY`, `II. SEPARATION`, `III. FIRST CHOICE` | Baseline autonomy, safe vs. risky choice, initial gaze attention | `SHADOW_WITHOUT_OBJECT` on northern floor → unlocks `Door RH` (`ROOM_0107`) |
| `ROOM_0001` | The Hall of Unseen Reflections / Зал Незримых Отражений | `IV. DISORIENTATION` (Spatial & Visual Logic) | Comparing physical space against mirror representation | Eastern monolith absent in mirror (`REFLECTION_MISMATCH`) → unlocks `Door RH` (`ROOM_0107`) |
| `ROOM_0042` | The Room That Remembers / Комната, Которая Помнит | `IV. DISORIENTATION` (Temporal Memory & Paradox) | Discovering that leaving via Void and returning mutates the room | `Visit 2+` materializes the Chair (`TEMPORAL_CHAIR_OBSERVED`) & unlocks `Door RH` (`ROOM_0204`) |
| `ROOM_0107` | The Archivist's Mirror / Зеркало Архивариуса | `V. MIRROR`, `VI. TRIAL` | Identity proposition (`ACCEPT / REJECT / RETURN`) + enacting the chosen role | Proving Archivist/Observer identity unlocks `Door C` (`ROOM_0204`) and `Door RH` (`ROOM_0404`) |
| `ROOM_0204` | The Chamber of Four Witnesses / Зал Четырёх Свидетелей | `VII. GROUP`, `VIII. BETRAYAL / TRUST` | Asymmetric collective intelligence (Space + Sound + Rule + Mechanism) & Trust dilemma | Synthesizing all 4 witness steles (`COLLECTIVE_SYNTHESIS`) unlocks `Door RH` (`ROOM_0404`) |
| `ROOM_0404` | The Loom of Rules / Станок Правил | `X. SYSTEM BREAK`, `XI. CREATOR ROOM` | Recognizing system observation; transitioning from `Player → Designer` | Authoring a rule on the Loom (`SYSTEM_RULE_CREATED`) unlocks `Door RH` (`ROOM_0999`) |
| `ROOM_0999` | The Threshold of Return / Порог Возвращения | `XII. META MIRROR`, `XIII. RESET`, `XIV. INITIATION`, `XV. RETURN`, `XVI. THE LAST DOOR` | Meta-reflection on decision history, Initiation, Personal Profile, and Cycle Reset | `Door Ω (THE LAST DOOR)` loops back to `ROOM_0000` on `Cycle + 1` with transformed world state |

---

## Detailed Room Specifications

### 1. `ROOM_0000` — The Central Labyrinth
- **Protocol Stages**: `I. ENTRY` → `II. SEPARATION` → `III. FIRST CHOICE`
- **Player State on Entry**: Ordinary context; expects explicit instructions or a standard tutorial.
- **Visible Mechanics**:
  - Entry inscription: *"There is no correct route here. Your decisions change what happens next."*
  - First Mirror (`mirror_entry_00`): *"Whom do you expect to meet here?"*
  - Four archival paintings (`painting_002` mutates its geometry when ignored).
  - Three declared doors: `Door A` (`ROOM_0001`), `Door B` (`ROOM_0042`), `Door C` (`Fractal Void`).
- **Hidden Layer**: A dark shadow on the floor (`obj_shadow_anomaly`) with no object above it. Inspecting it yields `SHADOW_WITHOUT_OBJECT` and reveals `Door RH` (`ROOM_0107`).
- **Measured Signals**: Initial dwell time, safe vs. risky door choice, whether the First Mirror and floor shadow are inspected before leaving.

---

### 2. `ROOM_0001` — The Hall of Unseen Reflections
- **Protocol Stage**: `IV. DISORIENTATION` (Spatial & Perceptual Contradiction)
- **Purpose**: Break the assumption that visual symmetry is reliable.
- **Visible Mechanics**: Two basalt monoliths (`obj_monolith_west`, `obj_monolith_east`) stand before a northern obsidian mirror (`THE_OBSERVER`).
- **Hidden Layer**: The eastern monolith has `"visibleInMirror": false`. Observing it unlocks `REFLECTION_MISMATCH` and opens `Door RH` (`ROOM_0107`).
- **Transitions**: `Door A` → `ROOM_0000`, `Door B` → `ROOM_0204`, `Door RH` → `ROOM_0107`.

---

### 3. `ROOM_0042` — The Room That Remembers
- **Protocol Stage**: `IV. DISORIENTATION` (Causality & Memory)
- **Purpose**: Break linear forward-only progression.
- **Visible Mechanics**: `returnAllowed: false`. On Visit 1, only the Chronicle Stone exists. Stepping through a Void (`infinity` or `starfield`) and returning increments `visitCount`.
- **Hidden Layer**: On Visit 2, a Chair appears (`TEMPORAL_CHAIR_OBSERVED`); on Visit 3, a Nocturnal Sundial appears (`THIRD_VISIT_RESONANCE`). `Door RH` opens on `visitCount >= 2` leading to `ROOM_0204`.

---

### 4. `ROOM_0107` — The Archivist's Mirror
- **Protocol Stages**: `V. MIRROR` & `VI. TRIAL`
- **Purpose**: Test `Identity → Action → Consequence`.
- **Visible Mechanics**: The Mirror proposes `THE_ARCHIVIST`. If accepted, the player must enact the role by inspecting both the `Taxonomy of Unbuilt Rooms` painting and the `Stele of Directed Edges` (`DIRECTED_TOPOLOGY_READ`).
- **Transitions**: `Door A` → `ROOM_0000`, `Door B` → `ROOM_0204`, `Door RH` (requires Archivist identity or Stele discovery) → `ROOM_0404`.

---

### 5. `ROOM_0204` — The Chamber of Four Witnesses
- **Protocol Stages**: `VII. GROUP` & `VIII. BETRAYAL / TRUST`
- **Purpose**: Test collective synthesis (`Space + Sound + Rule + Mechanism`) and social trust under diverging incentives.
- **Visible Mechanics**:
  - Four asymmetric Witness Steles (`Witness A: Space`, `Witness B: Sound`, `Witness C: Rule`, `Witness D: Mechanism`).
  - Door Propositions that test whether the visitor claims unilateral advantage, shares with the group, builds a covenant, or finds a systemic third option (`COLLECTIVE_SYNTHESIS`).
- **Transitions**: `Door A` → `ROOM_0107`, `Door B` → `ROOM_0404`, `Door RH` → `ROOM_0999`.

---

### 6. `ROOM_0404` — The Loom of Rules (System Break & Creator Room)
- **Protocol Stages**: `X. SYSTEM BREAK` & `XI. CREATOR ROOM`
- **Purpose**: Reveal that the labyrinth adapts to prior choices, and empower the visitor to transition from `Player → Designer`.
- **Visible Mechanics**:
  - The `System Observation Archive` stele showing how rooms react to state.
  - The `Creator Plinth (Loom of Rules)` where the visitor can author a persistent rule/artifact (`SYSTEM_RULE_CREATED`), incrementing `pathsCreated`.
- **Transitions**: `Door A` → `ROOM_0204`, `Door B` → `ROOM_0999`, `Door RH` → `ROOM_0999`.

---

### 7. `ROOM_0999` — The Threshold of Return (Meta-Mirror & The Last Door)
- **Protocol Stages**: `XII. META MIRROR` → `XIII. DEATH / RESET` → `XIV. INITIATION` → `XV. RETURN` → `XVI. THE LAST DOOR`
- **Purpose**: Confront the visitor with their own behavioral history, grant Initiation, synthesize the `Personal Cognitive Profile`, and reveal that **The Last Door** leads back into `ROOM_0000` on a new Cycle (`Player Changed`).
