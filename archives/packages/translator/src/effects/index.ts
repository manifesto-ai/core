/**
 * Translator Effect Handlers
 *
 * Effect handlers that execute pipeline stages and return patches
 * to update Translator state. These handlers integrate with
 * @manifesto-ai/host's EffectHandlerRegistry.
 *
 * @see translator.mel for the domain definition
 */

export {
  createTranslatorEffectHandlers,
  registerTranslatorEffects,
  type TranslatorEffectDependencies,
  type TranslatorEffectRegistry,
  type TranslatorEffectContext,
  type TranslatorEffectHandler,
} from "./handlers.js";
