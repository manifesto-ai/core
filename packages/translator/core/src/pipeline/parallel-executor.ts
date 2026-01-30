/**
 * @fileoverview ParallelExecutor (SPEC Section 7.2)
 *
 * Parallel execution with concurrency control.
 *
 * Per SPEC Section 11.7 (PEX-*):
 * - PEX-1: Results MUST be in input order
 * - PEX-2: graphs[i] corresponds to chunks[i]
 * - PEX-3: Results SHALL NOT be returned in completion (arrival) order
 *
 * @module pipeline/parallel-executor
 */

// =============================================================================
// ParallelExecutorOptions
// =============================================================================

/**
 * Options for ParallelExecutor.
 */
export interface ParallelExecutorOptions {
  /** Maximum concurrent executions */
  concurrency: number;

  /** Timeout per item (ms) */
  timeout?: number;

  /** Error handling policy */
  onError?: "fail-fast" | "best-effort";
}

// =============================================================================
// ParallelExecutor
// =============================================================================

/**
 * Parallel execution with concurrency control.
 *
 * Per SPEC Section 7.2:
 * CRITICAL: Results MUST be in input order (PEX-1).
 *
 * @typeParam TIn - Input type
 * @typeParam TOut - Output type
 */
export class ParallelExecutor<TIn, TOut> {
  private readonly concurrency: number;
  private readonly timeout?: number;
  private readonly onError: "fail-fast" | "best-effort";

  constructor(options: ParallelExecutorOptions) {
    this.concurrency = options.concurrency;
    this.timeout = options.timeout;
    this.onError = options.onError ?? "fail-fast";
  }

  /**
   * Execute function on inputs with concurrency control.
   *
   * CRITICAL: Results MUST be in input order (PEX-1).
   *
   * @param inputs - Input array
   * @param fn - Async function to execute
   * @returns Results in same order as inputs
   * @throws Error if fail-fast and any execution fails
   */
  async execute(
    inputs: TIn[],
    fn: (input: TIn, index: number) => Promise<TOut>
  ): Promise<TOut[]> {
    if (inputs.length === 0) {
      return [];
    }

    // For low item counts or concurrency >= items, use simple Promise.all
    if (this.concurrency >= inputs.length) {
      return this.executeAll(inputs, fn);
    }

    // For higher concurrency limits, use batched execution
    return this.executeBatched(inputs, fn);
  }

  /**
   * Execute all items using Promise.all.
   * PEX-1 is guaranteed because Promise.all preserves order.
   */
  private async executeAll(
    inputs: TIn[],
    fn: (input: TIn, index: number) => Promise<TOut>
  ): Promise<TOut[]> {
    const promises = inputs.map((input, index) =>
      this.wrapWithTimeout(fn(input, index), index)
    );

    if (this.onError === "fail-fast") {
      return Promise.all(promises);
    }

    // Best-effort: collect all results, throw only if all fail
    const results = await Promise.allSettled(promises);
    const outputs: TOut[] = [];
    const errors: Array<{ index: number; error: unknown }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        outputs[i] = result.value;
      } else {
        errors.push({ index: i, error: result.reason });
        // In best-effort mode, we need to provide something for failed items
        // This is typically handled by the caller by checking for undefined
        outputs[i] = undefined as TOut;
      }
    }

    // If all failed, throw
    if (errors.length === inputs.length) {
      throw new Error(
        `All ${inputs.length} items failed. First error: ${String(errors[0]?.error)}`
      );
    }

    return outputs;
  }

  /**
   * Execute with batched concurrency control.
   * PEX-1 is guaranteed by tracking indices.
   */
  private async executeBatched(
    inputs: TIn[],
    fn: (input: TIn, index: number) => Promise<TOut>
  ): Promise<TOut[]> {
    const results: TOut[] = new Array(inputs.length);
    const errors: Array<{ index: number; error: unknown }> = [];
    let currentIndex = 0;
    let activeCount = 0;

    return new Promise((resolve, reject) => {
      const startNext = (): void => {
        while (activeCount < this.concurrency && currentIndex < inputs.length) {
          const index = currentIndex++;
          activeCount++;

          this.wrapWithTimeout(fn(inputs[index], index), index)
            .then((result) => {
              // PEX-1: Store at original index position
              results[index] = result;
              activeCount--;
              checkComplete();
              startNext();
            })
            .catch((error) => {
              activeCount--;
              if (this.onError === "fail-fast") {
                reject(error);
                return;
              }
              // Best-effort: track error and continue
              errors.push({ index, error });
              results[index] = undefined as TOut;
              checkComplete();
              startNext();
            });
        }
      };

      const checkComplete = (): void => {
        if (currentIndex >= inputs.length && activeCount === 0) {
          // All done
          if (errors.length === inputs.length) {
            reject(
              new Error(
                `All ${inputs.length} items failed. First error: ${String(errors[0]?.error)}`
              )
            );
          } else {
            resolve(results);
          }
        }
      };

      startNext();
    });
  }

  /**
   * Wrap promise with timeout if configured.
   */
  private async wrapWithTimeout(
    promise: Promise<TOut>,
    index: number
  ): Promise<TOut> {
    if (!this.timeout) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<TOut>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout after ${this.timeout}ms for item ${index}`));
        }, this.timeout);
      }),
    ]);
  }
}

/**
 * Create a ParallelExecutor with default options.
 */
export function createParallelExecutor<TIn, TOut>(
  options?: Partial<ParallelExecutorOptions>
): ParallelExecutor<TIn, TOut> {
  return new ParallelExecutor({
    concurrency: options?.concurrency ?? 5,
    timeout: options?.timeout,
    onError: options?.onError ?? "fail-fast",
  });
}
