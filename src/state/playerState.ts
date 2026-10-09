import { eventBus, OnboardingStepId } from '../events/eventBus';
import { ComfortMode, CorridorBranch } from '../room-sdk';
import {
  AudioBusName,
  audioMixer,
  AudioVolumeState,
  DEFAULT_AUDIO_VOLUME_STATE,
} from '../systems/audio/mixer';

export type HubLocation = 'threshold' | 'corridor' | 'room' | 'void';

export interface RadioMessage {
  author: string;
  text: string;
  timestamp: string;
}

/**
 * Authoritative PlayerState schema from EXPERIENCE_PROTOCOL.md §7.3 & TZ.md §5.3 / §7
 * plus runtime compatibility fields for hub systems.
 */
export interface HubPlayerState {
  version: number;
  path: CorridorBranch | null;
  segment: { branch: CorridorBranch; index: 1 | 2 | 3 } | null;
  visited: Record<string, { at: number; completed: boolean }>;
  identity: Record<string, 'accept' | 'reject'>;
  onboarding: {
    version: number;
    completedSteps: OnboardingStepId[];
    currentStep: OnboardingStepId;
    skipped: boolean;
  };
  comfort: {
    locomotion: 'teleport' | 'smooth';
    seated: boolean;
    snap: 30 | 45;
    vignette: number;
    reducedMotion: boolean;
    captions: boolean;
    qualityTier: 'auto' | 'quest' | 'desktop-low' | 'desktop-high';
  };
  audio: AudioVolumeState;
  discoveries: string[];
  revealedControls: string[];
  teleportCount: number;
  hintLog: Array<{ step: string; rung: number; at: number }>;

  // Convenience derived/runtime fields for corridor & room streamer
  location: HubLocation;
  branch: CorridorBranch;
  segmentIndex: 1 | 2 | 3;
  currentRoomId: string | null;
  visitedRooms: string[];
  completedRooms: string[];
  identityChoices: Record<string, 'accept' | 'reject'>;
  comfortMode: ComfortMode;
  snapTurnDegrees: 30 | 45;
  vignetteEnabled: boolean;
  radioChannels: Record<string, RadioMessage[]>;
}

const STORAGE_KEY = 'neuromicon_artmaze_protocol_state_v4';
const LEGACY_KEYS = [
  'neuromicon_artmaze_protocol_state_v3',
  'neuromicon_artmaze_protocol_state_v2',
  'neuromicon_artmaze_hub_v1',
];
const CURRENT_SCHEMA_VERSION = 4;

function createDefaultState(): HubPlayerState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    path: null,
    segment: null,
    visited: {},
    identity: {},
    onboarding: {
      version: 1,
      completedSteps: [],
      currentStep: 'BOOT',
      skipped: false,
    },
    comfort: {
      locomotion: 'teleport',
      seated: false,
      snap: 30,
      vignette: 0.85,
      reducedMotion: false,
      captions: false,
      qualityTier: 'auto',
    },
    audio: { ...DEFAULT_AUDIO_VOLUME_STATE },
    discoveries: [],
    revealedControls: [],
    teleportCount: 0,
    hintLog: [],

    location: 'threshold',
    branch: 'ascend',
    segmentIndex: 1,
    currentRoomId: null,
    visitedRooms: [],
    completedRooms: [],
    identityChoices: {},
    comfortMode: 'teleport',
    snapTurnDegrees: 30,
    vignetteEnabled: true,
    radioChannels: {
      THRESHOLD: [
        {
          author: 'SIGNAL',
          text: 'Look up toward the light; look down toward the deep.',
          timestamp: '00:00',
        },
      ],
      ROOM_073: [
        {
          author: 'ARCHIVIST',
          text: 'What is absent in stone remains inside the glass.',
          timestamp: '01:14',
        },
      ],
    },
  };
}

function normalizeAudioState(rawAudio: unknown): AudioVolumeState {
  if (!rawAudio || typeof rawAudio !== 'object') {
    return { ...DEFAULT_AUDIO_VOLUME_STATE };
  }
  const obj = rawAudio as Partial<AudioVolumeState>;
  const clamp01 = (v: unknown, def: number) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.max(0, Math.min(1, v))
      : def;
  return {
    master: clamp01(obj.master, DEFAULT_AUDIO_VOLUME_STATE.master),
    music: clamp01(obj.music, DEFAULT_AUDIO_VOLUME_STATE.music),
    ambient: clamp01(obj.ambient, DEFAULT_AUDIO_VOLUME_STATE.ambient),
    sfx: clamp01(obj.sfx, DEFAULT_AUDIO_VOLUME_STATE.sfx),
    muted: typeof obj.muted === 'boolean' ? obj.muted : false,
  };
}

/**
 * Schema migration table keyed by version (EXPERIENCE_PROTOCOL.md §7.3 & TZ.md §5.3).
 */
export function migratePlayerState(raw: Record<string, unknown>): {
  state: HubPlayerState;
  readOnly: boolean;
} {
  const ver = typeof raw.version === 'number' ? raw.version : 1;

  // Unknown future version: load read-only without crashing (§7.3)
  if (ver > CURRENT_SCHEMA_VERSION) {
    const def = createDefaultState();
    return {
      state: syncDerivedFields({
        ...def,
        ...(raw as Partial<HubPlayerState>),
        audio: normalizeAudioState(raw.audio),
      }),
      readOnly: true,
    };
  }

  if (ver === 1) {
    const def = createDefaultState();
    const path =
      raw.path === 'ascend' || raw.path === 'descend' ? raw.path : null;
    const visitedArr = Array.isArray(raw.visitedRooms)
      ? (raw.visitedRooms as string[])
      : [];
    const completedArr = Array.isArray(raw.completedRooms)
      ? (raw.completedRooms as string[])
      : [];
    const visitedMap: Record<string, { at: number; completed: boolean }> = {};
    visitedArr.forEach((id) => {
      visitedMap[id] = {
        at: Date.now(),
        completed: completedArr.includes(id),
      };
    });

    const migrated: HubPlayerState = syncDerivedFields({
      ...def,
      version: CURRENT_SCHEMA_VERSION,
      path,
      segment: path ? { branch: path, index: 1 } : null,
      visited: visitedMap,
      identity:
        (raw.identityChoices as Record<string, 'accept' | 'reject'>) ?? {},
      audio: normalizeAudioState(raw.audio),
      discoveries: Array.isArray(raw.discoveries)
        ? (raw.discoveries as string[])
        : [],
    });
    return { state: migrated, readOnly: false };
  }

  // Migrate v2 / v3 / v4 -> v4 (preserving comfort, visited, identity, and adding/normalizing audio)
  const def = createDefaultState();
  return {
    state: syncDerivedFields({
      ...def,
      ...(raw as Partial<HubPlayerState>),
      version: CURRENT_SCHEMA_VERSION,
      audio: normalizeAudioState(raw.audio),
    }),
    readOnly: false,
  };
}

function syncDerivedFields(state: HubPlayerState): HubPlayerState {
  const visitedRooms = Object.keys(state.visited);
  const completedRooms = Object.entries(state.visited)
    .filter(([, v]) => v.completed)
    .map(([k]) => k);
  const branch =
    state.segment?.branch ?? state.path ?? state.branch ?? 'ascend';
  const segmentIndex = (state.segment?.index ??
    state.segmentIndex ??
    1) as 1 | 2 | 3;
  const comfortMode: ComfortMode = state.comfort.seated
    ? 'seated'
    : state.comfort.locomotion;

  return {
    ...state,
    branch,
    segmentIndex,
    visitedRooms,
    completedRooms,
    identityChoices: { ...state.identity },
    comfortMode,
    snapTurnDegrees: state.comfort.snap,
    vignetteEnabled: state.comfort.vignette > 0,
    audio: normalizeAudioState(state.audio),
  };
}

class HubPlayerStateStore {
  private state: HubPlayerState;
  private isReadOnly = false;
  private saveTimer: number | null = null;
  private listeners: Set<(state: HubPlayerState) => void> = new Set();

  constructor() {
    this.state = this.load();
    // Apply persisted audio state to AudioMixer before the first sound plays (TZ.md §5.3)
    audioMixer.setVolumeState(this.state.audio);
  }

  private load(): HubPlayerState {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return createDefaultState();
      }
      let rawStr = window.localStorage.getItem(STORAGE_KEY);
      if (!rawStr) {
        for (const legacyKey of LEGACY_KEYS) {
          const found = window.localStorage.getItem(legacyKey);
          if (found) {
            rawStr = found;
            break;
          }
        }
      }
      if (!rawStr) return createDefaultState();
      const parsed = JSON.parse(rawStr) as Record<string, unknown>;
      const { state, readOnly } = migratePlayerState(parsed);
      this.isReadOnly = readOnly;

      state.location = 'threshold';
      state.currentRoomId = null;
      if (state.onboarding.completedSteps.includes('COMMITTED')) {
        state.onboarding.currentStep = 'COMMITTED';
      }
      return syncDerivedFields(state);
    } catch {
      return createDefaultState();
    }
  }

  private notifyAndDebounceSave(): void {
    this.state = syncDerivedFields(this.state);
    const snap = this.getState();
    this.listeners.forEach((cb) => cb(snap));

    if (this.isReadOnly || typeof window === 'undefined') return;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Private browsing / quota fallback (§7.3)
      }
    }, 120);
  }

  public getState(): HubPlayerState {
    return {
      ...this.state,
      visited: { ...this.state.visited },
      identity: { ...this.state.identity },
      onboarding: {
        ...this.state.onboarding,
        completedSteps: [...this.state.onboarding.completedSteps],
      },
      comfort: { ...this.state.comfort },
      audio: { ...this.state.audio },
      discoveries: [...this.state.discoveries],
      revealedControls: [...this.state.revealedControls],
      visitedRooms: [...this.state.visitedRooms],
      completedRooms: [...this.state.completedRooms],
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

  public setAudioVolume(
    bus: AudioBusName | 'master',
    value01: number
  ): void {
    const clamped = Math.max(0, Math.min(1, value01));
    this.state.audio = {
      ...this.state.audio,
      [bus]: clamped,
    };
    audioMixer.setVolumeState(this.state.audio);
    this.notifyAndDebounceSave();
  }

  public adjustMasterVolumeDelta(delta: number): void {
    const next = audioMixer.adjustMasterDelta(delta);
    this.state.audio = {
      ...this.state.audio,
      master: next,
      muted: false,
    };
    this.notifyAndDebounceSave();
  }

  public setAudioMuted(muted: boolean): void {
    this.state.audio = {
      ...this.state.audio,
      muted,
    };
    audioMixer.setVolumeState(this.state.audio);
    this.notifyAndDebounceSave();
  }

  public toggleAudioMuted(): boolean {
    const nextMuted = !this.state.audio.muted;
    this.setAudioMuted(nextMuted);
    return nextMuted;
  }

  public setOnboardingStep(step: OnboardingStepId): void {
    const prev = this.state.onboarding.currentStep;
    this.state.onboarding.currentStep = step;
    if (!this.state.onboarding.completedSteps.includes(step)) {
      this.state.onboarding.completedSteps.push(step);
    }
    this.notifyAndDebounceSave();
    if (prev !== step) {
      eventBus.emit('onboarding:step', { from: prev, to: step });
    }
  }

  public replayOnboarding(): void {
    this.state.onboarding.currentStep = 'AWAKEN';
    this.state.onboarding.completedSteps = ['BOOT', 'ENTRY'];
    this.state.location = 'threshold';
    this.state.currentRoomId = null;
    this.notifyAndDebounceSave();
  }

  public recordHintRung(step: OnboardingStepId, rung: 1 | 2 | 3 | 4): void {
    this.state.hintLog.push({ step, rung, at: Date.now() });
    this.notifyAndDebounceSave();
    eventBus.emit('onboarding:hint', { step, rung });
  }

  public revealControl(controlId: string): void {
    if (!this.state.revealedControls.includes(controlId)) {
      this.state.revealedControls.push(controlId);
      this.notifyAndDebounceSave();
    }
  }

  public incrementTeleportCount(): number {
    this.state.teleportCount += 1;
    if (this.state.teleportCount >= 5) {
      this.unlockDiscovery('codex.entry.smooth_unlocked');
    }
    this.notifyAndDebounceSave();
    return this.state.teleportCount;
  }

  public chooseBranchFromThreshold(branch: CorridorBranch): void {
    const seg: 1 | 2 | 3 = branch === 'ascend' ? 1 : 2;
    this.state.path = branch;
    this.state.branch = branch;
    this.state.segmentIndex = seg;
    this.state.segment = { branch, index: seg };
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    if (!this.state.onboarding.completedSteps.includes('COMMITTED')) {
      this.state.onboarding.completedSteps.push('COMMITTED');
    }
    this.state.onboarding.currentStep = 'COMMITTED';
    this.unlockDiscovery('codex.entry.threshold');
    this.notifyAndDebounceSave();
  }

  public returnToThreshold(): void {
    this.state.location = 'threshold';
    this.state.currentRoomId = null;
    this.notifyAndDebounceSave();
  }

  public setCorridorSegment(branch: CorridorBranch, segment: 1 | 2 | 3): void {
    if (!this.state.path) {
      this.state.path = branch;
    }
    this.state.branch = branch;
    this.state.segmentIndex = segment;
    this.state.segment = { branch, index: segment };
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    if (!this.state.onboarding.completedSteps.includes('COMMITTED')) {
      this.state.onboarding.completedSteps.push('COMMITTED');
    }
    this.state.onboarding.currentStep = 'COMMITTED';
    this.notifyAndDebounceSave();
  }

  public enterRoom(
    roomId: string,
    fromBranch?: CorridorBranch,
    fromSegment?: 1 | 2 | 3
  ): void {
    if (fromBranch && fromSegment) {
      this.state.branch = fromBranch;
      this.state.segmentIndex = fromSegment;
      this.state.segment = { branch: fromBranch, index: fromSegment };
    }
    this.state.location = 'room';
    this.state.currentRoomId = roomId;
    const prev = this.state.visited[roomId];
    this.state.visited[roomId] = {
      at: Date.now(),
      completed: prev?.completed ?? false,
    };
    this.revealControl('radio');
    this.notifyAndDebounceSave();
  }

  public enterVoidFallback(roomId: string): void {
    this.state.location = 'void';
    this.state.currentRoomId = roomId;
    this.unlockDiscovery('codex.entry.void_fallback');
    this.notifyAndDebounceSave();
  }

  public returnToCorridor(): void {
    this.state.location = 'corridor';
    this.state.currentRoomId = null;
    this.notifyAndDebounceSave();
  }

  public markQuestCompleted(roomId: string): void {
    const prev = this.state.visited[roomId];
    this.state.visited[roomId] = {
      at: prev?.at ?? Date.now(),
      completed: true,
    };
    this.notifyAndDebounceSave();
  }

  public recordMirrorChoice(
    roomId: string,
    choice: 'accept' | 'reject'
  ): void {
    this.state.identity[roomId] = choice;
    this.notifyAndDebounceSave();
  }

  public unlockDiscovery(key: string): void {
    if (!this.state.discoveries.includes(key)) {
      this.state.discoveries.push(key);
      this.revealControl('codex');
      this.notifyAndDebounceSave();
      eventBus.emit('codex:unlocked', { entryId: key });
    }
  }

  public setSeatedPosture(seated: boolean): void {
    this.state.comfort.seated = seated;
    this.unlockDiscovery(
      seated ? 'codex.entry.comfort_seated' : 'codex.entry.comfort_standing'
    );
    this.notifyAndDebounceSave();
  }

  public setComfortMode(mode: ComfortMode): void {
    if (mode === 'seated') {
      this.state.comfort.seated = true;
    } else {
      this.state.comfort.seated = false;
      this.state.comfort.locomotion = mode;
    }
    this.notifyAndDebounceSave();
  }

  public setSnapTurnDegrees(deg: 30 | 45): void {
    this.state.comfort.snap = deg;
    this.notifyAndDebounceSave();
  }

  public toggleVignette(): void {
    this.state.comfort.vignette = this.state.comfort.vignette > 0 ? 0 : 0.85;
    this.notifyAndDebounceSave();
  }

  public setVignetteStrength(val: number): void {
    this.state.comfort.vignette = Math.max(0, Math.min(1, val));
    this.notifyAndDebounceSave();
  }

  public toggleReducedMotion(): void {
    this.state.comfort.reducedMotion = !this.state.comfort.reducedMotion;
    this.notifyAndDebounceSave();
  }

  public toggleCaptions(): void {
    this.state.comfort.captions = !this.state.comfort.captions;
    this.notifyAndDebounceSave();
  }

  public setQualityTier(
    tier: 'auto' | 'quest' | 'desktop-low' | 'desktop-high'
  ): void {
    this.state.comfort.qualityTier = tier;
    this.notifyAndDebounceSave();
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
    this.notifyAndDebounceSave();
  }

  public exportStateJson(): string {
    return JSON.stringify(this.state, null, 2);
  }

  public importStateJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      const { state, readOnly } = migratePlayerState(parsed);
      this.state = state;
      this.isReadOnly = readOnly;
      audioMixer.setVolumeState(this.state.audio);
      this.notifyAndDebounceSave();
      return true;
    } catch {
      return false;
    }
  }

  public resetProgress(): void {
    this.state = createDefaultState();
    this.isReadOnly = false;
    audioMixer.setVolumeState(this.state.audio);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignore
    }
    this.notifyAndDebounceSave();
  }
}

export const hubPlayerState = new HubPlayerStateStore();
