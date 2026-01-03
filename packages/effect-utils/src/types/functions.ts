/**
 * Zero-argument async function
 */
export type AsyncFn<T> = () => Promise<T>;

/**
 * Async function with arguments
 */
export type AsyncFnWithArgs<TArgs extends unknown[], TReturn> = (
  ...args: TArgs
) => Promise<TReturn>;
