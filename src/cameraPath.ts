import { CameraFocalPoint } from "./cameraFocalPoint.js";

export class CameraPath {
  id: string;
  startPoint: CameraFocalPoint;
  endPoint: CameraFocalPoint;
  duration: number;
  easing: string;
  speed: string;

  constructor(
    id: string,
    startPoint: CameraFocalPoint,
    endPoint: CameraFocalPoint,
    duration: number,
    easing: string,
    speed: string = "normal"
  ) {
    this.id = id;
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.duration = duration;
    this.easing = easing;
    this.speed = speed;
  }
}