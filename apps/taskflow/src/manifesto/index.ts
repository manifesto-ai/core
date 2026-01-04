/**
 * TaskFlow Manifesto Module
 *
 * Exports all Manifesto integration components for TaskFlow.
 */

// Actors
export {
  ActorKinds,
  ActorIds,
  createUserActor,
  createAssistantActor,
  createTaskflowSystemActor,
  defaultActors,
} from "./actors";
export type { ActorRef } from "@manifesto-ai/world";

// Authority
export {
  AuthorityIds,
  authorities,
  createUserBinding,
  createAgentBinding,
  createSystemBinding,
  createAgentPolicyHandler,
  defaultBindings,
} from "./authority";

// Effects
export {
  registerAllEffects,
  registerArrayEffects,
  registerSystemEffects,
  LocalStoragePersistence,
  MemoryPersistence,
  createPersistenceObserver,
  defaultPersistence,
  type TaskFlowPersistence,
} from "./effects";

// World
export {
  createTaskFlowWorld,
  TasksDomain,
  initialSnapshot,
  type TaskFlowWorld,
  type TaskFlowWorldConfig,
  type Task,
  type Filter,
  type ViewMode,
} from "./world";

// App
export {
  createTaskFlowApp,
  getTaskFlowApp,
  resetTaskFlowApp,
  type TaskFlowApp,
  type TaskFlowAppConfig,
  type TaskFlowState,
  type TaskFlowComputed,
} from "./app";
