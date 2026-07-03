import { PanelReveal } from "./panelReveal.js";

export class PanelGroup {
  id: string;
  reveals: PanelReveal[];

  constructor(id: string) {
    this.id = id;
    this.reveals = [];
  }

  addReveal(reveal: PanelReveal): void {
    this.reveals.push(reveal);
  }
}