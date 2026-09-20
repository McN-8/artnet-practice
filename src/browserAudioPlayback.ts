import { Asset } from "./asset.js";
import type { AudioCue } from "./audioCue.js";
import type { AudioPlayback } from "./subsystemAdapters.js";

interface AudioAssets {
  whenReady(asset: Asset): Promise<Blob>;
}

interface AudioHandle {
  src: string;
  volume: number;
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
}

interface ObjectUrls {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export type BrowserAudioStatus =
  "loading" | "playing" | "blocked" | "failed" | "stopped";

interface ActiveCue {
  handle?: AudioHandle;
  url?: string;
  status: BrowserAudioStatus;
}

/** Minimal fetched-byte browser audio adapter; no mixing or autoplay unlock. */
export class BrowserAudioPlayback implements AudioPlayback {
  private readonly cues = new Map<string, ActiveCue>();
  private readonly layers = new Set<string>();
  private disposed = false;

  constructor(
    private readonly assets: AudioAssets,
    private readonly createAudio: () => AudioHandle = () => new Audio(),
    private readonly objectUrls: ObjectUrls = URL
  ) {}

  playCue(cue: AudioCue): void {
    if (this.disposed) return;
    const prior = this.cues.get(cue.id);
    if (prior && prior.status !== "blocked" && prior.status !== "failed") {
      return;
    }
    const entry: ActiveCue = {status: "loading"};
    this.cues.set(cue.id, entry);
    void Promise.resolve()
      .then(() => this.assets.whenReady(new Asset(cue.file, "audio")))
      .then((blob) => {
        if (!this.isCurrent(cue.id, entry)) return;
        const handle = this.createAudio();
        const url = this.objectUrls.createObjectURL(blob);
        entry.handle = handle;
        entry.url = url;
        handle.loop = cue.loop;
        handle.volume = cue.volume;
        handle.src = url;
        return handle.play().then(() => {
          if (this.isCurrent(cue.id, entry)) entry.status = "playing";
        }, () => {
          if (!this.isCurrent(cue.id, entry)) return;
          entry.status = "blocked";
          this.release(entry);
        });
      })
      .catch(() => {
        if (!this.isCurrent(cue.id, entry)) return;
        entry.status = "failed";
        this.release(entry);
      });
  }

  stopCue(cue: AudioCue): void {
    const entry = this.cues.get(cue.id);
    if (!entry) return;
    this.cues.delete(cue.id);
    entry.status = "stopped";
    this.release(entry);
  }

  activateLayer(id: string): void { this.layers.add(id); }
  deactivateLayer(id: string): void { this.layers.delete(id); }
  isLayerActive(id: string): boolean { return this.layers.has(id); }
  getStatus(id: string): BrowserAudioStatus | undefined {
    return this.cues.get(id)?.status;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.cues.values()) this.release(entry);
    this.cues.clear();
    this.layers.clear();
  }

  private isCurrent(id: string, entry: ActiveCue): boolean {
    return !this.disposed && this.cues.get(id) === entry;
  }

  private release(entry: ActiveCue): void {
    entry.handle?.pause();
    entry.handle?.removeAttribute("src");
    if (entry.url) this.objectUrls.revokeObjectURL(entry.url);
    delete entry.handle;
    delete entry.url;
  }
}
