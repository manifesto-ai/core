/**
 * Compiler Result Types
 *
 * Unified error handling using @manifesto-ai/core Result monad.
 *
 * Manifesto Philosophy:
 * "실패는 예외가 아니라, 처리되어야 할 데이터다."
 *
 * All compiler operations return Result<T, CompilerError>.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { FragmentId, FragmentKind } from './fragment.js';
import type { ConflictId } from './conflict.js';
import type { AliasId, CodebookId, AliasStatus } from './codebook.js';

// Re-export core Result utilities
export { ok, err, isOk, isErr, map, mapErr, flatMap, all } from '@manifesto-ai/core';
export type { Result } from '@manifesto-ai/core';

// ============================================================================
// CompilerError - Discriminated Union
// ============================================================================

/**
 * Compiler error codes
 *
 * Grouped by domain for easier handling
 */
export type CompilerErrorCode =
  // Fragment errors
  | 'FRAGMENT_NOT_FOUND'
  | 'FRAGMENT_ALREADY_EXISTS'
  | 'INVALID_FRAGMENT_KIND'
  // Path errors
  | 'PATH_NOT_FOUND'
  | 'INVALID_PATH'
  | 'SELF_REFERENCE'
  // Dependency errors
  | 'DEP_NOT_FOUND'
  | 'DEP_ALREADY_EXISTS'
  | 'CYCLE_DETECTED'
  | 'MISSING_DEPENDENCY'
  // Conflict errors
  | 'CONFLICT_NOT_FOUND'
  | 'DUPLICATE_PROVIDES'
  // Codebook/Alias errors
  | 'CODEBOOK_REQUIRED'
  | 'CODEBOOK_MISMATCH'
  | 'ALIAS_NOT_FOUND'
  | 'ALIAS_CONFLICT'
  | 'ALIAS_WRONG_STATE'
  // Schema errors
  | 'SCHEMA_NOT_FOUND'
  | 'FIELD_NOT_FOUND'
  // Operation errors
  | 'UNKNOWN_OPERATION'
  | 'INVALID_OPERATION'
  // Internal errors
  | 'INTERNAL_ERROR';

/**
 * Base error interface
 */
interface CompilerErrorBase {
  readonly _tag: 'CompilerError';
  readonly code: CompilerErrorCode;
  readonly message: string;
}

// ============================================================================
// Fragment Errors
// ============================================================================

export interface FragmentNotFoundError extends CompilerErrorBase {
  readonly code: 'FRAGMENT_NOT_FOUND';
  readonly fragmentId: FragmentId;
}

export interface FragmentAlreadyExistsError extends CompilerErrorBase {
  readonly code: 'FRAGMENT_ALREADY_EXISTS';
  readonly fragmentId: FragmentId;
}

export interface InvalidFragmentKindError extends CompilerErrorBase {
  readonly code: 'INVALID_FRAGMENT_KIND';
  readonly fragmentId: FragmentId;
  readonly expected: FragmentKind | FragmentKind[];
  readonly actual: FragmentKind;
}

// ============================================================================
// Path Errors
// ============================================================================

export interface PathNotFoundError extends CompilerErrorBase {
  readonly code: 'PATH_NOT_FOUND';
  readonly path: SemanticPath;
}

export interface InvalidPathError extends CompilerErrorBase {
  readonly code: 'INVALID_PATH';
  readonly path: string;
  readonly reason?: string;
}

export interface SelfReferenceError extends CompilerErrorBase {
  readonly code: 'SELF_REFERENCE';
  readonly path: SemanticPath;
}

// ============================================================================
// Dependency Errors
// ============================================================================

export interface DepNotFoundError extends CompilerErrorBase {
  readonly code: 'DEP_NOT_FOUND';
  readonly path: SemanticPath;
  readonly dep: SemanticPath;
}

export interface DepAlreadyExistsError extends CompilerErrorBase {
  readonly code: 'DEP_ALREADY_EXISTS';
  readonly path: SemanticPath;
  readonly dep: SemanticPath;
}

export interface CycleDetectedError extends CompilerErrorBase {
  readonly code: 'CYCLE_DETECTED';
  readonly cycle: SemanticPath[];
}

export interface MissingDependencyError extends CompilerErrorBase {
  readonly code: 'MISSING_DEPENDENCY';
  readonly fragmentId: FragmentId;
  readonly missing: SemanticPath[];
}

// ============================================================================
// Conflict Errors
// ============================================================================

export interface ConflictNotFoundError extends CompilerErrorBase {
  readonly code: 'CONFLICT_NOT_FOUND';
  readonly conflictId: ConflictId;
}

export interface DuplicateProvidesError extends CompilerErrorBase {
  readonly code: 'DUPLICATE_PROVIDES';
  readonly path: SemanticPath;
  readonly fragmentIds: FragmentId[];
}

// ============================================================================
// Codebook/Alias Errors
// ============================================================================

export interface CodebookRequiredError extends CompilerErrorBase {
  readonly code: 'CODEBOOK_REQUIRED';
  readonly operation: string;
}

export interface CodebookMismatchError extends CompilerErrorBase {
  readonly code: 'CODEBOOK_MISMATCH';
  readonly expected: CodebookId;
  readonly actual: CodebookId;
}

export interface AliasNotFoundError extends CompilerErrorBase {
  readonly code: 'ALIAS_NOT_FOUND';
  readonly aliasId: AliasId;
}

export interface AliasConflictError extends CompilerErrorBase {
  readonly code: 'ALIAS_CONFLICT';
  readonly aliasPath: SemanticPath;
  readonly canonicalPath: SemanticPath;
  readonly reason?: string;
}

export interface AliasWrongStateError extends CompilerErrorBase {
  readonly code: 'ALIAS_WRONG_STATE';
  readonly aliasId: AliasId;
  readonly expected: AliasStatus;
  readonly actual: AliasStatus;
}

// ============================================================================
// Schema Errors
// ============================================================================

export interface SchemaNotFoundError extends CompilerErrorBase {
  readonly code: 'SCHEMA_NOT_FOUND';
  readonly path: SemanticPath;
}

export interface FieldNotFoundError extends CompilerErrorBase {
  readonly code: 'FIELD_NOT_FOUND';
  readonly path: SemanticPath;
  readonly fragmentId?: FragmentId;
}

// ============================================================================
// Operation Errors
// ============================================================================

export interface UnknownOperationError extends CompilerErrorBase {
  readonly code: 'UNKNOWN_OPERATION';
  readonly operation: string;
}

export interface InvalidOperationError extends CompilerErrorBase {
  readonly code: 'INVALID_OPERATION';
  readonly operation: string;
  readonly reason: string;
}

// ============================================================================
// Internal Errors
// ============================================================================

export interface InternalError extends CompilerErrorBase {
  readonly code: 'INTERNAL_ERROR';
  readonly cause?: Error;
}

// ============================================================================
// CompilerError Union Type
// ============================================================================

/**
 * All possible compiler errors as a discriminated union
 *
 * Pattern matching example:
 * ```typescript
 * if (error.code === 'FRAGMENT_NOT_FOUND') {
 *   console.log(`Fragment ${error.fragmentId} not found`);
 * }
 * ```
 */
export type CompilerError =
  // Fragment errors
  | FragmentNotFoundError
  | FragmentAlreadyExistsError
  | InvalidFragmentKindError
  // Path errors
  | PathNotFoundError
  | InvalidPathError
  | SelfReferenceError
  // Dependency errors
  | DepNotFoundError
  | DepAlreadyExistsError
  | CycleDetectedError
  | MissingDependencyError
  // Conflict errors
  | ConflictNotFoundError
  | DuplicateProvidesError
  // Codebook/Alias errors
  | CodebookRequiredError
  | CodebookMismatchError
  | AliasNotFoundError
  | AliasConflictError
  | AliasWrongStateError
  // Schema errors
  | SchemaNotFoundError
  | FieldNotFoundError
  // Operation errors
  | UnknownOperationError
  | InvalidOperationError
  // Internal errors
  | InternalError;

// ============================================================================
// Error Constructors
// ============================================================================

/**
 * Create a FRAGMENT_NOT_FOUND error
 */
export function fragmentNotFound(fragmentId: FragmentId): FragmentNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'FRAGMENT_NOT_FOUND',
    message: `Fragment not found: ${fragmentId}`,
    fragmentId,
  };
}

/**
 * Create a FRAGMENT_ALREADY_EXISTS error
 */
export function fragmentAlreadyExists(fragmentId: FragmentId): FragmentAlreadyExistsError {
  return {
    _tag: 'CompilerError',
    code: 'FRAGMENT_ALREADY_EXISTS',
    message: `Fragment already exists: ${fragmentId}`,
    fragmentId,
  };
}

/**
 * Create an INVALID_FRAGMENT_KIND error
 */
export function invalidFragmentKind(
  fragmentId: FragmentId,
  expected: FragmentKind | FragmentKind[],
  actual: FragmentKind
): InvalidFragmentKindError {
  const expectedStr = Array.isArray(expected) ? expected.join(' | ') : expected;
  return {
    _tag: 'CompilerError',
    code: 'INVALID_FRAGMENT_KIND',
    message: `Invalid fragment kind for ${fragmentId}: expected ${expectedStr}, got ${actual}`,
    fragmentId,
    expected,
    actual,
  };
}

/**
 * Create a PATH_NOT_FOUND error
 */
export function pathNotFound(path: SemanticPath): PathNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'PATH_NOT_FOUND',
    message: `Path not found: ${path}`,
    path,
  };
}

/**
 * Create an INVALID_PATH error
 */
export function invalidPath(path: string, reason?: string): InvalidPathError {
  return {
    _tag: 'CompilerError',
    code: 'INVALID_PATH',
    message: `Invalid path: ${path}${reason ? ` (${reason})` : ''}`,
    path,
    reason,
  };
}

/**
 * Create a SELF_REFERENCE error
 */
export function selfReference(path: SemanticPath): SelfReferenceError {
  return {
    _tag: 'CompilerError',
    code: 'SELF_REFERENCE',
    message: `Cannot reference path to itself: ${path}`,
    path,
  };
}

/**
 * Create a DEP_NOT_FOUND error
 */
export function depNotFound(path: SemanticPath, dep: SemanticPath): DepNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'DEP_NOT_FOUND',
    message: `Dependency ${dep} not found for ${path}`,
    path,
    dep,
  };
}

/**
 * Create a DEP_ALREADY_EXISTS error
 */
export function depAlreadyExists(path: SemanticPath, dep: SemanticPath): DepAlreadyExistsError {
  return {
    _tag: 'CompilerError',
    code: 'DEP_ALREADY_EXISTS',
    message: `Dependency ${dep} already exists for ${path}`,
    path,
    dep,
  };
}

/**
 * Create a CYCLE_DETECTED error
 */
export function cycleDetected(cycle: SemanticPath[]): CycleDetectedError {
  return {
    _tag: 'CompilerError',
    code: 'CYCLE_DETECTED',
    message: `Cycle detected: ${cycle.join(' -> ')}`,
    cycle,
  };
}

/**
 * Create a MISSING_DEPENDENCY error
 */
export function missingDependency(
  fragmentId: FragmentId,
  missing: SemanticPath[]
): MissingDependencyError {
  return {
    _tag: 'CompilerError',
    code: 'MISSING_DEPENDENCY',
    message: `Fragment ${fragmentId} has missing dependencies: ${missing.join(', ')}`,
    fragmentId,
    missing,
  };
}

/**
 * Create a CONFLICT_NOT_FOUND error
 */
export function conflictNotFound(conflictId: ConflictId): ConflictNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'CONFLICT_NOT_FOUND',
    message: `Conflict not found: ${conflictId}`,
    conflictId,
  };
}

/**
 * Create a DUPLICATE_PROVIDES error
 */
export function duplicateProvides(
  path: SemanticPath,
  fragmentIds: FragmentId[]
): DuplicateProvidesError {
  return {
    _tag: 'CompilerError',
    code: 'DUPLICATE_PROVIDES',
    message: `Path ${path} is provided by multiple fragments: ${fragmentIds.join(', ')}`,
    path,
    fragmentIds,
  };
}

/**
 * Create a CODEBOOK_REQUIRED error
 */
export function codebookRequired(operation: string): CodebookRequiredError {
  return {
    _tag: 'CompilerError',
    code: 'CODEBOOK_REQUIRED',
    message: `Codebook required for ${operation} operation`,
    operation,
  };
}

/**
 * Create a CODEBOOK_MISMATCH error
 */
export function codebookMismatch(expected: CodebookId, actual: CodebookId): CodebookMismatchError {
  return {
    _tag: 'CompilerError',
    code: 'CODEBOOK_MISMATCH',
    message: `Codebook ID mismatch: expected ${expected}, got ${actual}`,
    expected,
    actual,
  };
}

/**
 * Create an ALIAS_NOT_FOUND error
 */
export function aliasNotFound(aliasId: AliasId): AliasNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'ALIAS_NOT_FOUND',
    message: `Alias not found: ${aliasId}`,
    aliasId,
  };
}

/**
 * Create an ALIAS_CONFLICT error
 */
export function aliasConflict(
  aliasPath: SemanticPath,
  canonicalPath: SemanticPath,
  reason?: string
): AliasConflictError {
  return {
    _tag: 'CompilerError',
    code: 'ALIAS_CONFLICT',
    message: `Alias conflict: ${aliasPath} -> ${canonicalPath}${reason ? ` (${reason})` : ''}`,
    aliasPath,
    canonicalPath,
    reason,
  };
}

/**
 * Create an ALIAS_WRONG_STATE error
 */
export function aliasWrongState(
  aliasId: AliasId,
  expected: AliasStatus,
  actual: AliasStatus
): AliasWrongStateError {
  return {
    _tag: 'CompilerError',
    code: 'ALIAS_WRONG_STATE',
    message: `Alias ${aliasId} is in wrong state: expected ${expected}, got ${actual}`,
    aliasId,
    expected,
    actual,
  };
}

/**
 * Create a SCHEMA_NOT_FOUND error
 */
export function schemaNotFound(path: SemanticPath): SchemaNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'SCHEMA_NOT_FOUND',
    message: `SchemaFragment not found for path: ${path}`,
    path,
  };
}

/**
 * Create a FIELD_NOT_FOUND error
 */
export function fieldNotFound(path: SemanticPath, fragmentId?: FragmentId): FieldNotFoundError {
  return {
    _tag: 'CompilerError',
    code: 'FIELD_NOT_FOUND',
    message: `Field not found: ${path}${fragmentId ? ` in ${fragmentId}` : ''}`,
    path,
    fragmentId,
  };
}

/**
 * Create an UNKNOWN_OPERATION error
 */
export function unknownOperation(operation: string): UnknownOperationError {
  return {
    _tag: 'CompilerError',
    code: 'UNKNOWN_OPERATION',
    message: `Unknown operation: ${operation}`,
    operation,
  };
}

/**
 * Create an INVALID_OPERATION error
 */
export function invalidOperation(operation: string, reason: string): InvalidOperationError {
  return {
    _tag: 'CompilerError',
    code: 'INVALID_OPERATION',
    message: `Invalid operation ${operation}: ${reason}`,
    operation,
    reason,
  };
}

/**
 * Create an INTERNAL_ERROR error
 */
export function internalError(message: string, cause?: Error): InternalError {
  return {
    _tag: 'CompilerError',
    code: 'INTERNAL_ERROR',
    message,
    cause,
  };
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if an error is a CompilerError
 */
export function isCompilerError(error: unknown): error is CompilerError {
  return (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    error._tag === 'CompilerError'
  );
}

/**
 * Get error message from CompilerError
 */
export function getErrorMessage(error: CompilerError): string {
  return error.message;
}

/**
 * Convert CompilerError to string for logging
 */
export function errorToString(error: CompilerError): string {
  return `[${error.code}] ${error.message}`;
}
