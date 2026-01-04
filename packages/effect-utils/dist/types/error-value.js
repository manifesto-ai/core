/**
 * Type guard for ErrorValue
 */
export function isErrorValue(value) {
    return (typeof value === "object" &&
        value !== null &&
        "$error" in value &&
        value.$error === true);
}
//# sourceMappingURL=error-value.js.map