import * as THREE from 'three';

export interface AudioReactiveLevels {
  low: number;
  mid: number;
  high: number;
  highPeak: number;
  amplitude: number;
  beat: number;
}

interface ParticleLayer {
  mesh: THREE.InstancedMesh;
  band: 'low' | 'mid' | 'high';
  angle: Float32Array;
  radius: Float32Array;
  height: Float32Array;
  phase: Float32Array;
  size: Float32Array;
  hue: number;
}

/** Batched, spherical room particles and iridescent bubbles driven by live music analysis. */
export class AudioReactiveVisuals {
  public readonly root = new THREE.Group();
  private readonly particleLayers: ParticleLayer[] = [];
  private readonly bubbles: THREE.InstancedMesh;
  private readonly bubbleColor = new THREE.Color();
  private readonly bubbleMatrix = new THREE.Matrix4();
  private readonly bubblePosition = new THREE.Vector3();
  private readonly bubbleScale = new THREE.Vector3();
  private readonly particleMatrix = new THREE.Matrix4();
  private readonly particlePosition = new THREE.Vector3();
  private readonly particleScale = new THREE.Vector3();
  private readonly particleColor = new THREE.Color();
  private readonly instanceRotation = new THREE.Quaternion();
  private lastTimeSec = 0;

  constructor() {
    this.root.name = 'audio_reactive_room_ambience';
    this.root.visible = false;

    // 3 frequency bands, each in a single draw call: 108 small 3D spheres total.
    // Parenting this group to the viewer's rig keeps the effect in sight while walking.
    const sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
    const layers: Array<{
      band: ParticleLayer['band'];
      hue: number;
      phase: number;
    }> = [
      { band: 'low', hue: 0.035, phase: 0.2 },
      { band: 'mid', hue: 0.48, phase: 1.7 },
      { band: 'high', hue: 0.73, phase: 3.1 },
    ];

    for (const layer of layers) {
      const count = 36;
      const material = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.InstancedMesh(sphereGeometry, material, count);
      mesh.name = `audio_particles_${layer.band}`;
      mesh.frustumCulled = false;

      const angle = new Float32Array(count);
      const radius = new Float32Array(count);
      const height = new Float32Array(count);
      const phase = new Float32Array(count);
      const size = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        angle[i] = (i / count) * Math.PI * 2 + layer.phase;
        radius[i] = 1.0 + ((i * 17) % 13) * 0.14;
        height[i] = 0.55 + ((i * 13) % 17) * 0.14;
        phase[i] = layer.phase + i * 0.83;
        size[i] = 0.055 + ((i * 7) % 5) * 0.012;
        this.particlePosition.set(
          Math.cos(angle[i]) * radius[i],
          height[i],
          Math.sin(angle[i]) * radius[i]
        );
        this.particleScale.setScalar(size[i]);
        this.particleMatrix.compose(
          this.particlePosition,
          this.instanceRotation,
          this.particleScale
        );
        mesh.setMatrixAt(i, this.particleMatrix);
        mesh.setColorAt(
          i,
          this.particleColor.setHSL(
            (layer.hue + (i % 9) * 0.014) % 1,
            0.9,
            0.62 + (i % 3) * 0.08
          )
        );
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh);
      this.particleLayers.push({
        mesh,
        band: layer.band,
        angle,
        radius,
        height,
        phase,
        size,
        hue: layer.hue,
      });
    }

    const bubbleGeometry = new THREE.SphereGeometry(0.14, 12, 10);
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      color: '#b9efff',
      roughness: 0.08,
      metalness: 0.12,
      emissive: '#163047',
      emissiveIntensity: 0.32,
      transmission: 0.28,
      thickness: 0.16,
      iridescence: 1,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 520],
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 12);
    this.bubbles.name = 'iridescent_soap_bubbles';
    this.bubbles.frustumCulled = false;
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2;
      this.bubblePosition.set(
        Math.cos(angle) * 1.7,
        0.75 + (i % 4) * 0.42,
        Math.sin(angle) * 1.7
      );
      this.bubbleScale.setScalar(0.72 + (i % 3) * 0.16);
      this.bubbleMatrix.compose(
        this.bubblePosition,
        this.instanceRotation,
        this.bubbleScale
      );
      this.bubbles.setMatrixAt(i, this.bubbleMatrix);
      this.bubbles.setColorAt(
        i,
        this.bubbleColor.setHSL((i / this.bubbles.count) % 1, 0.82, 0.68)
      );
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
    this.root.add(this.bubbles);
  }

  public update(timeSec: number, levels: AudioReactiveLevels, active: boolean): void {
    this.root.visible = active;
    if (!active) return;

    const dt = Math.max(0, Math.min(0.05, timeSec - this.lastTimeSec));
    this.lastTimeSec = timeSec;
    const beat = THREE.MathUtils.clamp(levels.beat, 0, 1);
    const amplitude = THREE.MathUtils.clamp(levels.amplitude, 0, 1);
    const energy = Math.min(1, beat * 0.54 + levels.low * 0.62 + amplitude * 0.82);

    for (const layer of this.particleLayers) {
      const amount = THREE.MathUtils.clamp(levels[layer.band], 0, 1);
      const drive = Math.min(1, amount * 0.72 + amplitude * 0.42 + beat * 0.76);
      const material = layer.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.56 + drive * 0.4;

      for (let i = 0; i < layer.mesh.count; i++) {
        const angle = layer.angle[i] + timeSec * (0.08 + amount * 0.3);
        const radius = layer.radius[i] * (1 + drive * 0.12);
        const bob = Math.sin(timeSec * (0.7 + amount * 2.5) + layer.phase[i]);
        this.particlePosition.set(
          Math.cos(angle) * radius,
          layer.height[i] + bob * (0.08 + amplitude * 0.24 + beat * 0.18),
          Math.sin(angle) * radius
        );
        this.particleScale.setScalar(layer.size[i] * (1 + drive * 1.7));
        this.particleMatrix.compose(
          this.particlePosition,
          this.instanceRotation,
          this.particleScale
        );
        layer.mesh.setMatrixAt(i, this.particleMatrix);
        const spectralHue =
          layer.hue + amount * 0.12 + levels.highPeak * 0.08 + beat * 0.05;
        this.particleColor.setHSL(
          (spectralHue + (i % 9) * 0.014 + timeSec * 0.006) % 1,
          0.9,
          THREE.MathUtils.clamp(0.48 + drive * 0.3, 0.48, 0.82)
        );
        layer.mesh.setColorAt(i, this.particleColor);
      }
      layer.mesh.instanceMatrix.needsUpdate = true;
      if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true;
      layer.mesh.rotation.y += dt * (layer.band === 'high' ? -1 : 1) * (0.05 + amount * 0.18);
    }

    const material = this.bubbles.material as THREE.MeshPhysicalMaterial;
    material.opacity = 0.58 + Math.min(0.38, levels.highPeak * 0.2 + energy * 0.22);
    material.emissiveIntensity = 0.24 + amplitude * 0.7 + beat * 0.35;
    material.color.setHSL(0.53 + levels.highPeak * 0.18, 0.78, 0.58 + energy * 0.18);
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2 + timeSec * (0.09 + levels.mid * 0.12);
      const radius = 1.45 + Math.sin(timeSec * (0.8 + levels.mid * 0.2) + i * 1.7) * (0.14 + amplitude * 0.14);
      this.bubblePosition.set(
        Math.cos(angle) * radius,
        0.65 + (i % 4) * 0.42 + Math.sin(timeSec * 1.1 + i) * 0.12 + energy * 0.22,
        Math.sin(angle) * radius
      );
      const scale = (0.72 + (i % 3) * 0.16) * (1 + energy * 0.3);
      this.bubbleScale.setScalar(scale);
      this.bubbleMatrix.compose(
        this.bubblePosition,
        this.instanceRotation,
        this.bubbleScale
      );
      this.bubbles.setMatrixAt(i, this.bubbleMatrix);
      const hue = (i / this.bubbles.count + levels.highPeak * 0.35 + timeSec * 0.015) % 1;
      this.bubbles.setColorAt(i, this.bubbleColor.setHSL(hue, 0.84, 0.66 + energy * 0.16));
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
  }
}
