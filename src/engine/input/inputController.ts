export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  yawDelta: number;
  pitchDelta: number;
  interactPressed: boolean;
}

export class InputController {
  private keys: Set<string> = new Set();
  private yawDelta = 0;
  private pitchDelta = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private interactQueued = false;
  private element: HTMLElement | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    // Do not hijack typing in input/textarea
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

    const code = e.code;
    this.keys.add(code);
    if (code === 'KeyE' || code === 'Enter' || code === 'Space') {
      this.interactQueued = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === this.element) {
      this.yawDelta -= e.movementX * 0.0028;
      this.pitchDelta = Math.max(
        -0.55,
        Math.min(0.55, this.pitchDelta - e.movementY * 0.0022)
      );
      return;
    }
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.yawDelta -= dx * 0.0045;
    this.pitchDelta = Math.max(-0.55, Math.min(0.55, this.pitchDelta - dy * 0.003));
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  public attach(element: HTMLElement): void {
    this.element = element;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.element) {
      this.element.removeEventListener('mousedown', this.onMouseDown);
    }
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
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
      turnLeft: this.keys.has('ArrowLeft') || this.keys.has('KeyQ'),
      turnRight: this.keys.has('ArrowRight') || this.keys.has('KeyR'),
      yawDelta: this.yawDelta,
      pitchDelta: this.pitchDelta,
      interactPressed: this.interactQueued,
    };
    this.yawDelta = 0;
    this.interactQueued = false;
    return state;
  }
}
