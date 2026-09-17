import { State } from "./state.js";
import { Prompt } from "./prompt.js";
import { AssetCache } from "./assetCache.js";
import { AudioStack } from "./audioStack.js";
import type { AudioCue } from "./audioCue.js";
import { InputType } from "./inputType.js";
import { PrototypeAudioPlayback } from "./subsystemAdapters.js";
import type {
  AssetLoader, AudioPlayback, InputSource
} from "./subsystemAdapters.js";
import { PanelGroup } from "./panelGroup.js";
import { SystemClock } from "./clock.js";
import type { Clock, ClockTimer } from "./clock.js";
import { PrototypeRenderer } from "./renderer.js";
import type { Renderer } from "./renderer.js";
import { createRenderContext } from "./visualContract.js";
import type { RenderContext } from "./visualContract.js";
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES
} from "./accessibilityContract.js";
import type {
  AccessibilityPreferences
} from "./accessibilityContract.js";
import type { CameraPath } from "./cameraPath.js";
import type { Effect } from "./effect.js";
import type { OverlayAsset } from "./overlayAsset.js";
import { StatePhase } from "./statePhase.js";
import type { PresentationMode } from "./presentationMode.js";
import { isTraditionalPresentationMode } from "./presentationMode.js";
import {
  NoopMediaAdapter
} from "./mediaContracts.js";
import type {
  AnimationSequence, HapticPattern, MediaAdapter, ParticleEffect
} from "./mediaContracts.js";
import {
  DEFAULT_READER_TIMING_PREFERENCES,
  validateReaderTimingPreferences
} from "./readerTimingPreferences.js";
import type { ReaderTimingPreferences } from "./readerTimingPreferences.js";

export class Engine {
  // Runtime State
  currentState: State;
  states: State[];
  navigationHistory: string[];

  // Preloading
  preloadBackwardSpan: number;
  preloadForwardSpan: number;

  // Asset Cache
  assetCache: AssetLoader;
  audioPlayback: AudioPlayback;
  private inputUnsubscribe: (() => void) | undefined;

  activeTimers: ClockTimer[];

  clock: Clock;

  renderer: Renderer;
  mediaAdapter: MediaAdapter;
  renderContext: RenderContext;

  // Audio Stack
  audioStack: AudioStack;

  // Fast Forward
  fastForwardActive: boolean;

  presentationMode: PresentationMode;

  readerTimingPreferences: ReaderTimingPreferences;
  autoPromptPaused: boolean;
  autoPromptTimer?: ClockTimer;
  lifecycleActive: boolean;

  constructor(
    initialState: State,
    states: State[],
    audioStack: AudioStack,
    preloadBackwardSpan: number = 1,
    preloadForwardSpan: number = 2,
    clock: Clock = new SystemClock(),
    renderer: Renderer = new PrototypeRenderer(),
    accessibility: Readonly<AccessibilityPreferences> =
      DEFAULT_ACCESSIBILITY_PREFERENCES,
    presentationMode: PresentationMode = "interactive",
    readerTimingPreferences: Readonly<ReaderTimingPreferences> =
      DEFAULT_READER_TIMING_PREFERENCES,
    mediaAdapter: MediaAdapter = new NoopMediaAdapter(),
    assetLoader: AssetLoader = new AssetCache(),
    audioPlayback: AudioPlayback = new PrototypeAudioPlayback()
  ) {
    this.currentState = initialState;
    this.states = states;
    this.navigationHistory = [];
    this.audioStack = audioStack;
    this.preloadBackwardSpan = preloadBackwardSpan;
    this.preloadForwardSpan = preloadForwardSpan;
    this.assetCache = assetLoader;
    this.audioPlayback = audioPlayback;
    this.clock = clock;
    this.renderer = renderer;
    this.mediaAdapter = mediaAdapter;
    this.renderContext = createRenderContext(accessibility);
    this.activeTimers = [];
    this.fastForwardActive = false;
    this.presentationMode = presentationMode;
    validateReaderTimingPreferences(readerTimingPreferences);
    this.readerTimingPreferences = { ...readerTimingPreferences };
    this.autoPromptPaused = false;
    this.lifecycleActive = false;
  }

  bindInput(source: InputSource): () => void {
    this.unbindInput();
    const unsubscribe = source.subscribe((input) => {
      this.handleInput(input.type, input.targetId);
    });
    this.inputUnsubscribe = unsubscribe;
    return () => {
      if (this.inputUnsubscribe === unsubscribe) this.unbindInput();
    };
  }

  unbindInput(): void {
    this.inputUnsubscribe?.();
    this.inputUnsubscribe = undefined;
  }

  setReaderTimingPreferences(
    preferences: Readonly<ReaderTimingPreferences>
  ): void {
    validateReaderTimingPreferences(preferences);
    this.readerTimingPreferences = { ...preferences };
    this.cancelAutoPrompt();
    this.autoPromptPaused = false;
    if (this.lifecycleActive) {
      this.scheduleAutoAdvance();
    }
  }

  pauseAutoPrompt(): void {
    this.autoPromptPaused = true;
    this.cancelAutoPrompt();
  }

  resumeAutoPrompt(): void {
    if (!this.autoPromptPaused) {
      return;
    }

    this.autoPromptPaused = false;
    this.scheduleAutoAdvance();
  }

  skipAutoPromptDelay(): boolean {
    const prompt = this.currentState.autoAdvancePrompt;

    if (!this.currentState.autoAdvanceEnabled || !prompt) {
      return false;
    }

    this.cancelAutoPrompt();
    this.executePrompt(prompt);
    return true;
  }

  private cancelAutoPrompt(): void {
    if (this.autoPromptTimer === undefined) {
      return;
    }

    this.clock.clearTimeout(this.autoPromptTimer);
    this.activeTimers = this.activeTimers.filter(
      (timer) => timer !== this.autoPromptTimer
    );
    this.autoPromptTimer = undefined;
  }

  advanceTraditionalPage(): boolean {
    return this.moveTraditionalPage(1);
  }

  returnToPreviousTraditionalPage(): boolean {
    return this.moveTraditionalPage(-1);
  }

  private moveTraditionalPage(offset: -1 | 1): boolean {
    if (!isTraditionalPresentationMode(this.presentationMode)) {
      return false;
    }

    const currentIndex = this.getCurrentStateIndex();
    const destinationState = this.states[currentIndex + offset];

    if (!destinationState) {
      return false;
    }

    this.navigationHistory.push(this.currentState.id);
    for (const cue of this.currentState.audioCues) {
      if (!cue.persistsAcrossStates) this.audioPlayback.stopCue(cue);
    }
    this.currentState.exit();
    destinationState.enter();
    this.startState(destinationState);
    this.preloadNearbyStates(currentIndex + offset);
    this.unloadDistantStateAssets(currentIndex + offset);
    return true;
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
      this.assetCache.loadAsset(asset);
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
        this.assetCache.unloadAsset(asset);
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
      this.audioPlayback.activateLayer(layerId);
    }

    for (const layerId of state.audioLayersToDeactivate) {
      this.audioStack.deactivateLayer(layerId);
      this.audioPlayback.deactivateLayer(layerId);
    }
  }

  // Camera Path
    runCameraPath(path: CameraPath): void {
  this.renderer.runCameraPath(path, this.renderContext);
 }

  // Run Effect
  runEffect(effect: Effect): void {
  this.renderer.runEffect(effect, this.renderContext);
 }

  // Audio Payload Execution

    runAudio(audio: AudioCue): void {
  this.audioPlayback.playCue(audio);
 }

  // Overlay Effect Execution
  runOverlay(
  overlay: OverlayAsset
 ): void {
  this.renderer.displayOverlay(overlay, this.renderContext);
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
                event.payload as AudioCue
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

          case "animation":
            {
              const sequence = event.payload as AnimationSequence;
              if (this.renderContext.accessibility.reducedMotion ||
                  !this.mediaAdapter.capabilities.animation) {
                this.mediaAdapter.showReducedMotionPanel(
                  sequence.reducedMotionPanelId
                );
              } else {
                this.mediaAdapter.playAnimation(sequence);
              }
            }
            break;

          case "particles":
            {
              const effect = event.payload as ParticleEffect;
              if (this.renderContext.accessibility.reducedMotion ||
                  !this.mediaAdapter.capabilities.particles) {
                this.mediaAdapter.showReducedMotionPanel(
                  effect.reducedMotionPanelId
                );
              } else {
                this.mediaAdapter.playParticles(effect);
              }
            }
            break;

          case "haptic":
            this.mediaAdapter.showHapticAlternative(
              (event.payload as HapticPattern).visualAlternative
            );
            if (this.mediaAdapter.capabilities.haptics &&
                this.mediaAdapter.capabilities.hapticsEnabled) {
              this.mediaAdapter.playHaptics(event.payload as HapticPattern);
            }
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
          this.renderContext
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
  this.autoPromptTimer = undefined;
  this.mediaAdapter.cancelAll();

  console.log("Cleared active timers.");
 }

  // Auto Advance
  scheduleAutoAdvance(): void {
    const state = this.currentState;

    if (!state.autoAdvanceEnabled) {
      console.log(`Auto advance disabled for ${state.id}`);
      return;
    }

    if (
      !this.readerTimingPreferences.handsFreeEnabled ||
      this.autoPromptPaused
    ) {
      console.log(`Hands-free progression inactive for ${state.id}`);
      return;
    }

    const prompt = state.autoAdvancePrompt;

    if (!prompt) {
      console.log(`Auto advance prompt missing for ${state.id}`);
      return;
    }

    const effectiveDelay = this.getEffectiveDelay(
      state.autoAdvanceDelay *
        this.readerTimingPreferences.autoPromptTimingMultiplier,
      state
    );

    console.log(
      `Auto advancing from ${this.currentState.id} in ${effectiveDelay}ms.`
    );

    this.autoPromptTimer = this.schedule(() => {
      this.autoPromptTimer = undefined;
      this.executePrompt(prompt);
    }, effectiveDelay);
  }

  // Timer Cleanup
  startState(state: State): void {
  this.clearActiveTimers();
  this.activateState(state);
 }

  restoreStateAtStart(state: State): void {
  this.clearActiveTimers();
  state.currentPhase = StatePhase.EXITED;
  state.enter();
  this.activateState(state);
 }

  private activateState(state: State): void {
  this.lifecycleActive = true;
  this.currentState = state;
  this.renderer.renderState(state, this.renderContext);
  this.applyAudioLayerRules(state);
  for (const cue of state.audioCues) {
    this.audioPlayback.playCue(cue);
  }
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
  if (isTraditionalPresentationMode(this.presentationMode)) {
    if (this.currentState.inputLocked) return;
    if (inputType === InputType.TAP_RIGHT) {
      this.advanceTraditionalPage();
      return;
    }
    if (inputType === InputType.TAP_LEFT) {
      this.returnToPreviousTraditionalPage();
      return;
    }
  }
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

    for (const cue of this.currentState.audioCues) {
      if (!cue.persistsAcrossStates) this.audioPlayback.stopCue(cue);
    }
    for (const cue of prompt.transition.triggeredAudioCues) {
      this.audioPlayback.playCue(cue);
    }

    this.navigationHistory.push(this.currentState.id);

    this.currentState.exit();

    this.currentState = destinationState;

    this.currentState.enter();

    this.finalizeTransition();
  }
}
