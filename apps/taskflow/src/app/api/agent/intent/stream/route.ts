/**
 * Intent-Native Stream API Route (SSE)
 *
 * 컴파일러 아키텍처:
 * Natural Language → LLM Parser (Skeleton) → Symbol Resolver → Runtime
 *
 * 핵심 원칙: LLM 출력에 ID가 들어가면 설계가 틀린 것이다.
 *
 * Events:
 * - intent:start - 처리 시작
 * - fastpath:hit - Fast Path 힌트
 * - compiler:start - LLM Parser 시작
 * - compiler:complete - Skeleton IR 생성 완료
 * - resolver:start - Symbol Resolver 시작
 * - resolver:complete - Intent 바인딩 완료
 * - clarification:pending - Resolver 실패 → Clarification 필요
 * - runtime:execute - Runtime 실행
 * - interpreter:start - Result Interpreter 시작
 * - interpreter:complete - 응답 생성 완료
 * - done - 완료
 * - error - 에러
 */

import { NextRequest } from 'next/server';

// Serverless Function Timeout 설정 (Cold Start 대응)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import type { Intent, QueryTasksIntent } from '@/lib/agents/intent';
import type { IntentSkeleton, QueryTasksSkeleton } from '@/lib/agents/skeleton';
import { tryFastPath } from '@/lib/agents/pattern-matcher';
import { compileIntent, isCompilerSuccess } from '@/lib/agents/intent-compiler';
import { resolveSkeleton, isResolverError, generateClarificationQuestion } from '@/lib/agents/resolver';
import { executeIntent, calculateSnapshotDiff, type Snapshot } from '@/lib/agents/runtime';
import { interpretResult } from '@/lib/agents/result-interpreter';
import { executeQuery } from '@/lib/agents/query-agent';
import type { AgentEffect } from '@/lib/agents/types';
import { detectLanguageExtended } from '@/lib/agents/language-detector';
import { translateToEnglish, translateResponse, needsTranslation, type TranslationContext } from '@/lib/agents/translator';
import { createClarificationSession, getSession, deleteSession, buildClarificationContext, type ClarificationSession } from '@/lib/agents/session-store';

// ============================================
// SSE Event Types
// ============================================

type SSEEventType =
  | 'intent:start'
  | 'fastpath:hit'
  | 'translate:start'
  | 'translate:complete'
  | 'compiler:start'
  | 'compiler:complete'
  | 'resolver:start'
  | 'resolver:complete'
  | 'runtime:execute'
  | 'interpreter:start'
  | 'interpreter:complete'
  | 'clarification:pending'
  | 'done'
  | 'error';

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

// ============================================
// Request Type
// ============================================

interface IntentRequest {
  instruction: string;
  snapshot: Snapshot;
  sessionId?: string; // Clarification 후속 응답 시 세션 ID
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  const body: IntentRequest = await request.json();
  const { instruction, snapshot, sessionId } = body;

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      formatSSE({ type: 'error', data: { message: 'OPENAI_API_KEY not configured' } }),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      const startTime = Date.now();
      let llmCalls = 0;
      let translationContext: TranslationContext | null = null;

      try {
        // 0. Language Detection
        const langResult = detectLanguageExtended(instruction);
        const detectedLang = langResult.detected;
        const requiresTranslation = needsTranslation(detectedLang);

        // Start event
        send({
          type: 'intent:start',
          data: {
            instruction,
            timestamp: new Date().toISOString(),
            language: detectedLang,
            requiresTranslation,
            isFollowUp: !!sessionId,
          },
        });

        // 0.5. Translate if needed
        let translatedUserInput: string | null = null;
        if (requiresTranslation) {
          send({
            type: 'translate:start',
            data: { fromLanguage: detectedLang },
          });

          const translationResult = await translateToEnglish(instruction, detectedLang);
          translationContext = translationResult.context;
          translatedUserInput = translationContext.translatedText;
          llmCalls++;

          send({
            type: 'translate:complete',
            data: {
              translatedInstruction: translatedUserInput,
              preservedTerms: translationContext.preservedTerms,
            },
          });
        }

        // Check for clarification session follow-up
        let workingSnapshot = snapshot;
        let clarificationContext: string | null = null;
        let previousSession: ClarificationSession | null = null;

        if (sessionId) {
          const session = getSession(sessionId);
          if (session) {
            previousSession = session;
            workingSnapshot = session.snapshot;
            clarificationContext = buildClarificationContext(
              session,
              instruction,
              translatedUserInput || undefined
            );
            deleteSession(sessionId);
          }
        }

        // Determine working instructions (array for multi-instruction support)
        const workingInstructions: string[] = clarificationContext
          ? [clarificationContext]
          : translationContext?.instructions || [instruction];

        // Process each instruction and collect results
        const allSkeletons: IntentSkeleton[] = [];
        const allEffects: AgentEffect[] = [];
        let currentSnapshot = workingSnapshot;

        for (const workingInstruction of workingInstructions) {
          // 1. Try Fast Path for hints
          const fastResult = tryFastPath(workingInstruction);

          if (fastResult.hit && fastResult.hint) {
            send({
              type: 'fastpath:hit',
              data: {
                hint: fastResult.hint,
                note: 'Hint only - Compiler makes final decision',
              },
            });
          }

          // 2. LLM Skeleton Compiler
          send({
            type: 'compiler:start',
            data: { timestamp: new Date().toISOString(), instruction: workingInstruction },
          });

          const compilerResult = await compileIntent({
            instruction: workingInstruction,
            snapshot: currentSnapshot,
            hint: fastResult.hint,
          });
          llmCalls++;

          if (!isCompilerSuccess(compilerResult)) {
            send({
              type: 'error',
              data: {
                phase: 'compiler',
                message: compilerResult.message,
                type: compilerResult.type,
                raw: compilerResult.raw,
              },
            });
            continue; // Try next instruction instead of returning
          }

          const skeleton = compilerResult.skeleton;
          allSkeletons.push(skeleton);

          send({
            type: 'compiler:complete',
            data: {
              skeleton,
              confidence: skeleton.confidence,
              tokensUsed: compilerResult.trace.tokensIn,
            },
          });

          // Special handling for QueryTasks - no resolver needed
          if (skeleton.kind === 'QueryTasks') {
            send({
              type: 'interpreter:start',
              data: { effectsCount: 0 },
            });

            const queryLang = (detectedLang === 'ko' || detectedLang === 'en') ? detectedLang : 'en';
            const queryResult = await executeQuery({
              intent: skeleton as unknown as QueryTasksIntent,
              snapshot: currentSnapshot,
              language: queryLang,
            });
            llmCalls++;

            let finalAnswer = queryResult.answer;
            if (translationContext && finalAnswer) {
              const responseTranslation = await translateResponse(finalAnswer, translationContext);
              finalAnswer = responseTranslation.message;
              if (responseTranslation.trace.model !== 'passthrough') {
                llmCalls++;
              }
            }

            send({
              type: 'interpreter:complete',
              data: {
                message: finalAnswer,
                model: queryResult.trace.model,
              },
            });

            continue; // Move to next instruction
          }

          // 3. Symbol Resolver
          send({
            type: 'resolver:start',
            data: { skeletonKind: skeleton.kind },
          });

          const resolverResult = resolveSkeleton(skeleton, currentSnapshot);

          if (isResolverError(resolverResult)) {
            const error = resolverResult.error;
            const clarificationQuestion = error.suggestedQuestion;

            const newSessionId = createClarificationSession({
              skeleton,
              snapshot: currentSnapshot,
              originalInstruction: workingInstruction,
              resolverError: error,
            });

            send({
              type: 'clarification:pending',
              data: {
                reason: error.type,
                question: clarificationQuestion,
                candidates: error.candidates?.map(t => ({ id: t.id, title: t.title })),
                sessionId: newSessionId,
              },
            });

            continue; // Move to next instruction
          }

          // Resolver succeeded
          const intent = resolverResult.data.intent;

          send({
            type: 'resolver:complete',
            data: {
              intent,
              resolvedTask: resolverResult.data.resolvedTask?.title,
            },
          });

          // 4. Runtime Execution
          send({
            type: 'runtime:execute',
            data: { intentKind: intent.kind },
          });

          const executionResult = executeIntent(intent, currentSnapshot);

          if (!executionResult.success) {
            send({
              type: 'error',
              data: {
                phase: 'runtime',
                message: executionResult.error,
              },
            });
            continue; // Move to next instruction
          }

          const effects = executionResult.effects;
          allEffects.push(...effects);

          // Update snapshot for next instruction
          currentSnapshot = applyEffectsToSnapshot(currentSnapshot, effects);
        } // End of for loop

        // 5. Final Result Interpretation (for all effects)
        if (allEffects.length > 0 || allSkeletons.length > 0) {
          const snapshotDiff = calculateSnapshotDiff(workingSnapshot, currentSnapshot);

          send({
            type: 'interpreter:start',
            data: { effectsCount: allEffects.length, skeletonCount: allSkeletons.length },
          });

          const interpreterLang = (detectedLang === 'ko' || detectedLang === 'en') ? detectedLang : 'en';
          const lastSkeleton = allSkeletons[allSkeletons.length - 1];
          const interpreterResult = await interpretResult({
            intent: lastSkeleton as unknown as Intent,
            effects: allEffects,
            snapshotDiff,
            snapshot: currentSnapshot,
            language: interpreterLang,
          });

          if (interpreterResult.trace.model !== 'local' && interpreterResult.trace.model !== 'fallback') {
            llmCalls++;
          }

          let finalMessage = interpreterResult.message;
          if (translationContext && finalMessage) {
            const responseTranslation = await translateResponse(finalMessage, translationContext);
            finalMessage = responseTranslation.message;
            if (responseTranslation.trace.model !== 'passthrough') {
              llmCalls++;
            }
          }

          send({
            type: 'interpreter:complete',
            data: {
              message: finalMessage,
              model: interpreterResult.trace.model,
            },
          });

          // Done
          send({
            type: 'done',
            data: {
              success: true,
              skeletons: allSkeletons,
              effects: allEffects,
              message: finalMessage,
              trace: {
                fastPath: false,
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
              },
            },
          });
        } else {
          send({
            type: 'done',
            data: {
              success: false,
              message: 'No valid instructions processed',
              trace: {
                fastPath: false,
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
              },
            },
          });
        }
      } catch (error) {
        send({
          type: 'error',
          data: {
            phase: 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
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
          // Handle new format: data.tasks.id:taskId.field
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
