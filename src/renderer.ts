import type { CameraPath } from "./cameraPath.js";
import type { Effect } from "./effect.js";
import type { OverlayAsset } from "./overlayAsset.js";
import type { PanelReveal } from "./panelReveal.js";
import type { State } from "./state.js";
import type { RenderContext } from "./visualContract.js";

export interface Renderer {
  renderState(state: State, context: RenderContext): void;
  revealPanel(reveal: PanelReveal, context: RenderContext): void;
  runCameraPath(path: CameraPath, context: RenderContext): void;
  runEffect(effect: Effect, context: RenderContext): void;
  displayOverlay(
    overlay: OverlayAsset,
    context: RenderContext
  ): void;
}

export class PrototypeRenderer implements Renderer {
  renderState(state: State): void {
    console.log(`Rendering state ${state.id} background ${state.image}.`);
  }

  revealPanel(reveal: PanelReveal): void {
    console.log(
      `Revealing panel ${reveal.panel.id} at ` +
      `(${reveal.x}, ${reveal.y}) size ` +
      `${reveal.width}x${reveal.height} ` +
      `rotation ${reveal.rotation}°.`
    );
  }

  runCameraPath(path: CameraPath): void {
    console.log(
      `Running camera path ${path.id} for ${path.duration}ms ` +
      `at ${path.speedMultiplier}x speed.`
    );
  }

  runEffect(effect: Effect): void {
    console.log(
      `Running effect ${effect.type} for ${effect.duration}ms.`
    );
  }

  displayOverlay(overlay: OverlayAsset): void {
    console.log(
      `Displaying overlay ${overlay.asset} on path ` +
      `${overlay.pathId} with rotation ${overlay.rotation}° ` +
      `for ${overlay.duration}ms.`
    );
  }
}
