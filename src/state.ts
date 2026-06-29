import { AudioCue } from "./audioCue.js";

import { Prompt } from "./prompt.js";

import { Effect } from "./effect.js";

export class State {

  id: string;

  image: string;

  dialogue: string;

  audioCues: AudioCue[];

  prompts: Prompt[];

  effects: Effect[];

  constructor(id: string, image: string, dialogue: string) {

    this.id = id;

    this.image = image;

    this.dialogue = dialogue;

    this.audioCues = [];

    this.prompts = [];

    this.effects = [];

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

}