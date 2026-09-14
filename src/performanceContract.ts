export const PERFORMANCE_CONTRACT_VERSION = 1;

export const PERFORMANCE_BUDGETS_V1 = Object.freeze({
  startupMs: 3000,
  stateTransitionMs: 250,
  inputResponseMs: 100,
  frameMs: 16.7,
  audioSyncDriftMs: 50,
  initialAssetBytes: 10 * 1024 * 1024,
  peakResidentAssetBytes: 128 * 1024 * 1024
});

export interface PerformanceMeasurement {
  startupMs: number;
  stateTransitionMs: number;
  inputResponseMs: number;
  maxFrameMs: number;
  maxAudioSyncDriftMs: number;
  initialAssetBytes: number;
  peakResidentAssetBytes: number;
}

export interface PerformanceAcceptanceIssue {
  path: string;
  message: string;
}

export class PerformanceAcceptanceError extends Error {
  issues: PerformanceAcceptanceIssue[];

  constructor(issues: PerformanceAcceptanceIssue[]) {
    super(
      `ArtNet performance acceptance failed: ${issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`
    );
    this.name = "PerformanceAcceptanceError";
    this.issues = issues;
  }
}

export function validatePerformanceMeasurement(
  measurement: unknown
): asserts measurement is PerformanceMeasurement {
  const issues: PerformanceAcceptanceIssue[] = [];

  if (
    typeof measurement !== "object" ||
    measurement === null ||
    Array.isArray(measurement)
  ) {
    throw new PerformanceAcceptanceError([
      { path: "$", message: "must be an object" }
    ]);
  }

  const value = measurement as Record<string, unknown>;
  const budgets = [
    ["startupMs", PERFORMANCE_BUDGETS_V1.startupMs],
    ["stateTransitionMs", PERFORMANCE_BUDGETS_V1.stateTransitionMs],
    ["inputResponseMs", PERFORMANCE_BUDGETS_V1.inputResponseMs],
    ["maxFrameMs", PERFORMANCE_BUDGETS_V1.frameMs],
    ["maxAudioSyncDriftMs", PERFORMANCE_BUDGETS_V1.audioSyncDriftMs],
    ["initialAssetBytes", PERFORMANCE_BUDGETS_V1.initialAssetBytes],
    [
      "peakResidentAssetBytes",
      PERFORMANCE_BUDGETS_V1.peakResidentAssetBytes
    ]
  ] as const;
  const allowedFields = new Set<string>(
    budgets.map(([field]) => field)
  );

  Object.keys(value).forEach((field) => {
    if (!allowedFields.has(field)) {
      issues.push({
        path: `$.${field}`,
        message: "is not part of performance contract version 1"
      });
    }
  });

  budgets.forEach(([field, maximum]) => {
    const measured = value[field];

    if (
      typeof measured !== "number" ||
      !Number.isFinite(measured) ||
      measured < 0
    ) {
      issues.push({
        path: `$.${field}`,
        message: "must be a finite nonnegative number"
      });
    } else if (measured > maximum) {
      issues.push({
        path: `$.${field}`,
        message: `must be less than or equal to ${maximum}`
      });
    }
  });

  if (issues.length > 0) {
    throw new PerformanceAcceptanceError(issues);
  }
}
