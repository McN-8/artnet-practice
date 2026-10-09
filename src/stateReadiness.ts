import { Asset } from "./asset.js";
import type { AudioCue } from "./audioCue.js";
import type { OverlayAsset } from "./overlayAsset.js";
import type { PanelGroup } from "./panelGroup.js";
import type { State } from "./state.js";

export const STATE_READINESS_POLICY_VERSION = 1;

export const STATE_READINESS_POLICY_V1 = Object.freeze({
  version: STATE_READINESS_POLICY_VERSION,
  blockingTypes: Object.freeze(["image"] as const),
  degradedTypes: Object.freeze(["audio"] as const)
});

export type StateReadinessStatus =
  "ready" | "degraded" | "failed" | "cancelled";

export interface StateAssetFailure {
  asset: Asset;
  blocking: boolean;
  message: string;
}

export interface StateReadinessReport {
  stateId: string;
  policyVersion: number;
  status: StateReadinessStatus;
  entryAllowed: boolean;
  assets: readonly Asset[];
  failures: readonly StateAssetFailure[];
}

interface ReadyAssetLoader {
  whenReady(asset: Asset): Promise<Blob>;
}

interface ReadinessAttempt {
  cancel: () => void;
  cancelled: Promise<void>;
}

/** Collects the media directly addressable from one reconstructed state. */
export function collectStateAssets(state: State): Asset[] {
  const assets = new Map<string, Asset>();
  const add = (file: string | undefined, type: string) => {
    if (!file) return;
    const key = `${type}:${file}`;
    if (!assets.has(key)) assets.set(key, new Asset(file, type));
  };
  const addPanelGroup = (group: PanelGroup) => {
    for (const reveal of group.reveals) add(reveal.panel.asset, "image");
  };
  const addAudio = (cue: AudioCue) => add(cue.file, "audio");
  const addOverlay = (overlay: OverlayAsset) => add(overlay.asset, "image");

  add(state.image, "image");
  for (const asset of state.assets) add(asset.file, asset.type);
  for (const cue of state.audioCues) addAudio(cue);
  for (const group of state.panelGroups) addPanelGroup(group);
  for (const event of state.timeline.events) {
    if (event.type === "audio") addAudio(event.payload as AudioCue);
    if (event.type === "overlay") addOverlay(event.payload as OverlayAsset);
    if (event.type === "panelGroup") {
      addPanelGroup(event.payload as PanelGroup);
    }
  }
  return [...assets.values()];
}

/**
 * Applies readiness policy without owning or evicting the shared asset cache.
 * A newer preparation or disposal cancels the old report immediately; its
 * underlying shared fetches may still populate the loader cache.
 */
export class StateReadinessCoordinator {
  private active: ReadinessAttempt | undefined;
  private disposed = false;

  constructor(private readonly loader: ReadyAssetLoader) {}

  async prepare(state: State): Promise<StateReadinessReport> {
    if (this.disposed) return this.cancelledReport(state);
    this.cancelPending();
    let resolveCancellation!: () => void;
    const attempt: ReadinessAttempt = {
      cancel: () => resolveCancellation(),
      cancelled: new Promise<void>((resolve) => {
        resolveCancellation = resolve;
      })
    };
    this.active = attempt;
    const assets = collectStateAssets(state);
    const readiness = Promise.allSettled(
      assets.map((asset) => this.loader.whenReady(asset))
    );
    const outcome = await Promise.race([
      readiness.then((results) => ({results})),
      attempt.cancelled.then(() => ({cancelled: true as const}))
    ]);
    if ("cancelled" in outcome) return this.cancelledReport(state, assets);
    if (this.active === attempt) this.active = undefined;

    const failures: StateAssetFailure[] = [];
    outcome.results.forEach((result, index) => {
      if (result.status === "fulfilled") return;
      const asset = assets[index]!;
      failures.push({
        asset,
        blocking: asset.type === "image",
        message: result.reason instanceof Error
          ? result.reason.message : String(result.reason)
      });
    });
    const blockingFailure = failures.some((failure) => failure.blocking);
    return {
      stateId: state.id,
      policyVersion: STATE_READINESS_POLICY_VERSION,
      status: blockingFailure ? "failed" : failures.length ? "degraded" : "ready",
      entryAllowed: !blockingFailure,
      assets,
      failures
    };
  }

  cancelPending(): void {
    this.active?.cancel();
    this.active = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelPending();
  }

  private cancelledReport(
    state: State, assets: readonly Asset[] = collectStateAssets(state)
  ): StateReadinessReport {
    return {
      stateId: state.id,
      policyVersion: STATE_READINESS_POLICY_VERSION,
      status: "cancelled",
      entryAllowed: false,
      assets,
      failures: []
    };
  }
}
