import { AudioCue } from "./audioCue.js";

export class AudioLayer {
  id: string;
  audioCue: AudioCue;
  active: boolean;

  constructor(id: string, audioCue: AudioCue, active: boolean = false) {
    this.id = id;
    this.audioCue = audioCue;
    this.active = active;
  }

  activate(): void {
    this.active = true;
    console.log(`Activating audio layer: ${this.id}`);
  }

  deactivate(): void {
    this.active = false;
    console.log(`Deactivating audio layer: ${this.id}`);
  }
}