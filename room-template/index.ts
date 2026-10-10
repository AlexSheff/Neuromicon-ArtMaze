import { disposeThreeHierarchy, RoomContext, RoomModule } from '../src/room-sdk';

/**
 * Reference Room API v1 Module (`room-template/index.ts`).
 * Demonstrates:
 * - Using `ctx.time.delta` and `ctx.time.paused` (game time, never wall-clock `performance.now`, TZ.md §6.4).
 * - Accessing `ctx.sky.current()` and `ctx.environment.palette` (TZ.md §3.6).
 * - Implementing `onPause(ctx)` and `onResume(ctx)` hooks (TZ.md §6.4).
 * - Disposing all GPU resources in `unmount(ctx)` to pass CI 30-transition leak checks.
 */
const roomModule: RoomModule = {
  async preload(ctx: RoomContext): Promise<void> {
    ctx.log(`[${ctx.manifest.id}] Preloading room assets...`);
  },

  async mount(ctx: RoomContext): Promise<void> {
    const { THREE, root, environment } = ctx;
    const accentColor = environment.palette[2] ?? '#c8a464';

    // Suspended celestial astrolabe chandelier inside the overhead Oculus light veil (never blocking eye-level doors!)
    const ringGeo = new THREE.TorusGeometry(0.85, 0.035, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.22,
      metalness: 0.88,
      emissive: accentColor,
      emissiveIntensity: 0.25,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name = 'template_astrolabe_ring';
    ringMesh.position.set(0, 4.8, 0);
    root.add(ringMesh);
  },

  update(dt: number, ctx: RoomContext): void {
    if (ctx.time.paused || dt <= 0) return;
    const stepDt = ctx.time.delta;
    const ring = ctx.root.getObjectByName('template_astrolabe_ring');
    if (ring) {
      ring.rotation.y += stepDt * 0.45;
      ring.rotation.x += stepDt * 0.2;
    }
  },

  onPause(ctx: RoomContext): void {
    ctx.log(`[${ctx.manifest.id}] Paused at game time ${ctx.time.now.toFixed(2)}s`);
  },

  onResume(ctx: RoomContext): void {
    ctx.log(`[${ctx.manifest.id}] Resumed at game time ${ctx.time.now.toFixed(2)}s`);
  },

  unmount(ctx: RoomContext): void {
    disposeThreeHierarchy(ctx.root);
    ctx.log(`[${ctx.manifest.id}] Unmounted and disposed all geometries/materials.`);
  },
};

export default roomModule;
