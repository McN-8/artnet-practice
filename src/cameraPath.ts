import { CameraFocalPoint } from "./cameraFocalPoint.js";

export class CameraPath {
  id: string;
  startPoint: CameraFocalPoint;
  endPoint: CameraFocalPoint;
  duration: number;
  easing: string;
  speedMultiplier: number;

  constructor(
    id: string,
    startPoint: CameraFocalPoint,
    endPoint: CameraFocalPoint,
    duration: number,
    easing: string,
    speedMultiplier: number = 1.0
  ) {
    this.id = id;
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.duration = duration;
    this.easing = easing;
    this.speedMultiplier = speedMultiplier;
  }
}