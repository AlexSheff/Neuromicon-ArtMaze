import * as THREE from 'three';

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
  size: number;
  hue: number;
  band: 'low' | 'mid' | 'high';
}

/** Quiet, world-locked music accents. Audio changes are eased to avoid strobing or head-locked motion. */
export class AudioReactiveVisuals {
  public readonly root = new THREE.Group();
  private readonly particles: THREE.InstancedMesh;
  private readonly bubbles: THREE.InstancedMesh;
  private readonly records: Particle[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private readonly rotation = new THREE.Quaternion();
  private readonly levels: AudioReactiveLevels = {
    low: 0, mid: 0, high: 0, highPeak: 0, amplitude: 0, beat: 0,
  };
  private lastTimeSec = 0;

  constructor() {
    this.root.name = 'audio_reactive_room_ambience';
    this.root.visible = false;

    // A single draw call for 30 small, softly lit particles in a fixed room-space arc.
    const particleCount = 30;
    const particleGeometry = new THREE.SphereGeometry(1, 8, 6);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.16,
      depthWrite: false, toneMapped: false,
    });
    this.particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, particleCount);
    this.particles.name = 'music_specks';
    this.particles.frustumCulled = false;

    const bandHues = { low: 0.08, mid: 0.52, high: 0.76 };
    for (let i = 0; i < particleCount; i++) {
      const band: Particle['band'] = i % 3 === 0 ? 'low' : i % 3 === 1 ? 'mid' : 'high';
      const particle: Particle = {
        angle: (i / particleCount) * Math.PI * 2,
        radius: 2.7 + ((i * 7) % 6) * 0.38,
        height: 1.45 + ((i * 11) % 12) * 0.2,
        phase: i * 1.71,
        size: 0.024 + ((i * 5) % 4) * 0.008,
        hue: bandHues[band],
        band,
      };
      this.records.push(particle);
      this.position.set(Math.cos(particle.angle) * particle.radius, particle.height, Math.sin(particle.angle) * particle.radius);
      this.scale.setScalar(particle.size);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.particles.setMatrixAt(i, this.matrix);
      this.particles.setColorAt(i, this.color.setHSL(particle.hue, 0.64, 0.56));
    }
    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    this.root.add(this.particles);

    // Three small, translucent bubbles add a slow color cue without competing with the artwork.
    const bubbleGeometry = new THREE.SphereGeometry(0.12, 12, 10);
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      color: '#b9efff', roughness: 0.14, metalness: 0.08,
      clearcoat: 0.75, clearcoatRoughness: 0.12,
      iridescence: 0.55, iridescenceIOR: 1.28,
      iridescenceThicknessRange: [180, 360],
      transparent: true, opacity: 0.28, depthWrite: false,
    });
    this.bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 3);
    this.bubbles.name = 'quiet_iridescent_bubbles';
    this.bubbles.frustumCulled = false;
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2 + 0.3;
      this.position.set(Math.cos(angle) * 3.7, 2.0 + i * 0.72, Math.sin(angle) * 3.7);
      this.scale.setScalar(0.78 + i * 0.08);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.bubbles.setMatrixAt(i, this.matrix);
      this.bubbles.setColorAt(i, this.color.setHSL(0.5 + i * 0.12, 0.5, 0.72));
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
    this.root.add(this.bubbles);
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
    smooth('low', THREE.MathUtils.clamp(input.low, 0, 1), 7, 2.2);
    smooth('mid', THREE.MathUtils.clamp(input.mid, 0, 1), 7, 2.2);
    smooth('high', THREE.MathUtils.clamp(input.high, 0, 1), 8, 2.5);
    smooth('highPeak', THREE.MathUtils.clamp(input.highPeak, 0, 1), 10, 3);
    smooth('amplitude', THREE.MathUtils.clamp(input.amplitude, 0, 1), 8, 2.4);
    smooth('beat', THREE.MathUtils.clamp(input.beat, 0, 1), 12, 4.2);

    const particleMaterial = this.particles.material as THREE.MeshBasicMaterial;
    particleMaterial.opacity = 0.12 + this.levels.amplitude * 0.12 + this.levels.beat * 0.08;
    for (let i = 0; i < this.records.length; i++) {
      const p = this.records[i];
      const band = this.levels[p.band];
      // Keep position stable; only a barely perceptible drift prevents a static particle effect.
      this.position.set(
        Math.cos(p.angle) * p.radius,
        p.height + Math.sin(timeSec * 0.16 + p.phase) * 0.018,
        Math.sin(p.angle) * p.radius
      );
      this.scale.setScalar(p.size * (1 + band * 0.14 + this.levels.beat * 0.1));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.particles.setMatrixAt(i, this.matrix);
      this.color.setHSL(
        (p.hue + band * 0.055 + this.levels.highPeak * 0.025) % 1,
        0.62,
        0.49 + band * 0.1 + this.levels.beat * 0.035
      );
      this.particles.setColorAt(i, this.color);
    }
    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;

    const bubbleMaterial = this.bubbles.material as THREE.MeshPhysicalMaterial;
    bubbleMaterial.opacity = 0.2 + this.levels.highPeak * 0.12 + this.levels.amplitude * 0.06;
    bubbleMaterial.emissive.setHSL(0.54 + this.levels.highPeak * 0.06, 0.35, 0.025 + this.levels.beat * 0.025);
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2 + 0.3;
      this.position.set(
        Math.cos(angle) * 3.7,
        2.0 + i * 0.72 + Math.sin(timeSec * 0.12 + i * 2) * 0.022,
        Math.sin(angle) * 3.7
      );
      this.scale.setScalar((0.78 + i * 0.08) * (1 + this.levels.mid * 0.08 + this.levels.beat * 0.05));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.bubbles.setMatrixAt(i, this.matrix);
      this.color.setHSL((0.5 + i * 0.12 + this.levels.highPeak * 0.08) % 1, 0.48, 0.7 + this.levels.mid * 0.06);
      this.bubbles.setColorAt(i, this.color);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
  }
}
