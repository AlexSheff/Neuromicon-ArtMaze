import {
  GenericInteractionType,
  PaintingDefinition,
  RoomObjectDefinition,
} from '../../types/artmaze';
import { unlockDiscovery } from '../discovery/discoverySystem';
import { playerStateStore } from '../state/playerStateStore';

export interface InteractionOutcome {
  verb: GenericInteractionType | string;
  targetId: string;
  title: string;
  message: string;
  messageRu: string;
  newDiscoveryId?: string;
}

export function performObjectInteraction(
  roomId: string,
  object: RoomObjectDefinition,
  verb: GenericInteractionType = 'inspect'
): InteractionOutcome {
  playerStateStore.recordObjectInspection(roomId, object.id);

  let newDiscoveryId: string | undefined;
  if (object.discoveryId) {
    const unlocked = unlockDiscovery(object.discoveryId, roomId);
    if (unlocked) {
      newDiscoveryId = object.discoveryId;
    }
  }

  const title = object.title || object.id;
  const titleRu = object.titleRu || title;

  if (object.type === 'shadow_anomaly') {
    return {
      verb,
      targetId: object.id,
      title,
      message: `You examine the dark silhouette on the floor. Nothing stands above it to block the light. [Discovery: ${object.discoveryId}]`,
      messageRu: `Вы изучаете тёмный силуэт на полу. Над ним нет ничего, что могло бы преградить свет. [Открытие: ${object.discoveryId}]`,
      newDiscoveryId,
    };
  }

  if (object.type === 'reflection_anomaly') {
    return {
      verb,
      targetId: object.id,
      title,
      message: `The stone monolith is cold and solid under your hand, yet the northern mirror shows empty floor where it stands. [Discovery: ${object.discoveryId}]`,
      messageRu: `Каменный монолит холоден и реален под рукой, однако северное зеркало показывает пустой пол на его месте. [Открытие: ${object.discoveryId}]`,
      newDiscoveryId,
    };
  }

  if (object.type === 'chair') {
    return {
      verb,
      targetId: object.id,
      title,
      message: `This chair was not here during your first visit. It faces the entrance as though awaiting your return.`,
      messageRu: `Этого стула здесь не было во время вашего первого визита. Он повёрнут ко входу, словно ожидая вашего возвращения.`,
      newDiscoveryId,
    };
  }

  return {
    verb,
    targetId: object.id,
    title: `${title} / ${titleRu}`,
    message: `Observed "${title}". Physical objects remain bound to their room; only what you notice travels with you.`,
    messageRu: `Изучено «${titleRu}». Физические объекты остаются внутри комнаты; с вами путешествует лишь замеченное.`,
    newDiscoveryId,
  };
}

export function performPaintingInteraction(
  roomId: string,
  painting: PaintingDefinition
): InteractionOutcome {
  playerStateStore.recordPaintingInspection(roomId, painting.id);

  let newDiscoveryId: string | undefined;
  if (painting.interaction?.discovery) {
    const unlocked = unlockDiscovery(painting.interaction.discovery, roomId);
    if (unlocked) {
      newDiscoveryId = painting.interaction.discovery;
    }
  }

  return {
    verb: painting.interaction?.type ?? 'inspect',
    targetId: painting.id,
    title: painting.metadata.title,
    message:
      painting.metadata.inscription ||
      `${painting.metadata.title} — ${painting.metadata.author} (${painting.metadata.license})`,
    messageRu:
      painting.metadata.inscriptionRu ||
      painting.metadata.inscription ||
      `${painting.metadata.titleRu || painting.metadata.title} — ${painting.metadata.author}`,
    newDiscoveryId,
  };
}
