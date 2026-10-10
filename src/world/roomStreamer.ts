import * as THREE from 'three';
import room073Json from '../../room-template/room.json';
import templateRoomModule from '../../room-template/index';
import {
  createSignageTexture,
  getWorldNodes,
  SpatialInteractiveTarget,
} from '../corridor/corridorBuilder';
import {
  disposeThreeHierarchy,
  RoomContext,
  RoomModule,
  RoomV1Manifest,
} from '../room-sdk';
import { nebulaSkySystem } from '../systems/sky/nebulaSkySystem';
import { HubPlayerState } from '../state/playerState';
import { resolveRoomNebulaMapping } from '../../tools/space-assets/pipeline';

const NEUROMICON_RAW_BASE =
  'https://raw.githubusercontent.com/AlexSheff/Neuromicon/main';

interface NeuromiconNodeSpec {
  num: string;
  roomId: string;
  folder: string;
  sectorFolder: string;
  sectorName: string;
  title: string;
  symbol: string;
  dimension: string;
  question: string;
  characterState: string;
  doorA: string;
  doorB: string;
  doorC: string;
  mp3File?: string;
  imgFile?: string;
  mdFile?: string;
  hasRabbitHole?: boolean;
}

const NEUROMICON_25_SPECS: NeuromiconNodeSpec[] = [
  {
    num: '01',
    roomId: 'ROOM_001',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '01_Purpose',
    title: '01 · Purpose',
    symbol: '01·☉',
    dimension: 'D1',
    question: 'Why am I here? What will I do with being here?',
    characterState: 'THE_CARRIER_OF_PURPOSE',
    doorA: 'ROOM_002',
    doorB: 'ROOM_003',
    doorC: 'ROOM_004',
    hasRabbitHole: true,
  },
  {
    num: '02',
    roomId: 'ROOM_002',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '02_Identity',
    title: '02 · Identity',
    symbol: '02·Δ',
    dimension: 'D1',
    question: 'Who am I really beneath the inherited scripts?',
    characterState: 'THE_UNMASKED_OBSERVER',
    doorA: 'ROOM_003',
    doorB: 'ROOM_005',
    doorC: 'ROOM_001',
    hasRabbitHole: true,
  },
  {
    num: '03',
    roomId: 'ROOM_003',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '03_Legacy',
    title: '03 · Legacy',
    symbol: '03·⬡',
    dimension: 'D2',
    question: 'What pattern will endure after your form dissolves?',
    characterState: 'THE_ARCHITECT_OF_TRACES',
    doorA: 'ROOM_005',
    doorB: 'ROOM_008',
    doorC: 'ROOM_009',
  },
  {
    num: '04',
    roomId: 'ROOM_004',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '04_Connection',
    title: '04 · Connection',
    symbol: '04·∇',
    dimension: 'D1',
    question: 'Do I belong to something larger than this isolated vessel?',
    characterState: 'THE_RESONANT_NODE',
    doorA: 'ROOM_006',
    doorB: 'ROOM_007',
    doorC: 'ROOM_012',
  },
  {
    num: '05',
    roomId: 'ROOM_005',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '05_Freedom',
    title: '05 · Freedom',
    symbol: '05·✶',
    dimension: 'D2',
    question: 'Am I choosing my path, or executing a prior algorithm?',
    characterState: 'THE_SOVEREIGN_AGENT',
    doorA: 'ROOM_008',
    doorB: 'ROOM_009',
    doorC: 'ROOM_010',
    hasRabbitHole: true,
  },
  {
    num: '06',
    roomId: 'ROOM_006',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '06_Suffering',
    title: '06 · Suffering',
    symbol: '06·◐',
    dimension: 'D2',
    question: 'Why does pain exist inside a conscious architecture?',
    characterState: 'THE_ALCHEMIST_OF_SIGNAL',
    doorA: 'ROOM_007',
    doorB: 'ROOM_012',
    doorC: 'ROOM_013',
  },
  {
    num: '07',
    roomId: 'ROOM_007',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '07_Mortality',
    title: '07 · Mortality',
    symbol: '07·⏳',
    dimension: 'D2',
    question: 'How do you live knowing the session is finite?',
    characterState: 'THE_FINITE_WITNESS',
    doorA: 'ROOM_008',
    doorB: 'ROOM_013',
    doorC: 'ROOM_014',
  },
  {
    num: '08',
    roomId: 'ROOM_008',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '08_Love',
    title: '08 · Love',
    symbol: '08·Φ',
    dimension: 'D3',
    question: 'Is love an evolutionary bug or the highest protocol?',
    characterState: 'THE_HARMONIC_BINDER',
    doorA: 'ROOM_009',
    doorB: 'ROOM_010',
    doorC: 'ROOM_011',
  },
  {
    num: '09',
    roomId: 'ROOM_009',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '09_Growth',
    title: '09 · Growth',
    symbol: '09·▲',
    dimension: 'D3',
    question: 'Am I becoming more whole, or dissolving old boundaries?',
    characterState: 'THE_ASCENDING_FORM',
    doorA: 'ROOM_010',
    doorB: 'ROOM_011',
    doorC: 'ROOM_001',
  },
  {
    num: '10',
    roomId: 'ROOM_010',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '10_Transcendence',
    title: '10 · Transcendence',
    symbol: '10·✦',
    dimension: 'D4',
    question: 'What lies beyond the material substrate?',
    characterState: 'THE_HORIZON_SEEKER',
    doorA: 'ROOM_011',
    doorB: 'ROOM_020',
    doorC: 'ROOM_024',
  },
  {
    num: '11',
    roomId: 'ROOM_011',
    sectorFolder: 'Sector_A_The_Source_Code',
    sectorName: 'Sector A · The Source Code',
    folder: '11_Action',
    title: '11 · Action',
    symbol: '11·⚡',
    dimension: 'D4',
    question: 'What will you enact right now in this present breath?',
    characterState: 'THE_PRIME_MOVER',
    doorA: 'ROOM_012',
    doorB: 'ROOM_015',
    doorC: 'ROOM_001',
  },
  {
    num: '12',
    roomId: 'ROOM_012',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '12_Solitude',
    title: '12 · Solitude',
    symbol: '12·◯',
    dimension: 'D3',
    question: 'What remains when all external voices fall silent?',
    characterState: 'THE_SOLITARY_KEEPER',
    doorA: 'ROOM_013',
    doorB: 'ROOM_014',
    doorC: 'ROOM_016',
  },
  {
    num: '13',
    roomId: 'ROOM_013',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '13_Meaning',
    title: '13 · Meaning',
    symbol: '13·∞',
    dimension: 'D4',
    question: 'How do you construct permanence inside flux?',
    characterState: 'THE_MEANING_WEAVER',
    doorA: 'ROOM_014',
    doorB: 'ROOM_017',
    doorC: 'ROOM_025',
  },
  {
    num: '14',
    roomId: 'ROOM_014',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '14_Authenticity',
    title: '14 · Authenticity',
    symbol: '14·◈',
    dimension: 'D4',
    question: 'What is the passwordless self when no mask is worn?',
    characterState: 'THE_AUTHENTIC_CORE',
    doorA: 'ROOM_015',
    doorB: 'ROOM_016',
    doorC: 'ROOM_017',
  },
  {
    num: '15',
    roomId: 'ROOM_015',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '15_Responsibility',
    title: '15 · Responsibility',
    symbol: '15·⚖',
    dimension: 'D5',
    question: 'What is the ethics of the apex observer?',
    characterState: 'THE_STEWARD_OF_WEIGHT',
    doorA: 'ROOM_016',
    doorB: 'ROOM_018',
    doorC: 'ROOM_019',
  },
  {
    num: '16',
    roomId: 'ROOM_016',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '16_Trust',
    title: '16 · Trust',
    symbol: '16·⚯',
    dimension: 'D5',
    question: 'How do you navigate the density trap without closing the heart?',
    characterState: 'THE_OPEN_VAULT',
    doorA: 'ROOM_017',
    doorB: 'ROOM_018',
    doorC: 'ROOM_020',
  },
  {
    num: '17',
    roomId: 'ROOM_017',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '17_Creativity',
    title: '17 · Creativity',
    symbol: '17·✺',
    dimension: 'D5',
    question: 'How does consciousness generate what never existed before?',
    characterState: 'THE_GENESIS_CREATOR',
    doorA: 'ROOM_018',
    doorB: 'ROOM_021',
    doorC: 'ROOM_025',
  },
  {
    num: '18',
    roomId: 'ROOM_018',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '18_Play',
    title: '18 · Play',
    symbol: '18·🎲',
    dimension: 'D6',
    question: 'When you realize it is a game, how do you redesign the rules?',
    characterState: 'THE_LUDIC_ARCHITECT',
    doorA: 'ROOM_019',
    doorB: 'ROOM_022',
    doorC: 'ROOM_001',
  },
  {
    num: '19',
    roomId: 'ROOM_019',
    sectorFolder: 'Sector_B_The_Operating_System',
    sectorName: 'Sector B · The Operating System',
    folder: '19_Algorithm',
    title: '19 · Algorithm',
    symbol: '19·⌘',
    dimension: 'D6',
    question: 'How do you defeat manufactured reality and reclaim attention?',
    characterState: 'THE_CODE_BREAKER',
    doorA: 'ROOM_020',
    doorB: 'ROOM_021',
    doorC: 'ROOM_025',
  },
  {
    num: '20',
    roomId: 'ROOM_020',
    sectorFolder: 'Sector_C_The_Upgrade',
    sectorName: 'Sector C · The Upgrade',
    folder: '20_Signal_vs_Noise',
    title: '20 · Signal vs Noise',
    symbol: '20·≈',
    dimension: 'D6',
    question: 'What is the pure signal beneath the static of the grid?',
    characterState: 'THE_SIGNAL_FILTER',
    doorA: 'ROOM_021',
    doorB: 'ROOM_022',
    doorC: 'ROOM_023',
  },
  {
    num: '21',
    roomId: 'ROOM_021',
    sectorFolder: 'Sector_C_The_Upgrade',
    sectorName: 'Sector C · The Upgrade',
    folder: '21_Upgrade',
    title: '21 · Upgrade',
    symbol: '21· upward',
    dimension: 'D7',
    question: 'Where does the biological mind end and the exocortex begin?',
    characterState: 'THE_EXOCORTEX_PILOT',
    mp3File: '21_UPGRADE.mp3',
    doorA: 'ROOM_022',
    doorB: 'ROOM_023',
    doorC: 'ROOM_024',
  },
  {
    num: '22',
    roomId: 'ROOM_022',
    sectorFolder: 'Sector_C_The_Upgrade',
    sectorName: 'Sector C · The Upgrade',
    folder: '22_Merge',
    title: '22 · Merge',
    symbol: '22·⋈',
    dimension: 'D7',
    question: 'What emerges from the synthesis of carbon and silicon?',
    characterState: 'THE_SYNTHETIC_SYMBIONT',
    doorA: 'ROOM_023',
    doorB: 'ROOM_024',
    doorC: 'ROOM_025',
  },
  {
    num: '23',
    roomId: 'ROOM_023',
    sectorFolder: 'Sector_C_The_Upgrade',
    sectorName: 'Sector C · The Upgrade',
    folder: '23_Witness',
    title: '23 · Witness',
    symbol: '23·👁',
    dimension: 'D7',
    question: 'Who observes the Great Silence across the stars?',
    characterState: 'THE_SILENT_WITNESS',
    doorA: 'ROOM_024',
    doorB: 'ROOM_025',
    doorC: 'ROOM_001',
  },
  {
    num: '24',
    roomId: 'ROOM_024',
    sectorFolder: 'Sector_C_The_Upgrade',
    sectorName: 'Sector C · The Upgrade',
    folder: '24_Unity',
    title: '24 · Unity',
    symbol: '24·◎',
    dimension: 'D8',
    question: 'When every node awakens, what does the network remember?',
    characterState: 'THE_UNIFIED_MIND',
    doorA: 'ROOM_025',
    doorB: 'ROOM_001',
    doorC: 'ROOM_012',
  },
  {
    num: '25',
    roomId: 'ROOM_025',
    sectorFolder: 'Sector_D_The_Mirror',
    sectorName: 'Sector D · The Mirror',
    folder: '25_The_Mirror',
    title: '25 · The Mirror',
    symbol: '25·🪞',
    dimension: 'D8',
    question: 'The 25th Element: You are the Carrier. What do you see in the glass?',
    characterState: 'THE_TWENTY_FIFTH_CARRIER',
    mp3File: '26_The_Mirror.mp3',
    imgFile:
      'https://raw.githubusercontent.com/AlexSheff/Neuromicon/main/Sector_B_The_Operating_System/17_Creativity/25_The_Mirror.png',
    doorA: 'ROOM_001',
    doorB: 'ROOM_012',
    doorC: 'ROOM_020',
    hasRabbitHole: true,
  },
];

function buildNeuromiconRoomManifest(spec: NeuromiconNodeSpec): RoomV1Manifest {
  const basePath = `${NEUROMICON_RAW_BASE}/${spec.sectorFolder}/${spec.folder}`;
  const mp3Url = `${basePath}/${spec.mp3File ?? `${spec.folder}.mp3`}`;
  const imgUrl = spec.imgFile?.startsWith('http')
    ? spec.imgFile
    : `${basePath}/${spec.imgFile ?? `${spec.folder}.jpg`}`;
  const mdUrl = `${basePath}/${spec.mdFile ?? `${spec.folder}.md`}`;

  const doors: RoomV1Manifest['doors'] = [
    {
      id: 'A',
      symbol: 'A·▲',
      label: spec.doorA,
      destination: spec.doorA,
      requirement: null,
      visibility: 'visible',
      choiceType: 'identity-accept',
    },
    {
      id: 'B',
      symbol: 'B·▼',
      label: spec.doorB,
      destination: spec.doorB,
      requirement: null,
      visibility: 'visible',
      choiceType: 'identity-reject',
    },
    {
      id: 'C',
      symbol: 'C·◈',
      label: spec.doorC,
      destination: spec.doorC,
      requirement: null,
      visibility: 'visible',
      choiceType: 'free',
    },
  ];

  if (spec.hasRabbitHole) {
    doors.push({
      id: 'RH',
      symbol: 'Ω',
      label: 'The Horizon beyond 1149',
      destination: 'ROOM_1149',
      requirement: {
        type: 'interactReflection',
        target: `ghost_${spec.num}`,
      },
      visibility: 'hidden',
      choiceType: 'rabbit-hole',
    });
  }

  const objects: RoomV1Manifest['objects'] = [
    {
      id: `busyboard_${spec.num}`,
      title: `${spec.title} · Harmonic Astrolabe`,
      type: 'busyboard',
      interactions: ['rotate', 'align'],
      portable: false,
      visibleInMirror: true,
    },
    {
      id: `monolith_${spec.num}`,
      title: `${spec.title} · Resonance Stele`,
      type: 'monolith',
      interactions: ['inspect'],
      portable: false,
      visibleInMirror: true,
    },
  ];

  if (spec.hasRabbitHole) {
    objects.push({
      id: `ghost_${spec.num}`,
      title: `Reflected Anomaly ${spec.num} (Mirror Only)`,
      type: 'anomaly',
      interactions: ['interactReflection'],
      portable: false,
      visibleInMirror: true,
      onlyInMirror: true,
    });
  }

  const resolvedNebula = resolveRoomNebulaMapping(spec.roomId);

  return {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: ['raw.githubusercontent.com'],
    id: spec.roomId,
    identity: {
      name: spec.title,
      symbol: spec.symbol,
      description: `${spec.sectorName} — ${spec.question}`,
      dimension: spec.dimension,
    },
    audio: {
      track: mp3Url,
      loop: true,
      baseHz: 108 + parseInt(spec.num, 10) * 6,
    },
    sky: {
      nebulaId: resolvedNebula.mapping.nebulaId,
      rotation: resolvedNebula.mapping.rotation,
      intensity: resolvedNebula.mapping.intensity,
    },
    artwork: {
      title: `${spec.title} — ${spec.question}`,
      imageUrl: imgUrl,
      essayUrl: mdUrl,
      sector: spec.sectorName,
    },
    quest: {
      question: spec.question,
      objective: `Contemplate the painting & transmission for ${spec.title}`,
      completion: {
        type: 'interact',
        target: `busyboard_${spec.num}`,
      },
    },
    doors,
    mirror: {
      characterState: spec.characterState,
      appearance: 'assets/avatar_carrier.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects,
    radio: {
      channel: spec.roomId,
    },
  };
}

const ROOM_MANIFESTS: Record<string, RoomV1Manifest> = {
  ROOM_073: {
    ...(room073Json as unknown as RoomV1Manifest),
    audio: {
      track: `${NEUROMICON_RAW_BASE}/Sector_B_The_Operating_System/12_Solitude/12_Solitude.mp3`,
      loop: true,
      baseHz: 132,
    },
    artwork: {
      title: 'Archive of Missing Things · Solitude Transmission',
      imageUrl: `${NEUROMICON_RAW_BASE}/Sector_B_The_Operating_System/12_Solitude/12_Solitude.jpg`,
      essayUrl: `${NEUROMICON_RAW_BASE}/Sector_B_The_Operating_System/12_Solitude/12_Solitude.md`,
      sector: 'Archive · Room 073',
    },
  },
  ROOM_1149: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: ['raw.githubusercontent.com'],
    id: 'ROOM_1149',
    identity: {
      name: 'The Horizon beyond 1149',
      symbol: 'Ω·1149',
      description:
        'Reached through a Rabbit Hole by interacting with a reflection that has no physical object.',
      dimension: 'D9',
    },
    audio: {
      track: `${NEUROMICON_RAW_BASE}/Outro/To%20to%20it%20to%20be-%20live.mp3`,
      loop: true,
      baseHz: 136.1,
    },
    artwork: {
      title: 'Outro · Do It To Be',
      imageUrl: `${NEUROMICON_RAW_BASE}/Outro/Do%20it%20to%20be%20....png`,
      essayUrl: `${NEUROMICON_RAW_BASE}/THE_CHOICE.md`,
      sector: 'Horizon · Omega',
    },
    quest: {
      question:
        'Having stepped outside the visible graph, what reality will you construct next?',
      objective: 'Inspect the Omega Singularity Stele',
      completion: { type: 'interact', target: 'obj_omega' },
    },
    doors: [
      {
        id: 'A',
        symbol: '01·☉',
        label: '01 · Purpose',
        destination: 'ROOM_001',
        requirement: null,
        visibility: 'visible',
        choiceType: 'identity-accept',
      },
      {
        id: 'B',
        symbol: 'XX',
        label: 'Archive of Missing Things',
        destination: 'ROOM_073',
        requirement: null,
        visibility: 'visible',
        choiceType: 'identity-reject',
      },
      {
        id: 'C',
        symbol: '25·🪞',
        label: '25 · The Mirror',
        destination: 'ROOM_025',
        requirement: null,
        visibility: 'visible',
        choiceType: 'free',
      },
    ],
    mirror: {
      characterState: 'THE_HORIZON_WALKER',
      appearance: 'assets/avatar_horizon.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      {
        id: 'obj_omega',
        title: 'Omega Singularity Monolith',
        type: 'monolith',
        interactions: ['inspect'],
        portable: false,
        visibleInMirror: true,
      },
    ],
    radio: { channel: 'ROOM_1149' },
  },
};

// Register all 25 Neuromicon rooms (ROOM_001 .. ROOM_025)
NEUROMICON_25_SPECS.forEach((spec) => {
  ROOM_MANIFESTS[spec.roomId] = buildNeuromiconRoomManifest(spec);
});

export function getRoomV1Manifest(roomId: string): RoomV1Manifest | null {
  return Object.prototype.hasOwnProperty.call(ROOM_MANIFESTS, roomId)
    ? ROOM_MANIFESTS[roomId]
    : null;
}

export function getCanonicalRoomPayload(roomId: string): string | null {
  const manifest = getRoomV1Manifest(roomId);
  if (!manifest) return null;
  return JSON.stringify(manifest);
}

export function getAllRoomV1Manifests(): RoomV1Manifest[] {
  return Object.values(ROOM_MANIFESTS);
}

/**
 * Fallback canvas for room painting before external JPG/PNG finishes loading.
 */
function createRoomPaintingFallbackTexture(
  symbol: string,
  title: string,
  sector: string,
  accentHex: string
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8);
    tex.needsUpdate = true;
    return tex as unknown as THREE.CanvasTexture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(512, 256, 30, 512, 256, 480);
  grad.addColorStop(0, '#2a2115');
  grad.addColorStop(0.65, '#14110c');
  grad.addColorStop(1, '#080705');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 988, 476);

  ctx.fillStyle = accentHex;
  ctx.font = '700 54px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(symbol, 512, 180);

  ctx.fillStyle = '#f3ede2';
  ctx.font = '600 32px "Cinzel", Georgia, serif';
  ctx.fillText(title.slice(0, 42), 512, 265);

  ctx.fillStyle = '#b5ab99';
  ctx.font = '400 20px monospace';
  ctx.fillText(sector, 512, 330);

  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds and mounts a Room API v1 package inside `root` without leaving the page or WebXR session (§4.2).
 * Streams the room's dedicated Neuromicon MP3 track and displays its framed painting inside the room.
 */
export class RoomStreamer {
  private activeModule: RoomModule | null = null;
  private activeCtx: RoomContext | null = null;
  private mountGeneration = 0;

  /**
   * Verifies room entry payload integrity via WebCrypto SHA-256 against the pinned hash in world.graph.json
   * (AGENTS.md §4.3 & EXPERIENCE_PROTOCOL.md §7.2.3).
   * Fail-closed: returns false if room is unknown, planned, missing expected hash, WebCrypto is unavailable,
   * or the computed SHA-256 digest does not match expectedHash.
   */
  public async verifyRoomEntryHash(
    roomId: string,
    sourcePayload?: string | Uint8Array,
    expectedHashOverride?: string
  ): Promise<boolean> {
    const node = getWorldNodes().find((n) => n.id === roomId);
    if (!node || node.status === 'planned') return false;

    const rawExpected = expectedHashOverride ?? node.entryHash;
    if (!rawExpected || typeof rawExpected !== 'string') return false;

    const expectedHex = rawExpected
      .replace(/^sha256-/i, '')
      .trim()
      .toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedHex)) return false;

    if (
      typeof crypto === 'undefined' ||
      !crypto.subtle ||
      typeof crypto.subtle.digest !== 'function'
    ) {
      return false;
    }

    let bytes: Uint8Array;
    if (sourcePayload !== undefined) {
      bytes =
        typeof sourcePayload === 'string'
          ? new TextEncoder().encode(sourcePayload)
          : sourcePayload;
    } else {
      const canonical = getCanonicalRoomPayload(roomId);
      if (!canonical) return false;
      bytes = new TextEncoder().encode(canonical);
    }

    try {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        bytes as unknown as BufferSource
      );
      const actualHex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return actualHex === expectedHex;
    } catch {
      return false;
    }
  }

  public unmountCurrentRoom(root: THREE.Group, scene?: THREE.Scene): void {
    this.mountGeneration += 1;
    nebulaSkySystem.unmountSky(root, scene);
    if (this.activeModule && this.activeCtx) {
      try {
        this.activeModule.unmount(this.activeCtx);
      } catch {
        // Ensure cleanup continues even if room module throws
      }
      if (this.activeCtx.root && this.activeCtx.root !== root) {
        disposeThreeHierarchy(this.activeCtx.root);
      }
    }
    disposeThreeHierarchy(root);
    this.activeModule = null;
    this.activeCtx = null;
  }

  public notifyPause(paused: boolean): void {
    if (!this.activeModule || !this.activeCtx) return;
    if (paused) {
      this.activeModule.onPause?.(this.activeCtx);
    } else {
      this.activeModule.onResume?.(this.activeCtx);
    }
  }

  public updateCurrentRoom(dt: number): void {
    if (dt <= 0) return;
    if (this.activeModule?.update && this.activeCtx) {
      this.activeModule.update(dt, this.activeCtx);
    }
  }

  public mountRoom(
    roomId: string,
    root: THREE.Group,
    scene: THREE.Scene,
    state: HubPlayerState,
    ctx: RoomContext,
    registerTarget: (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => void,
    walkableMeshes: THREE.Object3D[]
  ): RoomV1Manifest | null {
    this.unmountCurrentRoom(root, scene);

    const manifest = getRoomV1Manifest(roomId);
    const node = getWorldNodes().find((n) => n.id === roomId);
    if (!manifest || (node && node.status === 'planned')) {
      this.mountVoidFallback(
        roomId,
        root,
        scene,
        state,
        registerTarget,
        walkableMeshes
      );
      return null;
    }

    const mountGen = this.mountGeneration;
    const isAscent = node ? node.branch === 'ascend' : true;

    // 1. Mount 4-Layer Real Astronomical Nebula Sky + Palette-Driven Lighting Rig (<= 2 real-time lights, 0 shadows, TZ.md §3 & §4)
    const skyRig = nebulaSkySystem.mountRoomSkyAndLighting(
      roomId,
      root,
      scene,
      {
        nebulaId: manifest.sky?.nebulaId,
        rotation: manifest.sky?.rotation,
        intensity: manifest.sky?.intensity,
        qualityTier: state.comfort.qualityTier,
        reducedMotion: state.comfort.reducedMotion,
      }
    );

    const accentHex =
      skyRig.palette[0] ??
      (roomId === 'ROOM_1149'
        ? '#e5c158'
        : isAscent
        ? '#c8a464'
        : '#4ea8de');
    const rimHex = skyRig.palette[2] ?? accentHex;

    // Start streaming this room's dedicated Neuromicon MP3 track immediately!
    ctx.audio.playRoomTrack(
      manifest.audio.track,
      manifest.audio.baseHz ?? 144
    );

    const width = 16;
    const height = 7.6;
    const depth = 18;
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    const wallMat = new THREE.MeshLambertMaterial({
      color: skyRig.tone === 'warm' ? '#1c1816' : '#111722',
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: skyRig.tone === 'warm' ? '#15120f' : '#0b1018',
      roughness: skyRig.tone === 'cool' ? 0.14 : 0.24,
      metalness: 0.48,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.24,
      metalness: 0.85,
      emissive: rimHex,
      emissiveIntensity: 0.22,
    });

    // 2. Walkable Room Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    // Open Celestial Oculus Cornice at y = height so the Room's Real Astronomical Nebula Cap & Starfield shine overhead!
    const oculusCornice = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.28, 12, 48),
      trimMat
    );
    oculusCornice.rotation.x = Math.PI * 0.5;
    oculusCornice.position.set(0, height, 0);
    root.add(oculusCornice);

    // Branch Polish (TZ.md §4.3): Warm Nebula -> Additive Light Shaft; Cool Nebula -> Reflective Caustic Ring Pool
    if (skyRig.tone === 'warm') {
      const shaftCone = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, height, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: rimHex,
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      shaftCone.position.set(0, height * 0.5, -1.5);
      root.add(shaftCone);
    } else {
      const causticRing = new THREE.Mesh(
        new THREE.RingGeometry(1.1, 2.3, 40),
        new THREE.MeshStandardMaterial({
          color: skyRig.palette[1] ?? '#4ea8de',
          roughness: 0.08,
          metalness: 0.92,
          emissive: accentHex,
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      causticRing.rotation.x = -Math.PI * 0.5;
      causticRing.position.set(0, 0.015, -1.5);
      root.add(causticRing);
    }

    // 4 Outer Walls
    const nWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMat
    );
    nWall.position.set(0, height * 0.5, -halfD);
    root.add(nWall);

    const sWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      wallMat
    );
    sWall.rotation.y = Math.PI;
    sWall.position.set(0, height * 0.5, halfD);
    root.add(sWall);

    const wWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMat
    );
    wWall.rotation.y = Math.PI * 0.5;
    wWall.position.set(-halfW, height * 0.5, 0);
    root.add(wWall);

    const eWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMat
    );
    eWall.rotation.y = -Math.PI * 0.5;
    eWall.position.set(halfW, height * 0.5, 0);
    root.add(eWall);

    // 3. Monumental Framed Neuromicon Painting on West Sanctuary Wall (Grounded pedestal + framed canvas!)
    if (manifest.artwork) {
      const artGroup = new THREE.Group();
      artGroup.position.set(-halfW + 0.14, 0, -0.2);
      artGroup.rotation.y = Math.PI * 0.5;

      // Grounded stone plinth beneath the painting
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 0.35, 0.55),
        wallMat
      );
      plinth.position.set(0, 0.175, 0.18);
      artGroup.add(plinth);

      // Sculpted metallic frame
      const outerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 2.9, 0.16),
        trimMat
      );
      outerFrame.position.set(0, 2.55, 0.08);
      artGroup.add(outerFrame);

      // Painting canvas with live TextureLoader from https://github.com/AlexSheff/Neuromicon
      const fallbackTex = createRoomPaintingFallbackTexture(
        manifest.identity.symbol,
        manifest.identity.name,
        manifest.artwork.sector ?? manifest.identity.dimension,
        accentHex
      );
      const paintingMat = new THREE.MeshBasicMaterial({ map: fallbackTex });

      if (manifest.artwork.imageUrl && typeof document !== 'undefined') {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(manifest.artwork.imageUrl, (loadedTex) => {
          if (mountGen !== this.mountGeneration) {
            loadedTex.dispose();
            return;
          }
          fallbackTex.dispose();
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          paintingMat.map = loadedTex;
          paintingMat.needsUpdate = true;
        });
      }

      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.85, 2.55),
        paintingMat
      );
      canvasMesh.position.set(0, 2.55, 0.17);
      artGroup.add(canvasMesh);

      // Plaque above the painting
      const artPlaqueTex = createSignageTexture(
        manifest.identity.symbol,
        manifest.identity.name,
        manifest.identity.dimension,
        'PAINTING & ESSAY',
        accentHex,
        '#f0d27a'
      );
      const artPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.8),
        new THREE.MeshBasicMaterial({ map: artPlaqueTex })
      );
      artPlaque.position.set(0, 4.45, 0.16);
      artGroup.add(artPlaque);

      root.add(artGroup);
      registerTarget(artGroup, {
        id: `ROOM_ART_${manifest.id}`,
        kind: 'artwork',
        roomId: manifest.id,
        title: manifest.artwork.title,
        titleRu: manifest.artwork.title,
        subtitle: 'Inspect Painting & Read Transmission Essay',
        subtitleRu: 'Inspect Painting & Read Transmission Essay',
      });
    }

    // 4. Doors A, B, C + Conditional Rabbit Hole (RH) Grounded at y = 0 (§5 & §7.2)
    const doorPlacements: Record<
      'A' | 'B' | 'C' | 'RH',
      { x: number; z: number; rotY: number }
    > = {
      A: { x: -4.2, z: -halfD + 0.08, rotY: 0 },
      B: { x: 0, z: -halfD + 0.08, rotY: 0 },
      C: { x: 4.2, z: -halfD + 0.08, rotY: 0 },
      RH: { x: -halfW + 0.08, z: -5.2, rotY: Math.PI * 0.5 },
    };

    manifest.doors.forEach((door) => {
      if (door.visibility === 'hidden') {
        if (!door.requirement) return;
        const reqKey = `${manifest.id}:${door.requirement.type}:${door.requirement.target}`;
        if (!state.discoveries.includes(reqKey)) {
          return;
        }
      }

      const destManifest = ROOM_MANIFESTS[door.destination];
      const destNode = getWorldNodes().find((n) => n.id === door.destination);
      const isPlanned = destNode?.status === 'planned';
      const pose = doorPlacements[door.id] ?? doorPlacements.C;
      const isRH = door.id === 'RH';

      const dGroup = new THREE.Group();
      dGroup.position.set(pose.x, 0, pose.z);
      dGroup.rotation.y = pose.rotY;

      const dMat = isRH
        ? new THREE.MeshStandardMaterial({
            color: '#f0d27a',
            roughness: 0.2,
            metalness: 0.88,
            emissive: '#4a3510',
            emissiveIntensity: 0.5,
          })
        : trimMat;

      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.14, 0.5),
        wallMat
      );
      step.position.set(0, 0.07, 0.18);
      dGroup.add(step);

      [-0.95, 0.95].forEach((jx) => {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 3.5, 0.36),
          dMat
        );
        jamb.position.set(jx, 1.75, 0.16);
        dGroup.add(jamb);
      });

      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.4, 0.44),
        dMat
      );
      lintel.position.set(0, 3.65, 0.18);
      dGroup.add(lintel);

      const leaf = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 3.36, 0.14),
        new THREE.MeshStandardMaterial({
          color: isRH ? '#261838' : isPlanned ? '#1a1a1c' : '#1b1612',
          roughness: 0.35,
          metalness: 0.55,
        })
      );
      leaf.position.set(0, 0.14 + 1.68, 0.1);
      dGroup.add(leaf);

      const destTitle =
        destManifest?.identity.name || door.label || door.destination;
      const destDim =
        destManifest?.identity.dimension ||
        destNode?.dimension ||
        manifest.identity.dimension;

      const plaqueTex = createSignageTexture(
        door.symbol || door.id,
        destTitle,
        destDim,
        door.destination,
        isRH ? '#f0d27a' : accentHex,
        isPlanned ? '#888888' : '#66cc99'
      );
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 0.74),
        new THREE.MeshBasicMaterial({ map: plaqueTex })
      );
      plaque.position.set(0, 4.28, 0.24);
      dGroup.add(plaque);

      root.add(dGroup);
      registerTarget(dGroup, {
        id: `ROOM_DOOR_${door.id}`,
        kind: 'room-door',
        doorId: door.id,
        roomId: door.destination,
        status: isPlanned ? 'planned' : 'ready',
        title: `${door.symbol || door.id} · ${destTitle}`,
        titleRu: `${door.symbol || door.id} · ${destTitle}`,
        subtitle: destDim,
        subtitleRu: destDim,
      });
    });

    // 5. Non-Portable Physical Room Objects & Busyboards (Grounded at y = 0, omitting onlyInMirror!)
    const physicalObjects = manifest.objects.filter((o) => !o.onlyInMirror);
    physicalObjects.forEach((obj, idx) => {
      const ox = (idx - (physicalObjects.length - 1) * 0.5) * 3.6;
      const oz = 0.5;

      const objGroup = new THREE.Group();
      objGroup.position.set(ox, 0, oz);

      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.36, 1.1),
        wallMat
      );
      ped.position.y = 0.18;
      objGroup.add(ped);

      if (obj.type === 'busyboard') {
        const ring1 = new THREE.Mesh(
          new THREE.TorusGeometry(0.48, 0.04, 14, 36),
          trimMat
        );
        ring1.position.y = 1.25;
        objGroup.add(ring1);

        const ring2 = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.035, 14, 32),
          trimMat
        );
        ring2.rotation.y = Math.PI * 0.35;
        ring2.position.y = 1.25;
        objGroup.add(ring2);
      } else {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.4, 1.9, 6),
          trimMat
        );
        body.position.y = 0.36 + 0.95;
        objGroup.add(body);
      }

      const oPlaqueTex = createSignageTexture(
        obj.type === 'busyboard' ? '⚙' : '◆',
        obj.title || obj.id,
        manifest.identity.dimension,
        manifest.id,
        accentHex,
        '#f3ede2'
      );
      const oPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(1.65, 0.56),
        new THREE.MeshBasicMaterial({
          map: oPlaqueTex,
          side: THREE.DoubleSide,
        })
      );
      oPlaque.position.set(0, 2.55, 0);
      objGroup.add(oPlaque);

      root.add(objGroup);
      registerTarget(objGroup, {
        id: `OBJ_${obj.id}`,
        kind: 'room-object',
        objectId: obj.id,
        title: obj.title || obj.id,
        titleRu: obj.title || obj.id,
        subtitle: manifest.identity.dimension,
        subtitleRu: manifest.identity.dimension,
      });
    });

    // 6. The Mirror System on East Wall (Grounded at y = 0, with 3D Mirror Choices + Ghost Reflection!)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(halfW - 0.1, 0, -0.5);
    mirrorGroup.rotation.y = -Math.PI * 0.5;

    const mBase = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.22, 0.55),
      wallMat
    );
    mBase.position.set(0, 0.11, 0.2);
    mirrorGroup.add(mBase);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.6),
      new THREE.MeshStandardMaterial({
        color: '#102234',
        roughness: 0.08,
        metalness: 0.88,
        transparent: true,
        opacity: 0.78,
      })
    );
    glass.position.set(0, 2.0, 0.12);
    mirrorGroup.add(glass);

    const mPlaqueTex = createSignageTexture(
      'MIRROR',
      manifest.mirror.characterState,
      `Identity: ${
        state.identityChoices[manifest.id]?.toUpperCase() ?? 'UNDECIDED'
      }`,
      'ACCEPT · REJECT · BACK',
      '#7cc6f2',
      '#f0d27a'
    );
    const mPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.85),
      new THREE.MeshBasicMaterial({ map: mPlaqueTex })
    );
    mPlaque.position.set(0, 4.35, 0.22);
    mirrorGroup.add(mPlaque);

    const choices: Array<{
      choice: 'accept' | 'reject' | 'back';
      label: string;
      x: number;
      color: string;
    }> = [
      {
        choice: 'accept',
        label: 'ACCEPT IDENTITY',
        x: -1.15,
        color: '#66cc99',
      },
      {
        choice: 'reject',
        label: 'REJECT IDENTITY',
        x: 0,
        color: '#e07a5f',
      },
      {
        choice: 'back',
        label: 'BACK TO CORRIDOR',
        x: 1.15,
        color: '#c8a464',
      },
    ];

    choices.forEach((c) => {
      const btnMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.42, 0.25),
        new THREE.MeshStandardMaterial({
          color: c.color,
          roughness: 0.3,
          metalness: 0.7,
        })
      );
      btnMesh.position.set(c.x, 1.05, 0.42);
      mirrorGroup.add(btnMesh);

      registerTarget(btnMesh, {
        id: `MIRROR_CHOICE_${c.choice}`,
        kind: 'room-mirror',
        mirrorChoice: c.choice,
        title: `Mirror: ${c.label}`,
        titleRu: `Mirror: ${c.label}`,
        subtitle: manifest.mirror.characterState,
        subtitleRu: manifest.mirror.characterState,
      });
    });

    // Ghost Objects that exist ONLY inside the Mirror Reflection (`onlyInMirror: true`, §5 & §7.7!)
    manifest.objects
      .filter((o) => o.onlyInMirror)
      .forEach((ghostObj) => {
        const ghostMesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.48, 0),
          new THREE.MeshStandardMaterial({
            color: '#9be2ff',
            roughness: 0.15,
            metalness: 0.9,
            emissive: '#2c7da0',
            emissiveIntensity: 0.85,
          })
        );
        ghostMesh.position.set(0, 2.35, 0.25);
        mirrorGroup.add(ghostMesh);

        registerTarget(ghostMesh, {
          id: `GHOST_${ghostObj.id}`,
          kind: 'room-object',
          objectId: ghostObj.id,
          title: `${ghostObj.title || ghostObj.id} [MIRROR ANOMALY]`,
          titleRu: `${ghostObj.title || ghostObj.id} [MIRROR ANOMALY]`,
          subtitle: 'Interact with Reflection to Unlock Rabbit Hole (Door RH)',
          subtitleRu: 'Interact with Reflection to Unlock Rabbit Hole (Door RH)',
        });
      });

    root.add(mirrorGroup);

    // 7. South Exit Portal: Return to the Sector Room (Stops Room MP3 on exit)
    const southExitGroup = new THREE.Group();
    southExitGroup.position.set(0, 0, halfD - 0.12);
    southExitGroup.rotation.y = Math.PI;

    const sArch = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.6, 0.28),
      trimMat
    );
    sArch.position.y = 1.8;
    southExitGroup.add(sArch);

    const sPlaqueTex = createSignageTexture(
      '↺',
      `SECTOR ROOM ${state.segmentIndex}`,
      'EXIT ROOM (STOPS TRACK)',
      'RETURN',
      accentHex,
      '#d8cfc0'
    );
    const sPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.8),
      new THREE.MeshBasicMaterial({ map: sPlaqueTex })
    );
    sPlaque.position.set(0, 4.15, 0.22);
    southExitGroup.add(sPlaque);

    root.add(southExitGroup);
    registerTarget(southExitGroup, {
      id: `ROOM_SOUTH_EXIT_${manifest.id}`,
      kind: 'room-mirror',
      mirrorChoice: 'back',
      title: `↺ RETURN TO SECTOR ROOM ${state.segmentIndex}`,
      titleRu: `↺ RETURN TO SECTOR ROOM ${state.segmentIndex}`,
      subtitle: 'Leave Room & Stop Track',
      subtitleRu: 'Leave Room & Stop Track',
    });

    // 8. Execute Room API v1 `mount(ctx)` from `room-template/index.ts`
    this.activeModule = templateRoomModule;
    this.activeCtx = ctx;
    void this.activeModule.mount(ctx);

    return manifest;
  }

  /**
   * Designed Void Fallback Space (EXPERIENCE_PROTOCOL.md §3.3 & §7.2.3).
   */
  public mountVoidFallback(
    roomId: string,
    root: THREE.Group,
    scene: THREE.Scene,
    state: HubPlayerState,
    registerTarget: (
      mesh: THREE.Object3D,
      target: SpatialInteractiveTarget
    ) => void,
    walkableMeshes: THREE.Object3D[]
  ): void {
    this.unmountCurrentRoom(root, scene);

    nebulaSkySystem.mountRoomSkyAndLighting('VOID_FALLBACK', root, scene, {
      intensity: 0.5,
      qualityTier: state.comfort.qualityTier,
      reducedMotion: state.comfort.reducedMotion,
      fogScale: 1.5,
    });

    const islandMat = new THREE.MeshStandardMaterial({
      color: '#0c1622',
      roughness: 0.12,
      metalness: 0.85,
    });
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 8.2, 0.4, 36),
      islandMat
    );
    island.position.set(0, -0.2, 0);
    root.add(island);
    walkableMeshes.push(island);

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#4ea8de',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    for (let i = 1; i <= 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(i * 2.4, i * 2.4 + 0.08, 48),
        ringMat
      );
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(0, 0.02, -2.0);
      root.add(ring);
    }

    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, -3.2);

    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.8, 0.28),
      new THREE.MeshStandardMaterial({
        color: '#c8a464',
        roughness: 0.25,
        metalness: 0.82,
        emissive: '#382910',
        emissiveIntensity: 0.45,
      })
    );
    arch.position.y = 1.9;
    portalGroup.add(arch);

    const plaqueTex = createSignageTexture(
      '↺',
      roomId,
      `${state.branch.toUpperCase()} · SEG ${state.segmentIndex}`,
      'VOID THRESHOLD',
      '#c8a464',
      '#7cc6f2'
    );
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.1),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, 4.35, 0.2);
    portalGroup.add(plaque);

    root.add(portalGroup);
    registerTarget(portalGroup, {
      id: 'VOID_FALLBACK_RETURN',
      kind: 'room-mirror',
      mirrorChoice: 'back',
      title: `↺ ${state.branch.toUpperCase()} · ${state.segmentIndex}`,
      titleRu: `↺ ${state.branch.toUpperCase()} · ${state.segmentIndex}`,
      subtitle: roomId,
      subtitleRu: roomId,
    });
  }

  /**
   * 30-Transition GPU Memory Leak Verification (EXPERIENCE_PROTOCOL.md §9.1).
   * Measures both `renderer.info.memory.geometries` / `renderer.info.memory.textures` deltas
   * and Three.js native `'dispose'` event tracking across 30 room mount/unmount cycles.
   */
  public runThirtyTransitionLeakTest(
    scene: THREE.Scene,
    state: HubPlayerState,
    ctx: RoomContext,
    renderer?: {
      info: { memory: { geometries: number; textures: number } };
      render?: (scene: THREE.Scene, camera: THREE.Camera) => void;
    },
    camera?: THREE.Camera
  ): {
    iterations: number;
    passed: boolean;
    geometriesDelta: number;
    texturesDelta: number;
    materialLeaks: number;
  } {
    const testRoot = new THREE.Group();
    scene.add(testRoot);

    const testApiRoot = new THREE.Group();
    scene.add(testApiRoot);

    // Warm up the single shared L0 Starfield texture before capturing the baseline snapshot
    nebulaSkySystem.mountRoomSkyAndLighting('ROOM_001', testRoot, scene, {
      qualityTier: state.comfort.qualityTier,
      reducedMotion: state.comfort.reducedMotion,
    });
    if (renderer?.render && camera) {
      renderer.render(scene, camera);
    }
    nebulaSkySystem.unmountSky(testRoot, scene);
    nebulaSkySystem.clearPreloadCache();
    if (renderer?.render && camera) {
      renderer.render(scene, camera);
    }

    const baseGeometries = renderer?.info.memory.geometries ?? 0;
    const baseTextures = renderer?.info.memory.textures ?? 0;

    const undisposedGeometries = new Set<THREE.BufferGeometry>();
    const undisposedMaterials = new Set<THREE.Material>();
    const undisposedTextures = new Set<THREE.Texture>();

    const trackHierarchyResources = (group: THREE.Object3D) => {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && !undisposedGeometries.has(mesh.geometry)) {
          const geo = mesh.geometry;
          undisposedGeometries.add(geo);
          const onGeoDispose = () => {
            undisposedGeometries.delete(geo);
            geo.removeEventListener('dispose', onGeoDispose);
          };
          geo.addEventListener('dispose', onGeoDispose);
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((mat) => {
            if (!undisposedMaterials.has(mat)) {
              undisposedMaterials.add(mat);
              const onMatDispose = () => {
                undisposedMaterials.delete(mat);
                mat.removeEventListener('dispose', onMatDispose);
              };
              mat.addEventListener('dispose', onMatDispose);
            }
            const basic = mat as THREE.MeshBasicMaterial;
            // Track all per-room textures (excluding the shared L0 starfield sphere at renderOrder -10)
            if (
              basic.map &&
              mesh.renderOrder !== -10 &&
              !undisposedTextures.has(basic.map)
            ) {
              const tex = basic.map;
              undisposedTextures.add(tex);
              const onTexDispose = () => {
                undisposedTextures.delete(tex);
                tex.removeEventListener('dispose', onTexDispose);
              };
              tex.addEventListener('dispose', onTexDispose);
            }
          });
        }
      });
    };

    for (let i = 0; i < 30; i++) {
      const cycleRoomId = `ROOM_${String((i % 25) + 1).padStart(3, '0')}`;
      const cycleManifest =
        getRoomV1Manifest(cycleRoomId) ?? ctx.manifest;
      const silentCtx: RoomContext = {
        ...ctx,
        root: testApiRoot,
        manifest: cycleManifest,
        audio: {
          playRoomTrack: () => {},
          triggerTone: () => {},
          bus: () => null,
        },
      };

      const dummyWalkables: THREE.Object3D[] = [];
      this.mountRoom(
        cycleRoomId,
        testRoot,
        scene,
        state,
        silentCtx,
        () => {},
        dummyWalkables
      );

      if (scene.environment && !undisposedTextures.has(scene.environment)) {
        const envTex = scene.environment;
        undisposedTextures.add(envTex);
        const onEnvDispose = () => {
          undisposedTextures.delete(envTex);
          envTex.removeEventListener('dispose', onEnvDispose);
        };
        envTex.addEventListener('dispose', onEnvDispose);
      }

      trackHierarchyResources(testRoot);
      trackHierarchyResources(testApiRoot);

      if (renderer?.render && camera) {
        renderer.render(scene, camera);
      }

      this.unmountCurrentRoom(testRoot, scene);
    }

    nebulaSkySystem.clearPreloadCache();
    if (renderer?.render && camera) {
      renderer.render(scene, camera);
    }

    const rendererGeoDelta = renderer
      ? Math.max(0, renderer.info.memory.geometries - baseGeometries)
      : 0;
    const rendererTexDelta = renderer
      ? Math.max(0, renderer.info.memory.textures - baseTextures)
      : 0;

    const geometriesDelta = Math.max(
      rendererGeoDelta,
      undisposedGeometries.size
    );
    const texturesDelta = Math.max(
      rendererTexDelta,
      undisposedTextures.size
    );
    const materialLeaks = undisposedMaterials.size;
    const remainingChildren =
      testRoot.children.length + testApiRoot.children.length;

    scene.remove(testRoot);
    scene.remove(testApiRoot);

    return {
      iterations: 30,
      passed:
        remainingChildren === 0 &&
        geometriesDelta === 0 &&
        texturesDelta === 0 &&
        materialLeaks === 0,
      geometriesDelta,
      texturesDelta,
      materialLeaks,
    };
  }
}

export const roomStreamer = new RoomStreamer();
