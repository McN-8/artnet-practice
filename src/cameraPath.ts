import { CameraFocalPoint } from "./cameraFocalPoint.js";

export class CameraPath {
  id: string;
  startPoint: CameraFocalPoint;
  endPoint: CameraFocalPoint;
  duration: number;
  easing: string;

  constructor(
    id: string,
    startPoint: CameraFocalPoint,
    endPoint: CameraFocalPoint,
    duration: number,
    easing: string
  ) {
    this.id = id;
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.duration = duration;
    this.easing = easing;
  }
}