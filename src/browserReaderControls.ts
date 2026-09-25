import { InputType } from "./inputType.js";
import type { PresentationMode } from "./presentationMode.js";
import { isTraditionalPresentationMode } from "./presentationMode.js";
import type { State } from "./state.js";
import type { InputSource, ReaderInput } from "./subsystemAdapters.js";

export interface PagePosition {
  index: number;
  count: number;
}

const CONTROL_LABELS: ReadonlyArray<readonly [InputType, string]> = [
  [InputType.TAP_LEFT, "Previous"],
  [InputType.TAP_RIGHT, "Next"],
  [InputType.HOLD, "Inspect"],
  [InputType.DOUBLE_TAP, "Open detail"],
  [InputType.SWIPE_UP, "Move up"],
  [InputType.SWIPE_DOWN, "Move down"],
  [InputType.PINCH_ZOOM, "Zoom detail"]
];

/** Explicit browser controls: native buttons for every authored input type. */
export class BrowserReaderControls implements InputSource {
  private readonly listeners = new Set<(input: ReaderInput) => void>();
  private readonly container: HTMLElement;
  private readonly buttons: Array<{
    type: InputType;
    element: HTMLButtonElement;
    handler: () => void;
  }> = [];
  private available = new Set<InputType>(Object.values(InputType));
  private disposed = false;

  constructor(
    root: HTMLElement,
    private readonly targetId: () => string | undefined = () => undefined
  ) {
    const document = root.ownerDocument;
    this.container = document.createElement("nav");
    this.container.setAttribute("aria-label", "Story controls");
    for (const [type, label] of CONTROL_LABELS) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("data-input-type", type);
      button.style.minWidth = "44px";
      button.style.minHeight = "44px";
      const handler = () => this.emit(type);
      button.addEventListener("click", handler);
      this.container.append(button);
      this.buttons.push({type, element: button, handler});
    }
    root.append(this.container);
  }

  subscribe(listener: (input: ReaderInput) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Refresh after navigation or input-lock changes. The host owns that timing. */
  updateForState(
    state: State,
    mode: PresentationMode,
    pagePosition?: PagePosition,
    inputLocked: boolean = state.inputLocked
  ): void {
    const available = new Set<InputType>();
    if (!inputLocked) {
      const targetId = this.targetId();
      for (const prompt of state.prompts) {
        if (prompt.targetId === undefined || prompt.targetId === targetId) {
          available.add(prompt.inputType);
        }
      }
      if (isTraditionalPresentationMode(mode) && pagePosition) {
        if (pagePosition.index > 0) available.add(InputType.TAP_LEFT);
        if (pagePosition.index < pagePosition.count - 1) {
          available.add(InputType.TAP_RIGHT);
        }
      }
    }
    this.available = available;
    for (const {type, element} of this.buttons) {
      const enabled = available.has(type);
      element.hidden = !enabled;
      element.disabled = !enabled;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const {element, handler} of this.buttons) {
      element.removeEventListener("click", handler);
    }
    this.container.remove();
    this.listeners.clear();
  }

  private emit(type: InputType): void {
    if (!this.available.has(type) || this.listeners.size === 0) return;
    const targetId = this.targetId();
    const input: ReaderInput = targetId === undefined
      ? {type} : {type, targetId};
    for (const listener of [...this.listeners]) listener(input);
  }
}
