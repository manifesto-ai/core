/**
 * Subscription Resolvers
 *
 * GraphQL subscription resolvers for real-time updates.
 */

import type { ManifestoDomain } from '@manifesto-ai/core';

import type {
  GraphQLDomainContext,
  GraphQLSubscriptionResolver,
  DomainChangeEvent,
  FieldChangeEvent,
} from '../types.js';
import {
  getDomainChangeTrigger,
  getFieldChangeTrigger,
} from '../context/graphql-context.js';

// =============================================================================
// Subscription Resolver Factory
// =============================================================================

/**
 * Create subscription resolvers for a domain.
 */
export function createSubscriptionResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): Record<string, GraphQLSubscriptionResolver<TData, TState>> {
  const lowerDomainName = domainName.charAt(0).toLowerCase() + domainName.slice(1);

  return {
    // Subscribe to domain changes
    [`${lowerDomainName}Changed`]: createDomainChangedResolver(domain),

    // Subscribe to specific field changes
    [`${lowerDomainName}FieldChanged`]: createFieldChangedResolver(domain),
  };
}

// =============================================================================
// Domain Changed Subscription
// =============================================================================

/**
 * Create subscription resolver for domain changes.
 */
function createDomainChangedResolver<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): GraphQLSubscriptionResolver<TData, TState> {
  return {
    subscribe: (_parent, _args, context) => {
      const { pubsub } = context;

      if (!pubsub) {
        throw new Error('PubSub not configured. Subscriptions require a PubSub engine.');
      }

      const trigger = getDomainChangeTrigger(domain.id);
      return pubsub.asyncIterator<DomainChangeEvent>([trigger]);
    },
    resolve: (payload: unknown) => {
      return payload as DomainChangeEvent;
    },
  };
}

// =============================================================================
// Field Changed Subscription
// =============================================================================

/**
 * Create subscription resolver for field changes.
 */
function createFieldChangedResolver<TData, TState>(
  domain: ManifestoDomain<TData, TState>
): GraphQLSubscriptionResolver<TData, TState> {
  return {
    subscribe: (_parent, args, context) => {
      const { pubsub } = context;
      const path = args.path as string;

      if (!pubsub) {
        throw new Error('PubSub not configured. Subscriptions require a PubSub engine.');
      }

      const trigger = getFieldChangeTrigger(domain.id, path);
      return pubsub.asyncIterator<FieldChangeEvent>([trigger]);
    },
    resolve: (payload: unknown) => {
      return payload as FieldChangeEvent;
    },
  };
}

// =============================================================================
// Subscription Helpers
// =============================================================================

/**
 * Create a filtered subscription that only emits when condition is met.
 */
export function withFilter<TData, TState>(
  subscribe: GraphQLSubscriptionResolver<TData, TState>['subscribe'],
  filter: (payload: unknown, args: Record<string, unknown>, context: GraphQLDomainContext<TData, TState>) => boolean | Promise<boolean>
): GraphQLSubscriptionResolver<TData, TState>['subscribe'] {
  return async function* (
    parent: unknown,
    args: Record<string, unknown>,
    context: GraphQLDomainContext<TData, TState>,
    info: unknown
  ) {
    const iterator = subscribe(parent, args, context, info as any);

    for await (const payload of asyncIteratorToAsyncIterable(iterator)) {
      if (await filter(payload, args, context)) {
        yield payload;
      }
    }
  } as any;
}

/**
 * Convert AsyncIterator to AsyncIterable.
 */
async function* asyncIteratorToAsyncIterable<T>(
  iterator: AsyncIterator<T>
): AsyncIterable<T> {
  while (true) {
    const { value, done } = await iterator.next();
    if (done) break;
    yield value;
  }
}

/**
 * Create a subscription that transforms the payload.
 */
export function withTransform<TData, TState, TPayload, TResult>(
  subscribe: GraphQLSubscriptionResolver<TData, TState>['subscribe'],
  transform: (payload: TPayload) => TResult
): GraphQLSubscriptionResolver<TData, TState> {
  return {
    subscribe,
    resolve: (payload) => transform(payload as TPayload),
  };
}

// =============================================================================
// Runtime Subscription Setup
// =============================================================================

/**
 * Setup runtime subscriptions to publish changes via pubsub.
 */
export function setupRuntimeSubscriptions<TData, TState>(
  runtime: any,
  domain: ManifestoDomain<TData, TState>,
  pubsub: any
): () => void {
  const unsubscribers: Array<() => void> = [];

  // Subscribe to snapshot changes
  if (typeof runtime.subscribe === 'function') {
    const unsubscribe = runtime.subscribe((snapshot: any) => {
      pubsub.publish(getDomainChangeTrigger(domain.id), {
        type: 'DATA_CHANGED',
        timestamp: Date.now(),
        paths: [],
        snapshot,
      });
    });
    unsubscribers.push(unsubscribe);
  }

  // Subscribe to path changes if available
  if (typeof runtime.subscribePath === 'function') {
    const allPaths = collectAllPaths(domain);
    for (const path of allPaths) {
      const unsubscribe = runtime.subscribePath(path, (value: unknown, previousValue: unknown) => {
        pubsub.publish(getFieldChangeTrigger(domain.id, path), {
          path,
          previousValue,
          newValue: value,
          timestamp: Date.now(),
        });
      });
      unsubscribers.push(unsubscribe);
    }
  }

  // Return cleanup function
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

/**
 * Collect all paths from a domain.
 */
function collectAllPaths<TData, TState>(domain: ManifestoDomain<TData, TState>): string[] {
  const paths: string[] = [];

  if (domain.paths?.sources) {
    paths.push(...Object.keys(domain.paths.sources));
  }

  if (domain.paths?.derived) {
    paths.push(...Object.keys(domain.paths.derived));
  }

  if (domain.paths?.async) {
    paths.push(...Object.keys(domain.paths.async));
  }

  return paths;
}
