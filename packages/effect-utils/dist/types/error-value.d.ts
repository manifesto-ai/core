/**
 * ErrorValue - structured error for patches
 * Aligns with Core's error model but adds $error marker
 */
export type ErrorValue = {
    readonly $error: true;
    readonly code: string;
    readonly message: string;
    readonly stack?: string;
    readonly timestamp: number;
    readonly context?: {
        readonly effectType?: string;
        readonly attempt?: number;
        readonly timeout?: number;
    };
};
/**
 * Type guard for ErrorValue
 */
export declare function isErrorValue(value: unknown): value is ErrorValue;
//# sourceMappingURL=error-value.d.ts.map