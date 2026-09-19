import { Asset } from "./asset.js";
import type { CameraPath } from "./cameraPath.js";
import type { Effect } from "./effect.js";
import type { OverlayAsset } from "./overlayAsset.js";
import type { PanelReveal } from "./panelReveal.js";
import type { Renderer } from "./renderer.js";
import type { State } from "./state.js";
import type { RenderContext } from "./visualContract.js";
import { ARTNET_COORDINATE_SYSTEM } from "./visualContract.js";

interface BrowserImageAssets {
  whenReady(asset: Asset): Promise<Blob>;
}

interface ObjectUrlFactory {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

/** First browser adapter: state artwork, dialogue, and panel reveals only. */
export class BrowserRenderer implements Renderer {
  private readonly stage: HTMLElement;
  private readonly backgroundLayer: HTMLElement;
  private readonly panelLayer: HTMLElement;
  private readonly dialogueLayer: HTMLElement;
  private readonly sceneObjectUrls = new Map<string, string>();
  private sceneGeneration = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | undefined;
  private resizeListener: (() => void) | undefined;

  constructor(
    private readonly root: HTMLElement,
    observeResize: boolean = true,
    private readonly imageAssets?: BrowserImageAssets,
    private readonly objectUrls: ObjectUrlFactory = URL
  ) {
    const document = root.ownerDocument;
    this.stage = document.createElement("div");
    this.backgroundLayer = document.createElement("div");
    this.panelLayer = document.createElement("div");
    this.dialogueLayer = document.createElement("div");

    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "ArtNet story player");
    root.style.position = "relative";
    root.style.overflow = "hidden";
    root.style.backgroundColor = "#000";

    this.stage.style.position = "absolute";
    this.stage.style.width = `${ARTNET_COORDINATE_SYSTEM.width}px`;
    this.stage.style.height = `${ARTNET_COORDINATE_SYSTEM.height}px`;
    this.stage.style.transformOrigin = "top left";
    this.stage.style.overflow = "hidden";

    for (const layer of [
      this.backgroundLayer,
      this.panelLayer,
      this.dialogueLayer
    ]) {
      layer.style.position = "absolute";
      layer.style.inset = "0";
      this.stage.append(layer);
    }

    this.stage.setAttribute("data-artnet-stage", "");
    this.stage.setAttribute("aria-live", "off");
    this.stage.setAttribute("aria-atomic", "false");
    this.stage.setAttribute("data-coordinate-system", "logicalPixels");
    root.replaceChildren(this.stage);
    this.layout();

    if (observeResize) {
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.layout());
        this.resizeObserver.observe(root);
      } else if (typeof window !== "undefined") {
        this.resizeListener = () => this.layout();
        window.addEventListener("resize", this.resizeListener);
      }
    }
  }

  /** Recompute uniform containment after a host changes size. */
  layout(): void {
    const viewport = this.root.getBoundingClientRect();
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const scale = Math.min(
      viewport.width / ARTNET_COORDINATE_SYSTEM.width,
      viewport.height / ARTNET_COORDINATE_SYSTEM.height
    );
    this.stage.style.left =
      `${(viewport.width - ARTNET_COORDINATE_SYSTEM.width * scale) / 2}px`;
    this.stage.style.top =
      `${(viewport.height - ARTNET_COORDINATE_SYSTEM.height * scale) / 2}px`;
    this.stage.style.transform = `scale(${scale})`;
  }

  renderState(state: State, _context: RenderContext): void {
    if (this.disposed) return;
    this.releaseSceneImages();
    const document = this.root.ownerDocument;
    const background = document.createElement("img");
    this.setImageSource(background, state.image);
    background.setAttribute("alt", "");
    background.style.width = "100%";
    background.style.height = "100%";
    background.style.objectFit = "contain";
    this.backgroundLayer.replaceChildren(background);

    this.panelLayer.replaceChildren();
    const dialogue = document.createElement("div");
    dialogue.textContent = state.dialogue;
    dialogue.style.position = "absolute";
    dialogue.style.left = "0";
    dialogue.style.right = "0";
    dialogue.style.bottom = "0";
    dialogue.style.padding = "20px 32px";
    dialogue.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    dialogue.style.color = "#fff";
    dialogue.style.fontSize = "32px";
    dialogue.style.lineHeight = "1.4";
    this.dialogueLayer.replaceChildren(dialogue);
  }

  revealPanel(reveal: PanelReveal, _context: RenderContext): void {
    if (this.disposed) return;
    const document = this.root.ownerDocument;
    const placement = document.createElement("div");
    const transform = reveal.treatment.transform;
    const flipX = transform.flipX ? -1 : 1;
    const flipY = transform.flipY ? -1 : 1;
    placement.setAttribute("data-panel-id", reveal.panel.id);
    placement.style.position = "absolute";
    placement.style.left = `${reveal.x}px`;
    placement.style.top = `${reveal.y}px`;
    placement.style.width = `${reveal.width}px`;
    placement.style.height = `${reveal.height}px`;
    placement.style.transformOrigin =
      `${transform.originX * 100}% ${transform.originY * 100}%`;
    placement.style.transform = [
      `translate(${transform.translateX}px, ${transform.translateY}px)`,
      `rotate(${reveal.rotation + transform.rotation}deg)`,
      `skew(${transform.skewX}deg, ${transform.skewY}deg)`,
      `scale(${transform.scaleX * flipX}, ${transform.scaleY * flipY})`
    ].join(" ");
    placement.style.opacity = String(reveal.treatment.appearance.opacity);

    if (reveal.panel.asset) {
      const image = document.createElement("img");
      this.setImageSource(image, reveal.panel.asset);
      image.setAttribute("alt", reveal.panel.accessibleDescription ?? "");
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";
      placement.append(image);
    } else if (reveal.panel.accessibleDescription) {
      placement.setAttribute("role", "img");
      placement.setAttribute(
        "aria-label", reveal.panel.accessibleDescription
      );
    }

    this.panelLayer.append(placement);
  }

  runCameraPath(_path: CameraPath, _context: RenderContext): void {}
  runEffect(_effect: Effect, _context: RenderContext): void {}
  displayOverlay(_overlay: OverlayAsset, _context: RenderContext): void {}

  private setImageSource(image: HTMLElement, file: string): void {
    const assets = this.imageAssets;
    if (!assets) {
      image.setAttribute("src", file);
      return;
    }

    const existingUrl = this.sceneObjectUrls.get(file);
    if (existingUrl) {
      image.setAttribute("src", existingUrl);
      image.setAttribute("data-asset-status", "fetched");
      return;
    }

    const generation = this.sceneGeneration;
    image.setAttribute("data-asset-status", "loading");
    void Promise.resolve()
      .then(() => assets.whenReady(new Asset(file, "image")))
      .then((blob) => {
        if (this.disposed || generation !== this.sceneGeneration) return;
        let url = this.sceneObjectUrls.get(file);
        if (!url) {
          url = this.objectUrls.createObjectURL(blob);
          this.sceneObjectUrls.set(file, url);
        }
        image.setAttribute("src", url);
        image.setAttribute("data-asset-status", "fetched");
      })
      .catch(() => {
        if (this.disposed || generation !== this.sceneGeneration) return;
        image.setAttribute("data-asset-status", "failed");
      });
  }

  private releaseSceneImages(): void {
    this.sceneGeneration++;
    for (const url of this.sceneObjectUrls.values()) {
      this.objectUrls.revokeObjectURL(url);
    }
    this.sceneObjectUrls.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseSceneImages();
    this.resizeObserver?.disconnect();
    if (this.resizeListener) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeListener = undefined;
    }
    this.root.replaceChildren();
  }
}
