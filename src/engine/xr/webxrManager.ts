export interface XRStatus {
  supported: boolean;
  active: boolean;
  mode: 'immersive-vr' | 'desktop';
  message: string;
}

class WebXRManager {
  private currentSession: unknown = null;
  private supported = false;

  public async checkSupport(): Promise<boolean> {
    try {
      const nav = navigator as unknown as {
        xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
      };
      if (nav.xr && typeof nav.xr.isSessionSupported === 'function') {
        this.supported = await nav.xr.isSessionSupported('immersive-vr');
        return this.supported;
      }
    } catch {
      this.supported = false;
    }
    return false;
  }

  public async toggleVRSession(): Promise<XRStatus> {
    const nav = navigator as unknown as {
      xr?: {
        isSessionSupported?: (mode: string) => Promise<boolean>;
        requestSession?: (mode: string, options?: unknown) => Promise<{ end: () => Promise<void> }>;
      };
    };

    if (this.currentSession) {
      try {
        await (this.currentSession as { end: () => Promise<void> }).end();
      } catch {
        // Ignore session termination errors
      }
      this.currentSession = null;
      return {
        supported: this.supported,
        active: false,
        mode: 'desktop',
        message: 'Exited WebXR session. Returned to desktop viewport.',
      };
    }

    if (!nav.xr || typeof nav.xr.requestSession !== 'function') {
      return {
        supported: false,
        active: false,
        mode: 'desktop',
        message: 'WebXR headset not detected in this browser. Running in Desktop 3D mode.',
      };
    }

    try {
      const isOk = await this.checkSupport();
      if (!isOk) {
        return {
          supported: false,
          active: false,
          mode: 'desktop',
          message: 'Meta Quest / WebXR immersive-vr session is not available on this device.',
        };
      }
      const session = await nav.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      this.currentSession = session;
      return {
        supported: true,
        active: true,
        mode: 'immersive-vr',
        message: 'WebXR immersive-vr session active (72Hz target).',
      };
    } catch (err) {
      return {
        supported: this.supported,
        active: false,
        mode: 'desktop',
        message: `WebXR session unavailable (${err instanceof Error ? err.message : 'fallback to desktop'}).`,
      };
    }
  }
}

export const webxrManager = new WebXRManager();
