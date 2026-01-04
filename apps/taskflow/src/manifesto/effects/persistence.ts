/**
 * Persistence Effect Handlers
 *
 * Implements Host effect handlers for persistence operations.
 * TaskFlow uses localStorage for client-side persistence.
 *
 * Note: These are NOT declared in MEL (MEL only supports built-in effects).
 * They are used by the Host to persist state after successful execution.
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { Task } from "../../domain/index";

const STORAGE_KEY = "taskflow:tasks";

/**
 * Persistence interface for TaskFlow
 */
export interface TaskFlowPersistence {
  /**
   * Save tasks to storage
   */
  saveTasks(tasks: Task[]): Promise<void>;

  /**
   * Load tasks from storage
   */
  loadTasks(): Promise<Task[]>;

  /**
   * Clear all stored tasks
   */
  clearTasks(): Promise<void>;
}

/**
 * localStorage-based persistence
 */
export class LocalStoragePersistence implements TaskFlowPersistence {
  private storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks to localStorage:", error);
    }
  }

  async loadTasks(): Promise<Task[]> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored) as Task[];
      }
    } catch (error) {
      console.error("Failed to load tasks from localStorage:", error);
    }
    return [];
  }

  async clearTasks(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error("Failed to clear tasks from localStorage:", error);
    }
  }
}

/**
 * In-memory persistence (for testing)
 */
export class MemoryPersistence implements TaskFlowPersistence {
  private tasks: Task[] = [];

  async saveTasks(tasks: Task[]): Promise<void> {
    this.tasks = [...tasks];
  }

  async loadTasks(): Promise<Task[]> {
    return [...this.tasks];
  }

  async clearTasks(): Promise<void> {
    this.tasks = [];
  }
}

/**
 * Create a persistence observer that saves state on changes
 *
 * This should be connected to World events to persist after execution
 */
export function createPersistenceObserver(persistence: TaskFlowPersistence) {
  return {
    onSnapshotChanged: async (snapshot: Snapshot) => {
      const data = snapshot.data as { tasks?: Task[] } | undefined;
      const tasks = data?.tasks;
      if (tasks) {
        await persistence.saveTasks(tasks);
      }
    },
  };
}

/**
 * Default persistence instance
 */
export const defaultPersistence = new LocalStoragePersistence();
