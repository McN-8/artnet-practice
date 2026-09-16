import { InputType } from "./inputType.js";
import { migrateProjectDocument } from "./projectMigration.js";
import { CURRENT_SCHEMA_VERSION } from "./projectSchema.js";
import { PRESENTATION_MODES } from "./presentationMode.js";
import { MAX_PARTICLES_V1 } from "./mediaContracts.js";
import {
  createDefaultVisualTreatment,
  DEFORMATION_TYPES,
  MASK_SHAPES
} from "./visualTransformation.js";

export { CURRENT_SCHEMA_VERSION } from "./projectSchema.js";

export interface ProjectValidationIssue {
  path: string;
  message: string;
}

const ASSET_TYPES = ["image", "audio"] as const;
const AUDIO_TYPES = [
  "music",
  "ambience",
  "soundEffect",
  "voice"
] as const;
const TIMELINE_EVENT_TYPES = [
  "effect",
  "audio",
  "camera",
  "panelGroup",
  "overlay",
  "animation",
  "particles",
  "haptic"
] as const;

export class ProjectValidationError extends Error {
  issues: ProjectValidationIssue[];

  constructor(issues: ProjectValidationIssue[]) {
    super(
      `Invalid ArtNet project: ${issues
        .map(
          (issue) =>
            `${issue.path} ${issue.message}`
        )
        .join("; ")}`
    );

    this.name = "ProjectValidationError";
    this.issues = issues;
  }
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function applyDefaults(
  value: Record<string, unknown>,
  defaults: Record<string, unknown>
): void {
  for (const [field, defaultValue] of Object.entries(defaults)) {
    if (value[field] === undefined) {
      value[field] = defaultValue;
    }
  }
}

function applyProjectDefaults(data: unknown): void {
  if (!isRecord(data)) {
    return;
  }

  applyDefaults(data, { presentationMode: "interactive" });

  if (isRecord(data.resources)) {
    for (const collection of [
      "animationSequences", "motionPaths", "particleEffects", "hapticPatterns"
    ]) {
      if (data.resources[collection] === undefined) {
        data.resources[collection] = [];
      }
    }
    if (data.resources.visualGroups === undefined) {
      data.resources.visualGroups = [];
    }
    if (data.resources.panels === undefined) {
      const panelIds = new Set<string>();

      if (Array.isArray(data.resources.panelGroups)) {
        data.resources.panelGroups.forEach((panelGroup) => {
          if (!isRecord(panelGroup) || !Array.isArray(panelGroup.reveals)) {
            return;
          }

          panelGroup.reveals.forEach((reveal) => {
            if (isRecord(reveal) && typeof reveal.panelId === "string") {
              panelIds.add(reveal.panelId);
            }
          });
        });
      }

      data.resources.panels = [...panelIds].map((id) => ({ id }));
    }

    if (Array.isArray(data.resources.audio)) {
      data.resources.audio.forEach((audio) => {
        if (isRecord(audio)) {
          applyDefaults(audio, {
            persistsAcrossStates: false,
            fadeInDuration: 0,
            fadeOutDuration: 0,
            layerGroup: "default"
          });
        }
      });
    }

    if (Array.isArray(data.resources.overlays)) {
      data.resources.overlays.forEach((overlay) => {
        if (isRecord(overlay)) {
          applyDefaults(overlay, {
            rotation: 0,
            duration: 1000,
            followPath: true
          });
        }
      });
    }

    if (Array.isArray(data.resources.cameraPaths)) {
      data.resources.cameraPaths.forEach((cameraPath) => {
        if (isRecord(cameraPath)) {
          applyDefaults(cameraPath, {
            speedMultiplier: 1
          });
        }
      });
    }

    if (Array.isArray(data.resources.panelGroups)) {
      data.resources.panelGroups.forEach((panelGroup) => {
        if (!isRecord(panelGroup) || !Array.isArray(panelGroup.reveals)) {
          return;
        }

        panelGroup.reveals.forEach((reveal) => {
          if (isRecord(reveal)) {
            applyDefaults(reveal, {
              delay: 0,
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              rotation: 0,
              treatment: createDefaultVisualTreatment()
            });
          }
        });
      });
    }

    if (Array.isArray(data.resources.visualGroups)) {
      data.resources.visualGroups.forEach((group) => {
        if (isRecord(group)) {
          applyDefaults(group, {
            panelIds: [],
            treatment: createDefaultVisualTreatment()
          });
        }
      });
    }
  }

  if (!Array.isArray(data.chapters)) {
    return;
  }

  data.chapters.forEach((chapter) => {
    if (!isRecord(chapter) || !Array.isArray(chapter.states)) {
      return;
    }

    chapter.states.forEach((state) => {
      if (!isRecord(state)) {
        return;
      }

      applyDefaults(state, {
        zoomEnabled: false,
        zoomInteractive: false,
        zoomRegions: [],
        audioCueIds: [],
        audioLayersToActivate: [],
        audioLayersToDeactivate: [],
        prompts: [],
        effectIds: [],
        assets: [],
        cameraBehaviors: [],
        cameraFocalPoints: [],
        cameraPathIds: [],
        cameraEvents: [],
        panelGroupIds: [],
        timeline: { events: [] },
        autoAdvanceEnabled: false,
        autoAdvanceDelay: 0,
        fastForwardEnabled: true,
        fastForwardMultiplier: 2
      });

      if (Array.isArray(state.prompts)) {
        state.prompts.forEach((prompt) => {
          if (!isRecord(prompt) || !isRecord(prompt.transition)) {
            return;
          }

          applyDefaults(prompt.transition, {
            triggeredAudioCueIds: []
          });

          if (isRecord(prompt.transition.effect)) {
            applyDefaults(prompt.transition.effect, {
              allowFastForward: true,
              locksInput: false
            });
          }
        });
      }

      if (
        isRecord(state.autoAdvancePrompt) &&
        isRecord(state.autoAdvancePrompt.transition)
      ) {
        applyDefaults(state.autoAdvancePrompt.transition, {
          triggeredAudioCueIds: []
        });

        if (isRecord(state.autoAdvancePrompt.transition.effect)) {
          applyDefaults(state.autoAdvancePrompt.transition.effect, {
            allowFastForward: true,
            locksInput: false
          });
        }
      }
    });
  });
}

function validateVisualTreatment(
  treatment: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(treatment)) {
    addRequiredTypeIssue(treatment, path, "an object", issues);
    return;
  }

  addUnknownFieldIssues(
    treatment,
    path,
    ["transform", "appearance", "deformation", "crop", "mask"],
    issues
  );

  const transform = validateObjectFields(
    treatment.transform,
    `${path}.transform`,
    {
      numbers: [
        "translateX", "translateY", "scaleX", "scaleY", "rotation",
        "skewX", "skewY", "originX", "originY"
      ],
      booleans: ["flipX", "flipY"]
    },
    issues
  );

  if (transform) {
    for (const field of ["scaleX", "scaleY"]) {
      validateNumberRange(
        transform[field], `${path}.transform.${field}`,
        (number) => number > 0, "must be greater than 0", issues
      );
    }
    for (const field of ["originX", "originY"]) {
      validateNumberRange(
        transform[field], `${path}.transform.${field}`,
        (number) => number >= 0 && number <= 1,
        "must be between 0 and 1", issues
      );
    }
  }

  const appearance = validateObjectFields(
    treatment.appearance,
    `${path}.appearance`,
    {
      strings: ["filter", "outlineColor"],
      numbers: ["opacity", "outlineWidth"]
    },
    issues
  );

  if (appearance) {
    validateNumberRange(
      appearance.opacity, `${path}.appearance.opacity`,
      (number) => number >= 0 && number <= 1,
      "must be between 0 and 1", issues
    );
    validateNumberRange(
      appearance.outlineWidth, `${path}.appearance.outlineWidth`,
      (number) => number >= 0,
      "must be greater than or equal to 0", issues
    );
  }

  const deformation = validateObjectFields(
    treatment.deformation,
    `${path}.deformation`,
    { strings: ["type"], numbers: ["amountX", "amountY"] },
    issues
  );

  if (deformation) {
    validateCatalogValue(
      deformation.type, `${path}.deformation.type`,
      DEFORMATION_TYPES, "deformation type", issues
    );
    for (const field of ["amountX", "amountY"]) {
      validateNumberRange(
        deformation[field], `${path}.deformation.${field}`,
        (number) => number >= -1 && number <= 1,
        "must be between -1 and 1", issues
      );
    }
  }

  if (treatment.crop !== undefined) {
    const crop = validateObjectFields(
      treatment.crop, `${path}.crop`,
      { numbers: ["x", "y", "width", "height"] }, issues
    );
    if (crop) {
      for (const field of ["x", "y", "width", "height"]) {
        validateNumberRange(
          crop[field], `${path}.crop.${field}`,
          (number) => number >= 0 && number <= 1,
          "must be between 0 and 1", issues
        );
      }
    }
  }

  if (treatment.mask !== undefined) {
    const mask = validateObjectFields(
      treatment.mask, `${path}.mask`,
      { strings: ["shape"], numbers: ["feather"] }, issues
    );
    if (mask) {
      validateCatalogValue(
        mask.shape, `${path}.mask.shape`, MASK_SHAPES, "mask shape", issues
      );
      validateNumberRange(
        mask.feather, `${path}.mask.feather`,
        (number) => number >= 0 && number <= 1,
        "must be between 0 and 1", issues
      );
    }
  }
}

function validateVisualGroupResource(
  group: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    group,
    path,
    { strings: ["id"], additional: ["panelIds", "treatment"] },
    issues
  );

  if (!value) return;
  if (!Array.isArray(value.panelIds)) {
    addRequiredTypeIssue(value.panelIds, `${path}.panelIds`, "an array", issues);
  } else {
    validateStringArrayItems(value.panelIds, `${path}.panelIds`, issues);
  }
  validateVisualTreatment(value.treatment, `${path}.treatment`, issues);
}

function addUnknownFieldIssues(
  value: Record<string, unknown>,
  path: string,
  allowedFields: readonly string[],
  issues: ProjectValidationIssue[]
): void {
  const allowed = new Set(allowedFields);

  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      issues.push({
        path: `${path}.${field}`,
        message: "is not allowed in schema version 1"
      });
    }
  }
}

function validateNumberRange(
  value: unknown,
  path: string,
  predicate: (number: number) => boolean,
  requirement: string,
  issues: ProjectValidationIssue[]
): void {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    !predicate(value)
  ) {
    issues.push({ path, message: requirement });
  }
}

function validateCatalogValue(
  value: unknown,
  path: string,
  supportedValues: readonly string[],
  catalogName: string,
  issues: ProjectValidationIssue[]
): void {
  if (
    typeof value === "string" &&
    !supportedValues.includes(value)
  ) {
    issues.push({
      path,
      message:
        `must be a supported ${catalogName}: ` +
        supportedValues.join(", ")
    });
  }
}

function addRequiredTypeIssue(
  value: unknown,
  path: string,
  expectedType: string,
  issues: ProjectValidationIssue[]
): void {
  issues.push({
    path,
    message:
      value === undefined
        ? "is required"
        : `must be ${expectedType}`
  });
}

function validateStringArrayItems(
  values: unknown[],
  path: string,
  issues: ProjectValidationIssue[]
): void {
  values.forEach((value, index) => {
    if (typeof value !== "string") {
      addRequiredTypeIssue(
        value,
        `${path}[${index}]`,
        "a string",
        issues
      );
    }
  });
}

interface ObjectFieldTypes {
  strings?: string[];
  numbers?: string[];
  booleans?: string[];
  additional?: string[];
}

function validateObjectFields(
  value: unknown,
  path: string,
  fieldTypes: ObjectFieldTypes,
  issues: ProjectValidationIssue[]
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    addRequiredTypeIssue(
      value,
      path,
      "an object",
      issues
    );
    return undefined;
  }

  const expectedFields = [
    [fieldTypes.strings ?? [], "string"],
    [fieldTypes.numbers ?? [], "number"],
    [fieldTypes.booleans ?? [], "boolean"]
  ] as const;

  for (const [fields, type] of expectedFields) {
    for (const field of fields) {
      if (typeof value[field] !== type) {
        addRequiredTypeIssue(
          value[field],
          `${path}.${field}`,
          `a ${type}`,
          issues
        );
      } else if (
        type === "number" &&
        !Number.isFinite(value[field])
      ) {
        issues.push({
          path: `${path}.${field}`,
          message: "must be a finite number"
        });
      }
    }
  }

  addUnknownFieldIssues(
    value,
    path,
    [
      ...(fieldTypes.strings ?? []),
      ...(fieldTypes.numbers ?? []),
      ...(fieldTypes.booleans ?? []),
      ...(fieldTypes.additional ?? [])
    ],
    issues
  );

  return value;
}

function validateTimedItems(
  items: unknown,
  path: string,
  durationMs: unknown,
  numbers: string[],
  strings: string[],
  issues: ProjectValidationIssue[]
): void {
  if (!Array.isArray(items)) {
    addRequiredTypeIssue(items, path, "an array", issues);
    return;
  }
  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    const value = validateObjectFields(item, itemPath, {
      numbers: ["atMs", ...numbers], strings
    }, issues);
    if (!value) return;
    validateNumberRange(value.atMs, `${itemPath}.atMs`,
      (number) => number >= 0 &&
        (typeof durationMs !== "number" || number <= durationMs),
      "must be within the resource duration", issues);
  });
}

function validateAnimationSequence(value: unknown, path: string,
  issues: ProjectValidationIssue[]): void {
  const sequence = validateObjectFields(value, path, {
    strings: ["id", "category", "reducedMotionPanelId"],
    numbers: ["durationMs"], additional: ["frames", "audioClips"]
  }, issues);
  if (!sequence) return;
  validateNumberRange(sequence.durationMs, `${path}.durationMs`,
    (number) => number > 0, "must be greater than 0", issues);
  validateTimedItems(sequence.frames, `${path}.frames`, sequence.durationMs,
    [], ["panelId"], issues);
  if (Array.isArray(sequence.frames) && sequence.frames.length === 0) {
    issues.push({path: `${path}.frames`, message: "must contain at least one frame"});
  }
  validateTimedItems(sequence.audioClips, `${path}.audioClips`,
    sequence.durationMs, [], ["audioCueId"], issues);
}

function validateMotionPath(value: unknown, path: string,
  issues: ProjectValidationIssue[]): void {
  const motion = validateObjectFields(value, path, {
    strings: ["id"], numbers: ["durationMs"], additional: ["points"]
  }, issues);
  if (!motion) return;
  validateNumberRange(motion.durationMs, `${path}.durationMs`,
    (number) => number > 0, "must be greater than 0", issues);
  validateTimedItems(motion.points, `${path}.points`, motion.durationMs,
    ["x", "y"], [], issues);
  if (Array.isArray(motion.points)) {
    let previous = -1;
    motion.points.forEach((point, index) => {
      if (!isRecord(point)) return;
      const pointPath = `${path}.points[${index}]`;
      for (const axis of ["x", "y"]) validateNumberRange(
        point[axis], `${pointPath}.${axis}`,
        (number) => number >= 0 && number <= 1,
        "must be between 0 and 1", issues
      );
      if (typeof point.atMs === "number") {
        if (point.atMs <= previous) issues.push({
          path: `${pointPath}.atMs`, message: "must increase strictly"
        });
        previous = point.atMs;
      }
    });
    if (isRecord(motion.points[0]) && motion.points[0].atMs !== 0) {
      issues.push({path: `${path}.points[0].atMs`,
        message: "must start at 0"});
    }
    const last = motion.points[motion.points.length - 1];
    if (isRecord(last) && last.atMs !== motion.durationMs) {
      issues.push({path: `${path}.points[${motion.points.length - 1}].atMs`,
        message: "must end at durationMs"});
    }
  }
  if (Array.isArray(motion.points) && motion.points.length < 2) {
    issues.push({path: `${path}.points`, message: "must contain at least two points"});
  }
}

function validateParticleEffect(value: unknown, path: string,
  issues: ProjectValidationIssue[]): void {
  const effect = validateObjectFields(value, path, {
    strings: ["id", "category", "emitterShape", "boundsPolicy",
      "reducedMotionPanelId"],
    numbers: ["seed", "originX", "originY", "radius",
      "directionDegrees", "coneDegrees", "count", "lifetimeMs",
      "speed", "speedVariation", "scaleMin", "scaleMax",
      "rotationVariationDegrees"],
    additional: ["visuals", "motionPathId", "motionPathIds"]
  }, issues);
  if (!effect) return;
  validateCatalogValue(effect.emitterShape, `${path}.emitterShape`,
    ["point", "circle"], "emitter shape", issues);
  validateCatalogValue(effect.boundsPolicy, `${path}.boundsPolicy`,
    ["none", "stopAtCanvas"], "bounds policy", issues);
  if (effect.motionPathId !== undefined && typeof effect.motionPathId !== "string") {
    addRequiredTypeIssue(effect.motionPathId, `${path}.motionPathId`,
      "a string", issues);
  }
  if (effect.motionPathIds !== undefined) {
    if (!Array.isArray(effect.motionPathIds)) {
      addRequiredTypeIssue(effect.motionPathIds, `${path}.motionPathIds`,
        "an array", issues);
    } else {
      validateStringArrayItems(effect.motionPathIds,
        `${path}.motionPathIds`, issues);
      if (typeof effect.count === "number" &&
          effect.motionPathIds.length !== effect.count) {
        issues.push({path: `${path}.motionPathIds`,
          message: "must contain one path ID per particle"});
      }
    }
  }
  if (typeof effect.seed === "number" &&
      (!Number.isSafeInteger(effect.seed) || effect.seed < 0 ||
        effect.seed > 0xffffffff)) {
    issues.push({path: `${path}.seed`, message: "must be a uint32 seed"});
  }
  if (typeof effect.count === "number" &&
      (!Number.isInteger(effect.count) || effect.count < 1 ||
        effect.count > MAX_PARTICLES_V1)) {
    issues.push({path: `${path}.count`,
      message: `must be an integer from 1 to ${MAX_PARTICLES_V1}`});
  }
  for (const field of ["originX", "originY", "radius", "speedVariation"]) {
    validateNumberRange(effect[field], `${path}.${field}`,
      (number) => number >= 0 && number <= 1,
      "must be between 0 and 1", issues);
  }
  for (const field of ["lifetimeMs", "scaleMin", "scaleMax"]) {
    validateNumberRange(effect[field], `${path}.${field}`,
      (number) => number > 0, "must be greater than 0", issues);
  }
  for (const field of ["speed", "rotationVariationDegrees"]) {
    validateNumberRange(effect[field], `${path}.${field}`,
      (number) => number >= 0, "must be nonnegative", issues);
  }
  validateNumberRange(effect.coneDegrees, `${path}.coneDegrees`,
    (number) => number > 0 && number <= 360,
    "must be greater than 0 and at most 360", issues);
  if (typeof effect.scaleMin === "number" &&
      typeof effect.scaleMax === "number" &&
      effect.scaleMin > effect.scaleMax) {
    issues.push({path: `${path}.scaleMax`,
      message: "must be greater than or equal to scaleMin"});
  }
  if (!Array.isArray(effect.visuals)) {
    addRequiredTypeIssue(effect.visuals, `${path}.visuals`, "an array", issues);
  } else {
    if (effect.visuals.length === 0) {
      issues.push({path: `${path}.visuals`,
        message: "must contain at least one visual"});
    }
    effect.visuals.forEach((visual, index) => {
      const visualPath = `${path}.visuals[${index}]`;
      const item = validateObjectFields(visual, visualPath,
        {strings: ["panelId"], numbers: ["weight"]}, issues);
      if (item) validateNumberRange(item.weight, `${visualPath}.weight`,
        (number) => number > 0, "must be greater than 0", issues);
    });
  }
}

function validateHapticPattern(value: unknown, path: string,
  issues: ProjectValidationIssue[]): void {
  const pattern = validateObjectFields(value, path, {
    strings: ["id", "visualAlternative"],
    numbers: ["durationMs"], additional: ["pulses"]
  }, issues);
  if (!pattern) return;
  if (typeof pattern.visualAlternative === "string" &&
      pattern.visualAlternative.trim().length === 0) {
    issues.push({path: `${path}.visualAlternative`,
      message: "must be nonblank"});
  }
  validateNumberRange(pattern.durationMs, `${path}.durationMs`,
    (number) => number > 0, "must be greater than 0", issues);
  validateTimedItems(pattern.pulses, `${path}.pulses`, pattern.durationMs,
    ["durationMs", "intensity"], [], issues);
  if (Array.isArray(pattern.pulses)) {
    if (pattern.pulses.length === 0) {
      issues.push({path: `${path}.pulses`,
        message: "must contain at least one pulse"});
    }
    pattern.pulses.forEach((pulse, index) => {
      if (!isRecord(pulse)) return;
      const pulsePath = `${path}.pulses[${index}]`;
      validateNumberRange(pulse.durationMs, `${pulsePath}.durationMs`,
        (number) => number > 0, "must be greater than 0", issues);
      validateNumberRange(pulse.intensity, `${pulsePath}.intensity`,
        (number) => number >= 0 && number <= 1,
        "must be between 0 and 1", issues);
      if (typeof pulse.atMs === "number" &&
          typeof pulse.durationMs === "number" &&
          typeof pattern.durationMs === "number" &&
          pulse.atMs + pulse.durationMs > pattern.durationMs) {
        issues.push({path: `${pulsePath}.durationMs`,
          message: "must end within the pattern duration"});
      }
    });
  }
}

function validateEffectResource(
  effect: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    effect,
    path,
    {
      strings: ["id", "type", "trigger"],
      numbers: ["duration"]
    },
    issues
  );

  if (value) {
    validateNumberRange(
      value.duration,
      `${path}.duration`,
      (number) => number >= 0,
      "must be greater than or equal to 0",
      issues
    );
  }
}

function validateAudioResource(
  audio: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    audio,
    path,
    {
      strings: [
        "id",
        "file",
        "type",
        "trigger",
        "layerGroup"
      ],
      numbers: [
        "volume",
        "fadeInDuration",
        "fadeOutDuration"
      ],
      booleans: ["loop", "persistsAcrossStates"],
      additional: ["transcript"]
    },
    issues
  );

  if (!value) {
    return;
  }

  if (
    value.transcript !== undefined &&
    typeof value.transcript !== "string"
  ) {
    addRequiredTypeIssue(
      value.transcript,
      `${path}.transcript`,
      "a string",
      issues
    );
  }

  if (
    value.type === "voice" &&
    (
      value.transcript === undefined ||
      (
        typeof value.transcript === "string" &&
        value.transcript.trim().length === 0
      )
    )
  ) {
    issues.push({
      path: `${path}.transcript`,
      message: "is required and must be nonblank for voice audio"
    });
  }

  validateCatalogValue(
    value.type,
    `${path}.type`,
    AUDIO_TYPES,
    "audio type",
    issues
  );
  validateNumberRange(
    value.volume,
    `${path}.volume`,
    (number) => number >= 0 && number <= 1,
    "must be between 0 and 1",
    issues
  );

  for (const field of ["fadeInDuration", "fadeOutDuration"]) {
    validateNumberRange(
      value[field],
      `${path}.${field}`,
      (number) => number >= 0,
      "must be greater than or equal to 0",
      issues
    );
  }
}

function validateCameraFocalPoint(
  focalPoint: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    focalPoint,
    path,
    {
      strings: ["id"],
      numbers: ["x", "y", "zoomLevel"]
    },
    issues
  );

  if (value) {
    validateNumberRange(
      value.zoomLevel,
      `${path}.zoomLevel`,
      (number) => number > 0,
      "must be greater than 0",
      issues
    );
  }
}

function validateCameraPathResource(
  cameraPath: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    cameraPath,
    path,
    {
      strings: ["id", "easing"],
      numbers: ["duration", "speedMultiplier"],
      additional: ["startPoint", "endPoint"]
    },
    issues
  );

  if (!value) {
    return;
  }

  validateCameraFocalPoint(
    value.startPoint,
    `${path}.startPoint`,
    issues
  );
  validateCameraFocalPoint(
    value.endPoint,
    `${path}.endPoint`,
    issues
  );

  validateNumberRange(
    value.duration,
    `${path}.duration`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );
  validateNumberRange(
    value.speedMultiplier,
    `${path}.speedMultiplier`,
    (number) => number > 0,
    "must be greater than 0",
    issues
  );
}

function validateOverlayResource(
  overlay: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    overlay,
    path,
    {
      strings: ["id", "asset", "pathId"],
      numbers: ["rotation", "duration"],
      booleans: ["followPath"]
    },
    issues
  );

  if (value) {
    validateNumberRange(
      value.duration,
      `${path}.duration`,
      (number) => number >= 0,
      "must be greater than or equal to 0",
      issues
    );
  }
}

function validatePanelReveal(
  reveal: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    reveal,
    path,
    {
      strings: ["panelId"],
      numbers: [
        "delay",
        "x",
        "y",
        "width",
        "height",
        "rotation"
      ],
      additional: ["treatment"]
    },
    issues
  );

  if (!value) {
    return;
  }

  validateVisualTreatment(value.treatment, `${path}.treatment`, issues);

  validateNumberRange(
    value.delay,
    `${path}.delay`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );

  for (const field of ["width", "height"]) {
    validateNumberRange(
      value[field],
      `${path}.${field}`,
      (number) => number > 0,
      "must be greater than 0",
      issues
    );
  }
}

function validatePanelGroupResource(
  panelGroup: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    panelGroup,
    path,
    {
      strings: ["id"],
      additional: ["reveals"]
    },
    issues
  );

  if (!value) {
    return;
  }

  if (!Array.isArray(value.reveals)) {
    addRequiredTypeIssue(
      value.reveals,
      `${path}.reveals`,
      "an array",
      issues
    );
    return;
  }

  value.reveals.forEach((reveal, revealIndex) => {
    validatePanelReveal(
      reveal,
      `${path}.reveals[${revealIndex}]`,
      issues
    );
  });
}

function validatePanelResource(
  panel: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(panel)) {
    addRequiredTypeIssue(panel, path, "an object", issues);
    return;
  }

  if (typeof panel.id !== "string") {
    addRequiredTypeIssue(panel.id, `${path}.id`, "a string", issues);
  }

  if (
    typeof panel.asset === "string" &&
    (
      panel.accessibleDescription === undefined ||
      (
        typeof panel.accessibleDescription === "string" &&
        panel.accessibleDescription.trim().length === 0
      )
    )
  ) {
    issues.push({
      path: `${path}.accessibleDescription`,
      message: "is required and must be nonblank for asset-backed panels"
    });
  }

  for (const field of ["asset", "accessibleDescription"]) {
    if (panel[field] !== undefined && typeof panel[field] !== "string") {
      addRequiredTypeIssue(
        panel[field],
        `${path}.${field}`,
        "a string",
        issues
      );
    }
  }

  addUnknownFieldIssues(
    panel,
    path,
    ["id", "asset", "accessibleDescription"],
    issues
  );
}

function validateZoomRegion(
  zoomRegion: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    zoomRegion,
    path,
    {
      strings: ["id", "description"],
      numbers: ["x", "y", "width", "height"]
    },
    issues
  );

  if (value) {
    for (const field of ["width", "height"]) {
      validateNumberRange(
        value[field],
        `${path}.${field}`,
        (number) => number > 0,
        "must be greater than 0",
        issues
      );
    }
  }
}

function validateAsset(
  asset: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    asset,
    path,
    { strings: ["file", "type"] },
    issues
  );

  if (value) {
    validateCatalogValue(
      value.type,
      `${path}.type`,
      ASSET_TYPES,
      "asset type",
      issues
    );
  }
}

function validateCameraBehavior(
  cameraBehavior: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    cameraBehavior,
    path,
    {
      strings: ["type"],
      numbers: ["duration"]
    },
    issues
  );

  if (value) {
    validateNumberRange(
      value.duration,
      `${path}.duration`,
      (number) => number >= 0,
      "must be greater than or equal to 0",
      issues
    );
  }
}

function validateTransitionEffect(
  effect: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(effect)) {
    addRequiredTypeIssue(
      effect,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof effect.type !== "string") {
    addRequiredTypeIssue(
      effect.type,
      `${path}.type`,
      "a string",
      issues
    );
  }

  if (typeof effect.duration !== "number") {
    addRequiredTypeIssue(
      effect.duration,
      `${path}.duration`,
      "a number",
      issues
    );
  } else if (!Number.isFinite(effect.duration)) {
    issues.push({
      path: `${path}.duration`,
      message: "must be a finite number"
    });
  }

  for (
    const field of ["allowFastForward", "locksInput"]
  ) {
    if (typeof effect[field] !== "boolean") {
      addRequiredTypeIssue(
        effect[field],
        `${path}.${field}`,
        "a boolean",
        issues
      );
    }
  }

  addUnknownFieldIssues(
    effect,
    path,
    ["type", "duration", "allowFastForward", "locksInput"],
    issues
  );
  validateNumberRange(
    effect.duration,
    `${path}.duration`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );
}

function validateTransition(
  transition: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(transition)) {
    addRequiredTypeIssue(
      transition,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof transition.destinationStateId !== "string") {
    addRequiredTypeIssue(
      transition.destinationStateId,
      `${path}.destinationStateId`,
      "a string",
      issues
    );
  }

  validateTransitionEffect(
    transition.effect,
    `${path}.effect`,
    issues
  );

  if (!Array.isArray(transition.triggeredAudioCueIds)) {
    addRequiredTypeIssue(
      transition.triggeredAudioCueIds,
      `${path}.triggeredAudioCueIds`,
      "an array",
      issues
    );
  } else {
    validateStringArrayItems(
      transition.triggeredAudioCueIds,
      `${path}.triggeredAudioCueIds`,
      issues
    );
  }

  addUnknownFieldIssues(
    transition,
    path,
    ["destinationStateId", "effect", "triggeredAudioCueIds"],
    issues
  );
}

function validatePrompt(
  prompt: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(prompt)) {
    addRequiredTypeIssue(
      prompt,
      path,
      "an object",
      issues
    );
    return;
  }

  const inputTypes = Object.values(InputType);

  if (
    typeof prompt.inputType !== "string" ||
    !inputTypes.includes(prompt.inputType as InputType)
  ) {
    issues.push({
      path: `${path}.inputType`,
      message:
        prompt.inputType === undefined
          ? "is required"
          : "must be a supported input type"
    });
  }

  if (
    prompt.targetId !== undefined &&
    typeof prompt.targetId !== "string"
  ) {
    addRequiredTypeIssue(
      prompt.targetId,
      `${path}.targetId`,
      "a string",
      issues
    );
  }

  validateTransition(
    prompt.transition,
    `${path}.transition`,
    issues
  );

  addUnknownFieldIssues(
    prompt,
    path,
    ["inputType", "targetId", "transition"],
    issues
  );
}

function validateCameraEvent(
  cameraEvent: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(cameraEvent)) {
    addRequiredTypeIssue(
      cameraEvent,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof cameraEvent.triggerTime !== "number") {
    addRequiredTypeIssue(
      cameraEvent.triggerTime,
      `${path}.triggerTime`,
      "a number",
      issues
    );
  } else if (!Number.isFinite(cameraEvent.triggerTime)) {
    issues.push({
      path: `${path}.triggerTime`,
      message: "must be a finite number"
    });
  }

  if (typeof cameraEvent.cameraPathId !== "string") {
    addRequiredTypeIssue(
      cameraEvent.cameraPathId,
      `${path}.cameraPathId`,
      "a string",
      issues
    );
  }

  addUnknownFieldIssues(
    cameraEvent,
    path,
    ["triggerTime", "cameraPathId"],
    issues
  );
  validateNumberRange(
    cameraEvent.triggerTime,
    `${path}.triggerTime`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );
}

function validateTimelineEvent(
  timelineEvent: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(timelineEvent)) {
    addRequiredTypeIssue(
      timelineEvent,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof timelineEvent.timestamp !== "number") {
    addRequiredTypeIssue(
      timelineEvent.timestamp,
      `${path}.timestamp`,
      "a number",
      issues
    );
  } else if (!Number.isFinite(timelineEvent.timestamp)) {
    issues.push({
      path: `${path}.timestamp`,
      message: "must be a finite number"
    });
  }

  if (
    typeof timelineEvent.type !== "string" ||
    !TIMELINE_EVENT_TYPES.includes(
      timelineEvent.type as typeof TIMELINE_EVENT_TYPES[number]
    )
  ) {
    issues.push({
      path: `${path}.type`,
      message:
        timelineEvent.type === undefined
          ? "is required"
          : "must be a supported timeline event type"
    });
  }

  if (typeof timelineEvent.payloadId !== "string") {
    addRequiredTypeIssue(
      timelineEvent.payloadId,
      `${path}.payloadId`,
      "a string",
      issues
    );
  }

  addUnknownFieldIssues(
    timelineEvent,
    path,
    ["timestamp", "type", "payloadId"],
    issues
  );
  validateNumberRange(
    timelineEvent.timestamp,
    `${path}.timestamp`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );
}

function validateState(
  state: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(state)) {
    addRequiredTypeIssue(
      state,
      path,
      "an object",
      issues
    );
    return;
  }

  const stringFields = [
    "id",
    "image",
    "dialogue"
  ];

  for (const field of stringFields) {
    if (typeof state[field] !== "string") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a string",
        issues
      );
    }
  }

  if (
    typeof state.dialogue === "string" &&
    state.dialogue.trim().length === 0
  ) {
    issues.push({
      path: `${path}.dialogue`,
      message: "must be nonblank"
    });
  }

  const booleanFields = [
    "isEnding",
    "zoomEnabled",
    "zoomInteractive",
    "autoAdvanceEnabled",
    "fastForwardEnabled"
  ];

  for (const field of booleanFields) {
    if (typeof state[field] !== "boolean") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a boolean",
        issues
      );
    }
  }

  const numberFields = [
    "autoAdvanceDelay",
    "fastForwardMultiplier"
  ];

  for (const field of numberFields) {
    if (typeof state[field] !== "number") {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "a number",
        issues
      );
    } else if (!Number.isFinite(state[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: "must be a finite number"
      });
    }
  }

  validateNumberRange(
    state.autoAdvanceDelay,
    `${path}.autoAdvanceDelay`,
    (number) => number >= 0,
    "must be greater than or equal to 0",
    issues
  );
  validateNumberRange(
    state.fastForwardMultiplier,
    `${path}.fastForwardMultiplier`,
    (number) => number >= 1,
    "must be greater than or equal to 1",
    issues
  );

  const arrayFields = [
    "zoomRegions",
    "audioCueIds",
    "audioLayersToActivate",
    "audioLayersToDeactivate",
    "prompts",
    "effectIds",
    "assets",
    "cameraBehaviors",
    "cameraFocalPoints",
    "cameraPathIds",
    "cameraEvents",
    "panelGroupIds"
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(state[field])) {
      addRequiredTypeIssue(
        state[field],
        `${path}.${field}`,
        "an array",
        issues
      );
    }
  }

  if (Array.isArray(state.prompts)) {
    state.prompts.forEach((prompt, promptIndex) => {
      validatePrompt(
        prompt,
        `${path}.prompts[${promptIndex}]`,
        issues
      );
    });
  }

  if (state.autoAdvanceEnabled === true) {
    validatePrompt(
      state.autoAdvancePrompt,
      `${path}.autoAdvancePrompt`,
      issues
    );
  } else if (state.autoAdvancePrompt !== undefined) {
    issues.push({
      path: `${path}.autoAdvancePrompt`,
      message: "is only allowed when autoAdvanceEnabled is true"
    });
  }

  const stringArrayFields = [
    "audioCueIds",
    "audioLayersToActivate",
    "audioLayersToDeactivate",
    "effectIds",
    "cameraPathIds",
    "panelGroupIds"
  ];

  for (const field of stringArrayFields) {
    if (Array.isArray(state[field])) {
      validateStringArrayItems(
        state[field],
        `${path}.${field}`,
        issues
      );
    }
  }

  const objectCollectionValidators = [
    ["zoomRegions", validateZoomRegion],
    ["assets", validateAsset],
    ["cameraBehaviors", validateCameraBehavior],
    ["cameraFocalPoints", validateCameraFocalPoint]
  ] as const;

  for (
    const [field, validator]
    of objectCollectionValidators
  ) {
    if (Array.isArray(state[field])) {
      state[field].forEach((value, index) => {
        validator(
          value,
          `${path}.${field}[${index}]`,
          issues
        );
      });
    }
  }

  if (Array.isArray(state.cameraEvents)) {
    state.cameraEvents.forEach(
      (cameraEvent, cameraEventIndex) => {
        validateCameraEvent(
          cameraEvent,
          `${path}.cameraEvents[${cameraEventIndex}]`,
          issues
        );
      }
    );
  }

  if (!isRecord(state.timeline)) {
    addRequiredTypeIssue(
      state.timeline,
      `${path}.timeline`,
      "an object",
      issues
    );
  } else {
    addUnknownFieldIssues(
      state.timeline,
      `${path}.timeline`,
      ["events"],
      issues
    );

    if (!Array.isArray(state.timeline.events)) {
      addRequiredTypeIssue(
        state.timeline.events,
        `${path}.timeline.events`,
        "an array",
        issues
      );
    } else {
      state.timeline.events.forEach(
        (timelineEvent, timelineEventIndex) => {
          validateTimelineEvent(
            timelineEvent,
            `${path}.timeline.events[${timelineEventIndex}]`,
            issues
          );
        }
      );
    }
  }

  addUnknownFieldIssues(
    state,
    path,
    [
      "id",
      "image",
      "dialogue",
      "isEnding",
      "zoomEnabled",
      "zoomInteractive",
      "zoomRegions",
      "audioCueIds",
      "audioLayersToActivate",
      "audioLayersToDeactivate",
      "prompts",
      "effectIds",
      "assets",
      "cameraBehaviors",
      "cameraFocalPoints",
      "cameraPathIds",
      "cameraEvents",
      "panelGroupIds",
      "timeline",
      "autoAdvanceEnabled",
      "autoAdvanceDelay",
      "autoAdvancePrompt",
      "fastForwardEnabled",
      "fastForwardMultiplier"
    ],
    issues
  );
}

function validateChapter(
  chapter: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(chapter)) {
    addRequiredTypeIssue(
      chapter,
      path,
      "an object",
      issues
    );
    return;
  }

  if (typeof chapter.title !== "string") {
    addRequiredTypeIssue(
      chapter.title,
      `${path}.title`,
      "a string",
      issues
    );
  }

  if (typeof chapter.entryStateId !== "string") {
    addRequiredTypeIssue(
      chapter.entryStateId,
      `${path}.entryStateId`,
      "a string",
      issues
    );
  }

  if (!Array.isArray(chapter.states)) {
    addRequiredTypeIssue(
      chapter.states,
      `${path}.states`,
      "an array",
      issues
    );
    return;
  }

  chapter.states.forEach((state, stateIndex) => {
    validateState(
      state,
      `${path}.states[${stateIndex}]`,
      issues
    );
  });

  addUnknownFieldIssues(
    chapter,
    path,
    ["title", "entryStateId", "states"],
    issues
  );
}

function validateStoryGraph(
  chapters: unknown[],
  presentationMode: unknown,
  issues: ProjectValidationIssue[]
): void {
  chapters.forEach((chapter, chapterIndex) => {
    if (!isRecord(chapter) || !Array.isArray(chapter.states)) {
      return;
    }

    const chapterPath = `$.chapters[${chapterIndex}]`;
    const statesById = new Map<
      string,
      { value: Record<string, unknown>; path: string }
    >();

    chapter.states.forEach((state, stateIndex) => {
      if (isRecord(state) && typeof state.id === "string") {
        statesById.set(state.id, {
          value: state,
          path: `${chapterPath}.states[${stateIndex}]`
        });
      }
    });

    if (
      presentationMode === "paged" ||
      presentationMode === "verticalScroll"
    ) {
      const lastStateIndex = chapter.states.length - 1;

      if (
        chapter.states.length > 0 &&
        isRecord(chapter.states[0]) &&
        typeof chapter.states[0].id === "string" &&
        chapter.entryStateId !== chapter.states[0].id
      ) {
        issues.push({
          path: `${chapterPath}.entryStateId`,
          message: "must reference the first state in a traditional chapter"
        });
      }

      chapter.states.forEach((state, stateIndex) => {
        if (!isRecord(state)) {
          return;
        }

        if (state.isEnding !== (stateIndex === lastStateIndex)) {
          issues.push({
            path: `${chapterPath}.states[${stateIndex}].isEnding`,
            message:
              stateIndex === lastStateIndex
                ? "must be true for the final traditional page"
                : "must be false before the final traditional page"
          });
        }
      });

      return;
    }

    if (
      typeof chapter.entryStateId !== "string" ||
      !statesById.has(chapter.entryStateId)
    ) {
      if (typeof chapter.entryStateId === "string") {
        issues.push({
          path: `${chapterPath}.entryStateId`,
          message:
            `must reference a state in this chapter; ` +
            `references "${chapter.entryStateId}"`
        });
      }
      return;
    }

    const reachable = new Set<string>();
    const pending = [chapter.entryStateId];

    while (pending.length > 0) {
      const stateId = pending.pop() as string;

      if (reachable.has(stateId)) {
        continue;
      }

      reachable.add(stateId);
      const state = statesById.get(stateId)?.value;

      if (!state || !Array.isArray(state.prompts)) {
        continue;
      }

      state.prompts.forEach((prompt) => {
        if (
          isRecord(prompt) &&
          isRecord(prompt.transition) &&
          typeof prompt.transition.destinationStateId === "string" &&
          statesById.has(prompt.transition.destinationStateId)
        ) {
          pending.push(prompt.transition.destinationStateId);
        }
      });

      if (
        state.autoAdvanceEnabled === true &&
        isRecord(state.autoAdvancePrompt) &&
        isRecord(state.autoAdvancePrompt.transition) &&
        typeof state.autoAdvancePrompt.transition.destinationStateId ===
          "string" &&
        statesById.has(
          state.autoAdvancePrompt.transition.destinationStateId
        )
      ) {
        pending.push(
          state.autoAdvancePrompt.transition.destinationStateId
        );
      }
    }

    statesById.forEach((state, stateId) => {
      if (!reachable.has(stateId)) {
        issues.push({
          path: `${state.path}.id`,
          message:
            `is unreachable from chapter entry state ` +
            `"${chapter.entryStateId}"`
        });
      }

      const hasOutgoingTransition =
        (Array.isArray(state.value.prompts) &&
          state.value.prompts.length > 0) ||
        (state.value.autoAdvanceEnabled === true &&
          isRecord(state.value.autoAdvancePrompt));

      if (!hasOutgoingTransition && state.value.isEnding !== true) {
        issues.push({
          path: `${state.path}.isEnding`,
          message:
            "must be true when the state has no outgoing transitions"
        });
      } else if (
        hasOutgoingTransition &&
        state.value.isEnding === true
      ) {
        issues.push({
          path: `${state.path}.isEnding`,
          message:
            "must be false when the state has outgoing transitions"
        });
      }
    });
  });
}

function collectUniqueIds(
  values: unknown[],
  path: string,
  scope: string,
  issues: ProjectValidationIssue[]
): Set<string> {
  const ids = new Set<string>();

  values.forEach((value, index) => {
    if (!isRecord(value) || typeof value.id !== "string") {
      return;
    }

    if (ids.has(value.id)) {
      issues.push({
        path: `${path}[${index}].id`,
        message:
          `must be unique within ${scope}; ` +
          `duplicates "${value.id}"`
      });
    } else {
      ids.add(value.id);
    }
  });

  return ids;
}

function validateReference(
  value: unknown,
  path: string,
  ids: Set<string> | undefined,
  resourceType: string,
  issues: ProjectValidationIssue[]
): void {
  if (
    typeof value === "string" &&
    ids &&
    !ids.has(value)
  ) {
    issues.push({
      path,
      message:
        `references missing ${resourceType} "${value}"`
    });
  }
}

function validateProjectIntegrity(
  data: Record<string, unknown>,
  issues: ProjectValidationIssue[]
): void {
  if (!isRecord(data.resources)) {
    return;
  }

  const resourceCollections = [
    "effects",
    "audio",
    "overlays",
    "cameraPaths",
    "panels",
    "panelGroups",
    "visualGroups",
    "animationSequences",
    "motionPaths",
    "particleEffects",
    "hapticPatterns"
  ] as const;

  const resourceIds: Partial<
    Record<typeof resourceCollections[number], Set<string>>
  > = {};

  for (const collection of resourceCollections) {
    const values = data.resources[collection];

    if (Array.isArray(values)) {
      resourceIds[collection] = collectUniqueIds(
        values,
        `$.resources.${collection}`,
        `resources.${collection}`,
        issues
      );
    }
  }

  const overlays = data.resources.overlays;

  if (Array.isArray(overlays)) {
    overlays.forEach((overlay, overlayIndex) => {
      if (isRecord(overlay)) {
        validateReference(
          overlay.pathId,
          `$.resources.overlays[${overlayIndex}].pathId`,
          resourceIds.cameraPaths,
          "camera path",
          issues
        );
      }
    });
  }

  const panelGroups = data.resources.panelGroups;

  const animations = data.resources.animationSequences;
  if (Array.isArray(animations)) animations.forEach((sequence, index) => {
    if (!isRecord(sequence)) return;
    validateReference(sequence.reducedMotionPanelId,
      `$.resources.animationSequences[${index}].reducedMotionPanelId`,
      resourceIds.panels, "panel", issues);
    if (Array.isArray(sequence.frames)) sequence.frames.forEach((frame, frameIndex) => {
      if (isRecord(frame)) validateReference(frame.panelId,
        `$.resources.animationSequences[${index}].frames[${frameIndex}].panelId`,
        resourceIds.panels, "panel", issues);
    });
    if (Array.isArray(sequence.audioClips)) sequence.audioClips.forEach((clip, clipIndex) => {
      if (isRecord(clip)) validateReference(clip.audioCueId,
        `$.resources.animationSequences[${index}].audioClips[${clipIndex}].audioCueId`,
        resourceIds.audio, "audio cue", issues);
    });
  });

  const particles = data.resources.particleEffects;
  if (Array.isArray(particles)) particles.forEach((effect, index) => {
    if (!isRecord(effect)) return;
    const effectPath = `$.resources.particleEffects[${index}]`;
    validateReference(effect.reducedMotionPanelId,
      `${effectPath}.reducedMotionPanelId`, resourceIds.panels, "panel", issues);
    if (effect.motionPathId !== undefined) validateReference(
      effect.motionPathId, `${effectPath}.motionPathId`,
      resourceIds.motionPaths, "motion path", issues);
    if (Array.isArray(effect.motionPathIds)) {
      effect.motionPathIds.forEach((pathId, pathIndex) => validateReference(
        pathId, `${effectPath}.motionPathIds[${pathIndex}]`,
        resourceIds.motionPaths, "motion path", issues
      ));
    }
    if (Array.isArray(effect.visuals)) effect.visuals.forEach((visual, visualIndex) => {
      if (isRecord(visual)) validateReference(visual.panelId,
        `${effectPath}.visuals[${visualIndex}].panelId`,
        resourceIds.panels, "panel", issues);
    });
  });

  const visualGroups = data.resources.visualGroups;

  if (Array.isArray(visualGroups)) {
    const groupedPanelIds = new Set<string>();

    visualGroups.forEach((group, groupIndex) => {
      if (!isRecord(group) || !Array.isArray(group.panelIds)) return;
      group.panelIds.forEach((panelId, panelIndex) => {
        const panelPath =
          `$.resources.visualGroups[${groupIndex}].panelIds[${panelIndex}]`;

        validateReference(
          panelId,
          panelPath,
          resourceIds.panels,
          "panel",
          issues
        );

        if (typeof panelId === "string") {
          if (groupedPanelIds.has(panelId)) {
            issues.push({
              path: panelPath,
              message: `duplicates grouped panel "${panelId}"`
            });
          } else {
            groupedPanelIds.add(panelId);
          }
        }
      });
    });
  }

  if (Array.isArray(panelGroups)) {
    panelGroups.forEach((panelGroup, panelGroupIndex) => {
      if (!isRecord(panelGroup) || !Array.isArray(panelGroup.reveals)) {
        return;
      }

      panelGroup.reveals.forEach((reveal, revealIndex) => {
        if (isRecord(reveal)) {
          validateReference(
            reveal.panelId,
            `$.resources.panelGroups[${panelGroupIndex}].reveals[${revealIndex}].panelId`,
            resourceIds.panels,
            "panel",
            issues
          );
        }
      });
    });
  }

  if (!Array.isArray(data.chapters)) {
    return;
  }

  const stateIds = new Set<string>();
  const states: Array<{
    value: Record<string, unknown>;
    path: string;
  }> = [];

  data.chapters.forEach((chapter, chapterIndex) => {
    if (!isRecord(chapter) || !Array.isArray(chapter.states)) {
      return;
    }

    chapter.states.forEach((state, stateIndex) => {
      if (!isRecord(state)) {
        return;
      }

      const path =
        `$.chapters[${chapterIndex}].states[${stateIndex}]`;

      states.push({ value: state, path });

      if (typeof state.id !== "string") {
        return;
      }

      if (stateIds.has(state.id)) {
        issues.push({
          path: `${path}.id`,
          message:
            `must be unique across story states; ` +
            `duplicates "${state.id}"`
        });
      } else {
        stateIds.add(state.id);
      }
    });
  });

  const stateReferenceCollections = [
    ["effectIds", resourceIds.effects, "effect"],
    ["audioCueIds", resourceIds.audio, "audio cue"],
    ["cameraPathIds", resourceIds.cameraPaths, "camera path"],
    ["panelGroupIds", resourceIds.panelGroups, "panel group"]
  ] as const;

  for (const state of states) {
    for (
      const [field, ids, resourceType]
      of stateReferenceCollections
    ) {
      const values = state.value[field];

      if (Array.isArray(values)) {
        values.forEach((value, index) => {
          validateReference(
            value,
            `${state.path}.${field}[${index}]`,
            ids,
            resourceType,
            issues
          );
        });
      }
    }

    const prompts = state.value.prompts;

    if (Array.isArray(prompts)) {
      prompts.forEach((prompt, promptIndex) => {
        if (!isRecord(prompt) || !isRecord(prompt.transition)) {
          return;
        }

        const transitionPath =
          `${state.path}.prompts[${promptIndex}].transition`;

        validateReference(
          prompt.transition.destinationStateId,
          `${transitionPath}.destinationStateId`,
          stateIds,
          "destination state",
          issues
        );

        const audioIds =
          prompt.transition.triggeredAudioCueIds;

        if (Array.isArray(audioIds)) {
          audioIds.forEach((audioId, audioIndex) => {
            validateReference(
              audioId,
              `${transitionPath}.triggeredAudioCueIds[${audioIndex}]`,
              resourceIds.audio,
              "audio cue",
              issues
            );
          });
        }
      });
    }

    const autoAdvancePrompt = state.value.autoAdvancePrompt;

    if (
      isRecord(autoAdvancePrompt) &&
      isRecord(autoAdvancePrompt.transition)
    ) {
      const transitionPath =
        `${state.path}.autoAdvancePrompt.transition`;

      validateReference(
        autoAdvancePrompt.transition.destinationStateId,
        `${transitionPath}.destinationStateId`,
        stateIds,
        "destination state",
        issues
      );

      const audioIds =
        autoAdvancePrompt.transition.triggeredAudioCueIds;

      if (Array.isArray(audioIds)) {
        audioIds.forEach((audioId, audioIndex) => {
          validateReference(
            audioId,
            `${transitionPath}.triggeredAudioCueIds[${audioIndex}]`,
            resourceIds.audio,
            "audio cue",
            issues
          );
        });
      }
    }

    const cameraEvents = state.value.cameraEvents;

    if (Array.isArray(cameraEvents)) {
      cameraEvents.forEach((cameraEvent, cameraEventIndex) => {
        if (isRecord(cameraEvent)) {
          validateReference(
            cameraEvent.cameraPathId,
            `${state.path}.cameraEvents[${cameraEventIndex}].cameraPathId`,
            resourceIds.cameraPaths,
            "camera path",
            issues
          );
        }
      });
    }

    const timeline = state.value.timeline;

    if (isRecord(timeline) && Array.isArray(timeline.events)) {
      const timelineResources: Record<
        string,
        [Set<string> | undefined, string]
      > = {
        effect: [resourceIds.effects, "effect"],
        audio: [resourceIds.audio, "audio cue"],
        camera: [resourceIds.cameraPaths, "camera path"],
        panelGroup: [resourceIds.panelGroups, "panel group"],
        overlay: [resourceIds.overlays, "overlay"],
        animation: [resourceIds.animationSequences, "animation sequence"],
        particles: [resourceIds.particleEffects, "particle effect"],
        haptic: [resourceIds.hapticPatterns, "haptic pattern"]
      };

      timeline.events.forEach((event, eventIndex) => {
        if (!isRecord(event) || typeof event.type !== "string") {
          return;
        }

        const resource = timelineResources[event.type];

        if (resource) {
          validateReference(
            event.payloadId,
            `${state.path}.timeline.events[${eventIndex}].payloadId`,
            resource[0],
            resource[1],
            issues
          );
        }
      });
    }
  }

  validateStoryGraph(data.chapters, data.presentationMode, issues);
}

export function validateProjectDocument(
  data: unknown
): asserts data is Record<string, any> {
  const issues: ProjectValidationIssue[] = [];

  if (!isRecord(data)) {
    throw new ProjectValidationError([
      {
        path: "$",
        message: "must be an object"
      }
    ]);
  }

  applyProjectDefaults(data);

  addUnknownFieldIssues(
    data,
    "$",
    ["schemaVersion", "title", "creator", "presentationMode", "resources", "chapters"],
    issues
  );

  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    issues.push({
      path: "$.schemaVersion",
      message:
        data.schemaVersion === undefined
          ? "is required"
          : `must equal ${CURRENT_SCHEMA_VERSION}`
    });
  }

  if (typeof data.title !== "string") {
    issues.push({
      path: "$.title",
      message: "must be a string"
    });
  }

  if (typeof data.creator !== "string") {
    issues.push({
      path: "$.creator",
      message: "must be a string"
    });
  }

  if (typeof data.presentationMode !== "string") {
    addRequiredTypeIssue(
      data.presentationMode,
      "$.presentationMode",
      "a string",
      issues
    );
  } else {
    validateCatalogValue(
      data.presentationMode,
      "$.presentationMode",
      PRESENTATION_MODES,
      "presentation mode",
      issues
    );
  }

  if (!isRecord(data.resources)) {
    issues.push({
      path: "$.resources",
      message: "must be an object"
    });
  } else {
    addUnknownFieldIssues(
      data.resources,
      "$.resources",
      ["effects", "audio", "overlays", "cameraPaths", "panels", "panelGroups", "visualGroups", "animationSequences", "motionPaths", "particleEffects", "hapticPatterns"],
      issues
    );

    const resourceCollections = [
      "effects",
      "audio",
      "overlays",
      "cameraPaths",
      "panels",
      "panelGroups",
      "visualGroups",
      "animationSequences",
      "motionPaths",
      "particleEffects",
      "hapticPatterns"
    ];

    for (const collection of resourceCollections) {
      if (!Array.isArray(data.resources[collection])) {
        issues.push({
          path: `$.resources.${collection}`,
          message: "must be an array"
        });
      }
    }

    const resourceValidators = [
      ["effects", validateEffectResource],
      ["audio", validateAudioResource],
      ["overlays", validateOverlayResource],
      ["cameraPaths", validateCameraPathResource],
      ["panels", validatePanelResource],
      ["panelGroups", validatePanelGroupResource],
      ["visualGroups", validateVisualGroupResource],
      ["animationSequences", validateAnimationSequence],
      ["motionPaths", validateMotionPath],
      ["particleEffects", validateParticleEffect],
      ["hapticPatterns", validateHapticPattern]
    ] as const;

    for (
      const [collection, validator]
      of resourceValidators
    ) {
      const resources = data.resources[collection];

      if (Array.isArray(resources)) {
        resources.forEach((resource, resourceIndex) => {
          validator(
            resource,
            `$.resources.${collection}[${resourceIndex}]`,
            issues
          );
        });
      }
    }
  }

  if (!Array.isArray(data.chapters)) {
    issues.push({
      path: "$.chapters",
      message: "must be an array"
    });
  } else {
    data.chapters.forEach((chapter, chapterIndex) => {
      validateChapter(
        chapter,
        `$.chapters[${chapterIndex}]`,
        issues
      );
    });
  }

  if (issues.length === 0) {
    validateProjectIntegrity(data, issues);
  }

  if (issues.length > 0) {
    throw new ProjectValidationError(issues);
  }
}

export function parseAndValidateProjectDocument(
  json: string
): Record<string, any> {
  let data: unknown;

  try {
    data = JSON.parse(json);
  } catch {
    throw new ProjectValidationError([
      {
        path: "$",
        message: "must contain valid JSON"
      }
    ]);
  }

  data = migrateProjectDocument(data);
  validateProjectDocument(data);

  return data;
}
