export class CameraBehavior {
  type: string;
  duration: number;

  constructor(
    type: string,
    duration: number
  ) {
    this.type = type;
    this.duration = duration;
  }
}