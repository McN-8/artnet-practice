import type { Asset } from "./asset.js";
import type { AudioCue } from "./audioCue.js";
import type { InputType } from "./inputType.js";

export interface AssetLoader {
  loadAsset(asset: Asset): void;
  unloadAsset(asset: Asset): void;
  hasAsset(asset: Asset): boolean;
}

export interface AudioPlayback {
  playCue(cue: AudioCue): void;
  stopCue(cue: AudioCue): void;
  activateLayer(id: string): void;
  deactivateLayer(id: string): void;
}

export class PrototypeAudioPlayback implements AudioPlayback {
  playCue(cue: AudioCue): void {
    console.log(`Playing audio ${cue.file} at volume ${cue.volume}.`);
  }

  stopCue(cue: AudioCue): void {
    console.log(`Stopping audio ${cue.file}.`);
  }

  activateLayer(id: string): void {
    console.log(`Activating audio layer ${id}.`);
  }

  deactivateLayer(id: string): void {
    console.log(`Deactivating audio layer ${id}.`);
  }
}

export interface ReaderInput {
  type: InputType;
  targetId?: string;
}

export interface InputSource {
  subscribe(listener: (input: ReaderInput) => void): () => void;
}

/** Test/editor input source; production devices provide their own adapter. */
export class ManualInputSource implements InputSource {
  private listeners = new Set<(input: ReaderInput) => void>();

  subscribe(listener: (input: ReaderInput) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  emit(input: ReaderInput): void {
    for (const listener of [...this.listeners]) listener(input);
  }
}
