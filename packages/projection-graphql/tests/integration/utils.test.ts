import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';

import {
  // Path converter
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
  // Error formatter
  ErrorCodes,
  formatValidationResult,
  formatError,
  createValidationError,
  createRequiredFieldError,
  createPreconditionError,
  createFieldNotFoundError,
  createFieldNotEditableError,
  createAuthenticationError,
  createAuthorizationError,
  createInternalError,
  aggregateErrors,
  isErrorCode,
  getErrorCode,
} from '../../src/utils/index.js';

describe('Path Converter', () => {
  describe('pathToFieldName', () => {
    it('should convert simple paths', () => {
      expect(pathToFieldName('data.email')).toBe('email');
      expect(pathToFieldName('state.loading')).toBe('loading');
      expect(pathToFieldName('derived.total')).toBe('total');
    });

    it('should convert nested paths to camelCase', () => {
      expect(pathToFieldName('data.user.email')).toBe('userEmail');
      expect(pathToFieldName('data.order.items.count')).toBe('orderItemsCount');
    });

    it('should handle paths without prefix', () => {
      expect(pathToFieldName('email')).toBe('email');
      expect(pathToFieldName('user.name')).toBe('userName');
    });

    it('should handle custom separator', () => {
      expect(pathToFieldName('data.user.email', { separator: '_' })).toBe('user_email');
    });

    it('should strip custom prefix', () => {
      expect(pathToFieldName('data.user.email', { stripPrefix: 'data' })).toBe('userEmail');
    });
  });

  describe('pathToTypeName', () => {
    it('should convert to PascalCase', () => {
      expect(pathToTypeName('data.user')).toBe('User');
      expect(pathToTypeName('data.order.item')).toBe('OrderItem');
    });
  });

  describe('fieldNameToPath', () => {
    it('should convert field name to path', () => {
      expect(fieldNameToPath('userEmail', 'data')).toBe('data.user.email');
      expect(fieldNameToPath('loading', 'state')).toBe('state.loading');
    });
  });

  describe('splitCamelCase', () => {
    it('should split camelCase strings', () => {
      expect(splitCamelCase('userEmail')).toEqual(['user', 'email']);
      expect(splitCamelCase('totalOrderAmount')).toEqual(['total', 'order', 'amount']);
    });

    it('should handle single word', () => {
      expect(splitCamelCase('email')).toEqual(['email']);
    });
  });

  describe('getPathPrefix', () => {
    it('should get path prefix', () => {
      expect(getPathPrefix('data.user')).toBe('data');
      expect(getPathPrefix('state.loading')).toBe('state');
      expect(getPathPrefix('derived.total')).toBe('derived');
    });

    it('should return null for unknown prefix', () => {
      expect(getPathPrefix('unknown.field')).toBe(null);
    });
  });

  describe('hasPathPrefix', () => {
    it('should check path prefix', () => {
      expect(hasPathPrefix('data.user', 'data')).toBe(true);
      expect(hasPathPrefix('data.user', 'state')).toBe(false);
    });
  });

  describe('stripPathPrefix', () => {
    it('should strip prefix', () => {
      expect(stripPathPrefix('data.user.email')).toBe('user.email');
      expect(stripPathPrefix('state.loading')).toBe('loading');
    });

    it('should handle paths without prefix', () => {
      expect(stripPathPrefix('user.email')).toBe('user.email');
    });
  });

  describe('addPathPrefix', () => {
    it('should add prefix', () => {
      expect(addPathPrefix('user.email', 'data')).toBe('data.user.email');
    });

    it('should not duplicate prefix', () => {
      expect(addPathPrefix('data.user.email', 'data')).toBe('data.user.email');
    });

    it('should replace existing prefix', () => {
      expect(addPathPrefix('data.user', 'state')).toBe('state.user');
    });
  });

  describe('Path Navigation', () => {
    it('should get parent path', () => {
      expect(getParentPath('data.user.email')).toBe('data.user');
      expect(getParentPath('data.user')).toBe('data');
      expect(getParentPath('data')).toBe(null);
    });

    it('should get path segment', () => {
      expect(getPathSegment('data.user.email')).toBe('email');
      expect(getPathSegment('data')).toBe('data');
    });

    it('should join paths', () => {
      expect(joinPath('data', 'user', 'email')).toBe('data.user.email');
      expect(joinPath('data', '', 'email')).toBe('data.email');
    });

    it('should check child paths', () => {
      expect(isChildPath('data.user.email', 'data.user')).toBe(true);
      expect(isChildPath('data.user', 'data.user.email')).toBe(false);
      expect(isChildPath('data.user', 'data.user')).toBe(false);
    });

    it('should get relative path', () => {
      expect(getRelativePath('data.user.email', 'data.user')).toBe('email');
      expect(getRelativePath('data.user.profile.name', 'data.user')).toBe('profile.name');
      expect(getRelativePath('data.order', 'data.user')).toBe(null);
    });
  });

  describe('GraphQL Name Utilities', () => {
    it('should sanitize GraphQL names', () => {
      expect(sanitizeGraphQLName('valid_name')).toBe('valid_name');
      expect(sanitizeGraphQLName('invalid-name')).toBe('invalid_name');
      expect(sanitizeGraphQLName('123invalid')).toBe('_123invalid');
    });

    it('should validate GraphQL names', () => {
      expect(isValidGraphQLName('validName')).toBe(true);
      expect(isValidGraphQLName('_valid')).toBe(true);
      expect(isValidGraphQLName('123invalid')).toBe(false);
      expect(isValidGraphQLName('invalid-name')).toBe(false);
    });

    it('should convert path to arg name', () => {
      expect(pathToArgName('data.user.email')).toBe('dataUserEmail');
    });
  });
});

describe('Error Formatter', () => {
  describe('Error Codes', () => {
    it('should have all error codes defined', () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.PRECONDITION_FAILED).toBe('PRECONDITION_FAILED');
      expect(ErrorCodes.FIELD_NOT_FOUND).toBe('FIELD_NOT_FOUND');
      expect(ErrorCodes.UNAUTHENTICATED).toBe('UNAUTHENTICATED');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });

  describe('formatValidationResult', () => {
    it('should return empty array for valid result', () => {
      const result = formatValidationResult({ valid: true, issues: [] });
      expect(result).toEqual([]);
    });

    it('should format validation issues', () => {
      const result = formatValidationResult({
        valid: false,
        issues: [
          { code: 'required', message: 'Field is required', path: 'data.email', severity: 'error' },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(GraphQLError);
      expect(result[0]?.message).toContain('Field is required');
    });
  });

  describe('formatError', () => {
    it('should format Error instances', () => {
      const error = new Error('Test error');
      const result = formatError(error);

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('Test error');
    });

    it('should pass through GraphQL errors', () => {
      const error = new GraphQLError('GraphQL error');
      const result = formatError(error);

      expect(result).toBe(error);
    });

    it('should format unknown errors', () => {
      const result = formatError('string error');

      expect(result).toBeInstanceOf(GraphQLError);
      expect(result.message).toBe('string error');
    });
  });

  describe('Error Creation Helpers', () => {
    it('should create validation error', () => {
      const error = createValidationError('Invalid value', 'data.email');

      expect(error.message).toBe('Invalid value');
      expect(error.extensions?.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.extensions?.path).toBe('data.email');
    });

    it('should create required field error', () => {
      const error = createRequiredFieldError('Email', 'data.email');

      expect(error.message).toBe('Email is required');
      expect(error.extensions?.code).toBe(ErrorCodes.REQUIRED_FIELD);
    });

    it('should create precondition error', () => {
      const error = createPreconditionError('Order is not confirmed', 'ship');

      expect(error.extensions?.code).toBe(ErrorCodes.PRECONDITION_FAILED);
      expect(error.extensions?.actionId).toBe('ship');
    });

    it('should create field not found error', () => {
      const error = createFieldNotFoundError('data.unknown');

      expect(error.message).toContain('data.unknown');
      expect(error.extensions?.code).toBe(ErrorCodes.FIELD_NOT_FOUND);
    });

    it('should create field not editable error', () => {
      const error = createFieldNotEditableError('data.id', 'ID is read-only');

      expect(error.message).toContain('data.id');
      expect(error.message).toContain('ID is read-only');
      expect(error.extensions?.code).toBe(ErrorCodes.FIELD_NOT_EDITABLE);
    });

    it('should create authentication error', () => {
      const error = createAuthenticationError();

      expect(error.message).toBe('Not authenticated');
      expect(error.extensions?.code).toBe(ErrorCodes.UNAUTHENTICATED);
    });

    it('should create authorization error', () => {
      const error = createAuthorizationError();

      expect(error.message).toBe('Not authorized');
      expect(error.extensions?.code).toBe(ErrorCodes.UNAUTHORIZED);
    });

    it('should create internal error', () => {
      const error = createInternalError();

      expect(error.message).toBe('Internal server error');
      expect(error.extensions?.code).toBe(ErrorCodes.INTERNAL_ERROR);
    });
  });

  describe('Error Aggregation', () => {
    it('should return null for empty array', () => {
      const result = aggregateErrors([]);
      expect(result).toBe(null);
    });

    it('should return single error unchanged', () => {
      const error = new GraphQLError('Single error');
      const result = aggregateErrors([error]);

      expect(result).toBe(error);
    });

    it('should aggregate multiple errors', () => {
      const errors = [
        new GraphQLError('Error 1'),
        new GraphQLError('Error 2'),
      ];
      const result = aggregateErrors(errors);

      expect(result?.message).toContain('Error 1');
      expect(result?.message).toContain('Error 2');
    });
  });

  describe('Error Utilities', () => {
    it('should check error code', () => {
      const error = new GraphQLError('Test', {
        extensions: { code: ErrorCodes.VALIDATION_ERROR },
      });

      expect(isErrorCode(error, ErrorCodes.VALIDATION_ERROR)).toBe(true);
      expect(isErrorCode(error, ErrorCodes.INTERNAL_ERROR)).toBe(false);
    });

    it('should get error code', () => {
      const error = new GraphQLError('Test', {
        extensions: { code: ErrorCodes.FIELD_NOT_FOUND },
      });

      expect(getErrorCode(error)).toBe(ErrorCodes.FIELD_NOT_FOUND);
    });
  });
});
