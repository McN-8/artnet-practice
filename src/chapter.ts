import { Panel } from "./panel.js";

export class Chapter {

  title: string;

  panels: Panel[];

  constructor(title: string) {

    this.title = title;

    this.panels = [];

  }

  addPanel(panel: Panel): void {

    this.panels.push(panel);

  }

}