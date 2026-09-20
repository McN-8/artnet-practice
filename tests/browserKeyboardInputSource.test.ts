import assert from "node:assert/strict";
import test from "node:test";
import { BrowserKeyboardInputSource } from
  "../src/browserKeyboardInputSource.js";
import { InputType } from "../src/inputType.js";
import type { ReaderInput } from "../src/subsystemAdapters.js";

class FakeRoot {
  private listener?: (event: KeyboardEvent) => void;

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject): void {
    this.listener = listener as (event: KeyboardEvent) => void;
  }
  removeEventListener(): void { delete this.listener; }

  press(key: string, options: Record<string, unknown> = {}): boolean {
    let prevented = false;
    const event = {
      key, repeat: false, altKey: false, ctrlKey: false,
      metaKey: false, isComposing: false, target: null,
      preventDefault: () => { prevented = true; },
      ...options
    } as unknown as KeyboardEvent;
    this.listener?.(event);
    return prevented;
  }
}

test("keyboard source maps focused reading controls and unsubscribes", () => {
  const root = new FakeRoot();
  const source = new BrowserKeyboardInputSource(
    root as unknown as HTMLElement, InputType.TAP_RIGHT, () => "detail"
  );
  const received: ReaderInput[] = [];
  const unsubscribe = source.subscribe((input) => received.push(input));
  for (const key of ["ArrowRight", "ArrowLeft", "Enter", " ",
    "ArrowUp", "ArrowDown", "+", "="]) {
    assert.equal(root.press(key), true);
  }
  assert.deepEqual(received.map((input) => input.type), [
    InputType.TAP_RIGHT, InputType.TAP_LEFT, InputType.TAP_RIGHT,
    InputType.HOLD, InputType.SWIPE_UP, InputType.SWIPE_DOWN,
    InputType.PINCH_ZOOM, InputType.PINCH_ZOOM
  ]);
  assert.ok(received.every((input) => input.targetId === "detail"));
  unsubscribe();
  assert.equal(root.press("ArrowRight"), false);
  assert.equal(received.length, 8);
  source.dispose();
  assert.equal(root.press("ArrowRight"), false);
});

test("editing, modifier, repeat, and composition keys pass through", () => {
  const root = new FakeRoot();
  const source = new BrowserKeyboardInputSource(root as unknown as HTMLElement);
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  assert.equal(root.press("ArrowRight", {repeat: true}), false);
  assert.equal(root.press("ArrowRight", {ctrlKey: true}), false);
  assert.equal(root.press("ArrowRight", {isComposing: true}), false);
  assert.equal(root.press("ArrowRight", {
    target: {closest: () => ({tagName: "INPUT"})}
  }), false);
  assert.equal(root.press("Escape"), false);
  assert.deepEqual(received, []);
  source.dispose();
});

test("Enter can map to double-tap without changing arrow navigation", () => {
  const root = new FakeRoot();
  const source = new BrowserKeyboardInputSource(
    root as unknown as HTMLElement, InputType.DOUBLE_TAP
  );
  const received: ReaderInput[] = [];
  source.subscribe((input) => received.push(input));
  root.press("Enter");
  root.press("ArrowRight");
  assert.deepEqual(received, [
    {type: InputType.DOUBLE_TAP}, {type: InputType.TAP_RIGHT}
  ]);
  source.dispose();
});
