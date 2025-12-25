/**
 * Effect Mocker
 *
 * Mock handler registry for simulating effects during scenario tests.
 * Enables testing apiCall, navigate, and custom effects safely.
 */

import type { EffectType } from "../domain/types";

// ============================================================================
// Types
// ============================================================================

/**
 * A mock handler for a specific effect type
 */
export interface MockHandler {
  /** Effect type this handler matches */
  effectType: EffectType;
  /** Optional matcher function - if returns false, handler is skipped */
  match?: (config: unknown) => boolean;
  /** Mock response - can be a value or function */
  response: unknown | ((config: unknown) => unknown);
  /** Whether to simulate delay */
  delay?: number;
  /** Whether to simulate failure */
  shouldFail?: boolean;
  /** Error message when failing */
  errorMessage?: string;
}

/**
 * Registry of mock handlers
 */
export interface MockRegistry {
  handlers: MockHandler[];
}

/**
 * Result of applying a mock
 */
export interface MockResult {
  /** Whether a matching mock was found */
  matched: boolean;
  /** The mock response (if matched and not failed) */
  response?: unknown;
  /** Whether the mock simulated failure */
  failed: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Mock Registry
// ============================================================================

/**
 * Create an empty mock registry
 */
export function createMockRegistry(): MockRegistry {
  return { handlers: [] };
}

/**
 * Add a mock handler to the registry
 */
export function addMockHandler(
  registry: MockRegistry,
  handler: MockHandler
): MockRegistry {
  return {
    handlers: [...registry.handlers, handler],
  };
}

/**
 * Remove handlers matching criteria
 */
export function removeMockHandlers(
  registry: MockRegistry,
  predicate: (handler: MockHandler) => boolean
): MockRegistry {
  return {
    handlers: registry.handlers.filter((h) => !predicate(h)),
  };
}

/**
 * Clear all handlers from the registry
 */
export function clearMockRegistry(registry: MockRegistry): MockRegistry {
  return { handlers: [] };
}

// ============================================================================
// Mock Application
// ============================================================================

/**
 * Apply mocks to an effect, returning the mock result
 */
export function applyMock(
  effectType: EffectType,
  config: unknown,
  registry: MockRegistry
): MockResult {
  // Find matching handler
  const handler = registry.handlers.find((h) => {
    if (h.effectType !== effectType) return false;
    if (h.match && !h.match(config)) return false;
    return true;
  });

  if (!handler) {
    return { matched: false, failed: false };
  }

  // Check if should fail
  if (handler.shouldFail) {
    return {
      matched: true,
      failed: true,
      error: handler.errorMessage || "Mock simulated failure",
    };
  }

  // Get response
  const response =
    typeof handler.response === "function"
      ? handler.response(config)
      : handler.response;

  return {
    matched: true,
    response,
    failed: false,
  };
}

/**
 * Apply mock with async support (for delay simulation)
 */
export async function applyMockAsync(
  effectType: EffectType,
  config: unknown,
  registry: MockRegistry
): Promise<MockResult> {
  // Find matching handler
  const handler = registry.handlers.find((h) => {
    if (h.effectType !== effectType) return false;
    if (h.match && !h.match(config)) return false;
    return true;
  });

  if (!handler) {
    return { matched: false, failed: false };
  }

  // Simulate delay if specified
  if (handler.delay && handler.delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, handler.delay));
  }

  // Check if should fail
  if (handler.shouldFail) {
    return {
      matched: true,
      failed: true,
      error: handler.errorMessage || "Mock simulated failure",
    };
  }

  // Get response
  const response =
    typeof handler.response === "function"
      ? handler.response(config)
      : handler.response;

  return {
    matched: true,
    response,
    failed: false,
  };
}

// ============================================================================
// Convenience Builders
// ============================================================================

/**
 * Create an API call mock
 */
export function mockApiCall(
  response: unknown,
  options?: {
    match?: (config: unknown) => boolean;
    delay?: number;
    shouldFail?: boolean;
    errorMessage?: string;
  }
): MockHandler {
  return {
    effectType: "apiCall",
    response,
    ...options,
  };
}

/**
 * Create a navigate mock
 */
export function mockNavigate(
  response?: unknown,
  options?: {
    match?: (config: unknown) => boolean;
  }
): MockHandler {
  return {
    effectType: "navigate",
    response: response ?? { navigated: true },
    ...options,
  };
}

/**
 * Create a custom effect mock
 */
export function mockCustom(
  response: unknown,
  options?: {
    match?: (config: unknown) => boolean;
    delay?: number;
    shouldFail?: boolean;
    errorMessage?: string;
  }
): MockHandler {
  return {
    effectType: "custom",
    response,
    ...options,
  };
}

/**
 * Create a failing API call mock
 */
export function mockApiCallFailure(
  errorMessage: string,
  options?: {
    match?: (config: unknown) => boolean;
    delay?: number;
  }
): MockHandler {
  return {
    effectType: "apiCall",
    response: null,
    shouldFail: true,
    errorMessage,
    ...options,
  };
}

// ============================================================================
// Preset Mocks
// ============================================================================

/**
 * Create a mock registry with common presets
 */
export function createMockRegistryWithPresets(): MockRegistry {
  return {
    handlers: [
      // Default API success
      mockApiCall({ success: true }),
      // Default navigate success
      mockNavigate({ navigated: true }),
    ],
  };
}

/**
 * Create endpoint-specific API mock
 */
export function mockEndpoint(
  endpoint: string,
  response: unknown,
  options?: {
    method?: string;
    delay?: number;
    shouldFail?: boolean;
    errorMessage?: string;
  }
): MockHandler {
  return {
    effectType: "apiCall",
    match: (config) => {
      if (typeof config !== "object" || config === null) return false;
      const cfg = config as Record<string, unknown>;
      if (cfg.endpoint !== endpoint) return false;
      if (options?.method && cfg.method !== options.method) return false;
      return true;
    },
    response,
    delay: options?.delay,
    shouldFail: options?.shouldFail,
    errorMessage: options?.errorMessage,
  };
}
