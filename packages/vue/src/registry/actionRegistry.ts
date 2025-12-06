import { ActionHandlerRegistry } from '@manifesto-ai/ui'
import type { FormActionHandlerContext } from '../types'

let _defaultActionRegistry: ActionHandlerRegistry<FormActionHandlerContext> | null = null

export const getDefaultActionRegistry = (): ActionHandlerRegistry<FormActionHandlerContext> => {
  if (!_defaultActionRegistry) {
    _defaultActionRegistry = new ActionHandlerRegistry<FormActionHandlerContext>()
  }
  return _defaultActionRegistry
}

export const createActionRegistry = (): ActionHandlerRegistry<FormActionHandlerContext> =>
  new ActionHandlerRegistry<FormActionHandlerContext>()
