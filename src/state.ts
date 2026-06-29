import { AudioCue } from "./audioCue.js";

import { Prompt } from "./prompt.js";

export class State {

  id: string;

  image: string;

  dialogue: string;

  audioCues: AudioCue[];

  prompts: Prompt[];

  constructor(id: string, image: string, dialogue: string) {

    this.id = id;

    this.image = image;

    this.dialogue = dialogue;

    this.audioCues = [];

    this.prompts = [];

  }

  addAudioCue(audioCue: AudioCue): void {

    this.audioCues.push(audioCue);

  }

  addPrompt(prompt: Prompt): void {

    this.prompts.push(prompt);

  }

}