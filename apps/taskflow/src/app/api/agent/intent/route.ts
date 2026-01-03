/**
 * Intent-Native API Route (Non-streaming)
 *
 * 컴파일러 아키텍처:
 * Natural Language → LLM Parser (Skeleton) → Symbol Resolver → Runtime
 *
 * 핵심 원칙: LLM 출력에 ID가 들어가면 설계가 틀린 것이다.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Intent } from '@/lib/agents/intent';
import type { IntentSkeleton } from '@/lib/agents/skeleton';
import { tryFastPath, detectLanguage } from '@/lib/agents/pattern-matcher';
import { compileIntent, isCompilerSuccess } from '@/lib/agents/intent-compiler';
import { resolveSkeleton, isResolverError } from '@/lib/agents/resolver';
import { executeIntent, calculateSnapshotDiff, type Snapshot } from '@/lib/agents/runtime';
import { interpretResult } from '@/lib/agents/result-interpreter';
import type { AgentEffect } from '@/lib/agents/types';

// ============================================
// Request/Response Types
// ============================================

interface IntentRequest {
  instruction: string;
  snapshot: Snapshot;
}

interface IntentResponse {
  success: boolean;
  skeleton?: IntentSkeleton;
  intent: Intent | null;
  effects: AgentEffect[];
  message: string;
  trace: {
    fastPath: boolean;
    compilerUsed: boolean;
    resolverUsed: boolean;
    interpreterUsed: boolean;
    totalLLMCalls: number;
  };
  error?: string;
  clarification?: {
    reason: string;
    question: string;
    candidates?: Array<{ id: string; title: string }>;
  };
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: IntentRequest = await request.json();
    const { instruction, snapshot } = body;

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: 'Instruction is required' },
        { status: 400 }
      );
    }

    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // 1. Try Fast Path for hints
    const fastResult = tryFastPath(instruction);

    // 2. LLM Skeleton Compiler
    const compilerResult = await compileIntent({
      instruction,
      snapshot,
      hint: fastResult.hint,
    });

    if (!isCompilerSuccess(compilerResult)) {
      return NextResponse.json(
        {
          success: false,
          error: `Compiler error: ${compilerResult.message}`,
          trace: {
            fastPath: false,
            compilerUsed: true,
            resolverUsed: false,
            interpreterUsed: false,
            totalLLMCalls: 1,
          },
        },
        { status: 400 }
      );
    }

    const skeleton = compilerResult.skeleton;

    // 3. Symbol Resolver
    const resolverResult = resolveSkeleton(skeleton, snapshot);

    if (isResolverError(resolverResult)) {
      const error = resolverResult.error;
      const response: IntentResponse = {
        success: true, // Clarification is a valid response
        skeleton,
        intent: null,
        effects: [],
        message: error.suggestedQuestion,
        trace: {
          fastPath: !!fastResult.hit,
          compilerUsed: true,
          resolverUsed: true,
          interpreterUsed: false,
          totalLLMCalls: 1,
        },
        clarification: {
          reason: error.type,
          question: error.suggestedQuestion,
          candidates: error.candidates?.map(t => ({ id: t.id, title: t.title })),
        },
      };
      return NextResponse.json(response);
    }

    const intent = resolverResult.data.intent;

    // 4. Runtime Execution
    const executionResult = executeIntent(intent, snapshot);

    if (!executionResult.success) {
      return NextResponse.json(
        {
          success: false,
          skeleton,
          intent,
          error: `Runtime error: ${executionResult.error}`,
          effects: [],
          message: '',
          trace: {
            fastPath: !!fastResult.hit,
            compilerUsed: true,
            resolverUsed: true,
            interpreterUsed: false,
            totalLLMCalls: 1,
          },
        },
        { status: 400 }
      );
    }

    const effects = executionResult.effects;

    // 5. Calculate snapshot diff
    const snapshotAfter = applyEffectsToSnapshot(snapshot, effects);
    const snapshotDiff = calculateSnapshotDiff(snapshot, snapshotAfter);

    // 6. Result Interpreter
    const lang = detectLanguage(instruction);
    const interpreterResult = await interpretResult({
      intent,
      effects,
      snapshotDiff,
      snapshot: snapshotAfter,
      language: lang,
    });

    const response: IntentResponse = {
      success: true,
      skeleton,
      intent,
      effects,
      message: interpreterResult.message,
      trace: {
        fastPath: !!fastResult.hit,
        compilerUsed: true,
        resolverUsed: true,
        interpreterUsed: true,
        totalLLMCalls: 2, // Compiler + Interpreter
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

function applyEffectsToSnapshot(snapshot: Snapshot, effects: AgentEffect[]): Snapshot {
  const result: Snapshot = JSON.parse(JSON.stringify(snapshot));

  for (const effect of effects) {
    if (effect.type === 'snapshot.patch' && effect.ops) {
      for (const op of effect.ops) {
        if (op.op === 'set') {
          const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
          if (idMatch) {
            const [, taskId, field] = idMatch;
            const task = result.data.tasks.find(t => t.id === taskId);
            if (task) {
              (task as Record<string, unknown>)[field] = op.value;
            }
          } else {
            setNestedValue(result, op.path, op.value);
          }
        } else if (op.op === 'append' && op.path === 'data.tasks') {
          result.data.tasks.push(op.value);
        } else if (op.op === 'remove' && op.path === 'data.tasks') {
          const task = result.data.tasks.find(t => t.id === op.value);
          if (task) {
            task.deletedAt = new Date().toISOString();
          }
        } else if (op.op === 'restore' && op.path === 'data.tasks') {
          const task = result.data.tasks.find(t => t.id === op.value);
          if (task) {
            task.deletedAt = null;
          }
        }
      }
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedValue(obj: any, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}
