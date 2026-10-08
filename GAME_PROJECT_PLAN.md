# Neuromicon ArtMaze — Game Project Plan

**Status:** Draft v1.0  
**Owner:** Alex  
**Primary target:** Meta Quest 2 WebXR  
**Secondary target:** Desktop browser  
**Hosting:** GitHub / GitHub Pages  
**Architecture:** Static-first, modular, room repositories  
**Code language:** English  
**Product copy:** RU/EN

---

## 1. Project Definition

**Neuromicon ArtMaze** is a browser-based XR game/world consisting of a central multidimensional labyrinth (`ROOM_0000`) and independently created rooms (`ROOM_0001` .. `ROOM_1149`).

The player enters a central maze containing corridors, walls, framed artworks and doors. The maze itself is a room and follows its own rules. Every other room is an independent package conforming to `ROOM_SPEC.md`.

The world does not need to be complete. An unimplemented destination is a valid state of the world. A door may open into infinity, a 3D fractal, darkness, fog, mirror space or another defined void.

---

## 2. Core Topology

```text
physical topology != logical topology != semantic topology != player state
```

The same room may behave differently depending on the player's accumulated identity, discoveries, decisions and previous visits.

---

## 3. Development Phases

- **Phase 0 — Specification**: `GAME_PROJECT_PLAN.md`, `ROOM_SPEC.md`, JSON schemas, main repository skeleton, sample room repositories, validator.
- **Phase 1 — Main Maze Prototype**: Maze geometry, doors, framed paintings, lighting, locomotion, WebXR + desktop controls, void system, room registry.
- **Phase 2 — Room Contract**: External room loader, room validator, room manifest, transition system, standalone room test harness.
- **Phase 3 — First Real Rooms**: Distinct rooms (`ROOM_0000`, `ROOM_0001`, `ROOM_0042`, `ROOM_0107`) demonstrating non-Euclidean and state-reactive mechanics.
- **Phase 4 — Game Systems**: Quests, mirrors, identity, observation, discoveries, room state, persistent player state, rabbit holes.
