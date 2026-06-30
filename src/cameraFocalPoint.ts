export class CameraFocalPoint {
  id: string;
  x: number;
  y: number;
  zoomLevel: number;

  constructor(
    id: string,
    x: number,
    y: number,
    zoomLevel: number
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.zoomLevel = zoomLevel;
  }
}