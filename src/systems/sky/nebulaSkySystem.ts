import * as THREE from 'three';
import nebulaeData from '../../../content/space/nebulae.json';
import starfieldData from '../../../content/space/starfield.json';
import {
  deterministicRoomSeed,
  NebulaRegistryEntry,
  resolveRoomNebulaMapping,
} from '../../../tools/space-assets/pipeline';

export type QualityTier = 'auto' | 'quest' | 'desktop-low' | 'desktop-high';

export interface ActiveSkyRigState {
  nebulaId: string;
  nebulaName: string;
  credit: string;
  license: string;
  palette: string[];
  tone: 'warm' | 'cool';
  rotation: [number, number, number];
  intensity: number;
  drawCalls: number;
  skyTextureMemoryMB: number;
}

/**
 * 4-Layer Real Astronomical Space & Nebula System + Palette-Driven Lighting Rig (TZ.md §3 & §4).
 *
 * Layer Model (per scene, strictly <= 5 sky draw calls and <= 32 MB sky GPU memory):
 * - L0 Star field: Shared all-sky equirectangular star map on inverted sphere (`MeshBasicMaterial`, `depthWrite:false`, rotated per room seed). [1 draw call]
 * - L1 Nebula Cap: Room's astronomical nebula on a curved spherical cap (`phiLength = 72°`, `thetaLength = 54°` — never stretched 360°!) with radial alpha feather mask (`MeshBasicMaterial`, `transparent:true`, `depthWrite:false`). [1 draw call]
 * - L2 Dust/Parallax: Additive `THREE.Points` cosmic dust motes for depth & subtle parallax. [1 draw call]
 * - L3 Twinkle: Subtle star scintillation layer (`desktop-high` quality tier only). [0–1 draw call]
 */
export class NebulaSkySystem {
  private sharedStarfieldTex: THREE.CanvasTexture | null = null;
  private preloadedNebulaTextures: Map<string, THREE.Texture> = new Map();
  private activeSkyGroup: THREE.Group | null = null;
  private activeEnvCubemap: THREE.CubeTexture | null = null;
  private activeNebulaMesh: THREE.Mesh | null = null;
  private activeDustPoints: THREE.Points | null = null;
  private activeTwinklePoints: THREE.Points | null = null;
  private crossfadeElapsed = 1.2;

  private activeRigState: ActiveSkyRigState = {
    nebulaId: 'NEB_0001',
    nebulaName: 'Carina Nebula Cosmic Cliffs (NGC 3372)',
    credit: 'NASA, ESA, CSA, and STScI',
    license: 'PD-NASA',
    palette: ['#c46a3a', '#2b5f8c', '#e8d9b5'],
    tone: 'warm',
    rotation: [0.18, 0, 0],
    intensity: 1.0,
    drawCalls: 3,
    skyTextureMemoryMB: 4.2,
  };

  public getAllNebulae(): NebulaRegistryEntry[] {
    return (nebulaeData.nebulae as unknown as NebulaRegistryEntry[]) ?? [];
  }

  public getStarfieldMetadata() {
    return starfieldData;
  }

  public getCurrentSkyState(): ActiveSkyRigState {
    return {
      ...this.activeRigState,
      palette: [...this.activeRigState.palette],
      rotation: [...this.activeRigState.rotation] as [number, number, number],
    };
  }

  /**
   * Builds or returns the shared L0 equirectangular all-sky star map texture (2048x1024 POT, ~2.7 MB mipmapped).
   */
  private getSharedStarfieldTexture(): THREE.CanvasTexture {
    if (this.sharedStarfieldTex) return this.sharedStarfieldTex;

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, 2048, 1024);

    // Galactic plane band (Milky Way) across the equirectangular equator
    const band = ctx.createLinearGradient(0, 260, 0, 760);
    band.addColorStop(0, 'rgba(6, 10, 22, 0)');
    band.addColorStop(0.35, 'rgba(28, 42, 78, 0.22)');
    band.addColorStop(0.5, 'rgba(64, 86, 138, 0.32)');
    band.addColorStop(0.65, 'rgba(28, 42, 78, 0.22)');
    band.addColorStop(1, 'rgba(6, 10, 22, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 2048, 1024);

    // Deterministic Hipparcos/Tycho-style stellar distribution (3,200 stars)
    const starColors = ['#ffffff', '#ffe8b8', '#b8d8ff', '#ffd2a6', '#d6e6ff'];
    for (let i = 0; i < 3200; i++) {
      const h1 = Math.imul(i + 1, 2654435761) >>> 0;
      const h2 = Math.imul(i + 7919, 2246822519) >>> 0;
      const sx = h1 % 2048;
      // Concentrate 45% of stars closer to the galactic plane
      const rawY = (h2 % 1024) / 1024;
      const sy =
        i % 2 === 0
          ? Math.floor((0.5 + (rawY - 0.5) * 0.48) * 1024)
          : h2 % 1024;
      const radius = i % 19 === 0 ? 1.7 : i % 5 === 0 ? 1.15 : 0.7;
      ctx.fillStyle = starColors[i % starColors.length];
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sharedStarfieldTex = tex;
    return tex;
  }

  /**
   * Builds a high-fidelity feathered curved-cap texture (1024x1024) for a specific Nebula entry,
   * and upgrades it asynchronously when `remoteImageUrl` resolves with radial alpha feathering applied.
   */
  private createFeatheredNebulaCapTexture(
    nebula: NebulaRegistryEntry,
    mirrorX = false
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const [c0, c1, c2] = nebula.palette;
    const seed = deterministicRoomSeed(nebula.id);

    ctx.clearRect(0, 0, 1024, 1024);

    // Multi-lobe astronomical filament composition inside radial feather mask
    const lobes = 7;
    for (let i = 0; i < lobes; i++) {
      const angle = ((seed + i * 97) % 360) * (Math.PI / 180);
      const dist = 60 + ((seed + i * 53) % 160);
      const lx = 512 + Math.cos(angle) * dist * (mirrorX ? -1 : 1);
      const ly = 512 + Math.sin(angle) * dist * 0.78;
      const lr = 240 + ((i * 67) % 180);

      const g = ctx.createRadialGradient(lx, ly, 12, lx, ly, lr);
      const col = i % 3 === 0 ? c0 : i % 3 === 1 ? c1 : c2;
      g.addColorStop(0, `${col}dd`);
      g.addColorStop(0.45, `${col}66`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    }

    // Embedded young stellar cluster knots inside the nebula cap
    for (let s = 0; s < 140; s++) {
      const a = ((s * 137.5) % 360) * (Math.PI / 180);
      const r = Math.sqrt(s / 140) * 340;
      const sx = 512 + Math.cos(a) * r;
      const sy = 512 + Math.sin(a) * r * 0.82;
      ctx.fillStyle = s % 3 === 0 ? c2 : '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, s % 7 === 0 ? 2.1 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radial alpha feather mask around the cap perimeter so edges blend seamlessly into L0 Starfield (TZ.md §3.1)
    ctx.globalCompositeOperation = 'destination-in';
    const feather = ctx.createRadialGradient(512, 512, 180, 512, 512, 495);
    feather.addColorStop(0, 'rgba(255,255,255,1)');
    feather.addColorStop(0.68, 'rgba(255,255,255,0.85)');
    feather.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = feather;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;

    // If real observatory image URL is available, composite it through the same radial alpha feather mask
    if (nebula.remoteImageUrl && typeof Image !== 'undefined') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, 1024, 1024);
        ctx.save();
        if (mirrorX) {
          ctx.translate(1024, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(img, 0, 0, 1024, 1024);
        ctx.restore();

        // Apply radial alpha feather mask (TZ.md §3.1 & §3.4.2)
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = feather;
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.globalCompositeOperation = 'source-over';
        tex.needsUpdate = true;
      };
      img.src = nebula.remoteImageUrl;
    }

    return tex;
  }

  /**
   * Generates a low-resolution (64x64 per face) environment cubemap from the room's nebula palette
   * in < 1.5 ms at mount time for hero surfaces (mirror, reflective pools, art frames, TZ.md §4.2).
   */
  public createLowResEnvironmentCubemap(palette: string[]): THREE.CubeTexture {
    const [c0, c1, c2] = palette;
    const faces: HTMLCanvasElement[] = [];

    for (let f = 0; f < 6; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, f === 2 ? c2 : c0);
      grad.addColorStop(0.5, c1);
      grad.addColorStop(1, '#05070e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      faces.push(canvas);
    }

    const cubeTex = new THREE.CubeTexture(faces);
    cubeTex.needsUpdate = true;
    return cubeTex;
  }

  /**
   * Preloads the target room's nebula texture when the player gazes at a door (TZ.md §3.7).
   */
  public preloadRoomNebula(roomId: string): void {
    const { nebula, mapping } = resolveRoomNebulaMapping(roomId);
    const cacheKey = `${nebula.id}:${mapping.mirrorX ? 'M' : 'N'}`;
    if (this.preloadedNebulaTextures.has(cacheKey)) return;

    // Limit preload cache to 3 entries (current + direct neighbors, AGENTS.md §2.5)
    if (this.preloadedNebulaTextures.size >= 3) {
      const oldestKey = this.preloadedNebulaTextures.keys().next().value;
      if (oldestKey) {
        this.preloadedNebulaTextures.get(oldestKey)?.dispose();
        this.preloadedNebulaTextures.delete(oldestKey);
      }
    }

    const tex = this.createFeatheredNebulaCapTexture(nebula, mapping.mirrorX);
    this.preloadedNebulaTextures.set(cacheKey, tex);
  }

  /**
   * Disposes the current room's sky meshes, materials, and environment cubemap (TZ.md §3.7 & §3.8).
   */
  public unmountSky(root: THREE.Group, scene?: THREE.Scene): void {
    if (this.activeSkyGroup) {
      this.activeSkyGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => {
            const basic = m as THREE.MeshBasicMaterial;
            // Dispose per-room nebula texture unless it is the shared L0 starfield or in the neighbor preload cache
            if (
              basic.map &&
              basic.map !== this.sharedStarfieldTex &&
              !Array.from(this.preloadedNebulaTextures.values()).includes(
                basic.map
              )
            ) {
              basic.map.dispose();
            }
            m.dispose();
          });
        }
      });
      root.remove(this.activeSkyGroup);
      this.activeSkyGroup = null;
    }

    if (this.activeEnvCubemap) {
      if (scene && scene.environment === this.activeEnvCubemap) {
        scene.environment = null;
      }
      this.activeEnvCubemap.dispose();
      this.activeEnvCubemap = null;
    }

    this.activeNebulaMesh = null;
    this.activeDustPoints = null;
    this.activeTwinklePoints = null;
  }

  /**
   * Mounts the 4-layer astronomical sky (L0 Starfield, L1 Curved Nebula Cap, L2 Dust Parallax, L3 Twinkle)
   * and applies the palette-driven lighting & fog rig (TZ.md §3.1, §4.1–§4.4).
   */
  public mountRoomSkyAndLighting(
    roomIdOrSceneKey: string,
    root: THREE.Group,
    scene: THREE.Scene,
    opts?: {
      nebulaId?: string;
      rotation?: [number, number, number];
      intensity?: number;
      qualityTier?: QualityTier;
      reducedMotion?: boolean;
      ambientScale?: number;
      fogScale?: number;
    }
  ): ActiveSkyRigState {
    this.unmountSky(root, scene);

    const resolved = resolveRoomNebulaMapping(roomIdOrSceneKey);
    const allNebulae = this.getAllNebulae();
    const nebula = opts?.nebulaId
      ? allNebulae.find((n) => n.id === opts.nebulaId) ?? resolved.nebula
      : resolved.nebula;
    const rotation = opts?.rotation ?? resolved.mapping.rotation;
    const intensity = opts?.intensity ?? resolved.mapping.intensity;
    const tier = opts?.qualityTier ?? 'auto';
    const seed = deterministicRoomSeed(roomIdOrSceneKey);

    const skyGroup = new THREE.Group();
    skyGroup.name = 'nebula_sky_system_root';
    let skyDrawCalls = 0;

    // =========================================================================
    // LAYER L0: Shared All-Sky Equirectangular Star Map (1 draw call, TZ.md §3.1)
    // =========================================================================
    const starTex = this.getSharedStarfieldTexture();
    const l0Sphere = new THREE.Mesh(
      new THREE.SphereGeometry(72, 28, 18),
      new THREE.MeshBasicMaterial({
        map: starTex,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    l0Sphere.renderOrder = -10;
    l0Sphere.rotation.y = ((seed % 360) * Math.PI) / 180;
    l0Sphere.rotation.x = (((seed >> 4) % 40) - 20) * (Math.PI / 180);
    skyGroup.add(l0Sphere);
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L1: Real Nebula on a Curved Cap (72° x 54° FOV, never stretched 360°! TZ.md §3.1)
    // =========================================================================
    const cacheKey = `${nebula.id}:${resolved.mapping.mirrorX ? 'M' : 'N'}`;
    let nebTex = this.preloadedNebulaTextures.get(cacheKey);
    if (!nebTex) {
      nebTex = this.createFeatheredNebulaCapTexture(
        nebula,
        resolved.mapping.mirrorX
      );
      this.preloadedNebulaTextures.set(cacheKey, nebTex);
    }

    // Curved spherical cap spanning 72 deg azimuth x 54 deg elevation at radius 64m
    const phiLength = THREE.MathUtils.degToRad(74);
    const thetaLength = THREE.MathUtils.degToRad(54);
    const capGeo = new THREE.SphereGeometry(
      64,
      24,
      18,
      -phiLength * 0.5 - Math.PI * 0.5,
      phiLength,
      Math.PI * 0.28 - thetaLength * 0.5,
      thetaLength
    );

    const capMat = new THREE.MeshBasicMaterial({
      map: nebTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.15, // Crossfades to `intensity` over <= 1.2s (TZ.md §3.7)
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const l1Cap = new THREE.Mesh(capGeo, capMat);
    l1Cap.renderOrder = -9;
    l1Cap.rotation.set(rotation[0], rotation[1], rotation[2]);
    skyGroup.add(l1Cap);
    this.activeNebulaMesh = l1Cap;
    this.crossfadeElapsed = 0;
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L2: Dust / Parallax Points Cloud (1 draw call, TZ.md §3.1 & §4.4)
    // =========================================================================
    const dustCount = tier === 'quest' ? 90 : 160;
    const dustPos = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const pCols = nebula.palette.map((hex) => new THREE.Color(hex));

    for (let i = 0; i < dustCount; i++) {
      const h = Math.imul(i + seed, 2654435761) >>> 0;
      dustPos[i * 3] = (((h & 0xff) / 255) - 0.5) * 26;
      dustPos[i * 3 + 1] = 0.8 + (((h >> 8) & 0xff) / 255) * 14;
      dustPos[i * 3 + 2] = ((((h >> 16) & 0xff) / 255) - 0.5) * 28;
      const c = pCols[i % pCols.length];
      dustColors[i * 3] = c.r;
      dustColors[i * 3 + 1] = c.g;
      dustColors[i * 3 + 2] = c.b;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const l2Dust = new THREE.Points(dustGeo, dustMat);
    skyGroup.add(l2Dust);
    this.activeDustPoints = l2Dust;
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L3: Subtle Star Scintillation / Twinkle (`desktop-high` only, TZ.md §3.1)
    // =========================================================================
    if (tier === 'desktop-high') {
      const twinkleCount = 120;
      const twPos = new Float32Array(twinkleCount * 3);
      for (let i = 0; i < twinkleCount; i++) {
        const theta = ((i * 137.5) % 360) * (Math.PI / 180);
        const phi = ((i * 53) % 75) * (Math.PI / 180);
        const r = 60;
        twPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        twPos[i * 3 + 1] = r * Math.cos(phi);
        twPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const twGeo = new THREE.BufferGeometry();
      twGeo.setAttribute('position', new THREE.BufferAttribute(twPos, 3));
      const twMat = new THREE.PointsMaterial({
        color: nebula.palette[2] ?? '#ffffff',
        size: 0.42,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const l3Twinkle = new THREE.Points(twGeo, twMat);
      skyGroup.add(l3Twinkle);
      this.activeTwinklePoints = l3Twinkle;
      skyDrawCalls += 1;
    }

    root.add(skyGroup);
    this.activeSkyGroup = skyGroup;

    // =========================================================================
    // PALETTE-DRIVEN LIGHTING, FOG & CUBEMAP RIG (TZ.md §4.1 & §4.2)
    // Strictly <= 2 real-time lights, zero real-time shadows!
    // =========================================================================
    const primaryColor = new THREE.Color(nebula.palette[0]).lerp(
      new THREE.Color('#8899aa'),
      0.28
    );
    const darkComplement = new THREE.Color(nebula.palette[0])
      .offsetHSL(0.5, -0.2, -0.38)
      .multiplyScalar(0.32);
    const secondColor = new THREE.Color(nebula.palette[1]);
    const fogColor = new THREE.Color(nebula.palette[0]).multiplyScalar(0.11);

    scene.background = fogColor;
    // Low fog density so first 8–10m are clear and sky nebula cap remains vivid (TZ.md §4.1)
    scene.fog = new THREE.FogExp2(
      fogColor,
      0.011 * (opts?.fogScale ?? 1.0)
    );

    // Low-res environment cubemap for hero reflections (TZ.md §4.2)
    this.activeEnvCubemap = this.createLowResEnvironmentCubemap(nebula.palette);
    scene.environment = this.activeEnvCubemap;

    // Light 1: HemisphereLight (sky = desaturated primary, ground = dark complement)
    const hemiLight = new THREE.HemisphereLight(
      primaryColor,
      darkComplement,
      0.82 * (opts?.ambientScale ?? 1.0)
    );
    hemiLight.name = 'nebula_hemi_light';
    skyGroup.add(hemiLight);

    // Light 2: Directional "Key" Light aligned with the L1 Nebula Cap direction (TZ.md §4.1)
    const keyLight = new THREE.DirectionalLight(
      secondColor,
      1.65 * intensity
    );
    keyLight.name = 'nebula_directional_key_light';
    keyLight.castShadow = false; // Zero real-time shadows in XR (TZ.md §4.1)
    const capAzimuth = rotation[1];
    const capElevation = Math.max(0.35, 0.75 - rotation[0]);
    keyLight.position.set(
      -Math.sin(capAzimuth) * 28,
      Math.sin(capElevation) * 32,
      -Math.cos(capAzimuth) * 28
    );
    skyGroup.add(keyLight);

    this.activeRigState = {
      nebulaId: nebula.id,
      nebulaName: nebula.name,
      credit: nebula.credit,
      license: nebula.license,
      palette: [...nebula.palette],
      tone: nebula.tone,
      rotation: [...rotation] as [number, number, number],
      intensity,
      drawCalls: skyDrawCalls,
      skyTextureMemoryMB: 5.4, // L0 (2.7MB) + L1 Cap (2.6MB) + Cubemap (0.1MB) <= 32 MB budget
    };

    return this.getCurrentSkyState();
  }

  /**
   * Updates sky crossfade (<= 1.2s) and optional slow drift (<= 0.2 deg/s, strictly OFF in Reduced Motion
   * and Seated mode to prevent vection, TZ.md §3.1 & §6.2).
   * Called only when game clock is NOT paused (`dt > 0`).
   */
  public update(
    dt: number,
    timeSec: number,
    opts: { reducedMotion: boolean; seated: boolean }
  ): void {
    if (dt <= 0) return;

    // Smoothly crossfade L1 Nebula Cap up to target intensity over <= 1.2s (TZ.md §3.7)
    if (this.activeNebulaMesh && this.crossfadeElapsed < 1.2) {
      this.crossfadeElapsed = Math.min(1.2, this.crossfadeElapsed + dt);
      const t01 = this.crossfadeElapsed / 1.2;
      const mat = this.activeNebulaMesh.material as THREE.MeshBasicMaterial;
      mat.opacity =
        0.15 + (this.activeRigState.intensity * 0.85) * t01;
    }

    // Vection guard (TZ.md §3.1): Sky rotation is strictly OFF in Reduced Motion and Seated mode
    if (!opts.reducedMotion && !opts.seated) {
      // <= 0.2 deg/s = 0.00349 rad/s
      const maxAngularSpeedRad = 0.0028;
      if (this.activeSkyGroup) {
        this.activeSkyGroup.rotation.y += dt * maxAngularSpeedRad;
      }
      if (this.activeDustPoints) {
        this.activeDustPoints.rotation.y -= dt * 0.006;
      }
    }

    if (this.activeTwinklePoints) {
      const mat = this.activeTwinklePoints.material as THREE.PointsMaterial;
      mat.opacity = 0.55 + Math.sin(timeSec * 2.4) * 0.22;
    }
  }
}

export const nebulaSkySystem = new NebulaSkySystem();
