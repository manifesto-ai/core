/**
 * Error Formatter
 *
 * Utilities for formatting errors for GraphQL responses.
 */

import { GraphQLError } from 'graphql';

import type { ErrorFormattingOptions, ValidationResultResponse } from '../types.js';

// =============================================================================
// Error Codes
// =============================================================================

/**
 * Standard error codes for GraphQL responses.
 */
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  TYPE_MISMATCH: 'TYPE_MISMATCH',

  // Action errors
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  ACTION_NOT_FOUND: 'ACTION_NOT_FOUND',
  ACTION_BLOCKED: 'ACTION_BLOCKED',
  EFFECT_ERROR: 'EFFECT_ERROR',

  // Field errors
  FIELD_NOT_FOUND: 'FIELD_NOT_FOUND',
  FIELD_NOT_EDITABLE: 'FIELD_NOT_EDITABLE',
  FIELD_READ_ONLY: 'FIELD_READ_ONLY',

  // Authentication/Authorization
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format a validation result into GraphQL errors.
 */
export function formatValidationResult(
  result: ValidationResultResponse,
  options: ErrorFormattingOptions = {}
): GraphQLError[] {
  if (result.valid) {
    return [];
  }

  return result.issues.map((issue) => formatValidationIssue(issue, options));
}

/**
 * Format a single validation issue into a GraphQL error.
 */
export function formatValidationIssue(
  issue: { code: string; message: string; path: string; severity: string },
  options: ErrorFormattingOptions = {}
): GraphQLError {
  const { includePath = true, codeMapping = {} } = options;

  const code = codeMapping[issue.code] ?? issue.code;
  const message = includePath
    ? `${issue.path}: ${issue.message}`
    : issue.message;

  return new GraphQLError(message, {
    extensions: {
      code,
      path: issue.path,
      severity: issue.severity,
    },
  });
}

/**
 * Format an error into a GraphQL error.
 */
export function formatError(
  error: unknown,
  options: ErrorFormattingOptions = {}
): GraphQLError {
  const { includeStackTrace = false } = options;

  if (error instanceof GraphQLError) {
    return error;
  }

  if (error instanceof Error) {
    const extensions: Record<string, unknown> = {
      code: ErrorCodes.INTERNAL_ERROR,
    };

    if (includeStackTrace && error.stack) {
      extensions.stackTrace = error.stack;
    }

    return new GraphQLError(error.message, { extensions });
  }

  return new GraphQLError(String(error), {
    extensions: { code: ErrorCodes.INTERNAL_ERROR },
  });
}

/**
 * Format multiple errors into GraphQL errors.
 */
export function formatErrors(
  errors: unknown[],
  options: ErrorFormattingOptions = {}
): GraphQLError[] {
  return errors.map((error) => formatError(error, options));
}

// =============================================================================
// Error Creation Helpers
// =============================================================================

/**
 * Create a validation error.
 */
export function createValidationError(
  message: string,
  path?: string,
  code: string = ErrorCodes.VALIDATION_ERROR
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      path,
      severity: 'error',
    },
  });
}

/**
 * Create a required field error.
 */
export function createRequiredFieldError(
  fieldName: string,
  path?: string
): GraphQLError {
  return new GraphQLError(`${fieldName} is required`, {
    extensions: {
      code: ErrorCodes.REQUIRED_FIELD,
      path,
      severity: 'error',
    },
  });
}

/**
 * Create a precondition failed error.
 */
export function createPreconditionError(
  message: string,
  actionId?: string
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.PRECONDITION_FAILED,
      actionId,
    },
  });
}

/**
 * Create a field not found error.
 */
export function createFieldNotFoundError(path: string): GraphQLError {
  return new GraphQLError(`Field not found: ${path}`, {
    extensions: {
      code: ErrorCodes.FIELD_NOT_FOUND,
      path,
    },
  });
}

/**
 * Create a field not editable error.
 */
export function createFieldNotEditableError(
  path: string,
  reason?: string
): GraphQLError {
  const message = reason
    ? `Field ${path} is not editable: ${reason}`
    : `Field ${path} is not editable`;

  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.FIELD_NOT_EDITABLE,
      path,
    },
  });
}

/**
 * Create an authentication error.
 */
export function createAuthenticationError(message: string = 'Not authenticated'): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.UNAUTHENTICATED,
    },
  });
}

/**
 * Create an authorization error.
 */
export function createAuthorizationError(message: string = 'Not authorized'): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.UNAUTHORIZED,
    },
  });
}

/**
 * Create an internal error.
 */
export function createInternalError(
  message: string = 'Internal server error',
  originalError?: Error
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.INTERNAL_ERROR,
    },
    originalError: originalError ?? undefined,
  });
}

// =============================================================================
// Error Response Helpers
// =============================================================================

/**
 * Create an error response object.
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  path?: string
): { code: string; message: string; path?: string } {
  const response: { code: string; message: string; path?: string } = {
    code,
    message,
  };

  if (path) {
    response.path = path;
  }

  return response;
}

/**
 * Create multiple error responses.
 */
export function createErrorResponses(
  errors: Array<{ code: ErrorCode; message: string; path?: string }>
): Array<{ code: string; message: string; path?: string }> {
  return errors.map((error) => createErrorResponse(error.code, error.message, error.path));
}

// =============================================================================
// Error Aggregation
// =============================================================================

/**
 * Aggregate multiple errors into a single error.
 */
export function aggregateErrors(errors: GraphQLError[]): GraphQLError | null {
  if (errors.length === 0) {
    return null;
  }

  if (errors.length === 1) {
    return errors[0]!;
  }

  const messages = errors.map((e) => e.message).join('; ');

  return new GraphQLError(messages, {
    extensions: {
      code: ErrorCodes.VALIDATION_ERROR,
      errors: errors.map((e) => ({
        message: e.message,
        ...e.extensions,
      })),
    },
  });
}

/**
 * Check if an error is of a specific type.
 */
export function isErrorCode(error: GraphQLError, code: ErrorCode): boolean {
  return error.extensions?.code === code;
}

/**
 * Get error code from a GraphQL error.
 */
export function getErrorCode(error: GraphQLError): string | undefined {
  return error.extensions?.code as string | undefined;
}

// =============================================================================
// Error Logging
// =============================================================================

/**
 * Log an error with context.
 */
export function logError(
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(JSON.stringify({
    timestamp,
    level: 'error',
    message: errorMessage,
    stack,
    ...context,
  }));
}

/**
 * Create a wrapped error handler for resolvers.
 */
export function createErrorHandler<T>(
  defaultValue: T,
  options: ErrorFormattingOptions = {}
): (error: unknown) => T {
  return (error: unknown) => {
    const formattedError = formatError(error, options);
    logError(formattedError);
    return defaultValue;
  };
}
