/**
 * Translator Host
 *
 * Integrates the Translator with @manifesto-ai/host for effect execution.
 * Provides a complete runtime for running the Translator state machine.
 *
 * @see translator.mel for the domain definition
 * @see @manifesto-ai/host for the Host runtime
 */

export {
  TranslatorHost,
  createTranslatorHost,
  type TranslatorHostConfig,
  type TranslatorHostResult,
} from "./translator-host.js";
