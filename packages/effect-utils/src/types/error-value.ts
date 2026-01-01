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
export function isErrorValue(value: unknown): value is ErrorValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "$error" in value &&
    (value as ErrorValue).$error === true
  );
}
