/**
 * Test helpers for Host package
 */
export {
  createTestSchema,
  BASE_STATE_FIELDS,
  BASE_COMPUTED_FIELDS,
  BASE_ACTIONS,
} from "./test-schema.js";

export {
  createTestIntent,
  createTestIntentWithId,
  nextIntentId,
  resetIntentCounter,
} from "./test-intent.js";

export {
  createTestSnapshot,
  createMinimalSnapshot,
  createSnapshotWithRequirements,
  createTestRequirement,
  DEFAULT_HOST_CONTEXT,
} from "./test-snapshot.js";
