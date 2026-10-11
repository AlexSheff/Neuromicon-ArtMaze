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
  pointerNdcX?: number;
  pointerNdcY?: number;
  pointerActive?: boolean;
}

/**
 * Unified Action Input Layer (EXPERIENCE_PROTOCOL.md §7.4).
 * Maps desktop keyboard/mouse and XR controllers to high-level actions (move, turn, interact).
 * Resolves the README `R` key collision: Snap Turn uses `Q` / `E` (or ArrowLeft / ArrowRight),
 * while `Space` / `Enter` / `F` / Canvas Click / VR Trigger triggers `interact` and `R` is reserved for the Codex journal.
 */
export class InputController {
  private keys: Set<string> = new Set();
  private yawDelta = 0;
  private pitchDelta = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistance = 0;
  private pointerNdcX = 0;
  private pointerNdcY = 0;
  private pointerActive = false;
  private interactQueued = false;
  private element: HTMLElement | null = null;

  private updatePointerNdc(clientX: number, clientY: number): void {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointerNdcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerActive = true;
  }

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
    this.updatePointerNdc(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (document.pointerLockElement === this.element) {
      this.pointerActive = false;
      this.yawDelta -= e.movementX * 0.0026;
      this.pitchDelta -= e.movementY * 0.0022;
      return;
    }
    if (this.element && e.target === this.element) {
      this.updatePointerNdc(e.clientX, e.clientY);
    }
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragDistance += Math.hypot(dx, dy);

    this.yawDelta -= dx * 0.0042;
    this.pitchDelta -= dy * 0.0032;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.element && e.target === this.element) {
      this.updatePointerNdc(e.clientX, e.clientY);
      if (this.dragDistance < 6) {
        this.interactQueued = true;
      }
    }
  };

  private onPointerLeave = () => {
    this.pointerActive = false;
  };

  public wasClickNotDrag(): boolean {
    return this.dragDistance < 6;
  }

  public attach(element: HTMLElement): void {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.onPointerDown);
      this.element.removeEventListener('pointerleave', this.onPointerLeave);
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
      pitchDelta: this.pitchDelta,
      interactPressed: this.interactQueued,
      pointerNdcX: this.pointerNdcX,
      pointerNdcY: this.pointerNdcY,
      pointerActive: this.pointerActive,
    };
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.interactQueued = false;
    return state;
  }
}
