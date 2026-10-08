# ROOM_SPEC.md — Neuromicon ArtMaze Room Specification

**Specification version:** 1.0  
**Room format:** `ArtMaze Room Package`  
**Repository model:** one room = one GitHub repository  
**Owner:** Neuromicon ArtMaze  
**Language:** English for code, metadata and repository documentation

---

# 1. Purpose

This document defines the technical contract for an independent Neuromicon ArtMaze room.

A compliant room is a standalone GitHub repository that can be developed and validated independently and later registered in the main ArtMaze world.

The room must describe its environment, assets, interactions, doors, rules and optional game systems through data.

A room repository must not require direct modification of the main ArtMaze engine.

---

# 2. Fundamental Rule

```text
ONE ROOM = ONE GITHUB REPOSITORY
```

Example:

```text
ArtMaze-Room-0042/
```

The room repository contains everything required to instantiate that room, except assets explicitly supplied by the main engine.

---

# 3. Room Identity

Every room has a globally unique ID.

Recommended format:

```text
ROOM_0001
ROOM_0002
...
ROOM_1149
```

The repository name should match:

```text
ArtMaze-Room-0001
```

The canonical room ID is:

```text
ROOM_0001
```

The ID must never be reused for another room.

---

# 4. Minimal Repository Structure

```text
ArtMaze-Room-XXXX/
│
├── README.md
├── ROOM_SPEC.md
├── room.json
├── LICENSE
│
├── assets/
│   ├── models/
│   ├── textures/
│   ├── images/
│   └── materials/
│
├── audio/
│
├── data/
│   ├── objects.json
│   ├── puzzles.json
│   └── interactions.json
│
└── preview/
    └── preview.jpg
```

Only files actually used by the room need to exist.

---

# 5. `room.json`

`room.json` is the authoritative room manifest.

Minimum:

```json
{
  "specVersion": "1.0",
  "id": "ROOM_0042",
  "version": "1.0",
  "title": "The Room That Remembers",
  "author": "Alex",
  "type": "custom",
  "environment": {},
  "doors": []
}
```

---

# 6. Environment & Rules

The room environment may be:

- `standard`
- `procedural`
- `custom`
- `empty`
- `void`

The main engine remains responsible for rendering, XR, input, locomotion, generic interaction, state, and transitions.

---

# 7. Doors & Voids

Supported destination states:
- `ready`
- `planned`
- `void`
- `conditional`
- `disabled`

Valid void types:
- `infinity`
- `fractal`
- `fog`
- `darkness`
- `starfield`
- `mirror`
- `unknown`

Generic requirement types:
- `flag`
- `identity`
- `quest`
- `discovery`
- `room-state`
- `visit-count`
- `choice`

---

# 8. Interactions, Quests, Mirror & State

Supported generic interactions:
`inspect`, `look`, `touch`, `activate`, `rotate`, `open`, `close`, `push`, `pull`, `listen`, `read`, `observe`.

Supported quest types:
`observe`, `interact`, `solve`, `choose`, `remember`, `compare`, `discover`, `contradict`, `listen`, `wait`, `return`, `identity`.

Mirror choices:
`accept`, `reject`, `return`.

---

# 9. Final Contract

```text
ONE ROOM -> ONE REPOSITORY -> ONE room.json -> VALIDATED CONTRACT -> LOADABLE BY GENERIC ENGINE
```

An unfinished world is a valid world. A door into infinity is a valid door.
