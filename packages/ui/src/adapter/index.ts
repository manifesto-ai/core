import type { FieldRendererRegistry } from '../registry/fieldRegistry'
import type {
  DetailSemanticNode,
  FieldSemanticNode,
  FormSemanticNode,
  ListSemanticNode,
  SectionSemanticNode,
  SemanticTree,
} from '../semantic/types'

export interface ResolvedFieldSemanticNode<TComponent> extends FieldSemanticNode {
  readonly renderer?: TComponent
}

export interface ResolvedSectionSemanticNode<TComponent>
  extends Omit<SectionSemanticNode, 'fields'> {
  readonly fields: readonly ResolvedFieldSemanticNode<TComponent>[]
}

export interface ResolvedFormSemanticNode<TComponent>
  extends Omit<FormSemanticNode, 'sections'> {
  readonly sections: readonly ResolvedSectionSemanticNode<TComponent>[]
}

export interface ResolvedDetailSemanticNode<TComponent>
  extends Omit<DetailSemanticNode, 'sections'> {
  readonly sections: readonly ResolvedSectionSemanticNode<TComponent>[]
}

export type ResolvedSemanticTree<TComponent> =
  | ResolvedFormSemanticNode<TComponent>
  | ResolvedDetailSemanticNode<TComponent>
  | ListSemanticNode

export interface ResolveFieldRenderersResult<TComponent> {
  readonly tree: ResolvedSemanticTree<TComponent>
  readonly missing: readonly string[]
}

/**
  Resolves field renderers from the registry and decorates semantic field nodes with the concrete renderer.
  Useful for adapters (React/Vue/AI) to stay headless while still knowing which component to mount.
*/
export const resolveFieldRenderers = async <TComponent>(
  tree: SemanticTree,
  registry: FieldRendererRegistry<TComponent>
): Promise<ResolveFieldRenderersResult<TComponent>> => {
  if (tree.kind === 'list') {
    return { tree, missing: [] }
  }

  const missing = new Set<string>()

  const mapSection = async (
    section: SectionSemanticNode
  ): Promise<ResolvedSectionSemanticNode<TComponent>> => {
    const fields: ResolvedFieldSemanticNode<TComponent>[] = []

    for (const field of section.fields) {
      const renderer = await registry.resolve(field.componentType)
      if (!renderer) {
        missing.add(field.componentType)
      }
      fields.push({
        ...field,
        renderer: renderer ?? undefined,
      })
    }

    return {
      ...section,
      fields,
    }
  }

  const mappedSections = await Promise.all(tree.sections.map(mapSection))

  const resolvedTree: ResolvedFormSemanticNode<TComponent> | ResolvedDetailSemanticNode<TComponent> =
    {
      ...tree,
      sections: mappedSections,
    }

  return { tree: resolvedTree, missing: Array.from(missing) }
}
