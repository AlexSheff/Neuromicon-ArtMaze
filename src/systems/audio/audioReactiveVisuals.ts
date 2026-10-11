import * as THREE from 'three';
import { createSoftParticleTexture } from '../sky/softParticleTexture';

export interface AudioReactiveLevels {
  low: number;
  mid: number;
  high: number;
  highPeak: number;
  amplitude: number;
  beat: number;
}

interface Particle {
  angle: number;
  radius: number;
  height: number;
  phase: number;
  hue: number;
  band: 'low' | 'mid' | 'high';
}

/** A sparse, world-locked dust field whose light and colour follow the music. */
export class AudioReactiveVisuals {
  public readonly root = new THREE.Group();
  private readonly particles: THREE.Points;
  private readonly records: Particle[] = [];
  private readonly levels: AudioReactiveLevels = {
    low: 0, mid: 0, high: 0, highPeak: 0, amplitude: 0, beat: 0,
  };
  private lastTimeSec = 0;

  constructor() {
    this.root.name = 'audio_reactive_room_ambience';

    // Soft points, not tiny 3D balls: two hundred dust motes share one draw call.
    const count = 180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const hash = Math.imul(i + 113, 2654435761) >>> 0;
      const angle = (i / count) * Math.PI * 2;
      const radius = 3.2 + ((hash & 0xff) / 255) * 5.2;
      const height = 0.45 + (((hash >> 8) & 0xff) / 255) * 4.7;
      const band: Particle['band'] = i % 3 === 0 ? 'low' : i % 3 === 1 ? 'mid' : 'high';
      const hue = band === 'low' ? 0.075 : band === 'mid' ? 0.52 : 0.78;
      this.records.push({ angle, radius, height, phase: (hash % 1000) / 1000 * Math.PI * 2, hue, band });
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      color.setHSL(hue, 0.55, 0.5);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.075,
      map: createSoftParticleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.14,
      alphaTest: 0.02,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: true,
    });
    this.particles = new THREE.Points(geometry, material);
    this.particles.name = 'music_dust_points';
    this.particles.frustumCulled = false;
    this.root.add(this.particles);
  }

  public update(timeSec: number, input: AudioReactiveLevels, active: boolean): void {
    this.root.visible = active;
    if (!active) return;

    const dt = Math.max(0, Math.min(0.05, timeSec - this.lastTimeSec));
    this.lastTimeSec = timeSec;
    const smooth = (key: keyof AudioReactiveLevels, target: number, attack: number, release: number) => {
      const current = this.levels[key];
      const rate = target > current ? attack : release;
      this.levels[key] = THREE.MathUtils.lerp(current, target, 1 - Math.exp(-dt * rate));
    };
    smooth('low', THREE.MathUtils.clamp(input.low, 0, 1), 5, 2.0);
    smooth('mid', THREE.MathUtils.clamp(input.mid, 0, 1), 5, 2.0);
    smooth('high', THREE.MathUtils.clamp(input.high, 0, 1), 6, 2.2);
    smooth('highPeak', THREE.MathUtils.clamp(input.highPeak, 0, 1), 7, 2.4);
    smooth('amplitude', THREE.MathUtils.clamp(input.amplitude, 0, 1), 6, 2.0);
    smooth('beat', THREE.MathUtils.clamp(input.beat, 0, 1), 9, 3.0);

    const material = this.particles.material as THREE.PointsMaterial;
    // Beat and loudness change brightness softly; the fast attack is smoothed above.
    material.opacity = 0.09 + this.levels.amplitude * 0.08 + this.levels.beat * 0.075;
    material.size = 0.068 + this.levels.low * 0.012 + this.levels.beat * 0.012;

    const position = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = this.particles.geometry.getAttribute('color') as THREE.BufferAttribute;
    const color = new THREE.Color();
    for (let i = 0; i < this.records.length; i++) {
      const p = this.records[i];
      const level = this.levels[p.band];
      const drift = Math.sin(timeSec * 0.075 + p.phase) * 0.025;
      position.setXYZ(i, Math.cos(p.angle + drift) * p.radius, p.height + drift, Math.sin(p.angle + drift) * p.radius);
      const hue = (p.hue + level * 0.045 + this.levels.highPeak * 0.035) % 1;
      color.setHSL(hue, 0.52 + this.levels.mid * 0.16, 0.38 + level * 0.12 + this.levels.beat * 0.045);
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    position.needsUpdate = true;
    colors.needsUpdate = true;
  }
}
