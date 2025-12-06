export interface FieldRendererMeta {
  readonly label?: string
  readonly description?: string
  readonly tags?: readonly string[]
}

export interface EagerFieldRenderer<TComponent> {
  readonly renderer: TComponent
  readonly meta?: FieldRendererMeta
}

export interface LazyFieldRenderer<TComponent> {
  readonly lazy: () => Promise<{ default: TComponent } | TComponent>
  readonly meta?: FieldRendererMeta
}

export type FieldRendererRegistration<TComponent> =
  | TComponent
  | EagerFieldRenderer<TComponent>
  | LazyFieldRenderer<TComponent>

export interface FieldRendererSummary {
  readonly type: string
  readonly lazy: boolean
  readonly meta?: FieldRendererMeta
}

/**
 * FieldRendererRegistry
 *
 * Holds atomic field renderers (e.g., text-input, select) decoupled from any UI framework.
 * Supports eager + lazy registration so UI kits can defer loading heavy components.
 */
export class FieldRendererRegistry<TComponent = unknown> {
  private registry = new Map<string, EagerFieldRenderer<TComponent> | LazyFieldRenderer<TComponent>>()

  constructor(initial?: ReadonlyArray<[string, FieldRendererRegistration<TComponent>]>) {
    if (initial) {
      for (const [type, registration] of initial) {
        this.register(type, registration)
      }
    }
  }

  /**
   * Register renderer for a field type.
   */
  register(type: string, registration: FieldRendererRegistration<TComponent>): void {
    const normalized = this.normalizeRegistration(registration)
    this.registry.set(type, normalized)
  }

  /**
   * Lookup renderer definition for a field type.
   */
  get(type: string): EagerFieldRenderer<TComponent> | LazyFieldRenderer<TComponent> | undefined {
    return this.registry.get(type)
  }

  /**
   * Load renderer (resolves lazy entries and caches the result).
   */
  async resolve(type: string): Promise<TComponent | undefined> {
    const entry = this.registry.get(type)
    if (!entry) return undefined

    if ('renderer' in entry) {
      return entry.renderer
    }

    const loaded = await entry.lazy()
    const renderer = 'default' in (loaded as object) ? (loaded as { default: TComponent }).default : (loaded as TComponent)

    // Cache resolved renderer to avoid duplicate lazy loads
    this.registry.set(type, { renderer, meta: entry.meta })
    return renderer
  }

  /**
   * Whether a field type is registered.
   */
  has(type: string): boolean {
    return this.registry.has(type)
  }

  /**
   * List registered field types for introspection.
   */
  list(): FieldRendererSummary[] {
    return Array.from(this.registry.entries()).map(([type, entry]) => ({
      type,
      lazy: 'lazy' in entry,
      meta: entry.meta,
    }))
  }

  /**
   * Clone registry (useful for extending base UI kits).
   */
  clone(): FieldRendererRegistry<TComponent> {
    const cloned = new FieldRendererRegistry<TComponent>()
    for (const [type, registration] of this.registry) {
      cloned.register(type, registration)
    }
    return cloned
  }

  private normalizeRegistration(
    registration: FieldRendererRegistration<TComponent>
  ): EagerFieldRenderer<TComponent> | LazyFieldRenderer<TComponent> {
    if (this.isLazy(registration)) {
      return registration
    }
    if (this.isEager(registration)) {
      return registration
    }
    return { renderer: registration }
  }

  private isLazy(
    registration: FieldRendererRegistration<TComponent>
  ): registration is LazyFieldRenderer<TComponent> {
    return typeof registration === 'object' && registration !== null && 'lazy' in registration
  }

  private isEager(
    registration: FieldRendererRegistration<TComponent>
  ): registration is EagerFieldRenderer<TComponent> {
    return typeof registration === 'object' && registration !== null && 'renderer' in registration
  }
}

/**
 * Factory helper for consumers that prefer functions over constructors.
 */
export const createFieldRendererRegistry = <TComponent = unknown>(
  initial?: ReadonlyArray<[string, FieldRendererRegistration<TComponent>]>
): FieldRendererRegistry<TComponent> => new FieldRendererRegistry(initial)
