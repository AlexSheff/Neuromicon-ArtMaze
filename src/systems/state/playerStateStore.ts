import {
  BehavioralSignalType,
  PlayerState,
  RoomRuntimeState,
  VoidType,
} from '../../types/artmaze';

const STORAGE_KEY = 'neuromicon_artmaze_state_v1';

export function createInitialPlayerState(): PlayerState {
  return {
    currentRoomId: 'ROOM_0000',
    activeVoid: null,
    previousRoomId: null,
    cycleCount: 1,
    visitedRooms: ['ROOM_0000'],
    identity: {
      observer: 0,
      archivist: 0,
      creator: 0,
    },
    beliefs: {},
    memories: [],
    discoveries: [],
    decisions: {},
    flags: {},
    roomStates: {
      ROOM_0000: {
        visitCount: 1,
        objectsInspected: [],
        paintingsInspected: [],
        puzzleSolved: false,
        anomaliesDetected: [],
        variables: {},
      },
    },
    metrics: {
      uncertaintyAvoided: 0,
      uncertaintyEmbraced: 0,
      hiddenPathsSearched: 0,
      strangersTrusted: 0,
      strategyChanges: 0,
      pathsCreated: 0,
      reflectionChecks: 0,
    },
    createdArtifacts: [],
  };
}

class PlayerStateStore {
  private state: PlayerState;
  private listeners: Set<(state: PlayerState) => void> = new Set();

  constructor() {
    this.state = this.load();
  }

  private load(): PlayerState {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialPlayerState();
      const parsed = JSON.parse(raw) as Partial<PlayerState>;
      const initial = createInitialPlayerState();
      return {
        ...initial,
        ...parsed,
        metrics: {
          ...initial.metrics,
          ...(parsed.metrics || {}),
        },
        createdArtifacts: parsed.createdArtifacts || [],
      };
    } catch {
      return createInitialPlayerState();
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }

  private notify(): void {
    this.save();
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  public getState(): PlayerState {
    return JSON.parse(JSON.stringify(this.state)) as PlayerState;
  }

  public subscribe(listener: (state: PlayerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public ensureRoomState(roomId: string): RoomRuntimeState {
    if (!this.state.roomStates[roomId]) {
      this.state.roomStates[roomId] = {
        visitCount: 0,
        objectsInspected: [],
        paintingsInspected: [],
        puzzleSolved: false,
        anomaliesDetected: [],
        variables: {},
      };
    }
    return this.state.roomStates[roomId];
  }

  public enterRoom(roomId: string, viaRabbitHole = false): void {
    const prev = this.state.currentRoomId;
    this.state.previousRoomId = prev;
    this.state.currentRoomId = roomId;
    this.state.activeVoid = null;

    if (!this.state.visitedRooms.includes(roomId)) {
      this.state.visitedRooms.push(roomId);
    }

    if (viaRabbitHole) {
      this.state.metrics.hiddenPathsSearched += 1;
    }

    const rState = this.ensureRoomState(roomId);
    rState.visitCount += 1;
    if (rState.visitCount > 1) {
      this.state.metrics.strategyChanges += 1;
    }

    this.notify();
  }

  public enterVoid(voidType: VoidType): void {
    this.state.activeVoid = voidType;
    this.state.metrics.uncertaintyEmbraced += 1;
    const memoryTag = `VOID_ENTERED:${voidType.toUpperCase()}`;
    if (!this.state.memories.includes(memoryTag)) {
      this.state.memories.push(memoryTag);
    }
    this.notify();
  }

  public exitVoidToRoom(targetRoomId?: string): void {
    const destination = targetRoomId || this.state.currentRoomId || 'ROOM_0000';
    this.state.activeVoid = null;
    this.enterRoom(destination);
  }

  public recordDiscovery(discoveryId: string, roomId?: string): boolean {
    const isNew = !this.state.discoveries.includes(discoveryId);
    if (isNew) {
      this.state.discoveries.push(discoveryId);
      this.state.metrics.hiddenPathsSearched += 1;
    }
    const targetRoom = roomId || this.state.currentRoomId;
    const rState = this.ensureRoomState(targetRoom);
    if (!rState.anomaliesDetected.includes(discoveryId)) {
      rState.anomaliesDetected.push(discoveryId);
    }
    if (isNew) {
      this.notify();
    }
    return isNew;
  }

  public recordObjectInspection(roomId: string, objectId: string): void {
    const rState = this.ensureRoomState(roomId);
    if (!rState.objectsInspected.includes(objectId)) {
      rState.objectsInspected.push(objectId);
      this.notify();
    }
  }

  public recordPaintingInspection(roomId: string, paintingId: string): void {
    const rState = this.ensureRoomState(roomId);
    if (!rState.paintingsInspected.includes(paintingId)) {
      rState.paintingsInspected.push(paintingId);
      this.notify();
    }
  }

  public applyIdentityDelta(deltas: Record<string, number>): void {
    for (const [trait, delta] of Object.entries(deltas)) {
      const current = this.state.identity[trait] ?? 0;
      this.state.identity[trait] = Number((current + delta).toFixed(2));
    }
    this.notify();
  }

  public recordMirrorChoice(
    roomId: string,
    choice: 'accept' | 'reject' | 'return',
    deltas?: Record<string, number>
  ): void {
    const rState = this.ensureRoomState(roomId);
    if (rState.mirrorChoice && rState.mirrorChoice !== choice) {
      this.state.metrics.strategyChanges += 1;
    }
    rState.mirrorChoice = choice;
    this.state.metrics.reflectionChecks += 1;
    this.state.decisions[`mirror:${roomId}`] = choice;
    if (deltas) {
      for (const [trait, delta] of Object.entries(deltas)) {
        const current = this.state.identity[trait] ?? 0;
        this.state.identity[trait] = Number((current + delta).toFixed(2));
      }
    }
    this.notify();
  }

  public recordDecision(
    key: string,
    value: string,
    flag?: string,
    signal?: BehavioralSignalType
  ): void {
    const prev = this.state.decisions[key];
    if (prev && prev !== value) {
      this.state.metrics.strategyChanges += 1;
    }
    this.state.decisions[key] = value;
    if (flag) {
      this.state.flags[flag] = true;
    }
    if (signal === 'safe') {
      this.state.metrics.uncertaintyAvoided += 1;
    } else if (signal === 'risky') {
      this.state.metrics.uncertaintyEmbraced += 1;
    } else if (signal === 'covenant' || signal === 'trust') {
      this.state.metrics.strangersTrusted += 1;
    } else if (signal === 'third_path') {
      this.state.metrics.hiddenPathsSearched += 1;
    } else if (signal === 'cycle_reset') {
      this.startNewIdentityCycle();
      return;
    }
    this.notify();
  }

  public recordCreatedRule(roomId: string, ruleText: string): void {
    this.state.metrics.pathsCreated += 1;
    this.state.createdArtifacts.push({
      id: `rule_${Date.now()}`,
      roomId,
      ruleText,
      cycle: this.state.cycleCount,
    });
    if (!this.state.discoveries.includes('SYSTEM_RULE_CREATED')) {
      this.state.discoveries.push('SYSTEM_RULE_CREATED');
    }
    this.state.identity.creator = (this.state.identity.creator ?? 0) + 1;
    this.notify();
  }

  /**
   * Stage XIII: DEATH / RESET — Starts a conscious second-pass identity experiment
   * while preserving cycleCount, created artifacts, and meta-history.
   */
  public startNewIdentityCycle(): void {
    const nextCycle = (this.state.cycleCount || 1) + 1;
    const preservedMetrics = {
      ...this.state.metrics,
      strategyChanges: this.state.metrics.strategyChanges + 1,
    };
    const preservedArtifacts = [...this.state.createdArtifacts];
    const fresh = createInitialPlayerState();
    this.state = {
      ...fresh,
      cycleCount: nextCycle,
      metrics: preservedMetrics,
      createdArtifacts: preservedArtifacts,
      memories: [...this.state.memories, `CYCLE_${nextCycle}_INITIATED`],
    };
    this.notify();
  }

  public setFlag(flag: string, value = true): void {
    this.state.flags[flag] = value;
    this.notify();
  }

  public reset(): void {
    this.state = createInitialPlayerState();
    this.notify();
  }
}

export const playerStateStore = new PlayerStateStore();
