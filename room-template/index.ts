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
    // Keep the overhead oculus open: the mounted nebula rig supplies the room's key light.
    // Emissive wall, portal, and floor accents belong to each room's own composition.
    ctx.log(`[${ctx.manifest.id}] Mounted fixture-free cosmic room template.`);
  },

  update(dt: number, ctx: RoomContext): void {
    if (ctx.time.paused || dt <= 0) return;
    // Template stays intentionally fixture-free; room modules animate only their own art.
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
