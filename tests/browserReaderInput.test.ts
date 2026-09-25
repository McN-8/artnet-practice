import assert from "node:assert/strict";
import test from "node:test";
import { BrowserReaderInput } from "../src/browserReaderInput.js";
import { AudioStack } from "../src/audioStack.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import { InputType } from "../src/inputType.js";
import { Prompt } from "../src/prompt.js";
import { State } from "../src/state.js";
import type { ReaderInput } from "../src/subsystemAdapters.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";

class FakeElement {
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  style: Record<string, string> = {};
  textContent = "";
  type = "";
  hidden = false;
  disabled = false;
  private parent?: FakeElement;
  private readonly handlers = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly tagName: string, readonly ownerDocument: FakeDocument) {}
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }
  addEventListener(type: string, handler: EventListenerOrEventListenerObject): void {
    const handlers = this.handlers.get(type) ?? new Set();
    handlers.add(handler as (event: unknown) => void);
    this.handlers.set(type, handlers);
  }
  removeEventListener(type: string, handler: EventListenerOrEventListenerObject): void {
    this.handlers.get(type)?.delete(handler as (event: unknown) => void);
  }
  dispatch(type: string, event: object = {}): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
  click(): void { this.dispatch("click"); }
  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(
        (child) => child !== this
      );
    }
    delete this.parent;
  }
  getBoundingClientRect(): {left: number; width: number} {
    return {left: 0, width: 400};
  }
  listenerCount(): number {
    return [...this.handlers.values()].reduce(
      (count, handlers) => count + handlers.size, 0
    );
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

function pointer(pointerId: number, x: number, time: number): object {
  return {
    pointerType: "touch", pointerId, clientX: x, clientY: 50,
    timeStamp: time, target: null
  };
}

test("browser reader input combines controls, keyboard, and touch", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const clock = new DeterministicClock();
  const input = new BrowserReaderInput(root as unknown as HTMLElement, {
    clock, targetId: () => "detail"
  });
  const transition = new Transition("two", new TransitionEffect("none", 0));
  const state = new State("one", "one.png", "Scene");
  state.addPrompt(new Prompt(InputType.TAP_RIGHT, transition));
  state.addPrompt(new Prompt(InputType.DOUBLE_TAP, transition, "detail"));
  input.updateForState(state, "interactive");
  const received: ReaderInput[] = [];
  input.subscribe((event) => received.push(event));

  root.dispatch("keydown", {
    key: "ArrowRight", repeat: false, altKey: false, ctrlKey: false,
    metaKey: false, isComposing: false, target: null,
    preventDefault: () => {}
  });
  const controls = root.children[0]!;
  controls.children[3]!.click();
  root.dispatch("pointerdown", pointer(1, 300, 0));
  root.dispatch("pointerup", pointer(1, 300, 20));
  root.dispatch("pointerdown", pointer(1, 302, 100));
  root.dispatch("pointerup", pointer(1, 302, 120));
  assert.deepEqual(received, [
    {type: InputType.TAP_RIGHT, targetId: "detail"},
    {type: InputType.DOUBLE_TAP, targetId: "detail"},
    {type: InputType.DOUBLE_TAP, targetId: "detail"}
  ]);
  assert.equal(clock.pendingTimerCount, 0);

  input.dispose();
  assert.equal(root.listenerCount(), 0);
  assert.equal(root.children.length, 0);
});

test("controller enables double-tap arbitration only for matching state target", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const clock = new DeterministicClock();
  const input = new BrowserReaderInput(root as unknown as HTMLElement, {
    clock, targetId: () => "visible"
  });
  const state = new State("one", "one.png", "Scene");
  state.addPrompt(new Prompt(
    InputType.DOUBLE_TAP,
    new Transition("two", new TransitionEffect("none", 0)),
    "other"
  ));
  input.updateForState(state, "interactive");
  const received: ReaderInput[] = [];
  input.subscribe((event) => received.push(event));
  root.dispatch("pointerdown", pointer(1, 300, 0));
  root.dispatch("pointerup", pointer(1, 300, 20));
  assert.deepEqual(received, [
    {type: InputType.TAP_RIGHT, targetId: "visible"}
  ]);
  assert.equal(clock.pendingTimerCount, 0);
  input.dispose();
});

test("connect binds engine input and refreshes traditional page controls", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const input = new BrowserReaderInput(root as unknown as HTMLElement);
  const first = new State("first", "first.png", "First");
  const second = new State("second", "second.png", "Second");
  first.configureInputLock(50);
  const clock = new DeterministicClock();
  const engine = new Engine(
    first, [first, second], new AudioStack(), 1, 2,
    clock, undefined, undefined, "paged"
  );
  const disconnect = input.connect(engine);
  engine.startState(first);
  const buttons = root.children[0]!.children;
  assert.equal(buttons[0]!.hidden, true);
  assert.equal(buttons[1]!.hidden, true);
  clock.advanceBy(50);
  assert.equal(buttons[1]!.hidden, false);
  buttons[1]!.click();
  assert.equal(engine.currentState, second);
  assert.equal(buttons[0]!.hidden, false);
  assert.equal(buttons[1]!.hidden, true);
  disconnect();
  buttons[0]!.click();
  assert.equal(engine.currentState, second);
  input.dispose();
});
