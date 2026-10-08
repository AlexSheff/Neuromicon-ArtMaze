import { PlayerState, QuestDefinition } from '../../types/artmaze';
import { playerStateStore } from '../state/playerStateStore';

export function isQuestCompleted(state: PlayerState, quest?: QuestDefinition | null): boolean {
  if (!quest) return false;
  if (quest.completion.type === 'discover') {
    return state.discoveries.includes(quest.completion.target);
  }
  if (quest.completion.type === 'flag') {
    return Boolean(state.flags[quest.completion.target]);
  }
  return false;
}

export function selectQuestOption(
  roomId: string,
  questId: string,
  optionId: string,
  consequenceFlag?: string
): void {
  playerStateStore.recordDecision(`quest:${roomId}:${questId}`, optionId, consequenceFlag);
}
