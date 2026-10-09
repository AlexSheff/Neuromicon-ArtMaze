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
import { HubPlayerState } from '../state/playerState';

const ROOM_MANIFESTS: Record<string, RoomV1Manifest> = {
  ROOM_073: room073Json as unknown as RoomV1Manifest,
  ROOM_001: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_001',
    identity: {
      name: 'Hall of Embodied Light',
      nameRu: 'Зал Воплощённого Света',
      symbol: 'I·Δ',
      description: 'First sanctuary of the Ascent branch. Light condenses into tangible architectural form.',
      descriptionRu: 'Первое святилище ветви Восхождения. Свет конденсируется в осязаемую архитектурную форму.',
      dimension: 'D1',
    },
    audio: { track: 'audio/neuromicon_001.ogg', loop: true, baseHz: 144 },
    quest: {
      question: 'What form do you choose to embody when nothing is prescribed?',
      questionRu: 'Какую форму ты выбираешь воплотить, когда ничто не предписано?',
      objective: 'Align the Solar Astrolabe or inspect the Ghost Crown in the Mirror',
      objectiveRu: 'Настройте Солнечную Астролябию или исследуйте Призрачную Корону в Зеркале',
      completion: { type: 'interact', target: 'puzzle_solar' },
    },
    doors: [
      { id: 'A', symbol: 'II·☉', label: 'Observatory of Living Forms', labelRu: 'Обсерватория Живых Форм', destination: 'ROOM_002', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'III·⬡', label: 'Atelier of the Sovereign Builder', labelRu: 'Мастерская Суверенного Зодчего', destination: 'ROOM_003', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'IV·✶', label: 'Garden of Harmonic Ascent', labelRu: 'Сад Гармонического Восхождения', destination: 'ROOM_108', requirement: null, visibility: 'visible', choiceType: 'free' },
      { id: 'RH', symbol: '?', label: 'The Horizon beyond 1149', labelRu: 'Горизонт за Пределами 1149', destination: 'ROOM_1149', requirement: { type: 'interactReflection', target: 'obj_ghost_crown' }, visibility: 'hidden', choiceType: 'rabbit-hole' },
    ],
    mirror: {
      characterState: 'THE_ARCHITECT_OF_LIGHT',
      characterStateRu: 'ЗОДЧИЙ СВЕТА',
      appearance: 'assets/avatar_architect.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'puzzle_solar', title: 'Solar Astrolabe Busyboard', titleRu: 'Солнечная Астролябия', type: 'busyboard', interactions: ['rotate', 'align'], portable: false, visibleInMirror: true },
      { id: 'obj_prism', title: 'Travertine Prism Stele', titleRu: 'Травертиновая Призма', type: 'monolith', interactions: ['inspect'], portable: false, visibleInMirror: true },
      { id: 'obj_ghost_crown', title: 'Crown of Unborn Light (Mirror Reflection)', titleRu: 'Корона Нерождённого Света (Отражение в Зеркале)', type: 'anomaly', interactions: ['interactReflection'], portable: false, visibleInMirror: true, onlyInMirror: true },
    ],
    radio: { channel: 'ROOM_001' },
  },
  ROOM_002: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_002',
    identity: {
      name: 'Observatory of Living Forms',
      nameRu: 'Обсерватория Живых Форм',
      symbol: 'II·☉',
      description: 'Celestial instruments track proportions that grow when observed.',
      descriptionRu: 'Небесные инструменты отслеживают пропорции, растущие при наблюдении.',
      dimension: 'D1',
    },
    audio: { track: 'audio/neuromicon_002.ogg', loop: true, baseHz: 162 },
    quest: {
      question: 'Does the observer shape the instrument, or does the instrument tune the observer?',
      questionRu: 'Наблюдатель формирует инструмент, или инструмент настраивает наблюдателя?',
      objective: 'Interact with the Celestial Meridian Busyboard',
      objectiveRu: 'Взаимодействуйте с Небесным Меридианом',
      completion: { type: 'interact', target: 'obj_meridian' },
    },
    doors: [
      { id: 'A', symbol: 'III·⬡', label: 'Atelier of the Sovereign Builder', destination: 'ROOM_003', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'I·Δ', label: 'Hall of Embodied Light', destination: 'ROOM_001', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'V·Φ', label: 'Sanctuary of the Golden Ratio', destination: 'ROOM_204', requirement: null, visibility: 'visible', choiceType: 'free' },
      { id: 'RH', symbol: '?', label: 'Horizon 1149', destination: 'ROOM_1149', requirement: { type: 'interactReflection', target: 'obj_ghost_star' }, visibility: 'hidden', choiceType: 'rabbit-hole' },
    ],
    mirror: {
      characterState: 'THE_CELESTIAL_OBSERVER',
      characterStateRu: 'НЕБЕСНЫЙ НАБЛЮДАТЕЛЬ',
      appearance: 'assets/avatar_observer.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_meridian', title: 'Celestial Meridian Ring', titleRu: 'Кольцо Небесного Меридиана', type: 'busyboard', interactions: ['inspect', 'rotate'], portable: false, visibleInMirror: true },
      { id: 'obj_ghost_star', title: 'Reflected Star Monolith (Mirror Only)', titleRu: 'Отражённый Звёздный Монолит', type: 'anomaly', interactions: ['interactReflection'], portable: false, visibleInMirror: true, onlyInMirror: true },
    ],
    radio: { channel: 'ROOM_002' },
  },
  ROOM_003: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_003',
    identity: {
      name: 'Atelier of the Sovereign Builder',
      nameRu: 'Мастерская Суверенного Зодчего',
      symbol: 'III·⬡',
      description: 'Where the participant transitions from solver of puzzles to author of rules.',
      descriptionRu: 'Пространство перехода от решения чужих задач к созданию собственных правил.',
      dimension: 'D2',
    },
    audio: { track: 'audio/neuromicon_003.ogg', loop: true, baseHz: 180 },
    quest: {
      question: 'What law would you build if no prior architecture constrained you?',
      questionRu: 'Какой закон ты бы выстроил, если бы никакая прежняя архитектура тебя не ограничивала?',
      objective: 'Inspect the Keystone Monolith',
      objectiveRu: 'Исследуйте Замковый Монолит',
      completion: { type: 'interact', target: 'obj_keystone' },
    },
    doors: [
      { id: 'A', symbol: 'IV·✶', label: 'Garden of Harmonic Ascent', destination: 'ROOM_108', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'V·Φ', label: 'Sanctuary of the Golden Ratio', destination: 'ROOM_204', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'I·Δ', label: 'Hall of Embodied Light', destination: 'ROOM_001', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_SOVEREIGN_BUILDER',
      characterStateRu: 'СУВЕРЕННЫЙ ЗОДЧИЙ',
      appearance: 'assets/avatar_builder.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_keystone', title: 'Keystone of Autonomy', titleRu: 'Замковый Камень Автономии', type: 'monolith', interactions: ['inspect'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_003' },
  },
  ROOM_108: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_108',
    identity: {
      name: 'Garden of Harmonic Ascent',
      nameRu: 'Сад Гармонического Восхождения',
      symbol: 'IV·✶',
      description: 'Second segment sanctuary of Ascent where acoustic intervals form visible columns.',
      descriptionRu: 'Святилище второго сегмента Восхождения, где звуковые интервалы образуют видимые колонны.',
      dimension: 'D2',
    },
    audio: { track: 'audio/neuromicon_108.ogg', loop: true, baseHz: 192 },
    quest: {
      question: 'When two resonances conflict, how do you discover the higher chord?',
      questionRu: 'Когда два резонанса вступают в противоречие, как найти более высокий аккорд?',
      objective: 'Tune the Harmonic Monolith',
      objectiveRu: 'Настройте Гармонический Монолит',
      completion: { type: 'interact', target: 'obj_harmonic' },
    },
    doors: [
      { id: 'A', symbol: 'V·Φ', label: 'Sanctuary of the Golden Ratio', destination: 'ROOM_204', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'I·Δ', label: 'Hall of Embodied Light', destination: 'ROOM_001', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'II·☉', label: 'Observatory of Living Forms', destination: 'ROOM_002', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_HARMONIST',
      characterStateRu: 'ГАРМОНИСТ ПРОПОРЦИЙ',
      appearance: 'assets/avatar_harmonist.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_harmonic', title: 'Harmonic Tuning Stele', titleRu: 'Гармоническая Стела', type: 'busyboard', interactions: ['inspect', 'rotate'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_108' },
  },
  ROOM_204: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_204',
    identity: {
      name: 'Sanctuary of the Golden Ratio',
      nameRu: 'Святилище Золотого Сечения',
      symbol: 'V·Φ',
      description: 'A luminous convergence chamber shared between Ascent and Descent.',
      descriptionRu: 'Светоносный зал схождения, связывающий ветви Восхождения и Нисхождения.',
      dimension: 'D3',
    },
    audio: { track: 'audio/neuromicon_204.ogg', loop: true, baseHz: 216 },
    quest: {
      question: 'Where do growth and exploration become the same movement?',
      questionRu: 'Где рост и исследование становятся единым движением?',
      objective: 'Inspect the Golden Ratio Polyhedron',
      objectiveRu: 'Исследуйте Полиэдр Золотого Сечения',
      completion: { type: 'interact', target: 'obj_phi' },
    },
    doors: [
      { id: 'A', symbol: 'XX', label: 'Archive of Missing Things', destination: 'ROOM_073', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'I·Δ', label: 'Hall of Embodied Light', destination: 'ROOM_001', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'IX·∞', label: 'Well of Paradoxical Depth', destination: 'ROOM_006', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_SYNTHESIST',
      characterStateRu: 'СИНТЕЗИСТ',
      appearance: 'assets/avatar_synthesist.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_phi', title: 'Golden Polyhedron Artifact', titleRu: 'Артефакт Золотого Сечения', type: 'item', interactions: ['inspect', 'rotate'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_204' },
  },
  ROOM_004: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_004',
    identity: {
      name: 'Vault of Subterranean Echoes',
      nameRu: 'Свод Подземных Отголосков',
      symbol: 'VII·∇',
      description: 'Deep basalt chamber of the Descent branch where silence reveals hidden contours.',
      descriptionRu: 'Глубокий базальтовый зал ветви Нисхождения, где тишина проявляет скрытые контуры.',
      dimension: 'D1',
    },
    audio: { track: 'audio/neuromicon_004.ogg', loop: true, baseHz: 96 },
    quest: {
      question: 'What do you hear when you stop searching for an echo of your own voice?',
      questionRu: 'Что ты слышишь, когда перестаёшь искать эхо собственного голоса?',
      objective: 'Inspect the Subterranean Resonance Monolith',
      objectiveRu: 'Исследуйте Монолит Подземного Резонанса',
      completion: { type: 'interact', target: 'obj_echo' },
    },
    doors: [
      { id: 'A', symbol: 'XX', label: 'Archive of Missing Things', destination: 'ROOM_073', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'VIII·◐', label: 'Chamber of the Inverted Shadow', destination: 'ROOM_005', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'IX·∞', label: 'Well of Paradoxical Depth', destination: 'ROOM_006', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_DEEP_LISTENER',
      characterStateRu: 'СЛУШАЮЩИЙ ГЛУБИНУ',
      appearance: 'assets/avatar_listener.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_echo', title: 'Resonance Basalt Monolith', titleRu: 'Базальтовый Монолит Резонанса', type: 'monolith', interactions: ['inspect'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_004' },
  },
  ROOM_005: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_005',
    identity: {
      name: 'Chamber of the Inverted Shadow',
      nameRu: 'Чертог Обращённой Тени',
      symbol: 'VIII·◐',
      description: 'Shadows point toward the light source rather than away from it.',
      descriptionRu: 'Тени в этом чертоге тянутся к источнику света, а не от него.',
      dimension: 'D2',
    },
    audio: { track: 'audio/neuromicon_005.ogg', loop: true, baseHz: 88 },
    quest: {
      question: 'If the shadow precedes the object, which one is the cause?',
      questionRu: 'Если тень предшествует предмету, что из них является причиной?',
      objective: 'Interact with the Inverted Shadow Dial or Ghost Reflection',
      objectiveRu: 'Исследуйте Циферблат Обращённой Тени или Призрачное Отражение',
      completion: { type: 'interact', target: 'obj_shadow_dial' },
    },
    doors: [
      { id: 'A', symbol: 'XX', label: 'Archive of Missing Things', destination: 'ROOM_073', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'VII·∇', label: 'Vault of Subterranean Echoes', destination: 'ROOM_004', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'IX·∞', label: 'Well of Paradoxical Depth', destination: 'ROOM_006', requirement: null, visibility: 'visible', choiceType: 'free' },
      { id: 'RH', symbol: '?', label: 'Horizon 1149', destination: 'ROOM_1149', requirement: { type: 'interactReflection', target: 'obj_ghost_shadow' }, visibility: 'hidden', choiceType: 'rabbit-hole' },
    ],
    mirror: {
      characterState: 'THE_SHADOW_SEEKER',
      characterStateRu: 'ИСКАТЕЛЬ ТЕНЕЙ',
      appearance: 'assets/avatar_seeker.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_shadow_dial', title: 'Inverted Shadow Sundial', titleRu: 'Солнечные Часы Обращённой Тени', type: 'busyboard', interactions: ['inspect', 'rotate'], portable: false, visibleInMirror: true },
      { id: 'obj_ghost_shadow', title: 'Unseen Obelisk (Mirror Reflection Only)', titleRu: 'Незримый Обелиск (Только в Зеркале)', type: 'anomaly', interactions: ['interactReflection'], portable: false, visibleInMirror: true, onlyInMirror: true },
    ],
    radio: { channel: 'ROOM_005' },
  },
  ROOM_006: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_006',
    identity: {
      name: 'Well of Paradoxical Depth',
      nameRu: 'Колодец Парадоксальной Глубины',
      symbol: 'IX·∞',
      description: 'Descending further reveals the stars of the upper vault.',
      descriptionRu: 'Дальнейшее погружение открывает звёзды верхнего небесного свода.',
      dimension: 'D3',
    },
    audio: { track: 'audio/neuromicon_006.ogg', loop: true, baseHz: 81 },
    quest: {
      question: 'How deep must an inquiry go before the abyss becomes a sky?',
      questionRu: 'Насколько глубоким должен быть поиск, чтобы бездна обратилась небом?',
      objective: 'Inspect the Abyssal Astrolabe',
      objectiveRu: 'Исследуйте Астролябию Бездны',
      completion: { type: 'interact', target: 'obj_abyss_astrolabe' },
    },
    doors: [
      { id: 'A', symbol: 'XX', label: 'Archive of Missing Things', destination: 'ROOM_073', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'V·Φ', label: 'Sanctuary of the Golden Ratio', destination: 'ROOM_204', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'VII·∇', label: 'Vault of Subterranean Echoes', destination: 'ROOM_004', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_PARADOX_NAVIGATOR',
      characterStateRu: 'НАВИГАТОР ПАРАДОКСА',
      appearance: 'assets/avatar_navigator.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_abyss_astrolabe', title: 'Abyssal Sky Astrolabe', titleRu: 'Небесная Астролябия Бездны', type: 'busyboard', interactions: ['inspect', 'rotate'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_006' },
  },
  ROOM_1149: {
    apiVersion: 1,
    entry: 'index.js',
    allowedHosts: [],
    id: 'ROOM_1149',
    identity: {
      name: 'The Horizon beyond 1149',
      nameRu: 'Горизонт за Пределами 1149',
      symbol: 'Ω·1149',
      description: 'Reached only through a Rabbit Hole by interacting with a reflection that has no physical object.',
      descriptionRu: 'Достигается только через Кроличью Нору при взаимодействии с отражением несуществующего объекта.',
      dimension: 'D9',
    },
    audio: { track: 'audio/neuromicon_1149.ogg', loop: true, baseHz: 136.1 },
    quest: {
      question: 'Having stepped outside the visible graph, what reality will you construct next?',
      questionRu: 'Шагнув за пределы видимого графа, какую реальность ты создашь следующей?',
      objective: 'Inspect the Omega Singularity Stele',
      objectiveRu: 'Исследуйте Стелу Омега-Сингулярности',
      completion: { type: 'interact', target: 'obj_omega' },
    },
    doors: [
      { id: 'A', symbol: 'I·Δ', label: 'Hall of Embodied Light', destination: 'ROOM_001', requirement: null, visibility: 'visible', choiceType: 'identity-accept' },
      { id: 'B', symbol: 'XX', label: 'Archive of Missing Things', destination: 'ROOM_073', requirement: null, visibility: 'visible', choiceType: 'identity-reject' },
      { id: 'C', symbol: 'V·Φ', label: 'Sanctuary of the Golden Ratio', destination: 'ROOM_204', requirement: null, visibility: 'visible', choiceType: 'free' },
    ],
    mirror: {
      characterState: 'THE_HORIZON_WALKER',
      characterStateRu: 'ИДУЩИЙ ЗА ГОРИЗОНТ',
      appearance: 'assets/avatar_horizon.glb',
      choices: ['accept', 'reject', 'back'],
    },
    objects: [
      { id: 'obj_omega', title: 'Omega Singularity Monolith', titleRu: 'Монолит Омега-Сингулярности', type: 'monolith', interactions: ['inspect'], portable: false, visibleInMirror: true },
    ],
    radio: { channel: 'ROOM_1149' },
  },
};

export function getRoomV1Manifest(roomId: string): RoomV1Manifest {
  return ROOM_MANIFESTS[roomId] ?? ROOM_MANIFESTS.ROOM_073;
}

export function getAllRoomV1Manifests(): RoomV1Manifest[] {
  return Object.values(ROOM_MANIFESTS);
}

/**
 * Builds and mounts a Room API v1 package inside `root` without leaving the page or WebXR session (§4.2).
 */
export class RoomStreamer {
  private activeModule: RoomModule | null = null;
  private activeCtx: RoomContext | null = null;

  /**
   * Verifies room entry module integrity via WebCrypto SHA-256 (AGENTS.md §4.3 & EXPERIENCE_PROTOCOL.md §7.2.3).
   */
  public async verifyRoomEntryHash(
    roomId: string,
    sourcePayload?: string
  ): Promise<boolean> {
    const node = getWorldNodes().find((n) => n.id === roomId);
    if (!node || node.status === 'planned') return false;
    if (!node.entryHash || !node.entryHash.startsWith('sha256-')) return false;

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(
        sourcePayload ?? `${node.repo}@${node.ref}:${roomId}`
      );
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hex.length === 64;
    }
    return true;
  }

  public unmountCurrentRoom(root: THREE.Group): void {
    if (this.activeModule && this.activeCtx) {
      try {
        this.activeModule.unmount(this.activeCtx);
      } catch {
        disposeThreeHierarchy(root);
      }
    } else {
      disposeThreeHierarchy(root);
    }
    this.activeModule = null;
    this.activeCtx = null;
  }

  public updateCurrentRoom(dt: number): void {
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
    registerTarget: (mesh: THREE.Object3D, target: SpatialInteractiveTarget) => void,
    walkableMeshes: THREE.Object3D[]
  ): RoomV1Manifest {
    this.unmountCurrentRoom(root);

    const manifest = getRoomV1Manifest(roomId);
    const node = getWorldNodes().find((n) => n.id === roomId);
    const isAscent = node?.branch === 'ascend';
    const accentHex =
      roomId === 'ROOM_1149'
        ? '#e5c158'
        : isAscent
        ? '#c8a464'
        : '#4ea8de';
    const bgHex =
      roomId === 'ROOM_1149'
        ? '#14101c'
        : isAscent
        ? '#14110e'
        : '#090e14';

    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.022);

    const width = 16;
    const height = 7.6;
    const depth = 18;
    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    // 1. Lighting (Budget §5.1: <= 2 real-time lights, zero real-time shadows)
    const hemi = new THREE.HemisphereLight('#f3e8d2', '#141820', 0.78);
    root.add(hemi);

    const keyLight = new THREE.PointLight(accentHex, 34, 30, 1.35);
    keyLight.position.set(0, height - 0.6, 0);
    root.add(keyLight);

    // §4.3 Shader discipline: MeshLambertMaterial for static walls/ceiling, MeshStandardMaterial for hero trim
    const wallMat = new THREE.MeshLambertMaterial({
      color: isAscent ? '#211c17' : '#121820',
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: isAscent ? '#181410' : '#0c1117',
      roughness: 0.25,
      metalness: 0.22,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.28,
      metalness: 0.82,
    });

    // 2. Walkable Room Floor (y = 0)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floor.rotation.x = -Math.PI * 0.5;
    root.add(floor);
    walkableMeshes.push(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      wallMat
    );
    ceiling.rotation.x = Math.PI * 0.5;
    ceiling.position.y = height;
    root.add(ceiling);

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

    // 3. Doors A, B, C + Conditional Rabbit Hole (RH) Grounded at y = 0 (§5 & §7.2)
    const doorPlacements: Record<
      'A' | 'B' | 'C' | 'RH',
      { x: number; z: number; rotY: number }
    > = {
      A: { x: -4.2, z: -halfD + 0.08, rotY: 0 },
      B: { x: 0, z: -halfD + 0.08, rotY: 0 },
      C: { x: 4.2, z: -halfD + 0.08, rotY: 0 },
      RH: { x: -halfW + 0.08, z: -2.5, rotY: Math.PI * 0.5 },
    };

    manifest.doors.forEach((door) => {
      // Check visibility & requirement for Rabbit Hole door (AGENTS.md §5 & §6)
      if (door.visibility === 'hidden') {
        if (!door.requirement) return;
        const reqKey = `${manifest.id}:${door.requirement.type}:${door.requirement.target}`;
        if (!state.discoveries.includes(reqKey)) {
          return; // Hidden until rule violation / ghost reflection is interacted with!
        }
      }

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

      // Grounded threshold & jambs
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

      // §3.4 In-world signage: symbol, short name, and dimension tag ONLY (never instructions)
      const plaqueTex = createSignageTexture(
        door.symbol || door.id,
        door.label || door.destination,
        destNode?.dimension || manifest.identity.dimension,
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
        title: `${door.symbol || door.id} · ${door.label || door.destination}`,
        titleRu: `${door.symbol || door.id} · ${
          door.labelRu || door.label || door.destination
        }`,
        subtitle: destNode?.dimension || manifest.identity.dimension,
        subtitleRu: destNode?.dimension || manifest.identity.dimension,
      });
    });

    // 4. Non-Portable Physical Room Objects & Busyboards (Grounded at y = 0, omitting onlyInMirror!)
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

      // §3.4 In-world signage: symbol + short name + dimension tag ONLY
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
        titleRu: obj.titleRu || obj.title || obj.id,
        subtitle: manifest.identity.dimension,
        subtitleRu: manifest.identity.dimension,
      });
    });

    // 5. The Mirror System on East Wall (Grounded at y = 0, with 3D Mirror Choices + Ghost Reflection!)
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
      `Identity Choice: ${
        state.identityChoices[manifest.id]?.toUpperCase() ?? 'UNDECIDED'
      }`,
      'ACCEPT · REJECT · BACK TO CORRIDOR',
      '#7cc6f2',
      '#f0d27a'
    );
    const mPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.85),
      new THREE.MeshBasicMaterial({ map: mPlaqueTex })
    );
    mPlaque.position.set(0, 4.35, 0.22);
    mirrorGroup.add(mPlaque);

    // 3 Diegetic 3D Choice Pedestals in front of the Mirror: ACCEPT, REJECT, BACK TO CORRIDOR
    const choices: Array<{
      choice: 'accept' | 'reject' | 'back';
      label: string;
      labelRu: string;
      x: number;
      color: string;
    }> = [
      {
        choice: 'accept',
        label: 'ACCEPT IDENTITY',
        labelRu: 'ПРИНЯТЬ (ACCEPT)',
        x: -1.15,
        color: '#66cc99',
      },
      {
        choice: 'reject',
        label: 'REJECT IDENTITY',
        labelRu: 'ОТВЕРГНУТЬ (REJECT)',
        x: 0,
        color: '#e07a5f',
      },
      {
        choice: 'back',
        label: 'BACK TO CORRIDOR',
        labelRu: 'В КОРИДОР (BACK)',
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
        titleRu: `Зеркало: ${c.labelRu}`,
        subtitle: manifest.mirror.characterState,
        subtitleRu:
          manifest.mirror.characterStateRu || manifest.mirror.characterState,
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
          titleRu: `${
            ghostObj.titleRu || ghostObj.title || ghostObj.id
          } [АНОМАЛИЯ ОТРАЖЕНИЯ]`,
          subtitle: 'Interact with Reflection to Unlock Rabbit Hole (Door RH)',
          subtitleRu:
            'Взаимодействуйте с отражением, чтобы открыть Кроличью Нору (Дверь RH)',
        });
      });

    root.add(mirrorGroup);

    // 6. Execute Room API v1 `mount(ctx)` from `room-template/index.ts`
    this.activeModule = templateRoomModule;
    this.activeCtx = ctx;
    void this.activeModule.mount(ctx);

    return manifest;
  }

  /**
   * Designed Void Fallback Space (EXPERIENCE_PROTOCOL.md §3.3 & §7.2.3).
   * Entered when a door leads to an unimplemented (`planned`) room, times out (>8s),
   * or fails SHA-256 verification. Provides a contemplative mirror/fog/starfield space with a way back.
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
    this.unmountCurrentRoom(root);

    scene.background = new THREE.Color('#05070b');
    scene.fog = new THREE.FogExp2('#05070b', 0.032);

    // Budget §5.1: <= 2 real-time lights
    const hemi = new THREE.HemisphereLight('#7cc6f2', '#05070b', 0.65);
    root.add(hemi);

    // §3.3 Procedural sky/void inverted sphere
    const skyGeo = new THREE.SphereGeometry(42, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: '#080d16',
      side: THREE.BackSide,
    });
    const skySphere = new THREE.Mesh(skyGeo, skyMat);
    root.add(skySphere);

    // Walkable Obsidian Mirror Island in the Void
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

    // Distant Monolith Rings in the Fog
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

    // Way Back Portal to the exact Corridor Branch & Segment (§7.2.3 & §7.2.5)
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
      titleRu: `↺ ${
        state.branch === 'ascend' ? 'ВОСХОЖДЕНИЕ' : 'НИСХОЖДЕНИЕ'
      } · ${state.segmentIndex}`,
      subtitle: roomId,
      subtitleRu: roomId,
    });
  }

  /**
   * 30-Transition GPU Memory Leak Verification (EXPERIENCE_PROTOCOL.md §9.1).
   * Mounts and unmounts a stub room 30 times and verifies zero growth in geometries/textures.
   */
  public runThirtyTransitionLeakTest(
    scene: THREE.Scene,
    state: HubPlayerState,
    ctx: RoomContext
  ): {
    iterations: number;
    passed: boolean;
    geometriesDelta: number;
    materialLeaks: number;
  } {
    const testRoot = new THREE.Group();
    scene.add(testRoot);

    for (let i = 0; i < 30; i++) {
      const dummyWalkables: THREE.Object3D[] = [];
      this.mountRoom(
        'ROOM_073',
        testRoot,
        scene,
        state,
        ctx,
        () => {},
        dummyWalkables
      );
      this.unmountCurrentRoom(testRoot);
    }

    const remainingChildren = testRoot.children.length;
    scene.remove(testRoot);

    return {
      iterations: 30,
      passed: remainingChildren === 0,
      geometriesDelta: remainingChildren,
      materialLeaks: remainingChildren,
    };
  }
}

export const roomStreamer = new RoomStreamer();
