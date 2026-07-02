import { AudioCue } from "./audioCue.js";
import { TransitionEffect } from "./transitionEffect.js";

export class Transition {

  destinationStateId: string;

  effect: TransitionEffect;

  triggeredAudioCues: AudioCue[];

  constructor(

    destinationStateId: string,

    effect: TransitionEffect,

  ) {

    this.destinationStateId = destinationStateId;

    this.effect = effect;

    this.triggeredAudioCues = [];

  }

  addTriggeredAudioCue(audioCue: AudioCue): void {

    this.triggeredAudioCues.push(audioCue);

  }

}