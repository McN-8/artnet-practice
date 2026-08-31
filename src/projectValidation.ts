import { InputType } from "./inputType.js";

export const CURRENT_SCHEMA_VERSION = 1;

export interface ProjectValidationIssue {
  path: string;
  message: string;
}

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
      }
    }
  }

  return value;
}

function validateEffectResource(
  effect: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    effect,
    path,
    {
      strings: ["id", "type", "trigger"],
      numbers: ["duration"]
    },
    issues
  );
}

function validateAudioResource(
  audio: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
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
      booleans: ["loop", "persistsAcrossStates"]
    },
    issues
  );
}

function validateCameraFocalPoint(
  focalPoint: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    focalPoint,
    path,
    {
      strings: ["id"],
      numbers: ["x", "y", "zoomLevel"]
    },
    issues
  );
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
      numbers: ["duration", "speedMultiplier"]
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
}

function validateOverlayResource(
  overlay: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    overlay,
    path,
    {
      strings: ["id", "asset", "pathId"],
      numbers: ["rotation", "duration"],
      booleans: ["followPath"]
    },
    issues
  );
}

function validatePanelReveal(
  reveal: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
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
      ]
    },
    issues
  );
}

function validatePanelGroupResource(
  panelGroup: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  const value = validateObjectFields(
    panelGroup,
    path,
    { strings: ["id"] },
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

function validateZoomRegion(
  zoomRegion: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    zoomRegion,
    path,
    {
      strings: ["id", "description"],
      numbers: ["x", "y", "width", "height"]
    },
    issues
  );
}

function validateAsset(
  asset: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    asset,
    path,
    { strings: ["file", "type"] },
    issues
  );
}

function validateCameraBehavior(
  cameraBehavior: unknown,
  path: string,
  issues: ProjectValidationIssue[]
): void {
  validateObjectFields(
    cameraBehavior,
    path,
    {
      strings: ["type"],
      numbers: ["duration"]
    },
    issues
  );
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
  }

  if (typeof cameraEvent.cameraPathId !== "string") {
    addRequiredTypeIssue(
      cameraEvent.cameraPathId,
      `${path}.cameraPathId`,
      "a string",
      issues
    );
  }
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
  }

  const supportedTypes = [
    "effect",
    "audio",
    "camera",
    "panelGroup",
    "overlay"
  ];

  if (
    typeof timelineEvent.type !== "string" ||
    !supportedTypes.includes(timelineEvent.type)
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

  const booleanFields = [
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
    }
  }

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
    "panelGroups"
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
        overlay: [resourceIds.overlays, "overlay"]
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

  if (!isRecord(data.resources)) {
    issues.push({
      path: "$.resources",
      message: "must be an object"
    });
  } else {
    const resourceCollections = [
      "effects",
      "audio",
      "overlays",
      "cameraPaths",
      "panelGroups"
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
      ["panelGroups", validatePanelGroupResource]
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

  validateProjectDocument(data);

  return data;
}
