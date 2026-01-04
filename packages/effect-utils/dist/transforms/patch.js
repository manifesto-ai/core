export function toPatch(path, value, op = "set") {
    if (op === "unset") {
        return { op: "unset", path };
    }
    if (op === "merge") {
        return { op: "merge", path, value: value };
    }
    return { op: "set", path, value };
}
/**
 * Create multiple patches from a path-value mapping
 *
 * @example
 * ```ts
 * toPatches({
 *   'data.user': userData,
 *   'data.loadedAt': Date.now(),
 *   'data.status': 'ready',
 * });
 * // → [
 * //   { op: 'set', path: 'data.user', value: userData },
 * //   { op: 'set', path: 'data.loadedAt', value: 1234567890 },
 * //   { op: 'set', path: 'data.status', value: 'ready' },
 * // ]
 * ```
 */
export function toPatches(mappings, op = "set") {
    return Object.entries(mappings).map(([path, value]) => {
        if (op === "merge") {
            return { op: "merge", path, value: value };
        }
        return { op: "set", path, value };
    });
}
//# sourceMappingURL=patch.js.map