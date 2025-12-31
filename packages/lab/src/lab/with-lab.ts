/**
 * withLab - Main Lab Wrapper
 *
 * Wraps a ManifestoWorld with Lab capabilities for observation,
 * tracing, HITL intervention, and projection.
 *
 * Per FDR-N009: withLab higher-order function pattern.
 * Per FDR-N010: World Events as observation channel.
 * Per FDR-N011: Lab as Observer, Not Participant.
 */

import type {
  ManifestoWorld,
  WorldEvent,
  ProposalDecidedEvent,
} from "@manifesto-ai/world";
import type {
  LabOptions,
  LabWorld,
  LabMeta,
  LabState,
  LabEventHandler,
  LabTrace,
  LabReport,
  Unsubscribe,
  ProjectionController,
} from "../types.js";
import { createTraceRecorder, mapWorldEventToTraceEvent } from "../trace/index.js";
import { createHITLController, type HITLControllerInternal } from "../hitl/index.js";
import { createProjectionController } from "../projection/index.js";
import { createLabEventEmitter } from "./lab-events.js";
import {
  createInitialLabState,
  updateLabState,
  abortLabState,
} from "./lab-state.js";
import { generateReport } from "../report/index.js";

/**
 * Wrap a ManifestoWorld with Lab capabilities.
 *
 * @param world - The ManifestoWorld to wrap
 * @param options - Lab configuration options
 * @returns A LabWorld with observation and tracing capabilities
 *
 * @example
 * ```typescript
 * const world = createManifestoWorld({ schemaHash, host });
 *
 * const labWorld = withLab(world, {
 *   runId: 'exp-001',
 *   necessityLevel: 1,
 *   outputPath: './traces',
 *   projection: { enabled: true, mode: 'interactive' },
 *   hitl: { enabled: true, timeout: 300000 },
 * });
 *
 * await labWorld.submitProposal(...);
 * const trace = labWorld.trace();
 * ```
 */
export function withLab(world: ManifestoWorld, options: LabOptions): LabWorld {
  // Initialize components
  const traceRecorder = createTraceRecorder(options);
  const hitlController = createHITLController(
    options.hitl,
    world
  ) as HITLControllerInternal;
  const projectionController = createProjectionController(options.projection);
  const labEventEmitter = createLabEventEmitter();

  // Initialize state
  const startedAt = Date.now();
  let currentLabState: LabState = createInitialLabState();

  // Lab metadata
  const labMeta: LabMeta = {
    runId: options.runId,
    necessityLevel: options.necessityLevel,
    startedAt,
  };

  // Subscribe to ALL world events (per FDR-N010)
  const worldUnsubscribe = world.subscribe((event: WorldEvent) => {
    // 1. Map and record to trace (mandatory per FDR-N004)
    const traceEvent = mapWorldEventToTraceEvent(event, traceRecorder.eventCount);
    if (traceEvent) {
      traceRecorder.record(traceEvent);
    }

    // 2. Update lab state
    currentLabState = updateLabState(currentLabState, event);

    // 3. Update projection (if enabled)
    if (options.projection?.enabled) {
      projectionController.update(event);
    }

    // 4. Handle HITL for pending decisions
    if (event.type === "proposal:decided" && event.decision === "pending") {
      // handlePending is async - emit event only if proposal was actually added to pending
      hitlController.handlePending(event as ProposalDecidedEvent).then((wasAdded) => {
        if (wasAdded) {
          labEventEmitter.emit({ type: "hitl:pending", proposalId: event.proposalId });
        }
      });
    }

    // 5. Emit lab event for world event
    labEventEmitter.emit({ type: "world:event", event });

    // 6. Handle termination
    if (event.type === "execution:completed") {
      traceRecorder.complete("success");
    } else if (event.type === "execution:failed") {
      traceRecorder.complete("failure");
    }
  });

  // Create LabWorld by extending ManifestoWorld
  // Using Object.create to preserve prototype chain
  const labWorld: LabWorld = Object.create(world, {
    labMeta: {
      value: labMeta,
      writable: false,
      enumerable: true,
    },
    state: {
      get(): LabState {
        return currentLabState;
      },
      enumerable: true,
    },
    hitl: {
      value: hitlController,
      writable: false,
      enumerable: true,
    },
    projection: {
      value: projectionController,
      writable: false,
      enumerable: true,
    },
    trace: {
      value: (): LabTrace => traceRecorder.getTrace(),
      writable: false,
      enumerable: true,
    },
    report: {
      value: (): LabReport => generateReport(traceRecorder.getTrace(), options, startedAt),
      writable: false,
      enumerable: true,
    },
    onLabEvent: {
      value: (handler: LabEventHandler): Unsubscribe => {
        return labEventEmitter.subscribe(handler);
      },
      writable: false,
      enumerable: true,
    },
  });

  // Start projection if enabled and not silent
  if (
    options.projection?.enabled &&
    options.projection.mode !== "silent"
  ) {
    projectionController.start(labWorld);
  }

  return labWorld;
}
