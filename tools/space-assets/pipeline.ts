import nebulaeData from '../../content/space/nebulae.json';
import roomNebulaeData from '../../content/space/room-nebulae.json';
import starfieldData from '../../content/space/starfield.json';

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

const ALLOWED_LICENSES = new Set(['PD-NASA', 'CC0-1.0', 'CC-BY-4.0']);

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
  const explicitMap =
    (roomNebulaeData.mappings as unknown as Record<string, RoomNebulaMapping>) ??
    {};
  const specialMap =
    (roomNebulaeData.specialSceneMappings as Record<string, string>) ?? {};

  if (specialMap[roomId]) {
    const nebId = specialMap[roomId];
    const found = nebulae.find((n) => n.id === nebId) ?? nebulae[0];
    return {
      nebula: found,
      mapping: {
        nebulaId: found.id,
        rotation: [0.22, 0.0, 0.0],
        intensity: 1.0,
        variant: 'unique',
      },
    };
  }

  if (explicitMap[roomId]) {
    const m = explicitMap[roomId];
    const found = nebulae.find((n) => n.id === m.nebulaId) ?? nebulae[0];
    return { nebula: found, mapping: m };
  }

  const seed = deterministicRoomSeed(roomId);
  const idx = seed % nebulae.length;
  const neb = nebulae[idx] ?? nebulae[0];
  const rotX = 0.14 + ((seed & 0xff) / 255) * 0.22;
  const rotY = (((seed >> 8) & 0xff) / 255 - 0.5) * Math.PI * 1.4;
  const rotZ = (((seed >> 16) & 0xff) / 255 - 0.5) * 0.35;

  return {
    nebula: neb,
    mapping: {
      nebulaId: neb.id,
      rotation: [
        Number(rotX.toFixed(3)),
        Number(rotY.toFixed(3)),
        Number(rotZ.toFixed(3)),
      ],
      intensity: 0.92 + (((seed >> 24) & 0x0f) / 15) * 0.16,
      variant: 'deterministic-variant',
      mirrorX: (seed & 1) === 1,
    },
  };
}

/**
 * CI-blocking Validator for `content/space/nebulae.json`, `starfield.json`, and 1,149-room pool coverage (TZ.md §3.2, §3.3, §3.5).
 */
export function validateNebulaRegistryAndCoverage(): NebulaValidationReport {
  const errors: string[] = [];
  const nebulae = (nebulaeData.nebulae as unknown as NebulaRegistryEntry[]) ?? [];
  const seenIds = new Set<string>();
  const seenSources = new Set<string>();

  if (nebulae.length < 24) {
    errors.push(
      `Expected >= 24 curated nebulae (TZ.md §3.5), found ${nebulae.length}`
    );
  }

  // Validate base starfield
  if (!ALLOWED_LICENSES.has(starfieldData.license)) {
    errors.push(`Starfield license ${starfieldData.license} not in allow-list`);
  }
  if (!starfieldData.sourceUrl.startsWith('https://')) {
    errors.push('Starfield sourceUrl must use https://');
  }

  let warmCount = 0;
  let coolCount = 0;

  nebulae.forEach((n) => {
    if (seenIds.has(n.id)) {
      errors.push(`Duplicate nebula id: ${n.id}`);
    }
    seenIds.add(n.id);

    if (seenSources.has(n.sourceUrl)) {
      errors.push(`Duplicate nebula sourceUrl: ${n.sourceUrl}`);
    }
    seenSources.add(n.sourceUrl);

    if (!ALLOWED_LICENSES.has(n.license)) {
      errors.push(`${n.id}: license "${n.license}" is not in allow-list`);
    }
    if (!n.licenseUrl.startsWith('https://')) {
      errors.push(`${n.id}: invalid licenseUrl`);
    }
    if (!n.sourceUrl.startsWith('https://')) {
      errors.push(`${n.id}: invalid sourceUrl`);
    }
    if (!/^[a-f0-9]{64}$/.test(n.sha256)) {
      errors.push(`${n.id}: sha256 must be 64 hex chars`);
    }
    if (!n.credit || n.credit.length < 4) {
      errors.push(`${n.id}: missing credit attribution`);
    }
    if (!Array.isArray(n.palette) || n.palette.length < 3) {
      errors.push(`${n.id}: palette must have at least 3 hex colors`);
    }
    if (n.nativeSize[0] > 4096 || n.nativeSize[1] > 4096) {
      errors.push(`${n.id}: exceeds max texture dimension`);
    }
    if (n.tone === 'warm') warmCount += 1;
    if (n.tone === 'cool') coolCount += 1;
  });

  if (warmCount < 12 || coolCount < 12) {
    errors.push(
      `Pool requires >= 12 warm and >= 12 cool nebulae (found ${warmCount} warm, ${coolCount} cool)`
    );
  }

  // Verify 1..25 rooms do not duplicate any nebula before the 25-nebula pool is exhausted
  const first25Used = new Set<string>();
  for (let i = 1; i <= 25; i++) {
    const rid = `ROOM_${String(i).padStart(3, '0')}`;
    const resolved = resolveRoomNebulaMapping(rid);
    if (first25Used.has(resolved.nebula.id)) {
      errors.push(
        `Room ${rid} reuses ${resolved.nebula.id} before 25-nebula pool is exhausted`
      );
    }
    first25Used.add(resolved.nebula.id);
  }

  const totalRooms = 1149;
  const uniqueRoomMappings = first25Used.size;
  const variantRoomMappings = totalRooms - uniqueRoomMappings;

  return {
    valid: errors.length === 0,
    totalCuratedNebulae: nebulae.length,
    warmCount,
    coolCount,
    uniqueRoomMappings,
    variantRoomMappings,
    totalCoveredRooms: totalRooms,
    errors,
  };
}
