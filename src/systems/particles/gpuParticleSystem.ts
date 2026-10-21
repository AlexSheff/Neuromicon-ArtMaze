/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface GpuParticleSystemOptions {
  particleCount?: number;
  radiusX?: number;
  radiusZ?: number;
  minY?: number;
  maxY?: number;
  center?: THREE.Vector3;
  baseColor?: THREE.Color;
  accentColor?: THREE.Color;
}

const VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aSeed;
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
attribute vec3 aBasePos;
attribute vec3 aColor;
attribute float aArchetype;

uniform float uTime;
uniform float uAudioEnergy;
uniform float uAudioKick;
uniform float uAudioBass;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  // Periodic bounded time (240s cycle) ensures highp precision is never lost
  float t = uTime * aSpeed + aPhase;

  // Analytic, continuous harmonic curl displacement (zero per-frame CPU allocation)
  vec3 pos = aBasePos;
  
  // Smooth harmonic buoyancy and gentle convection swirl
  float swirlX = sin(t * 0.85 + aBasePos.y * 0.35 + aSeed * 6.28) * 0.45;
  float swirlY = cos(t * 0.65 + aBasePos.x * 0.35 + aSeed * 3.14) * 0.38 + (uAudioBass * 0.18);
  float swirlZ = cos(t * 0.75 - aBasePos.z * 0.35 + aSeed * 1.57) * 0.45;

  // Gentle radial breath on kick beats without hard impulse snaps
  if (uAudioKick > 0.05) {
    vec2 xz = aBasePos.xz;
    float r = max(0.5, length(xz));
    pos.x += (xz.x / r) * (uAudioKick * 0.22);
    pos.z += (xz.y / r) * (uAudioKick * 0.22);
    pos.y += uAudioKick * 0.12;
  }

  pos.x += swirlX;
  pos.y += swirlY;
  pos.z += swirlZ;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float dist = length(mvPosition.xyz);
  float projSize = (aSize * 140.0 * uPixelRatio) / max(0.5, dist);
  float distFade = smoothstep(55.0, 32.0, dist);
  vAlpha = clamp(0.22 * distFade, 0.08, 0.35);
  gl_PointSize = clamp(projSize, 2.0, 16.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 tex = texture2D(uTexture, gl_PointCoord);
  if (tex.a < 0.015) discard;
  gl_FragColor = vec4(vColor, vAlpha * tex.a);
}
`;

function createSoftCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.75)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  return texture;
}

let sharedCircleTex: THREE.CanvasTexture | null = null;
function getSharedTexture(): THREE.CanvasTexture {
  if (!sharedCircleTex && typeof document !== 'undefined') {
    sharedCircleTex = createSoftCircleTexture();
  }
  return sharedCircleTex!;
}

export class GpuParticleSystem {
  public readonly points: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly count: number;

  constructor(opts: GpuParticleSystemOptions = {}) {
    const {
      particleCount = 256,
      radiusX = 8.5,
      radiusZ = 8.5,
      minY = 1.0,
      maxY = 5.5,
      center = new THREE.Vector3(0, 0, 0),
      baseColor = new THREE.Color('#d4af37'),
      accentColor = new THREE.Color('#4ea8de'),
    } = opts;

    this.count = particleCount;

    const basePositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const seeds = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const archetypes = new Float32Array(particleCount);

    const tempColor = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      // Deterministic pseudo-random seed per particle
      const s = ((i * 137.5) % 1000) / 1000;
      seeds[i] = s;
      phases[i] = (i * 0.61803398875) * Math.PI * 2;
      speeds[i] = 0.15 + ((i * 17) % 7) * 0.04;

      const arch = i % 4; // 0: Bokeh Orb, 1: Stardust, 2: Nebula Mote, 3: Spark
      archetypes[i] = arch;

      // Base sizes based on archetype
      sizes[i] = arch === 0 ? 0.32 + s * 0.18 : arch === 1 ? 0.14 + s * 0.08 : arch === 2 ? 0.22 + s * 0.12 : 0.09 + s * 0.06;

      // Circular/elliptical floor distribution
      const angle = (i / particleCount) * Math.PI * 2 + s * 0.5;
      const rRatio = Math.sqrt(0.1 + ((i * 31) % 97) / 100);
      const px = center.x + Math.cos(angle) * (radiusX * rRatio);
      const py = center.y + minY + s * (maxY - minY);
      const pz = center.z + Math.sin(angle) * (radiusZ * rRatio);

      basePositions[i * 3] = px;
      basePositions[i * 3 + 1] = py;
      basePositions[i * 3 + 2] = pz;

      // Harmonic palette interpolation
      const colorMix = (i % 5) / 4.0;
      tempColor.copy(baseColor).lerp(accentColor, colorMix);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute('aBasePos', new THREE.BufferAttribute(basePositions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aArchetype', new THREE.BufferAttribute(archetypes, 1));

    // Never culled erratically
    geometry.boundingSphere = new THREE.Sphere(center, Math.max(radiusX, radiusZ) + 4.0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0.0 },
        uAudioEnergy: { value: 0.0 },
        uAudioKick: { value: 0.0 },
        uAudioBass: { value: 0.0 },
        uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
        uTexture: { value: getSharedTexture() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.name = 'gpu_celestial_particles';
    this.points.frustumCulled = false;
  }

  public update(timeSec: number, audio: { energy?: number; kick?: number; bass?: number } = {}): void {
    // Bounded period to maintain highp float precision permanently
    this.material.uniforms.uTime.value = timeSec % 240.0;
    this.material.uniforms.uAudioEnergy.value = audio.energy ?? 0.0;
    this.material.uniforms.uAudioKick.value = audio.kick ?? 0.0;
    this.material.uniforms.uAudioBass.value = audio.bass ?? 0.0;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
