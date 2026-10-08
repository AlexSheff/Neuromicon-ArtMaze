import { ComfortMode, CorridorBranch } from '../room-sdk';

export type HubLocation = 'threshold' | 'corridor' | 'room';

export interface RadioMessage {
  author: string;
  text: string;
  timestamp: string;
}

export interface HubPlayerState {
  /** Diegetic choice made in the Threshold Hall: 'ascend' (grow/embody) or 'descend' (search/explore) */
  path: CorridorBranch | null;
  /** Current spatial context inside the single-page WebXR session */
  location: HubLocation;
  /** Active branch in the Main Corridor */
  branch: CorridorBranch;
  /** Active chunked segment index (1 or 2) in the Main Corridor */
  segment: 1 | 2;
  /** Currently mounted Room ID when location === 'room' */
  currentRoomId: string | null;
  /** Rooms visited by the player (shown on signage and visited map) */
  visitedRooms: string[];
  /** Rooms where the quest objective has been completed */
  completedRooms: string[];
  /** Persistent identity choices per room from the Mirror system */
  identityChoices: Record<string, 'accept' | 'reject'>;
  /** Unlocked rule-violation / reflection discoveries */
  discoveries: string[];
  /** VR & Desktop comfort mode (§4A.3) */
  comfortMode: ComfortMode;
  /** Snap turn angle in degrees (eliminates continuous rotational vection) */
  snapTurnDegrees: 30 | 45;
  /** Peripheral comfort vignette during movement */
  vignetteEnabled: boolean;
  /** Radio / comment log per channel (Key T) */
  radioChannels: Record<string, RadioMessage[]>;
}

const HUB_STORAGE_KEY = 'neuromicon_artmaze_hub_v1';

function createDefaultHubState(): HubPlayerState {
  return {
    path: null,
    location: 'threshold',
    branch: 'ascend',
    segment: 1,
    currentRoomId: null,
    visitedRooms: [],
    completedRooms: [],
    identityChoices: {},
    discoveries: [],
    comfortMode: 'teleport',
    snapTurnDegrees: 30,
    vignetteEnabled: true,
    radioChannels: {
      THRESHOLD: [
        {
          author: 'ARCHITECT',
          text: 'Above: Ascent (Embody / Grow). Below: Descent (Search / Explore). Choose physically.',
          timestamp: '00:00',
        },
      ],
      ROOM_073: [
        {
          author: 'ARCHIVIST',
          text: 'Count the monoliths in the room, then count them inside the mirror glass.',
          timestamp: '01:14',
        },
      ],
    },
  };
}

class HubPlayerStateStore {
  private state: HubPlayerState;
  private listeners: Set<(state: HubPlayerState) => void> = new Set();

  constructor() {
    this.state = this.load();
  }

  private load(): HubPlayerState {
    try {
      const raw = window.localStorage.getItem(HUB_STORAGE_KEY);
      if (!raw) return createDefaultHubState();
      const parsed = JSON.parse(raw) as Partial<HubPlayerState>;
      return {
        ...createDefaultHubState(),
        ...parsed,
      };
    } catch {
      return createDefaultHubState();
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
    const snap = this.getState();
    this.listeners.forEach((cb) => cb(snap));
  }

  public getState(): HubPlayerState {
    return {
      ...this.state,
      visitedRooms: [...this.state.visitedRooms],
      completedRooms: [...this.state.completedRooms],
      discoveries: [...this.state.discoveries],
      identityChoices: { ...this.state.identityChoices },
      radioChannels: { ...this.state.radioChannels },
    };
  }

  public subscribe(listener: (state: HubPlayerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Diegetic choice in the Threshold Hall: sets player.path ('ascend' | 'descend')
   * and enters Segment 1 of that branch.
   */
  public chooseBranchFromThreshold(branch: CorridorBranch): void {
    this.state.path = branch;
    this.state.branch = branch;
    this.state.segment = 1;
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    this.save();
  }

  public returnToThreshold(): void {
    this.state.location = 'threshold';
    this.state.currentRoomId = null;
    this.save();
  }

  public setCorridorSegment(branch: CorridorBranch, segment: 1 | 2): void {
    if (!this.state.path) {
      this.state.path = branch;
    }
    this.state.branch = branch;
    this.state.segment = segment;
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    this.save();
  }

  public enterRoom(
    roomId: string,
    fromBranch?: CorridorBranch,
    fromSegment?: 1 | 2
  ): void {
    if (fromBranch) this.state.branch = fromBranch;
    if (fromSegment) this.state.segment = fromSegment;
    this.state.location = 'room';
    this.state.currentRoomId = roomId;
    if (!this.state.visitedRooms.includes(roomId)) {
      this.state.visitedRooms.push(roomId);
    }
    this.save();
  }

  /**
   * Returns from a room back to the exact Main Corridor branch & segment where the player left (§4A.9).
   */
  public returnToCorridor(): void {
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    this.save();
  }

  public markQuestCompleted(roomId: string): void {
    if (!this.state.completedRooms.includes(roomId)) {
      this.state.completedRooms.push(roomId);
      this.save();
    }
  }

  public recordMirrorChoice(
    roomId: string,
    choice: 'accept' | 'reject'
  ): void {
    this.state.identityChoices[roomId] = choice;
    this.save();
  }

  public unlockDiscovery(key: string): void {
    if (!this.state.discoveries.includes(key)) {
      this.state.discoveries.push(key);
      this.save();
    }
  }

  public setComfortMode(mode: ComfortMode): void {
    this.state.comfortMode = mode;
    this.save();
  }

  public setSnapTurnDegrees(deg: 30 | 45): void {
    this.state.snapTurnDegrees = deg;
    this.save();
  }

  public toggleVignette(): void {
    this.state.vignetteEnabled = !this.state.vignetteEnabled;
    this.save();
  }

  public postRadioMessage(
    channel: string,
    text: string,
    author = 'TRAVELER'
  ): void {
    const existing = this.state.radioChannels[channel] ?? [];
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    this.state.radioChannels[channel] = [
      ...existing,
      { author, text, timestamp },
    ];
    this.save();
  }

  public resetProgress(): void {
    this.state = createDefaultHubState();
    this.save();
  }
}

export const hubPlayerState = new HubPlayerStateStore();
