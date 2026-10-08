import { DoorDefinition, VoidType } from '../../types/artmaze';
import { evaluateDoor } from '../../systems/doors/doorSystem';
import { spatialAudioSystem } from '../../systems/audio/spatialAudioSystem';
import { playerStateStore } from '../../systems/state/playerStateStore';
import { loadRoomManifest } from '../loader/roomLoader';
import { getRoomRegistry } from '../registry/roomRegistry';

export interface TransitionResult {
  kind: 'room' | 'void' | 'locked';
  targetRoomId?: string;
  voidType?: VoidType;
  message: string;
  messageRu: string;
}

export function executeDoorTransition(
  door: DoorDefinition,
  overrideDestination?: string | null,
  overrideVoid?: VoidType
): TransitionResult {
  const state = playerStateStore.getState();
  const registry = getRoomRegistry();
  const isRabbitHole = door.type === 'rabbit-hole' || door.id === 'RH';

  if (overrideVoid) {
    playerStateStore.enterVoid(overrideVoid);
    spatialAudioSystem.triggerChime(329.63);
    return {
      kind: 'void',
      voidType: overrideVoid,
      message: `Entered ${overrideVoid.toUpperCase()} void through Door ${door.id}.`,
      messageRu: `Переход в пустоту (${overrideVoid.toUpperCase()}) через Дверь ${door.id}.`,
    };
  }

  if (overrideDestination !== undefined) {
    if (overrideDestination === null) {
      const vType = door.fallback?.type ?? 'infinity';
      playerStateStore.enterVoid(vType);
      spatialAudioSystem.triggerChime(329.63);
      return {
        kind: 'void',
        voidType: vType,
        message: `Door ${door.id} opened into ${vType} void.`,
        messageRu: `Дверь ${door.id} открылась в пустоту (${vType}).`,
      };
    }
    const targetManifest = loadRoomManifest(overrideDestination);
    if (targetManifest) {
      playerStateStore.enterRoom(overrideDestination, isRabbitHole);
      spatialAudioSystem.triggerChime(523.25);
      return {
        kind: 'room',
        targetRoomId: overrideDestination,
        message: `Transitioned to ${targetManifest.id} — ${targetManifest.title}.`,
        messageRu: `Переход в ${targetManifest.id} — ${targetManifest.titleRu || targetManifest.title}.`,
      };
    }
  }

  const evalResult = evaluateDoor(door, state, registry);

  if (!evalResult.isUnlocked) {
    return {
      kind: 'locked',
      message: `Door ${door.id} remains sealed (${evalResult.reason || 'Condition unmet'}).`,
      messageRu: `Дверь ${door.id} закрыта (${evalResult.reason || 'Условие не выполнено'}).`,
    };
  }

  if (evalResult.resolvedTargetRoomId) {
    const manifest = loadRoomManifest(evalResult.resolvedTargetRoomId);
    if (manifest) {
      playerStateStore.enterRoom(manifest.id, isRabbitHole);
      spatialAudioSystem.triggerChime(523.25);
      return {
        kind: 'room',
        targetRoomId: manifest.id,
        message: `Entered ${manifest.id} — ${manifest.title}`,
        messageRu: `Вход в ${manifest.id} — ${manifest.titleRu || manifest.title}`,
      };
    }
  }

  const voidType = evalResult.resolvedVoidType ?? 'infinity';
  playerStateStore.enterVoid(voidType);
  spatialAudioSystem.triggerChime(329.63);
  return {
    kind: 'void',
    voidType,
    message: `Door ${door.id} opens into ${voidType.toUpperCase()} void.`,
    messageRu: `Дверь ${door.id} ведёт в пустоту: ${voidType.toUpperCase()}.`,
  };
}
