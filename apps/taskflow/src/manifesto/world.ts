/**
 * TaskFlow World Setup
 *
 * Creates and configures the Manifesto World for TaskFlow.
 * This is the main entry point for the Manifesto runtime.
 */

import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import {
  createManifestoWorld,
  type ManifestoWorld,
  type ManifestoWorldConfig,
} from "@manifesto-ai/world";
import type { DomainSchema, Snapshot } from "@manifesto-ai/core";

/**
 * World event handler type - placeholder for now
 */
export type WorldEventHandler = (event: unknown) => void;

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

import { TasksDomain, initialSnapshot, type Task } from "../domain";
import {
  defaultActors,
  createUserActor,
  createAssistantActor,
  createTaskflowSystemActor,
  type ActorRef,
} from "./actors";
import {
  createUserBinding,
  createAgentBinding,
  createSystemBinding,
} from "./authority";
import { registerAllEffects, defaultPersistence, type TaskFlowPersistence } from "./effects";

/**
 * TaskFlow World configuration
 */
export interface TaskFlowWorldConfig {
  /**
   * Optional persistence implementation
   */
  persistence?: TaskFlowPersistence;

  /**
   * Initial user ID (creates user actor)
   */
  userId?: string;

  /**
   * Optional event handler for world events
   */
  onEvent?: WorldEventHandler;
}

/**
 * TaskFlow World instance
 */
export interface TaskFlowWorld {
  /**
   * The Manifesto World orchestrator
   */
  world: ManifestoWorld;

  /**
   * The Manifesto Host
   */
  host: ManifestoHost;

  /**
   * The current user actor
   */
  userActor: ActorRef;

  /**
   * The system actor
   */
  systemActor: ActorRef;

  /**
   * Subscribe to world events
   */
  subscribe: (handler: WorldEventHandler) => Unsubscribe;

  /**
   * Get the current snapshot
   */
  getSnapshot: () => Promise<Snapshot | null>;

  /**
   * Initialize the world with genesis
   */
  initialize: () => Promise<void>;

  /**
   * Register an AI assistant actor
   */
  registerAssistant: (sessionId: string) => ActorRef;
}


/**
 * Create initial data from persistence or defaults
 */
async function loadInitialData(persistence: TaskFlowPersistence): Promise<Record<string, unknown>> {
  const tasks = await persistence.loadTasks();
  return {
    tasks,
    currentFilter: { status: null, priority: null, assignee: null },
  };
}

/**
 * Create and configure the TaskFlow World
 */
export async function createTaskFlowWorld(
  config: TaskFlowWorldConfig = {}
): Promise<TaskFlowWorld> {
  const persistence = config.persistence ?? defaultPersistence;

  // Load initial data from persistence
  const initialData = await loadInitialData(persistence);

  // Adapt domain schema for Core
  const schema = TasksDomain as unknown as DomainSchema;

  // Create Host with initial data
  const host = createHost(schema, {
    initialData,
  });

  // Register effect handlers
  registerAllEffects((type, handler) => {
    host.registerEffect(type, handler);
  });

  // Create World orchestrator
  // Cast host to HostInterface since the type definitions differ slightly
  const worldConfig: ManifestoWorldConfig = {
    schemaHash: schema.hash,
    host: host as unknown as ManifestoWorldConfig["host"],
  };

  const world = createManifestoWorld(worldConfig);

  // Create user actor
  const userId = config.userId ?? "anonymous";
  const userActor = userId === "anonymous"
    ? defaultActors.anonymousUser
    : createUserActor(userId);

  // Create system actor
  const systemActor = createTaskflowSystemActor();

  // Register actors with authority bindings
  const userBinding = createUserBinding(userActor);
  world.registerActor(userBinding.actor, userBinding.policy);

  const systemBinding = createSystemBinding(systemActor);
  world.registerActor(systemBinding.actor, systemBinding.policy);

  // Event handlers - stored locally since ManifestoWorld doesn't have subscribe
  const eventHandlers: WorldEventHandler[] = [];
  if (config.onEvent) {
    eventHandlers.push(config.onEvent);
  }

  // Helper to save tasks after operations
  const saveTasks = async (snapshot: Snapshot | null) => {
    if (snapshot) {
      const data = snapshot.data as { tasks?: unknown[] } | undefined;
      const tasks = data?.tasks;
      if (Array.isArray(tasks)) {
        await persistence.saveTasks(tasks as Task[]);
      }
    }
  };

  // Track genesis state
  let genesisCreated = false;

  return {
    world,
    host,
    userActor,
    systemActor,

    subscribe: (handler: WorldEventHandler) => {
      eventHandlers.push(handler);
      return () => {
        const index = eventHandlers.indexOf(handler);
        if (index !== -1) {
          eventHandlers.splice(index, 1);
        }
      };
    },

    getSnapshot: async () => {
      const genesis = await world.getGenesis();
      if (genesis) {
        return world.getSnapshot(genesis.worldId);
      }
      return null;
    },

    initialize: async () => {
      if (genesisCreated) {
        return;
      }

      // Get initial snapshot from host
      const snapshot = await host.getSnapshot();
      if (!snapshot) {
        throw new Error("Host snapshot not available");
      }

      // Create genesis world
      await world.createGenesis(snapshot);
      genesisCreated = true;
    },

    registerAssistant: (sessionId: string) => {
      const assistantActor = createAssistantActor(sessionId);
      const assistantBinding = createAgentBinding(assistantActor);
      world.registerActor(assistantBinding.actor, assistantBinding.policy);
      return assistantActor;
    },
  };
}

/**
 * Re-export for convenience
 */
export { TasksDomain, initialSnapshot } from "../domain";
export type { Task, Filter, ViewMode } from "../domain";
