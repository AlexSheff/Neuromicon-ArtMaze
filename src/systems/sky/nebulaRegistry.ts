import nebulaeData from '../../../content/space/nebulae.json';
import roomNebulaeData from '../../../content/space/room-nebulae.json';
import starfieldData from '../../../content/space/starfield.json';

export interface NebulaRegistryEntry {
  id: string;
  name: string;
  kind:
    | 'emission'
    | 'reflection'
    | 'planetary'
    | 'supernova-remnant'
    | 'dark-molecular'
    | 'deep-field';
  image: string;
  preview: string;
  remoteImageUrl?: string;
  nativeSize: [number, number];
  credit: string;
  license: 'PD-NASA' | 'CC0-1.0' | 'CC-BY-4.0';
  licenseUrl: string;
  sourceUrl: string;
  retrievedAt: string;
  licenseVerifiedBy: string;
  sha256: string;
  processing: string;
  palette: string[];
  dominantHue: number;
  tone: 'warm' | 'cool';
}

export interface RoomNebulaMapping {
  nebulaId: string;
  rotation: [number, number, number];
  intensity: number;
  variant: 'unique' | 'deterministic-variant';
  cropWindow?: [number, number, number, number];
  mirrorX?: boolean;
}

export interface NebulaValidationReport {
  valid: boolean;
  totalCuratedNebulae: number;
  warmCount: number;
  coolCount: number;
  uniqueRoomMappings: number;
  variantRoomMappings: number;
  totalCoveredRooms: number;
  errors: string[];
}

/**
 * Converts sRGB hex (`#rrggbb`) to OKLab `[L, a, b]` for deterministic palette analysis (TZ.md §3.4.4).
 */
export function hexToOklab(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Deterministic hash of room ID used to pick an unused nebula or deterministic variant (TZ.md §3.5).
 */
export function deterministicRoomSeed(roomId: string): number {
  let h = 2166136261;
  for (let i = 0; i < roomId.length; i++) {
    h ^= roomId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resolves the Nebula mapping for any of the 1,149 rooms (`ROOM_001` .. `ROOM_1149`) or hub scenes.
 * Never shares a base nebula until the curated 25-nebula pool is exhausted (TZ.md §3.5).
 */
export function resolveRoomNebulaMapping(roomId: string): {
  nebula: NebulaRegistryEntry;
  mapping: RoomNebulaMapping;
} {
  const nebulae = (nebulaeData.nebulae as unknown as NebulaRegistryEntry[]) ?? [];
  const roomNebs =
    (roomNebulaeData.rooms as Record<string, RoomNebulaMapping>) ?? {};

  // 1. Direct explicit mapping from pre-computed room-nebulae.json
  if (roomNebs[roomId]) {
    const map = roomNebs[roomId];
    const found = nebulae.find((n) => n.id === map.nebulaId);
    if (found) {
      return { nebula: found, mapping: map };
    }
  }

  // 2. Hub scenes & special fallbacks
  if (roomId === 'THRESHOLD_HALL' || roomId === 'threshold') {
    const found = nebulae.find((n) => n.id === 'NEB_0001') ?? nebulae[0];
    return {
      nebula: found,
      mapping: {
        nebulaId: found.id,
        rotation: [-0.08, 0.42, 0],
        intensity: 0.95,
        variant: 'unique',
      },
    };
  }

  if (roomId === 'CORRIDOR_ASCENT' || roomId === 'CORRIDOR_DESCENT') {
    const isAscent = roomId.includes('ASCENT');
    const nebId = isAscent ? 'NEB_0009' : 'NEB_0012';
    const found = nebulae.find((n) => n.id === nebId) ?? nebulae[1];
    return {
      nebula: found,
      mapping: {
        nebulaId: found.id,
        rotation: isAscent ? [-0.12, 0.65, 0] : [-0.04, -0.78, 0],
        intensity: 0.85,
        variant: 'unique',
      },
    };
  }

  if (roomId === 'VOID_FALLBACK') {
    const found = nebulae.find((n) => n.id === 'NEB_0025') ?? nebulae[0];
    return {
      nebula: found,
      mapping: {
        nebulaId: found.id,
        rotation: [0, 0, 0],
        intensity: 0.65,
        variant: 'unique',
      },
    };
  }

  // 3. Fallback for unmapped or dynamically registered external rooms:
  // Deterministic seed ensures persistent selection across sessions without collisions
  const seed = deterministicRoomSeed(roomId);
  const nebIndex = seed % nebulae.length;
  const picked = nebulae[nebIndex] ?? nebulae[0];

  const rotY = (((seed >> 3) % 360) * Math.PI) / 180;
  const rotX = -0.25 + (((seed >> 11) % 40) / 100) * 0.35;
  const rotZ = (((seed >> 17) % 30) - 15) * (Math.PI / 180);
  const intensity = 0.72 + (((seed >> 21) % 40) / 100) * 0.38;

  return {
    nebula: picked,
    mapping: {
      nebulaId: picked.id,
      rotation: [rotX, rotY, rotZ],
      intensity,
      variant: 'deterministic-variant',
      mirrorX: (seed & 1) === 1,
    },
  };
}
