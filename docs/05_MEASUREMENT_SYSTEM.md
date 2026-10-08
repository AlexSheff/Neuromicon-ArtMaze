# 05. Measurement System — Behavioral Ledger & Cognitive Profile

**Document ID:** `DOC-05`  
**Layer:** Local-First Behavioral Telemetry & Profile Synthesis  
**Version:** 1.0

---

## 1. Privacy & Local-First Invariant

All behavioral measurements are computed and persisted strictly locally (`localStorage` key `neuromicon_artmaze_state_v1`). No personal data, external accounts, or remote analytics servers are used.

---

## 2. Recorded Behavioral Counters (`BehavioralMetrics`)

The engine records the following behavioral counters and event sequences:

| Counter / Metric | Trigger Event | Meaning in Protocol |
|---|---|---|
| `uncertaintyAvoided` | Choosing declared safe/known doors or retreating immediately from Voids | Preference for predictable, bounded structure. |
| `uncertaintyEmbraced` | Entering `void` or `planned` doors (`fractal`, `infinity`, `starfield`, `mirror`) | Tolerance for ambiguity and unmapped states. |
| `hiddenPathsSearched` | Sustained gaze inspections, anomaly detections, and `RH` (Rabbit Hole) transitions | Tendency to look beyond the stated problem. |
| `strangersTrusted` | Cooperative synthesis and covenant/group choices in `ROOM_0204` | Collaborative vs. unilateral social orientation. |
| `strategyChanges` | Reversing a previous door/mirror decision or adopting a new approach on revisit / Cycle 2+ | Model revision and cognitive flexibility. |
| `pathsCreated` | Forging a new rule/artifact in `ROOM_0404` or mounting a custom `room.json` manifest | Transition from `Player` to `Designer`. |
| `reflectionChecks` | Consulting Mirrors (`Entry`, `Observer`, `Archivist`, `Meta-Mirror`) | Metacognitive self-observation. |
| `cycleCount` | Traversing `THE LAST DOOR` or initiating a conscious `Reset / New Identity Experiment` | Willingness to test alternative identities. |

---

## 3. Initiation Status (`Stage XIV`)

Based on behavioral dominance, the participant receives an Initiation Title:

1. **`You have discovered the 1149th door`** — Unlocked when `discoveries.length >= 4` and `hiddenPathsSearched >= 3`.
2. **`You are now a Creator`** — Unlocked when `pathsCreated >= 1`.
3. **`You are now a Cartographer`** — Unlocked when `visitedRooms.length >= 5` and `uncertaintyEmbraced >= 2`.
4. **`You are now a Systems Observer`** — Default initiation for attentive traversal of the protocol.

---

## 4. Personal Cognitive Profile (`Stage XV — Return`)

The synthesized profile presents seven behavioral indicators:

```text
PRIMARY MODE          Explorer | Systems Thinker | Creator | Archivist | Autonomous Skeptic
SECONDARY MODE        Anomaly Hunter | Pattern Architect | Contemplative Observer | Boundary Tester
SOCIAL MODE           Collective Synthesizer | Selective Collaborator | Autonomous Agent | Covenant Builder
RISK PROFILE          High uncertainty tolerance | Calibrated explorer | Structure-seeking
DISCOVERY INDEX       0 – 100 (derived from anomalies, rabbit holes, and unprompted inspections)
SYSTEM AWARENESS      0 – 100 (derived from revisits, reflection checks, and causal rule discovery)
ADAPTATION            0 – 100 (derived from strategy revisions, cycle experiments, and created paths)
```
