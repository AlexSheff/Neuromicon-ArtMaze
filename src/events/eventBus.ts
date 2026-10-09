import { CorridorBranch } from '../room-sdk';

export type OnboardingStepId =
  | 'BOOT'
  | 'ENTRY'
  | 'AWAKEN'
  | 'LEARN_MOVE'
  | 'LEARN_INTERACT'
  | 'REVEAL'
  | 'CHOOSE'
  | 'COMMITTED';

export type ControlRevealId = 'zoom' | 'radio' | 'audio' | 'comfort' | 'codex';
export type DiscoveredControlId = ControlRevealId;

export interface ArtmazeEventMap {
  'onboarding:step': { from: OnboardingStepId; to: OnboardingStepId };
  'onboarding:hint': { step: OnboardingStepId; rung: 1 | 2 | 3 | 4 };
  'door:enter': {
    roomId: string;
    doorId?: string;
    fromBranch?: CorridorBranch;
    fromSegment?: 1 | 2;
  };
  'mirror:choice': { roomId: string; choice: 'accept' | 'reject' | 'back' };
  'room:mounted': { roomId: string; durationMs: number };
  'room:void_fallback': {
    roomId: string;
    reason: 'timeout' | 'hash_mismatch' | 'planned';
  };
  'comfort:changed': {
    locomotion: 'teleport' | 'smooth';
    seated: boolean;
    snap: 30 | 45;
  };
  'control:revealed': { control: ControlRevealId };
  'codex:unlocked': { entryId: string };
  'audio:caption': { textId: string };
  'player:teleported': { x: number; z: number; count: number };
  'player:interacted': { targetId: string };
}

type EventListener<K extends keyof ArtmazeEventMap> = (
  payload: ArtmazeEventMap[K]
) => void;

/**
 * Single typed event bus for Neuromicon Artmaze (EXPERIENCE_PROTOCOL.md §7.1).
 * Systems communicate via events rather than tight coupling.
 */
class TypedEventBus {
  private listeners = new Map<
    keyof ArtmazeEventMap,
    Set<(payload: unknown) => void>
  >();

  public on<K extends keyof ArtmazeEventMap>(
    event: K,
    listener: EventListener<K>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = listener as (payload: unknown) => void;
    set.add(wrapped);
    return () => {
      set?.delete(wrapped);
    };
  }

  public emit<K extends keyof ArtmazeEventMap>(
    event: K,
    payload: ArtmazeEventMap[K]
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((cb) => {
      try {
        cb(payload);
      } catch {
        // Prevent listener errors from breaking frame loop
      }
    });
  }
}

export const eventBus = new TypedEventBus();
