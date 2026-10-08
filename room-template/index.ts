import { disposeThreeHierarchy, RoomContext, RoomModule } from '../src/room-sdk';

/**
 * Reference Room API v1 Module (`room-template/index.ts`).
 * Demonstrates building a room under `ctx.root`, rotating artifacts in `update(dt, ctx)`,
 * and disposing all GPU resources in `unmount(ctx)` to pass CI leak checks.
 */
const roomModule: RoomModule = {
  async preload(ctx: RoomContext): Promise<void> {
    ctx.log(`[${ctx.manifest.id}] Preloading room assets...`);
  },

  async mount(ctx: RoomContext): Promise<void> {
    const { THREE, root, manifest } = ctx;
    ctx.audio.playRoomTrack(manifest.audio.track, manifest.audio.baseHz ?? 108);

    // Floating sacred astrolabe ring in the center of the room
    const ringGeo = new THREE.TorusGeometry(0.65, 0.035, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#c8a464',
      roughness: 0.25,
      metalness: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name = 'template_astrolabe_ring';
    ringMesh.position.set(0, 2.1, -1.5);
    root.add(ringMesh);
  },

  update(dt: number, ctx: RoomContext): void {
    const ring = ctx.root.getObjectByName('template_astrolabe_ring');
    if (ring) {
      ring.rotation.y += dt * 0.45;
      ring.rotation.x += dt * 0.2;
    }
  },

  unmount(ctx: RoomContext): void {
    disposeThreeHierarchy(ctx.root);
    ctx.log(`[${ctx.manifest.id}] Unmounted and disposed all geometries/materials.`);
  },
};

export default roomModule;
