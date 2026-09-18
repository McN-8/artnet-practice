import type { Asset } from "./asset.js";
import type { AssetLoader } from "./subsystemAdapters.js";

type FetchAsset = (
  file: string,
  options: { signal: AbortSignal }
) => Promise<Response>;

interface PendingAsset {
  controller: AbortController;
  promise: Promise<Blob>;
  blob?: Blob;
}

function cancellationError(): Error {
  const error = new Error("Asset load cancelled");
  error.name = "AbortError";
  return error;
}

/** Fetch-backed browser preload cache. Readiness means bytes fetched, not decoded. */
export class BrowserAssetLoader implements AssetLoader {
  private readonly assets = new Map<string, PendingAsset>();

  constructor(
    private readonly fetchAsset: FetchAsset = (file, options) =>
      globalThis.fetch(file, options)
  ) {}

  loadAsset(asset: Asset): void {
    this.start(asset.file);
  }

  /** Starts a load if necessary and resolves with its cached immutable Blob. */
  whenReady(asset: Asset): Promise<Blob> {
    return this.start(asset.file).promise;
  }

  hasAsset(asset: Asset): boolean {
    return this.assets.get(asset.file)?.blob !== undefined;
  }

  getBlob(asset: Asset): Blob | undefined {
    return this.assets.get(asset.file)?.blob;
  }

  unloadAsset(asset: Asset): void {
    const entry = this.assets.get(asset.file);
    if (!entry) return;
    this.assets.delete(asset.file);
    entry.controller.abort();
  }

  dispose(): void {
    for (const entry of this.assets.values()) entry.controller.abort();
    this.assets.clear();
  }

  private start(file: string): PendingAsset {
    const existing = this.assets.get(file);
    if (existing) return existing;

    const controller = new AbortController();
    let entry: PendingAsset;
    const promise = new Promise<Blob>((resolve, reject) => {
      const onAbort = () => reject(cancellationError());
      controller.signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw cancellationError();
          return this.fetchAsset(file, { signal: controller.signal });
        })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Asset request failed for ${file}: HTTP ${response.status}`
            );
          }
          return response.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return;
          if (this.assets.get(file) === entry) entry.blob = blob;
          resolve(blob);
        })
        .catch((error: unknown) => {
          if (this.assets.get(file) === entry) this.assets.delete(file);
          reject(error);
        })
        .finally(() => {
          controller.signal.removeEventListener("abort", onAbort);
        });
    });
    entry = { controller, promise };
    // Engine preload calls are fire-and-forget; explicit whenReady callers see rejection.
    void entry.promise.catch(() => {});
    this.assets.set(file, entry);
    return entry;
  }
}
