import * as THREE from 'three';

export interface AudioReactiveLevels {
  low: number;
  mid: number;
  high: number;
  highPeak: number;
  beat: number;
}

/** Small, batched room ambience: three frequency bands plus instanced iridescent bubbles. */
export class AudioReactiveVisuals {
  public readonly root = new THREE.Group();
  private readonly particleLayers: Array<{
    points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    band: keyof Pick<AudioReactiveLevels, 'low' | 'mid' | 'high'>;
  }> = [];
  private readonly bubbles: THREE.InstancedMesh;
  private readonly bubbleColor = new THREE.Color();
  private readonly bubbleMatrix = new THREE.Matrix4();
  private readonly bubblePosition = new THREE.Vector3();
  private readonly bubbleScale = new THREE.Vector3();
  private readonly bubbleQuaternion = new THREE.Quaternion();

  constructor() {
    this.root.name = 'audio_reactive_room_ambience';
    this.root.visible = false;

    const layers = [
      { band: 'low' as const, color: '#ff8c69', seed: 0.2 },
      { band: 'mid' as const, color: '#55d6d0', seed: 1.7 },
      { band: 'high' as const, color: '#b48cff', seed: 3.1 },
    ];
    for (const layer of layers) {
      const positions = new Float32Array(32 * 3);
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2 + layer.seed;
        const radius = 1.25 + ((i * 17) % 11) * 0.14;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = 0.75 + ((i * 13) % 19) * 0.11;
        positions[i * 3 + 2] = Math.sin(angle) * radius - 0.35;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: layer.color,
        size: 0.045,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      this.root.add(points);
      this.particleLayers.push({ points, band: layer.band });
    }

    const bubbleGeometry = new THREE.SphereGeometry(0.075, 10, 8);
    const bubbleMaterial = new THREE.MeshPhysicalMaterial({
      color: '#b9efff',
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.68,
      thickness: 0.16,
      iridescence: 1,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 520],
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    this.bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 12);
    this.bubbles.name = 'iridescent_soap_bubbles';
    this.bubbles.frustumCulled = false;
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2;
      this.bubblePosition.set(Math.cos(angle) * 1.8, 1.1 + (i % 4) * 0.38, Math.sin(angle) * 1.8 - 0.4);
      this.bubbleScale.setScalar(0.65 + (i % 3) * 0.18);
      this.bubbleMatrix.compose(this.bubblePosition, this.bubbleQuaternion, this.bubbleScale);
      this.bubbles.setMatrixAt(i, this.bubbleMatrix);
      this.bubbles.setColorAt(i, this.bubbleColor.setHSL((i / this.bubbles.count) % 1, 0.65, 0.72));
    }
    this.root.add(this.bubbles);
  }

  public update(timeSec: number, levels: AudioReactiveLevels, active: boolean): void {
    this.root.visible = active;
    if (!active) return;

    const energy = Math.min(1, levels.beat * 0.58 + levels.low * 0.9);
    for (const layer of this.particleLayers) {
      const amount = levels[layer.band];
      layer.points.material.opacity = 0.12 + amount * 0.62 + levels.beat * 0.24;
      layer.points.material.size = 0.035 + amount * 0.09;
      layer.points.rotation.y = timeSec * (layer.band === 'high' ? -0.045 : 0.025);
    }

    const material = this.bubbles.material as THREE.MeshPhysicalMaterial;
    material.opacity = 0.42 + Math.min(0.3, levels.highPeak * 0.24 + energy * 0.16);
    material.color.setHSL(0.53 + levels.highPeak * 0.18, 0.7, 0.78);
    for (let i = 0; i < this.bubbles.count; i++) {
      const angle = (i / this.bubbles.count) * Math.PI * 2 + timeSec * (0.055 + levels.mid * 0.09);
      const radius = 1.7 + Math.sin(timeSec * 0.8 + i * 1.7) * 0.18;
      this.bubblePosition.set(
        Math.cos(angle) * radius,
        1.05 + (i % 4) * 0.38 + Math.sin(timeSec * 1.1 + i) * 0.11 + energy * 0.08,
        Math.sin(angle) * radius - 0.35
      );
      const scale = (0.55 + (i % 3) * 0.2) * (1 + energy * 0.16);
      this.bubbleScale.setScalar(scale);
      this.bubbleMatrix.compose(this.bubblePosition, this.bubbleQuaternion, this.bubbleScale);
      this.bubbles.setMatrixAt(i, this.bubbleMatrix);
      this.bubbles.setColorAt(i, this.bubbleColor.setHSL((i / this.bubbles.count + levels.highPeak * 0.35 + timeSec * 0.01) % 1, 0.78, 0.72));
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
    if (this.bubbles.instanceColor) this.bubbles.instanceColor.needsUpdate = true;
  }
}
