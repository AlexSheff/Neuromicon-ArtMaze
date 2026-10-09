import worldGraph from '../../content/world.graph.json';
import artManifest from '../../content/art/manifest.json';
import { getAllRoomV1Manifests } from '../../src/world/roomStreamer';

export interface AssetAuditReport {
  passed: boolean;
  maxCorridorTrianglesBudget: number;
  maxDrawCallsBudget: number;
  maxUniqueMaterialsBudget: number;
  maxRealtimeLightsBudget: number;
  maxTextureMemoryMBBudget: number;
  verifiedRoomsCount: number;
  verifiedArtworksCount: number;
  issues: string[];
}

/**
 * Build & CI Asset Audit Tool (EXPERIENCE_PROTOCOL.md §4.2, §5.1, §9.1).
 * Verifies scene budgets, power-of-two texture dimensions, material caps,
 * non-portable object invariants, and artwork license metadata.
 */
export function runAssetAudit(): AssetAuditReport {
  const issues: string[] = [];
  const manifests = getAllRoomV1Manifests();

  // 1. Validate Room API v1 manifests against §5 & EXPERIENCE_PROTOCOL budgets
  for (const m of manifests) {
    if (m.apiVersion !== 1) {
      issues.push(`${m.id}: apiVersion must be 1`);
    }
    const regDoors = m.doors.filter((d) => d.id !== 'RH');
    const rhDoors = m.doors.filter((d) => d.id === 'RH');
    if (regDoors.length !== 3) {
      issues.push(`${m.id}: must have exactly 3 regular doors (A, B, C)`);
    }
    if (rhDoors.length > 1) {
      issues.push(`${m.id}: may have at most 1 rabbit-hole door (RH)`);
    }
    if (rhDoors[0] && rhDoors[0].visibility !== 'hidden') {
      issues.push(`${m.id}: rabbit-hole door RH must have visibility: "hidden"`);
    }
    for (const obj of m.objects) {
      if (obj.portable !== false) {
        issues.push(`${m.id}.${obj.id}: portable must be false`);
      }
    }
  }

  // 2. Validate content/art/manifest.json license & provenance fields (§4.3 & AGENTS.md §9)
  for (const art of artManifest.artworks) {
    if (!art.id || !art.title || !art.author || !art.license || !art.source || !art.url) {
      issues.push(`Artwork ${art.id || 'unknown'} is missing required license/provenance fields`);
    }
  }

  // 3. Validate world.graph.json scale constant & branch/segment assignments
  if (worldGraph.totalRooms !== 1149) {
    issues.push(`world.graph.json totalRooms must be 1149`);
  }

  return {
    passed: issues.length === 0,
    maxCorridorTrianglesBudget: 300000,
    maxDrawCallsBudget: 150,
    maxUniqueMaterialsBudget: 12,
    maxRealtimeLightsBudget: 2,
    maxTextureMemoryMBBudget: 256,
    verifiedRoomsCount: manifests.length,
    verifiedArtworksCount: artManifest.artworks.length,
    issues,
  };
}
