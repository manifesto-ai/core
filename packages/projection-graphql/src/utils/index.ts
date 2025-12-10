/**
 * Utils Module
 *
 * Utility exports for GraphQL projection.
 */

export {
  pathToFieldName,
  pathToTypeName,
  fieldNameToPath,
  splitCamelCase,
  getPathPrefix,
  hasPathPrefix,
  stripPathPrefix,
  addPathPrefix,
  getParentPath,
  getPathSegment,
  joinPath,
  isChildPath,
  getRelativePath,
  sanitizeGraphQLName,
  isValidGraphQLName,
  pathToArgName,
} from './path-converter.js';

export {
  ErrorCodes,
  type ErrorCode,
  formatValidationResult,
  formatValidationIssue,
  formatError,
  formatErrors,
  createValidationError,
  createRequiredFieldError,
  createPreconditionError,
  createFieldNotFoundError,
  createFieldNotEditableError,
  createAuthenticationError,
  createAuthorizationError,
  createInternalError,
  createErrorResponse,
  createErrorResponses,
  aggregateErrors,
  isErrorCode,
  getErrorCode,
  logError,
  createErrorHandler,
} from './error-formatter.js';
