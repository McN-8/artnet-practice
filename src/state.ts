import { AudioCue } from "./audioCue.js";

import { Prompt } from "./prompt.js";

import { Effect } from "./effect.js";

import { ZoomRegion } from "./zoomRegion.js";

import { Asset } from "./asset.js";

import { CameraBehavior } from "./cameraBehavior.js";

import { CameraFocalPoint } from "./cameraFocalPoint.js";

import { CameraPath } from "./cameraPath.js";

import { CameraEvent } from "./cameraEvent.js";

export class State {

  id: string;

  image: string;

  dialogue: string;

  zoomEnabled: boolean;

  zoomInteractive: boolean;

  zoomRegions: ZoomRegion[];

  audioCues: AudioCue[];

  prompts: Prompt[];

  effects: Effect[];

  assets: Asset[];

  cameraBehaviors: CameraBehavior[];

  cameraFocalPoints: CameraFocalPoint[];

  cameraPaths: CameraPath[];

  cameraEvents: CameraEvent[];

  autoAdvanceEnabled: boolean;

  autoAdvanceDelay: number;

  autoAdvancePrompt?: Prompt;

  constructor(

    id: string,

    image: string,

    dialogue: string,

    zoomEnabled: boolean = false,

    zoomInteractive: boolean = false

  ) {

    this.id = id;

    this.image = image;

    this.dialogue = dialogue;

    this.zoomEnabled = zoomEnabled;

    this.zoomInteractive = zoomInteractive;

    this.zoomRegions = [];

    this.audioCues = [];

    this.prompts = [];

    this.effects = [];

    this.assets = [];

    this.cameraBehaviors = [];

    this.cameraFocalPoints = [];

    this.cameraPaths = [];

    this.cameraEvents = [];

    this.autoAdvanceEnabled = false;

    this.autoAdvanceDelay = 0;

  }

  addZoomRegion(zoomRegion: ZoomRegion): void {

  this.zoomRegions.push(zoomRegion);

  }
  
  addAudioCue(audioCue: AudioCue): void {

    this.audioCues.push(audioCue);

  }

  addPrompt(prompt: Prompt): void {

    this.prompts.push(prompt);

  }

  addEffect(effect: Effect): void {

    this.effects.push(effect);

  }

  addAsset(asset: Asset): void {

    this.assets.push(asset);

  }

  addCameraBehavior(

  cameraBehavior: CameraBehavior

  ): void {

  this.cameraBehaviors.push(cameraBehavior);

  }

  addCameraFocalPoint(

  cameraFocalPoint: CameraFocalPoint

  ): void {

  this.cameraFocalPoints.push(

    cameraFocalPoint

  );

  }

  addCameraPath(cameraPath: CameraPath): void {

  this.cameraPaths.push(cameraPath);

  }

  addCameraEvent(cameraEvent: CameraEvent): void {

  this.cameraEvents.push(cameraEvent);

  }

  enableAutoAdvance(delay: number, prompt: Prompt): void {
  this.autoAdvanceEnabled = true;
  this.autoAdvanceDelay = delay;
  this.autoAdvancePrompt = prompt;
  }

 enter(): void {

  console.log(`Entering ${this.id}`);

  for (const audioCue of this.audioCues) {

    console.log(

      `Starting audio: ${audioCue.file}`

    );

  }

}

exit(): void {

  console.log(`Exiting ${this.id}`);

  for (const audioCue of this.audioCues) {

    if (!audioCue.persistsAcrossStates) {

      console.log(

        `Stopping audio: ${audioCue.file}`

      );

    }

  }

}
  
}