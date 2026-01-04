import type { Patch } from "@manifesto-ai/core";
/**
 * Create an error patch
 *
 * @example
 * ```ts
 * toErrorPatch('data.error', new Error('Network failed'));
 * // → {
 * //   op: 'set',
 * //   path: 'data.error',
 * //   value: {
 * //     $error: true,
 * //     code: 'Error',
 * //     message: 'Network failed',
 * //     stack: '...',
 * //     timestamp: 1234567890
 * //   }
 * // }
 * ```
 */
export declare function toErrorPatch(path: string, error: Error | {
    code: string;
    message: string;
}): Patch;
/**
 * Create standard error patches for system.lastError and optional custom path
 *
 * @example
 * ```ts
 * toErrorPatches(new Error('Failed'), 'data.loadError');
 * // → [
 * //   { op: 'set', path: 'system.lastError', value: { $error: true, ... } },
 * //   { op: 'set', path: 'data.loadError', value: { $error: true, ... } },
 * // ]
 * ```
 */
export declare function toErrorPatches(error: Error, customPath?: string): Patch[];
//# sourceMappingURL=error.d.ts.map