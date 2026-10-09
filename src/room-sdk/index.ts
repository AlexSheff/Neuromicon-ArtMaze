import * as THREE from 'three';

export type CorridorBranch = 'ascend' | 'descend';
export type ComfortMode = 'teleport' | 'smooth' | 'seated';
export type MirrorChoice = 'accept' | 'reject' | 'back';

export interface RoomV1DoorRequirement {
  type: 'interactReflection' | 'questComplete' | 'identity' | 'observeShadow';
  target: string;
}

export interface RoomV1Door {
  id: 'A' | 'B' | 'C' | 'RH';
  symbol: string;
  label: string;
  labelRu?: string;
  destination: string;
  requirement: RoomV1DoorRequirement | null;
  visibility: 'visible' | 'hidden';
  choiceType: 'identity-accept' | 'identity-reject' | 'free' | 'rabbit-hole';
}

export interface RoomV1Object {
  id: string;
  title?: string;
  titleRu?: string;
  type: 'item' | 'busyboard' | 'monolith' | 'anomaly';
  model?: string;
  interactions?: string[];
  portable: false;
  visibleInMirror?: boolean;
  onlyInMirror?: boolean;
  config?: Record<string, unknown>;
}

export interface RoomV1Manifest {
  apiVersion: 1;
  entry: string;
  allowedHosts: string[];
  id: string;
  identity: {
    name: string;
    nameRu?: string;
    symbol: string;
    description: string;
    descriptionRu?: string;
    dimension: string;
  };
  audio: {
    track: string;
    loop: boolean;
    baseHz?: number;
  };
  artwork?: {
    title: string;
    imageUrl: string;
    essayUrl?: string;
    sector?: string;
  };
  quest: {
    question: string;
    questionRu?: string;
    objective: string;
    objectiveRu?: string;
    completion: {
      type: 'interact' | 'observe' | 'interactReflection' | 'puzzle';
      target: string;
    };
  };
  doors: RoomV1Door[];
  mirror: {
    characterState: string;
    characterStateRu?: string;
    appearance: string;
    choices: MirrorChoice[];
  };
  objects: RoomV1Object[];
  radio: {
    channel: string;
  };
}

export interface RoomContext {
  readonly THREE: typeof THREE;
  readonly root: THREE.Group;
  readonly manifest: RoomV1Manifest;
  readonly xr: {
    isPresenting: boolean;
    controllers: THREE.Group[];
  };
  readonly audio: {
    playRoomTrack: (trackUrl: string, baseHz?: number) => void;
    triggerTone: (freqHz: number) => void;
  };
  readonly state: {
    getPath: () => CorridorBranch | null;
    isQuestCompleted: (roomId: string) => boolean;
    getIdentityChoice: (roomId: string) => 'accept' | 'reject' | undefined;
    hasDiscovery: (key: string) => boolean;
    unlockDiscovery: (key: string) => void;
  };
  readonly doors: {
    openDoor: (doorId: 'A' | 'B' | 'C' | 'RH') => void;
    returnToCorridor: () => void;
  };
  readonly exit: (destinationRoomId: string) => void;
  readonly mirror: {
    choose: (choice: MirrorChoice) => void;
  };
  readonly quest: {
    completeObjective: (targetId: string) => void;
  };
  readonly radio: {
    broadcast: (message: string) => void;
    getMessages: () => string[];
  };
  readonly comfort: {
    fadeTransition: (onMidpoint: () => void) => void;
    setVignetteIntensity: (intensity: number) => void;
    getMode: () => ComfortMode;
  };
  readonly log: (msg: string) => void;
}

export interface RoomModule {
  preload?(ctx: RoomContext): Promise<void>;
  mount(ctx: RoomContext): Promise<void>;
  update?(dt: number, ctx: RoomContext): void;
  unmount(ctx: RoomContext): void;
}

/**
 * Helper that recursively disposes all geometries, materials, and textures under a Group
 * to satisfy the CI memory-leak check on unmount().
 */
export function disposeThreeHierarchy(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        m.dispose();
      });
    }
  });
  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }
}
