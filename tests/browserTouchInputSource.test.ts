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

test("touch source rejects scroll-like ambiguity, moved long press, and cancellation", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(root as unknown as HTMLElement);
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 250, 80, 0);
  root.emit("pointerup", 270, 90, 30);
  root.emit("pointerdown", 250, 80, 100);
  root.emit("pointerup", 270, 80, 700);
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

test("stationary touch hold emits once on release, never a tap", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(
    root as unknown as HTMLElement, () => "inspect-target"
  );
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 450, 80, 0);
  root.emit("pointerup", 455, 85, 499);
  assert.deepEqual(received, [
    {type: InputType.TAP_RIGHT, targetId: "inspect-target"}
  ]);
  root.emit("pointerdown", 450, 80, 600);
  root.emit("pointerup", 455, 85, 1100);
  assert.deepEqual(received, [
    {type: InputType.TAP_RIGHT, targetId: "inspect-target"},
    {type: InputType.HOLD, targetId: "inspect-target"}
  ]);
  root.emit("pointerup", 455, 85, 1200);
  assert.equal(received.length, 2);
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

test("two-finger distance change emits one targeted pinch", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(
    root as unknown as HTMLElement, () => "zoom-region"
  );
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 200, 100, 0, {pointerId: 1});
  root.emit("pointerdown", 300, 100, 5, {pointerId: 2});
  root.emit("pointermove", 315, 100, 10, {pointerId: 2});
  assert.deepEqual(received, []);
  root.emit("pointermove", 330, 100, 15, {pointerId: 2});
  root.emit("pointermove", 360, 100, 20, {pointerId: 2});
  assert.deepEqual(received, [{
    type: InputType.PINCH_ZOOM, targetId: "zoom-region"
  }]);
  root.emit("pointerup", 200, 100, 25, {pointerId: 1});
  root.emit("pointerup", 360, 100, 30, {pointerId: 2});
  assert.equal(received.length, 1);
  source.dispose();
});

test("small two-finger changes and a third finger do not emit", () => {
  const root = new FakeRoot();
  const source = new BrowserTouchInputSource(root as unknown as HTMLElement);
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.emit("pointerdown", 200, 100, 0, {pointerId: 1});
  root.emit("pointerdown", 300, 100, 5, {pointerId: 2});
  root.emit("pointermove", 310, 100, 10, {pointerId: 2});
  root.emit("pointerdown", 250, 150, 15, {pointerId: 3});
  root.emit("pointermove", 400, 100, 20, {pointerId: 2});
  assert.deepEqual(received, []);
  source.dispose();
});
