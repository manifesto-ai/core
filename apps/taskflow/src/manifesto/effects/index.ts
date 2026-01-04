/**
 * Effect Handlers Index
 *
 * Exports all effect handlers and registration utilities.
 */

import type { EffectHandler } from "@manifesto-ai/host";
import { registerArrayEffects } from "./array";
import { registerSystemEffects } from "./system";

export { registerArrayEffects } from "./array";
export { registerSystemEffects } from "./system";
export {
  LocalStoragePersistence,
  MemoryPersistence,
  createPersistenceObserver,
  defaultPersistence,
  type TaskFlowPersistence,
} from "./persistence";

/**
 * Register all TaskFlow effect handlers with a Host
 */
export function registerAllEffects(
  register: (type: string, handler: EffectHandler) => void
): void {
  registerArrayEffects(register);
  registerSystemEffects(register);
}
