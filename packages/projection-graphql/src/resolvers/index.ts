/**
 * Resolvers Module
 *
 * Exports for GraphQL resolvers.
 */

export { createQueryResolvers } from './query-resolvers.js';

export { createMutationResolvers } from './mutation-resolvers.js';

export {
  createSubscriptionResolvers,
  withFilter,
  withTransform,
  setupRuntimeSubscriptions,
} from './subscription-resolvers.js';

export {
  createFieldResolvers,
  createComputedResolver,
  createLazyResolver,
  createMappedResolver,
  createFormattedResolver,
  createValidatedResolver,
  composeResolvers,
  chainResolvers,
  withErrorHandling,
  withCache,
} from './field-resolvers.js';

import type { ManifestoDomain } from '@manifesto-ai/core';
import type { GraphQLResolvers } from '../types.js';
import { createQueryResolvers } from './query-resolvers.js';
import { createMutationResolvers } from './mutation-resolvers.js';
import { createSubscriptionResolvers } from './subscription-resolvers.js';
import { createFieldResolvers } from './field-resolvers.js';

/**
 * Create all resolvers for a domain.
 */
export function createResolvers<TData, TState>(
  domain: ManifestoDomain<TData, TState>,
  domainName: string
): GraphQLResolvers<TData, TState> {
  const queryResolvers = createQueryResolvers(domain, domainName);
  const mutationResolvers = createMutationResolvers(domain, domainName);
  const subscriptionResolvers = createSubscriptionResolvers(domain, domainName);
  const fieldResolvers = createFieldResolvers(domain, domainName);

  return {
    Query: queryResolvers,
    Mutation: mutationResolvers,
    Subscription: subscriptionResolvers,
    ...fieldResolvers,
  };
}
