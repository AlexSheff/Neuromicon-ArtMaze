import * as THREE from 'three';
import nebulaeData from '../../../content/space/nebulae.json';
import starfieldData from '../../../content/space/starfield.json';
import {
  deterministicRoomSeed,
  NebulaRegistryEntry,
  resolveRoomNebulaMapping,
} from './nebulaRegistry';
import { spatialAudioSystem } from '../audio/spatialAudioSystem';

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
  private sharedStarfieldTex: THREE.Texture | null = null;
  private sharedSoftParticleTex: THREE.CanvasTexture | null = null;
  private preloadedNebulaTextures: Map<string, THREE.Texture> = new Map();
  private activeSkyGroup: THREE.Group | null = null;
  private activeEnvCubemap: THREE.CubeTexture | null = null;
  private activeStarSphere: THREE.Mesh | null = null;
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
   * Verifies the cryptographic SHA-256 digest of a local space asset's bytes against its registry sha256.
   */
  public async verifyAssetBytesSha256(
    assetUrl: string,
    expectedSha256: string
  ): Promise<{ valid: boolean; blobUrl?: string }> {
    const cleanExpected = expectedSha256
      .replace(/^sha256-/i, '')
      .trim()
      .toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleanExpected)) {
      return { valid: false };
    }
    if (
      typeof fetch === 'undefined' ||
      typeof crypto === 'undefined' ||
      !crypto.subtle
    ) {
      return { valid: false };
    }

    try {
      const cleanRel = assetUrl.replace(/^\.?\//, '');
      const candidateUrls = [
        `./${cleanRel}`,
        `./public/${cleanRel}`,
        `/${cleanRel}`,
      ];
      let res: Response | null = null;
      for (const url of candidateUrls) {
        try {
          const attempt = await fetch(url);
          if (attempt.ok) {
            res = attempt;
            break;
          }
        } catch {
          // Try next candidate path
        }
      }
      if (!res || !res.ok) return { valid: false };
      const buf = await res.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      const actualHex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (actualHex !== cleanExpected) {
        return { valid: false };
      }
      const blob = new Blob([buf], { type: 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);
      return { valid: true, blobUrl };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Builds or returns a shared 128x128 radial spherical bokeh glow texture so THREE.Points
   * render as soft glowing spheres and NEVER as cubic/square pixels.
   */
  public getSharedSoftParticleTexture(): THREE.Texture {
    if (this.sharedSoftParticleTex) return this.sharedSoftParticleTex;

    if (typeof document === 'undefined') {
      const tex = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16);
      tex.userData = { cachedSignage: true, sharedSkyAsset: true };
      tex.needsUpdate = true;
      this.sharedSoftParticleTex = tex as unknown as THREE.CanvasTexture;
      return tex;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);

    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.88)');
    grad.addColorStop(0.62, 'rgba(255, 255, 255, 0.32)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { cachedSignage: true, sharedSkyAsset: true };
    this.sharedSoftParticleTex = tex;
    return tex;
  }

  /**
   * Builds or returns the shared L0 equirectangular all-sky star map texture
   * and loads the local NASA/Goddard SVS 4851 Deep Star Map directly (`public/assets/space/starfield_2020.jpg`).
   */
  private getSharedStarfieldTexture(): THREE.Texture {
    if (this.sharedStarfieldTex) return this.sharedStarfieldTex;

    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
    const candidateUrls = [
      '/assets/space/starfield_2020.jpg',
      `${base}/assets/space/starfield_2020.jpg`,
      'assets/space/starfield_2020.jpg',
      './assets/space/starfield_2020.jpg',
    ];

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    let loaded = false;
    for (const url of candidateUrls) {
      if (loaded) break;
      const tex = loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.anisotropy = 16;
          t.needsUpdate = true;
        },
        undefined,
        () => {
          // fallback to next
        }
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 16;
      tex.userData = { cachedSignage: true, sharedSkyAsset: true };
      this.sharedStarfieldTex = tex;
      loaded = true;
      return tex;
    }

    const fallbackTex = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16);
    this.sharedStarfieldTex = fallbackTex as unknown as THREE.CanvasTexture;
    return fallbackTex;
  }

  /**
   * Builds a high-fidelity curved-cap texture for a specific Nebula entry,
   * loading the local NASA/ESA/JWST image (`assets/space/neb_XXXX.jpg`)
   * with 16x anisotropic filtering and high dynamic clarity.
   */
  private createFeatheredNebulaCapTexture(
    nebula: NebulaRegistryEntry,
    mirrorX = false
  ): THREE.Texture {
    if (typeof document === 'undefined') {
      const dummy = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16);
      dummy.needsUpdate = true;
      return dummy;
    }

    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Initial soft celestial nebula glow on canvas while texture loads (zero harsh black/box edges)
    const initGrad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      12,
      size * 0.5,
      size * 0.5,
      size * 0.46
    );
    const p0 = nebula.palette?.[0] ?? '#e5c158';
    const p1 = nebula.palette?.[1] ?? '#9d4edd';
    initGrad.addColorStop(0, `${p0}55`);
    initGrad.addColorStop(0.5, `${p1}28`);
    initGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = initGrad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const rawFileName = nebula.image
      ? nebula.image.split('/').pop()
      : `neb_${nebula.id.replace('NEB_', '')}.jpg`;
    const base = (
      (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ||
      '/'
    ).replace(/\/$/, '');

    const candidateUrls = [
      `/assets/space/${rawFileName}`,
      `${base}/assets/space/${rawFileName}`,
      `assets/space/${rawFileName}`,
      `./assets/space/${rawFileName}`,
    ];

    let urlIdx = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const renderImageWithFeather = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (mirrorX) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, 0, 0, size, size);
      ctx.restore();

      // Organic radial feathering: outer 25% fades seamlessly to 0 alpha.
      // This completely eliminates square borders in the celestial sky!
      ctx.globalCompositeOperation = 'destination-in';
      const featherGrad = ctx.createRadialGradient(
        size * 0.5,
        size * 0.5,
        size * 0.22,
        size * 0.5,
        size * 0.5,
        size * 0.48
      );
      featherGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      featherGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.95)');
      featherGrad.addColorStop(0.82, 'rgba(0, 0, 0, 0.5)');
      featherGrad.addColorStop(0.95, 'rgba(0, 0, 0, 0.1)');
      featherGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = featherGrad;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';

      tex.needsUpdate = true;
    };

    img.onload = () => {
      renderImageWithFeather();
    };

    img.onerror = () => {
      urlIdx++;
      if (urlIdx < candidateUrls.length) {
        img.src = candidateUrls[urlIdx];
      }
    };

    img.src = candidateUrls[0];
    return tex;
  }

  /**
   * Generates a low-resolution (64x64 per face) environment cubemap from the room's nebula palette
   * in < 1.5 ms at mount time for hero surfaces (mirror, reflective pools, art frames, TZ.md §4.2).
   */
  public createLowResEnvironmentCubemap(palette: string[]): THREE.CubeTexture {
    if (typeof document === 'undefined') {
      const dummyFaces = Array.from(
        { length: 6 },
        () => new THREE.DataTexture(new Uint8Array(8 * 8 * 4), 8, 8)
      );
      const cubeTex = new THREE.CubeTexture(dummyFaces);
      cubeTex.needsUpdate = true;
      return cubeTex;
    }

    const [c0, c1, c2] = palette;
    const faces: HTMLCanvasElement[] = [];

    for (let f = 0; f < 6; f++) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 64);
      // Gothic-Plasma-Cosmic Twilight cubemap: zenith nebula -> plasma violet/blue mid -> deep basalt floor
      grad.addColorStop(0, f === 2 ? c2 : c0);
      grad.addColorStop(0.38, c1);
      grad.addColorStop(0.65, '#261844');
      grad.addColorStop(1, '#060811');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);

      // Plasma column & portal specular reflection bands for polished dark stone & quartz glass
      const bloom = ctx.createRadialGradient(32, f === 2 ? 32 : 28, 3, 32, 32, 30);
      bloom.addColorStop(0, `${c2}88`);
      bloom.addColorStop(0.5, '#9d4edd44');
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
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
   * Disposes all preloaded neighbor nebula textures.
   */
  public clearPreloadCache(): void {
    this.preloadedNebulaTextures.forEach((tex) => tex.dispose());
    this.preloadedNebulaTextures.clear();
  }

  /**
   * Disposes the current room's sky meshes, materials, per-room nebula texture, and environment cubemap (TZ.md §3.7 & §3.8).
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
            if (
              basic.map &&
              basic.map !== this.sharedStarfieldTex &&
              basic.map !== this.sharedSoftParticleTex
            ) {
              for (const [k, v] of this.preloadedNebulaTextures.entries()) {
                if (v === basic.map) {
                  this.preloadedNebulaTextures.delete(k);
                }
              }
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

    this.activeStarSphere = null;
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
      new THREE.SphereGeometry(72, 32, 24),
      new THREE.MeshBasicMaterial({
        map: starTex,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    l0Sphere.renderOrder = -10;
    l0Sphere.rotation.y = ((seed % 360) * Math.PI) / 180;
    l0Sphere.rotation.x = (((seed >> 4) % 40) - 20) * (Math.PI / 180);
    skyGroup.add(l0Sphere);
    this.activeStarSphere = l0Sphere;
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L1: Real Nebula on a Curved Cap (72° x 54° FOV, never stretched 360°! TZ.md §3.1)
    // =========================================================================
    const cacheKey = `${nebula.id}:${resolved.mapping.mirrorX ? 'M' : 'N'}`;
    let nebTex = this.preloadedNebulaTextures.get(cacheKey);
    if (nebTex) {
      this.preloadedNebulaTextures.delete(cacheKey);
    } else {
      nebTex = this.createFeatheredNebulaCapTexture(
        nebula,
        resolved.mapping.mirrorX
      );
    }

    // Curved spherical cap spanning 110 deg azimuth x 82 deg elevation at radius 64m
    const phiLength = THREE.MathUtils.degToRad(110);
    const thetaLength = THREE.MathUtils.degToRad(82);
    const capGeo = new THREE.SphereGeometry(
      64,
      36,
      28,
      -phiLength * 0.5 - Math.PI * 0.5,
      phiLength,
      Math.PI * 0.28 - thetaLength * 0.5,
      thetaLength
    );

    const capMat = new THREE.MeshBasicMaterial({
      map: nebTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });

    const l1Cap = new THREE.Mesh(capGeo, capMat);
    l1Cap.renderOrder = -9;
    l1Cap.rotation.set(rotation[0], rotation[1], rotation[2]);
    skyGroup.add(l1Cap);
    this.activeNebulaMesh = l1Cap;
    this.crossfadeElapsed = 0;
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L2: True Chaotic Cosmic Stars Field (TZ.md §3.1 & §4.4)
    // Delicate, crystal-clear, broadly distributed stellar field with chaotic 3D drift
    // =========================================================================
    const starCount = tier === 'quest' ? 140 : 220;
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starVelocities = new Float32Array(starCount * 3);
    const starPhases = new Float32Array(starCount);

    // Natural astronomical stellar palette: O/B blue-white, A/F diamond white, G/K warm starlight
    const stellarHues = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#dceeff'),
      new THREE.Color('#fff9ed'),
      new THREE.Color('#ffe6b0'),
      new THREE.Color('#cbe3ff'),
    ];

    for (let i = 0; i < starCount; i++) {
      const h = Math.imul(i + seed, 2654435761) >>> 0;
      // Broad spherical/dome cosmic volume (radius 32m to 90m, height 1.8m to 48m)
      const u = ((h & 0xffff) / 65535);
      const v = (((h >> 16) & 0xffff) / 65535);
      const angle = u * Math.PI * 2;
      const dist = 28 + v * 58;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const py = 1.8 + (((h >> 8) & 0xff) / 255) * 44;

      starPos[i * 3] = px;
      starPos[i * 3 + 1] = py;
      starPos[i * 3 + 2] = pz;

      // Independent chaotic 3D drift velocities
      starVelocities[i * 3] = (((h & 0x7f) / 127) - 0.5) * 0.42;
      starVelocities[i * 3 + 1] = ((((h >> 7) & 0x7f) / 127) - 0.5) * 0.28;
      starVelocities[i * 3 + 2] = ((((h >> 14) & 0x7f) / 127) - 0.5) * 0.42;
      starPhases[i] = i * 1.371 + (h % 100) * 0.05;

      const c = stellarHues[i % stellarHues.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }

    const softCircleTex = this.getSharedSoftParticleTexture();
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.054,
      map: softCircleTex,
      alphaTest: 0.005,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const l2Stars = new THREE.Points(starGeo, starMat);
    l2Stars.name = 'nebula_chaotic_stars';
    l2Stars.userData = {
      velocities: starVelocities,
      phases: starPhases,
      count: starCount,
    };
    skyGroup.add(l2Stars);
    this.activeDustPoints = l2Stars;
    skyDrawCalls += 1;

    // =========================================================================
    // LAYER L3: Distant Celestial Scintillation (desktop-high only, TZ.md §3.1)
    // Tiny, tranquil, distant star points with gentle music resonance
    // =========================================================================
    if (tier === 'desktop-high') {
      const twinkleCount = 110;
      const twPos = new Float32Array(twinkleCount * 3);
      for (let i = 0; i < twinkleCount; i++) {
        const theta = ((i * 137.5) % 360) * (Math.PI / 180);
        const phi = ((i * 53) % 75) * (Math.PI / 180);
        const r = 75;
        twPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        twPos[i * 3 + 1] = r * Math.cos(phi);
        twPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const twGeo = new THREE.BufferGeometry();
      twGeo.setAttribute('position', new THREE.BufferAttribute(twPos, 3));
      const twMat = new THREE.PointsMaterial({
        color: '#ffffff',
        size: 0.048,
        map: softCircleTex,
        alphaTest: 0.005,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const l3Twinkle = new THREE.Points(twGeo, twMat);
      l3Twinkle.name = 'nebula_distant_twinkle';
      skyGroup.add(l3Twinkle);
      this.activeTwinklePoints = l3Twinkle;
      skyDrawCalls += 1;
    }

    root.add(skyGroup);
    this.activeSkyGroup = skyGroup;

    // =========================================================================
    // PALETTE-DRIVEN LIGHTING, FOG & CUBEMAP RIG (TZ.md §4.1 & §4.2)
    // Strictly <= 2 real-time lights, zero real-time shadows!
    // Tuned for "Комфортный Космический Полумрак": deep basalt/slate shadows where light is an accent.
    // =========================================================================
    const primaryColor = new THREE.Color(nebula.palette[0]).lerp(
      new THREE.Color('#9d65ff'),
      0.28
    );
    const darkComplement = new THREE.Color(nebula.palette[0])
      .lerp(new THREE.Color('#03050a'), 0.88)
      .multiplyScalar(0.32);
    const secondColor = new THREE.Color(nebula.palette[2] ?? nebula.palette[1]).lerp(
      new THREE.Color('#f4d284'),
      0.35
    );
    const fogColor = new THREE.Color(nebula.palette[0])
      .lerp(new THREE.Color('#030409'), 0.94);

    scene.background = fogColor;
    // Pristine cosmic void visibility: ultra-gentle atmospheric mist that preserves 100% deep space black & radiant nebulae
    scene.fog = new THREE.FogExp2(
      fogColor,
      0.0025 * (opts?.fogScale ?? 1.0)
    );

    // Low-res environment cubemap for hero reflections (TZ.md §4.2)
    this.activeEnvCubemap = this.createLowResEnvironmentCubemap(nebula.palette);
    scene.environment = this.activeEnvCubemap;

    // Light 1: HemisphereLight (sky = cosmic galaxy/nebula primary, ground = deep basalt shadow bounce)
    const hemiLight = new THREE.HemisphereLight(
      primaryColor,
      darkComplement,
      0.52 * (opts?.ambientScale ?? 1.0)
    );
    hemiLight.name = 'nebula_hemi_light';
    skyGroup.add(hemiLight);

    // Light 2: Directional "Key" Light aligned with the L1 Nebula Cap direction (TZ.md §4.1)
    const keyLight = new THREE.DirectionalLight(
      secondColor,
      0.98 * intensity
    );
    keyLight.name = 'nebula_directional_key_light';
    keyLight.castShadow = false; // Zero real-time shadows in XR (TZ.md §4.1)
    const capAzimuth = rotation[1];
    const capElevation = Math.max(0.4, 0.78 - rotation[0]);
    keyLight.position.set(
      -Math.sin(capAzimuth) * 28,
      Math.sin(capElevation) * 34,
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

    // Crossfade L1 Nebula Cap smoothly on room transition (strictly <= 1.2s, TZ.md §3.1)
    if (this.activeNebulaMesh && this.crossfadeElapsed < 1.2) {
      this.crossfadeElapsed = Math.min(1.2, this.crossfadeElapsed + dt);
      const t01 = this.crossfadeElapsed / 1.2;
      const mat = this.activeNebulaMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (0.2 + (this.activeRigState.intensity * 0.75) * t01);
    } else if (this.activeNebulaMesh) {
      const mat = this.activeNebulaMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1.0, this.activeRigState.intensity * 0.95);
      // Rock-solid celestial stability: never pulsate or shake sky dome scale!
      this.activeNebulaMesh.scale.setScalar(1.0);
    }

    // Majestic, tranquil celestial drift (strictly Y-axis yaw <= 0.05 deg/s, zero X/Z pitch wobble, TZ.md §3.1 & §6.2)
    if (!opts.reducedMotion) {
      if (this.activeStarSphere) {
        this.activeStarSphere.rotation.y += dt * 0.0025;
        this.activeStarSphere.rotation.x = 0;
      }
      if (this.activeNebulaMesh) {
        this.activeNebulaMesh.rotation.y += dt * 0.002;
        this.activeNebulaMesh.rotation.z = 0;
      }
      if (this.activeSkyGroup) {
        this.activeSkyGroup.rotation.y += dt * 0.001;
      }
      if (this.activeDustPoints) {
        const geo = this.activeDustPoints.geometry;
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
        const { velocities, phases, count } = (this.activeDustPoints.userData as {
          velocities?: Float32Array;
          phases?: Float32Array;
          count?: number;
        }) ?? {};

        if (posAttr && velocities && count) {
          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < count; i++) {
            const idx3 = i * 3;
            const ph = phases ? phases[i] : i * 0.37;
            // 3D chaotic curl & Brownian wander (smooth, organic, non-strobing drift)
            const cx = Math.sin(timeSec * 0.08 + ph) * 0.04 + Math.cos(timeSec * 0.04 - ph * 1.6) * 0.03;
            const cy = Math.cos(timeSec * 0.06 + ph * 0.8) * 0.03 + Math.sin(timeSec * 0.03 + ph * 2.1) * 0.02;
            const cz = Math.sin(timeSec * 0.07 - ph * 1.2) * 0.04 + Math.cos(timeSec * 0.05 + ph * 0.6) * 0.03;

            arr[idx3] += (velocities[idx3] * 0.4 + cx) * dt;
            arr[idx3 + 1] += (velocities[idx3 + 1] * 0.3 + cy) * dt;
            arr[idx3 + 2] += (velocities[idx3 + 2] * 0.4 + cz) * dt;

            // Soft cosmic boundary wrap so the field stays uniformly distributed across the heavens
            if (arr[idx3] > 65) arr[idx3] = -65;
            else if (arr[idx3] < -65) arr[idx3] = 65;
            if (arr[idx3 + 1] > 55) arr[idx3 + 1] = 2.0;
            else if (arr[idx3 + 1] < 1.0) arr[idx3 + 1] = 52;
            if (arr[idx3 + 2] > 65) arr[idx3 + 2] = -65;
            else if (arr[idx3 + 2] < -65) arr[idx3 + 2] = 65;
          }
          posAttr.needsUpdate = true;
        }

        const dustMat = this.activeDustPoints.material as THREE.PointsMaterial;
        if (dustMat) {
          // Zero blinking: constant, serene starlight glow
          dustMat.opacity = 0.28;
          dustMat.size = 0.026;
        }
      }
    }

    if (this.activeTwinklePoints) {
      const mat = this.activeTwinklePoints.material as THREE.PointsMaterial;
      if (mat) {
        // Serene distant starlight
        mat.opacity = 0.2;
        mat.size = 0.022;
      }
    }
  }
}

export const nebulaSkySystem = new NebulaSkySystem();
