import assert from "node:assert/strict";
import test from "node:test";
import { BrowserReaderControls } from "../src/browserReaderControls.js";
import { InputType } from "../src/inputType.js";
import type { ReaderInput } from "../src/subsystemAdapters.js";

class FakeElement {
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  style: Record<string, string> = {};
  textContent = "";
  type = "";
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
