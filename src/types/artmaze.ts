export type RoomEnvironmentType = 'standard' | 'procedural' | 'custom' | 'empty' | 'void';

export type DoorStatus = 'ready' | 'planned' | 'void' | 'conditional' | 'disabled';

export type VoidType =
  | 'infinity'
  | 'fractal'
  | 'fog'
  | 'darkness'
  | 'starfield'
  | 'mirror'
  | 'unknown';

export type DoorRequirementType =
  | 'flag'
  | 'identity'
  | 'quest'
  | 'discovery'
  | 'room-state'
  | 'visit-count'
  | 'choice';

export type GenericInteractionType =
  | 'inspect'
  | 'look'
  | 'touch'
  | 'activate'
  | 'rotate'
  | 'open'
  | 'close'
  | 'push'
  | 'pull'
  | 'listen'
  | 'read'
  | 'observe';

export type PaintingInteractionType = 'inspect' | 'observe' | 'activate' | 'discover' | 'portal';

export type QuestType =
  | 'observe'
  | 'interact'
  | 'solve'
  | 'choose'
  | 'remember'
  | 'compare'
  | 'discover'
  | 'contradict'
  | 'listen'
  | 'wait'
  | 'return'
  | 'identity';

export type FrameStyle =
  | 'classic_gold'
  | 'obsidian_minimal'
  | 'travertine_deep'
  | 'bronze_monument';

export type Vec3 = [number, number, number];

export type BehavioralSignalType =
  | 'safe'
  | 'risky'
  | 'trust'
  | 'betray'
  | 'covenant'
  | 'third_path'
  | 'cycle_reset';

export interface PaintingMetadata {
  title: string;
  titleRu?: string;
  author: string;
  license: string;
  source: string;
  url?: string;
  inscription?: string;
  inscriptionRu?: string;
}

export interface PaintingDefinition {
  id: string;
  image: string;
  frame: FrameStyle;
  position: Vec3;
  rotation: Vec3;
  scale?: number;
  metadata: PaintingMetadata;
  interaction?: {
    type: PaintingInteractionType;
    discovery?: string;
    mutatesOnIgnore?: boolean;
  };
}

export interface RoomObjectDefinition {
  id: string;
  title?: string;
  titleRu?: string;
  type:
    | 'item'
    | 'monolith'
    | 'plinth'
    | 'chair'
    | 'shadow_anomaly'
    | 'reflection_anomaly'
    | 'inscription'
    | 'sundial';
  model?: string;
  portable: boolean;
  position: Vec3;
  rotation?: Vec3;
  interactions: GenericInteractionType[];
  discoveryId?: string;
  minVisitCount?: number;
  castsShadow?: boolean;
  visibleInMirror?: boolean;
  onlyInMirror?: boolean;
}

export interface QuestOption {
  id: string;
  label: string;
  labelRu?: string;
  consequenceFlag?: string;
}

export interface QuestDefinition {
  id: string;
  type: QuestType;
  question: string;
  questionRu?: string;
  objective: string;
  objectiveRu?: string;
  options?: QuestOption[];
  completion: {
    type: string;
    target: string;
  };
}

export interface MirrorChoiceEffect {
  identity?: Record<string, number>;
  flag?: string;
}

export interface MirrorDefinition {
  id: string;
  mode?: 'first' | 'identity' | 'meta';
  characterState: string;
  characterStateRu?: string;
  proposition?: string;
  propositionRu?: string;
  appearance: string;
  position?: Vec3;
  choices: {
    accept: MirrorChoiceEffect;
    reject: MirrorChoiceEffect;
    return: MirrorChoiceEffect;
  };
}

export interface DoorRequirement {
  type: DoorRequirementType;
  id: string;
  minValue?: number;
}

export interface DoorPropositionOption {
  id: string;
  text: string;
  textRu?: string;
  destinationOverride: string | null;
  voidOverride?: VoidType;
  behavioralSignal?: BehavioralSignalType;
}

export interface DoorProposition {
  prompt: string;
  promptRu?: string;
  options: DoorPropositionOption[];
}

export interface DoorDefinition {
  id: string;
  label?: string;
  subtitle?: string;
  subtitleRu?: string;
  symbol?: string;
  destination: string | null;
  status: DoorStatus;
  visibility?: 'visible' | 'hidden' | 'reflection-only';
  type?: 'standard' | 'rabbit-hole' | 'monumental';
  position?: Vec3;
  rotation?: Vec3;
  fallback?: {
    type: VoidType;
  };
  requirement?: DoorRequirement;
  proposition?: DoorProposition;
}

export interface CreatorPromptDefinition {
  enabled: boolean;
  title: string;
  titleRu?: string;
  description: string;
  descriptionRu?: string;
}

export interface RoomManifest {
  specVersion?: string;
  id: string;
  version: string;
  protocolStage?: string;
  title: string;
  titleRu?: string;
  author: string;
  description?: string;
  descriptionRu?: string;
  type: RoomEnvironmentType;
  environment: {
    scene?: string;
    scale?: number;
    dimensions?: Vec3;
    palette?: {
      wall: string;
      floor: string;
      ceiling: string;
      fog: string;
      accent: string;
    };
    spawn?: {
      position: Vec3;
      rotation: Vec3;
    };
  };
  rules?: {
    entryAllowed?: boolean;
    gravity?: boolean;
    locomotion?: 'standard' | 'slow' | 'stationary' | 'non-euclidean';
    returnAllowed?: boolean;
  };
  audio?: {
    track?: string;
    loop?: boolean;
    volume?: number;
    baseFrequency?: number;
    harmonicProfile?: 'cathedral' | 'labyrinth' | 'mirror' | 'void' | 'memory';
  };
  creatorPrompt?: CreatorPromptDefinition;
  paintings?: PaintingDefinition[];
  objects?: RoomObjectDefinition[];
  quest?: QuestDefinition | null;
  mirror?: MirrorDefinition | null;
  doors: DoorDefinition[];
  state?: {
    rememberVisits?: boolean;
    variables?: Record<string, boolean | number | string>;
  };
  metadata?: {
    tags?: string[];
    license?: string;
  };
}

export interface RegistryEntry {
  id: string;
  title: string;
  titleRu?: string;
  type: 'main-maze' | 'external';
  source?: string;
  repository?: string;
  manifestPath?: string;
  status: 'idea' | 'prototype' | 'testing' | 'ready' | 'planned' | 'deprecated' | 'archived';
}

export interface RoomRegistryManifest {
  version: string;
  worldScaleConstant: number;
  rooms: Record<string, RegistryEntry>;
}

export interface WorldGraphNode {
  id: string;
  status: string;
  hasExplicitEntry: boolean;
  hasExplicitExit: boolean;
}

export interface WorldGraphEdge {
  from: string;
  doorId: string;
  to: string | null;
  status: string;
  directed: boolean;
  voidFallback?: VoidType;
  condition?: string;
}

export interface WorldGraphManifest {
  version: string;
  nodes: WorldGraphNode[];
  edges: WorldGraphEdge[];
}

export interface RoomRuntimeState {
  visitCount: number;
  mirrorChoice?: 'accept' | 'reject' | 'return';
  objectsInspected: string[];
  paintingsInspected: string[];
  puzzleSolved: boolean;
  anomaliesDetected: string[];
  variables: Record<string, boolean | number | string>;
}

export interface BehavioralMetrics {
  uncertaintyAvoided: number;
  uncertaintyEmbraced: number;
  hiddenPathsSearched: number;
  strangersTrusted: number;
  strategyChanges: number;
  pathsCreated: number;
  reflectionChecks: number;
}

export interface CreatedRuleArtifact {
  id: string;
  roomId: string;
  ruleText: string;
  cycle: number;
}

export interface PlayerState {
  currentRoomId: string;
  activeVoid: VoidType | null;
  previousRoomId: string | null;
  cycleCount: number;
  visitedRooms: string[];
  identity: Record<string, number>;
  beliefs: Record<string, string>;
  memories: string[];
  discoveries: string[];
  decisions: Record<string, string>;
  flags: Record<string, boolean>;
  roomStates: Record<string, RoomRuntimeState>;
  metrics: BehavioralMetrics;
  createdArtifacts: CreatedRuleArtifact[];
}
