import { unlockDiscovery } from '../discovery/discoverySystem';

/**
 * Tracks continuous gaze duration on world targets and triggers observation
 * discoveries when the player deliberately pauses and sees rather than merely looks.
 */
export class ObservationSystem {
  private currentTargetId: string | null = null;
  private dwellSeconds = 0;
  private ignoredPaintingsMutationCount: Record<string, number> = {};

  public updateGaze(
    targetId: string | null,
    deltaSeconds: number,
    discoveryId?: string,
    roomId?: string
  ): { progress: number; triggeredDiscovery?: string } {
    if (!targetId) {
      this.currentTargetId = null;
      this.dwellSeconds = 0;
      return { progress: 0 };
    }

    if (this.currentTargetId !== targetId) {
      this.currentTargetId = targetId;
      this.dwellSeconds = 0;
    }

    this.dwellSeconds += deltaSeconds;
    const threshold = 1.6;
    const progress = Math.min(1, this.dwellSeconds / threshold);

    if (progress >= 1 && discoveryId) {
      const isNew = unlockDiscovery(discoveryId, roomId);
      if (isNew) {
        return { progress: 1, triggeredDiscovery: discoveryId };
      }
    }

    return { progress };
  }

  public notifyPaintingIgnored(paintingId: string): number {
    const next = (this.ignoredPaintingsMutationCount[paintingId] ?? 0) + 1;
    this.ignoredPaintingsMutationCount[paintingId] = next;
    return next;
  }

  public getPaintingMutationPhase(paintingId: string): number {
    return this.ignoredPaintingsMutationCount[paintingId] ?? 0;
  }
}

export const observationSystem = new ObservationSystem();
