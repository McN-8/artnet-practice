import { CameraPath } from "./cameraPath.js";

export class CameraEvent {
  triggerTime: number;
  cameraPath: CameraPath;

  constructor(
    triggerTime: number,
    cameraPath: CameraPath
  ) {
    this.triggerTime = triggerTime;
    this.cameraPath = cameraPath;
  }
}