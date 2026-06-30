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

}