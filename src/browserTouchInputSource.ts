import { InputType } from "./inputType.js";
import { SystemClock } from "./clock.js";
import type { Clock, ClockTimer } from "./clock.js";
import type { InputSource, ReaderInput } from "./subsystemAdapters.js";

interface TouchStart {
  pointerId: number;
  x: number;
  y: number;
  time: number;
}

interface TouchPoint { x: number; y: number; }

interface PendingTap {
  type: InputType.TAP_LEFT | InputType.TAP_RIGHT;
  x: number;
  y: number;
  time: number;
  targetId: string | undefined;
  timer: ClockTimer;
}

/** Minimal reader touch gestures: side taps, hold, vertical swipes, and pinch. */
export class BrowserTouchInputSource implements InputSource {
  private readonly listeners = new Set<(input: ReaderInput) => void>();
  private readonly activePointers = new Map<number, TouchPoint>();
  private start: TouchStart | undefined;
  private pinchStartDistance: number | undefined;
  private pinchEmitted = false;
  private pendingTap: PendingTap | undefined;
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly targetId: () => string | undefined = () => undefined,
    private readonly doubleTapEnabled: () => boolean = () => false,
    private readonly clock: Clock = new SystemClock()
  ) {
    root.addEventListener("pointerdown", this.onDown);
    root.addEventListener("pointermove", this.onMove);
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
    this.pinchStartDistance = undefined;
    this.pinchEmitted = false;
    this.cancelPendingTap();
    this.activePointers.clear();
    this.root.removeEventListener("pointerdown", this.onDown);
    this.root.removeEventListener("pointermove", this.onMove);
    this.root.removeEventListener("pointerup", this.onUp);
    this.root.removeEventListener("pointercancel", this.onCancel);
    this.listeners.clear();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || this.listeners.size === 0) return;
    if (this.isInteractive(event.target)) return;
    this.activePointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY
    });
    if (this.activePointers.size === 2) {
      this.start = undefined;
      this.pinchStartDistance = this.pointerDistance();
      this.pinchEmitted = false;
      return;
    }
    if (this.activePointers.size !== 1) {
      this.resetGesture();
      return;
    }
    this.start = {
      pointerId: event.pointerId, x: event.clientX,
      y: event.clientY, time: event.timeStamp
    };
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" ||
      !this.activePointers.has(event.pointerId)) return;
    this.activePointers.set(event.pointerId, {
      x: event.clientX, y: event.clientY
    });
    if (this.activePointers.size !== 2 || this.pinchEmitted ||
      this.pinchStartDistance === undefined ||
      this.pinchStartDistance === 0) return;
    const distance = this.pointerDistance();
    if (distance === undefined) return;
    const change = Math.abs(distance - this.pinchStartDistance);
    if (change < 24 || change / this.pinchStartDistance < 0.2) return;
    this.pinchEmitted = true;
    this.emit(InputType.PINCH_ZOOM);
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") return;
    const singlePointer = this.activePointers.size === 1;
    this.activePointers.delete(event.pointerId);
    const start = this.start;
    if (!singlePointer || !start || event.pointerId !== start.pointerId) {
      if (this.activePointers.size === 0) this.resetGesture();
      return;
    }
    this.start = undefined;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = event.timeStamp - start.time;
    if (elapsed < 0) return;

    // Hold is a one-shot input on release; it cannot also become a tap.
    if (Math.abs(dx) <= 12 && Math.abs(dy) <= 12 && elapsed >= 500) {
      this.emit(InputType.HOLD);
      return;
    }
    if (elapsed > 500) return;

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

    if (type === InputType.TAP_LEFT || type === InputType.TAP_RIGHT) {
      this.handleTap(type, event.clientX, event.clientY, event.timeStamp);
    } else {
      this.emit(type);
    }
  };

  private readonly onCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.start?.pointerId === event.pointerId) this.start = undefined;
    if (this.activePointers.size < 2) this.pinchStartDistance = undefined;
  };

  private pointerDistance(): number | undefined {
    const [first, second] = [...this.activePointers.values()];
    if (!first || !second) return undefined;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private emit(type: InputType): void {
    const targetId = this.targetId();
    this.emitInput(type, targetId);
  }

  private emitInput(type: InputType, targetId: string | undefined): void {
    const input: ReaderInput = targetId === undefined
      ? {type} : {type, targetId};
    for (const listener of [...this.listeners]) listener(input);
  }

  private handleTap(
    type: InputType.TAP_LEFT | InputType.TAP_RIGHT,
    x: number,
    y: number,
    time: number
  ): void {
    if (!this.doubleTapEnabled()) {
      this.cancelPendingTap(true);
      this.emit(type);
      return;
    }
    const targetId = this.targetId();
    const pending = this.pendingTap;
    if (pending && time >= pending.time && time - pending.time <= 300 &&
      Math.hypot(x - pending.x, y - pending.y) <= 24 &&
      targetId === pending.targetId) {
      this.cancelPendingTap();
      this.emitInput(InputType.DOUBLE_TAP, targetId);
      return;
    }
    this.cancelPendingTap(true);
    const tap: Omit<PendingTap, "timer"> = {type, x, y, time, targetId};
    const timer = this.clock.setTimeout(() => {
      if (this.pendingTap?.timer !== timer) return;
      this.pendingTap = undefined;
      this.emitInput(tap.type, tap.targetId);
    }, 300);
    this.pendingTap = {...tap, timer};
  }

  private cancelPendingTap(emit: boolean = false): void {
    const pending = this.pendingTap;
    if (!pending) return;
    this.clock.clearTimeout(pending.timer);
    this.pendingTap = undefined;
    if (emit) this.emitInput(pending.type, pending.targetId);
  }

  private resetGesture(): void {
    this.start = undefined;
    this.pinchStartDistance = undefined;
    this.pinchEmitted = false;
    if (this.activePointers.size > 2) this.activePointers.clear();
  }

  private isInteractive(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== "function") {
      return false;
    }
    return (target as Element).closest(
      "button, a, input, textarea, select, [contenteditable]:not([contenteditable='false'])"
    ) !== null;
  }
}
