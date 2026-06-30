import { AudioLayer } from "./audioLayer.js";

export class AudioStack {
  layers: AudioLayer[];

  constructor() {
    this.layers = [];
  }

  addLayer(layer: AudioLayer): void {
    this.layers.push(layer);
  }

  activateLayer(id: string): void {
    const layer = this.layers.find(
      (layer) => layer.id === id
    );

    if (!layer) {
      console.log(`Layer not found: ${id}`);
      return;
    }

    layer.activate();
  }

  deactivateLayer(id: string): void {
    const layer = this.layers.find(
      (layer) => layer.id === id
    );

    if (!layer) {
      console.log(`Layer not found: ${id}`);
      return;
    }

    layer.deactivate();
  }
}