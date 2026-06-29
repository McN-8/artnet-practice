export class AudioCue {

  file: string;

  type: string;

  loop: boolean;

  volume: number;

  trigger: string;

  persistsAcrossStates: boolean;

  fadeInDuration: number;

fadeOutDuration: number;

  constructor(

    file: string,

    type: string,

    loop: boolean,

    volume: number,

    trigger: string,

    persistsAcrossStates: boolean = false,

    fadeInDuration: number = 0,

  fadeOutDuration: number = 0

  ) {

    this.file = file;

    this.type = type;

    this.loop = loop;

    this.volume = volume;

    this.trigger = trigger;

    this.persistsAcrossStates = persistsAcrossStates;

    this.fadeInDuration = fadeInDuration;

this.fadeOutDuration = fadeOutDuration;

  }

}