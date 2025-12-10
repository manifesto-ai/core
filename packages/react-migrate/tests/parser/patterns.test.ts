import { describe, it, expect } from 'vitest';
import { parseFile } from '../../src/parser/swc-parser.js';
import { detectAllPatterns } from '../../src/parser/patterns/index.js';
import { componentDetector } from '../../src/parser/patterns/component.js';
import { hookDetector } from '../../src/parser/patterns/hook.js';
import { contextDetector } from '../../src/parser/patterns/context.js';
import type { Module } from '@swc/core';

describe('Pattern Detectors', () => {
  describe('Component Pattern Detector', () => {
    it('should detect function component', () => {
      const content = `
        export function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const { ast } = parseFile(content, 'MyComponent.tsx');
      const patterns = componentDetector.detect(ast as Module, 'MyComponent.tsx');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('component');
      expect(patterns[0]?.name).toBe('MyComponent');
    });

    it('should detect arrow function component', () => {
      const content = `
        export const MyComponent = () => {
          return <div>Hello</div>;
        };
      `;

      const { ast } = parseFile(content, 'MyComponent.tsx');
      const patterns = componentDetector.detect(ast as Module, 'MyComponent.tsx');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('component');
      expect(patterns[0]?.name).toBe('MyComponent');
    });

    it('should not detect non-PascalCase functions as components', () => {
      const content = `
        export function myHelper() {
          return 'not a component';
        }
      `;

      const { ast } = parseFile(content, 'helper.ts');
      const patterns = componentDetector.detect(ast as Module, 'helper.ts');

      expect(patterns).toHaveLength(0);
    });
  });

  describe('Hook Pattern Detector', () => {
    it('should detect custom hook', () => {
      const content = `
        export function useMyHook() {
          const [state, setState] = useState(0);
          return { state, setState };
        }
      `;

      const { ast } = parseFile(content, 'useMyHook.ts');
      const patterns = hookDetector.detect(ast as Module, 'useMyHook.ts');

      // Should find both the custom hook and useState usage
      expect(patterns.length).toBeGreaterThan(0);
      const customHook = patterns.find(p => p.name === 'useMyHook');
      expect(customHook).toBeDefined();
      expect(customHook?.metadata.isCustomHook).toBe(true);
    });

    it('should detect useState hook usage', () => {
      const content = `
        function Component() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;

      const { ast } = parseFile(content, 'Component.tsx');
      const patterns = hookDetector.detect(ast as Module, 'Component.tsx');

      const stateHook = patterns.find(p => p.name === 'useState');
      expect(stateHook).toBeDefined();
    });

    it('should detect useReducer as reducer pattern', () => {
      const content = `
        function Component() {
          const [state, dispatch] = useReducer(reducer, initialState);
          return <div>{state}</div>;
        }
      `;

      const { ast } = parseFile(content, 'Component.tsx');
      const patterns = hookDetector.detect(ast as Module, 'Component.tsx');

      const reducerPattern = patterns.find(p => p.type === 'reducer');
      expect(reducerPattern).toBeDefined();
      expect(reducerPattern?.needsReview).toBe(true);
    });
  });

  describe('Context Pattern Detector', () => {
    it('should detect createContext', () => {
      const content = `
        import { createContext } from 'react';
        export const MyContext = createContext(null);
      `;

      const { ast } = parseFile(content, 'MyContext.ts');
      const patterns = contextDetector.detect(ast as Module, 'MyContext.ts');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]?.type).toBe('context');
    });

    it('should detect Provider component', () => {
      const content = `
        export const MyProvider = ({ children }) => {
          return <MyContext.Provider value={{}}>{children}</MyContext.Provider>;
        };
      `;

      const { ast } = parseFile(content, 'MyProvider.tsx');
      const patterns = contextDetector.detect(ast as Module, 'MyProvider.tsx');

      const provider = patterns.find(p => p.name.includes('Provider'));
      expect(provider).toBeDefined();
    });
  });

  describe('detectAllPatterns', () => {
    it('should detect multiple patterns in a file', () => {
      const content = `
        import React, { createContext, useContext, useState } from 'react';

        const ThemeContext = createContext('light');

        export function ThemeProvider({ children }) {
          const [theme, setTheme] = useState('light');
          return (
            <ThemeContext.Provider value={{ theme, setTheme }}>
              {children}
            </ThemeContext.Provider>
          );
        }

        export function useTheme() {
          return useContext(ThemeContext);
        }
      `;

      const { ast } = parseFile(content, 'theme.tsx');
      const patterns = detectAllPatterns(ast as Module, 'theme.tsx');

      // Should find: context, component, custom hook, useState, useContext
      expect(patterns.length).toBeGreaterThanOrEqual(3);

      const types = patterns.map(p => p.type);
      expect(types).toContain('context');
      expect(types).toContain('component');
      expect(types).toContain('hook');
    });
  });
});
