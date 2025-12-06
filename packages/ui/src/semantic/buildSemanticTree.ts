import { getDefaultSemanticRegistry } from '../registry/semanticRegistry'
import type { SemanticBuildOptions, SemanticContract, SemanticTree } from './types'

/**
 * Convenience helper to build a semantic tree using the default registry.
 */
export const buildSemanticTree = (
  contract: SemanticContract,
  options?: SemanticBuildOptions
): SemanticTree => {
  const registry = getDefaultSemanticRegistry()
  return registry.build(contract, options)
}
