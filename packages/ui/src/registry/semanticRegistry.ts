import {
  type SemanticBuildOptions,
  type SemanticContract,
  type SemanticRenderer,
  type SemanticTree,
  type SemanticViewKind,
} from '../semantic/types'
import { buildDetailSemanticTree } from '../semantic/builders/detail'
import { buildFormSemanticTree } from '../semantic/builders/form'
import { buildListSemanticTree } from '../semantic/builders/list'

export class SemanticRendererRegistry {
  private registry = new Map<SemanticViewKind, SemanticRenderer>()

  constructor(includeDefaults = true) {
    if (includeDefaults) {
      registerDefaultSemanticRenderers(this)
    }
  }

  register<TContract extends SemanticContract>(kind: SemanticViewKind, renderer: SemanticRenderer<TContract>): void {
    this.registry.set(kind, renderer as SemanticRenderer)
  }

  get(kind: SemanticViewKind): SemanticRenderer | undefined {
    return this.registry.get(kind)
  }

  has(kind: SemanticViewKind): boolean {
    return this.registry.has(kind)
  }

  list(): SemanticViewKind[] {
    return Array.from(this.registry.keys())
  }

  build(contract: SemanticContract, options?: SemanticBuildOptions): SemanticTree {
    const renderer = this.registry.get(contract.kind)
    if (!renderer) {
      throw new Error(`No semantic renderer registered for kind "${contract.kind}"`)
    }
    return renderer(contract as never, options)
  }

  clone(): SemanticRendererRegistry {
    const cloned = new SemanticRendererRegistry(false)
    for (const [kind, renderer] of this.registry) {
      cloned.register(kind, renderer)
    }
    return cloned
  }
}

const registerDefaultSemanticRenderers = (registry: SemanticRendererRegistry): void => {
  registry.register('form', buildFormSemanticTree)
  registry.register('detail', buildDetailSemanticTree)
  registry.register('list', buildListSemanticTree)
}

let _defaultSemanticRegistry: SemanticRendererRegistry | null = null

export const getDefaultSemanticRegistry = (): SemanticRendererRegistry => {
  if (!_defaultSemanticRegistry) {
    _defaultSemanticRegistry = new SemanticRendererRegistry(true)
  }
  return _defaultSemanticRegistry
}

export const createSemanticRendererRegistry = (includeDefaults = true): SemanticRendererRegistry =>
  new SemanticRendererRegistry(includeDefaults)
