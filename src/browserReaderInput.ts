import { BrowserKeyboardInputSource } from "./browserKeyboardInputSource.js";
import {
  BrowserReaderControls
} from "./browserReaderControls.js";
import type { PagePosition } from "./browserReaderControls.js";
import { BrowserTouchInputSource } from "./browserTouchInputSource.js";
import { SystemClock } from "./clock.js";
import type { Clock } from "./clock.js";
import type { Engine } from "./engine.js";
import { InputType } from "./inputType.js";
import type { PresentationMode } from "./presentationMode.js";
import type { State } from "./state.js";
import type { InputSource, ReaderInput } from "./subsystemAdapters.js";

export interface BrowserReaderInputOptions {
  controlsRoot?: HTMLElement;
  targetId?: () => string | undefined;
  clock?: Clock;
}

/** One engine-facing source for browser keyboard, touch, and controls. */
export class BrowserReaderInput implements InputSource {
  private readonly listeners = new Set<(input: ReaderInput) => void>();
  private readonly keyboard: BrowserKeyboardInputSource;
  private readonly touch: BrowserTouchInputSource;
  private readonly controls: BrowserReaderControls;
  private readonly targetId: () => string | undefined;
  private readonly childUnsubscribes: Array<() => void>;
  private state: State | undefined;
  private engineDisconnect: (() => void) | undefined;
  private disposed = false;

  constructor(root: HTMLElement, options: BrowserReaderInputOptions = {}) {
    const targetId = options.targetId ?? (() => undefined);
    this.targetId = targetId;
    this.keyboard = new BrowserKeyboardInputSource(root, InputType.TAP_RIGHT,
      targetId);
    this.touch = new BrowserTouchInputSource(
      root, targetId, () => this.doubleTapAvailable(),
      options.clock ?? new SystemClock()
    );
    this.controls = new BrowserReaderControls(
      options.controlsRoot ?? root, targetId
    );
    const forward = (input: ReaderInput) => this.emit(input);
    this.childUnsubscribes = [
      this.keyboard.subscribe(forward),
      this.touch.subscribe(forward),
      this.controls.subscribe(forward)
    ];
  }

  subscribe(listener: (input: ReaderInput) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Host refresh point after state, target, page, or lock changes. */
  updateForState(
    state: State,
    mode: PresentationMode,
    pagePosition?: PagePosition
  ): void {
    this.state = state;
    this.controls.updateForState(state, mode, pagePosition);
  }

  /** Bind input and state refresh together; replaces this coordinator's prior link. */
  connect(engine: Engine): () => void {
    if (this.disposed) return () => {};
    this.disconnect();
    const unbindInput = engine.bindInput(this);
    const unsubscribeState = engine.subscribeStateChanges((state) => {
      this.updateForState(state, engine.presentationMode, {
        index: engine.getCurrentStateIndex(), count: engine.states.length
      });
    });
    const disconnect = () => {
      unsubscribeState();
      unbindInput();
      if (this.engineDisconnect === disconnect) {
        this.engineDisconnect = undefined;
      }
    };
    this.engineDisconnect = disconnect;
    return disconnect;
  }

  disconnect(): void {
    this.engineDisconnect?.();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    for (const unsubscribe of this.childUnsubscribes) unsubscribe();
    this.keyboard.dispose();
    this.touch.dispose();
    this.controls.dispose();
    this.listeners.clear();
    this.state = undefined;
  }

  private doubleTapAvailable(): boolean {
    const state = this.state;
    const targetId = this.targetId();
    return state !== undefined && !state.inputLocked && state.prompts.some(
      (prompt) => prompt.inputType === InputType.DOUBLE_TAP &&
        (prompt.targetId === undefined || prompt.targetId === targetId)
    );
  }

  private emit(input: ReaderInput): void {
    for (const listener of [...this.listeners]) listener(input);
  }
}
