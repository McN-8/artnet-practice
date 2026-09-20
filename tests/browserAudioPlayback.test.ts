import assert from "node:assert/strict";
import test from "node:test";
import { AudioCue } from "../src/audioCue.js";
import { Asset } from "../src/asset.js";
import { BrowserAssetLoader } from "../src/browserAssetLoader.js";
import { BrowserAudioPlayback } from "../src/browserAudioPlayback.js";

const cue = new AudioCue(
  "wind", "wind.mp3", "ambience", true, 0.4, "onEnterState"
);

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

test("browser audio plays fetched bytes and releases its URL on stop", async () => {
  const requests: string[] = [];
  const revoked: string[] = [];
  const handles: Array<{src: string; volume: number; loop: boolean;
    pauses: number}> = [];
  const loader = new BrowserAssetLoader(async (file) => {
    requests.push(file);
    return new Response(new Blob(["audio"]));
  });
  const playback = new BrowserAudioPlayback(loader, () => {
    const handle = {
      src: "", volume: 1, loop: false, pauses: 0,
      play: async () => {},
      pause() { this.pauses++; },
      removeAttribute(name: string) { if (name === "src") this.src = ""; }
    };
    handles.push(handle);
    return handle;
  }, {
    createObjectURL: () => "blob:wind",
    revokeObjectURL: (url) => { revoked.push(url); }
  });
  playback.activateLayer("ambience");
  assert.equal(playback.isLayerActive("ambience"), true);
  playback.playCue(cue);
  playback.playCue(cue);
  assert.equal(playback.getStatus(cue.id), "loading");
  await loader.whenReady(new Asset(cue.file, "audio"));
  await settle();
  assert.equal(playback.getStatus(cue.id), "playing");
  assert.deepEqual(requests, ["wind.mp3"]);
  assert.equal(handles.length, 1);
  assert.equal(handles[0]!.src, "blob:wind");
  assert.equal(handles[0]!.volume, 0.4);
  assert.equal(handles[0]!.loop, true);
  playback.stopCue(cue);
  assert.equal(handles[0]!.pauses, 1);
  assert.equal(handles[0]!.src, "");
  assert.deepEqual(revoked, ["blob:wind"]);
  playback.deactivateLayer("ambience");
  assert.equal(playback.isLayerActive("ambience"), false);
  playback.dispose();
  loader.dispose();
});

test("stopping during fetch prevents late playback", async () => {
  let finish!: (response: Response) => void;
  let created = 0;
  const loader = new BrowserAssetLoader(() =>
    new Promise<Response>((resolve) => { finish = resolve; })
  );
  const playback = new BrowserAudioPlayback(loader, () => {
    created++;
    throw new Error("Should not create audio");
  });
  playback.playCue(cue);
  await settle();
  playback.stopCue(cue);
  finish(new Response(new Blob(["late"])));
  await settle();
  assert.equal(created, 0);
  assert.equal(playback.getStatus(cue.id), undefined);
  playback.dispose();
  loader.dispose();
});

test("autoplay rejection is observable and a later cue can retry", async () => {
  const revoked: string[] = [];
  let attempts = 0;
  const loader = new BrowserAssetLoader(async () =>
    new Response(new Blob(["audio"]))
  );
  const playback = new BrowserAudioPlayback(loader, () => ({
    src: "", volume: 1, loop: false,
    play: async () => {
      if (++attempts === 1) throw new Error("NotAllowedError");
    },
    pause: () => {},
    removeAttribute: () => {}
  }), {
    createObjectURL: () => `blob:${attempts}`,
    revokeObjectURL: (url) => { revoked.push(url); }
  });
  playback.playCue(cue);
  await loader.whenReady(new Asset(cue.file, "audio"));
  await settle();
  assert.equal(playback.getStatus(cue.id), "blocked");
  assert.deepEqual(revoked, ["blob:0"]);
  playback.playCue(cue);
  await settle();
  assert.equal(playback.getStatus(cue.id), "playing");
  playback.dispose();
  assert.deepEqual(revoked, ["blob:0", "blob:1"]);
  loader.dispose();
});
