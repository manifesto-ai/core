/**
 * Job Queue Edge Case Tests
 *
 * Comprehensive edge case testing for the JobQueue implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JobQueue } from "../hooks/queue.js";

describe("JobQueue Edge Cases", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ===========================================================================
  // Concurrent Processing
  // ===========================================================================

  describe("Concurrent Processing", () => {
    it("should handle multiple processAll() calls - only one processes", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];
      let processingCount = 0;

      queue.enqueue(async () => {
        processingCount++;
        await new Promise((r) => setTimeout(r, 50));
        executed.push(1);
        processingCount--;
      });

      // Call processAll multiple times concurrently
      const p1 = queue.processAll();
      const p2 = queue.processAll();
      const p3 = queue.processAll();

      await Promise.all([p1, p2, p3]);

      // Job should only execute once
      expect(executed).toEqual([1]);
    });

    it("should not start new processing while already processing", async () => {
      const queue = new JobQueue();
      const logs: string[] = [];

      queue.enqueue(async () => {
        logs.push("job-start");
        await new Promise((r) => setTimeout(r, 20));
        logs.push("job-end");
      });

      const p1 = queue.processAll();

      // Try to process again while first is running
      await new Promise((r) => setTimeout(r, 5));
      const p2 = queue.processAll();

      await Promise.all([p1, p2]);

      // Should only have one job execution
      expect(logs).toEqual(["job-start", "job-end"]);
    });
  });

  // ===========================================================================
  // Empty and Single Item
  // ===========================================================================

  describe("Empty and Single Item", () => {
    it("should handle empty queue gracefully", async () => {
      const queue = new JobQueue();

      // Should not throw
      await queue.processAll();

      expect(queue.pendingCount()).toBe(0);
    });

    it("should handle single job", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1));
      await queue.processAll();

      expect(executed).toEqual([1]);
    });

    it("should handle processAll on already empty queue multiple times", async () => {
      const queue = new JobQueue();

      await queue.processAll();
      await queue.processAll();
      await queue.processAll();

      expect(queue.pendingCount()).toBe(0);
    });
  });

  // ===========================================================================
  // Re-entrancy
  // ===========================================================================

  describe("Re-entrancy", () => {
    it("should handle job that enqueues more jobs", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => {
        executed.push(1);
        queue.enqueue(() => executed.push(2));
        queue.enqueue(() => executed.push(3));
      });

      await queue.processAll();

      expect(executed).toEqual([1, 2, 3]);
    });

    it("should handle deeply nested job enqueueing", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];
      const depth = 10;

      const createNestedJob = (level: number) => () => {
        executed.push(level);
        if (level < depth) {
          queue.enqueue(createNestedJob(level + 1));
        }
      };

      queue.enqueue(createNestedJob(1));
      await queue.processAll();

      expect(executed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("should handle job that enqueues with different priorities during processing", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => {
        executed.push("first-normal");
        queue.enqueue(() => executed.push("nested-immediate"), { priority: "immediate" });
        queue.enqueue(() => executed.push("nested-defer"), { priority: "defer" });
        queue.enqueue(() => executed.push("nested-normal"), { priority: "normal" });
      });

      await queue.processAll();

      // After first-normal completes, the new jobs should process in priority order
      expect(executed).toEqual([
        "first-normal",
        "nested-immediate",
        "nested-normal",
        "nested-defer",
      ]);
    });

    it("should prevent infinite loops with reasonable limits", async () => {
      const queue = new JobQueue();
      let count = 0;
      const maxIterations = 100;

      queue.enqueue(function selfEnqueue() {
        count++;
        if (count < maxIterations) {
          queue.enqueue(selfEnqueue);
        }
      });

      await queue.processAll();

      // Should complete without hanging
      expect(count).toBe(maxIterations);
    });
  });

  // ===========================================================================
  // Async Job Edge Cases
  // ===========================================================================

  describe("Async Job Edge Cases", () => {
    it("should handle mix of sync and async jobs", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => executed.push("sync-1"));
      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 10));
        executed.push("async-1");
      });
      queue.enqueue(() => executed.push("sync-2"));
      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 5));
        executed.push("async-2");
      });

      await queue.processAll();

      // Should execute in order, waiting for each async job
      expect(executed).toEqual(["sync-1", "async-1", "sync-2", "async-2"]);
    });

    it("should handle async job that rejects", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1));
      queue.enqueue(async () => {
        await new Promise((_, reject) => setTimeout(() => reject(new Error("async error")), 5));
      });
      queue.enqueue(() => executed.push(3));

      await queue.processAll();

      expect(executed).toEqual([1, 3]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle async job that throws synchronously", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1));
      queue.enqueue(async () => {
        throw new Error("sync throw in async");
      });
      queue.enqueue(() => executed.push(3));

      await queue.processAll();

      expect(executed).toEqual([1, 3]);
    });

    it("should handle very slow async job", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 100));
        executed.push("slow");
      });
      queue.enqueue(() => executed.push("fast"));

      await queue.processAll();

      expect(executed).toEqual(["slow", "fast"]);
    }, 500);
  });

  // ===========================================================================
  // Error Handling Edge Cases
  // ===========================================================================

  describe("Error Handling Edge Cases", () => {
    it("should handle multiple consecutive errors", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => { throw new Error("error 1"); });
      queue.enqueue(() => { throw new Error("error 2"); });
      queue.enqueue(() => { throw new Error("error 3"); });
      queue.enqueue(() => executed.push(4));

      await queue.processAll();

      expect(executed).toEqual([4]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it("should handle error in first job", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => { throw new Error("first error"); });
      queue.enqueue(() => executed.push(2));
      queue.enqueue(() => executed.push(3));

      await queue.processAll();

      expect(executed).toEqual([2, 3]);
    });

    it("should handle error in last job", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1));
      queue.enqueue(() => executed.push(2));
      queue.enqueue(() => { throw new Error("last error"); });

      await queue.processAll();

      expect(executed).toEqual([1, 2]);
    });

    it("should handle error in immediate job without affecting normal jobs", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => executed.push("normal-1"), { priority: "normal" });
      queue.enqueue(() => { throw new Error("immediate error"); }, { priority: "immediate" });
      queue.enqueue(() => executed.push("normal-2"), { priority: "normal" });

      await queue.processAll();

      expect(executed).toEqual(["normal-1", "normal-2"]);
    });

    it("should include label in error log when provided", async () => {
      const queue = new JobQueue();

      queue.enqueue(() => { throw new Error("labeled error"); }, { label: "my-job" });

      await queue.processAll();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("my-job"),
        expect.any(Error)
      );
    });
  });

  // ===========================================================================
  // Priority Edge Cases
  // ===========================================================================

  describe("Priority Edge Cases", () => {
    it("should handle only immediate jobs", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      for (let i = 1; i <= 5; i++) {
        queue.enqueue(() => executed.push(i), { priority: "immediate" });
      }

      await queue.processAll();

      expect(executed).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle only deferred jobs", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      for (let i = 1; i <= 5; i++) {
        queue.enqueue(() => executed.push(i), { priority: "defer" });
      }

      await queue.processAll();

      expect(executed).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle immediate job added during normal job processing", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => {
        executed.push("normal-1");
        queue.enqueue(() => executed.push("immediate-added"), { priority: "immediate" });
      }, { priority: "normal" });
      queue.enqueue(() => executed.push("normal-2"), { priority: "normal" });

      await queue.processAll();

      // After normal-1, immediate-added should run before normal-2
      expect(executed).toEqual(["normal-1", "immediate-added", "normal-2"]);
    });

    it("should handle deferred job added during immediate job processing", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => {
        executed.push("immediate-1");
        queue.enqueue(() => executed.push("defer-added"), { priority: "defer" });
      }, { priority: "immediate" });
      queue.enqueue(() => executed.push("normal-1"), { priority: "normal" });

      await queue.processAll();

      expect(executed).toEqual(["immediate-1", "normal-1", "defer-added"]);
    });

    it("should handle complex priority interleaving", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      // Initial batch
      queue.enqueue(() => executed.push("defer-1"), { priority: "defer" });
      queue.enqueue(() => executed.push("normal-1"), { priority: "normal" });
      queue.enqueue(() => {
        executed.push("immediate-1");
        // Add more during processing
        queue.enqueue(() => executed.push("defer-2"), { priority: "defer" });
        queue.enqueue(() => executed.push("immediate-2"), { priority: "immediate" });
      }, { priority: "immediate" });

      await queue.processAll();

      expect(executed).toEqual([
        "immediate-1",
        "immediate-2",
        "normal-1",
        "defer-1",
        "defer-2",
      ]);
    });
  });

  // ===========================================================================
  // State Consistency
  // ===========================================================================

  describe("State Consistency", () => {
    it("should report correct pendingCount during processing", async () => {
      const queue = new JobQueue();
      const counts: number[] = [];

      queue.enqueue(() => counts.push(queue.pendingCount()));
      queue.enqueue(() => counts.push(queue.pendingCount()));
      queue.enqueue(() => counts.push(queue.pendingCount()));

      expect(queue.pendingCount()).toBe(3);
      await queue.processAll();

      // Each job sees decreasing count (job is removed before execution)
      expect(counts).toEqual([2, 1, 0]);
    });

    it("should report correct hasPendingJobs during processing", async () => {
      const queue = new JobQueue();
      const states: boolean[] = [];

      queue.enqueue(() => states.push(queue.hasPendingJobs()));
      queue.enqueue(() => states.push(queue.hasPendingJobs()));

      await queue.processAll();

      expect(states).toEqual([true, false]);
    });

    it("should handle clear() called before processing", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1));
      queue.enqueue(() => executed.push(2));

      queue.clear();

      await queue.processAll();

      expect(executed).toEqual([]);
    });

    it("should handle clear() called during processing", async () => {
      const queue = new JobQueue();
      const executed: string[] = [];

      queue.enqueue(() => {
        executed.push("first");
        queue.clear(); // Clear remaining jobs
      });
      queue.enqueue(() => executed.push("second"));
      queue.enqueue(() => executed.push("third"));

      await queue.processAll();

      // Only first should execute, clear() removes the rest
      expect(executed).toEqual(["first"]);
    });
  });

  // ===========================================================================
  // Scheduling Edge Cases
  // ===========================================================================

  describe("Scheduling Edge Cases", () => {
    it("should batch multiple enqueues before microtask", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      // All these should be batched
      queue.enqueue(() => executed.push(1));
      queue.enqueue(() => executed.push(2));
      queue.enqueue(() => executed.push(3));

      // Wait for auto-processing
      await new Promise((r) => setTimeout(r, 10));

      expect(executed).toEqual([1, 2, 3]);
    });

    it("should handle enqueue after auto-processing started", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(async () => {
        executed.push(1);
        await new Promise((r) => setTimeout(r, 10));
      });

      // Wait a bit, then enqueue more
      await new Promise((r) => setTimeout(r, 5));
      queue.enqueue(() => executed.push(2));

      // Wait for all to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(executed).toEqual([1, 2]);
    });

    it("should handle rapid enqueue/process cycles", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      for (let i = 0; i < 10; i++) {
        queue.enqueue(() => executed.push(i));
        if (i % 3 === 0) {
          await queue.processAll();
        }
      }

      await queue.processAll();

      expect(executed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  // ===========================================================================
  // Large Scale
  // ===========================================================================

  describe("Large Scale", () => {
    it("should handle large number of jobs", async () => {
      const queue = new JobQueue();
      const count = 1000;
      let executed = 0;

      for (let i = 0; i < count; i++) {
        queue.enqueue(() => executed++);
      }

      await queue.processAll();

      expect(executed).toBe(count);
    });

    it("should handle large number of jobs with mixed priorities", async () => {
      const queue = new JobQueue();
      const results: string[] = [];
      const count = 100;

      for (let i = 0; i < count; i++) {
        const priority = i % 3 === 0 ? "immediate" : i % 3 === 1 ? "normal" : "defer";
        queue.enqueue(() => results.push(`${priority}-${i}`), { priority });
      }

      await queue.processAll();

      // Verify all executed
      expect(results.length).toBe(count);

      // Verify priority order (all immediates before normals before defers)
      const immediates = results.filter((r) => r.startsWith("immediate"));
      const normals = results.filter((r) => r.startsWith("normal"));
      const defers = results.filter((r) => r.startsWith("defer"));

      const firstNormalIndex = results.findIndex((r) => r.startsWith("normal"));
      const firstDeferIndex = results.findIndex((r) => r.startsWith("defer"));
      const lastImmediateIndex = results.map((r, i) => r.startsWith("immediate") ? i : -1).filter((i) => i >= 0).pop() ?? -1;
      const lastNormalIndex = results.map((r, i) => r.startsWith("normal") ? i : -1).filter((i) => i >= 0).pop() ?? -1;

      expect(lastImmediateIndex).toBeLessThan(firstNormalIndex);
      expect(lastNormalIndex).toBeLessThan(firstDeferIndex);
    });
  });

  // ===========================================================================
  // Edge Cases with undefined/null
  // ===========================================================================

  describe("undefined/null handling", () => {
    it("should handle job returning undefined", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => { executed.push(1); return undefined; });
      queue.enqueue(() => { executed.push(2); });

      await queue.processAll();

      expect(executed).toEqual([1, 2]);
    });

    it("should handle job returning null", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => { executed.push(1); return null as unknown as void; });
      queue.enqueue(() => { executed.push(2); });

      await queue.processAll();

      expect(executed).toEqual([1, 2]);
    });

    it("should handle undefined priority option", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => executed.push(1), { priority: undefined });
      queue.enqueue(() => executed.push(2), {});
      queue.enqueue(() => executed.push(3));

      await queue.processAll();

      expect(executed).toEqual([1, 2, 3]);
    });
  });

  // ===========================================================================
  // Promise-like returns
  // ===========================================================================

  describe("Promise-like returns", () => {
    it("should handle thenable return values", async () => {
      const queue = new JobQueue();
      const executed: number[] = [];

      queue.enqueue(() => {
        executed.push(1);
        return {
          then: (resolve: () => void) => {
            setTimeout(() => {
              executed.push(2);
              resolve();
            }, 10);
          },
        } as Promise<void>;
      });
      queue.enqueue(() => executed.push(3));

      await queue.processAll();

      expect(executed).toEqual([1, 2, 3]);
    });
  });
});
