import {
  DoorRequirementType,
  DoorStatus,
  GenericInteractionType,
  QuestType,
  RoomEnvironmentType,
  RoomManifest,
  VoidType,
} from '../../src/types/artmaze';
import nebulaeRegistryData from '../../content/space/nebulae.json';

const VALID_NEBULA_IDS = new Set<string>(
  nebulaeRegistryData.nebulae.map((n: { id: string }) => n.id)
);

export interface ValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  roomId: string | null;
  specVersion: string | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    doorsCount: number;
    paintingsCount: number;
    objectsCount: number;
    hasMirror: boolean;
    hasQuest: boolean;
    rabbitHolesCount: number;
  };
}

const VALID_ENV_TYPES: RoomEnvironmentType[] = [
  'standard',
  'procedural',
  'custom',
  'empty',
  'void',
];

const VALID_DOOR_STATUSES: DoorStatus[] = [
  'ready',
  'planned',
  'void',
  'conditional',
  'disabled',
];

const VALID_VOID_TYPES: VoidType[] = [
  'infinity',
  'fractal',
  'fog',
  'darkness',
  'starfield',
  'mirror',
  'unknown',
];

const VALID_REQUIREMENT_TYPES: DoorRequirementType[] = [
  'flag',
  'identity',
  'quest',
  'discovery',
  'room-state',
  'visit-count',
  'choice',
];

const VALID_INTERACTIONS: GenericInteractionType[] = [
  'inspect',
  'look',
  'touch',
  'activate',
  'rotate',
  'open',
  'close',
  'push',
  'pull',
  'listen',
  'read',
  'observe',
];

const VALID_QUEST_TYPES: QuestType[] = [
  'observe',
  'interact',
  'solve',
  'choose',
  'remember',
  'compare',
  'discover',
  'contradict',
  'listen',
  'wait',
  'return',
  'identity',
];

const FORBIDDEN_CODE_PATTERNS = [
  /eval\s*\(/i,
  /<script/i,
  /javascript:/i,
  /new\s+Function/i,
  /room\.js/i,
  /AIza[0-9A-Za-z-_]{35}/,
  /sk-[a-zA-Z0-9]{20,}/,
];

function isVec3(val: unknown): val is [number, number, number] {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/**
 * Validates a raw JSON string or parsed object against ROOM_SPEC.md v1.0.
 */
export function validateRoomManifest(input: string | unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let rawText = '';
  let parsed: Record<string, unknown> | null = null;

  if (typeof input === 'string') {
    rawText = input;
    try {
      parsed = JSON.parse(input) as Record<string, unknown>;
    } catch (err) {
      errors.push({
        severity: 'error',
        path: '$',
        rule: 'ROOM_SPEC §33 Valid JSON',
        message: `Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
      });
      return {
        valid: false,
        roomId: null,
        specVersion: null,
        errors,
        warnings,
        summary: {
          doorsCount: 0,
          paintingsCount: 0,
          objectsCount: 0,
          hasMirror: false,
          hasQuest: false,
          rabbitHolesCount: 0,
        },
      };
    }
  } else if (input && typeof input === 'object' && !Array.isArray(input)) {
    parsed = input as Record<string, unknown>;
    rawText = JSON.stringify(input);
  } else {
    errors.push({
      severity: 'error',
      path: '$',
      rule: 'ROOM_SPEC §5 Manifest Object',
      message: 'Manifest root must be a JSON object.',
    });
    return {
      valid: false,
      roomId: null,
      specVersion: null,
      errors,
      warnings,
      summary: {
        doorsCount: 0,
        paintingsCount: 0,
        objectsCount: 0,
        hasMirror: false,
        hasQuest: false,
        rabbitHolesCount: 0,
      },
    };
  }

  // §30 & §31 No Secrets & No Arbitrary Executable Code
  for (const pattern of FORBIDDEN_CODE_PATTERNS) {
    if (pattern.test(rawText)) {
      errors.push({
        severity: 'error',
        path: '$',
        rule: 'ROOM_SPEC §30-31 Security & No Arbitrary Code',
        message: `Forbidden executable pattern or secret key detected matching ${pattern.toString()}`,
      });
    }
  }

  // §36 Versioning
  const specVersion = typeof parsed.specVersion === 'string' ? parsed.specVersion : null;
  if (!specVersion) {
    warnings.push({
      severity: 'warning',
      path: 'specVersion',
      rule: 'ROOM_SPEC §36 Versioning',
      message: 'Missing explicit "specVersion" (recommended: "1.0").',
    });
  } else if (!/^\d+\.\d+$/.test(specVersion)) {
    errors.push({
      severity: 'error',
      path: 'specVersion',
      rule: 'ROOM_SPEC §36 Versioning',
      message: `Invalid specVersion "${specVersion}". Expected MAJOR.MINOR (e.g., "1.0").`,
    });
  }

  // §3 Room Identity
  const roomId = typeof parsed.id === 'string' ? parsed.id : null;
  if (!roomId || !/^ROOM_\d{4}$/.test(roomId)) {
    errors.push({
      severity: 'error',
      path: 'id',
      rule: 'ROOM_SPEC §3 Room Identity',
      message: `Room ID must match canonical format "ROOM_XXXX" (e.g. "ROOM_0042"). Found: "${String(parsed.id)}"`,
    });
  }

  if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
    errors.push({
      severity: 'error',
      path: 'version',
      rule: 'ROOM_SPEC §5 Manifest',
      message: 'Room "version" string is required.',
    });
  }

  if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
    errors.push({
      severity: 'error',
      path: 'title',
      rule: 'ROOM_SPEC §5 Manifest',
      message: 'Room "title" string is required.',
    });
  }

  if (typeof parsed.author !== 'string' || !parsed.author.trim()) {
    errors.push({
      severity: 'error',
      path: 'author',
      rule: 'ROOM_SPEC §5 Manifest',
      message: 'Room "author" string is required.',
    });
  }

  // §7 Environment
  if (
    typeof parsed.type !== 'string' ||
    !VALID_ENV_TYPES.includes(parsed.type as RoomEnvironmentType)
  ) {
    errors.push({
      severity: 'error',
      path: 'type',
      rule: 'ROOM_SPEC §7 Environment',
      message: `Invalid room type "${String(parsed.type)}". Allowed: ${VALID_ENV_TYPES.join(', ')}.`,
    });
  }

  if (!parsed.environment || typeof parsed.environment !== 'object') {
    errors.push({
      severity: 'error',
      path: 'environment',
      rule: 'ROOM_SPEC §7 Environment',
      message: 'The "environment" object is required.',
    });
  } else {
    const env = parsed.environment as Record<string, unknown>;
    if (env.spawn && typeof env.spawn === 'object') {
      const spawn = env.spawn as Record<string, unknown>;
      if (!isVec3(spawn.position)) {
        errors.push({
          severity: 'error',
          path: 'environment.spawn.position',
          rule: 'ROOM_SPEC §8 Spawn',
          message: 'spawn.position must be a 3-number array [x, y, z].',
        });
      }
      if (!isVec3(spawn.rotation)) {
        errors.push({
          severity: 'error',
          path: 'environment.spawn.rotation',
          rule: 'ROOM_SPEC §8 Spawn',
          message: 'spawn.rotation must be a 3-number array [x, y, z].',
        });
      }
    }
  }

  // §10-15 Doors
  let doorsCount = 0;
  let rabbitHolesCount = 0;
  if (!Array.isArray(parsed.doors)) {
    errors.push({
      severity: 'error',
      path: 'doors',
      rule: 'ROOM_SPEC §10 Doors',
      message: 'The "doors" field must be an array.',
    });
  } else {
    doorsCount = parsed.doors.length;
    const seenDoorIds = new Set<string>();

    parsed.doors.forEach((d, idx) => {
      const doorPath = `doors[${idx}]`;
      if (!d || typeof d !== 'object') {
        errors.push({
          severity: 'error',
          path: doorPath,
          rule: 'ROOM_SPEC §10 Doors',
          message: 'Door entry must be an object.',
        });
        return;
      }
      const door = d as Record<string, unknown>;
      if (typeof door.id !== 'string' || !door.id.trim()) {
        errors.push({
          severity: 'error',
          path: `${doorPath}.id`,
          rule: 'ROOM_SPEC §10 Doors',
          message: 'Door must have a non-empty string id.',
        });
      } else if (seenDoorIds.has(door.id)) {
        errors.push({
          severity: 'error',
          path: `${doorPath}.id`,
          rule: 'ROOM_SPEC §10 Doors',
          message: `Duplicate door ID "${door.id}" within the same room.`,
        });
      } else {
        seenDoorIds.add(door.id);
      }

      if (
        typeof door.status !== 'string' ||
        !VALID_DOOR_STATUSES.includes(door.status as DoorStatus)
      ) {
        errors.push({
          severity: 'error',
          path: `${doorPath}.status`,
          rule: 'ROOM_SPEC §10 Doors',
          message: `Invalid door status "${String(door.status)}". Allowed: ${VALID_DOOR_STATUSES.join(', ')}.`,
        });
      }

      if (door.destination !== null && typeof door.destination !== 'string') {
        errors.push({
          severity: 'error',
          path: `${doorPath}.destination`,
          rule: 'ROOM_SPEC §11-13 Door Destination',
          message: 'Door destination must be a room ID ("ROOM_XXXX") or null for void.',
        });
      } else if (
        typeof door.destination === 'string' &&
        !/^ROOM_\d{4}$/.test(door.destination)
      ) {
        errors.push({
          severity: 'error',
          path: `${doorPath}.destination`,
          rule: 'ROOM_SPEC §11 Door Destination',
          message: `Door destination "${door.destination}" must match "ROOM_XXXX".`,
        });
      }

      if (door.status === 'void' && door.destination !== null) {
        warnings.push({
          severity: 'warning',
          path: `${doorPath}.destination`,
          rule: 'ROOM_SPEC §13 Door to Void',
          message: 'A door with status "void" should have destination set to null.',
        });
      }

      if ((door.status === 'void' || door.status === 'planned') && !door.fallback) {
        errors.push({
          severity: 'error',
          path: `${doorPath}.fallback`,
          rule: 'ROOM_SPEC §12-13 Void Fallback',
          message: `Door with status "${String(door.status)}" must define a fallback void type.`,
        });
      }

      if (door.fallback && typeof door.fallback === 'object') {
        const fb = door.fallback as Record<string, unknown>;
        if (
          typeof fb.type !== 'string' ||
          !VALID_VOID_TYPES.includes(fb.type as VoidType)
        ) {
          errors.push({
            severity: 'error',
            path: `${doorPath}.fallback.type`,
            rule: 'ROOM_SPEC §13 Void Types',
            message: `Invalid fallback void type "${String(fb.type)}". Allowed: ${VALID_VOID_TYPES.join(', ')}.`,
          });
        }
      }

      if (door.type === 'rabbit-hole' || door.id === 'RH') {
        rabbitHolesCount++;
      }

      if (door.requirement && typeof door.requirement === 'object') {
        const req = door.requirement as Record<string, unknown>;
        if (
          typeof req.type !== 'string' ||
          !VALID_REQUIREMENT_TYPES.includes(req.type as DoorRequirementType)
        ) {
          errors.push({
            severity: 'error',
            path: `${doorPath}.requirement.type`,
            rule: 'ROOM_SPEC §14 Door Requirements',
            message: `Invalid requirement type "${String(req.type)}". Allowed: ${VALID_REQUIREMENT_TYPES.join(', ')}.`,
          });
        }
        if (typeof req.id !== 'string' || !req.id.trim()) {
          errors.push({
            severity: 'error',
            path: `${doorPath}.requirement.id`,
            rule: 'ROOM_SPEC §14 Door Requirements',
            message: 'Door requirement must specify a target id.',
          });
        }
      }
    });
  }

  // §16-17 Paintings & §29 Licensing
  let paintingsCount = 0;
  if (parsed.paintings !== undefined) {
    if (!Array.isArray(parsed.paintings)) {
      errors.push({
        severity: 'error',
        path: 'paintings',
        rule: 'ROOM_SPEC §16 Paintings',
        message: '"paintings" must be an array.',
      });
    } else {
      paintingsCount = parsed.paintings.length;
      parsed.paintings.forEach((p, idx) => {
        const pPath = `paintings[${idx}]`;
        if (!p || typeof p !== 'object') return;
        const painting = p as Record<string, unknown>;
        if (!painting.id || typeof painting.id !== 'string') {
          errors.push({
            severity: 'error',
            path: `${pPath}.id`,
            rule: 'ROOM_SPEC §16 Paintings',
            message: 'Painting id is required.',
          });
        }
        if (!isVec3(painting.position)) {
          errors.push({
            severity: 'error',
            path: `${pPath}.position`,
            rule: 'ROOM_SPEC §16 Paintings',
            message: 'Painting position must be [x, y, z].',
          });
        }
        if (!painting.metadata || typeof painting.metadata !== 'object') {
          errors.push({
            severity: 'error',
            path: `${pPath}.metadata`,
            rule: 'ROOM_SPEC §29 Licensing',
            message: 'Painting must include licensing metadata (title, author, license, source).',
          });
        } else {
          const meta = painting.metadata as Record<string, unknown>;
          for (const reqField of ['title', 'author', 'license', 'source']) {
            if (typeof meta[reqField] !== 'string' || !(meta[reqField] as string).trim()) {
              errors.push({
                severity: 'error',
                path: `${pPath}.metadata.${reqField}`,
                rule: 'ROOM_SPEC §29 Licensing',
                message: `Painting metadata is missing required licensing field "${reqField}".`,
              });
            }
          }
        }
      });
    }
  }

  // §18-19 Objects & Interactions
  let objectsCount = 0;
  if (parsed.objects !== undefined) {
    if (!Array.isArray(parsed.objects)) {
      errors.push({
        severity: 'error',
        path: 'objects',
        rule: 'ROOM_SPEC §18 Objects',
        message: '"objects" must be an array.',
      });
    } else {
      objectsCount = parsed.objects.length;
      parsed.objects.forEach((o, idx) => {
        const oPath = `objects[${idx}]`;
        if (!o || typeof o !== 'object') return;
        const obj = o as Record<string, unknown>;
        if (obj.portable !== false) {
          errors.push({
            severity: 'error',
            path: `${oPath}.portable`,
            rule: 'ROOM_SPEC §18 Non-Portable Objects',
            message: 'Objects must have "portable": false. Objects do not become player inventory.',
          });
        }
        if (!Array.isArray(obj.interactions) || obj.interactions.length === 0) {
          errors.push({
            severity: 'error',
            path: `${oPath}.interactions`,
            rule: 'ROOM_SPEC §19 Interaction Types',
            message: 'Object must declare at least one generic interaction.',
          });
        } else {
          obj.interactions.forEach((verb, vIdx) => {
            if (
              typeof verb !== 'string' ||
              !VALID_INTERACTIONS.includes(verb as GenericInteractionType)
            ) {
              errors.push({
                severity: 'error',
                path: `${oPath}.interactions[${vIdx}]`,
                rule: 'ROOM_SPEC §19 Interaction Types',
                message: `Unsupported interaction verb "${String(verb)}". Allowed: ${VALID_INTERACTIONS.join(', ')}.`,
              });
            }
          });
        }
      });
    }
  }

  // §20 Quest
  let hasQuest = false;
  if (parsed.quest !== undefined && parsed.quest !== null) {
    hasQuest = true;
    if (typeof parsed.quest !== 'object') {
      errors.push({
        severity: 'error',
        path: 'quest',
        rule: 'ROOM_SPEC §20 Quest',
        message: '"quest" must be an object or null.',
      });
    } else {
      const q = parsed.quest as Record<string, unknown>;
      if (typeof q.type !== 'string' || !VALID_QUEST_TYPES.includes(q.type as QuestType)) {
        errors.push({
          severity: 'error',
          path: 'quest.type',
          rule: 'ROOM_SPEC §20 Quest',
          message: `Invalid quest type "${String(q.type)}". Allowed: ${VALID_QUEST_TYPES.join(', ')}.`,
        });
      }
    }
  }

  // §21 Mirror
  let hasMirror = false;
  if (parsed.mirror !== undefined && parsed.mirror !== null) {
    hasMirror = true;
    if (typeof parsed.mirror !== 'object') {
      errors.push({
        severity: 'error',
        path: 'mirror',
        rule: 'ROOM_SPEC §21 Mirror',
        message: '"mirror" must be an object or null.',
      });
    } else {
      const m = parsed.mirror as Record<string, unknown>;
      if (!m.choices || typeof m.choices !== 'object') {
        errors.push({
          severity: 'error',
          path: 'mirror.choices',
          rule: 'ROOM_SPEC §21 Mirror',
          message: 'Mirror must define "choices" (accept, reject, return).',
        });
      } else {
        const choices = m.choices as Record<string, unknown>;
        for (const cKey of ['accept', 'reject', 'return']) {
          if (!(cKey in choices)) {
            errors.push({
              severity: 'error',
              path: `mirror.choices.${cKey}`,
              rule: 'ROOM_SPEC §21 Mirror',
              message: `Mirror choices must include "${cKey}".`,
            });
          }
        }
      }
    }
  }

  // TZ.md §3.6 Optional Sky Override Validation
  if (parsed.sky !== undefined && parsed.sky !== null) {
    if (typeof parsed.sky !== 'object') {
      errors.push({
        severity: 'error',
        path: 'sky',
        rule: 'TZ §3.6 Room Sky Schema',
        message: '"sky" must be an object if provided.',
      });
    } else {
      const sky = parsed.sky as Record<string, unknown>;
      if (sky.nebulaId !== undefined) {
        if (
          typeof sky.nebulaId !== 'string' ||
          !VALID_NEBULA_IDS.has(sky.nebulaId)
        ) {
          errors.push({
            severity: 'error',
            path: 'sky.nebulaId',
            rule: 'TZ §3.6 Nebula Registry Reference',
            message: `sky.nebulaId "${String(sky.nebulaId)}" does not exist in content/space/nebulae.registry.json.`,
          });
        }
      }
      if (sky.rotation !== undefined && !isVec3(sky.rotation)) {
        errors.push({
          severity: 'error',
          path: 'sky.rotation',
          rule: 'TZ §3.6 Sky Rotation',
          message: 'sky.rotation must be a 3-number Euler array [rx, ry, rz].',
        });
      }
      if (
        sky.intensity !== undefined &&
        (typeof sky.intensity !== 'number' ||
          sky.intensity < 0.2 ||
          sky.intensity > 1.5)
      ) {
        errors.push({
          severity: 'error',
          path: 'sky.intensity',
          rule: 'TZ §3.6 Sky Intensity',
          message: 'sky.intensity must be a number between 0.2 and 1.5.',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    roomId,
    specVersion,
    errors,
    warnings,
    summary: {
      doorsCount,
      paintingsCount,
      objectsCount,
      hasMirror,
      hasQuest,
      rabbitHolesCount,
    },
  };
}

export function asTypedRoomManifest(input: unknown): RoomManifest {
  return input as RoomManifest;
}
