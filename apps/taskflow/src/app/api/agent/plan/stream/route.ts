/**
 * Plan-Native Stream API Route (SSE)
 *
 * PR4 아키텍처:
 * Natural Language → Planner(LLM) → Preflight(Resolver+Policy) → Executor(Transaction)
 *
 * Events:
 * - plan:start - 처리 시작
 * - translate:start/complete - 번역
 * - planner:start/complete - LLM Planner
 * - preflight:start/complete - Preflight 검증
 * - tx:start - Transaction 시작
 * - tx:step:start/complete - 각 Step 실행
 * - tx:confirm:pending - Confirm 대기
 * - tx:complete - Transaction 완료
 * - tx:rollback - 롤백
 * - interpreter:complete - 응답 생성 완료
 * - clarification:pending - Resolver 실패
 * - done - 완료
 * - error - 에러
 */

import { NextRequest } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import type { Intent, QueryTasksIntent } from '@/lib/agents/intent';
import { createPlan, extractFirstSkeleton, isPlannerSuccess } from '@/lib/agents/planner';
import { runPreflight, isPreflightSuccess, isPreflightError, type ExecutablePlan } from '@/lib/agents/preflight';
import {
  executeTransaction,
  continueAfterConfirm,
  isTransactionSuccess,
  isTransactionFailure,
  isConfirmPending,
  type ConfirmPending,
} from '@/lib/agents/executor';
import { calculateSnapshotDiff, type Snapshot } from '@/lib/agents/runtime';
import { interpretResult } from '@/lib/agents/result-interpreter';
import { executeQuery } from '@/lib/agents/query-agent';
import type { AgentEffect } from '@/lib/agents/types';
import { detectLanguageExtended } from '@/lib/agents/language-detector';
import { translateToEnglish, translateResponse, needsTranslation, type TranslationContext } from '@/lib/agents/translator';
import {
  createClarificationSession,
  createConfirmSession,
  getConfirmSession,
  deleteConfirmSession,
} from '@/lib/agents/session-store';
import type { Plan } from '@/lib/agents/plan';

// ============================================
// SSE Event Types
// ============================================

type SSEEventType =
  | 'plan:start'
  | 'translate:start'
  | 'translate:complete'
  | 'planner:start'
  | 'planner:complete'
  | 'preflight:start'
  | 'preflight:complete'
  | 'tx:start'
  | 'tx:step:start'
  | 'tx:step:complete'
  | 'tx:confirm:pending'
  | 'tx:complete'
  | 'tx:rollback'
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

interface PlanRequest {
  instruction: string;
  snapshot: Snapshot;
  confirmSessionId?: string;
  approved?: boolean;
}

// ============================================
// Main Handler
// ============================================

export async function POST(request: NextRequest) {
  const body: PlanRequest = await request.json();
  const { instruction, snapshot, confirmSessionId, approved } = body;

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
        // ============================================
        // Confirm Continuation (if confirmSessionId provided)
        // ============================================
        if (confirmSessionId && approved !== undefined) {
          const confirmSession = getConfirmSession(confirmSessionId);

          if (!confirmSession) {
            send({
              type: 'error',
              data: { phase: 'confirm', message: 'Confirm session expired or not found' },
            });
            return;
          }

          send({
            type: 'tx:start',
            data: {
              continuation: true,
              approved,
              message: confirmSession.pending.message,
            },
          });

          const continuationResult = await continueAfterConfirm(confirmSession.pending, approved);
          deleteConfirmSession(confirmSessionId);

          if (isTransactionFailure(continuationResult)) {
            send({
              type: 'tx:rollback',
              data: {
                failedAt: continuationResult.failedAt,
                reason: continuationResult.error,
              },
            });
            send({
              type: 'done',
              data: {
                success: false,
                rolledBack: true,
                error: continuationResult.error,
                trace: {
                  llmCalls: 0,
                  durationMs: Date.now() - startTime,
                  architecture: 'plan-native-pr4',
                },
              },
            });
            return;
          }

          // Success
          send({
            type: 'tx:complete',
            data: {
              effectCount: continuationResult.effects.length,
              trace: continuationResult.trace,
            },
          });

          send({
            type: 'done',
            data: {
              success: true,
              effects: continuationResult.effects,
              message: approved ? 'Operation completed.' : 'Operation cancelled.',
              trace: {
                llmCalls: 0,
                durationMs: Date.now() - startTime,
                architecture: 'plan-native-pr4',
              },
            },
          });
          return;
        }

        // ============================================
        // Normal Flow: Planner → Preflight → Executor
        // ============================================

        // 0. Language Detection
        const langResult = detectLanguageExtended(instruction);
        const detectedLang = langResult.detected;
        const requiresTranslation = needsTranslation(detectedLang);

        send({
          type: 'plan:start',
          data: {
            instruction,
            timestamp: new Date().toISOString(),
            language: detectedLang,
            requiresTranslation,
            architecture: 'plan-native-pr4',
          },
        });

        // 1. Translate if needed
        let translatedInstructions: string[] | undefined;

        if (requiresTranslation) {
          send({
            type: 'translate:start',
            data: { fromLanguage: detectedLang },
          });

          const translationResult = await translateToEnglish(instruction, detectedLang);
          translationContext = translationResult.context;
          translatedInstructions = translationContext.instructions;
          llmCalls++;

          send({
            type: 'translate:complete',
            data: {
              instructions: translatedInstructions,
              preservedTerms: translationContext.preservedTerms,
            },
          });
        }

        // 2. LLM Planner
        send({
          type: 'planner:start',
          data: { timestamp: new Date().toISOString() },
        });

        const plannerResult = await createPlan({
          instruction,
          snapshot,
          translatedInstructions,
        });
        llmCalls++;

        if (!isPlannerSuccess(plannerResult)) {
          send({
            type: 'error',
            data: {
              phase: 'planner',
              message: plannerResult.message,
              type: plannerResult.type,
              raw: plannerResult.raw,
            },
          });
          return;
        }

        const plan = plannerResult.plan;

        send({
          type: 'planner:complete',
          data: {
            plan,
            stepCount: plan.steps.length,
            risk: plan.risk,
            tokensUsed: plannerResult.trace.tokensIn,
          },
        });

        // 3. Handle QueryTasks specially (read-only, no preflight needed)
        const firstSkeleton = extractFirstSkeleton(plan);
        if (firstSkeleton?.kind === 'QueryTasks') {
          const queryLang = (detectedLang === 'ko' || detectedLang === 'en') ? detectedLang : 'en';
          const queryResult = await executeQuery({
            intent: firstSkeleton as unknown as QueryTasksIntent,
            snapshot,
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
            data: { message: finalAnswer, model: queryResult.trace.model },
          });

          send({
            type: 'done',
            data: {
              success: true,
              plan,
              message: finalAnswer,
              trace: {
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
                architecture: 'plan-native-pr4',
              },
            },
          });
          return;
        }

        // 4. Preflight (Resolver + Policy)
        send({
          type: 'preflight:start',
          data: { stepCount: plan.steps.length },
        });

        const preflightResult = runPreflight(plan, snapshot);

        if (isPreflightError(preflightResult)) {
          const clarification = preflightResult.needsClarification;

          const sessionId = createClarificationSession({
            skeleton: clarification.failedSkeleton!,
            snapshot,
            originalInstruction: instruction,
            resolverError: {
              type: clarification.reason === 'AMBIGUOUS_TARGET' ? 'ambiguous' : 'not_found',
              message: clarification.message,
              hint: (clarification.failedSkeleton as { targetHint?: string })?.targetHint || '',
              suggestedQuestion: clarification.question,
              candidates: clarification.candidates?.map(c => ({
                id: c.id,
                title: c.title,
                description: null,
                status: 'todo' as const,
                priority: 'medium' as const,
                assignee: null,
                dueDate: null,
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              })),
            },
          });

          send({
            type: 'clarification:pending',
            data: {
              reason: clarification.reason,
              question: clarification.question,
              candidates: clarification.candidates,
              sessionId,
            },
          });

          send({
            type: 'done',
            data: {
              success: false,
              plan,
              needsClarification: true,
              sessionId,
              trace: {
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
                architecture: 'plan-native-pr4',
              },
            },
          });
          return;
        }

        const executable = preflightResult.executable;

        send({
          type: 'preflight:complete',
          data: {
            boundStepCount: executable.boundSteps.length,
            risk: executable.risk,
            warnings: preflightResult.warnings,
          },
        });

        // 5. Transaction Executor
        send({
          type: 'tx:start',
          data: {
            stepCount: executable.boundSteps.length,
            risk: executable.risk,
          },
        });

        const executionResult = await executeTransaction(executable, snapshot);

        // Handle ConfirmPending
        if (isConfirmPending(executionResult)) {
          const confirmSessionId = createConfirmSession({
            pending: executionResult,
            originalInstruction: instruction,
            snapshot,
            plan,
          });

          send({
            type: 'tx:confirm:pending',
            data: {
              sessionId: confirmSessionId,
              message: executionResult.message,
              remainingSteps: executionResult.remainingSteps.length,
            },
          });

          send({
            type: 'done',
            data: {
              success: false,
              plan,
              confirmRequired: true,
              confirmSessionId,
              confirmMessage: executionResult.message,
              trace: {
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
                architecture: 'plan-native-pr4',
              },
            },
          });
          return;
        }

        // Handle Failure (Rollback)
        if (isTransactionFailure(executionResult)) {
          send({
            type: 'tx:rollback',
            data: {
              failedAt: executionResult.failedAt,
              stepKind: executionResult.stepKind,
              reason: executionResult.error,
              trace: executionResult.trace,
            },
          });

          send({
            type: 'done',
            data: {
              success: false,
              plan,
              rolledBack: true,
              error: executionResult.error,
              trace: {
                llmCalls,
                durationMs: Date.now() - startTime,
                language: detectedLang,
                translated: requiresTranslation,
                architecture: 'plan-native-pr4',
              },
            },
          });
          return;
        }

        // Success
        const effects = executionResult.effects;
        const finalSnapshot = executionResult.finalSnapshot;
        const snapshotDiff = calculateSnapshotDiff(snapshot, finalSnapshot);

        send({
          type: 'tx:complete',
          data: {
            effectCount: effects.length,
            trace: executionResult.trace,
            variables: executionResult.variables,
          },
        });

        // 6. Result Interpretation
        const interpreterLang = (detectedLang === 'ko' || detectedLang === 'en') ? detectedLang : 'en';
        const interpreterResult = await interpretResult({
          intent: firstSkeleton as unknown as Intent,
          effects,
          snapshotDiff,
          snapshot: finalSnapshot,
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

        // 7. Done
        send({
          type: 'done',
          data: {
            success: true,
            plan,
            effects,
            message: finalMessage,
            trace: {
              llmCalls,
              durationMs: Date.now() - startTime,
              language: detectedLang,
              translated: requiresTranslation,
              architecture: 'plan-native-pr4',
              executionTrace: executionResult.trace,
            },
          },
        });
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
