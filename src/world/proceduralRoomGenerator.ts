import * as THREE from 'three';
import { RoomV1Manifest } from '../room-sdk';
import { HubPlayerState } from '../state/playerState';
import {
  buildWiredSciFiGothicPortal,
  buildQuartzPlasmaColumn,
  buildFloorElectricCircuitSparks,
  buildAudioReactiveBubblesAndParticles,
  buildVRExplorerScaleFigure,
  createArchitecturalWallTexture,
  createCosmicFloorTexture,
  createDoorLeafTexture,
  createSignageTexture,
  getWorldNodes,
  SpatialInteractiveTarget,
  WorldGraphNode,
} from '../corridor/corridorBuilder';
import {
  createRoomPaintingFallbackTexture,
  getRoomV1Manifest,
} from './roomStreamer';

export type RoomShapeArchetype =
  | 'octagonal_sanctuary'
  | 'rotunda_colonnade'
  | 'hexagonal_crystal_vault'
  | 'dodecagonal_astrolabe'
  | 'cruciform_cathedral'
  | 'apsidal_sanctum'
  | 'monolithic_gallery'
  | 'floating_nexus_island'
  | 'hypostyle_atrium'
  | 'celestial_observatory';

export type CentralMachineryArchetype =
  | 'armillary_gyroscope'
  | 'tesseract_hypercube'
  | 'crystal_resonance_spire'
  | 'tokamak_quantum_reactor'
  | 'astronomical_tellurion'
  | 'prismatic_light_altar'
  | 'gravitational_anomaly_cradle'
  | 'chrono_harmonic_matrix'
  | 'vortex_quantum_dynamo'
  | 'astral_meridian_astrolabe'
  | 'quantum_lattice_weaver'
  | 'solenoid_flux_accelerator';

export type ColonnadeStyle =
  | 'radial_peristyle'
  | 'flanking_avenue'
  | 'corner_pylons'
  | 'portal_sentinels'
  | 'floating_obelisks'
  | 'monolithic_pilasters'
  | 'starlit_braziers'
  | 'perimeter_arcades';

export type FloorMotif =
  | 'concentric_fractal_rings'
  | 'sacred_circuitry'
  | 'celestial_astrolabe'
  | 'sunken_reflection_pool'
  | 'stepped_ritual_podium'
  | 'hexagonal_energy_matrix'
  | 'sacred_flower_of_life'
  | 'labyrinthine_spiral';

export type WallFinishStyle =
  | 'basalt_slate_grooves'
  | 'obsidian_gold_filigree'
  | 'titanium_plasma_circuit'
  | 'celestial_runic_frieze'
  | 'faceted_quartz_mosaic'
  | 'deep_void_monolith'
  | 'brass_clockwork_relief'
  | 'stellar_nebula_inlay';

export type CorniceStyle =
  | 'torus_astrolabe_ring'
  | 'stepped_octagonal_frieze'
  | 'hexagonal_crystal_crown'
  | 'dodecagonal_zodiac_cornice'
  | 'fluted_basalt_molding'
  | 'dentil_gilded_cornice'
  | 'sculpted_arcade_rim'
  | 'floating_energy_halo';

export type PlinthStyle =
  | 'octagonal_stepped_dais'
  | 'circular_sunken_basin'
  | 'hexagonal_runic_pedestal'
  | 'floating_magnetic_slab'
  | 'tiered_quad_platform'
  | 'pillar_supported_altar'
  | 'star_shaped_plinth'
  | 'bronze_bracketed_dais';

export interface ProceduralRoomConfig {
  roomId: string;
  roomIndex: number;
  permutedIndex: number;
  shape: RoomShapeArchetype;
  machinery: CentralMachineryArchetype;
  colonnade: ColonnadeStyle;
  floorMotif: FloorMotif;
  wallFinish: WallFinishStyle;
  cornice: CorniceStyle;
  plinth: PlinthStyle;
  width: number;
  depth: number;
  height: number;
  accentHex: string;
  plasmaHex: string;
  rimHex: string;
  stoneHex: string;
  wallSegments: number;
  columnCount: number;
  machineryScale: number;
  rotSpeed: number;
}

/**
 * Extracts a normalized 0..1148 room index from any roomId.
 */
export function getRoomIndex(roomId: string): number {
  const match = roomId.match(/ROOM_(\d+)/i);
  if (match) {
    return parseInt(match[1], 10) % 1149;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < roomId.length; i++) {
    h = Math.imul(h ^ roomId.charCodeAt(i), 0x01000193);
  }
  return Math.abs(h) % 1149;
}

/**
 * Bijective coprime permutation over 0..1148 (gcd(677, 1149) = 1).
 * Every integer in [0, 1148] maps to a strictly unique value in [0, 1148] with ZERO collisions.
 * Guarantees that across all 1149 rooms in the Neuromicon Artmaze, no two rooms share the same configuration.
 */
export function getPermutedRoomIndex(roomIndex: number): number {
  return (roomIndex * 677 + 293) % 1149;
}

/**
 * Deterministic pseudo-random number generator seeded by integer seed.
 */
export function createDeterministicRng(seed: number): () => number {
  let s = (seed >>> 0) || 12345;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES: RoomShapeArchetype[] = [
  'octagonal_sanctuary',
  'rotunda_colonnade',
  'hexagonal_crystal_vault',
  'dodecagonal_astrolabe',
  'cruciform_cathedral',
  'apsidal_sanctum',
  'monolithic_gallery',
  'floating_nexus_island',
  'hypostyle_atrium',
  'celestial_observatory',
];

const MACHINERIES: CentralMachineryArchetype[] = [
  'armillary_gyroscope',
  'tesseract_hypercube',
  'crystal_resonance_spire',
  'tokamak_quantum_reactor',
  'astronomical_tellurion',
  'prismatic_light_altar',
  'gravitational_anomaly_cradle',
  'chrono_harmonic_matrix',
  'vortex_quantum_dynamo',
  'astral_meridian_astrolabe',
  'quantum_lattice_weaver',
  'solenoid_flux_accelerator',
];

const COLONNADES: ColonnadeStyle[] = [
  'radial_peristyle',
  'flanking_avenue',
  'corner_pylons',
  'portal_sentinels',
  'floating_obelisks',
  'monolithic_pilasters',
  'starlit_braziers',
  'perimeter_arcades',
];

const FLOOR_MOTIFS: FloorMotif[] = [
  'concentric_fractal_rings',
  'sacred_circuitry',
  'celestial_astrolabe',
  'sunken_reflection_pool',
  'stepped_ritual_podium',
  'hexagonal_energy_matrix',
  'sacred_flower_of_life',
  'labyrinthine_spiral',
];

const WALL_FINISHES: WallFinishStyle[] = [
  'basalt_slate_grooves',
  'obsidian_gold_filigree',
  'titanium_plasma_circuit',
  'celestial_runic_frieze',
  'faceted_quartz_mosaic',
  'deep_void_monolith',
  'brass_clockwork_relief',
  'stellar_nebula_inlay',
];

const CORNICES: CorniceStyle[] = [
  'torus_astrolabe_ring',
  'stepped_octagonal_frieze',
  'hexagonal_crystal_crown',
  'dodecagonal_zodiac_cornice',
  'fluted_basalt_molding',
  'dentil_gilded_cornice',
  'sculpted_arcade_rim',
  'floating_energy_halo',
];

const PLINTHS: PlinthStyle[] = [
  'octagonal_stepped_dais',
  'circular_sunken_basin',
  'hexagonal_runic_pedestal',
  'floating_magnetic_slab',
  'tiered_quad_platform',
  'pillar_supported_altar',
  'star_shaped_plinth',
  'bronze_bracketed_dais',
];

/**
 * Derives a completely unique procedural room configuration.
 * Guaranteed collision-free across 1149 rooms.
 */
export function deriveProceduralRoomConfig(
  roomId: string,
  palette: string[],
  tone: 'warm' | 'cool'
): ProceduralRoomConfig {
  const roomIndex = getRoomIndex(roomId);
  const permutedIndex = getPermutedRoomIndex(roomIndex);
  const rng = createDeterministicRng(permutedIndex * 31 + 17);

  // Bijective mixed-radix coordinate decomposition (Cartesian space = 10 * 12 * 8 * 8 = 7,680 > 1149):
  // Guarantees strictly ZERO collisions and ZERO duplicate combinations across all 1149 rooms!
  const shapeIdx = permutedIndex % SHAPES.length;
  const k1 = Math.floor(permutedIndex / SHAPES.length);
  const machineryIdx = k1 % MACHINERIES.length;
  const k2 = Math.floor(k1 / MACHINERIES.length);
  const colonnadeIdx = k2 % COLONNADES.length;
  const k3 = Math.floor(k2 / COLONNADES.length);
  const floorMotifIdx = k3 % FLOOR_MOTIFS.length;

  const shape = SHAPES[shapeIdx];
  const machinery = MACHINERIES[machineryIdx];
  const colonnade = COLONNADES[colonnadeIdx];
  const floorMotif = FLOOR_MOTIFS[floorMotifIdx];
  const wallFinish = WALL_FINISHES[(permutedIndex * 7 + 5) % WALL_FINISHES.length];
  const cornice = CORNICES[(permutedIndex * 11 + 3) % CORNICES.length];
  const plinth = PLINTHS[(permutedIndex * 13 + 7) % PLINTHS.length];

  // Procedural spatial dimensions (width 16.5m–25m, depth 16.5m–26.5m, height 7.4m–10.6m)
  const width = Number((16.5 + rng() * 8.5).toFixed(1));
  const depth = Number((16.5 + rng() * 9.5).toFixed(1));
  const height = Number((7.4 + rng() * 3.2).toFixed(1));

  const [c0, c1, c2] = palette;
  const accentHex = c0 ?? (tone === 'warm' ? '#e5c158' : '#4ea8de');
  const plasmaHex = c1 ?? (tone === 'warm' ? '#9d4edd' : '#00b4d8');
  const rimHex = c2 ?? accentHex;
  const stoneHex = '#0b0f1a';

  const wallSegments =
    shape === 'rotunda_colonnade' || shape === 'celestial_observatory'
      ? 24
      : shape === 'dodecagonal_astrolabe'
      ? 12
      : shape === 'octagonal_sanctuary'
      ? 8
      : shape === 'hexagonal_crystal_vault'
      ? 6
      : 4;

  const columnCount = [6, 8, 10, 12][Math.floor(rng() * 4)];
  const machineryScale = Number((0.9 + rng() * 0.45).toFixed(2));
  const rotSpeed = Number((0.035 + rng() * 0.045).toFixed(3));

  return {
    roomId,
    roomIndex,
    permutedIndex,
    shape,
    machinery,
    colonnade,
    floorMotif,
    wallFinish,
    cornice,
    plinth,
    width,
    depth,
    height,
    accentHex,
    plasmaHex,
    rimHex,
    stoneHex,
    wallSegments,
    columnCount,
    machineryScale,
    rotSpeed,
  };
}

/**
 * Builds the central kinetic or cosmological machinery ("внутреннее устройство").
 * Motion is calm, serene, and comfortable in VR (rotations around 0.03 - 0.08 rad/s).
 */
function buildCentralMachinery(
  config: ProceduralRoomConfig,
  stoneMat: THREE.Material,
  trimMat: THREE.Material,
  luminaireMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'room_central_machinery';
  group.position.set(0, 0, 0);

  const { machinery, machineryScale, accentHex, plasmaHex, rimHex, plinth } = config;

  // 1. Plinth / Dais ("постамент внутреннего устройства")
  const plinthGroup = new THREE.Group();
  plinthGroup.name = 'machinery_plinth';

  if (plinth === 'octagonal_stepped_dais') {
    const step1 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1 * machineryScale, 2.3 * machineryScale, 0.22, 8),
      stoneMat
    );
    step1.position.y = 0.11;
    plinthGroup.add(step1);

    const step2 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6 * machineryScale, 1.8 * machineryScale, 0.22, 8),
      stoneMat
    );
    step2.position.y = 0.33;
    plinthGroup.add(step2);

    const goldRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.62 * machineryScale, 0.035, 8, 24),
      trimMat
    );
    goldRim.rotation.x = Math.PI * 0.5;
    goldRim.position.y = 0.44;
    plinthGroup.add(goldRim);
  } else if (plinth === 'hexagonal_runic_pedestal') {
    const hexBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8 * machineryScale, 2.0 * machineryScale, 0.42, 6),
      stoneMat
    );
    hexBase.position.y = 0.21;
    plinthGroup.add(hexBase);

    const hexRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.75 * machineryScale, 0.04, 6, 24),
      trimMat
    );
    hexRing.rotation.x = Math.PI * 0.5;
    hexRing.position.y = 0.42;
    plinthGroup.add(hexRing);
  } else if (plinth === 'floating_magnetic_slab') {
    const basePylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7 * machineryScale, 0.9 * machineryScale, 0.3, 16),
      stoneMat
    );
    basePylon.position.y = 0.15;
    plinthGroup.add(basePylon);

    const slab = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7 * machineryScale, 1.7 * machineryScale, 0.16, 24),
      trimMat
    );
    slab.position.y = 0.42;
    plinthGroup.add(slab);
  } else {
    // Circular / Tiered dais default
    const circBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8 * machineryScale, 2.1 * machineryScale, 0.4, 32),
      stoneMat
    );
    circBase.position.y = 0.2;
    plinthGroup.add(circBase);

    const lumRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.75 * machineryScale, 0.035, 10, 36),
      luminaireMat
    );
    lumRing.rotation.x = Math.PI * 0.5;
    lumRing.position.y = 0.4;
    plinthGroup.add(lumRing);
  }
  group.add(plinthGroup);

  // 2. Specific Kinetic Machinery Mechanism ("кинетический механизм внутреннего устройства")
  if (machinery === 'armillary_gyroscope') {
    const gyroGroup = new THREE.Group();
    gyroGroup.name = 'kinetic_gyro_assembly';
    gyroGroup.position.set(0, 2.2 * machineryScale, 0);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.4 * machineryScale, 0.05, 12, 48),
      trimMat
    );
    outerRing.name = 'gyro_outer_ring';
    gyroGroup.add(outerRing);

    const midRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 * machineryScale, 0.04, 12, 40),
      trimMat
    );
    midRing.name = 'gyro_mid_ring';
    midRing.rotation.x = Math.PI * 0.35;
    gyroGroup.add(midRing);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8 * machineryScale, 0.035, 10, 32),
      trimMat
    );
    innerRing.name = 'gyro_inner_ring';
    innerRing.rotation.y = Math.PI * 0.25;
    gyroGroup.add(innerRing);

    const coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.38 * machineryScale, 20, 16),
      new THREE.MeshStandardMaterial({
        color: plasmaHex,
        emissive: accentHex,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
      })
    );
    coreSphere.name = 'gyro_plasma_core';
    gyroGroup.add(coreSphere);
    group.add(gyroGroup);
  } else if (machinery === 'tesseract_hypercube') {
    const cubeGroup = new THREE.Group();
    cubeGroup.name = 'kinetic_hypercube_assembly';
    cubeGroup.position.set(0, 2.2 * machineryScale, 0);

    const outerBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.5 * machineryScale, 1.5 * machineryScale, 1.5 * machineryScale),
      new THREE.MeshStandardMaterial({
        color: '#080c14',
        emissive: plasmaHex,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.9,
        wireframe: true,
      })
    );
    outerBox.name = 'hypercube_outer';
    cubeGroup.add(outerBox);

    const innerCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7 * machineryScale, 0),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: rimHex,
        emissiveIntensity: 0.7,
        roughness: 0.15,
        metalness: 0.85,
      })
    );
    innerCore.name = 'hypercube_inner';
    cubeGroup.add(innerCore);
    group.add(cubeGroup);
  } else if (machinery === 'crystal_resonance_spire') {
    const spireGroup = new THREE.Group();
    spireGroup.name = 'kinetic_spire_assembly';
    spireGroup.position.set(0, 0.45, 0);

    const mainCrystal = new THREE.Mesh(
      new THREE.ConeGeometry(0.55 * machineryScale, 2.8 * machineryScale, 6),
      new THREE.MeshStandardMaterial({
        color: plasmaHex,
        emissive: accentHex,
        emissiveIntensity: 0.5,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.9,
      })
    );
    mainCrystal.position.y = 1.4 * machineryScale;
    spireGroup.add(mainCrystal);

    const satGroup = new THREE.Group();
    satGroup.name = 'crystal_satellites';
    satGroup.position.set(0, 1.8 * machineryScale, 0);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const dist = 1.35 * machineryScale;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.19 * machineryScale, 0),
        trimMat
      );
      shard.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      satGroup.add(shard);
    }
    spireGroup.add(satGroup);
    group.add(spireGroup);
  } else if (machinery === 'tokamak_quantum_reactor') {
    const tokamakGroup = new THREE.Group();
    tokamakGroup.name = 'kinetic_tokamak_assembly';
    tokamakGroup.position.set(0, 1.9 * machineryScale, 0);

    const torusMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.25 * machineryScale, 0.28 * machineryScale, 14, 40),
      new THREE.MeshStandardMaterial({
        color: '#0e1424',
        emissive: plasmaHex,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.85,
      })
    );
    torusMesh.rotation.x = Math.PI * 0.5;
    tokamakGroup.add(torusMesh);

    const coilRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.35 * machineryScale, 0.05, 10, 36),
      trimMat
    );
    coilRing.name = 'tokamak_coil';
    coilRing.rotation.x = Math.PI * 0.5;
    tokamakGroup.add(coilRing);

    const centralSingularity = new THREE.Mesh(
      new THREE.SphereGeometry(0.42 * machineryScale, 18, 14),
      new THREE.MeshBasicMaterial({ color: accentHex })
    );
    centralSingularity.name = 'tokamak_singularity';
    tokamakGroup.add(centralSingularity);
    group.add(tokamakGroup);
  } else if (machinery === 'astronomical_tellurion') {
    const tellurionGroup = new THREE.Group();
    tellurionGroup.name = 'kinetic_tellurion_assembly';
    tellurionGroup.position.set(0, 1.9 * machineryScale, 0);

    const dialRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85 * machineryScale, 1.4 * machineryScale, 36),
      trimMat
    );
    dialRing.rotation.x = -Math.PI * 0.5;
    tellurionGroup.add(dialRing);

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.38 * machineryScale, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffe58f' })
    );
    tellurionGroup.add(sunOrb);

    const orbitGroup = new THREE.Group();
    orbitGroup.name = 'tellurion_orbit';
    const planetOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * machineryScale, 14, 10),
      new THREE.MeshStandardMaterial({
        color: plasmaHex,
        emissive: accentHex,
        emissiveIntensity: 0.5,
      })
    );
    planetOrb.position.set(1.15 * machineryScale, 0, 0);
    orbitGroup.add(planetOrb);
    tellurionGroup.add(orbitGroup);
    group.add(tellurionGroup);
  } else if (machinery === 'gravitational_anomaly_cradle') {
    const gravGroup = new THREE.Group();
    gravGroup.name = 'kinetic_grav_assembly';
    gravGroup.position.set(0, 2.1 * machineryScale, 0);

    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(1.3 * machineryScale, 0.045, 12, 40),
      trimMat
    );
    ringA.name = 'grav_ring_a';
    gravGroup.add(ringA);

    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(1.05 * machineryScale, 0.04, 12, 36),
      trimMat
    );
    ringB.name = 'grav_ring_b';
    ringB.rotation.x = Math.PI * 0.5;
    gravGroup.add(ringB);

    const shardGroup = new THREE.Group();
    shardGroup.name = 'grav_shards';
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const sh = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.22 * machineryScale, 0),
        new THREE.MeshStandardMaterial({
          color: plasmaHex,
          emissive: accentHex,
          emissiveIntensity: 0.6,
          metalness: 0.8,
        })
      );
      sh.position.set(Math.cos(angle) * 0.55 * machineryScale, 0, Math.sin(angle) * 0.55 * machineryScale);
      shardGroup.add(sh);
    }
    gravGroup.add(shardGroup);
    group.add(gravGroup);
  } else if (machinery === 'chrono_harmonic_matrix') {
    const chronoGroup = new THREE.Group();
    chronoGroup.name = 'kinetic_chrono_assembly';
    chronoGroup.position.set(0, 2.0 * machineryScale, 0);

    const pendRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.2 * machineryScale, 0.045, 10, 36),
      trimMat
    );
    pendRing.name = 'chrono_pend_ring';
    pendRing.rotation.x = Math.PI * 0.5;
    chronoGroup.add(pendRing);

    const bob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * machineryScale, 0.3 * machineryScale, 1.2 * machineryScale, 8),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: rimHex,
        emissiveIntensity: 0.45,
      })
    );
    bob.name = 'chrono_bob';
    chronoGroup.add(bob);
    group.add(chronoGroup);
  } else if (machinery === 'vortex_quantum_dynamo') {
    const vortexGroup = new THREE.Group();
    vortexGroup.name = 'kinetic_vortex_assembly';
    vortexGroup.position.set(0, 1.9 * machineryScale, 0);

    const spiralA = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 * machineryScale, 0.06, 8, 32, Math.PI * 1.5),
      trimMat
    );
    spiralA.name = 'vortex_spiral_a';
    vortexGroup.add(spiralA);

    const spiralB = new THREE.Mesh(
      new THREE.TorusGeometry(0.75 * machineryScale, 0.05, 8, 32, Math.PI * 1.5),
      new THREE.MeshStandardMaterial({
        color: plasmaHex,
        emissive: accentHex,
        emissiveIntensity: 0.6,
      })
    );
    spiralB.name = 'vortex_spiral_b';
    spiralB.rotation.z = Math.PI;
    vortexGroup.add(spiralB);
    group.add(vortexGroup);
  } else if (machinery === 'astral_meridian_astrolabe') {
    const astrolabeGroup = new THREE.Group();
    astrolabeGroup.name = 'kinetic_astrolabe_assembly';
    astrolabeGroup.position.set(0, 2.1 * machineryScale, 0);

    const eqRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.35 * machineryScale, 0.04, 12, 48),
      trimMat
    );
    eqRing.name = 'astrolabe_eq_ring';
    eqRing.rotation.x = Math.PI * 0.5;
    astrolabeGroup.add(eqRing);

    const eclipticRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.2 * machineryScale, 0.035, 10, 40),
      trimMat
    );
    eclipticRing.name = 'astrolabe_ecliptic_ring';
    eclipticRing.rotation.x = Math.PI * 0.38;
    astrolabeGroup.add(eclipticRing);

    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.08 * machineryScale, 1.5 * machineryScale, 6),
      luminaireMat
    );
    pointer.name = 'astrolabe_pointer';
    pointer.position.y = 0.5 * machineryScale;
    astrolabeGroup.add(pointer);
    group.add(astrolabeGroup);
  } else if (machinery === 'quantum_lattice_weaver') {
    const latticeGroup = new THREE.Group();
    latticeGroup.name = 'kinetic_lattice_assembly';
    latticeGroup.position.set(0, 2.1 * machineryScale, 0);

    const icoWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15 * machineryScale, 1),
      new THREE.MeshStandardMaterial({
        color: plasmaHex,
        emissive: accentHex,
        emissiveIntensity: 0.4,
        wireframe: true,
      })
    );
    icoWire.name = 'lattice_wire';
    latticeGroup.add(icoWire);

    const innerIco = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55 * machineryScale, 0),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: rimHex,
        emissiveIntensity: 0.7,
      })
    );
    innerIco.name = 'lattice_inner';
    latticeGroup.add(innerIco);
    group.add(latticeGroup);
  } else if (machinery === 'solenoid_flux_accelerator') {
    const solGroup = new THREE.Group();
    solGroup.name = 'kinetic_solenoid_assembly';
    solGroup.position.set(0, 1.9 * machineryScale, 0);

    const coilStack = new THREE.Group();
    coilStack.name = 'solenoid_coils';
    for (let c = 0; c < 5; c++) {
      const cRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.85 * machineryScale, 0.04, 10, 32),
        trimMat
      );
      cRing.rotation.x = Math.PI * 0.5;
      cRing.position.y = (c - 2) * 0.35 * machineryScale;
      coilStack.add(cRing);
    }
    solGroup.add(coilStack);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * machineryScale, 0.12 * machineryScale, 1.8 * machineryScale, 12),
      new THREE.MeshBasicMaterial({ color: plasmaHex })
    );
    beam.name = 'solenoid_beam';
    solGroup.add(beam);
    group.add(solGroup);
  } else {
    // Prismatic Light Altar default
    const altarGroup = new THREE.Group();
    altarGroup.name = 'kinetic_altar_assembly';
    altarGroup.position.set(0, 0.45, 0);

    const prism = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35 * machineryScale, 0.8 * machineryScale, 1.8 * machineryScale, 8),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: rimHex,
        emissiveIntensity: 0.5,
        roughness: 0.12,
        metalness: 0.88,
      })
    );
    prism.position.y = 0.9 * machineryScale;
    prism.name = 'altar_prism';
    altarGroup.add(prism);

    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.2 * machineryScale, 0.04, 12, 36),
      trimMat
    );
    haloRing.rotation.x = Math.PI * 0.5;
    haloRing.position.y = 1.3 * machineryScale;
    haloRing.name = 'altar_halo';
    altarGroup.add(haloRing);
    group.add(altarGroup);
  }

  return group;
}

/**
 * Builds the complete procedural room architecture for any roomId.
 * Guarantees zero duplicates across 1149 rooms.
 */
export function buildProceduralRoom(opts: {
  roomId: string;
  root: THREE.Group;
  scene: THREE.Scene;
  state: HubPlayerState;
  manifest: RoomV1Manifest;
  palette: string[];
  tone: 'warm' | 'cool';
  walkableMeshes: THREE.Object3D[];
  registerTarget: (mesh: THREE.Object3D, target: SpatialInteractiveTarget) => void;
  mountGeneration: number;
}): { config: ProceduralRoomConfig; update: (dt: number) => void } {
  const {
    roomId,
    root,
    state,
    manifest,
    palette,
    tone,
    walkableMeshes,
    registerTarget,
    mountGeneration,
  } = opts;

  const config = deriveProceduralRoomConfig(roomId, palette, tone);
  const { width, depth, height, accentHex, plasmaHex, rimHex, stoneHex } = config;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;

  // 1. Procedural Architectural Textures & Materials
  const floorTex = createCosmicFloorTexture(
    tone === 'warm' ? 'rgba(229, 193, 88, 0.28)' : 'rgba(78, 168, 222, 0.28)',
    4,
    4
  );
  const wallTex = createArchitecturalWallTexture(
    '#060912',
    accentHex,
    plasmaHex,
    config.shape === 'rotunda_colonnade' ? 8 : 4,
    1
  );
  const doorLeafTex = createDoorLeafTexture(
    '#070b16',
    accentHex,
    plasmaHex
  );

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.16,
    metalness: 0.58,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.48,
    metalness: 0.28,
  });
  const stoneTrimMat = new THREE.MeshStandardMaterial({
    color: stoneHex,
    roughness: 0.4,
    metalness: 0.32,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.2,
    metalness: 0.85,
    emissive: rimHex,
    emissiveIntensity: 0.28,
  });
  const doorLeafMat = new THREE.MeshStandardMaterial({
    map: doorLeafTex,
    roughness: 0.22,
    metalness: 0.72,
    emissive: accentHex,
    emissiveIntensity: 0.16,
  });
  const warmLuminaireMat = new THREE.MeshBasicMaterial({
    color: '#ffe8a3',
  });

  // 2. Procedural Walkable Floor matching the room shape archetype
  let floorMesh: THREE.Mesh;
  if (config.shape === 'rotunda_colonnade' || config.shape === 'celestial_observatory') {
    floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW, 0.2, 32),
      floorMat
    );
    floorMesh.position.y = -0.1;
  } else if (config.shape === 'octagonal_sanctuary') {
    floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW * 1.05, 0.2, 8),
      floorMat
    );
    floorMesh.position.y = -0.1;
  } else if (config.shape === 'hexagonal_crystal_vault') {
    floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW * 1.05, 0.2, 6),
      floorMat
    );
    floorMesh.position.y = -0.1;
  } else if (config.shape === 'dodecagonal_astrolabe') {
    floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW * 1.05, 0.2, 12),
      floorMat
    );
    floorMesh.position.y = -0.1;
  } else {
    floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      floorMat
    );
    floorMesh.rotation.x = -Math.PI * 0.5;
  }
  root.add(floorMesh);
  walkableMeshes.push(floorMesh);

  // Travelling sparks calibrated to procedural floor bounds
  buildFloorElectricCircuitSparks({
    root,
    maxRadius: Math.min(halfW, halfD) - 0.6,
    primaryHex: plasmaHex,
    secondaryHex: '#4ea8de',
    goldHex: '#e5c158',
  });

  // 3. Central Floor Medallion reflecting the floor motif
  const medallionRadius = Math.min(2.8, Math.min(halfW, halfD) * 0.35);
  const medallion = new THREE.Mesh(
    new THREE.RingGeometry(medallionRadius * 0.45, medallionRadius, 40),
    new THREE.MeshStandardMaterial({
      color: plasmaHex,
      roughness: 0.14,
      metalness: 0.86,
      emissive: accentHex,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
    })
  );
  medallion.rotation.x = -Math.PI * 0.5;
  medallion.position.set(0, 0.015, 0);
  root.add(medallion);

  // 4. Procedural Perimeter Walls (framing the open sky above)
  if (config.shape === 'rotunda_colonnade' || config.shape === 'celestial_observatory') {
    const rotundaWall = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW, height, 32, 1, true),
      wallMat
    );
    rotundaWall.position.set(0, height * 0.5, 0);
    rotundaWall.material.side = THREE.BackSide;
    root.add(rotundaWall);
  } else if (config.shape === 'octagonal_sanctuary') {
    const octWall = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW, height, 8, 1, true),
      wallMat
    );
    octWall.position.set(0, height * 0.5, 0);
    octWall.material.side = THREE.BackSide;
    root.add(octWall);
  } else if (config.shape === 'hexagonal_crystal_vault') {
    const hexWall = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW, height, 6, 1, true),
      wallMat
    );
    hexWall.position.set(0, height * 0.5, 0);
    hexWall.material.side = THREE.BackSide;
    root.add(hexWall);
  } else if (config.shape === 'dodecagonal_astrolabe') {
    const dodecWall = new THREE.Mesh(
      new THREE.CylinderGeometry(halfW, halfW, height, 12, 1, true),
      wallMat
    );
    dodecWall.position.set(0, height * 0.5, 0);
    dodecWall.material.side = THREE.BackSide;
    root.add(dodecWall);
  } else {
    // 4 Rectangular / Monolithic Walls
    const nWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    nWall.position.set(0, height * 0.5, -halfD);
    root.add(nWall);

    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    sWall.rotation.y = Math.PI;
    sWall.position.set(0, height * 0.5, halfD);
    root.add(sWall);

    const wWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    wWall.rotation.y = Math.PI * 0.5;
    wWall.position.set(-halfW, height * 0.5, 0);
    root.add(wWall);

    const eWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), wallMat);
    eWall.rotation.y = -Math.PI * 0.5;
    eWall.position.set(halfW, height * 0.5, 0);
    root.add(eWall);
  }

  // 5. Architectural Upper Cornice Framing the Open Sky
  // ZERO overhead beams or ribs across the zenith: the nebula and starfield are 100% visible!
  const corniceGroup = new THREE.Group();
  corniceGroup.name = 'sky_framing_cornice';
  const corniceRadius = Math.min(halfW, halfD) * 0.98;
  const corniceSegments =
    config.shape === 'octagonal_sanctuary'
      ? 8
      : config.shape === 'hexagonal_crystal_vault'
      ? 6
      : config.shape === 'dodecagonal_astrolabe'
      ? 12
      : 48;

  const corniceRing = new THREE.Mesh(
    new THREE.TorusGeometry(corniceRadius, 0.22, 10, corniceSegments),
    stoneTrimMat
  );
  corniceRing.rotation.x = Math.PI * 0.5;
  corniceRing.position.y = height - 0.12;
  corniceGroup.add(corniceRing);

  const corniceTrim = new THREE.Mesh(
    new THREE.TorusGeometry(corniceRadius * 0.98, 0.08, 10, corniceSegments),
    trimMat
  );
  corniceTrim.rotation.x = Math.PI * 0.5;
  corniceTrim.position.y = height - 0.05;
  corniceGroup.add(corniceTrim);
  root.add(corniceGroup);

  // 6. Central Kinetic Machinery Apparatus ("внутреннее устройство")
  const centralMachineryGroup = buildCentralMachinery(
    config,
    stoneTrimMat,
    trimMat,
    warmLuminaireMat
  );
  root.add(centralMachineryGroup);

  // 7. Procedural Colonnades & Pillars
  const colRadius = Math.min(halfW, halfD) * 0.72;
  const colCount = config.columnCount;
  for (let i = 0; i < colCount; i++) {
    const angle = (i / colCount) * Math.PI * 2;
    const deg = (angle * 180) / Math.PI;
    // Don't block direct sightlines to North portals (270 deg) or East mirror (0 deg)
    if (Math.abs(deg - 270) < 22 || Math.abs(deg - 90) < 22) continue;

    const cx = Math.cos(angle) * colRadius;
    const cz = Math.sin(angle) * colRadius;

    const col = buildQuartzPlasmaColumn({
      x: cx,
      z: cz,
      height: height - 0.2,
      radius: 0.32,
      primaryHex: plasmaHex,
      secondaryHex: accentHex,
      goldHex: '#e5c158',
      basaltMat: stoneTrimMat,
      trimMat,
      phaseSeed: i * 1.618 + 0.3,
    });
    root.add(col);
  }

  // 8. Scale Figure of a Player in VR Headset anchoring the monumental space
  root.add(
    buildVRExplorerScaleFigure({
      x: -halfW * 0.52,
      z: 2.2,
      rotY: 0.35,
      visorHex: accentHex,
      trimHex: plasmaHex,
    })
  );

  // 9. Calm, Low-Altitude Audio-Reactive Bubbles & Soft Particles
  // Kept low (0.8m to 2.5m) so they NEVER obstruct the view of the open astronomical sky
  buildAudioReactiveBubblesAndParticles({
    root,
    radiusX: halfW - 1.4,
    radiusZ: halfD - 1.4,
    minY: 0.8,
    maxY: 2.5,
    bubbleCount: 12,
    particleCount: 180,
  });

  // 10. Monumental 1:1 Framed Painting on West Sanctuary Wall
  if (manifest.artwork) {
    const artGroup = new THREE.Group();
    artGroup.position.set(-halfW + 0.14, 0, -0.2);
    artGroup.rotation.y = Math.PI * 0.5;

    const plinthMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.38, 0.58),
      stoneTrimMat
    );
    plinthMesh.position.set(0, 0.19, 0.18);
    artGroup.add(plinthMesh);

    const outerFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.56, 3.56, 0.16),
      trimMat
    );
    outerFrame.position.set(0, 2.55, 0.08);
    artGroup.add(outerFrame);

    const galleryLightHood = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.1, 0.32),
      trimMat
    );
    galleryLightHood.position.set(0, 4.44, 0.26);
    artGroup.add(galleryLightHood);

    const galleryLightTube = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.06, 0.14),
      warmLuminaireMat
    );
    galleryLightTube.position.set(0, 4.38, 0.3);
    artGroup.add(galleryLightTube);

    const fallbackTex = createRoomPaintingFallbackTexture(
      manifest.identity.symbol,
      manifest.identity.name,
      manifest.artwork.sector ?? manifest.identity.dimension,
      accentHex
    );
    const paintingMat = new THREE.MeshBasicMaterial({
      map: fallbackTex,
      side: THREE.DoubleSide,
    });

    if (manifest.artwork.imageUrl && typeof document !== 'undefined') {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      const rawFileName =
        manifest.artwork.imageUrl.split('/').pop()?.split('?')[0] || '';
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const candidates: string[] = [];
      if (rawFileName) {
        candidates.push(`assets/art/${rawFileName}`);
        candidates.push(`${base}/assets/art/${rawFileName}`);
        candidates.push(`/assets/art/${rawFileName}`);
        candidates.push(`./assets/art/${rawFileName}`);
      }
      if (manifest.artwork.imageUrl.startsWith('http')) {
        candidates.push(manifest.artwork.imageUrl);
      }
      if (candidates.length === 0) {
        candidates.push(manifest.artwork.imageUrl);
      }

      let cIdx = 0;
      const tryLoadCandidate = () => {
        if (cIdx >= candidates.length) return;
        const candidateUrl = candidates[cIdx++];
        loader.load(
          candidateUrl,
          (loadedTex) => {
            if (mountGeneration !== opts.mountGeneration) {
              loadedTex.dispose();
              return;
            }
            fallbackTex.dispose();
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.generateMipmaps = true;
            paintingMat.map = loadedTex;
            paintingMat.needsUpdate = true;
          },
          undefined,
          () => {
            tryLoadCandidate();
          }
        );
      };
      tryLoadCandidate();
    }

    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      paintingMat
    );
    canvasMesh.position.set(0, 2.55, 0.17);
    artGroup.add(canvasMesh);

    const artPlaqueTex = createSignageTexture(
      manifest.identity.symbol,
      manifest.identity.name,
      manifest.identity.dimension,
      'PAINTING & ESSAY',
      accentHex,
      '#f0d27a'
    );
    const artPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.88),
      new THREE.MeshBasicMaterial({ map: artPlaqueTex })
    );
    artPlaque.position.set(0, 4.92, 0.16);
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

  // 11. Wired Portals A, B, C + Rabbit Hole (RH)
  const doorPlacements: Record<'A' | 'B' | 'C' | 'RH', { x: number; z: number; rotY: number }> = {
    A: { x: -4.4, z: -halfD + 0.12, rotY: 0 },
    B: { x: 0, z: -halfD + 0.12, rotY: 0 },
    C: { x: 4.4, z: -halfD + 0.12, rotY: 0 },
    RH: { x: -halfW + 0.12, z: -4.8, rotY: Math.PI * 0.5 },
  };

  manifest.doors.forEach((door, doorIdx) => {
    if (door.visibility === 'hidden') {
      if (!door.requirement) return;
      const reqKey = `${manifest.id}:${door.requirement.type}:${door.requirement.target}`;
      if (!state.discoveries.includes(reqKey)) return;
    }

    const destNode = getWorldNodes().find((n: WorldGraphNode) => n.id === door.destination);
    const destManifest = getRoomV1Manifest(door.destination);
    const isPlanned = destNode?.status === 'planned';
    const pose = doorPlacements[door.id] ?? doorPlacements.C;
    const isRH = door.id === 'RH';

    const dMat = isRH
      ? new THREE.MeshStandardMaterial({
          color: '#f0d27a',
          roughness: 0.2,
          metalness: 0.88,
          emissive: '#4a3510',
          emissiveIntensity: 0.5,
        })
      : trimMat;

    const destTitle = destManifest?.identity.name || door.label || door.destination;
    const destDim = destManifest?.identity.dimension || destNode?.dimension || manifest.identity.dimension;

    const plaqueTex = createSignageTexture(
      door.symbol || door.id,
      destTitle,
      destDim,
      door.destination,
      isRH ? '#f0d27a' : accentHex,
      isPlanned ? '#888888' : '#66cc99'
    );

    const dGroup = buildWiredSciFiGothicPortal({
      x: pose.x,
      z: pose.z,
      rotY: pose.rotY,
      width: 2.35,
      height: 3.65,
      frameMat: dMat,
      vortexMat: doorLeafMat,
      accentHex: isRH ? '#f0d27a' : accentHex,
      plasmaHex: plasmaHex,
      statusColorHex: isPlanned ? '#888888' : isRH ? '#f0d27a' : '#66cc99',
      plaqueTex,
      plaqueWidth: 2.15,
      plaqueHeight: 0.78,
      cableSpread: 0.88,
      phaseSeed: doorIdx * 1.45 + 0.5,
    });

    root.add(dGroup);
    registerTarget(dGroup, {
      id: `ROOM_DOOR_${door.id}`,
      kind: 'room-door',
      doorId: door.id,
      roomId: door.destination,
      status: isPlanned ? 'planned' : 'ready',
      title: `${door.symbol || door.id} · ${destTitle}`,
      titleRu: `${door.symbol || door.id} · ${destTitle}`,
      subtitle: `${destDim} · Wired Portal`,
      subtitleRu: `${destDim} · Wired Portal`,
    });
  });

  // 12. Non-Portable Room Objects & Busyboards with procedural internal devices
  const physicalObjects = manifest.objects.filter((o) => !o.onlyInMirror);
  physicalObjects.forEach((obj, idx) => {
    const side = idx % 2 === 0 ? -1 : 1;
    const rowOffset = Math.floor(idx / 2) * 2.4;
    const ox = side * (halfW * 0.45);
    const oz = 1.8 + rowOffset;

    const objGroup = new THREE.Group();
    objGroup.position.set(ox, 0, oz);
    objGroup.rotation.y = side < 0 ? Math.PI * 0.18 : -Math.PI * 0.18;

    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.68, 0.88, 8),
      stoneTrimMat
    );
    ped.position.y = 0.44;
    objGroup.add(ped);

    const pedLightRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.035, 10, 24),
      warmLuminaireMat
    );
    pedLightRing.rotation.x = Math.PI * 0.5;
    pedLightRing.position.y = 0.88;
    objGroup.add(pedLightRing);

    // Procedural internal kinetic apparatus for this object
    if (obj.type === 'busyboard') {
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.46, 0.04, 14, 36),
        trimMat
      );
      ring1.position.y = 1.48;
      objGroup.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.31, 0.035, 14, 32),
        trimMat
      );
      ring2.rotation.y = Math.PI * 0.35;
      ring2.position.y = 1.48;
      objGroup.add(ring2);
    } else {
      const outerCradle = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.035, 12, 32),
        trimMat
      );
      outerCradle.position.y = 1.48;
      objGroup.add(outerCradle);

      const crystalCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26, 0),
        trimMat
      );
      crystalCore.position.y = 1.48;
      objGroup.add(crystalCore);
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
      new THREE.MeshBasicMaterial({ map: oPlaqueTex, side: THREE.DoubleSide })
    );
    oPlaque.position.set(0, 2.32, 0);
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

  // 13. The Mirror System on East Wall
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(halfW - 0.12, 0, -0.5);
  mirrorGroup.rotation.y = -Math.PI * 0.5;

  const mBase = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.24, 0.58),
    stoneTrimMat
  );
  mBase.position.set(0, 0.12, 0.2);
  mirrorGroup.add(mBase);

  const mSurround = new THREE.Mesh(
    new THREE.BoxGeometry(3.75, 3.9, 0.16),
    trimMat
  );
  mSurround.position.set(0, 2.05, 0.06);
  mirrorGroup.add(mSurround);

  [-1.8, 1.8].forEach((mx) => {
    const mLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.4, 12),
      warmLuminaireMat
    );
    mLamp.position.set(mx, 2.05, 0.2);
    mirrorGroup.add(mLamp);
  });

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.6),
    new THREE.MeshStandardMaterial({
      color: '#14293e',
      roughness: 0.08,
      metalness: 0.88,
      transparent: true,
      opacity: 0.82,
    })
  );
  glass.position.set(0, 2.05, 0.15);
  mirrorGroup.add(glass);

  const mPlaqueTex = createSignageTexture(
    'MIRROR',
    manifest.mirror.characterState,
    `Identity: ${state.identityChoices[manifest.id]?.toUpperCase() ?? 'UNDECIDED'}`,
    'ACCEPT · REJECT · BACK',
    '#7cc6f2',
    '#f0d27a'
  );
  const mPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.85),
    new THREE.MeshBasicMaterial({ map: mPlaqueTex })
  );
  mPlaque.position.set(0, 4.42, 0.22);
  mirrorGroup.add(mPlaque);

  const choices: Array<{
    choice: 'accept' | 'reject' | 'back';
    label: string;
    x: number;
    color: string;
  }> = [
    { choice: 'accept', label: 'ACCEPT IDENTITY', x: -1.15, color: '#66cc99' },
    { choice: 'reject', label: 'REJECT IDENTITY', x: 0, color: '#ff6b6b' },
    { choice: 'back', label: 'STEP BACK', x: 1.15, color: '#888888' },
  ];

  choices.forEach((c) => {
    const btnMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.36, 0.14),
      new THREE.MeshStandardMaterial({
        color: c.color,
        roughness: 0.25,
        metalness: 0.75,
        emissive: c.color,
        emissiveIntensity: 0.3,
      })
    );
    btnMesh.position.set(c.x, 0.82, 0.3);
    mirrorGroup.add(btnMesh);

    registerTarget(btnMesh, {
      id: `MIRROR_${c.choice}_${manifest.id}`,
      kind: 'room-mirror',
      mirrorChoice: c.choice,
      title: c.label,
      titleRu: c.label,
      subtitle: manifest.mirror.characterState,
      subtitleRu: manifest.mirror.characterState,
    });
  });

  // Ghost Objects that exist ONLY inside the Mirror Reflection
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

  // 14. Return to Corridor Portal on South Wall
  const returnGroup = buildWiredSciFiGothicPortal({
    x: 0,
    z: halfD - 0.12,
    rotY: Math.PI,
    width: 2.4,
    height: 3.7,
    frameMat: trimMat,
    vortexMat: doorLeafMat,
    accentHex,
    plasmaHex,
    statusColorHex: '#4ea8de',
    plaqueTex: createSignageTexture(
      '↺',
      `SECTOR ROOM ${state.segmentIndex}`,
      'EXIT ROOM (STOPS TRACK)',
      'RETURN PORTAL',
      accentHex,
      '#4ea8de'
    ),
    plaqueWidth: 2.15,
    plaqueHeight: 0.78,
    cableSpread: 0.85,
    phaseSeed: 4.2,
  });
  root.add(returnGroup);
  registerTarget(returnGroup, {
    id: `ROOM_SOUTH_EXIT_${manifest.id}`,
    kind: 'room-door',
    roomId: 'CORRIDOR',
    title: `↺ RETURN TO SECTOR ROOM ${state.segmentIndex}`,
    titleRu: `↺ RETURN TO SECTOR ROOM ${state.segmentIndex}`,
    subtitle: 'Leave Room & Stop Track',
    subtitleRu: 'Leave Room & Stop Track',
  });

  // Animated update loop for central machinery (gentle, tranquil, comfortable rotation)
  let animTime = 0;
  const update = (dt: number) => {
    animTime += dt;
    if (centralMachineryGroup) {
      const gyroAssembly = centralMachineryGroup.getObjectByName('kinetic_gyro_assembly');
      if (gyroAssembly) {
        const outer = gyroAssembly.getObjectByName('gyro_outer_ring');
        const mid = gyroAssembly.getObjectByName('gyro_mid_ring');
        const inner = gyroAssembly.getObjectByName('gyro_inner_ring');
        if (outer) outer.rotation.z += 0.04 * dt;
        if (mid) mid.rotation.y += 0.06 * dt;
        if (inner) inner.rotation.x += 0.08 * dt;
      }

      const hypercube = centralMachineryGroup.getObjectByName('kinetic_hypercube_assembly');
      if (hypercube) {
        hypercube.rotation.y += 0.05 * dt;
        hypercube.rotation.x = Math.sin(animTime * 0.25) * 0.08;
      }

      const spire = centralMachineryGroup.getObjectByName('kinetic_spire_assembly');
      if (spire) {
        const sats = spire.getObjectByName('crystal_satellites');
        if (sats) {
          sats.rotation.y += 0.06 * dt;
          sats.position.y = (1.8 + Math.sin(animTime * 0.35) * 0.06) * config.machineryScale;
        }
      }

      const tokamak = centralMachineryGroup.getObjectByName('kinetic_tokamak_assembly');
      if (tokamak) {
        const coil = tokamak.getObjectByName('tokamak_coil');
        if (coil) coil.rotation.z += 0.08 * dt;
      }

      const tellurion = centralMachineryGroup.getObjectByName('kinetic_tellurion_assembly');
      if (tellurion) {
        const orbit = tellurion.getObjectByName('tellurion_orbit');
        if (orbit) orbit.rotation.y += 0.05 * dt;
      }

      const grav = centralMachineryGroup.getObjectByName('kinetic_grav_assembly');
      if (grav) {
        const ringA = grav.getObjectByName('grav_ring_a');
        const ringB = grav.getObjectByName('grav_ring_b');
        const shards = grav.getObjectByName('grav_shards');
        if (ringA) ringA.rotation.z += 0.04 * dt;
        if (ringB) ringB.rotation.y += 0.05 * dt;
        if (shards) {
          shards.rotation.y += 0.03 * dt;
          shards.position.y = Math.sin(animTime * 0.4) * 0.08 * config.machineryScale;
        }
      }

      const chrono = centralMachineryGroup.getObjectByName('kinetic_chrono_assembly');
      if (chrono) {
        const pend = chrono.getObjectByName('chrono_pend_ring');
        const bob = chrono.getObjectByName('chrono_bob');
        if (pend) pend.rotation.z = Math.sin(animTime * 0.6) * 0.12;
        if (bob) bob.rotation.y += 0.05 * dt;
      }

      const vortex = centralMachineryGroup.getObjectByName('kinetic_vortex_assembly');
      if (vortex) {
        const spA = vortex.getObjectByName('vortex_spiral_a');
        const spB = vortex.getObjectByName('vortex_spiral_b');
        if (spA) spA.rotation.y += 0.07 * dt;
        if (spB) spB.rotation.y -= 0.09 * dt;
      }

      const astrolabe = centralMachineryGroup.getObjectByName('kinetic_astrolabe_assembly');
      if (astrolabe) {
        const eq = astrolabe.getObjectByName('astrolabe_eq_ring');
        const ecl = astrolabe.getObjectByName('astrolabe_ecliptic_ring');
        if (eq) eq.rotation.z += 0.03 * dt;
        if (ecl) ecl.rotation.y += 0.05 * dt;
      }

      const lattice = centralMachineryGroup.getObjectByName('kinetic_lattice_assembly');
      if (lattice) {
        const wire = lattice.getObjectByName('lattice_wire');
        const inner = lattice.getObjectByName('lattice_inner');
        if (wire) wire.rotation.y += 0.04 * dt;
        if (inner) inner.rotation.x -= 0.06 * dt;
      }

      const sol = centralMachineryGroup.getObjectByName('kinetic_solenoid_assembly');
      if (sol) {
        const beam = sol.getObjectByName('solenoid_beam');
        if (beam) beam.rotation.y += 0.12 * dt;
      }

      const altar = centralMachineryGroup.getObjectByName('kinetic_altar_assembly');
      if (altar) {
        const prism = altar.getObjectByName('altar_prism');
        const halo = altar.getObjectByName('altar_halo');
        if (prism) prism.rotation.y += 0.04 * dt;
        if (halo) halo.rotation.z -= 0.05 * dt;
      }
    }
  };

  return { config, update };
}
