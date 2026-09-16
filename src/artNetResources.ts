import { ResourceRegistry } from "./resourceRegistry.js";
import { Effect } from "./effect.js";
import { AudioCue } from "./audioCue.js";
import { OverlayAsset } from "./overlayAsset.js";
import { CameraPath } from "./cameraPath.js";
import { PanelGroup } from "./panelGroup.js";
import { Panel } from "./panel.js";
import { VisualGroup } from "./visualGroup.js";

export class ArtNetResources {
  effects: ResourceRegistry<Effect>;
  audio: ResourceRegistry<AudioCue>;
  overlays: ResourceRegistry<OverlayAsset>;
  cameraPaths: ResourceRegistry<CameraPath>;
  panelGroups: ResourceRegistry<PanelGroup>;
  panels: ResourceRegistry<Panel>;
  visualGroups: ResourceRegistry<VisualGroup>;

  constructor() {
    this.effects = new ResourceRegistry<Effect>();
    this.audio = new ResourceRegistry<AudioCue>();
    this.overlays = new ResourceRegistry<OverlayAsset>();
    this.cameraPaths = new ResourceRegistry<CameraPath>();
    this.panelGroups = new ResourceRegistry<PanelGroup>();
    this.panels = new ResourceRegistry<Panel>();
    this.visualGroups = new ResourceRegistry<VisualGroup>();
  }
}
