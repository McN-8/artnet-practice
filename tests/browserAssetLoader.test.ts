import assert from "node:assert/strict";
import test from "node:test";
import { Asset } from "../src/asset.js";
import { BrowserAssetLoader } from "../src/browserAssetLoader.js";

const image = new Asset("panel.png", "image");

test("browser asset loader deduplicates preloads and exposes fetched bytes", async () => {
  const requests: string[] = [];
  const loader = new BrowserAssetLoader(async (file) => {
    requests.push(file);
    return new Response(new Blob(["panel bytes"]));
  });
  loader.loadAsset(image);
  loader.loadAsset(image);
  assert.equal(loader.hasAsset(image), false);

  const blob = await loader.whenReady(image);
  assert.deepEqual(requests, ["panel.png"]);
  assert.equal(await blob.text(), "panel bytes");
  assert.equal(loader.getBlob(image), blob);
  assert.equal(loader.hasAsset(image), true);
  loader.dispose();
});

test("unload cancels a pending load and stale completion cannot replace a retry", async () => {
  let finishFirst!: (response: Response) => void;
  let requestCount = 0;
  let firstSignal: AbortSignal | undefined;
  const loader = new BrowserAssetLoader((_file, { signal }) => {
    requestCount++;
    if (requestCount === 1) {
      firstSignal = signal;
      return new Promise<Response>((resolve) => { finishFirst = resolve; });
    }
    return Promise.resolve(new Response(new Blob(["new bytes"])));
  });

  const first = loader.whenReady(image);
  await Promise.resolve();
  loader.unloadAsset(image);
  assert.equal(firstSignal?.aborted, true);
  await assert.rejects(first, { name: "AbortError" });
  const second = await loader.whenReady(image);
  finishFirst(new Response(new Blob(["old bytes"])));
  await Promise.resolve();
  assert.equal(await second.text(), "new bytes");
  assert.equal(loader.getBlob(image), second);
  assert.equal(requestCount, 2);
  loader.dispose();
});

test("failed fetches clear the cache so a later request can retry", async () => {
  let requests = 0;
  const loader = new BrowserAssetLoader(async () => {
    requests++;
    return requests === 1
      ? new Response("missing", { status: 404 })
      : new Response(new Blob(["recovered"]));
  });

  await assert.rejects(loader.whenReady(image), /HTTP 404/);
  assert.equal(loader.hasAsset(image), false);
  assert.equal(await (await loader.whenReady(image)).text(), "recovered");
  assert.equal(requests, 2);
  loader.dispose();
});

test("dispose aborts pending loads and clears ready entries", async () => {
  let signal: AbortSignal | undefined;
  const loader = new BrowserAssetLoader((_file, options) => {
    signal = options.signal;
    return new Promise<Response>(() => {});
  });
  const pending = loader.whenReady(image);
  await Promise.resolve();
  loader.dispose();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(signal?.aborted, true);
  assert.equal(loader.hasAsset(image), false);
});
