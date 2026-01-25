/**
 * Service Registry Implementation
 *
 * Manages effect handlers and provides validation.
 *
 * @see SPEC §13.3, §13.4
 * @module
 */

import type {
  AppState,
  Patch,
  ServiceContext,
  ServiceHandler,
  ServiceMap,
  ServiceReturn,
} from "../../core/types/index.js";
import type { ErrorValue } from "@manifesto-ai/core";
import {
  MissingServiceError,
  DynamicEffectTypeError,
  ReservedEffectTypeError,
} from "../../errors/index.js";
import { RESERVED_EFFECT_TYPE } from "../../constants.js";
import { createServiceContext } from "./context.js";

/**
 * Validation mode for services.
 */
export type ServiceValidationMode = "lazy" | "strict" | "strict+warn" | "strict+error";

/**
 * Service execution options.
 */
export interface ExecuteServiceOptions {
  snapshot: Readonly<AppState<unknown>>;
  actorId: string;
  worldId: string;
  branchId: string;
  signal?: AbortSignal;
}

/**
 * Service execution result.
 */
export interface ServiceExecutionResult {
  success: boolean;
  patches: Patch[];
  error?: ErrorValue;
}

/**
 * Service Registry manages effect handlers.
 *
 * @see SPEC §13
 */
export class ServiceRegistry {
  private _services: ServiceMap;
  private _validationMode: ServiceValidationMode;
  private _knownEffectTypes: Set<string>;

  constructor(
    services: ServiceMap = {},
    opts?: {
      validationMode?: ServiceValidationMode;
      knownEffectTypes?: readonly string[];
    }
  ) {
    this._services = { ...services };
    this._validationMode = opts?.validationMode ?? "lazy";
    this._knownEffectTypes = new Set(opts?.knownEffectTypes ?? []);
  }

  /**
   * Validate services at ready()/fork() time.
   *
   * @see SPEC §13.3 SVC-2~5
   */
  validate(effectTypes: readonly string[]): void {
    // SYSGET-2/3: Reserved effect type check
    if (RESERVED_EFFECT_TYPE in this._services) {
      throw new ReservedEffectTypeError(RESERVED_EFFECT_TYPE);
    }

    // strict mode validation
    if (this._validationMode.startsWith("strict")) {
      for (const effectType of effectTypes) {
        // Skip reserved effect type (SYSGET-4: always satisfied)
        if (effectType === RESERVED_EFFECT_TYPE) {
          continue;
        }

        // Check if service exists
        if (!(effectType in this._services)) {
          throw new MissingServiceError(effectType);
        }
      }
    }
  }

  /**
   * Check if a service handler exists for an effect type.
   */
  has(effectType: string): boolean {
    return effectType in this._services;
  }

  /**
   * Get a service handler.
   */
  get(effectType: string): ServiceHandler | undefined {
    return this._services[effectType];
  }

  /**
   * Execute a service handler.
   *
   * @see SPEC §13.4 SVC-ERR-1~5
   */
  async execute(
    effectType: string,
    params: Record<string, unknown>,
    opts: ExecuteServiceOptions
  ): Promise<ServiceExecutionResult> {
    const handler = this._services[effectType];

    // SVC-1: Missing service at execution
    if (!handler) {
      // Check if this is a dynamic effect type (not in known types)
      const isDynamic = !this._knownEffectTypes.has(effectType);

      if (isDynamic && this._validationMode === "strict+warn") {
        // SVC-4: Dynamic effect type warning
        console.warn(
          `[Manifesto] Dynamic effect type "${effectType}" not in schema. ` +
            `Consider adding it to your domain schema.`
        );
      } else if (isDynamic && this._validationMode === "strict+error") {
        // SVC-5: Dynamic effect type error
        throw new DynamicEffectTypeError(effectType);
      }

      return {
        success: false,
        patches: [],
        error: {
          code: "MISSING_SERVICE",
          message: `No service handler registered for effect type "${effectType}"`,
          source: { actionId: opts.worldId, nodePath: "" },
          timestamp: Date.now(),
        },
      };
    }

    // Create service context
    const ctx = createServiceContext(opts);

    try {
      // Execute handler
      const result = await handler(params, ctx);

      // Normalize result to patches
      const patches = this._normalizeResult(result);

      return {
        success: true,
        patches,
      };
    } catch (error) {
      // SVC-ERR-2: Catch handler exceptions
      // SVC-ERR-3: Result in ActionResult with status='failed'
      // SVC-ERR-4/5: Convert to ErrorValue with code='SERVICE_HANDLER_THROW'
      return {
        success: false,
        patches: [],
        error: {
          code: "SERVICE_HANDLER_THROW",
          message: error instanceof Error ? error.message : String(error),
          source: { actionId: opts.worldId, nodePath: effectType },
          timestamp: Date.now(),
          context: {
            effectType,
            params,
          },
        },
      };
    }
  }

  /**
   * Get all registered effect types.
   */
  getRegisteredTypes(): string[] {
    return Object.keys(this._services);
  }

  /**
   * Merge with additional services (for fork).
   */
  merge(additionalServices: ServiceMap): ServiceRegistry {
    // SYSGET-2/3: Check reserved effect type in new services
    if (RESERVED_EFFECT_TYPE in additionalServices) {
      throw new ReservedEffectTypeError(RESERVED_EFFECT_TYPE);
    }

    return new ServiceRegistry(
      { ...this._services, ...additionalServices },
      {
        validationMode: this._validationMode,
        knownEffectTypes: [...this._knownEffectTypes],
      }
    );
  }

  /**
   * Set known effect types (from schema).
   */
  setKnownEffectTypes(types: readonly string[]): void {
    this._knownEffectTypes = new Set(types);
  }

  /**
   * Normalize service result to patches array.
   */
  private _normalizeResult(result: ServiceReturn): Patch[] {
    if (result === undefined || result === null) {
      return [];
    }

    if (Array.isArray(result)) {
      return result as Patch[];
    }

    if (typeof result === "object") {
      if ("op" in result && typeof result.op === "string") {
        // Single patch
        return [result as Patch];
      }

      if ("patches" in result && Array.isArray(result.patches)) {
        // { patches: Patch[] }
        return result.patches as Patch[];
      }
    }

    return [];
  }
}

/**
 * Create a new service registry.
 */
export function createServiceRegistry(
  services: ServiceMap = {},
  opts?: {
    validationMode?: ServiceValidationMode;
    knownEffectTypes?: readonly string[];
  }
): ServiceRegistry {
  return new ServiceRegistry(services, opts);
}
