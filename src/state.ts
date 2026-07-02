import { AudioCue } from "./audioCue.js";
import { Prompt } from "./prompt.js";
import { Effect } from "./effect.js";
import { ZoomRegion } from "./zoomRegion.js";
import { Asset } from "./asset.js";
import { CameraBehavior } from "./cameraBehavior.js";
import { CameraFocalPoint } from "./cameraFocalPoint.js";
import { CameraPath } from "./cameraPath.js";
import { CameraEvent } from "./cameraEvent.js";
import { StatePhase } from "./statePhase.js";
import { Timeline } from "./timeline.js";

export class State {

  // Core State Data
  id: string;
  image: string;
  dialogue: string;
  currentPhase: StatePhase;
  timeline: Timeline;

  // Zoom
  zoomEnabled: boolean;
  zoomInteractive: boolean;
  zoomRegions: ZoomRegion[];

  // Audio
  audioCues: AudioCue[];
  audioLayersToActivate: string[];
  audioLayersToDeactivate: string[];

  // Interaction
  prompts: Prompt[];

  // Effects
  effects: Effect[];

  // Assets
  assets: Asset[];

  // Camera
  cameraBehaviors: CameraBehavior[];
  cameraFocalPoints: CameraFocalPoint[];
  cameraPaths: CameraPath[];
  cameraEvents: CameraEvent[];

  // Auto Advance
  autoAdvanceEnabled: boolean;
  autoAdvanceDelay: number;
  autoAdvancePrompt?: Prompt;

  // Input Control
  inputLocked: boolean;
  inputLockDuration: number;
  fastForwardEnabled: boolean;
  fastForwardMultiplier: number;

  constructor(
    id: string,
    image: string,
    dialogue: string,
    zoomEnabled: boolean = false,
    zoomInteractive: boolean = false
  ) {

    // Core State Data
    this.id = id;
    this.image = image;
    this.dialogue = dialogue;
    this.currentPhase = StatePhase.EXITED;
    this.timeline = new Timeline();

    // Zoom
    this.zoomEnabled = zoomEnabled;
    this.zoomInteractive = zoomInteractive;
    this.zoomRegions = [];

    // Audio
    this.audioCues = [];
    this.audioLayersToActivate = [];
    this.audioLayersToDeactivate = [];

    // Interaction
    this.prompts = [];

    // Effects
    this.effects = [];

    // Assets
    this.assets = [];

    // Camera
    this.cameraBehaviors = [];
    this.cameraFocalPoints = [];
    this.cameraPaths = [];
    this.cameraEvents = [];

    // Auto Advance
    this.autoAdvanceEnabled = false;
    this.autoAdvanceDelay = 0;

    // Input Control
    this.inputLocked = false;
    this.inputLockDuration = 0;
    this.fastForwardEnabled = true;
    this.fastForwardMultiplier = 2.0;
  }

  // Input Control
  configureInputLock(
    duration: number,
    fastForwardEnabled: boolean = true,
    fastForwardMultiplier: number = 2.0
  ): void {
    this.inputLocked = true;
    this.inputLockDuration = duration;
    this.fastForwardEnabled = fastForwardEnabled;
    this.fastForwardMultiplier = fastForwardMultiplier;
  }

  // Timeline
  setTimeline(timeline: Timeline): void {
  this.timeline = timeline;
  }
  
  // Zoom
  addZoomRegion(zoomRegion: ZoomRegion): void {
    this.zoomRegions.push(zoomRegion);
  }

  // Audio
  addAudioCue(audioCue: AudioCue): void {
    this.audioCues.push(audioCue);
  }
  activateAudioLayer(layerId: string): void {
    this.audioLayersToActivate.push(layerId);
  }
  deactivateAudioLayer(layerId: string): void {
    this.audioLayersToDeactivate.push(layerId);
  }

  // Interaction
  addPrompt(prompt: Prompt): void {
    this.prompts.push(prompt);
  }

  // Effects
  addEffect(effect: Effect): void {
    this.effects.push(effect);
  }

  // Assets
  addAsset(asset: Asset): void {
    this.assets.push(asset);
  }

  // Camera
  addCameraBehavior(
    cameraBehavior: CameraBehavior
  ): void {
    this.cameraBehaviors.push(cameraBehavior);
  }

  addCameraFocalPoint(
    cameraFocalPoint: CameraFocalPoint
  ): void {
    this.cameraFocalPoints.push(cameraFocalPoint);
  }

  addCameraPath(
    cameraPath: CameraPath
  ): void {
    this.cameraPaths.push(cameraPath);
  }

  addCameraEvent(
    cameraEvent: CameraEvent
  ): void {
    this.cameraEvents.push(cameraEvent);
  }

  // Auto Advance
  enableAutoAdvance(
    delay: number,
    prompt: Prompt
  ): void {
    this.autoAdvanceEnabled = true;
    this.autoAdvanceDelay = delay;
    this.autoAdvancePrompt = prompt;
  }

  // Lifecycle
  enter(): void {
  this.currentPhase = StatePhase.ENTERING;

  console.log(`Entering ${this.id}`);

  for (const audioCue of this.audioCues) {
    console.log(`Starting audio: ${audioCue.file}`);
  }

  this.currentPhase = StatePhase.ACTIVE;
}

  exit(): void {
  this.currentPhase = StatePhase.EXITING;

  console.log(`Exiting ${this.id}`);

  for (const audioCue of this.audioCues) {
    if (!audioCue.persistsAcrossStates) {
      console.log(`Stopping audio: ${audioCue.file}`);
    }
  }

  this.currentPhase = StatePhase.EXITED;
}
}