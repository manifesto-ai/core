export type ActionHandler<TContext = unknown> = (context: TContext) => void | Promise<void>

export class ActionHandlerRegistry<TContext = unknown> {
  private registry = new Map<string, ActionHandler<TContext>>()

  register(actionId: string, handler: ActionHandler<TContext>): void {
    this.registry.set(actionId, handler)
  }

  get(actionId: string): ActionHandler<TContext> | undefined {
    return this.registry.get(actionId)
  }

  has(actionId: string): boolean {
    return this.registry.has(actionId)
  }

  list(): string[] {
    return Array.from(this.registry.keys())
  }

  clone(): ActionHandlerRegistry<TContext> {
    const cloned = new ActionHandlerRegistry<TContext>()
    for (const [id, handler] of this.registry) {
      cloned.register(id, handler)
    }
    return cloned
  }
}

export const createActionHandlerRegistry = <TContext = unknown>(): ActionHandlerRegistry<TContext> =>
  new ActionHandlerRegistry<TContext>()
