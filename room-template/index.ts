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
    const secondaryColor = environment.palette[0] ?? '#4ea8de';

    // Perimeter Corner Wall Harmonic Resonators (keeps the central room & overhead Galaxy Oculus 100% open!)
    const cornerGroup = new THREE.Group();
    cornerGroup.name = 'template_perimeter_resonators';
    const corners = [
      { x: -7.1, z: -7.8 },
      { x: 7.1, z: -7.8 },
      { x: -7.1, z: 7.8 },
      { x: 7.1, z: 7.8 },
    ];
    const ringGeo = new THREE.TorusGeometry(0.38, 0.028, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.88,
      emissive: secondaryColor,
      emissiveIntensity: 0.32,
    });

    corners.forEach((c, idx) => {
      const m = new THREE.Mesh(ringGeo.clone(), ringMat.clone());
      m.position.set(c.x, 4.8, c.z);
      m.rotation.y = (idx * Math.PI) / 2 + Math.PI * 0.25;
      cornerGroup.add(m);
    });
    ringGeo.dispose();
    ringMat.dispose();
    root.add(cornerGroup);
  },

  update(ctx: RoomContext, dt: number): void {
    if (ctx.time.paused || dt <= 0) return;
    const stepDt = ctx.time.delta;
    const group = ctx.root.getObjectByName('template_perimeter_resonators');
    if (group) {
      group.children.forEach((child, idx) => {
        child.rotation.z += stepDt * (0.45 + idx * 0.08);
      });
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
