import {
  DoorDefinition,
  DoorRequirement,
  PlayerState,
  RoomRegistryManifest,
  VoidType,
} from '../../types/artmaze';
import { meetsIdentityRequirement } from '../identity/identitySystem';

export interface DoorEvaluation {
  door: DoorDefinition;
  isVisible: boolean;
  isUnlocked: boolean;
  resolvedTargetRoomId: string | null;
  resolvedVoidType: VoidType | null;
  reason?: string;
}

export function checkDoorRequirement(
  requirement: DoorRequirement | undefined,
  state: PlayerState
): boolean {
  if (!requirement) return true;

  switch (requirement.type) {
    case 'discovery':
      return state.discoveries.includes(requirement.id);
    case 'flag':
      return Boolean(state.flags[requirement.id]);
    case 'identity':
      return meetsIdentityRequirement(
        state,
        requirement.id,
        requirement.minValue ?? 1
      );
    case 'visit-count': {
      const rState = state.roomStates[requirement.id];
      const count = rState ? rState.visitCount : 0;
      return count >= (requirement.minValue ?? 2);
    }
    case 'quest':
      return Boolean(state.flags[requirement.id] || state.discoveries.includes(requirement.id));
    case 'choice':
      return Boolean(state.decisions[requirement.id]);
    case 'room-state': {
      const currentRoom = state.roomStates[state.currentRoomId];
      return Boolean(currentRoom?.variables[requirement.id]);
    }
    default:
      return false;
  }
}

export function evaluateDoor(
  door: DoorDefinition,
  state: PlayerState,
  registry: RoomRegistryManifest
): DoorEvaluation {
  const requirementMet = checkDoorRequirement(door.requirement, state);

  // Hidden rabbit-hole doors only become visible once their requirement is met
  const isVisible =
    door.visibility !== 'hidden' ? true : requirementMet;

  if (door.status === 'disabled') {
    return {
      door,
      isVisible,
      isUnlocked: false,
      resolvedTargetRoomId: null,
      resolvedVoidType: null,
      reason: 'disabled',
    };
  }

  if (door.status === 'conditional' && !requirementMet) {
    return {
      door,
      isVisible,
      isUnlocked: false,
      resolvedTargetRoomId: null,
      resolvedVoidType: door.fallback?.type ?? null,
      reason: `Requires ${door.requirement?.type}: ${door.requirement?.id}`,
    };
  }

  if (door.status === 'void' || door.destination === null) {
    return {
      door,
      isVisible,
      isUnlocked: true,
      resolvedTargetRoomId: null,
      resolvedVoidType: door.fallback?.type ?? 'infinity',
    };
  }

  const targetEntry = registry.rooms[door.destination];
  if (door.status === 'planned' || !targetEntry || targetEntry.status !== 'ready') {
    return {
      door,
      isVisible,
      isUnlocked: true,
      resolvedTargetRoomId: null,
      resolvedVoidType: door.fallback?.type ?? 'infinity',
    };
  }

  return {
    door,
    isVisible,
    isUnlocked: true,
    resolvedTargetRoomId: door.destination,
    resolvedVoidType: null,
  };
}
