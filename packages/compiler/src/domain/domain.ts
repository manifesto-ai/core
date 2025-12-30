import { z } from "zod";
import { defineDomain } from "@manifesto-ai/builder";
import {
  CompilerStateSchema,
  NormalizedIntentSchema,
  ResolutionOptionSchema,
  CompilerDiagnosticsSchema,
  INITIAL_STATE,
} from "./schema.js";

/**
 * CompilerDomain - Manifesto Application for compiling natural language to DomainSchema
 *
 * Per FDR-C001: Compiler MUST be implemented as a Manifesto Application (dogfooding).
 * Per SPEC.md §5: Complete domain definition with computed values and actions.
 *
 * Note: Due to TypeScript limitations with the Builder DSL generics,
 * some type assertions are necessary. The runtime behavior is correct.
 */
export const CompilerDomain = defineDomain(
  CompilerStateSchema,
  ({ state, computed, actions, expr, flow }) => {
    // ════════════════════════════════════════════════════════════════════════
    // Computed Values (SPEC.md §5.1)
    // ════════════════════════════════════════════════════════════════════════

    const {
      isIdle,
      isSegmenting,
      isNormalizing,
      isProposing,
      isValidating,
      isAwaitingResolution,
      isTerminal,
      canRetry,
    } = computed.define({
      isIdle: expr.eq(state.status, "idle"),
      isSegmenting: expr.eq(state.status, "segmenting"),
      isNormalizing: expr.eq(state.status, "normalizing"),
      isProposing: expr.eq(state.status, "proposing"),
      isValidating: expr.eq(state.status, "validating"),
      isAwaitingResolution: expr.eq(state.status, "awaiting_resolution"),
      isTerminal: expr.or(
        expr.eq(state.status, "success"),
        expr.eq(state.status, "discarded")
      ),
      canRetry: expr.lt(state.attemptCount, state.maxRetries),
    });

    // ════════════════════════════════════════════════════════════════════════
    // Actions (SPEC.md §5.2)
    // ════════════════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────────────────
    // start - Initiates compilation pipeline (§5.2.1)
    // ─────────────────────────────────────────────────────────────────────────
    const { start } = actions.define({
      start: {
        description: "Start Compilation",
        input: z.object({
          text: z.string(),
          schema: z.unknown().optional(),
          context: z
            .object({
              domainName: z.string().optional(),
              existingActions: z.array(z.string()).optional(),
              glossary: z.record(z.string(), z.string()).optional(),
            })
            .optional(),
          maxRetries: z.number().optional(),
          traceDrafts: z.boolean().optional(),
        }),
        available: isIdle,
        flow: flow.seq(
          flow.patch(state.input).set(expr.input<string>("text")),
          flow.patch(state.targetSchema).set(expr.input("schema")),
          flow.patch(state.context).set(expr.input("context") as never),
          flow.patch(state.maxRetries).set(
            expr.coalesce(expr.input<number | undefined>("maxRetries"), 5) as never
          ),
          flow.patch(state.traceDrafts).set(
            expr.coalesce(expr.input<boolean | undefined>("traceDrafts"), false) as never
          ),
          flow.patch(state.status).set("segmenting"),
          flow.effect("llm:segment", {
            text: expr.input("text"),
          })
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // receiveSegments - Receives segmentation result from LLM (§5.2.2)
    // ─────────────────────────────────────────────────────────────────────────
    const { receiveSegments } = actions.define({
      receiveSegments: {
        description: "Receive Segmentation Result",
        input: z.object({
          segments: z.array(z.string()),
        }),
        available: isSegmenting,
        flow: flow.seq(
          flow.patch(state.segments).set(expr.input<string[]>("segments")),
          flow.when(
            expr.eq(expr.len(expr.input<string[]>("segments")), 0),
            // Empty → discard
            flow.seq(
              flow.patch(state.status).set("discarded"),
              flow.patch(state.discardReason).set("SEGMENTATION_FAILED")
            ),
            // Has segments → normalize
            flow.seq(
              flow.patch(state.status).set("normalizing"),
              flow.effect("llm:normalize", {
                segments: expr.input("segments"),
                schema: state.targetSchema,
                context: state.context,
              })
            )
          )
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // receiveIntents - Receives normalization result from LLM (§5.2.3)
    // ─────────────────────────────────────────────────────────────────────────
    const { receiveIntents } = actions.define({
      receiveIntents: {
        description: "Receive Normalization Result",
        input: z.object({
          intents: z.array(NormalizedIntentSchema),
        }),
        available: isNormalizing,
        flow: flow.seq(
          flow.patch(state.intents).set(expr.input("intents") as never),
          flow.patch(state.status).set("proposing"),
          flow.effect("llm:propose", {
            schema: state.targetSchema,
            intents: expr.input("intents"),
            history: state.attempts,
            context: state.context,
          })
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // receiveDraft - Receives draft proposal from LLM (§5.2.4)
    // ─────────────────────────────────────────────────────────────────────────
    const { receiveDraft } = actions.define({
      receiveDraft: {
        description: "Receive Draft Proposal",
        input: z.object({
          draft: z.unknown(),
        }),
        available: isProposing,
        flow: flow.seq(
          flow.patch(state.currentDraft).set(expr.input("draft")),
          flow.patch(state.status).set("validating"),
          flow.effect("builder:validate", {
            draft: expr.input("draft"),
          })
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // receiveValidation - Receives validation result from Builder (§5.2.5)
    //
    // Per FDR-C002: LLM is untrusted proposer, Builder is the judge.
    // Per FDR-C007: Timestamps from effect handlers, not expressions.
    // Per FDR-C008: Single retry counter increment point (here, on failure+retry).
    // ─────────────────────────────────────────────────────────────────────────
    const { receiveValidation } = actions.define({
      receiveValidation: {
        description: "Receive Validation Result",
        input: z.object({
          valid: z.boolean(),
          schema: z.unknown().nullable(),
          diagnostics: CompilerDiagnosticsSchema.nullable(),
          schemaHash: z.string().nullable(),
          timestamp: z.number(),
        }),
        available: isValidating,
        flow: flow.seq(
          flow.patch(state.diagnostics).set(expr.input("diagnostics") as never),
          flow.when(
            expr.input<boolean>("valid"),
            // ─── Success ───
            flow.seq(
              flow.patch(state.result).set(expr.input("schema")),
              flow.patch(state.resultHash).set(expr.input("schemaHash") as never),
              flow.patch(state.status).set("success")
            ),
            // ─── Failure ───
            flow.seq(
              // Check retry eligibility (FDR-C008)
              flow.when(
                canRetry,
                // ─── Retry ───
                flow.seq(
                  flow.patch(state.attemptCount).set(expr.add(state.attemptCount, 1)),
                  flow.patch(state.status).set("proposing"),
                  flow.effect("llm:propose", {
                    schema: state.targetSchema,
                    intents: state.intents,
                    history: state.attempts,
                    context: state.context,
                  })
                ),
                // ─── Max retries exceeded ───
                flow.seq(
                  flow.patch(state.status).set("discarded"),
                  flow.patch(state.discardReason).set("MAX_RETRIES_EXCEEDED")
                )
              )
            )
          )
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // requestResolution - Transitions to resolution state (§5.2.6)
    // Per FDR-C004: ITL-agnostic resolution - Compiler doesn't know who resolves.
    // ─────────────────────────────────────────────────────────────────────────
    const { requestResolution } = actions.define({
      requestResolution: {
        description: "Request Resolution",
        input: z.object({
          reason: z.string(),
          options: z.array(ResolutionOptionSchema),
        }),
        available: expr.or(isNormalizing, isProposing),
        flow: flow.seq(
          flow.patch(state.resolutionReason).set(expr.input<string>("reason")),
          flow.patch(state.resolutionOptions).set(expr.input("options") as never),
          flow.patch(state.status).set("awaiting_resolution")
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // resolve - Resolves ambiguity and resumes pipeline (§5.2.7)
    // Called by external system (HITL or AITL).
    // ─────────────────────────────────────────────────────────────────────────
    const { resolve } = actions.define({
      resolve: {
        description: "Resolve Ambiguity",
        input: z.object({
          selectedOptionId: z.string(),
        }),
        available: isAwaitingResolution,
        flow: flow.seq(
          // Clear resolution state
          flow.patch(state.resolutionOptions).set([]),
          flow.patch(state.resolutionReason).set(expr.lit(null) as never),
          // Resume at proposing
          flow.patch(state.status).set("proposing"),
          flow.effect("llm:propose", {
            schema: state.targetSchema,
            intents: state.intents,
            history: state.attempts,
            context: state.context,
            resolution: expr.input("selectedOptionId"),
          })
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // discard - Discards compilation (§5.2.8)
    // Per FDR-C005: Resolution policy determines when this is auto-called.
    // ─────────────────────────────────────────────────────────────────────────
    const { discard } = actions.define({
      discard: {
        description: "Discard Compilation",
        input: z.object({
          reason: z.enum([
            "RESOLUTION_REQUIRED_BUT_DISABLED",
            "MAX_RETRIES_EXCEEDED",
            "EMPTY_INPUT",
            "SEGMENTATION_FAILED",
          ]),
        }),
        available: expr.not(isTerminal),
        flow: flow.seq(
          flow.patch(state.resolutionOptions).set([]),
          flow.patch(state.resolutionReason).set(expr.lit(null) as never),
          flow.patch(state.status).set("discarded"),
          flow.patch(state.discardReason).set(expr.input("reason") as never)
        ),
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // reset - Resets compiler to initial state (§5.2.9)
    // ─────────────────────────────────────────────────────────────────────────
    const { reset } = actions.define({
      reset: {
        description: "Reset Compiler",
        input: z.object({}),
        available: isTerminal,
        flow: flow.seq(
          flow.patch(state.input).set(expr.lit(null) as never),
          flow.patch(state.targetSchema).set(expr.lit(null)),
          flow.patch(state.context).set(expr.lit(null) as never),
          flow.patch(state.segments).set([]),
          flow.patch(state.intents).set([]),
          flow.patch(state.currentDraft).set(expr.lit(null)),
          flow.patch(state.diagnostics).set(expr.lit(null) as never),
          flow.patch(state.attemptCount).set(0),
          flow.patch(state.attempts).set([]),
          flow.patch(state.resolutionOptions).set([]),
          flow.patch(state.resolutionReason).set(expr.lit(null) as never),
          flow.patch(state.status).set("idle"),
          flow.patch(state.result).set(expr.lit(null)),
          flow.patch(state.resultHash).set(expr.lit(null) as never),
          flow.patch(state.discardReason).set(expr.lit(null) as never)
        ),
      },
    });

    // ════════════════════════════════════════════════════════════════════════
    // Return Domain Output
    // ════════════════════════════════════════════════════════════════════════

    // Note: Type assertion needed due to Builder DSL generic limitations
    // The runtime types are correct, but TypeScript cannot infer them properly
    return {
      computed: {
        isIdle,
        isSegmenting,
        isNormalizing,
        isProposing,
        isValidating,
        isAwaitingResolution,
        isTerminal,
        canRetry,
      },
      actions: {
        start,
        receiveSegments,
        receiveIntents,
        receiveDraft,
        receiveValidation,
        requestResolution,
        resolve,
        discard,
        reset,
      },
    } as ReturnType<Parameters<typeof defineDomain>[1]>;
  },
  {
    id: "manifesto:compiler",
    version: "1.0.0",
    meta: {
      name: "Compiler Domain",
      description:
        "Manifesto compiler implemented as a Manifesto application (dogfooding per FDR-C001)",
    },
  }
);

export { INITIAL_STATE };
