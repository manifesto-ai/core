/**
 * Fulfilled result - operation succeeded
 */
export type Fulfilled<T> = {
    readonly status: "fulfilled";
    readonly value: T;
};
/**
 * Rejected result - operation failed
 */
export type Rejected = {
    readonly status: "rejected";
    readonly reason: Error;
};
/**
 * Settled - outcome of an async operation (mirrors PromiseSettledResult)
 */
export type Settled<T> = Fulfilled<T> | Rejected;
/**
 * Type guard for Fulfilled
 */
export declare function isFulfilled<T>(result: Settled<T>): result is Fulfilled<T>;
/**
 * Type guard for Rejected
 */
export declare function isRejected<T>(result: Settled<T>): result is Rejected;
//# sourceMappingURL=settled.d.ts.map