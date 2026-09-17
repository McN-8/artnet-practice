import type { Asset } from "./asset.js";
import type { AssetLoader } from "./subsystemAdapters.js";

export class AssetCache implements AssetLoader {
  loadedAssets: Set<string>;

  constructor() {
    this.loadedAssets = new Set();
  }

  loadAsset(asset: Asset | string): void {
    const file = typeof asset === "string" ? asset : asset.file;
    if (this.loadedAssets.has(file)) {
      console.log(`Asset already loaded: ${file}`);
      return;
    }

    console.log(`Loading asset: ${file}`);
    this.loadedAssets.add(file);
  }

  unloadAsset(asset: Asset | string): void {
    const file = typeof asset === "string" ? asset : asset.file;
    if (!this.loadedAssets.has(file)) {
      console.log(`Asset not loaded: ${file}`);
      return;
    }

    console.log(`Unloading asset: ${file}`);
    this.loadedAssets.delete(file);
  }

  hasAsset(asset: Asset): boolean {
    return this.loadedAssets.has(asset.file);
  }
}
