import * as THREE from 'three';

function createRadialVignetteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 105, 256, 256, 250);
  grad.addColorStop(0, 'rgba(8, 7, 6, 0.0)');
  grad.addColorStop(0.55, 'rgba(8, 7, 6, 0.15)');
  grad.addColorStop(0.82, 'rgba(8, 7, 6, 0.88)');
  grad.addColorStop(1, 'rgba(8, 7, 6, 0.98)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle golden horizon ticks inside the vignette aperture for vestibular stability
  ctx.strokeStyle = 'rgba(200, 164, 100, 0.45)';
  ctx.lineWidth = 2;
  // Left & Right horizon ticks
  ctx.beginPath();
  ctx.moveTo(95, 256);
  ctx.lineTo(120, 256);
  ctx.moveTo(392, 256);
  ctx.lineTo(417, 256);
  // Top & Bottom vertical reference ticks
  ctx.moveTo(256, 95);
  ctx.lineTo(256, 115);
  ctx.moveTo(256, 397);
  ctx.lineTo(256, 417);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

/**
 * VR & Desktop Comfort System (AGENTS.md §2.9 & §4A.3).
 * Eliminates vection ("space swimming") using:
 * 1. Blink-fade transitions for teleports, lifts, snap-turns, and room mounts.
 * 2. Peripheral FOV comfort vignette + horizon reference ticks during smooth movement.
 * 3. Grounded 3D floor teleport ring marker.
 */
export class ComfortSystem {
  public readonly fadeMesh: THREE.Mesh;
  public readonly vignetteMesh: THREE.Mesh;
  public readonly teleportRing: THREE.Group;

  private fadeMat: THREE.MeshBasicMaterial;
  private vignetteMat: THREE.MeshBasicMaterial;

  private currentVignette = 0;
  private targetVignette = 0;

  private fadeState: 'idle' | 'fading-out' | 'fading-in' = 'idle';
  private fadeAlpha = 0;
  private fadeSpeed = 8.5;
  private onFadeMidpoint: (() => void) | null = null;

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    // 1. Full-sphere comfort fader around camera (works in both stereo WebXR and Desktop)
    this.fadeMat = new THREE.MeshBasicMaterial({
      color: '#070605',
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.fadeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 16),
      this.fadeMat
    );
    this.fadeMesh.renderOrder = 9999;
    this.fadeMesh.visible = false;
    camera.add(this.fadeMesh);

    // 2. Peripheral comfort vignette plane in front of camera
    const vigTex = createRadialVignetteTexture();
    this.vignetteMat = new THREE.MeshBasicMaterial({
      map: vigTex,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.vignetteMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      this.vignetteMat
    );
    this.vignetteMesh.position.set(0, 0, -0.34);
    this.vignetteMesh.renderOrder = 9990;
    this.vignetteMesh.visible = false;
    camera.add(this.vignetteMesh);

    // 3. 3D Floor Teleport Target Ring
    this.teleportRing = new THREE.Group();
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.46, 32),
      new THREE.MeshBasicMaterial({
        color: '#c8a464',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
      })
    );
    outerRing.rotation.x = -Math.PI * 0.5;
    this.teleportRing.add(outerRing);

    const innerDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 32),
      new THREE.MeshBasicMaterial({
        color: '#c8a464',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
      })
    );
    innerDisc.rotation.x = -Math.PI * 0.5;
    this.teleportRing.add(innerDisc);

    this.teleportRing.visible = false;
    scene.add(this.teleportRing);
  }

  /**
   * Executes a comfortable blink-fade transition: fades to black, invokes `onMidpoint()`,
   * and fades back in so there is zero optical lurch or space swimming.
   */
  public triggerFadeTransition(onMidpoint: () => void, speed = 8.5): void {
    if (this.fadeState === 'fading-out') {
      // If already fading out, chain the midpoint callback
      const prev = this.onFadeMidpoint;
      this.onFadeMidpoint = () => {
        prev?.();
        onMidpoint();
      };
      return;
    }
    this.fadeSpeed = speed;
    this.onFadeMidpoint = onMidpoint;
    this.fadeState = 'fading-out';
    this.fadeMesh.visible = true;
  }

  public setTargetVignette(intensity: number): void {
    this.targetVignette = Math.max(0, Math.min(1, intensity));
  }

  public update(dt: number, vignetteEnabled: boolean): void {
    // Update blink-fade
    if (this.fadeState === 'fading-out') {
      this.fadeAlpha += dt * this.fadeSpeed;
      if (this.fadeAlpha >= 1) {
        this.fadeAlpha = 1;
        if (this.onFadeMidpoint) {
          const cb = this.onFadeMidpoint;
          this.onFadeMidpoint = null;
          cb();
        }
        this.fadeState = 'fading-in';
      }
      this.fadeMat.opacity = this.fadeAlpha;
      this.fadeMesh.visible = true;
    } else if (this.fadeState === 'fading-in') {
      this.fadeAlpha -= dt * (this.fadeSpeed * 0.85);
      if (this.fadeAlpha <= 0) {
        this.fadeAlpha = 0;
        this.fadeState = 'idle';
        this.fadeMesh.visible = false;
      }
      this.fadeMat.opacity = this.fadeAlpha;
    }

    // Update peripheral comfort vignette
    const desired = vignetteEnabled ? this.targetVignette : 0;
    this.currentVignette +=
      (desired - this.currentVignette) * Math.min(1, dt * 12);
    if (this.currentVignette > 0.01) {
      this.vignetteMesh.visible = true;
      this.vignetteMat.opacity = this.currentVignette * 0.92;
    } else {
      this.vignetteMesh.visible = false;
      this.vignetteMat.opacity = 0;
    }
  }
}
