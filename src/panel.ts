import { AudioCue } from "./audioCue.js";

export class Panel {

  image: string;

  dialogue: string;

  audioCues: AudioCue[];

  constructor(image: string, dialogue: string) {

    this.image = image;

    this.dialogue = dialogue;

    this.audioCues = [];

  }

  addAudioCue(audioCue: AudioCue): void {

    this.audioCues.push(audioCue);

  }

}