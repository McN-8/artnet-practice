import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESSIBILITY_CONTRACT_VERSION,
  INPUT_EQUIVALENTS_V1,
  resolveMotionDuration
} from "../src/accessibilityContract.js";
import { InputType } from "../src/inputType.js";
import {
  PERFORMANCE_BUDGETS_V1,
  PERFORMANCE_CONTRACT_VERSION,
  PerformanceAcceptanceError,
  validatePerformanceMeasurement
} from "../src/performanceContract.js";

test("accessibility contract covers every input with keyboard and touch", () => {
  assert.equal(ACCESSIBILITY_CONTRACT_VERSION, 1);

  Object.values(InputType).forEach((inputType) => {
    assert.ok(INPUT_EQUIVALENTS_V1[inputType].keyboard.length > 0);
    assert.ok(INPUT_EQUIVALENTS_V1[inputType].touch.length > 0);
  });
});

test("reduced-motion policy removes nonessential motion", () => {
  assert.equal(resolveMotionDuration(800, false), 800);
  assert.equal(resolveMotionDuration(800, true), 0);
  assert.equal(resolveMotionDuration(800, true, true), 100);
  assert.equal(resolveMotionDuration(50, true, true), 50);
});

test("performance contract accepts measurements at its budgets", () => {
  assert.equal(PERFORMANCE_CONTRACT_VERSION, 1);
  assert.doesNotThrow(() => validatePerformanceMeasurement({
    startupMs: PERFORMANCE_BUDGETS_V1.startupMs,
    stateTransitionMs: PERFORMANCE_BUDGETS_V1.stateTransitionMs,
    inputResponseMs: PERFORMANCE_BUDGETS_V1.inputResponseMs,
    maxFrameMs: PERFORMANCE_BUDGETS_V1.frameMs,
    maxAudioSyncDriftMs:
      PERFORMANCE_BUDGETS_V1.audioSyncDriftMs,
    initialAssetBytes: PERFORMANCE_BUDGETS_V1.initialAssetBytes,
    peakResidentAssetBytes:
      PERFORMANCE_BUDGETS_V1.peakResidentAssetBytes
  }));
});

test("performance contract aggregates measurable budget failures", () => {
  assert.throws(
    () => validatePerformanceMeasurement({
      startupMs: 3001,
      stateTransitionMs: 251,
      inputResponseMs: 101,
      maxFrameMs: 17,
      maxAudioSyncDriftMs: 51,
      initialAssetBytes: 10 * 1024 * 1024 + 1,
      peakResidentAssetBytes: Number.NaN,
      percentile: 95
    }),
    (error) => {
      assert.ok(error instanceof PerformanceAcceptanceError);
      assert.deepEqual(
        error.issues.map((issue) => issue.path),
        [
          "$.percentile",
          "$.startupMs",
          "$.stateTransitionMs",
          "$.inputResponseMs",
          "$.maxFrameMs",
          "$.maxAudioSyncDriftMs",
          "$.initialAssetBytes",
          "$.peakResidentAssetBytes"
        ]
      );
      return true;
    }
  );
});
