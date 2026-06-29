import { AudioCue } from "./audioCue.js";

export class Transition {

  destinationStateId: string;

  effectType: string;

  duration: number;

  triggeredAudioCues: AudioCue[];

  constructor(

    destinationStateId: string,

    effectType: string,

    duration: number

  ) {

    this.destinationStateId = destinationStateId;

    this.effectType = effectType;

    this.duration = duration;

    this.triggeredAudioCues = [];

  }

  addTriggeredAudioCue(audioCue: AudioCue): void {

    this.triggeredAudioCues.push(audioCue);

  }

}