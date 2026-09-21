import { InputType } from "./inputType.js";
import type { InputSource, ReaderInput } from "./subsystemAdapters.js";

interface TouchStart {
  pointerId: number;
  x: number;
  y: number;
  time: number;
}

/** Minimal reader touch gestures: side taps and vertical swipes. */
export class BrowserTouchInputSource implements InputSource {
  private readonly listeners = new Set<(input: ReaderInput) => void>();
  private readonly activePointers = new Set<number>();
  private start: TouchStart | undefined;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly targetId: () => string | undefined = () => undefined
  ) {
    root.addEventListener("pointerdown", this.onDown);
    root.addEventListener("pointerup", this.onUp);
    root.addEventListener("pointercancel", this.onCancel);
  }

  subscribe(listener: (input: ReaderInput) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.start = undefined;
    this.activePointers.clear();
    this.root.removeEventListener("pointerdown", this.onDown);
    this.root.removeEventListener("pointerup", this.onUp);
    this.root.removeEventListener("pointercancel", this.onCancel);
    this.listeners.clear();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || this.listeners.size === 0) return;
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size !== 1) {
      // A second finger is not a tap or swipe. Pinch is a later adapter slice.
      this.start = undefined;
      return;
    }
    if (this.isInteractive(event.target)) return;
    this.start = {
      pointerId: event.pointerId, x: event.clientX,
      y: event.clientY, time: event.timeStamp
    };
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    const singlePointer = this.activePointers.size === 1;
    this.activePointers.delete(event.pointerId);
    const start = this.start;
    if (!singlePointer || !start || event.pointerId !== start.pointerId) {
      return;
    }
    this.start = undefined;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = event.timeStamp - start.time;
    if (elapsed < 0 || elapsed > 500) return;

    let type: InputType;
    if (Math.abs(dy) >= 40 && Math.abs(dy) > Math.abs(dx)) {
      type = dy < 0 ? InputType.SWIPE_UP : InputType.SWIPE_DOWN;
    } else if (Math.abs(dx) <= 12 && Math.abs(dy) <= 12) {
      const bounds = this.root.getBoundingClientRect();
      if (bounds.width <= 0) return;
      type = start.x < bounds.left + bounds.width / 2
        ? InputType.TAP_LEFT : InputType.TAP_RIGHT;
    } else {
      return;
    }

    const targetId = this.targetId();
    const input: ReaderInput = targetId === undefined
      ? {type} : {type, targetId};
    for (const listener of [...this.listeners]) listener(input);
  };

  private readonly onCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.start?.pointerId === event.pointerId) this.start = undefined;
  };

  private isInteractive(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== "function") {
      return false;
    }
    return (target as Element).closest(
      "button, a, input, textarea, select, [contenteditable]:not([contenteditable='false'])"
    ) !== null;
  }
}
