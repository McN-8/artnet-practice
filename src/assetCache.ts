export class AssetCache {
  loadedAssets: Set<string>;

  constructor() {
    this.loadedAssets = new Set();
  }

  loadAsset(file: string): void {
    if (this.loadedAssets.has(file)) {
      console.log(`Asset already loaded: ${file}`);
      return;
    }

    console.log(`Loading asset: ${file}`);
    this.loadedAssets.add(file);
  }

  unloadAsset(file: string): void {
    if (!this.loadedAssets.has(file)) {
      console.log(`Asset not loaded: ${file}`);
      return;
    }

    console.log(`Unloading asset: ${file}`);
    this.loadedAssets.delete(file);
  }
}