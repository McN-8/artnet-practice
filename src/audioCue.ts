export class AudioCue {

  file: string;

  type: string;

  loop: boolean;

  constructor(file: string, type: string, loop: boolean) {

    this.file = file;

    this.type = type;

    this.loop = loop;

  }

}