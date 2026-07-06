export class PanelReveal {
  panelId: string;
  delay: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;

  constructor(
    panelId: string,
    delay: number = 0,
    x: number = 0,
    y: number = 0,
    width: number = 100,
    height: number = 100,
    rotation: number = 0
  ) {
    this.panelId = panelId;
    this.delay = delay;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = rotation;
  }
}