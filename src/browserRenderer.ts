import { Asset } from "./asset.js";
import { resolveMotionDuration } from "./accessibilityContract.js";
import type { CameraPath } from "./cameraPath.js";
import type { Effect } from "./effect.js";
import type { OverlayAsset } from "./overlayAsset.js";
import type { PanelReveal } from "./panelReveal.js";
import type { Renderer } from "./renderer.js";
import type { State } from "./state.js";
import type { VisualGroup } from "./visualGroup.js";
import type { VisualTreatment } from "./visualTransformation.js";
import type { RenderContext } from "./visualContract.js";
import { ARTNET_COORDINATE_SYSTEM } from "./visualContract.js";

interface BrowserImageAssets {
  whenReady(asset: Asset): Promise<Blob>;
}

interface ObjectUrlFactory {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

interface CameraPathLookup {
  get(id: string): CameraPath | undefined;
}

interface VisualGroupLookup {
  getAll(): readonly VisualGroup[];
}

type DecodeImage = (image: HTMLImageElement) => Promise<void>;

/** Browser DOM adapter for state art, dialogue, panels, and path overlays. */
export class BrowserRenderer implements Renderer {
  private readonly stage: HTMLElement;
  private readonly backgroundLayer: HTMLElement;
  private readonly panelLayer: HTMLElement;
  private readonly overlayLayer: HTMLElement;
  private readonly effectLayer: HTMLElement;
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
    private readonly objectUrls: ObjectUrlFactory = URL,
    private readonly decodeImage: DecodeImage = (image) => image.decode(),
    private readonly cameraPaths?: CameraPathLookup,
    private readonly visualGroups?: VisualGroupLookup
  ) {
    const document = root.ownerDocument;
    this.stage = document.createElement("div");
    this.backgroundLayer = document.createElement("div");
    this.panelLayer = document.createElement("div");
    this.overlayLayer = document.createElement("div");
    this.effectLayer = document.createElement("div");
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
      this.overlayLayer,
      this.effectLayer,
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
    this.resetCameraLayers();
    const document = this.root.ownerDocument;
    const background = document.createElement("img");
    this.setImageSource(background, state.image);
    background.setAttribute("alt", "");
    background.style.width = "100%";
    background.style.height = "100%";
    background.style.objectFit = "contain";
    this.backgroundLayer.replaceChildren(background);

    this.panelLayer.replaceChildren();
    this.overlayLayer.replaceChildren();
    this.effectLayer.replaceChildren();
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
    placement.setAttribute("data-panel-id", reveal.panel.id);
    placement.style.position = "absolute";
    placement.style.left = `${reveal.x}px`;
    placement.style.top = `${reveal.y}px`;
    placement.style.width = `${reveal.width}px`;
    placement.style.height = `${reveal.height}px`;

    const visualGroup = this.visualGroups?.getAll().find(
      (group) => group.panelIds.includes(reveal.panel.id)
    );
    let instance = placement;
    if (visualGroup) {
      placement.setAttribute("data-visual-group-id", visualGroup.id);
      this.applyTreatment(placement, visualGroup.treatment, 0);
      const groupContent = this.createCropLayer(visualGroup.treatment);
      instance = document.createElement("div");
      instance.style.position = "absolute";
      instance.style.inset = "0";
      groupContent.append(instance);
      placement.append(groupContent);
    }
    this.applyTreatment(instance, reveal.treatment, reveal.rotation);

    if (reveal.panel.asset) {
      const image = document.createElement("img");
      this.setImageSource(image, reveal.panel.asset);
      image.setAttribute("alt", reveal.panel.accessibleDescription ?? "");
      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";
      const crop = reveal.treatment.crop;
      if (crop) {
        const right = 1 - crop.x - crop.width;
        const bottom = 1 - crop.y - crop.height;
        image.style.clipPath = `inset(${this.percent(crop.y)} ` +
          `${this.percent(right)} ${this.percent(bottom)} ` +
          `${this.percent(crop.x)})`;
      }
      instance.append(image);
    } else if (reveal.panel.accessibleDescription) {
      instance.setAttribute("role", "img");
      instance.setAttribute(
        "aria-label", reveal.panel.accessibleDescription
      );
    }

    this.panelLayer.append(placement);
  }

  runCameraPath(path: CameraPath, context: RenderContext): void {
    if (this.disposed) return;
    const duration = resolveMotionDuration(
      path.duration / path.speedMultiplier,
      context.accessibility.reducedMotion
    );
    const start = this.cameraTransform(path.startPoint);
    const end = this.cameraTransform(path.endPoint);

    for (const layer of this.cameraLayers()) {
      layer.style.transformOrigin = "0 0";
      layer.style.transition = "";
      layer.style.transform = start;
      // Commit the authored start before applying the destination transition.
      layer.getBoundingClientRect();
      if (duration > 0) {
        layer.style.transition =
          `transform ${duration}ms ${path.easing}`;
      }
      layer.style.transform = end;
    }
  }
  runEffect(_effect: Effect, _context: RenderContext): void {}
  displayOverlay(overlay: OverlayAsset, context: RenderContext): void {
    if (this.disposed) return;
    const document = this.root.ownerDocument;
    const placement = document.createElement("div");
    placement.setAttribute("data-overlay-id", overlay.id);
    placement.style.position = "absolute";
    const path = this.cameraPaths?.get(overlay.pathId);
    if (!path) {
      placement.setAttribute("data-overlay-status", "missingPath");
      this.overlayLayer.append(placement);
      return;
    }
    placement.setAttribute("data-overlay-status", "rendered");
    placement.style.left = `${path.startPoint.x}px`;
    placement.style.top = `${path.startPoint.y}px`;
    placement.style.transform =
      `translate(-50%, -50%) rotate(${overlay.rotation}deg)`;
    const image = document.createElement("img");
    this.setImageSource(image, overlay.asset);
    image.setAttribute("alt", "");
    placement.append(image);
    this.overlayLayer.append(placement);

    if (!overlay.followPath) return;
    const duration = resolveMotionDuration(
      overlay.duration, context.accessibility.reducedMotion
    );
    // Commit the start position before applying the destination transition.
    placement.getBoundingClientRect();
    if (duration > 0) {
      placement.style.transition =
        `left ${duration}ms ${path.easing}, top ${duration}ms ${path.easing}`;
    }
    placement.style.left = `${path.endPoint.x}px`;
    placement.style.top = `${path.endPoint.y}px`;
  }

  private percent(value: number): string {
    return `${Number((value * 100).toFixed(6))}%`;
  }

  private applyTreatment(
    element: HTMLElement, treatment: VisualTreatment, baseRotation: number
  ): void {
    const transform = treatment.transform;
    const flipX = transform.flipX ? -1 : 1;
    const flipY = transform.flipY ? -1 : 1;
    const deformation = this.deformationScale(treatment);
    element.style.transformOrigin =
      `${transform.originX * 100}% ${transform.originY * 100}%`;
    element.style.transform = [
      `translate(${transform.translateX}px, ${transform.translateY}px)`,
      `rotate(${baseRotation + transform.rotation}deg)`,
      `skew(${transform.skewX}deg, ${transform.skewY}deg)`,
      `scale(${transform.scaleX * flipX}, ${transform.scaleY * flipY})`,
      `scale(${deformation.x}, ${deformation.y})`
    ].join(" ");
    element.style.opacity = String(treatment.appearance.opacity);
    element.style.filter = treatment.appearance.filter;
    const outlineWidth = treatment.appearance.outlineWidth;
    if (outlineWidth > 0) {
      element.style.outline =
        `${outlineWidth}px solid ${treatment.appearance.outlineColor}`;
      element.style.outlineOffset = `-${outlineWidth}px`;
    }
    const mask = treatment.mask;
    if (mask) {
      element.style.clipPath = mask.shape === "ellipse"
        ? "ellipse(50% 50% at 50% 50%)" : "inset(0)";
      element.setAttribute("data-mask-feather", String(mask.feather));
    }
    element.setAttribute("data-deformation-type", treatment.deformation.type);
  }

  private deformationScale(
    treatment: VisualTreatment
  ): {x: number; y: number} {
    const {type, amountX, amountY} = treatment.deformation;
    if (type === "none") return {x: 1, y: 1};
    const direction = type === "stretch" ? 1 : -1;
    return {
      x: Number((2 ** (direction * amountX)).toFixed(6)),
      y: Number((2 ** (direction * amountY)).toFixed(6))
    };
  }

  private createCropLayer(treatment: VisualTreatment): HTMLElement {
    const layer = this.root.ownerDocument.createElement("div");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    const crop = treatment.crop;
    if (crop) {
      const right = 1 - crop.x - crop.width;
      const bottom = 1 - crop.y - crop.height;
      layer.style.clipPath = `inset(${this.percent(crop.y)} ` +
        `${this.percent(right)} ${this.percent(bottom)} ` +
        `${this.percent(crop.x)})`;
    }
    return layer;
  }

  private cameraLayers(): readonly HTMLElement[] {
    return [
      this.backgroundLayer,
      this.panelLayer,
      this.overlayLayer,
      this.effectLayer
    ];
  }

  private cameraTransform(point: CameraPath["startPoint"]): string {
    const centerX = ARTNET_COORDINATE_SYSTEM.width / 2;
    const centerY = ARTNET_COORDINATE_SYSTEM.height / 2;
    return `translate(${centerX}px, ${centerY}px) ` +
      `scale(${point.zoomLevel}) translate(${-point.x}px, ${-point.y}px)`;
  }

  private resetCameraLayers(): void {
    for (const layer of this.cameraLayers()) {
      layer.style.transition = "";
      layer.style.transform = "";
      layer.style.transformOrigin = "";
    }
  }

  private setImageSource(image: HTMLElement, file: string): void {
    const assets = this.imageAssets;
    if (!assets) {
      image.setAttribute("src", file);
      return;
    }

    const existingUrl = this.sceneObjectUrls.get(file);
    if (existingUrl) {
      this.decodeFetchedImage(image, existingUrl, this.sceneGeneration);
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
        this.decodeFetchedImage(image, url, generation);
      })
      .catch(() => {
        if (this.disposed || generation !== this.sceneGeneration) return;
        image.setAttribute("data-asset-status", "failed");
      });
  }

  private decodeFetchedImage(
    image: HTMLElement, url: string, generation: number
  ): void {
    image.setAttribute("src", url);
    image.setAttribute("data-asset-status", "fetched");
    void Promise.resolve()
      .then(() => this.decodeImage(image as HTMLImageElement))
      .then(() => {
        if (this.disposed || generation !== this.sceneGeneration) return;
        image.setAttribute("data-asset-status", "decoded");
      })
      .catch(() => {
        if (this.disposed || generation !== this.sceneGeneration) return;
        image.removeAttribute("src");
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
