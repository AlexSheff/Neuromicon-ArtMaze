import {
  DoorDefinition,
  MirrorDefinition,
  PaintingDefinition,
  PlayerState,
  RoomManifest,
  RoomObjectDefinition,
  RoomRegistryManifest,
  VoidType,
} from '../../types/artmaze';
import { evaluateDoor } from '../../systems/doors/doorSystem';
import { observationSystem } from '../../systems/observation/observationSystem';
import { getActiveRoomObjects } from '../../systems/rooms/roomStateSystem';
import { getVoidDescriptor } from '../../world/void/voidSystem';
import { CameraPose } from '../locomotion/locomotionSystem';

export interface RaycastTarget {
  kind: 'door' | 'painting' | 'object' | 'mirror';
  id: string;
  title: string;
  titleRu?: string;
  subtitle?: string;
  subtitleRu?: string;
  distance: number;
  discoveryId?: string;
  door?: DoorDefinition;
  painting?: PaintingDefinition;
  object?: RoomObjectDefinition;
  mirror?: MirrorDefinition;
}

interface Vec3Point {
  x: number;
  y: number;
  z: number;
}

interface ProjectedQuad {
  points: Array<{ sx: number; sy: number }>;
  avgDepth: number;
  fillColor: string;
  strokeColor?: string;
  lineWidth?: number;
  alpha?: number;
  label?: {
    text: string;
    subtext?: string;
    badge?: string;
    sx: number;
    sy: number;
    color: string;
    scale: number;
  };
  paintingOverlay?: {
    id: string;
    motifIndex: number;
    mutatesOnIgnore?: boolean;
    mutationPhase: number;
    points: Array<{ sx: number; sy: number }>;
  };
  portalOverlay?: {
    status: string;
    isRabbitHole: boolean;
    voidType?: string;
    points: Array<{ sx: number; sy: number }>;
  };
}

function transformToCamera(p: Vec3Point, cam: CameraPose): Vec3Point {
  const dx = p.x - cam.x;
  const dy = p.y - cam.y;
  const dz = p.z - cam.z;

  const cosY = Math.cos(cam.yaw);
  const sinY = Math.sin(cam.yaw);

  // Rotate around Y
  const rx = dx * cosY - dz * sinY;
  const rz = dx * sinY + dz * cosY;

  // Pitch around X
  const cosP = Math.cos(cam.pitch);
  const sinP = Math.sin(cam.pitch);
  const ry = dy * cosP - rz * sinP;
  const finalZ = dy * sinP + rz * cosP;

  return { x: rx, y: ry, z: finalZ };
}

function clipPolygonAgainstNearPlane(
  verts: Vec3Point[],
  nearZ = -0.22
): Vec3Point[] {
  const out: Vec3Point[] = [];
  for (let i = 0; i < verts.length; i++) {
    const curr = verts[i];
    const prev = verts[(i + verts.length - 1) % verts.length];
    const currInside = curr.z <= nearZ;
    const prevInside = prev.z <= nearZ;

    if (currInside && prevInside) {
      out.push(curr);
    } else if (prevInside && !currInside) {
      const t = (nearZ - prev.z) / (curr.z - prev.z);
      out.push({
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
        z: nearZ,
      });
    } else if (!prevInside && currInside) {
      const t = (nearZ - prev.z) / (curr.z - prev.z);
      out.push({
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
        z: nearZ,
      });
      out.push(curr);
    }
  }
  return out;
}

function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Ensures any door, mirror, or wall-mounted element is flush with its nearest outer room wall
 * and grounded on y = 0 (for doors and mirrors) so nothing ever floats in mid-air.
 */
function resolveWallAnchoredPose(
  rawPos: [number, number, number] | undefined,
  rawRotY: number | undefined,
  halfW: number,
  halfD: number,
  groundY = 0
): {
  cx: number;
  cy: number;
  cz: number;
  rotY: number;
  rightX: number;
  rightZ: number;
  normalX: number;
  normalZ: number;
} {
  const px = rawPos?.[0] ?? 0;
  const py = rawPos?.[1] ?? groundY;
  const pz = rawPos?.[2] ?? -halfD;
  const rot = rawRotY ?? 0;

  // Determine which wall this element belongs to based on rotation or proximity
  const normX = Math.sin(rot);
  const normZ = Math.cos(rot);

  let cx = px;
  let cz = pz;
  let finalRotY = rot;

  if (Math.abs(normX) > 0.7) {
    // West or East wall
    if (normX > 0) {
      // West wall (-halfW), normal pointing +X
      cx = -halfW + 0.04;
      cz = Math.max(-halfD + 1.8, Math.min(halfD - 1.8, pz));
      finalRotY = Math.PI * 0.5;
    } else {
      // East wall (+halfW), normal pointing -X
      cx = halfW - 0.04;
      cz = Math.max(-halfD + 1.8, Math.min(halfD - 1.8, pz));
      finalRotY = -Math.PI * 0.5;
    }
  } else {
    // North or South wall
    if (normZ >= 0) {
      // North wall (-halfD), normal pointing +Z
      cz = -halfD + 0.04;
      cx = Math.max(-halfW + 1.8, Math.min(halfW - 1.8, px));
      finalRotY = 0;
    } else {
      // South wall (+halfD), normal pointing -Z
      cz = halfD - 0.04;
      cx = Math.max(-halfW + 1.8, Math.min(halfW - 1.8, px));
      finalRotY = Math.PI;
    }
  }

  return {
    cx,
    cy: py,
    cz,
    rotY: finalRotY,
    rightX: Math.cos(finalRotY),
    rightZ: -Math.sin(finalRotY),
    normalX: Math.sin(finalRotY),
    normalZ: Math.cos(finalRotY),
  };
}

export class LabyrinthRenderer {
  private lastLookedAtPainting: Set<string> = new Set();

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cam: CameraPose,
    manifest: RoomManifest,
    playerState: PlayerState,
    registry: RoomRegistryManifest,
    timeSec: number
  ): { hovered: RaycastTarget | null } {
    if (playerState.activeVoid) {
      this.renderVoidSpace(
        ctx,
        width,
        height,
        cam,
        playerState.activeVoid,
        timeSec
      );
      return { hovered: null };
    }

    const palette = manifest.environment.palette ?? {
      wall: '#1d1a17',
      floor: '#141210',
      ceiling: '#0d0c0a',
      fog: '#0e0c0a',
      accent: '#c8a464',
    };

    const dims = manifest.environment.dimensions ?? [16, 5.4, 18];
    const halfW = dims[0] * 0.5;
    const roomH = dims[1];
    const halfD = dims[2] * 0.5;

    // -------------------------------------------------------------------------
    // PASS 0: Atmospheric Chiaroscuro Backdrop
    // -------------------------------------------------------------------------
    const horizonY = height * 0.5 + Math.tan(cam.pitch) * (height * 0.65);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(10, horizonY));
    skyGrad.addColorStop(0, shadeHex(palette.ceiling, 0.85));
    skyGrad.addColorStop(1, palette.fog);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, Math.max(0, horizonY));

    const floorGrad = ctx.createLinearGradient(
      0,
      Math.max(0, horizonY),
      0,
      height
    );
    floorGrad.addColorStop(0, palette.fog);
    floorGrad.addColorStop(0.35, shadeHex(palette.floor, 0.95));
    floorGrad.addColorStop(1, shadeHex(palette.floor, 1.25));
    ctx.fillStyle = floorGrad;
    ctx.fillRect(
      0,
      Math.max(0, horizonY),
      width,
      height - Math.max(0, horizonY)
    );

    const fovScale = Math.min(width, height) * 0.86;

    // Separate render queues so horizontal planes (Floor y=0 and Ceiling y=roomH)
    // NEVER overdraw or clip vertical doors, pillars, mirrors, or monoliths!
    const ceilingQuads: ProjectedQuad[] = [];
    const floorQuads: ProjectedQuad[] = [];
    const verticalQuads: ProjectedQuad[] = [];

    const buildQuad = (
      targetQueue: ProjectedQuad[],
      worldPts: Vec3Point[],
      baseHex: string,
      strokeColor?: string,
      lineWidth = 1,
      label?: {
        text: string;
        subtext?: string;
        badge?: string;
        worldCenter: Vec3Point;
        color: string;
        scale?: number;
      },
      paintingOverlay?: {
        id: string;
        motifIndex: number;
        mutatesOnIgnore?: boolean;
        mutationPhase: number;
      },
      portalOverlay?: {
        status: string;
        isRabbitHole: boolean;
        voidType?: string;
      },
      alpha = 1
    ) => {
      const camVerts = worldPts.map((pt) => transformToCamera(pt, cam));
      const clipped = clipPolygonAgainstNearPlane(camVerts, -0.22);
      if (clipped.length < 3) return;

      let sumDepth = 0;
      const screenPts = clipped.map((cv) => {
        const depth = -cv.z;
        sumDepth += depth;
        return {
          sx: width * 0.5 + (cv.x / depth) * fovScale,
          sy: height * 0.5 - (cv.y / depth) * fovScale,
        };
      });

      const avgDepth = sumDepth / clipped.length;
      const atten = Math.max(0.28, Math.min(1.22, 1.32 - avgDepth * 0.044));
      const fillColor = baseHex.startsWith('#')
        ? shadeHex(baseHex, atten)
        : baseHex;

      let projectedLabel: ProjectedQuad['label'];
      if (label) {
        const lc = transformToCamera(label.worldCenter, cam);
        if (lc.z < -0.35) {
          const d = -lc.z;
          projectedLabel = {
            text: label.text,
            subtext: label.subtext,
            badge: label.badge,
            sx: width * 0.5 + (lc.x / d) * fovScale,
            sy: height * 0.5 - (lc.y / d) * fovScale,
            color: label.color,
            scale: Math.max(
              0.48,
              Math.min(1.35, (label.scale ?? 1.0) * (4.4 / d))
            ),
          };
        }
      }

      targetQueue.push({
        points: screenPts,
        avgDepth,
        fillColor,
        strokeColor,
        lineWidth,
        alpha,
        label: projectedLabel,
        paintingOverlay: paintingOverlay
          ? { ...paintingOverlay, points: screenPts }
          : undefined,
        portalOverlay: portalOverlay
          ? { ...portalOverlay, points: screenPts }
          : undefined,
      });
    };

    // Helper to build a full 3D Volumetric Box in verticalQuads
    const push3DBox = (
      cx: number,
      yBottom: number,
      yTop: number,
      cz: number,
      halfSizeX: number,
      halfSizeZ: number,
      colorHex: string,
      strokeColor?: string,
      lineWidth = 1
    ) => {
      const x0 = cx - halfSizeX;
      const x1 = cx + halfSizeX;
      const z0 = cz - halfSizeZ;
      const z1 = cz + halfSizeZ;

      // Front (+Z)
      buildQuad(
        verticalQuads,
        [
          { x: x0, y: yBottom, z: z1 },
          { x: x1, y: yBottom, z: z1 },
          { x: x1, y: yTop, z: z1 },
          { x: x0, y: yTop, z: z1 },
        ],
        shadeHex(colorHex, 1.08),
        strokeColor,
        lineWidth
      );
      // Back (-Z)
      buildQuad(
        verticalQuads,
        [
          { x: x1, y: yBottom, z: z0 },
          { x: x0, y: yBottom, z: z0 },
          { x: x0, y: yTop, z: z0 },
          { x: x1, y: yTop, z: z0 },
        ],
        shadeHex(colorHex, 0.94),
        strokeColor,
        lineWidth
      );
      // Left (-X)
      buildQuad(
        verticalQuads,
        [
          { x: x0, y: yBottom, z: z0 },
          { x: x0, y: yBottom, z: z1 },
          { x: x0, y: yTop, z: z1 },
          { x: x0, y: yTop, z: z0 },
        ],
        shadeHex(colorHex, 0.86),
        strokeColor,
        lineWidth
      );
      // Right (+X)
      buildQuad(
        verticalQuads,
        [
          { x: x1, y: yBottom, z: z1 },
          { x: x1, y: yBottom, z: z0 },
          { x: x1, y: yTop, z: z0 },
          { x: x1, y: yTop, z: z1 },
        ],
        shadeHex(colorHex, 0.86),
        strokeColor,
        lineWidth
      );
      // Top cap (if below camera eye height)
      if (yTop < cam.y) {
        buildQuad(
          verticalQuads,
          [
            { x: x0, y: yTop, z: z1 },
            { x: x1, y: yTop, z: z1 },
            { x: x1, y: yTop, z: z0 },
            { x: x0, y: yTop, z: z0 },
          ],
          shadeHex(colorHex, 1.2),
          strokeColor,
          lineWidth
        );
      }
    };

    // -------------------------------------------------------------------------
    // PASS 1: Coffered Ceiling Vault & Skylight Oculi (y = roomH)
    // -------------------------------------------------------------------------
    const gridStepsX = 6;
    const gridStepsZ = 6;
    const stepX = (halfW * 2) / gridStepsX;
    const stepZ = (halfD * 2) / gridStepsZ;

    for (let ix = 0; ix < gridStepsX; ix++) {
      for (let iz = 0; iz < gridStepsZ; iz++) {
        const x0 = -halfW + ix * stepX;
        const x1 = x0 + stepX;
        const z0 = -halfD + iz * stepZ;
        const z1 = z0 + stepZ;

        const isOculus =
          (ix === 2 || ix === 3) && (iz === 2 || iz === 3);
        const ceilColor = isOculus
          ? shadeHex(palette.accent, 0.42)
          : shadeHex(palette.ceiling, (ix + iz) % 2 === 0 ? 1.15 : 0.95);

        buildQuad(
          ceilingQuads,
          [
            { x: x0, y: roomH, z: z1 },
            { x: x1, y: roomH, z: z1 },
            { x: x1, y: roomH, z: z0 },
            { x: x0, y: roomH, z: z0 },
          ],
          ceilColor,
          isOculus
            ? 'rgba(212, 175, 55, 0.35)'
            : 'rgba(200, 164, 100, 0.08)',
          isOculus ? 1.5 : 1
        );
      }
    }

    // -------------------------------------------------------------------------
    // PASS 2: Polished Travertine Floor Slabs, Meridians & Reflections (y = 0)
    // -------------------------------------------------------------------------
    for (let ix = 0; ix < gridStepsX; ix++) {
      for (let iz = 0; iz < gridStepsZ; iz++) {
        const x0 = -halfW + ix * stepX;
        const x1 = x0 + stepX;
        const z0 = -halfD + iz * stepZ;
        const z1 = z0 + stepZ;

        const isCenterPool =
          ix >= 1 && ix <= 4 && iz >= 1 && iz <= 4;
        const checker = (ix + iz) % 2 === 0 ? 1.12 : 0.96;
        const tileHex = isCenterPool
          ? shadeHex(palette.floor, checker * 1.15)
          : shadeHex(palette.floor, checker);

        buildQuad(
          floorQuads,
          [
            { x: x0, y: 0, z: z0 },
            { x: x1, y: 0, z: z0 },
            { x: x1, y: 0, z: z1 },
            { x: x0, y: 0, z: z1 },
          ],
          tileHex,
          isCenterPool
            ? 'rgba(200, 164, 100, 0.16)'
            : 'rgba(255, 255, 255, 0.05)',
          1
        );
      }
    }

    // Central Inlaid Sanctuary Compass / Light Pool on the Floor
    buildQuad(
      floorQuads,
      [
        { x: -2.4, y: 0.005, z: -2.4 },
        { x: 2.4, y: 0.005, z: -2.4 },
        { x: 2.4, y: 0.005, z: 2.4 },
        { x: -2.4, y: 0.005, z: 2.4 },
      ],
      shadeHex(palette.floor, 1.35),
      palette.accent,
      1.2,
      undefined,
      undefined,
      undefined,
      0.55
    );

    // -------------------------------------------------------------------------
    // PASS 3: Subdivided Outer Architectural Walls with Base Plinth & Cornice
    // -------------------------------------------------------------------------
    const wallSegments = 8;
    const plinthH = 0.42;
    const corniceY = roomH - 0.45;

    for (let i = 0; i < wallSegments; i++) {
      const t0 = i / wallSegments;
      const t1 = (i + 1) / wallSegments;
      const x0 = -halfW + t0 * (halfW * 2);
      const x1 = -halfW + t1 * (halfW * 2);
      const z0 = -halfD + t0 * (halfD * 2);
      const z1 = -halfD + t1 * (halfD * 2);

      const wallMainHex = shadeHex(
        palette.wall,
        i % 2 === 0 ? 1.06 : 0.98
      );
      const plinthHex = shadeHex(palette.wall, 0.68);
      const corniceHex = shadeHex(palette.wall, 1.24);

      // --- NORTH WALL (-halfD) ---
      // Base Plinth (0 .. plinthH)
      buildQuad(
        verticalQuads,
        [
          { x: x0, y: 0, z: -halfD },
          { x: x1, y: 0, z: -halfD },
          { x: x1, y: plinthH, z: -halfD },
          { x: x0, y: plinthH, z: -halfD },
        ],
        plinthHex,
        'rgba(200, 164, 100, 0.22)',
        1
      );
      // Main Wall Field (plinthH .. corniceY)
      buildQuad(
        verticalQuads,
        [
          { x: x0, y: plinthH, z: -halfD },
          { x: x1, y: plinthH, z: -halfD },
          { x: x1, y: corniceY, z: -halfD },
          { x: x0, y: corniceY, z: -halfD },
        ],
        wallMainHex,
        'rgba(255, 255, 255, 0.06)',
        1
      );
      // Upper Frieze / Cornice (corniceY .. roomH)
      buildQuad(
        verticalQuads,
        [
          { x: x0, y: corniceY, z: -halfD },
          { x: x1, y: corniceY, z: -halfD },
          { x: x1, y: roomH, z: -halfD },
          { x: x0, y: roomH, z: -halfD },
        ],
        corniceHex,
        'rgba(200, 164, 100, 0.18)',
        1
      );

      // --- SOUTH WALL (+halfD) ---
      buildQuad(
        verticalQuads,
        [
          { x: x1, y: 0, z: halfD },
          { x: x0, y: 0, z: halfD },
          { x: x0, y: plinthH, z: halfD },
          { x: x1, y: plinthH, z: halfD },
        ],
        plinthHex,
        'rgba(200, 164, 100, 0.22)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: x1, y: plinthH, z: halfD },
          { x: x0, y: plinthH, z: halfD },
          { x: x0, y: corniceY, z: halfD },
          { x: x1, y: corniceY, z: halfD },
        ],
        wallMainHex,
        'rgba(255, 255, 255, 0.06)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: x1, y: corniceY, z: halfD },
          { x: x0, y: corniceY, z: halfD },
          { x: x0, y: roomH, z: halfD },
          { x: x1, y: roomH, z: halfD },
        ],
        corniceHex,
        'rgba(200, 164, 100, 0.18)',
        1
      );

      // --- WEST WALL (-halfW) ---
      buildQuad(
        verticalQuads,
        [
          { x: -halfW, y: 0, z: z1 },
          { x: -halfW, y: 0, z: z0 },
          { x: -halfW, y: plinthH, z: z0 },
          { x: -halfW, y: plinthH, z: z1 },
        ],
        plinthHex,
        'rgba(200, 164, 100, 0.22)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: -halfW, y: plinthH, z: z1 },
          { x: -halfW, y: plinthH, z: z0 },
          { x: -halfW, y: corniceY, z: z0 },
          { x: -halfW, y: corniceY, z: z1 },
        ],
        shadeHex(wallMainHex, 0.94),
        'rgba(255, 255, 255, 0.06)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: -halfW, y: corniceY, z: z1 },
          { x: -halfW, y: corniceY, z: z0 },
          { x: -halfW, y: roomH, z: z0 },
          { x: -halfW, y: roomH, z: z1 },
        ],
        corniceHex,
        'rgba(200, 164, 100, 0.18)',
        1
      );

      // --- EAST WALL (+halfW) ---
      buildQuad(
        verticalQuads,
        [
          { x: halfW, y: 0, z: z0 },
          { x: halfW, y: 0, z: z1 },
          { x: halfW, y: plinthH, z: z1 },
          { x: halfW, y: plinthH, z: z0 },
        ],
        plinthHex,
        'rgba(200, 164, 100, 0.22)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: halfW, y: plinthH, z: z0 },
          { x: halfW, y: plinthH, z: z1 },
          { x: halfW, y: corniceY, z: z1 },
          { x: halfW, y: corniceY, z: z0 },
        ],
        shadeHex(wallMainHex, 0.94),
        'rgba(255, 255, 255, 0.06)',
        1
      );
      buildQuad(
        verticalQuads,
        [
          { x: halfW, y: corniceY, z: z0 },
          { x: halfW, y: corniceY, z: z1 },
          { x: halfW, y: roomH, z: z1 },
          { x: halfW, y: roomH, z: z0 },
        ],
        corniceHex,
        'rgba(200, 164, 100, 0.18)',
        1
      );
    }

    // -------------------------------------------------------------------------
    // PASS 4: Monumental Architectural Colonnade Pillars (Floor y=0 to Ceiling y=roomH)
    // -------------------------------------------------------------------------
    const colX = Math.max(3.6, halfW - 2.6);
    const colZ = Math.max(3.4, halfD - 3.6);
    const pillarCoords: Array<[number, number]> = [
      [-colX, -colZ],
      [colX, -colZ],
      [-colX, colZ],
      [colX, colZ],
    ];

    pillarCoords.forEach(([px, pz]) => {
      // Floor Contact Shadow under Pillar
      buildQuad(
        floorQuads,
        [
          { x: px - 0.65, y: 0.008, z: pz - 0.65 },
          { x: px + 0.65, y: 0.008, z: pz - 0.65 },
          { x: px + 0.65, y: 0.008, z: pz + 0.65 },
          { x: px - 0.65, y: 0.008, z: pz + 0.65 },
        ],
        '#050506',
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        0.7
      );

      // Stepped Pillar Base on the Floor (y = 0 .. 0.35)
      push3DBox(
        px,
        0,
        0.35,
        pz,
        0.48,
        0.48,
        shadeHex(palette.wall, 1.35),
        palette.accent,
        1.2
      );
      // Lower Column Shaft (y = 0.35 .. 2.7)
      push3DBox(
        px,
        0.35,
        2.7,
        pz,
        0.34,
        0.34,
        shadeHex(palette.wall, 1.18),
        'rgba(200, 164, 100, 0.2)',
        1
      );
      // Upper Column Shaft (y = 2.7 .. roomH - 0.35)
      push3DBox(
        px,
        2.7,
        roomH - 0.35,
        pz,
        0.34,
        0.34,
        shadeHex(palette.wall, 1.18),
        'rgba(200, 164, 100, 0.2)',
        1
      );
      // Pillar Capital (y = roomH - 0.35 .. roomH)
      push3DBox(
        px,
        roomH - 0.35,
        roomH,
        pz,
        0.5,
        0.5,
        shadeHex(palette.wall, 1.38),
        palette.accent,
        1.2
      );
    });

    // -------------------------------------------------------------------------
    // PASS 5: Floor-Standing Mirror Portal & Reflected World (Grounded at y = 0)
    // -------------------------------------------------------------------------
    const activeObjects = getActiveRoomObjects(manifest, playerState);

    if (manifest.mirror) {
      const mAnchor = resolveWallAnchoredPose(
        manifest.mirror.position,
        0,
        halfW,
        halfD,
        0
      );
      const mw = 2.5;
      const mh = 3.85;
      const { cx, cz, rightX, rightZ, normalX, normalZ } = mAnchor;

      // Planar Floor Reflection in front of the Mirror (on y = 0.01)
      const reflDepth = 1.6;
      buildQuad(
        floorQuads,
        [
          {
            x: cx - rightX * (mw * 0.55),
            y: 0.01,
            z: cz - rightZ * (mw * 0.55),
          },
          {
            x: cx + rightX * (mw * 0.55),
            y: 0.01,
            z: cz + rightZ * (mw * 0.55),
          },
          {
            x: cx + rightX * (mw * 0.55) + normalX * reflDepth,
            y: 0.01,
            z: cz + rightZ * (mw * 0.55) + normalZ * reflDepth,
          },
          {
            x: cx - rightX * (mw * 0.55) + normalX * reflDepth,
            y: 0.01,
            z: cz - rightZ * (mw * 0.55) + normalZ * reflDepth,
          },
        ],
        '#142230',
        'rgba(125, 162, 196, 0.28)',
        1,
        undefined,
        undefined,
        undefined,
        0.55
      );

      // Heavy Stepped Mirror Plinth resting on Floor (y = 0 .. 0.22)
      push3DBox(
        cx + normalX * 0.16,
        0,
        0.22,
        cz + normalZ * 0.16,
        Math.abs(rightX) * (mw * 0.62) + Math.abs(normalX) * 0.22,
        Math.abs(rightZ) * (mw * 0.62) + Math.abs(normalZ) * 0.22,
        '#252019',
        '#7da2c4',
        1.4
      );

      // Left & Right Mirror Pilasters (y = 0.22 .. mh)
      const pilOffset = mw * 0.54;
      [-pilOffset, pilOffset].forEach((offset) => {
        push3DBox(
          cx + rightX * offset + normalX * 0.12,
          0.22,
          mh,
          cz + rightZ * offset + normalZ * 0.12,
          0.14,
          0.14,
          '#26221c',
          '#7da2c4',
          1.2
        );
      });

      // Mirror Crown Entablature (y = mh .. mh + 0.34)
      push3DBox(
        cx + normalX * 0.15,
        mh,
        mh + 0.34,
        cz + normalZ * 0.15,
        Math.abs(rightX) * (mw * 0.62) + Math.abs(normalX) * 0.2,
        Math.abs(rightZ) * (mw * 0.62) + Math.abs(normalZ) * 0.2,
        '#2a241d',
        '#7da2c4',
        1.5
      );

      // Mirror Reflective Glass Plane (y = 0.22 .. mh, strictly anchored on plinth!)
      const gx = cx + normalX * 0.1;
      const gz = cz + normalZ * 0.1;
      buildQuad(
        verticalQuads,
        [
          {
            x: gx - rightX * (mw * 0.48),
            y: 0.22,
            z: gz - rightZ * (mw * 0.48),
          },
          {
            x: gx + rightX * (mw * 0.48),
            y: 0.22,
            z: gz + rightZ * (mw * 0.48),
          },
          {
            x: gx + rightX * (mw * 0.48),
            y: mh,
            z: gz + rightZ * (mw * 0.48),
          },
          {
            x: gx - rightX * (mw * 0.48),
            y: mh,
            z: gz - rightZ * (mw * 0.48),
          },
        ],
        '#101d29',
        '#8eb4d4',
        2.2,
        {
          text: manifest.mirror.characterState,
          subtext:
            manifest.mirror.mode === 'first'
              ? 'Whom do you expect to meet here?'
              : manifest.mirror.mode === 'meta'
              ? 'Was this truly a labyrinth?'
              : 'ACCEPT · REJECT · RETURN',
          badge: 'MIRROR',
          worldCenter: {
            x: gx + normalX * 0.05,
            y: mh * 0.62,
            z: gz + normalZ * 0.05,
          },
          color: '#e2eef8',
          scale: 0.92,
        }
      );

      // Render reflected objects inside the mirror glass (omitting visibleInMirror: false!)
      activeObjects.forEach((obj) => {
        if (obj.visibleInMirror === false) return;
        const relOffset = Math.max(
          -mw * 0.34,
          Math.min(mw * 0.34, obj.position[0] * 0.32)
        );
        const rx = gx + rightX * relOffset + normalX * 0.03;
        const rz = gz + rightZ * relOffset + normalZ * 0.03;
        buildQuad(
          verticalQuads,
          [
            { x: rx - rightX * 0.22, y: 0.26, z: rz - rightZ * 0.22 },
            { x: rx + rightX * 0.22, y: 0.26, z: rz + rightZ * 0.22 },
            { x: rx + rightX * 0.22, y: 1.95, z: rz + rightZ * 0.22 },
            { x: rx - rightX * 0.22, y: 1.95, z: rz - rightZ * 0.22 },
          ],
          '#24384b',
          'rgba(170, 210, 245, 0.5)',
          1.2
        );
      });
    }

    // -------------------------------------------------------------------------
    // PASS 6: Monumental 3D Door Portals (Grounded at y = 0, Embedded in Wall)
    // -------------------------------------------------------------------------
    manifest.doors.forEach((door) => {
      const evalDoor = evaluateDoor(door, playerState, registry);
      if (!evalDoor.isVisible) return;

      const dAnchor = resolveWallAnchoredPose(
        door.position,
        door.rotation?.[1],
        halfW,
        halfD,
        0
      );
      const { cx, cz, rightX, rightZ, normalX, normalZ } = dAnchor;

      const isRabbitHole = door.type === 'rabbit-hole' || door.id === 'RH';
      const dw = isRabbitHole ? 1.55 : door.type === 'monumental' ? 2.15 : 1.85;
      const dh = isRabbitHole ? 3.25 : door.type === 'monumental' ? 3.85 : 3.45;

      // 1. Inlaid Brass Meridian Path on Floor from Room Center to Door Threshold
      buildQuad(
        floorQuads,
        [
          { x: -rightX * 0.12, y: 0.006, z: -rightZ * 0.12 },
          { x: rightX * 0.12, y: 0.006, z: rightZ * 0.12 },
          {
            x: cx + normalX * 0.45 + rightX * 0.12,
            y: 0.006,
            z: cz + normalZ * 0.45 + rightZ * 0.12,
          },
          {
            x: cx + normalX * 0.45 - rightX * 0.12,
            y: 0.006,
            z: cz + normalZ * 0.45 - rightZ * 0.12,
          },
        ],
        palette.accent,
        undefined,
        1,
        undefined,
        undefined,
        undefined,
        0.24
      );

      // 2. Planar Floor Reflection & Grounded Stone Threshold Step on Floor (y = 0)
      const stepWidth = dw * 0.68;
      const stepDepth = 0.65;
      buildQuad(
        floorQuads,
        [
          {
            x: cx - rightX * stepWidth,
            y: 0.012,
            z: cz - rightZ * stepWidth,
          },
          {
            x: cx + rightX * stepWidth,
            y: 0.012,
            z: cz + rightZ * stepWidth,
          },
          {
            x: cx + rightX * stepWidth + normalX * stepDepth,
            y: 0.012,
            z: cz + rightZ * stepWidth + normalZ * stepDepth,
          },
          {
            x: cx - rightX * stepWidth + normalX * stepDepth,
            y: 0.012,
            z: cz - rightZ * stepWidth + normalZ * stepDepth,
          },
        ],
        '#2b251e',
        palette.accent,
        1.5
      );

      // 3. Raised 3D Stone Threshold Step (y = 0 .. 0.14) — anchors door to floor!
      push3DBox(
        cx + normalX * 0.22,
        0,
        0.14,
        cz + normalZ * 0.22,
        Math.abs(rightX) * (dw * 0.64) + Math.abs(normalX) * 0.24,
        Math.abs(rightZ) * (dw * 0.64) + Math.abs(normalZ) * 0.24,
        '#302922',
        palette.accent,
        1.3
      );

      // 4. Left & Right 3D Stone Jamb Pillars (y = 0.14 .. dh)
      const jambOffset = dw * 0.56;
      const jambHalfW = 0.16;
      [-jambOffset, jambOffset].forEach((offset) => {
        push3DBox(
          cx + rightX * offset + normalX * 0.16,
          0.14,
          dh,
          cz + rightZ * offset + normalZ * 0.16,
          jambHalfW,
          jambHalfW,
          '#2b251f',
          isRabbitHole ? '#d4af37' : palette.accent,
          1.3
        );
      });

      // 5. Monumental Carved Lintel & Entablature (y = dh .. dh + 0.48)
      push3DBox(
        cx + normalX * 0.18,
        dh,
        dh + 0.48,
        cz + normalZ * 0.18,
        Math.abs(rightX) * (dw * 0.66) + Math.abs(normalX) * 0.22,
        Math.abs(rightZ) * (dw * 0.66) + Math.abs(normalZ) * 0.22,
        '#332c24',
        isRabbitHole ? '#f0d27a' : palette.accent,
        1.5
      );

      // 6. Door Leaf / Portal Aperture (y = 0.14 .. dh)
      const doorFill = isRabbitHole
        ? '#1a1224'
        : door.status === 'void'
        ? '#0a101a'
        : door.status === 'planned'
        ? '#121924'
        : '#1d1813';

      const doorStroke = isRabbitHole
        ? '#f0d27a'
        : evalDoor.isUnlocked
        ? palette.accent
        : '#6e6456';

      const leafX = cx + normalX * 0.08;
      const leafZ = cz + normalZ * 0.08;

      buildQuad(
        verticalQuads,
        [
          {
            x: leafX - rightX * (dw * 0.48),
            y: 0.14,
            z: leafZ - rightZ * (dw * 0.48),
          },
          {
            x: leafX + rightX * (dw * 0.48),
            y: 0.14,
            z: leafZ + rightZ * (dw * 0.48),
          },
          {
            x: leafX + rightX * (dw * 0.48),
            y: dh,
            z: leafZ + rightZ * (dw * 0.48),
          },
          {
            x: leafX - rightX * (dw * 0.48),
            y: dh,
            z: leafZ - rightZ * (dw * 0.48),
          },
        ],
        doorFill,
        doorStroke,
        2.2,
        {
          text: `DOOR ${door.label || door.id}`,
          subtext:
            door.subtitle ||
            (door.destination
              ? `→ ${door.destination}`
              : `→ VOID (${door.fallback?.type || 'infinity'})`),
          badge: door.symbol || door.id,
          worldCenter: {
            x: leafX + normalX * 0.08,
            y: dh * 0.56,
            z: leafZ + normalZ * 0.08,
          },
          color: isRabbitHole ? '#f5dc8c' : '#f3ede2',
          scale: 0.95,
        },
        undefined,
        {
          status: door.status,
          isRabbitHole,
          voidType: door.fallback?.type,
        }
      );
    });

    // -------------------------------------------------------------------------
    // PASS 7: Framed Artworks Mounted Flush on Walls (with Wall Brackets & Halo)
    // -------------------------------------------------------------------------
    (manifest.paintings ?? []).forEach((painting, pIdx) => {
      const pAnchor = resolveWallAnchoredPose(
        painting.position,
        painting.rotation[1],
        halfW,
        halfD,
        painting.position[1] || 2.2
      );
      const { cx, cy, cz, rightX, rightZ, normalX, normalZ } = pAnchor;
      const scale = painting.scale ?? 1.25;
      const pw = 1.75 * scale;
      const ph = 1.22 * scale;

      const frameHex =
        painting.frame === 'classic_gold'
          ? '#c8a464'
          : painting.frame === 'obsidian_minimal'
          ? '#2a303a'
          : painting.frame === 'bronze_monument'
          ? '#966d42'
          : '#9c907e';

      // Outer 3D Shadow Box Frame Backing (flush against wall)
      const frameOuterW = pw * 0.56;
      const frameOuterH = ph * 0.58;
      const fx = cx + normalX * 0.05;
      const fz = cz + normalZ * 0.05;

      buildQuad(
        verticalQuads,
        [
          {
            x: fx - rightX * frameOuterW,
            y: cy - frameOuterH,
            z: fz - rightZ * frameOuterW,
          },
          {
            x: fx + rightX * frameOuterW,
            y: cy - frameOuterH,
            z: fz + rightZ * frameOuterW,
          },
          {
            x: fx + rightX * frameOuterW,
            y: cy + frameOuterH,
            z: fz + rightZ * frameOuterW,
          },
          {
            x: fx - rightX * frameOuterW,
            y: cy + frameOuterH,
            z: fz - rightZ * frameOuterW,
          },
        ],
        '#241e18',
        frameHex,
        2.5
      );

      // Brass Museum Lamp Bar above Painting
      push3DBox(
        cx + normalX * 0.14,
        cy + frameOuterH + 0.08,
        cy + frameOuterH + 0.15,
        cz + normalZ * 0.14,
        Math.abs(rightX) * 0.45 + 0.06,
        Math.abs(rightZ) * 0.45 + 0.06,
        '#c8a464'
      );

      // Inner Canvas Plate
      const canvasX = cx + normalX * 0.08;
      const canvasZ = cz + normalZ * 0.08;
      const mutationPhase = observationSystem.getPaintingMutationPhase(
        painting.id
      );

      buildQuad(
        verticalQuads,
        [
          {
            x: canvasX - rightX * (pw * 0.48),
            y: cy - ph * 0.48,
            z: canvasZ - rightZ * (pw * 0.48),
          },
          {
            x: canvasX + rightX * (pw * 0.48),
            y: cy - ph * 0.48,
            z: canvasZ + rightZ * (pw * 0.48),
          },
          {
            x: canvasX + rightX * (pw * 0.48),
            y: cy + ph * 0.48,
            z: canvasZ + rightZ * (pw * 0.48),
          },
          {
            x: canvasX - rightX * (pw * 0.48),
            y: cy + ph * 0.48,
            z: canvasZ - rightZ * (pw * 0.48),
          },
        ],
        '#141210',
        frameHex,
        2.0,
        {
          text: painting.metadata.title,
          subtext: `${painting.metadata.author} · ${painting.metadata.license}`,
          worldCenter: {
            x: canvasX + normalX * 0.04,
            y: cy - ph * 0.32,
            z: canvasZ + normalZ * 0.04,
          },
          color: '#f3ede2',
          scale: 0.78,
        },
        {
          id: painting.id,
          motifIndex: pIdx,
          mutatesOnIgnore: painting.interaction?.mutatesOnIgnore,
          mutationPhase,
        }
      );
    });

    // -------------------------------------------------------------------------
    // PASS 8: Sculptural 3D Room Objects & Anomalies (Grounded at y = 0)
    // -------------------------------------------------------------------------
    activeObjects.forEach((obj) => {
      const [ox, , oz] = obj.position;

      if (obj.type === 'shadow_anomaly') {
        // Anomalous shadow lying flat on the floor with NO physical object above it
        const sw = 0.85;
        const sd = 1.45;
        buildQuad(
          floorQuads,
          [
            { x: ox - sw, y: 0.015, z: oz - sd },
            { x: ox + sw, y: 0.015, z: oz - sd },
            { x: ox + sw, y: 0.015, z: oz + sd },
            { x: ox - sw, y: 0.015, z: oz + sd },
          ],
          '#040405',
          'rgba(212, 175, 55, 0.55)',
          1.8,
          {
            text: obj.title || 'Shadow Without an Object',
            subtext: 'Anomalous silhouette cast by nothing',
            badge: '◊',
            worldCenter: { x: ox, y: 0.35, z: oz },
            color: '#f0d27a',
            scale: 0.84,
          }
        );
        return;
      }

      // Grounded Contact Shadow on Floor (y = 0.01)
      if (obj.castsShadow !== false) {
        buildQuad(
          floorQuads,
          [
            { x: ox - 0.68, y: 0.01, z: oz - 0.68 },
            { x: ox + 0.68, y: 0.01, z: oz - 0.68 },
            { x: ox + 0.68, y: 0.01, z: oz + 0.68 },
            { x: ox - 0.68, y: 0.01, z: oz + 0.68 },
          ],
          '#050506',
          'rgba(200, 164, 100, 0.18)',
          1,
          undefined,
          undefined,
          undefined,
          0.75
        );
      }

      const objH =
        obj.type === 'monolith' || obj.type === 'reflection_anomaly'
          ? 2.45
          : obj.type === 'chair'
          ? 1.25
          : 1.48;
      const objW = 0.38;

      const objColor =
        obj.type === 'reflection_anomaly'
          ? '#243444'
          : obj.type === 'chair'
          ? '#4a3726'
          : '#2c2722';

      // Stepped Stone Pedestal Base on Floor (y = 0 .. 0.24)
      push3DBox(
        ox,
        0,
        0.24,
        oz,
        objW + 0.14,
        objW + 0.14,
        '#211d19',
        palette.accent,
        1.2
      );

      // Main 3D Sculptural Column / Object Body (y = 0.24 .. objH)
      push3DBox(
        ox,
        0.24,
        objH,
        oz,
        objW,
        objW,
        objColor,
        palette.accent,
        1.4
      );

      // Floating Label Anchor on Front Face of Object
      buildQuad(
        verticalQuads,
        [
          { x: ox - objW, y: objH - 0.1, z: oz + objW + 0.01 },
          { x: ox + objW, y: objH - 0.1, z: oz + objW + 0.01 },
          { x: ox + objW, y: objH, z: oz + objW + 0.01 },
          { x: ox - objW, y: objH, z: oz + objW + 0.01 },
        ],
        objColor,
        undefined,
        0,
        {
          text: obj.title || obj.id,
          subtext: `[${obj.interactions.join(' · ')}]`,
          worldCenter: { x: ox, y: objH + 0.32, z: oz },
          color: '#f3ede2',
          scale: 0.82,
        }
      );
    });

    // -------------------------------------------------------------------------
    // DRAW QUEUES IN STRICT ARCHITECTURAL ORDER:
    // 1. Ceiling Vault (y = roomH)
    // 2. Floor Slabs, Meridians, Reflections & Door Threshold Bases (y = 0)
    // 3. Vertical Walls, Colonnades, Door Portals, Mirrors, Paintings & Objects
    // -------------------------------------------------------------------------
    ceilingQuads.sort((a, b) => b.avgDepth - a.avgDepth);
    floorQuads.sort((a, b) => b.avgDepth - a.avgDepth);
    verticalQuads.sort((a, b) => b.avgDepth - a.avgDepth);

    const drawQueue = (queue: ProjectedQuad[]) => {
      for (const q of queue) {
        ctx.save();
        if (q.alpha !== undefined && q.alpha < 1) {
          ctx.globalAlpha = q.alpha;
        }
        ctx.beginPath();
        ctx.moveTo(q.points[0].sx, q.points[0].sy);
        for (let i = 1; i < q.points.length; i++) {
          ctx.lineTo(q.points[i].sx, q.points[i].sy);
        }
        ctx.closePath();
        ctx.fillStyle = q.fillColor;
        ctx.fill();

        if (q.strokeColor && (q.lineWidth ?? 1) > 0) {
          ctx.strokeStyle = q.strokeColor;
          ctx.lineWidth = q.lineWidth ?? 1;
          ctx.stroke();
        }

        // Render Door Portal Inner Relief & Threshold Details
        if (q.portalOverlay && q.points.length >= 4) {
          this.drawPortalInnerDetails(ctx, q.portalOverlay, timeSec);
        }

        // Render Painting Artwork Motif inside Frame
        if (q.paintingOverlay && q.points.length >= 4) {
          this.drawPaintingArtwork(ctx, q.paintingOverlay, timeSec);
        }

        if (q.label) {
          this.drawArchitecturalLabel(ctx, q.label);
        }
        ctx.restore();
      }
    };

    drawQueue(ceilingQuads);
    drawQueue(floorQuads);
    drawQueue(verticalQuads);

    // -------------------------------------------------------------------------
    // PASS 9: Volumetric Cathedral Light Shafts & Atmospheric Dust Motes
    // -------------------------------------------------------------------------
    this.renderVolumetricAtmosphere(ctx, width, height, cam, timeSec, palette.accent);

    // Raycast from center of viewport to find hovered target
    const hovered = this.computeHoveredTarget(
      cam,
      manifest,
      playerState,
      registry,
      halfW,
      halfD
    );

    // Check if player looked away from a mutating painting
    (manifest.paintings ?? []).forEach((p) => {
      if (p.interaction?.mutatesOnIgnore) {
        const isCurrentlyLooking =
          hovered?.kind === 'painting' && hovered.id === p.id;
        if (this.lastLookedAtPainting.has(p.id) && !isCurrentlyLooking) {
          observationSystem.notifyPaintingIgnored(p.id);
          this.lastLookedAtPainting.delete(p.id);
        } else if (isCurrentlyLooking) {
          this.lastLookedAtPainting.add(p.id);
        }
      }
    });

    return { hovered };
  }

  private drawPortalInnerDetails(
    ctx: CanvasRenderingContext2D,
    portal: NonNullable<ProjectedQuad['portalOverlay']>,
    timeSec: number
  ): void {
    const pts = portal.points;
    const cx = pts.reduce((acc, p) => acc + p.sx, 0) / pts.length;
    const cy = pts.reduce((acc, p) => acc + p.sy, 0) / pts.length;
    const approxW = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy);
    const approxH = Math.hypot(pts[2].sx - pts[1].sx, pts[2].sy - pts[1].sy);
    if (approxW < 18 || approxH < 24) return;

    ctx.save();
    // Clip to door leaf polygon
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].sx, pts[i].sy);
    }
    ctx.closePath();
    ctx.clip();

    // Central vertical bronze astragal seam between double doors
    const midBottomX = (pts[0].sx + pts[1].sx) * 0.5;
    const midBottomY = (pts[0].sy + pts[1].sy) * 0.5;
    const midTopX = (pts[2].sx + pts[3].sx) * 0.5;
    const midTopY = (pts[2].sy + pts[3].sy) * 0.5;

    ctx.strokeStyle = portal.isRabbitHole
      ? 'rgba(240, 210, 122, 0.65)'
      : 'rgba(200, 164, 100, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(midBottomX, midBottomY);
    ctx.lineTo(midTopX, midTopY);
    ctx.stroke();

    // Sacred geometric tympanum arch / rose motif in upper door panel
    const ringRadius = Math.min(approxW * 0.34, approxH * 0.22);
    const ringY = cy - approxH * 0.16;
    ctx.strokeStyle = portal.isRabbitHole
      ? 'rgba(240, 210, 122, 0.55)'
      : portal.status === 'void' || portal.status === 'planned'
      ? 'rgba(125, 162, 196, 0.5)'
      : 'rgba(200, 164, 100, 0.35)';
    ctx.lineWidth = 1.2;

    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(
        cx,
        ringY,
        ringRadius * (k / 3) * (1 + Math.sin(timeSec * 1.4 + k) * 0.03),
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPaintingArtwork(
    ctx: CanvasRenderingContext2D,
    overlay: NonNullable<ProjectedQuad['paintingOverlay']>,
    timeSec: number
  ): void {
    const pts = overlay.points;
    const cx = pts.reduce((acc, p) => acc + p.sx, 0) / pts.length;
    const cy = pts.reduce((acc, p) => acc + p.sy, 0) / pts.length;
    const approxW = Math.hypot(pts[1].sx - pts[0].sx, pts[1].sy - pts[0].sy);
    if (approxW < 20) return;

    const r = Math.min(85, approxW * 0.28);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].sx, pts[i].sy);
    }
    ctx.closePath();
    ctx.clip();

    const isMutated =
      overlay.mutatesOnIgnore && overlay.mutationPhase % 2 === 1;
    ctx.strokeStyle = isMutated ? '#7da2c4' : '#c8a464';
    ctx.lineWidth = 1.5;

    if (isMutated) {
      // Non-Euclidean shifted motif when painting was ignored
      for (let i = 1; i <= 4; i++) {
        ctx.strokeRect(
          cx - (r * i) / 3,
          cy - (r * i) / 3,
          (r * 2 * i) / 3,
          (r * 2 * i) / 3
        );
      }
    } else if (overlay.motifIndex % 3 === 0) {
      // Concentric celestial astrolabe & perspective arches
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.moveTo(cx - r * 1.2, cy);
      ctx.lineTo(cx + r * 1.2, cy);
      ctx.stroke();
    } else if (overlay.motifIndex % 3 === 1) {
      // Horizon geometry with golden solar disc
      ctx.beginPath();
      ctx.arc(
        cx,
        cy - r * 0.15,
        r * 0.55,
        0,
        Math.PI * 2
      );
      ctx.moveTo(cx - r * 1.3, cy + r * 0.35);
      ctx.lineTo(cx + r * 1.3, cy + r * 0.35);
      ctx.stroke();
    } else {
      // Cartographic 1149 diamond lattice
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35 + Math.sin(timeSec) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawArchitecturalLabel(
    ctx: CanvasRenderingContext2D,
    label: NonNullable<ProjectedQuad['label']>
  ): void {
    const fontSize = Math.max(10, Math.round(13 * label.scale));
    ctx.save();
    ctx.textAlign = 'center';

    if (label.badge) {
      const badgeSize = Math.max(11, Math.round(14 * label.scale));
      ctx.font = `600 ${badgeSize}px "Cinzel", Georgia, serif`;
      ctx.fillStyle = '#c8a464';
      ctx.fillText(label.badge, label.sx, label.sy - fontSize - 6);
    }

    ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;
    ctx.fillStyle = label.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 6;
    ctx.fillText(label.text, label.sx, label.sy);

    if (label.subtext) {
      const subSize = Math.max(9, Math.round(10.5 * label.scale));
      ctx.font = `400 ${subSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(232, 224, 210, 0.78)';
      ctx.fillText(label.subtext, label.sx, label.sy + fontSize + 4);
    }
    ctx.restore();
  }

  private renderVolumetricAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cam: CameraPose,
    timeSec: number,
    accentHex: string
  ): void {
    ctx.save();
    // Overhead Cathedral Light Cone from Oculus
    const beamCenterX =
      width * 0.5 - Math.sin(cam.yaw) * (width * 0.18);
    const beamGrad = ctx.createRadialGradient(
      beamCenterX,
      height * 0.18,
      10,
      beamCenterX,
      height * 0.55,
      Math.max(width, height) * 0.55
    );
    beamGrad.addColorStop(0, 'rgba(212, 175, 55, 0.09)');
    beamGrad.addColorStop(0.5, 'rgba(200, 164, 100, 0.03)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle floating golden dust motes in the light shaft
    ctx.fillStyle = accentHex;
    for (let i = 0; i < 28; i++) {
      const mx =
        ((i * 197.3 - cam.yaw * 240 + Math.sin(timeSec * 0.4 + i) * 24) %
          width +
          width) %
        width;
      const my =
        ((i * 131.7 + cam.pitch * 180 - timeSec * (6 + (i % 4) * 2)) %
          height +
          height) %
        height;
      const alpha = 0.15 + 0.2 * Math.sin(timeSec * 1.2 + i);
      ctx.globalAlpha = Math.max(0.05, alpha);
      ctx.beginPath();
      ctx.arc(mx, my, (i % 2) + 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vignette framing for depth and VR comfort
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.32,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(5, 4, 4, 0.52)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private computeHoveredTarget(
    cam: CameraPose,
    manifest: RoomManifest,
    playerState: PlayerState,
    registry: RoomRegistryManifest,
    halfW: number,
    halfD: number
  ): RaycastTarget | null {
    const candidates: RaycastTarget[] = [];

    const checkPoint = (
      pos: [number, number, number],
      maxDist: number,
      target: Omit<RaycastTarget, 'distance'>
    ) => {
      const cv = transformToCamera({ x: pos[0], y: pos[1], z: pos[2] }, cam);
      const dist = -cv.z;
      if (dist <= 0.3 || dist > maxDist) return;
      const horizontalAngle = Math.abs(Math.atan2(cv.x, dist));
      const verticalAngle = Math.abs(Math.atan2(cv.y, dist));
      if (horizontalAngle < 0.28 && verticalAngle < 0.34) {
        candidates.push({ ...target, distance: dist });
      }
    };

    // Doors (using anchored wall coordinates)
    manifest.doors.forEach((door) => {
      const ev = evaluateDoor(door, playerState, registry);
      if (!ev.isVisible) return;
      const dAnchor = resolveWallAnchoredPose(
        door.position,
        door.rotation?.[1],
        halfW,
        halfD,
        0
      );
      checkPoint([dAnchor.cx, 1.7, dAnchor.cz], 11.5, {
        kind: 'door',
        id: door.id,
        title: `Door ${door.label || door.id}`,
        titleRu: `Дверь ${door.label || door.id}`,
        subtitle: door.subtitle,
        subtitleRu: door.subtitleRu,
        door,
      });
    });

    // Paintings (using anchored wall coordinates)
    (manifest.paintings ?? []).forEach((p) => {
      const pAnchor = resolveWallAnchoredPose(
        p.position,
        p.rotation[1],
        halfW,
        halfD,
        p.position[1] || 2.2
      );
      checkPoint([pAnchor.cx, pAnchor.cy, pAnchor.cz], 9.5, {
        kind: 'painting',
        id: p.id,
        title: p.metadata.title,
        titleRu: p.metadata.titleRu,
        subtitle: `${p.metadata.author} · ${p.metadata.license}`,
        discoveryId: p.interaction?.discovery,
        painting: p,
      });
    });

    // Active Objects
    getActiveRoomObjects(manifest, playerState).forEach((obj) => {
      const yCheck = obj.type === 'shadow_anomaly' ? 0.2 : 1.3;
      checkPoint([obj.position[0], yCheck, obj.position[2]], 8.5, {
        kind: 'object',
        id: obj.id,
        title: obj.title || obj.id,
        titleRu: obj.titleRu || obj.title,
        subtitle: obj.interactions.join(' · '),
        discoveryId: obj.discoveryId,
        object: obj,
      });
    });

    // Mirror
    if (manifest.mirror) {
      const mAnchor = resolveWallAnchoredPose(
        manifest.mirror.position,
        0,
        halfW,
        halfD,
        0
      );
      checkPoint([mAnchor.cx, 1.8, mAnchor.cz], 10.5, {
        kind: 'mirror',
        id: manifest.mirror.id,
        title: `Mirror · ${manifest.mirror.characterState}`,
        titleRu: `Зеркало · ${
          manifest.mirror.characterStateRu || manifest.mirror.characterState
        }`,
        subtitle: 'ACCEPT · REJECT · RETURN',
        mirror: manifest.mirror,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] ?? null;
  }

  private renderVoidSpace(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cam: CameraPose,
    voidType: VoidType,
    timeSec: number
  ): void {
    const desc = getVoidDescriptor(voidType);
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75
    );
    bgGrad.addColorStop(0, shadeHex(desc.atmosphereColor, 1.45));
    bgGrad.addColorStop(1, '#040406');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5 - cam.yaw * 140;
    const cy = height * 0.5 + cam.pitch * 180;

    ctx.save();
    if (voidType === 'fractal') {
      // Sacred 3D Recursive Cathedral Manifold
      for (let i = 22; i >= 1; i--) {
        const phase = (timeSec * 0.42 + i * 0.32) % 6.5;
        const r = Math.max(8, i * 26 + phase * 18);
        ctx.strokeStyle =
          i % 2 === 0
            ? 'rgba(125, 162, 196, 0.42)'
            : 'rgba(200, 164, 100, 0.36)';
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(width * 0.5, height * 0.5);
        ctx.rotate(timeSec * 0.1 * (i % 2 === 0 ? 1 : -1) + cam.yaw * 0.5);
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.707, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (voidType === 'infinity') {
      // Endless Receding Monumental Colonnade
      for (let i = 1; i <= 28; i++) {
        const zDist = i * 1.25 - ((timeSec * 1.4) % 1.25);
        if (zDist <= 0.2) continue;
        const scale = 880 / zDist;
        const alpha = Math.min(0.75, 1.9 / i);
        ctx.strokeStyle = `rgba(200, 164, 100, ${alpha})`;
        ctx.lineWidth = Math.max(1, 3.2 - i * 0.1);
        const w = scale * 0.78;
        const h = scale * 1.05;
        ctx.strokeRect(width * 0.5 - w, height * 0.5 - h, w * 2, h * 2);
        // Arch crown
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5 - h * 0.4, w, Math.PI, 0);
        ctx.stroke();
      }
    } else if (voidType === 'starfield') {
      // Astral Vault with Celestial Meridians
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
      for (let r = 120; r <= 600; r += 120) {
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i < 200; i++) {
        const sx =
          (((i * 137.5 + cx * (1 + (i % 5) * 0.22)) % width) + width) % width;
        const sy =
          (((i * 293.1 + cy * (1 + (i % 4) * 0.22)) % height) + height) %
          height;
        const size = (i % 3) + 1;
        ctx.fillStyle =
          i % 7 === 0 ? '#e0be78' : 'rgba(230, 238, 250, 0.82)';
        ctx.fillRect(sx, sy, size, size);
      }
    } else if (voidType === 'mirror') {
      // Dual-Horizon Obsidian Reflection Plane
      for (let i = -12; i <= 12; i++) {
        const x = width * 0.5 + i * 54;
        ctx.strokeStyle = 'rgba(142, 180, 212, 0.32)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(width * 0.5 + i * 240, height);
        ctx.stroke();
      }
    } else {
      // Liminal Fog / Darkness / Unknown 1149th Horizon
      for (let i = 1; i <= 10; i++) {
        ctx.strokeStyle = 'rgba(200, 164, 100, 0.18)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(
          width * 0.5,
          height * 0.5,
          i * 52 + ((timeSec * 16) % 52),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

export const labyrinthRenderer = new LabyrinthRenderer();
