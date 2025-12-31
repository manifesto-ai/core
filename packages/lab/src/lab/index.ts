/**
 * Lab Module
 *
 * Main Lab wrapper and state management.
 */

export { withLab } from "./with-lab.js";
export { createLabEventEmitter, type LabEventEmitter } from "./lab-events.js";
export {
  createInitialLabState,
  updateLabState,
  abortLabState,
  addPendingHITL,
  resolvePendingHITL,
} from "./lab-state.js";
