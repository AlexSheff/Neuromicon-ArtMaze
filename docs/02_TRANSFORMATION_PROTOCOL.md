# 02. Transformation Protocol — The 16 Stages of ArtMaze

**Document ID:** `DOC-02`  
**Layer:** Narrative & Experiential Trajectory  
**Version:** 1.0

---

## 1. Protocol Overview

The participant journey is structured as a 16-stage state machine mapped onto a non-linear graph of rooms. A visitor may traverse these stages across different room sequences, revisit earlier stages with altered state, or bypass declared routes via Rabbit Holes.

```text
ORDINARY SELF
  ↓
[I. ENTRY] → [II. SEPARATION] → [III. FIRST CHOICE] → [IV. DISORIENTATION]
  ↓
[V. MIRROR] → [VI. TRIAL] → [VII. GROUP] → [VIII. BETRAYAL / TRUST]
  ↓
[IX. RABBIT HOLE] → [X. SYSTEM BREAK] → [XI. CREATOR ROOM] → [XII. META MIRROR]
  ↓
[XIII. DEATH / RESET] → [XIV. INITIATION] → [XV. RETURN (PROFILE)] → [XVI. THE LAST DOOR]
  ↓
ORDINARY WORLD (PLAYER CHANGED)
```

---

## 2. Stage Definitions

### I. ENTRY — Вход (`ROOM_0000`)
- **Objective**: Detach the participant from ordinary social expectations.
- **Inscription**: *"There is no single correct route here. Your decisions alter what happens next."*
- **First Mirror**: *"Whom do you expect to meet here?"* (Expressed through choice: A guide / A rival / An unknown version of myself / No one).
- **Baseline Capture**: Measures initial observation dwell time, safe vs. risky orientation, and curiosity before any explicit puzzle.

### II. SEPARATION — Отделение (`ROOM_0000` → Corridors & Voids)
- **Objective**: Shift scale, acoustics, and spatial continuity so the visitor senses that different laws apply without being handed a rulebook.

### III. FIRST CHOICE — Первый выбор (`ROOM_0000` Doors A / B / C / RH)
- **Objective**: First diagnostic window.
- **Structure**:
  - **Door A**: Follow the structured, declared path (`ROOM_0001`).
  - **Door B**: Investigate the irreversible threshold (`ROOM_0042`).
  - **Door C**: Step into the unknown (`Fractal Void`).
  - **Hidden Path (`RH`)**: Discover the `SHADOW_WITHOUT_OBJECT` anomaly on the floor before choosing any declared door.
- **Rule**: No option is marked "correct" or "incorrect."

### IV. DISORIENTATION — Слом привычного алгоритма (`ROOM_0001`, `ROOM_0042`)
- **Objective**: Invalidate single-mode problem solving across multiple cognitive modalities:
  1. **Logic & Spatial Comparison (`ROOM_0001`)**: An object stands physically in the hall but is absent from the mirror reflection (`REFLECTION_MISMATCH`).
  2. **Time, Memory & Paradox (`ROOM_0042`)**: The room forbids direct return (`returnAllowed: false`) and reconstructs its contents only after the player leaves through a Void and returns (`Visit 1` → `Visit 2` → `Visit 3`).
  3. **Ambiguity (`Painting Mutation`)**: A canvas changes only while ignored.

### V. MIRROR — Идентичность (`ROOM_0107`)
- **Objective**: Ask *"Who are you here?"* (`Explorer`, `Archivist`, `Observer`, `Creator`, `Skeptic`, `Unknown`).
- **Consequence**: The chosen identity alters persistent state (`identity.*`) and changes which doors and trials unlock downstream.

### VI. TRIAL — Испытание (`ROOM_0107` → Action Verification)
- **Objective**: `Identity → Action → Consequence`.
- **Mechanic**: Declaring an identity in the Mirror is insufficient; the participant must enact it (e.g., an `Archivist` must actually inspect and cross-reference the room's stele and taxonomy; an `Explorer` must traverse an unmapped threshold; a `Creator` must author a room modification).

### VII. GROUP — Другие люди (`ROOM_0204`)
- **Objective**: Transition from `individual intelligence → collective intelligence`.
- **Mechanic**: Information is partitioned across four asymmetric roles:
  - `Perspective A (Space)` — sees the geometric alignment;
  - `Perspective B (Sound)` — hears the harmonic interval;
  - `Perspective C (Rule)` — knows the invariant condition;
  - `Perspective D (Mechanism)` — controls the actuator.
- Only integrating all four perspectives unlocks the synthesis passage.

### VIII. BETRAYAL / TRUST — Доверие (`ROOM_0204`)
- **Objective**: Observe social architecture when participant incentives diverge.
- **Options**: Claim personal advantage, support the collective, establish a binding covenant, defect, refuse the zero-sum framing, or discover a third structural solution.

### IX. RABBIT HOLE — Скрытый слой (Cross-Room Mechanic)
- **Objective**: In every room, allow the participant to reject the stated problem (`game → game inside the game → observation of the system`).

### X. SYSTEM BREAK — Обнаружение правил (`ROOM_0404`)
- **Objective**: The participant realizes that rooms are not static levels—they respond to accumulated behavioral history, visit counts, and prior choices.

### XI. CREATOR ROOM — Создание (`ROOM_0404` & `Room Validator Studio`)
- **Objective**: `Player → Designer`.
- **Mechanic**: The participant modifies the labyrinth itself—inscribing a rule, placing a persistent object/clue for future traversal, or authoring a full `room.json` manifest.

### XII. META MIRROR — Второе зеркало (`ROOM_0999`)
- **Objective**: Reflect the participant's behavioral trajectory rather than an avatar:
  - *"You avoided uncertainty X times."*
  - *"You searched for hidden paths Y times."*
  - *"You trusted strangers Z times."*
  - *"You changed your strategy W times."*
  - *"You created K new paths."*
  - **Prompt**: *"Was this truly a labyrinth?"*

### XIII. DEATH / RESET — Новый цикл (`ROOM_0999`)
- **Objective**: Conscious replay as a **new identity experiment** (`Cycle 2+`). The world remembers the previous cycle count and tracks intentional strategy divergence.

### XIV. INITIATION — Посвящение (`ROOM_0999`)
- **Objective**: Grant an earned structural status based on observed behavior (`You are now a Cartographer`, `You are now a Creator`, `You have discovered the 1149th door`, `You are a Systems Observer`).

### XV. RETURN — Возвращение (`Personal Cognitive Profile`)
- **Objective**: Present the non-diagnostic behavioral synthesis (`PRIMARY MODE`, `SECONDARY MODE`, `SOCIAL MODE`, `RISK PROFILE`, `DISCOVERY INDEX`, `SYSTEM AWARENESS`, `ADAPTATION`).

### XVI. THE LAST DOOR — Последняя дверь (`ROOM_0999` → `ROOM_0000`)
- **Objective**: The final threshold leads back into the beginning (`ROOM_0000`) with transformed perception: *ArtMaze is not a place; it is a way of looking at reality.*
