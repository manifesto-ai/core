import type { EffectHandler, EffectHandlerOptions, RegisteredHandler } from "./types.js";
import { createHostError } from "../errors.js";

/**
 * Default handler options
 */
const DEFAULT_OPTIONS: Required<EffectHandlerOptions> = {
  timeout: 30000,
  retries: 0,
  retryDelay: 1000,
};

/**
 * Effect handler registry
 *
 * Manages registration and lookup of effect handlers
 */
export class EffectHandlerRegistry {
  private handlers: Map<string, RegisteredHandler> = new Map();

  /**
   * Register an effect handler
   *
   * @param type - Effect type (e.g., "http", "storage")
   * @param handler - Handler function
   * @param options - Handler options
   */
  register(
    type: string,
    handler: EffectHandler,
    options: EffectHandlerOptions = {}
  ): void {
    if (this.handlers.has(type)) {
      throw createHostError(
        "INVALID_STATE",
        `Effect handler for type "${type}" is already registered`,
        { type }
      );
    }

    this.handlers.set(type, {
      handler,
      options: { ...DEFAULT_OPTIONS, ...options },
    });
  }

  /**
   * Unregister an effect handler
   *
   * @param type - Effect type to unregister
   * @returns true if handler was removed, false if not found
   */
  unregister(type: string): boolean {
    return this.handlers.delete(type);
  }

  /**
   * Get a registered handler
   *
   * @param type - Effect type
   * @returns RegisteredHandler or undefined
   */
  get(type: string): RegisteredHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Check if a handler is registered
   *
   * @param type - Effect type
   */
  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered effect types
   */
  getTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get the number of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }
}

/**
 * Create a new effect handler registry
 */
export function createEffectRegistry(): EffectHandlerRegistry {
  return new EffectHandlerRegistry();
}
