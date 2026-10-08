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
  headYaw: number | null;
  headPitch: number | null;
}

export type XRFrameRenderCallback = (
  timeSec: number,
  dt: number,
  xrInput: XRControllerInput,
  eyeIndex: number,
  eyeOffsetX: number,
  targetCanvas: HTMLCanvasElement
) => void;

interface WebXRSessionLike {
  renderState: { baseLayer?: { framebuffer: WebGLFramebuffer | null; getViewport: (view: unknown) => { x: number; y: number; width: number; height: number } } };
  inputSources?: Iterable<{
    handedness?: 'left' | 'right' | 'none';
    gamepad?: {
      axes: readonly number[];
      buttons: readonly { pressed: boolean }[];
    };
  }>;
  updateRenderState: (state: unknown) => void;
  requestReferenceSpace: (type: string) => Promise<unknown>;
  requestAnimationFrame: (cb: (time: number, frame: unknown) => void) => number;
  addEventListener: (type: string, listener: () => void) => void;
  end: () => Promise<void>;
}

const VERT_SHADER = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG_SHADER = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_tex;
  void main() {
    gl_FragColor = texture2D(u_tex, v_uv);
  }
`;

function quaternionToYawPitch(q: { x: number; y: number; z: number; w: number }): {
  yaw: number;
  pitch: number;
} {
  // Yaw (rotation around Y)
  const siny_cosp = 2 * (q.w * q.y + q.x * q.z);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.x * q.x);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  // Pitch (rotation around X)
  const sinp = 2 * (q.w * q.x - q.z * q.y);
  const pitch =
    Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);

  return { yaw, pitch: Math.max(-0.65, Math.min(0.65, pitch)) };
}

class WebXRManager {
  private currentSession: WebXRSessionLike | null = null;
  private supported = false;
  private xrCanvas: HTMLCanvasElement | null = null;
  private offscreen2DCanvas: HTMLCanvasElement | null = null;
  private frameCallback: XRFrameRenderCallback | null = null;
  private wasTriggerPressed = false;
  private lastFrameTime = 0;

  public setFrameRenderCallback(cb: XRFrameRenderCallback | null): void {
    this.frameCallback = cb;
  }

  public isSessionActive(): boolean {
    return this.currentSession !== null;
  }

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
        requestSession?: (
          mode: string,
          options?: unknown
        ) => Promise<WebXRSessionLike>;
      };
    };

    if (this.currentSession) {
      try {
        await this.currentSession.end();
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
        message:
          'WebXR headset not detected (requires HTTPS on Meta Quest Browser). Running in Desktop 3D mode.',
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
            'Meta Quest / WebXR immersive-vr session is not available on this device. Open in Meta Quest Browser over HTTPS.',
        };
      }

      const session = await nav.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      this.currentSession = session;

      await this.initializeXRWebGLLoop(session);

      return {
        supported: true,
        active: true,
        mode: 'immersive-vr',
        message:
          'Meta Quest 2 WebXR session active (Stereo XRWebGLLayer + Touch Controllers enabled).',
      };
    } catch (err) {
      this.currentSession = null;
      return {
        supported: this.supported,
        active: false,
        mode: 'desktop',
        message: `WebXR session unavailable (${
          err instanceof Error ? err.message : 'fallback to desktop'
        }).`,
      };
    }
  }

  private async initializeXRWebGLLoop(session: WebXRSessionLike): Promise<void> {
    if (!this.xrCanvas) {
      this.xrCanvas = document.createElement('canvas');
    }
    if (!this.offscreen2DCanvas) {
      this.offscreen2DCanvas = document.createElement('canvas');
      this.offscreen2DCanvas.width = 1280;
      this.offscreen2DCanvas.height = 1280;
    }

    const gl = (this.xrCanvas.getContext('webgl2', { xrCompatible: true }) ||
      this.xrCanvas.getContext('webgl', {
        xrCompatible: true,
      })) as WebGLRenderingContext | null;

    if (!gl) {
      throw new Error('Could not create xrCompatible WebGL context');
    }

    // Compile stereo texture blit shader for XRWebGLLayer
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERT_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAG_SHADER);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const posBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const XRWebGLLayerCtor = (
      window as unknown as {
        XRWebGLLayer: new (
          s: unknown,
          context: WebGLRenderingContext
        ) => unknown;
      }
    ).XRWebGLLayer;

    const baseLayer = new XRWebGLLayerCtor(session, gl);
    session.updateRenderState({ baseLayer });

    let refSpace: unknown;
    try {
      refSpace = await session.requestReferenceSpace('local-floor');
    } catch {
      refSpace = await session.requestReferenceSpace('local');
    }

    session.addEventListener('end', () => {
      this.currentSession = null;
    });

    this.lastFrameTime = performance.now();

    const onXRFrame = (time: number, frame: unknown) => {
      if (!this.currentSession) return;
      session.requestAnimationFrame(onXRFrame);

      const dt = Math.min(0.1, Math.max(0.001, (time - this.lastFrameTime) / 1000));
      this.lastFrameTime = time;

      const xrFrame = frame as {
        getViewerPose: (space: unknown) => {
          transform: {
            orientation: { x: number; y: number; z: number; w: number };
          };
          views: Array<{
            eye?: string;
            transform: { position: { x: number; y: number; z: number } };
          }>;
        } | null;
      };

      const pose = xrFrame.getViewerPose(refSpace);
      if (!pose) return;

      // Read Oculus Quest 2 Touch Controllers (thumbsticks + triggers)
      let moveX = 0;
      let moveZ = 0;
      let turnX = 0;
      let triggerPressedNow = false;

      if (session.inputSources) {
        for (const source of session.inputSources) {
          const gp = source.gamepad;
          if (!gp) continue;
          const axX = gp.axes[2] ?? gp.axes[0] ?? 0;
          const axY = gp.axes[3] ?? gp.axes[1] ?? 0;

          if (source.handedness === 'left') {
            if (Math.abs(axX) > 0.15) moveX += axX;
            if (Math.abs(axY) > 0.15) moveZ += axY;
          } else if (source.handedness === 'right') {
            if (Math.abs(axX) > 0.18) turnX += axX;
            if (Math.abs(axY) > 0.25) moveZ += axY;
          } else {
            if (Math.abs(axY) > 0.15) moveZ += axY;
            if (Math.abs(axX) > 0.18) turnX += axX;
          }

          // Primary index trigger (button 0) or A/X button (button 4)
          if (gp.buttons[0]?.pressed || gp.buttons[4]?.pressed) {
            triggerPressedNow = true;
          }
        }
      }

      const triggerJustPressed = triggerPressedNow && !this.wasTriggerPressed;
      this.wasTriggerPressed = triggerPressedNow;

      const headAngles = quaternionToYawPitch(pose.transform.orientation);
      const layer = session.renderState.baseLayer;
      if (!layer || !this.offscreen2DCanvas) return;

      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(0.04, 0.04, 0.035, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(prog);
      const posLoc = gl.getAttribLocation(prog, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      pose.views.forEach((view, eyeIdx) => {
        const vp = layer.getViewport(view);
        gl.viewport(vp.x, vp.y, vp.width, vp.height);

        if (this.frameCallback && this.offscreen2DCanvas) {
          const eyeOffset =
            view.eye === 'left' ? -0.032 : view.eye === 'right' ? 0.032 : 0;
          this.frameCallback(
            time / 1000,
             eyeIdx === 0 ? dt : 0,
            {
              moveX,
              moveZ,
              turnX,
              triggerJustPressed: eyeIdx === 0 ? triggerJustPressed : false,
              headYaw: headAngles.yaw,
              headPitch: headAngles.pitch,
            },
            eyeIdx,
            eyeOffset,
            this.offscreen2DCanvas
          );

          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.offscreen2DCanvas
          );
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      });
    };

    session.requestAnimationFrame(onXRFrame);
  }
}

export const webxrManager = new WebXRManager();
