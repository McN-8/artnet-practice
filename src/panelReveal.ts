export class PanelReveal {
  panelId: string;
  delay: number;

  constructor(panelId: string, delay: number = 0) {
    this.panelId = panelId;
    this.delay = delay;
  }
}