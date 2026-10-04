import assert from "node:assert/strict";
import test from "node:test";
import { AudioStack } from "../src/audioStack.js";
import { Asset } from "../src/asset.js";
import { BrowserAssetLoader } from "../src/browserAssetLoader.js";
import { BrowserRenderer } from "../src/browserRenderer.js";
import { CameraFocalPoint } from "../src/cameraFocalPoint.js";
import { CameraPath } from "../src/cameraPath.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import { OverlayAsset } from "../src/overlayAsset.js";
import { Panel } from "../src/panel.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import { State } from "../src/state.js";
import { TimelineEvent } from "../src/timelineEvent.js";
import { VisualGroup } from "../src/visualGroup.js";
import {
  createRenderContext,
  DEFAULT_RENDER_CONTEXT
} from "../src/visualContract.js";
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES
} from "../src/accessibilityContract.js";
import { createDefaultVisualTreatment } from
  "../src/visualTransformation.js";

class FakeElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  textContent = "";
  width = 1200;
  height = 900;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument
  ) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  decode(): Promise<void> {
    return Promise.resolve();
  }

  append(child: FakeElement): void {
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children = children;
  }

  getBoundingClientRect(): { width: number; height: number } {
    return {width: this.width, height: this.height};
  }
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

function mount(): {root: FakeElement; renderer: BrowserRenderer} {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const renderer = new BrowserRenderer(root as unknown as HTMLElement, false);
  return {root, renderer};
}

async function settleRendererPromises(): Promise<void> {
  for (let step = 0; step < 20; step++) await Promise.resolve();
}

test("browser renderer uniformly contains the logical canvas", () => {
  const {root, renderer} = mount();
  const stage = root.children[0]!;
  assert.equal(stage.style.width, "1600px");
  assert.equal(stage.style.height, "900px");
  assert.equal(stage.style.transform, "scale(0.75)");
  assert.equal(stage.style.left, "0px");
  assert.equal(stage.style.top, "112.5px");

  root.width = 900;
  root.height = 900;
  renderer.layout();
  assert.equal(stage.style.transform, "scale(0.5625)");
  assert.equal(stage.style.top, "196.875px");
  renderer.dispose();
});

test("state and panel DOM use text and accessible image descriptions", () => {
  const {root, renderer} = mount();
  const first = new State(
    "one", "one.png", "<script>literal dialogue</script>"
  );
  renderer.renderState(first, DEFAULT_RENDER_CONTEXT);
  const stage = root.children[0]!;
  const background = stage.children[0]!.children[0]!;
  const dialogue = stage.children[4]!.children[0]!;
  assert.equal(background.attributes.get("src"), "one.png");
  assert.equal(background.attributes.get("alt"), "");
  assert.equal(dialogue.textContent, "<script>literal dialogue</script>");

  const treatment = createDefaultVisualTreatment();
  treatment.transform.scaleX = 1.5;
  treatment.transform.flipY = true;
  treatment.appearance.opacity = 0.5;
  treatment.appearance.filter = "grayscale(1)";
  treatment.appearance.outlineWidth = 4;
  treatment.appearance.outlineColor = "#ff00aa";
  treatment.crop = {x: 0.1, y: 0.2, width: 0.6, height: 0.5};
  treatment.mask = {shape: "ellipse", feather: 0.25};
  renderer.revealPanel(new PanelReveal(
    new Panel("moon", "moon.png", "A bright moon"),
    0, 10, 20, 300, 200, 15, treatment
  ), DEFAULT_RENDER_CONTEXT);
  const placement = stage.children[1]!.children[0]!;
  assert.equal(placement.style.left, "10px");
  assert.equal(placement.style.width, "300px");
  assert.equal(placement.style.opacity, "0.5");
  assert.equal(placement.style.filter, "grayscale(1)");
  assert.equal(placement.style.outline, "4px solid #ff00aa");
  assert.equal(placement.style.outlineOffset, "-4px");
  assert.equal(placement.style.clipPath, "ellipse(50% 50% at 50% 50%)");
  assert.equal(placement.attributes.get("data-mask-feather"), "0.25");
  assert.match(placement.style.transform!, /rotate\(15deg\)/);
  assert.match(placement.style.transform!, /scale\(1.5, -1\)/);
  assert.equal(placement.children[0]!.attributes.get("alt"), "A bright moon");
  assert.equal(placement.children[0]!.style.clipPath,
    "inset(20% 30% 30% 10%)");

  renderer.renderState(new State("two", "two.png", "Second"),
    DEFAULT_RENDER_CONTEXT);
  assert.equal(stage.children[1]!.children.length, 0);
  assert.equal(stage.children[0]!.children[0]!.attributes.get("src"), "two.png");
  assert.equal(stage.children[4]!.children[0]!.textContent, "Second");
});

test("engine reveals browser panels on its deterministic clock", () => {
  const {root, renderer} = mount();
  const clock = new DeterministicClock();
  const state = new State("one", "one.png", "A scene");
  const group = new PanelGroup("opening");
  group.addReveal(new PanelReveal(
    new Panel("one-panel", "panel.png", "A window"), 50
  ));
  state.timeline.addEvent(new TimelineEvent(10, "panelGroup", group));
  const engine = new Engine(
    state, [state], new AudioStack(), 1, 2, clock, renderer
  );
  engine.startState(state);
  const panels = root.children[0]!.children[1]!;
  clock.advanceBy(59);
  assert.equal(panels.children.length, 0);
  clock.advanceBy(1);
  assert.equal(panels.children[0]!.attributes.get("data-panel-id"),
    "one-panel");
  engine.clearActiveTimers();
  renderer.dispose();
});

test("reduced-motion context does not add browser animation", () => {
  const {root, renderer} = mount();
  const context = createRenderContext({
    ...DEFAULT_ACCESSIBILITY_PREFERENCES,
    reducedMotion: true
  });
  renderer.renderState(new State("one", "one.png", "Still"), context);
  renderer.revealPanel(new PanelReveal(
    new Panel("p", "p.png", "A panel")
  ), context);
  const stage = root.children[0]!;
  const panel = stage.children[1]!.children[0]!;
  assert.equal(panel.style.transition, undefined);
  assert.equal(panel.style.animation, undefined);
  assert.equal(stage.style.transition, undefined);
  renderer.dispose();
});

test("browser renderer composes group and instance treatments", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const groupTreatment = createDefaultVisualTreatment();
  groupTreatment.transform.translateX = 30;
  groupTreatment.appearance.opacity = 0.8;
  groupTreatment.deformation = {
    type: "stretch", amountX: 0.5, amountY: 0
  };
  groupTreatment.crop = {x: 0.1, y: 0.2, width: 0.7, height: 0.6};
  const group = new VisualGroup("characters", ["hero"], groupTreatment);
  const instanceTreatment = createDefaultVisualTreatment();
  instanceTreatment.transform.rotation = 5;
  instanceTreatment.deformation = {
    type: "squeeze", amountX: 0.5, amountY: -1
  };
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, undefined,
    {createObjectURL: () => "", revokeObjectURL: () => {}},
    async () => {}, undefined, {getAll: () => [group]}
  );
  renderer.renderState(new State("one", "page.png", "Scene"),
    DEFAULT_RENDER_CONTEXT);
  renderer.revealPanel(new PanelReveal(
    new Panel("hero", "hero.png", "The hero"),
    0, 10, 20, 300, 200, 15, instanceTreatment
  ), DEFAULT_RENDER_CONTEXT);

  const placement = root.children[0]!.children[1]!.children[0]!;
  const groupCrop = placement.children[0]!;
  const instance = groupCrop.children[0]!;
  assert.equal(placement.attributes.get("data-visual-group-id"), "characters");
  assert.equal(placement.style.opacity, "0.8");
  assert.match(placement.style.transform!, /translate\(30px, 0px\)/);
  assert.match(placement.style.transform!, /scale\(1\.414214, 1\)$/);
  assert.equal(groupCrop.style.clipPath, "inset(20% 20% 20% 10%)");
  assert.match(instance.style.transform!, /rotate\(20deg\)/);
  assert.match(instance.style.transform!, /scale\(0\.707107, 2\)$/);
  assert.equal(instance.children[0]!.attributes.get("alt"), "The hero");
  renderer.dispose();
});

test("renderer uses fetched blobs, shares a scene URL, and revokes it", async () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const requests: string[] = [];
  const created: string[] = [];
  const revoked: string[] = [];
  const loader = new BrowserAssetLoader(async (file) => {
    requests.push(file);
    return new Response(new Blob([file]));
  });
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement,
    false,
    loader,
    {
      createObjectURL: () => {
        const url = `blob:test-${created.length + 1}`;
        created.push(url);
        return url;
      },
      revokeObjectURL: (url) => { revoked.push(url); }
    }
  );
  renderer.renderState(new State("one", "shared.png", "One"),
    DEFAULT_RENDER_CONTEXT);
  const stage = root.children[0]!;
  const background = stage.children[0]!.children[0]!;
  assert.equal(background.attributes.get("src"), undefined);
  assert.equal(background.attributes.get("data-asset-status"), "loading");

  await loader.whenReady(new Asset("shared.png", "image"));
  await settleRendererPromises();
  assert.equal(background.attributes.get("src"), "blob:test-1");
  assert.equal(background.attributes.get("data-asset-status"), "decoded");
  renderer.revealPanel(new PanelReveal(
    new Panel("p", "shared.png", "A shared image")
  ), DEFAULT_RENDER_CONTEXT);
  await settleRendererPromises();
  const panelImage = stage.children[1]!.children[0]!.children[0]!;
  assert.equal(panelImage.attributes.get("src"), "blob:test-1");
  assert.deepEqual(requests, ["shared.png"]);
  assert.deepEqual(created, ["blob:test-1"]);

  renderer.renderState(new State("two", "second.png", "Two"),
    DEFAULT_RENDER_CONTEXT);
  assert.deepEqual(revoked, ["blob:test-1"]);
  await loader.whenReady(new Asset("second.png", "image"));
  await settleRendererPromises();
  assert.equal(stage.children[0]!.children[0]!.attributes.get("src"),
    "blob:test-2");
  renderer.dispose();
  assert.deepEqual(revoked, ["blob:test-1", "blob:test-2"]);
  assert.equal(root.children.length, 0);
  loader.dispose();
});

test("stale fetch completion cannot repaint a later state", async () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  let finishOld!: (response: Response) => void;
  const created: string[] = [];
  const loader = new BrowserAssetLoader((file) =>
    file === "old.png"
      ? new Promise<Response>((resolve) => { finishOld = resolve; })
      : Promise.resolve(new Response(new Blob(["new"])))
  );
  const renderer = new BrowserRenderer(root as unknown as HTMLElement,
    false, loader, {
      createObjectURL: () => {
        const url = `blob:test-${created.length + 1}`;
        created.push(url);
        return url;
      },
      revokeObjectURL: () => {}
    });
  renderer.renderState(new State("old", "old.png", "Old"),
    DEFAULT_RENDER_CONTEXT);
  await Promise.resolve();
  await Promise.resolve();
  renderer.renderState(new State("new", "new.png", "New"),
    DEFAULT_RENDER_CONTEXT);
  finishOld(new Response(new Blob(["old"])));
  await loader.whenReady(new Asset("new.png", "image"));
  await settleRendererPromises();
  assert.equal(root.children[0]!.children[0]!.children[0]!
    .attributes.get("src"), "blob:test-1");
  assert.deepEqual(created, ["blob:test-1"]);
  renderer.dispose();
  loader.dispose();
});

test("failed image fetch leaves an accessible but unpainted image", async () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const loader = new BrowserAssetLoader(async () =>
    new Response("missing", {status: 404})
  );
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, loader
  );
  renderer.renderState(new State("one", "missing.png", "Scene"),
    DEFAULT_RENDER_CONTEXT);
  await assert.rejects(
    loader.whenReady(new Asset("missing.png", "image")),
    /HTTP 404/
  );
  await Promise.resolve();
  const background = root.children[0]!.children[0]!.children[0]!;
  assert.equal(background.attributes.get("src"), undefined);
  assert.equal(background.attributes.get("alt"), "");
  assert.equal(background.attributes.get("data-asset-status"), "failed");
  renderer.dispose();
  loader.dispose();
});

test("image status waits for decode and decode failure clears the source", async () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const loader = new BrowserAssetLoader(async () =>
    new Response(new Blob(["image bytes"]))
  );
  let resolveDecode!: () => void;
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, loader,
    {createObjectURL: () => "blob:test", revokeObjectURL: () => {}},
    () => new Promise<void>((resolve) => { resolveDecode = resolve; })
  );
  renderer.renderState(new State("one", "one.png", "Scene"),
    DEFAULT_RENDER_CONTEXT);
  await loader.whenReady(new Asset("one.png", "image"));
  await settleRendererPromises();
  const background = root.children[0]!.children[0]!.children[0]!;
  assert.equal(background.attributes.get("data-asset-status"), "fetched");
  resolveDecode();
  await settleRendererPromises();
  assert.equal(background.attributes.get("data-asset-status"), "decoded");
  renderer.dispose();
  loader.dispose();

  const failedRoot = document.createElement("div");
  const failedLoader = new BrowserAssetLoader(async () =>
    new Response(new Blob(["bad image bytes"]))
  );
  const failedRenderer = new BrowserRenderer(
    failedRoot as unknown as HTMLElement, false, failedLoader,
    {createObjectURL: () => "blob:failed", revokeObjectURL: () => {}},
    async () => { throw new Error("Unsupported image"); }
  );
  failedRenderer.renderState(new State("two", "two.png", "Readable"),
    DEFAULT_RENDER_CONTEXT);
  await failedLoader.whenReady(new Asset("two.png", "image"));
  await settleRendererPromises();
  const failedImage = failedRoot.children[0]!.children[0]!.children[0]!;
  assert.equal(failedImage.attributes.get("src"), undefined);
  assert.equal(failedImage.attributes.get("data-asset-status"), "failed");
  assert.equal(failedRoot.children[0]!.children[4]!.children[0]!.textContent,
    "Readable");
  failedRenderer.dispose();
  failedLoader.dispose();
});

test("late decode cannot change a replaced scene", async () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const loader = new BrowserAssetLoader(async (file) =>
    new Response(new Blob([file]))
  );
  let rejectOld!: (reason: Error) => void;
  let decodeCalls = 0;
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, loader,
    {createObjectURL: (blob) => `blob:${blob.size}`,
      revokeObjectURL: () => {}},
    () => ++decodeCalls === 1
      ? new Promise<void>((_resolve, reject) => { rejectOld = reject; })
      : Promise.resolve()
  );
  renderer.renderState(new State("old", "old.png", "Old"),
    DEFAULT_RENDER_CONTEXT);
  await loader.whenReady(new Asset("old.png", "image"));
  await settleRendererPromises();
  const oldImage = root.children[0]!.children[0]!.children[0]!;
  renderer.renderState(new State("new", "new.png", "New"),
    DEFAULT_RENDER_CONTEXT);
  rejectOld(new Error("late decode failure"));
  await loader.whenReady(new Asset("new.png", "image"));
  await settleRendererPromises();
  assert.equal(oldImage.attributes.get("data-asset-status"), "fetched");
  assert.equal(root.children[0]!.children[0]!.children[0]!
    .attributes.get("data-asset-status"), "decoded");
  renderer.dispose();
  loader.dispose();
});

test("browser overlay follows a resolved path on its dedicated layer", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const path = new CameraPath(
    "flight", new CameraFocalPoint("start", 100, 200, 1),
    new CameraFocalPoint("end", 500, 600, 1), 900, "ease-in-out"
  );
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, undefined,
    {createObjectURL: () => "", revokeObjectURL: () => {}},
    async () => {}, {get: (id) => id === path.id ? path : undefined}
  );
  renderer.renderState(new State("one", "page.png", "Scene"),
    DEFAULT_RENDER_CONTEXT);
  renderer.displayOverlay(
    new OverlayAsset("bird", "bird.png", "flight", 15, 800, true),
    DEFAULT_RENDER_CONTEXT
  );
  const stage = root.children[0]!;
  const overlay = stage.children[2]!.children[0]!;
  assert.equal(overlay.attributes.get("data-overlay-id"), "bird");
  assert.equal(overlay.attributes.get("data-overlay-status"), "rendered");
  assert.equal(overlay.style.left, "500px");
  assert.equal(overlay.style.top, "600px");
  assert.equal(overlay.style.transition,
    "left 800ms ease-in-out, top 800ms ease-in-out");
  assert.equal(overlay.style.transform,
    "translate(-50%, -50%) rotate(15deg)");
  assert.equal(overlay.children[0]!.attributes.get("src"), "bird.png");
  assert.equal(overlay.children[0]!.attributes.get("alt"), "");

  renderer.displayOverlay(
    new OverlayAsset("missing", "x.png", "unknown"),
    DEFAULT_RENDER_CONTEXT
  );
  assert.equal(stage.children[2]!.children[1]!
    .attributes.get("data-overlay-status"), "missingPath");
  renderer.dispose();
});

test("reduced motion places an overlay at its final point without animation", () => {
  const document = new FakeDocument();
  const root = document.createElement("div");
  const path = new CameraPath(
    "flight", new CameraFocalPoint("start", 0, 0, 1),
    new CameraFocalPoint("end", 40, 50, 1), 900, "linear"
  );
  const renderer = new BrowserRenderer(
    root as unknown as HTMLElement, false, undefined,
    {createObjectURL: () => "", revokeObjectURL: () => {}},
    async () => {}, {get: () => path}
  );
  renderer.renderState(new State("one", "page.png", "Scene"),
    DEFAULT_RENDER_CONTEXT);
  renderer.displayOverlay(
    new OverlayAsset("bird", "bird.png", "flight", 0, 800, true),
    createRenderContext({...DEFAULT_ACCESSIBILITY_PREFERENCES,
      reducedMotion: true})
  );
  const overlay = root.children[0]!.children[2]!.children[0]!;
  assert.equal(overlay.style.left, "40px");
  assert.equal(overlay.style.top, "50px");
  assert.equal(overlay.style.transition, undefined);
  renderer.dispose();
});

test("camera paths transform scene layers while dialogue stays fixed", () => {
  const {root, renderer} = mount();
  renderer.renderState(new State("one", "page.png", "Stationary dialogue"),
    DEFAULT_RENDER_CONTEXT);
  renderer.runCameraPath(new CameraPath(
    "pan", new CameraFocalPoint("start", 100, 200, 1.2),
    new CameraFocalPoint("end", 700, 420, 1.8),
    3000, "ease-in-out", 2
  ), DEFAULT_RENDER_CONTEXT);

  const stage = root.children[0]!;
  for (const index of [0, 1, 2, 3]) {
    const layer = stage.children[index]!;
    assert.equal(layer.style.transformOrigin, "0 0");
    assert.equal(layer.style.transform,
      "translate(800px, 450px) scale(1.8) translate(-700px, -420px)");
    assert.equal(layer.style.transition, "transform 1500ms ease-in-out");
  }
  assert.equal(stage.children[4]!.style.transform, undefined);
  assert.equal(stage.children[4]!.style.transition, undefined);
  renderer.dispose();
});

test("reduced motion finishes camera paths and new states reset them", () => {
  const {root, renderer} = mount();
  renderer.renderState(new State("one", "one.png", "One"),
    DEFAULT_RENDER_CONTEXT);
  renderer.runCameraPath(new CameraPath(
    "pan", new CameraFocalPoint("start", 0, 0, 1),
    new CameraFocalPoint("end", 400, 300, 2), 900, "linear"
  ), createRenderContext({...DEFAULT_ACCESSIBILITY_PREFERENCES,
    reducedMotion: true}));

  const stage = root.children[0]!;
  assert.equal(stage.children[0]!.style.transform,
    "translate(800px, 450px) scale(2) translate(-400px, -300px)");
  assert.equal(stage.children[0]!.style.transition, "");

  renderer.renderState(new State("two", "two.png", "Two"),
    DEFAULT_RENDER_CONTEXT);
  for (const index of [0, 1, 2, 3]) {
    assert.equal(stage.children[index]!.style.transform, "");
    assert.equal(stage.children[index]!.style.transition, "");
    assert.equal(stage.children[index]!.style.transformOrigin, "");
  }
  renderer.dispose();
});
