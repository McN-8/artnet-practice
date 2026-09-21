import { InputType } from "./inputType.js";
import type { InputSource, ReaderInput } from "./subsystemAdapters.js";

type EnterAction = InputType.TAP_RIGHT | InputType.DOUBLE_TAP;

/** Focus-scoped browser keyboard input for the reader surface. */
export class BrowserKeyboardInputSource implements InputSource {
  private readonly listeners = new Set<(input: ReaderInput) => void>();
  private disposed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly enterAction: EnterAction = InputType.TAP_RIGHT,
    private readonly targetId: () => string | undefined = () => undefined
  ) {
    root.addEventListener("keydown", this.onKeyDown);
  }

  subscribe(listener: (input: ReaderInput) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeEventListener("keydown", this.onKeyDown);
    this.listeners.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.listeners.size === 0 || event.repeat || event.altKey ||
      event.ctrlKey || event.metaKey ||
      event.isComposing || this.isEditing(event.target)) return;

    const type = this.resolveKey(event.key);
    if (!type) return;
    event.preventDefault();
    const targetId = this.targetId();
    const input: ReaderInput = targetId === undefined
      ? {type} : {type, targetId};
    for (const listener of [...this.listeners]) listener(input);
  };

  private resolveKey(key: string): InputType | undefined {
    switch (key) {
      case "ArrowRight": return InputType.TAP_RIGHT;
      case "ArrowLeft": return InputType.TAP_LEFT;
      case "Enter": return this.enterAction;
      case " ": return InputType.HOLD;
      case "ArrowUp": return InputType.SWIPE_UP;
      case "ArrowDown": return InputType.SWIPE_DOWN;
      case "+":
      case "=": return InputType.PINCH_ZOOM;
      default: return undefined;
    }
  }

  private isEditing(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== "function") {
      return false;
    }
    return (target as Element).closest(
      "button, a, input, textarea, select, " +
      "[contenteditable]:not([contenteditable='false'])"
    ) !== null;
  }
}
