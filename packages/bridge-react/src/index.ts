/**
 * @manifesto-ai/bridge-react
 *
 * React bridge for Manifesto Domain Runtime.
 * Provides seamless React 18 integration using useSyncExternalStore.
 *
 * This package follows the @manifesto-ai/bridge pattern with
 * adapter, actuator, and bridge abstractions.
 */

// ============================================================================
// Bridge Core
// ============================================================================

// Adapter
export { createReactAdapter } from './adapter.js';
export type { Adapter, ReactAdapterOptions } from './adapter.js';

// Actuator
export { createReactActuator, parsePath, setNestedValue } from './actuator.js';
export type { Actuator, ReactActuatorOptions, ApiRequest } from './actuator.js';

// Bridge
export {
  createBridge,
  setValue,
  setMany,
  executeAction,
  isSetValueCommand,
  isSetManyCommand,
  isExecuteActionCommand,
  bridgeError,
} from './bridge.js';
export type {
  Bridge,
  BridgeConfig,
  BridgeError,
  BridgeErrorCode,
  BridgeSnapshot,
  BridgeSnapshotListener,
  Command,
  SetValueCommand,
  SetManyCommand,
  ExecuteActionCommand,
  SyncMode,
} from './bridge.js';

// ============================================================================
// React Integration
// ============================================================================

// Provider
export {
  BridgeProvider,
  useBridgeContext,
  useBridge,
  useBridgeRuntime,
  useBridgeDomain,
} from './provider.js';
export type { BridgeContextValue, BridgeProviderProps } from './provider.js';

// Hook
export { useManifestoBridge, useSimpleBridge } from './use-bridge.js';
export type { UseManifestoBridgeOptions } from './use-bridge.js';

// ============================================================================
// Legacy Context (Backward Compatibility)
// ============================================================================

export {
  RuntimeProvider,
  useRuntimeContext,
  useRuntime,
  useDomainContext,
  useDomain,
} from './context.js';
export type { RuntimeProviderProps } from './context.js';

// ============================================================================
// Hooks
// ============================================================================

export {
  useSnapshot,
  useValue,
  useValues,
  useDerived,
  useSetValue,
  useAction,
  useFieldPolicy,
  useActionAvailability,
} from './hooks/index.js';

// ============================================================================
// Types
// ============================================================================

export type {
  RuntimeContextValue,
  DomainContextValue,
  UseValueResult,
  UseValuesResult,
  UseSetValueResult,
  UseActionResult,
  UseFieldPolicyResult,
  UseActionAvailabilityResult,
} from './types.js';
