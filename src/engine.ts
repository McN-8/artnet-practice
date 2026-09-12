import { State } from "./state.js";
import { Prompt } from "./prompt.js";
import { AssetCache } from "./assetCache.js";
import { AudioStack } from "./audioStack.js";
import { PanelGroup } from "./panelGroup.js";
import { SystemClock } from "./clock.js";
import type { Clock, ClockTimer } from "./clock.js";
import { PrototypeRenderer } from "./renderer.js";
import type { Renderer } from "./renderer.js";
import { DEFAULT_RENDER_CONTEXT } from "./visualContract.js";
import type { CameraPath } from "./cameraPath.js";
import type { Effect } from "./effect.js";
import type { OverlayAsset } from "./overlayAsset.js";

export class Engine {
  // Runtime State
  currentState: State;
  states: State[];

  // Preloading
  preloadBackwardSpan: number;
  preloadForwardSpan: number;

  // Asset Cache
  assetCache: AssetCache;

  activeTimers: ClockTimer[];

  clock: Clock;

  renderer: Renderer;

  // Audio Stack
  audioStack: AudioStack;

  // Fast Forward
  fastForwardActive: boolean;

  constructor(
    initialState: State,
    states: State[],
    audioStack: AudioStack,
    preloadBackwardSpan: number = 1,
    preloadForwardSpan: number = 2,
    clock: Clock = new SystemClock(),
    renderer: Renderer = new PrototypeRenderer()
  ) {
    this.currentState = initialState;
    this.states = states;
    this.audioStack = audioStack;
    this.preloadBackwardSpan = preloadBackwardSpan;
    this.preloadForwardSpan = preloadForwardSpan;
    this.assetCache = new AssetCache();
    this.clock = clock;
    this.renderer = renderer;
    this.activeTimers = [];
    this.fastForwardActive = false;
  }

  // Asset Preloading
  getCurrentStateIndex(): number {
  return this.states.findIndex(
    (state) => state.id === this.currentState.id
  );
 }
  
  preloadStateAssets(state: State): void {
    console.log(`Preloading assets for ${state.id}`);

    for (const asset of state.assets) {
      this.assetCache.loadAsset(asset.file);
    }
  }

  preloadNearbyStates(currentIndex: number): void {
    const start = Math.max(
      0,
      currentIndex - this.preloadBackwardSpan
    );

    const end = Math.min(
      this.states.length - 1,
      currentIndex + this.preloadForwardSpan
    );

    for (let i = start; i <= end; i++) {
      if (i === currentIndex) {
        continue;
      }

      this.preloadStateAssets(this.states[i]!);
    }
  }

  unloadDistantStateAssets(currentIndex: number): void {
    const keepStart = Math.max(
      0,
      currentIndex - this.preloadBackwardSpan
    );

    const keepEnd = Math.min(
      this.states.length - 1,
      currentIndex + this.preloadForwardSpan
    );

    for (let i = 0; i < this.states.length; i++) {
      if (i >= keepStart && i <= keepEnd) {
        continue;
      }

      const state = this.states[i];

      if (!state) {
        continue;
      }

      for (const asset of state.assets) {
        this.assetCache.unloadAsset(asset.file);
      }
    }
  }

  // Fast Forward
  enableFastForward(): void {
    this.fastForwardActive = true;
    console.log("Fast forward enabled.");
  }

  disableFastForward(): void {
    this.fastForwardActive = false;
    console.log("Fast forward disabled.");
  }

  // Audio Layers
  applyAudioLayerRules(state: State): void {
    for (const layerId of state.audioLayersToActivate) {
      this.audioStack.activateLayer(layerId);
    }

    for (const layerId of state.audioLayersToDeactivate) {
      this.audioStack.deactivateLayer(layerId);
    }
  }

  // Camera Path
    runCameraPath(path: CameraPath): void {
  this.renderer.runCameraPath(path, DEFAULT_RENDER_CONTEXT);
 }

  // Run Effect
  runEffect(effect: Effect): void {
  this.renderer.runEffect(effect, DEFAULT_RENDER_CONTEXT);
 }

  // Audio Payload Execution

    runAudio(audio: { file: string; volume: number }): void {
  console.log(
    `Playing audio ${audio.file} at volume ${audio.volume}.`
  );
 }

  // Overlay Effect Execution
  runOverlay(
  overlay: OverlayAsset
 ): void {
  this.renderer.displayOverlay(overlay, DEFAULT_RENDER_CONTEXT);
 }

  // Timeline
  playTimeline(state: State): void {
    for (const event of state.timeline.events) {
      this.schedule(() => {
        switch (event.type) {
          case "camera":
            this.runCameraPath(
                 event.payload as CameraPath
                 );
            break;

          case "effect":
            this.runEffect(
                event.payload as Effect
                 );
            break;

          case "audio":
            this.runAudio(
                event.payload as {
                file: string;
                volume: number;
                }
                 );
            break;

          case "overlay":
            this.runOverlay(
                event.payload as OverlayAsset
                 );
            break;

          case "panelGroup":
            console.log(
              `Starting panel group event: ${
                (event.payload as { id: string }).id
              }`
            );

            this.playPanelGroup(
                event.payload as PanelGroup
            );
            break;

          default:
            console.log(
              `Timeline Event [${event.type}] triggered.`
            );
        }
      }, this.getEffectiveDelay(event.timestamp, state));
    }
  }

  // Panel Groups
  playPanelGroup(panelGroup: PanelGroup): void {
    for (const reveal of panelGroup.reveals) {
      this.schedule(() => {
        this.renderer.revealPanel(
          reveal,
          DEFAULT_RENDER_CONTEXT
        );
      }, this.getEffectiveDelay(reveal.delay));
    }
  }

  // Active Timer

  registerTimer(timer: ClockTimer): void {
  this.activeTimers.push(timer);
 }

  schedule(callback: () => void, delay: number): ClockTimer {
    let timer: ClockTimer;

    timer = this.clock.setTimeout(() => {
      this.activeTimers = this.activeTimers.filter(
        (activeTimer) => activeTimer !== timer
      );
      callback();
    }, delay);

    this.registerTimer(timer);
    return timer;
  }

  getEffectiveDelay(
    delay: number,
    state: State = this.currentState
  ): number {
    if (this.fastForwardActive && state.fastForwardEnabled) {
      return delay / state.fastForwardMultiplier;
    }

    return delay;
  }

    clearActiveTimers(): void {
  for (const timer of this.activeTimers) {
    this.clock.clearTimeout(timer);
  }

  this.activeTimers = [];

  console.log("Cleared active timers.");
 }

  // Auto Advance
  scheduleAutoAdvance(): void {
    const state = this.currentState;

    if (!state.autoAdvanceEnabled) {
      console.log(`Auto advance disabled for ${state.id}`);
      return;
    }

    const prompt = state.autoAdvancePrompt;

    if (!prompt) {
      console.log(`Auto advance prompt missing for ${state.id}`);
      return;
    }

    const effectiveDelay = this.getEffectiveDelay(
      state.autoAdvanceDelay,
      state
    );

    console.log(
      `Auto advancing from ${this.currentState.id} in ${effectiveDelay}ms.`
    );

    this.schedule(() => {
      this.executePrompt(prompt);
    }, effectiveDelay);
  }

  // Timer Cleanup
  startState(state: State): void {
  this.currentState = state;
  this.clearActiveTimers();
  this.renderer.renderState(state, DEFAULT_RENDER_CONTEXT);
  this.applyAudioLayerRules(state);
  this.playTimeline(state);
  this.scheduleAutoAdvance();
 }

  // Transition Pipeline
  prepareTransition(destinationState: State): void {
    this.preloadStateAssets(destinationState);
  }

  finalizeTransition(): void {
  this.startState(this.currentState);
  }

  // Prompt Matching
  findPrompt(
  inputType: string,
  targetId?: string
    ): Prompt | undefined {
  return this.currentState.prompts.find(
    (prompt) =>
      prompt.inputType === inputType &&
      this.matchesTarget(prompt, targetId)
        );
    }
    handleInput(
  inputType: string,
  targetId?: string
    ): void {
  const prompt = this.findPrompt(inputType, targetId);

  if (!prompt) {
    console.log("No matching prompt found.");
    return;
  }

  this.executePrompt(prompt, targetId);
    }

  // Object Interaction
  matchesTarget(
  prompt: Prompt,
  targetId?: string
 ): boolean {
  if (!prompt.targetId) {
    return true;
  }

  return prompt.targetId === targetId;
 }

  // Prompt Execution
  executePrompt(
  prompt: Prompt,
  targetId?: string
    ): void {
    if (!this.matchesTarget(prompt, targetId)) {
        console.log(
        `Prompt target mismatch.`
        );
        return;
    }
    if (this.currentState.inputLocked) {
      console.log(`Input is locked for ${this.currentState.id}. Prompt ignored.`);
      return;
    }

    const destinationState = this.states.find(
      (state) => state.id === prompt.transition.destinationStateId
    );

    if (!destinationState) {
      console.log("Destination state not found.");
      return;
    }

    console.log(
      `Executing ${prompt.inputType} transition with ${prompt.transition.effect.type}.`
    );

    if (prompt.transition.effect.locksInput) {
      console.log("Transition locking input.");
    }

    if (
      this.fastForwardActive &&
      !prompt.transition.effect.allowFastForward
    ) {
      console.log(
        "Fast forward blocked by transition."
      );
    }

    console.log(
      `Triggered audio cues: ${prompt.transition.triggeredAudioCues.length}`
    );

    this.prepareTransition(destinationState);

    this.currentState.exit();

    this.currentState = destinationState;

    this.currentState.enter();

    this.finalizeTransition();
  }
}
