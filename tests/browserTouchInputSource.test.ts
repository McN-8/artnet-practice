import assert from "node:assert/strict";
import test from "node:test";
import { BrowserTouchInputSource } from
  "../src/browserTouchInputSource.js";
import { InputType } from "../src/inputType.js";
import type { ReaderInput } from "../src/subsystemAdapters.js";

class FakeRoot {
  private readonly handlers = new Map<string, (event: PointerEvent) => void>();
  addEventListener(type: string, handler: EventListenerOrEventListenerObject): void {
    this.handlers.set(type, handler as (event: PointerEvent) => void);
  }
  removeEventListener(type: string): void { this.handlers.delete(type); }
  getBoundingClientRect(): {left: number; width: number} {
    return {left: 100, width: 400};
  }
  emit(type: string, x: number, y: number, time: number,
    options: Record<string, unknown> = {}): void {
    this.handlers.get(type)?.({
      pointerType: "touch", pointerId: 1, clientX: x,
      clientY: y, timeStamp: time, target: null, ...options
    } as PointerEvent);
  }
  listenerCount(): number { return this.handlers.size; }
}

test("touch source maps side taps and vertical swipes", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(
    root as unknown as HTMLElement, () => "panel-1"
  );
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 150, 80, 0);
  root.emit("pointerup", 152, 82, 50);
  root.emit("pointerdown", 450, 80, 100);
  root.emit("pointerup", 449, 81, 150);
  root.emit("pointerdown", 250, 180, 200);
  root.emit("pointerup", 250, 110, 300);
  root.emit("pointerdown", 250, 110, 400);
  root.emit("pointerup", 250, 180, 500);
  assert.deepEqual(received, [
    {type: InputType.TAP_LEFT, targetId: "panel-1"},
    {type: InputType.TAP_RIGHT, targetId: "panel-1"},
    {type: InputType.SWIPE_UP, targetId: "panel-1"},
    {type: InputType.SWIPE_DOWN, targetId: "panel-1"}
  ]);
  source.dispose();
  assert.equal(root.listenerCount(), 0);
});

test("touch source rejects scroll-like ambiguity, long press, and cancellation", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(root as unknown as HTMLElement);
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 250, 80, 0);
  root.emit("pointerup", 270, 90, 30);
  root.emit("pointerdown", 250, 80, 100);
  root.emit("pointerup", 250, 80, 700);
  root.emit("pointerdown", 250, 80, 800);
  root.emit("pointercancel", 250, 80, 850);
  root.emit("pointerup", 250, 80, 900);
  root.emit("pointerdown", 250, 80, 1000, {pointerType: "mouse"});
  root.emit("pointerup", 250, 80, 1020, {pointerType: "mouse"});
  root.emit("pointerdown", 250, 80, 1100, {
    target: {closest: () => ({tagName: "BUTTON"})}
  });
  root.emit("pointerup", 250, 80, 1120);
  assert.deepEqual(received, []);
  source.dispose();
});

test("second finger cancels a gesture and unsubscribe stops delivery", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(root as unknown as HTMLElement);
  const received: ReaderInput[] = [];
  const unsubscribe = source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 400, 80, 0);
  root.emit("pointerdown", 200, 80, 10, {pointerId: 2});
  root.emit("pointerup", 400, 80, 20);
  root.emit("pointerup", 200, 80, 30, {pointerId: 2});
  assert.deepEqual(received, []);
  unsubscribe();
  root.emit("pointerdown", 400, 80, 40);
  root.emit("pointerup", 400, 80, 50);
  assert.deepEqual(received, []);
  source.dispose();
});
