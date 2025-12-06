import { ActionHandlerRegistry } from '@manifesto-ai/ui'
import type { FormActionHandler } from '../types'

let _defaultActionRegistry: ActionHandlerRegistry<FormActionHandler> | null = null

export const getDefaultActionRegistry = (): ActionHandlerRegistry<FormActionHandler> => {
  if (!_defaultActionRegistry) {
    _defaultActionRegistry = new ActionHandlerRegistry<FormActionHandler>()
  }
  return _defaultActionRegistry
}

export const createActionRegistry = (): ActionHandlerRegistry<FormActionHandler> =>
  new ActionHandlerRegistry<FormActionHandler>()
