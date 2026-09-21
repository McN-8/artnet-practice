import assert from "node:assert/strict";
import test from "node:test";
import { BrowserReaderControls } from "../src/browserReaderControls.js";
import { InputType } from "../src/inputType.js";
import { Prompt } from "../src/prompt.js";
import { State } from "../src/state.js";
import { Transition } from "../src/transition.js";
import { TransitionEffect } from "../src/transitionEffect.js";
import type { ReaderInput } from "../src/subsystemAdapters.js";

class FakeElement {
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  style: Record<string, string> = {};
  textContent = "";
  type = "";
  hidden = false;
  disabled = false;
  private readonly handlers = new Map<string, () => void>();
  private parent?: FakeElement;

  constructor(readonly tagName: string, readonly ownerDocument: FakeDocument) {}
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  append(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }
  addEventListener(type: string, handler: () => void): void {
    this.handlers.set(type, handler);
  }
  removeEventListener(type: string): void { this.handlers.delete(type); }
  click(): void { this.handlers.get("click")?.(); }
  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter(
        (child) => child !== this
      );
    }
    delete this.parent;
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

test("visible native controls cover every input and preserve host content", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const existing = document.createElement("p");
  root.append(existing);
  const controls = new BrowserReaderControls(
    root as unknown as HTMLElement, () => "detail"
  );
  const nav = root.children[1]!;
  assert.equal(root.children[0], existing);
  assert.equal(nav.tagName, "nav");
  assert.equal(nav.attributes.get("aria-label"), "Story controls");
  assert.deepEqual(nav.children.map(
    (button) => button.attributes.get("data-input-type")
  ), [
    InputType.TAP_LEFT, InputType.TAP_RIGHT, InputType.HOLD,
    InputType.DOUBLE_TAP, InputType.SWIPE_UP, InputType.SWIPE_DOWN,
    InputType.PINCH_ZOOM
  ]);
  for (const button of nav.children) {
    assert.equal(button.tagName, "button");
    assert.equal(button.type, "button");
    assert.ok(button.textContent.length > 0);
    assert.equal(button.style.minWidth, "44px");
    assert.equal(button.style.minHeight, "44px");
  }

  const received: ReaderInput[] = [];
  const unsubscribe = controls.subscribe((input) => received.push(input));
  nav.children[0]!.click();
  nav.children[6]!.click();
  assert.deepEqual(received, [
    {type: InputType.TAP_LEFT, targetId: "detail"},
    {type: InputType.PINCH_ZOOM, targetId: "detail"}
  ]);
  unsubscribe();
  nav.children[1]!.click();
  assert.equal(received.length, 2);
  controls.dispose();
  assert.deepEqual(root.children, [existing]);
  nav.children[0]!.click();
  assert.equal(received.length, 2);
});

test("controls expose only actionable interactive prompts and target matches", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  let target = "detail";
  const controls = new BrowserReaderControls(
    root as unknown as HTMLElement, () => target
  );
  const state = new State("one", "one.png", "Scene");
  const transition = new Transition("two", new TransitionEffect("none", 0));
  state.addPrompt(new Prompt(InputType.TAP_RIGHT, transition));
  state.addPrompt(new Prompt(InputType.PINCH_ZOOM, transition, "detail"));
  state.addPrompt(new Prompt(InputType.HOLD, transition, "other"));
  controls.updateForState(state, "interactive");
  const buttons = root.children[0]!.children;
  assert.deepEqual(buttons.filter((button) => !button.hidden).map(
    (button) => button.attributes.get("data-input-type")
  ), [InputType.TAP_RIGHT, InputType.PINCH_ZOOM]);
  const received: ReaderInput[] = [];
  controls.subscribe((input) => received.push(input));
  buttons[2]!.click();
  buttons[6]!.click();
  assert.deepEqual(received, [
    {type: InputType.PINCH_ZOOM, targetId: "detail"}
  ]);
  target = "other";
  controls.updateForState(state, "interactive");
  assert.equal(buttons[2]!.hidden, false);
  assert.equal(buttons[6]!.disabled, true);
  state.inputLocked = true;
  controls.updateForState(state, "interactive");
  assert.ok(buttons.every((button) => button.disabled && button.hidden));
  controls.dispose();
});

test("traditional controls respect page boundaries", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const controls = new BrowserReaderControls(root as unknown as HTMLElement);
  const page = new State("page", "page.png", "Page");
  const buttons = root.children[0]!.children;
  controls.updateForState(page, "paged", {index: 0, count: 3});
  assert.equal(buttons[0]!.hidden, true);
  assert.equal(buttons[1]!.hidden, false);
  controls.updateForState(page, "verticalScroll", {index: 1, count: 3});
  assert.equal(buttons[0]!.hidden, false);
  assert.equal(buttons[1]!.hidden, false);
  controls.updateForState(page, "paged", {index: 2, count: 3});
  assert.equal(buttons[0]!.hidden, false);
  assert.equal(buttons[1]!.hidden, true);
  controls.dispose();
});
