/**
 * Deterministic Runtime for HCTS
 *
 * Provides a controllable time/task execution environment for deterministic
 * testing of race conditions and timing-sensitive SPEC rules.
 *
 * Key capabilities:
 * - Deterministic microtask/macrotask scheduling
 * - Controlled time advancement
 * - Explicit queue draining
 *
 * @see SPEC §10 (Execution Model)
 * @see SPEC §11 (Context Determinism)
 */

/**
 * Deterministic runtime interface for HCTS testing
 */
export interface DeterministicRuntime {
  /**
   * Schedule a function to run as a microtask (like queueMicrotask)
   */
  microtask(fn: () => void): void;

  /**
   * Schedule a function to run as a macrotask (like setTimeout)
   * @returns Task ID for cancellation
   */
  macrotask(fn: () => void, delayMs?: number): number;

  /**
   * Cancel a scheduled macrotask
   */
  cancelMacrotask(taskId: number): void;

  /**
   * Get current virtual time
   */
  now(): number;

  /**
   * Yield control (simulates async yield between jobs)
   */
  yield(): Promise<void>;

  // Test control methods

  /**
   * Advance virtual time by the specified amount
   */
  advanceTime(ms: number): void;

  /**
   * Run all pending microtasks synchronously
   */
  runAllMicrotasks(): void;

  /**
   * Run the next scheduled macrotask
   * @returns true if a task was run, false if queue is empty
   */
  runNextMacrotask(): boolean;

  /**
   * Run all pending tasks until idle
   */
  runUntilIdle(): Promise<void>;

  /**
   * Run tasks until the given condition is true
   */
  runUntil(condition: () => boolean): Promise<void>;

  /**
   * Get count of pending microtasks
   */
  pendingMicrotaskCount(): number;

  /**
   * Get count of pending macrotasks
   */
  pendingMacrotaskCount(): number;

  /**
   * Reset runtime to initial state
   */
  reset(): void;
}

interface ScheduledTask {
  id: number;
  fn: () => void;
  runAt: number;
}

/**
 * Default implementation of DeterministicRuntime
 */
export class TestRuntime implements DeterministicRuntime {
  private _now: number = 0;
  private _microtasks: Array<() => void> = [];
  private _macrotasks: ScheduledTask[] = [];
  private _nextTaskId: number = 1;

  microtask(fn: () => void): void {
    this._microtasks.push(fn);
  }

  macrotask(fn: () => void, delayMs: number = 0): number {
    const id = this._nextTaskId++;
    const task: ScheduledTask = {
      id,
      fn,
      runAt: this._now + delayMs,
    };

    // Insert in sorted order by runAt
    const insertIndex = this._macrotasks.findIndex((t) => t.runAt > task.runAt);
    if (insertIndex === -1) {
      this._macrotasks.push(task);
    } else {
      this._macrotasks.splice(insertIndex, 0, task);
    }

    return id;
  }

  cancelMacrotask(taskId: number): void {
    const index = this._macrotasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      this._macrotasks.splice(index, 1);
    }
  }

  now(): number {
    return this._now;
  }

  yield(): Promise<void> {
    // Use JavaScript's native Promise for yields so await actually works.
    // This allows the await to complete immediately while still giving
    // other code a chance to run (await always yields to microtask queue).
    // The TestRuntime's microtask queue is for explicit scheduling control,
    // not for blocking awaits.
    return Promise.resolve();
  }

  advanceTime(ms: number): void {
    if (ms < 0) {
      throw new Error("Cannot advance time by negative amount");
    }
    this._now += ms;
  }

  runAllMicrotasks(): void {
    while (this._microtasks.length > 0) {
      const task = this._microtasks.shift()!;
      task();
    }
  }

  runNextMacrotask(): boolean {
    // First, run all pending microtasks
    this.runAllMicrotasks();

    // Find the next task that can run
    const index = this._macrotasks.findIndex((t) => t.runAt <= this._now);
    if (index === -1) {
      return false;
    }

    const task = this._macrotasks.splice(index, 1)[0];
    task.fn();

    // Run any microtasks triggered by the macrotask
    this.runAllMicrotasks();

    return true;
  }

  async runUntilIdle(): Promise<void> {
    // Run all microtasks first
    this.runAllMicrotasks();

    // Run macrotasks in order, advancing time as needed
    while (this._macrotasks.length > 0) {
      const nextTask = this._macrotasks[0];

      // Advance time to when the next task should run
      if (nextTask.runAt > this._now) {
        this._now = nextTask.runAt;
      }

      this.runNextMacrotask();
    }
  }

  async runUntil(condition: () => boolean): Promise<void> {
    const maxIterations = 10000;
    let iterations = 0;

    while (!condition() && iterations < maxIterations) {
      iterations++;

      // Run microtasks
      this.runAllMicrotasks();

      if (condition()) break;

      // Try to run a macrotask
      if (this._macrotasks.length > 0) {
        const nextTask = this._macrotasks[0];

        // Advance time if needed
        if (nextTask.runAt > this._now) {
          this._now = nextTask.runAt;
        }

        this.runNextMacrotask();
      } else {
        // No more tasks and condition not met
        break;
      }
    }

    if (iterations >= maxIterations) {
      throw new Error("runUntil exceeded maximum iterations");
    }
  }

  pendingMicrotaskCount(): number {
    return this._microtasks.length;
  }

  pendingMacrotaskCount(): number {
    return this._macrotasks.length;
  }

  reset(): void {
    this._now = 0;
    this._microtasks = [];
    this._macrotasks = [];
    this._nextTaskId = 1;
  }
}

/**
 * Create a new test runtime instance
 */
export function createTestRuntime(): DeterministicRuntime {
  return new TestRuntime();
}

/**
 * Create a runtime that wraps the real event loop (for integration tests)
 */
export function createRealRuntime(): DeterministicRuntime {
  let virtualTime = Date.now();

  return {
    microtask(fn: () => void): void {
      queueMicrotask(fn);
    },

    macrotask(fn: () => void, delayMs: number = 0): number {
      return setTimeout(fn, delayMs) as unknown as number;
    },

    cancelMacrotask(taskId: number): void {
      clearTimeout(taskId);
    },

    now(): number {
      return Date.now();
    },

    yield(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 0));
    },

    advanceTime(ms: number): void {
      virtualTime += ms;
      // Real runtime cannot actually advance time
    },

    runAllMicrotasks(): void {
      // Cannot control real event loop
    },

    runNextMacrotask(): boolean {
      // Cannot control real event loop
      return false;
    },

    async runUntilIdle(): Promise<void> {
      // Give real event loop time to process
      await new Promise((resolve) => setTimeout(resolve, 10));
    },

    async runUntil(condition: () => boolean): Promise<void> {
      const startTime = Date.now();
      const timeout = 5000;

      while (!condition() && Date.now() - startTime < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    },

    pendingMicrotaskCount(): number {
      return 0; // Cannot determine for real event loop
    },

    pendingMacrotaskCount(): number {
      return 0; // Cannot determine for real event loop
    },

    reset(): void {
      virtualTime = Date.now();
    },
  };
}
