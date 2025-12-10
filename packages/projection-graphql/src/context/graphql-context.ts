/**
 * GraphQL Context
 *
 * Context factory and utilities for GraphQL resolvers.
 */

import type { DomainRuntime, ManifestoDomain } from '@manifesto-ai/core';

import type {
  GraphQLDomainContext,
  ContextOptions,
  PubSubEngine,
} from '../types.js';

// =============================================================================
// Context Factory
// =============================================================================

/**
 * Create a GraphQL context for resolvers.
 */
export function createGraphQLContext<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  options: ContextOptions = {}
): GraphQLDomainContext<TData, TState> {
  const requestId = generateRequestId();

  return {
    runtime,
    domain,
    requestId,
    pubsub: options.pubsub,
    user: options.user,
    ...options.extras,
  };
}

/**
 * Create a context factory function for middleware integration.
 */
export function createContextFactory<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  baseOptions: ContextOptions = {}
): (requestOptions?: ContextOptions) => GraphQLDomainContext<TData, TState> {
  return (requestOptions = {}) => {
    const mergedOptions: ContextOptions = {
      pubsub: requestOptions.pubsub ?? baseOptions.pubsub,
      user: requestOptions.user ?? baseOptions.user,
      extras: {
        ...baseOptions.extras,
        ...requestOptions.extras,
      },
    };

    return createGraphQLContext(runtime, domain, mergedOptions);
  };
}

// =============================================================================
// Context Utilities
// =============================================================================

/**
 * Get the runtime from context.
 */
export function getRuntimeFromContext<TData, TState>(
  context: GraphQLDomainContext<TData, TState>
): DomainRuntime<TData, TState> {
  return context.runtime;
}

/**
 * Get the domain from context.
 */
export function getDomainFromContext<TData, TState>(
  context: GraphQLDomainContext<TData, TState>
): ManifestoDomain<TData, TState> {
  return context.domain;
}

/**
 * Get the pubsub from context.
 */
export function getPubSubFromContext<TData, TState>(
  context: GraphQLDomainContext<TData, TState>
): PubSubEngine | undefined {
  return context.pubsub;
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated<TData, TState>(
  context: GraphQLDomainContext<TData, TState>
): boolean {
  return context.user !== undefined && context.user !== null;
}

/**
 * Get user from context.
 */
export function getUserFromContext<TData, TState, TUser = unknown>(
  context: GraphQLDomainContext<TData, TState>
): TUser | undefined {
  return context.user as TUser | undefined;
}

// =============================================================================
// Simple PubSub Implementation
// =============================================================================

/**
 * Simple in-memory PubSub implementation.
 */
export class SimplePubSub implements PubSubEngine {
  private subscriptions = new Map<string, Set<(message: unknown) => void>>();
  private subscriptionIds = new Map<number, { trigger: string; callback: (message: unknown) => void }>();
  private nextId = 1;

  async publish(triggerName: string, payload: unknown): Promise<void> {
    const subscribers = this.subscriptions.get(triggerName);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in subscription callback for ${triggerName}:`, error);
        }
      }
    }
  }

  async subscribe(
    triggerName: string,
    onMessage: (message: unknown) => void
  ): Promise<number> {
    if (!this.subscriptions.has(triggerName)) {
      this.subscriptions.set(triggerName, new Set());
    }

    this.subscriptions.get(triggerName)!.add(onMessage);

    const id = this.nextId++;
    this.subscriptionIds.set(id, { trigger: triggerName, callback: onMessage });

    return id;
  }

  unsubscribe(subId: number): void {
    const sub = this.subscriptionIds.get(subId);
    if (sub) {
      const subscribers = this.subscriptions.get(sub.trigger);
      if (subscribers) {
        subscribers.delete(sub.callback);
        if (subscribers.size === 0) {
          this.subscriptions.delete(sub.trigger);
        }
      }
      this.subscriptionIds.delete(subId);
    }
  }

  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    const triggerList = Array.isArray(triggers) ? triggers : [triggers];
    const pullQueue: Array<(value: IteratorResult<T>) => void> = [];
    const pushQueue: T[] = [];
    let listening = true;

    const pushValue = (value: T) => {
      const resolver = pullQueue.shift();
      if (resolver) {
        resolver({ value, done: false });
      } else {
        pushQueue.push(value);
      }
    };

    const pullValue = (): Promise<IteratorResult<T>> => {
      return new Promise((resolve) => {
        const value = pushQueue.shift();
        if (value !== undefined) {
          resolve({ value, done: false });
        } else if (!listening) {
          resolve({ value: undefined as any, done: true });
        } else {
          pullQueue.push(resolve);
        }
      });
    };

    const subscriptionIds: number[] = [];

    // Subscribe to all triggers
    for (const trigger of triggerList) {
      this.subscribe(trigger, (payload) => {
        pushValue(payload as T);
      }).then((id) => {
        subscriptionIds.push(id);
      });
    }

    const iterator: AsyncIterator<T> = {
      next: () => pullValue(),
      return: () => {
        listening = false;
        for (const id of subscriptionIds) {
          this.unsubscribe(id);
        }
        // Resolve any pending pulls
        for (const resolver of pullQueue) {
          resolver({ value: undefined as any, done: true });
        }
        return Promise.resolve({ value: undefined as any, done: true });
      },
      throw: (error: unknown) => {
        listening = false;
        for (const id of subscriptionIds) {
          this.unsubscribe(id);
        }
        return Promise.reject(error);
      },
    };

    return iterator;
  }

  /**
   * Clear all subscriptions.
   */
  clear(): void {
    this.subscriptions.clear();
    this.subscriptionIds.clear();
    this.nextId = 1;
  }
}

// =============================================================================
// Subscription Event Helpers
// =============================================================================

/**
 * Create subscription trigger name for domain changes.
 */
export function getDomainChangeTrigger(domainId: string): string {
  return `${domainId}:changed`;
}

/**
 * Create subscription trigger name for field changes.
 */
export function getFieldChangeTrigger(domainId: string, path: string): string {
  return `${domainId}:field:${path}`;
}

/**
 * Create subscription trigger name for action execution.
 */
export function getActionTrigger(domainId: string, actionId: string): string {
  return `${domainId}:action:${actionId}`;
}

// =============================================================================
// Request ID Generation
// =============================================================================

/**
 * Generate a unique request ID.
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate a request ID format.
 */
export function isValidRequestId(requestId: string): boolean {
  return /^[a-z0-9]+-[a-z0-9]+$/.test(requestId);
}
