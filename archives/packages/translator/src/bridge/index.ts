/**
 * Bridge Integration Module
 *
 * Provides TranslatorBridge and projections for World Protocol integration.
 */

// TranslatorBridge
export {
  TranslatorBridge,
  createTranslatorBridge,
  type TranslatorBridgeConfig,
} from "./translator-bridge.js";

// Projections
export {
  createTranslateProjection,
  createResolveProjection,
  type TranslatePayload,
  type ResolvePayload,
} from "./projections/index.js";

// Source Events
export {
  createTranslateSourceEvent,
  createResolveSourceEvent,
  createCLISourceEvent,
  createAgentSourceEvent,
  isTranslatePayload,
  isResolvePayload,
  type TranslateEventPayload,
  type ResolveEventPayload,
  type CLIEventPayload,
  type AgentEventPayload,
} from "./source-events.js";
