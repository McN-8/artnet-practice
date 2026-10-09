import assert from "node:assert/strict";
import test from "node:test";
import { Asset } from "../src/asset.js";
import { AudioCue } from "../src/audioCue.js";
import { OverlayAsset } from "../src/overlayAsset.js";
import { Panel } from "../src/panel.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import { State } from "../src/state.js";
import {
  collectStateAssets,
  StateReadinessCoordinator
} from "../src/stateReadiness.js";
import { TimelineEvent } from "../src/timelineEvent.js";

function mediaState(): State {
  const state = new State("scene", "background.png", "Scene");
  state.addAsset(new Asset("background.png", "image"));
  state.addAsset(new Asset("extra.png", "image"));
  state.addAudioCue(new AudioCue(
    "music", "music.mp3", "music", true, 1, "enter"
  ));
  const panels = new PanelGroup("panels");
  panels.addReveal(new PanelReveal(new Panel("hero", "hero.png")));
  state.addPanelGroup(panels);
  state.timeline.addEvent(new TimelineEvent(0, "panelGroup", panels));
  state.timeline.addEvent(new TimelineEvent(10, "overlay",
    new OverlayAsset("spark", "spark.png", "path")));
  state.timeline.addEvent(new TimelineEvent(20, "audio",
    new AudioCue("hit", "hit.wav", "soundEffect", false, 1, "timeline")));
  return state;
}

test("state readiness collection covers and deduplicates directly owned media", () => {
  assert.deepEqual(collectStateAssets(mediaState()).map(
    (asset) => `${asset.type}:${asset.file}`
  ), [
    "image:background.png", "image:extra.png", "audio:music.mp3",
    "image:hero.png", "image:spark.png", "audio:hit.wav"
  ]);
});

test("image failure blocks entry while audio failure degrades gracefully", async () => {
  const state = mediaState();
  const imageFailure = new StateReadinessCoordinator({
    whenReady: async (asset) => {
      if (asset.file === "hero.png") throw new Error("missing panel");
      return new Blob();
    }
  });
  const failed = await imageFailure.prepare(state);
  assert.equal(failed.status, "failed");
  assert.equal(failed.entryAllowed, false);
  assert.deepEqual(failed.failures.map((failure) => ({
    file: failure.asset.file,
    blocking: failure.blocking,
    message: failure.message
  })), [{file: "hero.png", blocking: true, message: "missing panel"}]);

  const audioFailure = new StateReadinessCoordinator({
    whenReady: async (asset) => {
      if (asset.type === "audio") throw new Error("audio unavailable");
      return new Blob();
    }
  });
  const degraded = await audioFailure.prepare(state);
  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.entryAllowed, true);
  assert.ok(degraded.failures.every((failure) => !failure.blocking));
});

test("new preparation cancels the stale report without evicting loads", async () => {
  const pending = new Map<string, () => void>();
  const coordinator = new StateReadinessCoordinator({
    whenReady: (asset) => new Promise<Blob>((resolve) => {
      pending.set(asset.file, () => resolve(new Blob()));
    })
  });
  const firstState = new State("first", "first.png", "First");
  const secondState = new State("second", "second.png", "Second");
  const first = coordinator.prepare(firstState);
  const second = coordinator.prepare(secondState);
  assert.equal((await first).status, "cancelled");
  pending.get("second.png")!();
  assert.equal((await second).status, "ready");
  pending.get("first.png")!();
  coordinator.dispose();
  assert.equal((await coordinator.prepare(firstState)).status, "cancelled");
});
