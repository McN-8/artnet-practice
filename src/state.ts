import { AudioCue } from "./audioCue.js";

import { Prompt } from "./prompt.js";

import { Effect } from "./effect.js";

import { ZoomRegion } from "./zoomRegion.js";

import { Asset } from "./asset.js";

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