import * as THREE from 'three';

export interface XRStatus {
  supported: boolean;
  active: boolean;
  mode: 'immersive-vr' | 'desktop';
  message: string;
}

export interface XRControllerInput {
  moveX: number;
  moveZ: number;
  turnX: number;
  triggerJustPressed: boolean;
  squeezeJustPressed?: boolean;
  pauseJustPressed?: boolean;
  teleportStickJustTriggered?: boolean;
}

function applyRadialDeadzone(
  rawX: number,
  rawY: number,
  deadzone = 0.14
): { x: number; y: number } {
  const mag = Math.hypot(rawX, rawY);
  if (mag <= deadzone) return { x: 0, y: 0 };
  const norm = Math.min(1, (mag - deadzone) / (1 - deadzone));
  // Gentle quadratic blend for fine low-speed control and full speed at rim
  const curved = norm * (0.35 + 0.65 * norm);
  return {
    x: (rawX / mag) * curved,
    y: (rawY / mag) * curved,
  };
}

class WebXRManager {
  private renderer: THREE.WebGLRenderer | null = null;
  private currentSession: XRSession | null = null;
  private supported = false;
  private wasTriggerPressed = false;
  private wasSqueezePressed = false;
  private wasPausePressed = false;
  private wasRightStickForward = false;
  private selectQueued = false;
  private squeezeQueued = false;
  private snapTurnCooldown = 0;
  private statusListeners: Set<(active: boolean) => void> = new Set();
  private visibilityPauseListeners: Set<() => void> = new Set();

  public attachRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.renderer.xr.enabled = true;
    // 'local-floor' gives true 1:1 physical floor height in meters on Meta Quest 2
    this.renderer.xr.setReferenceSpaceType('local-floor');
  }

  public onSessionChange(listener: (active: boolean) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onVisibilityBlurred(listener: () => void): () => void {
    this.visibilityPauseListeners.add(listener);
    return () => {
      this.visibilityPauseListeners.delete(listener);
    };
  }

  private notifySessionChange(active: boolean): void {
    this.statusListeners.forEach((cb) => cb(active));
  }

  public isSessionActive(): boolean {
    return Boolean(this.renderer?.xr.isPresenting);
  }

  public async checkSupport(): Promise<boolean> {
    try {
      if ('xr' in navigator && navigator.xr) {
        this.supported = await navigator.xr.isSessionSupported('immersive-vr');
        return this.supported;
      }
    } catch {
      this.supported = false;
    }
    return false;
  }

  public async toggleVRSession(): Promise<XRStatus> {
    if (this.currentSession) {
      try {
        await this.currentSession.end();
      } catch {
        // Ignore session close error
      }
      this.currentSession = null;
      this.notifySessionChange(false);
      return {
        supported: this.supported,
        active: false,
        mode: 'desktop',
        message: 'Exited WebXR session. Returned to desktop 3D viewport.',
      };
    }

    if (!('xr' in navigator) || !navigator.xr) {
      return {
        supported: false,
        active: false,
        mode: 'desktop',
        message:
          'WebXR API not detected. Open via HTTPS in Meta Quest Browser on Quest 2.',
      };
    }

    if (!this.renderer) {
      return {
        supported: false,
        active: false,
        mode: 'desktop',
        message: '3D WebGLRenderer is not initialized yet.',
      };
    }

    try {
      const isOk = await this.checkSupport();
      if (!isOk) {
        return {
          supported: false,
          active: false,
          mode: 'desktop',
          message:
            'Meta Quest immersive-vr session is not available on this device.',
        };
      }

      const sessionInit: XRSessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      };

      const session = await navigator.xr.requestSession(
        'immersive-vr',
        sessionInit
      );

      this.currentSession = session;

      const onSelectStart = () => {
        this.selectQueued = true;
      };
      const onVisibilityChange = () => {
        if (session.visibilityState !== 'visible') {
          this.visibilityPauseListeners.forEach((cb) => cb());
        }
      };
      session.addEventListener('selectstart', onSelectStart);
      session.addEventListener('visibilitychange', onVisibilityChange);

      session.addEventListener('end', () => {
        session.removeEventListener('selectstart', onSelectStart);
        session.removeEventListener('visibilitychange', onVisibilityChange);
        this.currentSession = null;
        this.notifySessionChange(false);
      });

      await this.renderer.xr.setSession(session);
      this.notifySessionChange(true);

      return {
        supported: true,
        active: true,
        mode: 'immersive-vr',
        message:
          'Native 6DOF WebXR active on Meta Quest 2 (1:1 metric scale, hardware stereo projection).',
      };
    } catch (err) {
      this.currentSession = null;
      this.notifySessionChange(false);
      return {
        supported: this.supported,
        active: false,
        mode: 'desktop',
        message: `Could not start WebXR (${
          err instanceof Error ? err.message : 'fallback to desktop'
        }).`,
      };
    }
  }

  /**
   * Reads Oculus Touch / OpenXR controller thumbsticks and triggers from the active WebXR session.
   * Implements the standard VR dual-controller locomotion layout:
   * - Left Thumbstick (X/Y): 360° omni-directional movement (with radial deadzone & comfort curve)
   * - Right Thumbstick (X): Snap Turn Left / Right
   * - Right Thumbstick Forward (Y < -0.68) or Trigger on Floor: Point-and-Teleport step
   * - Index Trigger (Button 0) / A / X (Button 4): Spatial Ray Interact / Teleport
   * - Grip / Squeeze (Button 1): Quick Return
   * - B / Y / Menu (Button 5 / Button 3): World-Locked Pause
   */
  public pollControllerInput(dt = 0.016): XRControllerInput {
    const session = this.renderer?.xr.getSession();
    if (!session) {
      return {
        moveX: 0,
        moveZ: 0,
        turnX: 0,
        triggerJustPressed: false,
        squeezeJustPressed: false,
        pauseJustPressed: false,
        teleportStickJustTriggered: false,
      };
    }

    if (this.snapTurnCooldown > 0) {
      this.snapTurnCooldown = Math.max(0, this.snapTurnCooldown - dt);
    }

    let moveX = 0;
    let moveZ = 0;
    let turnX = 0;
    let triggerPressedNow = false;
    let squeezePressedNow = false;
    let pausePressedNow = false;
    let rightStickForwardNow = false;

    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp) continue;

      // Support both xr-standard thumbsticks on axes[2..3] and fallback/emulator sticks on axes[0..1]
      const primaryX = gp.axes[2] ?? 0;
      const primaryY = gp.axes[3] ?? 0;
      const secondaryX = gp.axes[0] ?? 0;
      const secondaryY = gp.axes[1] ?? 0;
      const rawX =
        Math.hypot(primaryX, primaryY) >= Math.hypot(secondaryX, secondaryY)
          ? primaryX
          : secondaryX;
      const rawY =
        Math.hypot(primaryX, primaryY) >= Math.hypot(secondaryX, secondaryY)
          ? primaryY
          : secondaryY;

      const filtered = applyRadialDeadzone(rawX, rawY, 0.14);

      if (source.handedness === 'left') {
        moveX += filtered.x;
        moveZ += filtered.y;
      } else if (source.handedness === 'right') {
        if (Math.abs(rawX) > 0.22) {
          turnX += rawX;
        }
        // Pushing Right Stick forward triggers teleport step; pushing backward steps back smoothly
        if (rawY < -0.68 && Math.abs(rawX) < 0.45) {
          rightStickForwardNow = true;
        } else if (Math.abs(filtered.y) > 0.2 && Math.abs(rawX) < 0.35) {
          moveZ += filtered.y * 0.85;
        }
      } else {
        moveX += filtered.x;
        moveZ += filtered.y;
      }

      // Button 0 = Index Trigger, Button 1 = Grip/Squeeze, Button 4 = A/X (Interact), Button 5 = B/Y (Pause, TZ.md §6.1)
      if (gp.buttons[0]?.pressed || gp.buttons[4]?.pressed) {
        triggerPressedNow = true;
      }
      if (gp.buttons[1]?.pressed) {
        squeezePressedNow = true;
      }
      if (gp.buttons[5]?.pressed) {
        pausePressedNow = true;
      }
    }

    const buttonEdge = triggerPressedNow && !this.wasTriggerPressed;
    this.wasTriggerPressed = triggerPressedNow;

    const squeezeEdge = squeezePressedNow && !this.wasSqueezePressed;
    this.wasSqueezePressed = squeezePressedNow;

    const pauseEdge = pausePressedNow && !this.wasPausePressed;
    this.wasPausePressed = pausePressedNow;

    const teleportStickEdge =
      rightStickForwardNow && !this.wasRightStickForward;
    this.wasRightStickForward = rightStickForwardNow;

    const triggerJustPressed = buttonEdge || this.selectQueued;
    this.selectQueued = false;

    const squeezeJustPressed = squeezeEdge || this.squeezeQueued;
    this.squeezeQueued = false;

    return {
      moveX: Math.max(-1, Math.min(1, moveX)),
      moveZ: Math.max(-1, Math.min(1, moveZ)),
      turnX: Math.max(-1, Math.min(1, turnX)),
      triggerJustPressed,
      squeezeJustPressed,
      pauseJustPressed: pauseEdge,
      teleportStickJustTriggered: teleportStickEdge,
    };
  }
}

export const webxrManager = new WebXRManager();
