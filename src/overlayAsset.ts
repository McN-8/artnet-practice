export class OverlayAsset {
  id: string;
  asset: string;
  pathId: string;
  rotation: number;
  duration: number;
  followPath: boolean;

  constructor(
    id: string,
    asset: string,
    pathId: string,
    rotation: number = 0,
    duration: number = 1000,
    followPath: boolean = true
  ) {
    this.id = id;
    this.asset = asset;
    this.pathId = pathId;
    this.rotation = rotation;
    this.duration = duration;
    this.followPath = followPath;
  }
}