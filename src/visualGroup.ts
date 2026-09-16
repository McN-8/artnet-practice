import {
  cloneVisualTreatment,
  createDefaultVisualTreatment
} from "./visualTransformation.js";
import type { VisualTreatment } from "./visualTransformation.js";

export class VisualGroup {
  id: string;
  panelIds: string[];
  treatment: VisualTreatment;

  constructor(
    id: string,
    panelIds: readonly string[] = [],
    treatment: VisualTreatment = createDefaultVisualTreatment()
  ) {
    this.id = id;
    this.panelIds = [...panelIds];
    this.treatment = cloneVisualTreatment(treatment);
  }
}
