import { describe, it, expect } from 'vitest';
import {
  calculatePriority,
  analyzePriorityFactors,
  createFileTask,
  createFileTasks,
  isEntryPoint,
  isFeatureDirectory,
  inferDomainFromPath,
} from '../../../src/domains/analyzer/algorithms/priority.js';
import type { ScannedFile } from '../../../src/parser/types.js';

describe('Priority Calculator', () => {
  describe('isEntryPoint', () => {
    it('should identify entry point files', () => {
      expect(isEntryPoint('index.ts')).toBe(true);
      expect(isEntryPoint('index.tsx')).toBe(true);
      expect(isEntryPoint('App.tsx')).toBe(true);
      expect(isEntryPoint('main.ts')).toBe(true);
      expect(isEntryPoint('_app.tsx')).toBe(true); // Next.js
      expect(isEntryPoint('layout.tsx')).toBe(true); // Next.js App Router
    });

    it('should not identify non-entry files', () => {
      expect(isEntryPoint('component.tsx')).toBe(false);
      expect(isEntryPoint('utils.ts')).toBe(false);
      expect(isEntryPoint('MyIndex.tsx')).toBe(false);
    });
  });

  describe('calculatePriority', () => {
    const baseFile = (overrides: Partial<ScannedFile> = {}): ScannedFile => ({
      path: '/src/file.tsx',
      relativePath: 'src/file.tsx',
      extension: 'tsx',
      content: '',
      size: 100,
      ...overrides,
    });

    it('should give high priority to entry points', () => {
      const entryFile = baseFile({
        relativePath: 'src/index.tsx',
        content: 'export default App;',
      });

      const normalFile = baseFile({
        relativePath: 'src/component.tsx',
        content: 'export default Component;',
      });

      expect(calculatePriority(entryFile)).toBeGreaterThan(calculatePriority(normalFile));
    });

    it('should give high priority to context creation', () => {
      const contextFile = baseFile({
        content: 'const MyContext = createContext<State>(null);',
      });

      const normalFile = baseFile({
        content: 'function Component() {}',
      });

      expect(calculatePriority(contextFile)).toBeGreaterThan(calculatePriority(normalFile));
    });

    it('should give high priority to custom hooks', () => {
      const hookFile = baseFile({
        content: 'export function useAuth() { return {} }',
      });

      const normalFile = baseFile({
        content: 'function Component() {}',
      });

      expect(calculatePriority(hookFile)).toBeGreaterThan(calculatePriority(normalFile));
    });

    it('should give high priority to useReducer', () => {
      const reducerFile = baseFile({
        content: 'const [state, dispatch] = useReducer(reducer, initial);',
      });

      const normalFile = baseFile({
        content: 'const [state, setState] = useState(null);',
      });

      expect(calculatePriority(reducerFile)).toBeGreaterThan(calculatePriority(normalFile));
    });

    it('should give bonus for Provider pattern', () => {
      const providerFile = baseFile({
        content: '<MyContext.Provider value={state}>',
      });

      const normalFile = baseFile({
        content: '<div>Hello</div>',
      });

      expect(calculatePriority(providerFile)).toBeGreaterThan(calculatePriority(normalFile));
    });

    it('should give bonus for exports', () => {
      const manyExports = baseFile({
        content: 'export const a = 1;\nexport const b = 2;\nexport const c = 3;',
      });

      const fewExports = baseFile({
        content: 'export const a = 1;',
      });

      expect(calculatePriority(manyExports)).toBeGreaterThan(calculatePriority(fewExports));
    });

    it('should penalize deep directory structure', () => {
      const deepFile = baseFile({
        relativePath: 'src/features/user/components/deep/Component.tsx',
      });

      const shallowFile = baseFile({
        relativePath: 'src/Component.tsx',
      });

      expect(calculatePriority(deepFile)).toBeLessThan(calculatePriority(shallowFile));
    });

    it('should clamp priority between 0 and 100', () => {
      // Very high priority file
      const highPriorityFile = baseFile({
        relativePath: 'src/index.tsx',
        content: `
          const MyContext = createContext(null);
          export default function useMyHook() {}
          const [state, dispatch] = useReducer(r, {});
          <Provider>
          export const a = 1;
          export const b = 2;
        `,
      });

      const priority = calculatePriority(highPriorityFile);
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(100);
    });
  });

  describe('analyzePriorityFactors', () => {
    it('should return detailed priority breakdown', () => {
      const file: ScannedFile = {
        path: '/src/UserContext.tsx',
        relativePath: 'src/UserContext.tsx',
        extension: 'tsx',
        content: `
          import { createContext } from 'react';
          export const UserContext = createContext<User>(null);
          export function useUser() { return useContext(UserContext); }
        `,
        size: 200,
      };

      const factors = analyzePriorityFactors(file);

      expect(factors.hasContextCreation).toBe(25);
      expect(factors.exportBonus).toBeGreaterThan(0);
      expect(factors.importPenalty).toBeLessThan(0);
    });
  });

  describe('createFileTask', () => {
    it('should create a file task with calculated priority', () => {
      const file: ScannedFile = {
        path: '/root/src/index.tsx',
        relativePath: 'src/index.tsx',
        extension: 'tsx',
        content: 'export default App;',
        size: 50,
      };

      const task = createFileTask(file, '/root');

      expect(task.path).toBe('/root/src/index.tsx');
      expect(task.relativePath).toBe('src/index.tsx');
      expect(task.status).toBe('pending');
      expect(task.priority).toBeGreaterThan(50); // Entry point bonus
    });
  });

  describe('createFileTasks', () => {
    it('should create and sort tasks by priority', () => {
      const files: ScannedFile[] = [
        {
          path: '/root/src/utils.ts',
          relativePath: 'src/utils.ts',
          extension: 'ts',
          content: 'export function util() {}',
          size: 50,
        },
        {
          path: '/root/src/index.tsx',
          relativePath: 'src/index.tsx',
          extension: 'tsx',
          content: 'export default App;',
          size: 50,
        },
        {
          path: '/root/src/context.tsx',
          relativePath: 'src/context.tsx',
          extension: 'tsx',
          content: 'const Ctx = createContext(null);',
          size: 100,
        },
      ];

      const tasks = createFileTasks(files, '/root');

      expect(tasks).toHaveLength(3);
      // Should be sorted by priority descending
      expect(tasks[0]?.priority).toBeGreaterThanOrEqual(tasks[1]?.priority ?? 0);
      expect(tasks[1]?.priority).toBeGreaterThanOrEqual(tasks[2]?.priority ?? 0);
    });
  });

  describe('isFeatureDirectory', () => {
    it('should identify feature directories', () => {
      expect(isFeatureDirectory('src/features/user/')).toBe(true);
      expect(isFeatureDirectory('src/modules/auth/')).toBe(true);
      expect(isFeatureDirectory('src/domains/payment/')).toBe(true);
      expect(isFeatureDirectory('src/pages/home/')).toBe(true);
      expect(isFeatureDirectory('src/views/dashboard/')).toBe(true);
      expect(isFeatureDirectory('src/screens/login/')).toBe(true);
    });

    it('should not identify non-feature directories', () => {
      expect(isFeatureDirectory('src/utils/')).toBe(false);
      expect(isFeatureDirectory('src/components/')).toBe(false);
      expect(isFeatureDirectory('src/hooks/')).toBe(false);
    });
  });

  describe('inferDomainFromPath', () => {
    it('should infer domain from feature directory', () => {
      expect(inferDomainFromPath('src/features/user/hooks/useUser.ts')).toBe('user');
      expect(inferDomainFromPath('src/modules/auth/AuthContext.tsx')).toBe('auth');
      expect(inferDomainFromPath('src/domains/payment/PaymentForm.tsx')).toBe('payment');
    });

    it('should infer domain from hook filename', () => {
      expect(inferDomainFromPath('src/hooks/useUser.ts')).toBe('user');
      expect(inferDomainFromPath('src/hooks/useAuthState.tsx')).toBe('authstate');
    });

    it('should infer domain from context filename', () => {
      expect(inferDomainFromPath('src/contexts/UserContext.tsx')).toBe('user');
      expect(inferDomainFromPath('src/AuthContext.ts')).toBe('auth');
    });

    it('should return null for non-domain files', () => {
      expect(inferDomainFromPath('src/utils/helpers.ts')).toBeNull();
      expect(inferDomainFromPath('src/components/Button.tsx')).toBeNull();
    });
  });
});
