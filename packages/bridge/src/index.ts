/**
 * @manifesto-ai/bridge
 *
 * Bridge interfaces and implementations for connecting Manifesto Runtime
 * with external state management systems.
 *
 * @example
 * ```typescript
 * import {
 *   createBridge,
 *   createVanillaAdapter,
 *   createVanillaActuator,
 *   setValue,
 *   executeAction,
 * } from '@manifesto-ai/bridge';
 *
 * // Create adapter and actuator
 * const store = { data: { name: '' }, state: {} };
 * const adapter = createVanillaAdapter({ store });
 * const actuator = createVanillaActuator({ store });
 *
 * // Create bridge
 * const bridge = createBridge({
 *   runtime: myRuntime,
 *   adapter,
 *   actuator,
 * });
 *
 * // Execute commands
 * await bridge.execute(setValue('data.name', 'John'));
 * await bridge.execute(executeAction('submitForm'));
 *
 * // Cleanup
 * bridge.dispose();
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Core interfaces
  Adapter,
  Actuator,
  Bridge,
  BridgeConfig,
  SyncMode,

  // Commands
  Command,
  SetValueCommand,
  SetManyCommand,
  ExecuteActionCommand,

  // Errors
  BridgeError,
  BridgeErrorCode,

  // Listeners
  BridgeSnapshotListener,

  // API Request
  ApiRequest,

  // Result (re-exported from core)
  Result,
} from './types.js';

// Type guards and command factories
export {
  isSetValueCommand,
  isSetManyCommand,
  isExecuteActionCommand,
  setValue,
  setMany,
  executeAction,
  bridgeError,
} from './types.js';

// =============================================================================
// Bridge Factory
// =============================================================================

export { createBridge } from './create-bridge.js';

// =============================================================================
// Vanilla Implementation
// =============================================================================

export type {
  VanillaStore,
  VanillaAdapterOptions,
  VanillaActuatorOptions,
  VanillaBridgeSetupOptions,
  VanillaBridgeSetup,
} from './vanilla.js';

export {
  createVanillaAdapter,
  createVanillaActuator,
  createVanillaBridgeSetup,

  // Path utilities (useful for custom adapters/actuators)
  parsePath,
  getNestedValue,
  setNestedValue,
  getValueByPath,
  setValueByPath,
  flattenObject,
} from './vanilla.js';
