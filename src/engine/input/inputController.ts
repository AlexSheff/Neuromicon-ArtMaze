export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  analogForward?: number;
  analogStrafe?: number;
  analogTurn?: number;
  yawDelta: number;
  pitchDelta: number;
  interactPressed: boolean;
}

/**
 * Unified Action Input Layer (EXPERIENCE_PROTOCOL.md §7.4).
 * Maps desktop keyboard/mouse and XR controllers to high-level actions (move, turn, interact).
 * Resolves the README `R` key collision: Snap Turn uses `Q` / `E` (or ArrowLeft / ArrowRight),
 * while `Space` / Click / VR Trigger triggers `interact` and `R` is reserved for the Codex journal.
 */
export class InputController {
  private keys: Set<string> = new Set();
  private yawDelta = 0;
  private pitchAngle = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistance = 0;
  private interactQueued = false;
  private element: HTMLElement | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

    const code = e.code;
    this.keys.add(code);
    if (code === 'Enter' || code === 'Space' || code === 'KeyF') {
      this.interactQueued = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isDragging = true;
    this.dragDistance = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (document.pointerLockElement === this.element) {
      this.yawDelta -= e.movementX * 0.0026;
      this.pitchAngle = Math.max(
        -1.15,
        Math.min(1.15, this.pitchAngle - e.movementY * 0.0022)
      );
      return;
    }
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragDistance += Math.hypot(dx, dy);

    this.yawDelta -= dx * 0.0042;
    this.pitchAngle = Math.max(
      -1.15,
      Math.min(1.15, this.pitchAngle - dy * 0.0032)
    );
  };

  private onPointerUp = () => {
    this.isDragging = false;
  };

  public wasClickNotDrag(): boolean {
    return this.dragDistance < 6;
  }

  public setPitch(pitch: number): void {
    this.pitchAngle = Math.max(-1.15, Math.min(1.15, pitch));
  }

  public attach(element: HTMLElement): void {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.onPointerDown);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  public queueInteract(): void {
    this.interactQueued = true;
  }

  public consumeState(): InputState {
    const state: InputState = {
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA'),
      right: this.keys.has('KeyD'),
      // Snap turn assigned to Q / E and ArrowLeft / ArrowRight (no collision with R Codex!)
      turnLeft: this.keys.has('ArrowLeft') || this.keys.has('KeyQ'),
      turnRight: this.keys.has('ArrowRight') || this.keys.has('KeyE'),
      yawDelta: this.yawDelta,
      pitchDelta: this.pitchAngle,
      interactPressed: this.interactQueued,
    };
    this.yawDelta = 0;
    this.interactQueued = false;
    return state;
  }
}
