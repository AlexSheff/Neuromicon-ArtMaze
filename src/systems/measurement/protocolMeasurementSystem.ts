import { PlayerState } from '../../types/artmaze';

export interface PersonalCognitiveProfile {
  initiationTitleEn: string;
  initiationTitleRu: string;
  primaryModeEn: string;
  primaryModeRu: string;
  secondaryModeEn: string;
  secondaryModeRu: string;
  socialModeEn: string;
  socialModeRu: string;
  riskProfileEn: string;
  riskProfileRu: string;
  discoveryIndex: number;
  systemAwareness: number;
  adaptationIndex: number;
  metaMirrorLinesEn: string[];
  metaMirrorLinesRu: string[];
}

/**
 * Synthesizes Stage XII (Meta-Mirror), Stage XIV (Initiation), and Stage XV (Personal Cognitive Profile)
 * from observed behavioral interactions inside ArtMaze.
 */
export function computeCognitiveProfile(state: PlayerState): PersonalCognitiveProfile {
  const m = state.metrics;
  const discoveriesCount = state.discoveries.length;
  const roomsCount = state.visitedRooms.length;

  // Initiation Status (Stage XIV)
  let initiationTitleEn = 'You are now a Systems Observer.';
  let initiationTitleRu = 'Ваш статус посвящения: Наблюдатель Системы (Systems Observer).';

  if (discoveriesCount >= 4 && m.hiddenPathsSearched >= 3) {
    initiationTitleEn = 'You have discovered the 1149th door.';
    initiationTitleRu = 'Вы открыли 1149-ю дверь (Keeper of the 1149th Door).';
  } else if (m.pathsCreated >= 1 || (state.identity.creator ?? 0) >= 1) {
    initiationTitleEn = 'You are now a Creator.';
    initiationTitleRu = 'Ваш статус посвящения: Создатель (Creator).';
  } else if (roomsCount >= 4 || m.uncertaintyEmbraced >= 2) {
    initiationTitleEn = 'You are now a Cartographer.';
    initiationTitleRu = 'Ваш статус посвящения: Картограф (Cartographer).';
  }

  // Primary Mode
  let primaryModeEn = 'Explorer';
  let primaryModeRu = 'Исследователь (Explorer)';
  if (m.pathsCreated >= 1) {
    primaryModeEn = 'Creator / System Designer';
    primaryModeRu = 'Создатель Правил (Creator / System Designer)';
  } else if (m.hiddenPathsSearched >= 3) {
    primaryModeEn = 'Anomaly Seeker';
    primaryModeRu = 'Искатель Скрытых Слоёв (Anomaly Seeker)';
  } else if ((state.identity.archivist ?? 0) >= 1) {
    primaryModeEn = 'Archivist of Topologies';
    primaryModeRu = 'Архивариус Топологий (Archivist)';
  }

  // Secondary Mode
  const secondaryModeEn =
    m.strategyChanges >= 2
      ? 'Systems Thinker'
      : m.reflectionChecks >= 2
      ? 'Metacognitive Observer'
      : 'Pattern Investigator';
  const secondaryModeRu =
    m.strategyChanges >= 2
      ? 'Системный Мыслитель (Systems Thinker)'
      : m.reflectionChecks >= 2
      ? 'Метакогнитивный Наблюдатель'
      : 'Исследователь Закономерностей';

  // Social Mode
  const socialModeEn =
    m.strangersTrusted >= 1
      ? 'Selective Collaborator'
      : state.decisions['door:ROOM_0204:B'] === 'trust_refuse_zero_sum'
      ? 'Third-Path Architect'
      : 'Autonomous Navigator';
  const socialModeRu =
    m.strangersTrusted >= 1
      ? 'Избирательный Соучастник (Selective Collaborator)'
      : state.decisions['door:ROOM_0204:B'] === 'trust_refuse_zero_sum'
      ? 'Архитектор Третьего Решения'
      : 'Автономный Навигатор';

  // Risk Profile
  const riskProfileEn =
    m.uncertaintyEmbraced > m.uncertaintyAvoided
      ? 'High uncertainty tolerance'
      : m.uncertaintyEmbraced === m.uncertaintyAvoided && m.uncertaintyEmbraced > 0
      ? 'Calibrated boundary tester'
      : 'Deliberate structure-first verification';
  const riskProfileRu =
    m.uncertaintyEmbraced > m.uncertaintyAvoided
      ? 'Высокая терпимость к неопределённости'
      : m.uncertaintyEmbraced === m.uncertaintyAvoided && m.uncertaintyEmbraced > 0
      ? 'Сбалансированный исследователь границ'
      : 'Опора на проверку структуры';

  const discoveryIndex = Math.min(
    99,
    Math.round(38 + discoveriesCount * 9 + m.hiddenPathsSearched * 5)
  );
  const systemAwareness = Math.min(
    99,
    Math.round(
      42 +
        roomsCount * 6 +
        m.reflectionChecks * 7 +
        (state.discoveries.includes('SYSTEM_OBSERVATION_RECOGNIZED') ? 14 : 0)
    )
  );
  const adaptationIndex = Math.min(
    99,
    Math.round(
      36 +
        m.strategyChanges * 9 +
        m.pathsCreated * 14 +
        (state.cycleCount > 1 ? 15 : 0)
    )
  );

  const metaMirrorLinesEn = [
    `You avoided uncertainty ${m.uncertaintyAvoided} times.`,
    `You searched for hidden paths ${m.hiddenPathsSearched} times.`,
    `You trusted strangers ${m.strangersTrusted} times.`,
    `You changed your strategy ${m.strategyChanges} times.`,
    `You created ${m.pathsCreated} new paths.`,
  ];

  const metaMirrorLinesRu = [
    `Вы избежали неопределённости: ${m.uncertaintyAvoided} раз(а).`,
    `Вы искали скрытые пути: ${m.hiddenPathsSearched} раз(а).`,
    `Вы доверились другим участникам: ${m.strangersTrusted} раз(а).`,
    `Вы изменили свою стратегию: ${m.strategyChanges} раз(а).`,
    `Вы создали новых правил и путей: ${m.pathsCreated}.`,
  ];

  return {
    initiationTitleEn,
    initiationTitleRu,
    primaryModeEn,
    primaryModeRu,
    secondaryModeEn,
    secondaryModeRu,
    socialModeEn,
    socialModeRu,
    riskProfileEn,
    riskProfileRu,
    discoveryIndex,
    systemAwareness,
    adaptationIndex,
    metaMirrorLinesEn,
    metaMirrorLinesRu,
  };
}
