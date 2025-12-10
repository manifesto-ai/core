import { describe, it, expect } from 'vitest';
import {
  isSetValueCommand,
  isSetManyCommand,
  isExecuteActionCommand,
  setValue,
  setMany,
  executeAction,
  bridgeError,
  type Command,
  type SetValueCommand,
  type SetManyCommand,
  type ExecuteActionCommand,
  type BridgeError,
} from '../src/index.js';

// =============================================================================
// Type Guards
// =============================================================================

describe('Type Guards', () => {
  describe('isSetValueCommand', () => {
    it('should return true for SetValueCommand', () => {
      const cmd: Command = { type: 'SET_VALUE', path: 'data.name', value: 'John' };
      expect(isSetValueCommand(cmd)).toBe(true);
    });

    it('should return false for SetManyCommand', () => {
      const cmd: Command = { type: 'SET_MANY', updates: { 'data.name': 'John' } };
      expect(isSetValueCommand(cmd)).toBe(false);
    });

    it('should return false for ExecuteActionCommand', () => {
      const cmd: Command = { type: 'EXECUTE_ACTION', actionId: 'submit' };
      expect(isSetValueCommand(cmd)).toBe(false);
    });
  });

  describe('isSetManyCommand', () => {
    it('should return true for SetManyCommand', () => {
      const cmd: Command = { type: 'SET_MANY', updates: { 'data.name': 'John' } };
      expect(isSetManyCommand(cmd)).toBe(true);
    });

    it('should return false for SetValueCommand', () => {
      const cmd: Command = { type: 'SET_VALUE', path: 'data.name', value: 'John' };
      expect(isSetManyCommand(cmd)).toBe(false);
    });

    it('should return false for ExecuteActionCommand', () => {
      const cmd: Command = { type: 'EXECUTE_ACTION', actionId: 'submit' };
      expect(isSetManyCommand(cmd)).toBe(false);
    });
  });

  describe('isExecuteActionCommand', () => {
    it('should return true for ExecuteActionCommand', () => {
      const cmd: Command = { type: 'EXECUTE_ACTION', actionId: 'submit' };
      expect(isExecuteActionCommand(cmd)).toBe(true);
    });

    it('should return false for SetValueCommand', () => {
      const cmd: Command = { type: 'SET_VALUE', path: 'data.name', value: 'John' };
      expect(isExecuteActionCommand(cmd)).toBe(false);
    });

    it('should return false for SetManyCommand', () => {
      const cmd: Command = { type: 'SET_MANY', updates: { 'data.name': 'John' } };
      expect(isExecuteActionCommand(cmd)).toBe(false);
    });
  });
});

// =============================================================================
// Command Factories
// =============================================================================

describe('Command Factories', () => {
  describe('setValue', () => {
    it('should create a SetValueCommand', () => {
      const cmd = setValue('data.name', 'John');

      expect(cmd).toEqual({
        type: 'SET_VALUE',
        path: 'data.name',
        value: 'John',
        description: undefined,
      });
    });

    it('should create a SetValueCommand with description', () => {
      const cmd = setValue('data.age', 30, 'Set user age');

      expect(cmd).toEqual({
        type: 'SET_VALUE',
        path: 'data.age',
        value: 30,
        description: 'Set user age',
      });
    });

    it('should handle null value', () => {
      const cmd = setValue('data.optional', null);

      expect(cmd.value).toBeNull();
    });

    it('should handle object value', () => {
      const cmd = setValue('data.user', { name: 'John', age: 30 });

      expect(cmd.value).toEqual({ name: 'John', age: 30 });
    });

    it('should handle array value', () => {
      const cmd = setValue('data.items', [1, 2, 3]);

      expect(cmd.value).toEqual([1, 2, 3]);
    });
  });

  describe('setMany', () => {
    it('should create a SetManyCommand', () => {
      const cmd = setMany({
        'data.name': 'John',
        'data.age': 30,
      });

      expect(cmd).toEqual({
        type: 'SET_MANY',
        updates: {
          'data.name': 'John',
          'data.age': 30,
        },
        description: undefined,
      });
    });

    it('should create a SetManyCommand with description', () => {
      const cmd = setMany({ 'data.name': 'John' }, 'Batch update');

      expect(cmd.description).toBe('Batch update');
    });

    it('should handle empty updates', () => {
      const cmd = setMany({});

      expect(cmd.updates).toEqual({});
    });

    it('should handle mixed value types', () => {
      const cmd = setMany({
        'data.name': 'John',
        'data.age': 30,
        'data.active': true,
        'data.tags': ['a', 'b'],
      });

      expect(Object.keys(cmd.updates)).toHaveLength(4);
    });
  });

  describe('executeAction', () => {
    it('should create an ExecuteActionCommand', () => {
      const cmd = executeAction('submit');

      expect(cmd).toEqual({
        type: 'EXECUTE_ACTION',
        actionId: 'submit',
        input: undefined,
        description: undefined,
      });
    });

    it('should create an ExecuteActionCommand with input', () => {
      const cmd = executeAction('updateUser', { id: 1, name: 'John' });

      expect(cmd).toEqual({
        type: 'EXECUTE_ACTION',
        actionId: 'updateUser',
        input: { id: 1, name: 'John' },
        description: undefined,
      });
    });

    it('should create an ExecuteActionCommand with description', () => {
      const cmd = executeAction('delete', { id: 1 }, 'Delete user');

      expect(cmd.description).toBe('Delete user');
    });
  });
});

// =============================================================================
// Error Factory
// =============================================================================

describe('bridgeError', () => {
  it('should create a BridgeError with code and message', () => {
    const error = bridgeError('VALIDATION_ERROR', 'Invalid value');

    expect(error).toEqual({
      _tag: 'BridgeError',
      code: 'VALIDATION_ERROR',
      message: 'Invalid value',
      path: undefined,
      cause: undefined,
    });
  });

  it('should create a BridgeError with path', () => {
    const error = bridgeError('VALIDATION_ERROR', 'Required field', {
      path: 'data.name',
    });

    expect(error.path).toBe('data.name');
  });

  it('should create a BridgeError with cause', () => {
    const cause = new Error('Original error');
    const error = bridgeError('EXECUTION_ERROR', 'Failed to execute', { cause });

    expect(error.cause).toBe(cause);
  });

  it('should create a BridgeError with all options', () => {
    const cause = new Error('Network error');
    const error = bridgeError('SYNC_ERROR', 'Sync failed', {
      path: 'data.items',
      cause,
    });

    expect(error).toEqual({
      _tag: 'BridgeError',
      code: 'SYNC_ERROR',
      message: 'Sync failed',
      path: 'data.items',
      cause,
    });
  });

  it('should create errors with different codes', () => {
    const codes = [
      'VALIDATION_ERROR',
      'EXECUTION_ERROR',
      'SYNC_ERROR',
      'ADAPTER_ERROR',
      'DISPOSED_ERROR',
    ] as const;

    for (const code of codes) {
      const error = bridgeError(code, `Error: ${code}`);
      expect(error.code).toBe(code);
      expect(error._tag).toBe('BridgeError');
    }
  });
});

// =============================================================================
// Type Compatibility
// =============================================================================

describe('Type Compatibility', () => {
  it('should allow Command union type usage', () => {
    const commands: Command[] = [
      setValue('data.name', 'John'),
      setMany({ 'data.age': 30 }),
      executeAction('submit'),
    ];

    expect(commands).toHaveLength(3);
    expect(isSetValueCommand(commands[0]!)).toBe(true);
    expect(isSetManyCommand(commands[1]!)).toBe(true);
    expect(isExecuteActionCommand(commands[2]!)).toBe(true);
  });

  it('should narrow types correctly with type guards', () => {
    const cmd: Command = setValue('data.name', 'John');

    if (isSetValueCommand(cmd)) {
      // TypeScript should narrow to SetValueCommand
      const path: string = cmd.path;
      const value: unknown = cmd.value;
      expect(path).toBe('data.name');
      expect(value).toBe('John');
    }
  });
});
