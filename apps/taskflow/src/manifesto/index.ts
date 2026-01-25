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

// Domain
export {
  type Task,
  type Filter,
  type ViewMode,
  TasksDomain,
  initialSnapshot,
} from "../domain";

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
