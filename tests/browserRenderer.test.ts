import assert from "node:assert/strict";
import test from "node:test";
import { AudioStack } from "../src/audioStack.js";
import { Asset } from "../src/asset.js";
import { BrowserAssetLoader } from "../src/browserAssetLoader.js";
import { BrowserRenderer } from "../src/browserRenderer.js";
import { DeterministicClock } from "../src/clock.js";
import { Engine } from "../src/engine.js";
import { Panel } from "../src/panel.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import { State } from "../src/state.js";
import { TimelineEvent } from "../src/timelineEvent.js";
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
  for (let step = 0; step < 5; step++) await Promise.resolve();
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
  const dialogue = stage.children[2]!.children[0]!;
  assert.equal(background.attributes.get("src"), "one.png");
  assert.equal(background.attributes.get("alt"), "");
  assert.equal(dialogue.textContent, "<script>literal dialogue</script>");

  const treatment = createDefaultVisualTreatment();
  treatment.transform.scaleX = 1.5;
  treatment.transform.flipY = true;
  treatment.appearance.opacity = 0.5;
  renderer.revealPanel(new PanelReveal(
    new Panel("moon", "moon.png", "A bright moon"),
    0, 10, 20, 300, 200, 15, treatment
  ), DEFAULT_RENDER_CONTEXT);
  const placement = stage.children[1]!.children[0]!;
  assert.equal(placement.style.left, "10px");
  assert.equal(placement.style.width, "300px");
  assert.equal(placement.style.opacity, "0.5");
  assert.match(placement.style.transform!, /rotate\(15deg\)/);
  assert.match(placement.style.transform!, /scale\(1.5, -1\)/);
  assert.equal(placement.children[0]!.attributes.get("alt"), "A bright moon");

  renderer.renderState(new State("two", "two.png", "Second"),
    DEFAULT_RENDER_CONTEXT);
  assert.equal(stage.children[1]!.children.length, 0);
  assert.equal(stage.children[0]!.children[0]!.attributes.get("src"), "two.png");
  assert.equal(stage.children[2]!.children[0]!.textContent, "Second");
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
  assert.equal(background.attributes.get("data-asset-status"), "fetched");
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
