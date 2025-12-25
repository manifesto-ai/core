/**
 * Effect Lowering Pass Tests
 *
 * Effect Lowering Pass가 assignment 및 function_call Finding을
 * Effect로 올바르게 변환하고 EffectFragment를 생성하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  effectLoweringPass,
  codeAstExtractorPass,
  convertAssignment,
  convertFunctionCall,
  determineRisk,
  extractEffectRequires,
  isEmitPattern,
  isApiPattern,
  createPassRegistry,
  createPassExecutor,
} from '../../src/pass/index.js';
import { createPassContext, type Finding, type AssignmentData, type FunctionCallData } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';
import type { EffectFragment } from '../../src/types/fragment.js';
import type { Effect, SetValueEffect, SetStateEffect, EmitEventEffect, ApiCallEffect } from '@manifesto-ai/core';

// ============================================================================
// Test Helpers
// ============================================================================

function createCodeArtifact(content: string, language: 'js' | 'ts' = 'ts'): CodeArtifact {
  return {
    id: 'test-artifact',
    kind: 'code',
    language,
    content,
  };
}

async function compileToEffectFragments(content: string): Promise<EffectFragment[]> {
  const registry = createPassRegistry();
  registry.registerAll([codeAstExtractorPass, effectLoweringPass]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return result.fragments.filter(
    (f): f is EffectFragment => f.kind === 'EffectFragment'
  );
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('EffectLoweringPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('x = 10;');
      expect(effectLoweringPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(effectLoweringPass.supports(artifact)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should filter assignment and function_call findings', () => {
      const artifact = createCodeArtifact('x = 10; foo();');
      const mockFindings: Finding[] = [
        {
          id: 'f1',
          kind: 'assignment',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'assignment', target: 'x', operator: '=', value: 10, sourceCode: 'x = 10' } satisfies AssignmentData,
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f2',
          kind: 'function_call',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'function_call', callee: 'foo', arguments: [], sourceCode: 'foo()' } satisfies FunctionCallData,
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f3',
          kind: 'variable_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'variable_declaration', name: 'y', varKind: 'const', sourceCode: 'const y = 1;' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
      ];

      const ctx = createPassContext(artifact, { previousFindings: mockFindings });
      const filtered = effectLoweringPass.analyze(ctx);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((f) => f.kind)).toEqual(['assignment', 'function_call']);
    });
  });
});

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('Pattern Detection', () => {
  describe('isEmitPattern', () => {
    it('should detect emit patterns', () => {
      expect(isEmitPattern('emit')).toBe(true);
      expect(isEmitPattern('emitEvent')).toBe(true);
      expect(isEmitPattern('dispatch')).toBe(true);
      expect(isEmitPattern('dispatchAction')).toBe(true);
      expect(isEmitPattern('trigger')).toBe(true);
      expect(isEmitPattern('notify')).toBe(true);
      expect(isEmitPattern('publish')).toBe(true);
      expect(isEmitPattern('send')).toBe(true);
      expect(isEmitPattern('broadcast')).toBe(true);
    });

    it('should not detect non-emit patterns', () => {
      expect(isEmitPattern('foo')).toBe(false);
      expect(isEmitPattern('bar')).toBe(false);
      expect(isEmitPattern('console.log')).toBe(false);
    });
  });

  describe('isApiPattern', () => {
    it('should detect API patterns', () => {
      expect(isApiPattern('fetch')).toBe(true);
      expect(isApiPattern('axios')).toBe(true);
      expect(isApiPattern('axios.get')).toBe(true);
      expect(isApiPattern('api')).toBe(true);
      expect(isApiPattern('apiCall')).toBe(true);
      expect(isApiPattern('http')).toBe(true);
      expect(isApiPattern('request')).toBe(true);
      expect(isApiPattern('get')).toBe(true);
      expect(isApiPattern('post')).toBe(true);
      expect(isApiPattern('put')).toBe(true);
      expect(isApiPattern('patch')).toBe(true);
      expect(isApiPattern('delete')).toBe(true);
    });

    it('should not detect non-API patterns', () => {
      expect(isApiPattern('foo')).toBe(false);
      expect(isApiPattern('bar')).toBe(false);
      expect(isApiPattern('emit')).toBe(false);
    });
  });
});

// ============================================================================
// Assignment Conversion Tests
// ============================================================================

describe('convertAssignment', () => {
  it('should convert simple assignment to SetValue', () => {
    const data: AssignmentData = {
      kind: 'assignment',
      target: 'count',
      operator: '=',
      value: 10,
      sourceCode: 'count = 10',
    };

    const effect = convertAssignment(data) as SetValueEffect;
    expect(effect._tag).toBe('SetValue');
    expect(effect.path).toBe('data.count');
    expect(effect.value).toBe(10);
  });

  it('should convert state assignment to SetState', () => {
    const data: AssignmentData = {
      kind: 'assignment',
      target: 'state.loading',
      operator: '=',
      value: true,
      sourceCode: 'state.loading = true',
    };

    const effect = convertAssignment(data) as SetStateEffect;
    expect(effect._tag).toBe('SetState');
    expect(effect.path).toBe('state.loading');
    expect(effect.value).toBe(true);
  });

  it('should handle string values', () => {
    const data: AssignmentData = {
      kind: 'assignment',
      target: 'name',
      operator: '=',
      value: 'hello',
      sourceCode: 'name = "hello"',
    };

    const effect = convertAssignment(data) as SetValueEffect;
    expect(effect.value).toBe('hello');
  });

  it('should handle null values', () => {
    const data: AssignmentData = {
      kind: 'assignment',
      target: 'data',
      operator: '=',
      value: null,
      sourceCode: 'data = null',
    };

    const effect = convertAssignment(data) as SetValueEffect;
    expect(effect.value).toBe(null);
  });
});

// ============================================================================
// Function Call Conversion Tests
// ============================================================================

describe('convertFunctionCall', () => {
  describe('emit patterns', () => {
    it('should convert emit to EmitEvent', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'emit',
        arguments: ['userLoggedIn', { userId: 123 }],
        sourceCode: 'emit("userLoggedIn", { userId: 123 })',
      };

      const effect = convertFunctionCall(data) as EmitEventEffect;
      expect(effect._tag).toBe('EmitEvent');
      expect(effect.channel).toBe('domain');
      expect(effect.payload.type).toBe('userLoggedIn');
      expect(effect.payload.data).toEqual({ userId: 123 });
    });

    it('should convert dispatch to EmitEvent', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'dispatch',
        arguments: ['ACTION_TYPE'],
        sourceCode: 'dispatch("ACTION_TYPE")',
      };

      const effect = convertFunctionCall(data) as EmitEventEffect;
      expect(effect._tag).toBe('EmitEvent');
      expect(effect.payload.type).toBe('ACTION_TYPE');
    });
  });

  describe('API patterns', () => {
    it('should convert fetch to ApiCall', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'fetch',
        arguments: ['/api/users'],
        sourceCode: 'fetch("/api/users")',
      };

      const effect = convertFunctionCall(data) as ApiCallEffect;
      expect(effect._tag).toBe('ApiCall');
      expect(effect.endpoint).toBe('/api/users');
      expect(effect.method).toBe('GET');
    });

    it('should infer POST method from function name', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'postData',
        arguments: ['/api/users', { name: 'John' }],
        sourceCode: 'postData("/api/users", { name: "John" })',
      };

      const effect = convertFunctionCall(data) as ApiCallEffect;
      expect(effect.method).toBe('POST');
      expect(effect.body).toEqual({ name: 'John' });
    });

    it('should infer PUT method from function name', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'api.put',
        arguments: ['/api/users/1', { name: 'Jane' }],
        sourceCode: 'api.put("/api/users/1", { name: "Jane" })',
      };

      const effect = convertFunctionCall(data) as ApiCallEffect;
      expect(effect.method).toBe('PUT');
    });

    it('should infer DELETE method from function name', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'deleteUser',
        arguments: ['/api/users/1'],
        sourceCode: 'deleteUser("/api/users/1")',
      };

      const effect = convertFunctionCall(data) as ApiCallEffect;
      expect(effect.method).toBe('DELETE');
    });
  });

  describe('unknown patterns', () => {
    it('should return null for unknown function calls', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'console.log',
        arguments: ['hello'],
        sourceCode: 'console.log("hello")',
      };

      const effect = convertFunctionCall(data);
      expect(effect).toBe(null);
    });

    it('should return null for random functions', () => {
      const data: FunctionCallData = {
        kind: 'function_call',
        callee: 'myFunction',
        arguments: [1, 2, 3],
        sourceCode: 'myFunction(1, 2, 3)',
      };

      const effect = convertFunctionCall(data);
      expect(effect).toBe(null);
    });
  });
});

// ============================================================================
// Risk Assessment Tests
// ============================================================================

describe('determineRisk', () => {
  it('should assign low risk to SetValue', () => {
    const effect: SetValueEffect = {
      _tag: 'SetValue',
      path: 'data.count' as any,
      value: 10,
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('low');
  });

  it('should assign low risk to SetState', () => {
    const effect: SetStateEffect = {
      _tag: 'SetState',
      path: 'state.loading' as any,
      value: true,
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('low');
  });

  it('should assign low risk to EmitEvent', () => {
    const effect: EmitEventEffect = {
      _tag: 'EmitEvent',
      channel: 'domain',
      payload: { type: 'test' },
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('low');
  });

  it('should assign medium risk to GET ApiCall', () => {
    const effect: ApiCallEffect = {
      _tag: 'ApiCall',
      endpoint: '/api/users',
      method: 'GET',
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('medium');
  });

  it('should assign high risk to POST ApiCall', () => {
    const effect: ApiCallEffect = {
      _tag: 'ApiCall',
      endpoint: '/api/users',
      method: 'POST',
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('high');
  });

  it('should assign high risk to PUT ApiCall', () => {
    const effect: ApiCallEffect = {
      _tag: 'ApiCall',
      endpoint: '/api/users/1',
      method: 'PUT',
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('high');
  });

  it('should assign critical risk to DELETE ApiCall', () => {
    const effect: ApiCallEffect = {
      _tag: 'ApiCall',
      endpoint: '/api/users/1',
      method: 'DELETE',
      description: 'test',
    };
    expect(determineRisk(effect)).toBe('critical');
  });
});

// ============================================================================
// Requires Extraction Tests
// ============================================================================

describe('extractEffectRequires', () => {
  it('should extract paths from SetValue expression', () => {
    const effect: SetValueEffect = {
      _tag: 'SetValue',
      path: 'data.total' as any,
      value: ['get', 'data.count'] as any,
      description: 'test',
    };

    const requires = extractEffectRequires(effect);
    expect(requires).toContain('data.count');
  });

  it('should extract paths from nested expressions', () => {
    const effect: SetValueEffect = {
      _tag: 'SetValue',
      path: 'data.total' as any,
      value: ['+', ['get', 'data.a'], ['get', 'data.b']] as any,
      description: 'test',
    };

    const requires = extractEffectRequires(effect);
    expect(requires).toContain('data.a');
    expect(requires).toContain('data.b');
  });

  it('should return empty array for literal values', () => {
    const effect: SetValueEffect = {
      _tag: 'SetValue',
      path: 'data.count' as any,
      value: 10,
      description: 'test',
    };

    const requires = extractEffectRequires(effect);
    expect(requires).toHaveLength(0);
  });
});

// ============================================================================
// Fragment Generation Tests
// ============================================================================

describe('Fragment Generation', () => {
  it('should create EffectFragment for assignment', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments.length).toBeGreaterThanOrEqual(1);
    const fragment = fragments[0];
    expect(fragment?.kind).toBe('EffectFragment');
    expect(fragment?.effect._tag).toBe('SetValue');
  });

  it('should create EffectFragment for emit call', async () => {
    const fragments = await compileToEffectFragments('emit("userLoggedIn");');

    expect(fragments.length).toBeGreaterThanOrEqual(1);
    const fragment = fragments[0];
    expect(fragment?.kind).toBe('EffectFragment');
    expect(fragment?.effect._tag).toBe('EmitEvent');
  });

  it('should create EffectFragment for fetch call', async () => {
    const fragments = await compileToEffectFragments('fetch("/api/users");');

    expect(fragments.length).toBeGreaterThanOrEqual(1);
    const fragment = fragments[0];
    expect(fragment?.kind).toBe('EffectFragment');
    expect(fragment?.effect._tag).toBe('ApiCall');
  });

  it('should not create fragment for unknown function calls', async () => {
    const fragments = await compileToEffectFragments('console.log("hello");');

    // console.log should not produce an EffectFragment
    const emitFragments = fragments.filter(
      (f) => f.effect._tag === 'EmitEvent' || f.effect._tag === 'ApiCall'
    );
    expect(emitFragments).toHaveLength(0);
  });

  it('should include risk in fragment', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.risk).toBeDefined();
    expect(fragments[0]?.risk).toBe('low');
  });

  it('should include name in fragment', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.name).toBeDefined();
    expect(fragments[0]?.name).toMatch(/^set_/);
  });

  it('should include evidence in fragment', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.evidence).toBeDefined();
    expect(fragments[0]?.evidence?.length).toBeGreaterThanOrEqual(1);
    expect(fragments[0]?.evidence?.[0]?.kind).toBe('ast_node');
  });

  it('should have stable ID format', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.id).toBeDefined();
    expect(fragments[0]?.id).toMatch(/^eff_/);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Effect Pass Integration', () => {
  it('should work with pass executor', async () => {
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, effectLoweringPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('count = 10;');
    const result = await executor.execute(artifact);

    // Should have results from both passes
    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('code-ast-extractor');
    expect(result.passResults[1]?.passName).toBe('effect-lowering');

    // Should have fragments from effect pass
    expect(result.fragments.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle multiple effects in code', async () => {
    const code = `
      count = 10;
      emit("countUpdated");
      fetch("/api/save", { count });
    `;
    const fragments = await compileToEffectFragments(code);

    // Should have at least 3 effect fragments
    expect(fragments.length).toBeGreaterThanOrEqual(3);

    // Verify we have different effect types
    const tags = fragments.map((f) => f.effect._tag);
    expect(tags).toContain('SetValue');
    expect(tags).toContain('EmitEvent');
    expect(tags).toContain('ApiCall');
  });

  it('should include origin provenance', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.origin).toBeDefined();
    expect(fragments[0]?.origin?.artifactId).toBe('test-artifact');
  });

  it('should include compiler version', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.compilerVersion).toBeDefined();
  });

  it('should provide effect name in provides', async () => {
    const fragments = await compileToEffectFragments('count = 10;');

    expect(fragments[0]?.provides).toBeDefined();
    expect(fragments[0]?.provides?.[0]).toMatch(/^effect:/);
  });
});

// ============================================================================
// Complex Code Tests
// ============================================================================

describe('Complex Code', () => {
  it('should handle state updates', async () => {
    const code = `
      state.loading = true;
      fetch("/api/data");
      state.loading = false;
    `;
    const fragments = await compileToEffectFragments(code);

    const stateEffects = fragments.filter((f) => f.effect._tag === 'SetState');
    expect(stateEffects.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle chained API calls', async () => {
    const code = `
      axios.get("/api/users");
      axios.post("/api/users", { name: "John" });
    `;
    const fragments = await compileToEffectFragments(code);

    const apiEffects = fragments.filter(
      (f) => f.effect._tag === 'ApiCall'
    ) as EffectFragment[];

    expect(apiEffects.length).toBeGreaterThanOrEqual(2);

    // Check methods
    const methods = apiEffects.map((f) => (f.effect as ApiCallEffect).method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
  });
});
