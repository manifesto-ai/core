/**
 * @manifesto-ai/compiler v1.1 Compiler API
 *
 * ManifestoCompiler - Implementation of the Compiler interface.
 * Per FDR-C001: Compiler is implemented as a Manifesto Application.
 *
 * Pipeline: Plan → Generate → Lower → Link → Verify → Emit
 */

import { createHost, createIntent, type ManifestoHost, type Snapshot } from "@manifesto-ai/host";
import { CompilerDomain, INITIAL_STATE } from "../domain/domain.js";
import type {
  Compiler,
  CompilerSnapshot,
  CompilerState,
  CompilerStatus,
  CompileInput,
  Unsubscribe,
  FailureReason,
  LLMAdapter,
  ResolutionPolicy,
  CompilerTelemetry,
  CompilerEffectType,
} from "../domain/types.js";
import {
  createLLMEffectHandlers,
  type EffectHandlerResult,
} from "../effects/llm/handlers.js";
import {
  createPassLayer,
  createLinker,
  createVerifier,
  createEmitter,
  PASS_LAYER_VERSION,
  LINKER_VERSION,
  COMPILER_VERSION,
} from "../pipeline/index.js";
import { nanoid } from "nanoid";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Default Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_RESOLUTION_POLICY: ResolutionPolicy = {
  onPlanDecision: "await",
  onDraftDecision: "auto-accept",
  onConflictResolution: "await",
};

// ═══════════════════════════════════════════════════════════════════════════════
// §2 ManifestoCompiler Implementation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ManifestoCompiler - Implementation of the Compiler interface
 *
 * Per FDR-C001: Compiler is implemented as a Manifesto Application.
 * This class wraps the CompilerDomain Host and provides the public API.
 */
export class ManifestoCompiler implements Compiler {
  private host: ManifestoHost;
  private listeners: Set<(state: CompilerSnapshot) => void> = new Set();
  private effectHandlers: Record<string, (params: Record<string, unknown>) => Promise<EffectHandlerResult>>;
  private policy: ResolutionPolicy;
  private telemetry?: CompilerTelemetry;
  private previousStatus: CompilerStatus = "idle";

  // Stored source input (workaround for Builder not resolving expressions in objects)
  private currentSourceInput: {
    id: string;
    type: "natural-language" | "code" | "mixed";
    content: string;
    receivedAt: number;
  } | null = null;

  // Pipeline components
  private passLayer = createPassLayer();
  private linker = createLinker();
  private verifier = createVerifier();
  private emitter = createEmitter();

  constructor(
    adapter: LLMAdapter,
    options: {
      resolutionPolicy?: Partial<ResolutionPolicy>;
      telemetry?: CompilerTelemetry;
      config?: {
        maxPlanAttempts?: number;
        maxDraftAttempts?: number;
        maxLoweringRetries?: number;
      };
    } = {}
  ) {
    this.policy = { ...DEFAULT_RESOLUTION_POLICY, ...options.resolutionPolicy };
    this.telemetry = options.telemetry;

    // Create LLM effect handlers
    const llmHandlers = createLLMEffectHandlers(adapter, this.policy);

    // Create pipeline effect handlers
    this.effectHandlers = {
      ...llmHandlers,
      "pass:lower": this.createPassLowerHandler(),
      "linker:link": this.createLinkerLinkHandler(),
      "verifier:verify": this.createVerifierVerifyHandler(),
      "emitter:emit": this.createEmitterEmitHandler(),
    };

    // Create Host with CompilerDomain
    this.host = createHost(CompilerDomain.schema, {
      initialData: {
        ...INITIAL_STATE,
        config: {
          ...INITIAL_STATE.config,
          ...options.config,
        },
      },
    });

    // Register effect handlers with Host
    // Note: The Host calls these with unresolved expression objects from domain flows.
    // The actual effect execution happens in dispatchWithEffectLoop with resolved data.
    for (const [type] of Object.entries(this.effectHandlers)) {
      this.host.registerEffect(type, async (effectType, params) => {
        if (process.env.DEBUG) {
          console.log(`[Host Effect] ${effectType} called with params:`, JSON.stringify(params)?.slice(0, 200));
        }
        // Return empty array - effects are handled in dispatchWithEffectLoop
        return [];
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.1 Pipeline Effect Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  private createPassLowerHandler(): (params: Record<string, unknown>) => Promise<EffectHandlerResult> {
    return async (params) => {
      const drafts = params.drafts as unknown[];
      const sourceInputId = params.sourceInputId as string;
      const sourceType = params.sourceType as "natural-language" | "code" | "mixed";
      const planId = params.planId as string;

      const context = {
        sourceInputId,
        sourceType,
        planId,
        actorId: "compiler",
        runtimeId: "manifesto-compiler",
        passLayerVersion: PASS_LAYER_VERSION,
        linkerVersion: LINKER_VERSION,
      };

      const fragments = [];
      const issues = [];

      for (const draft of drafts) {
        const result = this.passLayer.lower(draft as never, context);
        if (result.ok) {
          fragments.push(result.fragment);
        } else {
          issues.push(...result.issues);
        }
      }

      // Check for errors (any issue with severity "error")
      const hasErrors = issues.some((issue: { severity?: string }) => issue.severity === "error");

      return {
        action: "receiveLoweredFragments",
        input: { fragments, issues, hasErrors },
      };
    };
  }

  private createLinkerLinkHandler(): (params: Record<string, unknown>) => Promise<EffectHandlerResult> {
    return async (params) => {
      const fragments = params.fragments as unknown[];
      const sourceInputId = params.sourceInputId as string;
      const planId = params.planId as string;

      const context = { sourceInputId, planId };
      const result = this.linker.link(fragments as never[], context);

      if (result.ok === true) {
        return {
          action: "receiveLinkResult",
          input: { domainDraft: result.domainDraft, conflicts: [], hasConflicts: false },
        };
      }

      // Conflict detected
      return {
        action: "receiveLinkResult",
        input: {
          domainDraft: null,
          conflicts: result.conflicts,
          hasConflicts: true,
          pendingResolution: {
            id: `resolution_${Date.now()}`,
            stage: "link",
            reason: `${result.conflicts.length} conflict(s) detected`,
            conflicts: result.conflicts,
            options: result.options,
            context: { sourceInputId, planId },
          },
        },
      };
    };
  }

  private createVerifierVerifyHandler(): (params: Record<string, unknown>) => Promise<EffectHandlerResult> {
    return async (params) => {
      const domainDraft = params.domainDraft as unknown;
      const result = this.verifier.verify(domainDraft as never);

      return {
        action: "receiveVerification",
        input: { valid: result.valid, issues: result.issues },
      };
    };
  }

  private createEmitterEmitHandler(): (params: Record<string, unknown>) => Promise<EffectHandlerResult> {
    return async (params) => {
      const domainDraft = params.domainDraft as unknown;
      const verification = params.verification as { valid: boolean; issues: unknown[] };

      const context = { compilerVersion: COMPILER_VERSION };
      const result = this.emitter.emit(domainDraft as never, verification as never, context);

      if (result.ok) {
        return {
          action: "receiveEmitted",
          input: { domainSpec: result.domainSpec },
        };
      }

      return {
        action: "fail",
        input: { reason: "EMISSION_FAILED" },
      };
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.2 Public API - Core
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start compilation with input
   */
  async start(input: CompileInput): Promise<void> {
    const inputId = `input_${nanoid(8)}`;
    const inputType = input.type ?? "natural-language";
    const timestamp = Date.now();

    // Store source input for effect handler (workaround for Builder expression resolution)
    this.currentSourceInput = {
      id: inputId,
      type: inputType,
      content: input.text,
      receivedAt: timestamp,
    };

    const intent = createIntent("start", {
      id: inputId,
      text: input.text,
      type: inputType,
      timestamp,
      config: input.config,
    });

    await this.dispatchWithEffectLoop(intent);
  }

  /**
   * Get current snapshot
   */
  async getSnapshot(): Promise<CompilerSnapshot> {
    const snapshot = await this.host.getSnapshot();
    if (!snapshot) {
      throw new Error("Host not initialized");
    }
    return this.toCompilerSnapshot(snapshot);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: CompilerSnapshot) => void): Unsubscribe {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Dispatch an action
   */
  async dispatch(action: string, input?: unknown): Promise<void> {
    const intent = createIntent(action, input ?? {});
    await this.dispatchWithEffectLoop(intent);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.3 Public API - Plan Phase
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Accept the current plan and proceed to generation
   */
  async acceptPlan(): Promise<void> {
    await this.dispatch("acceptPlan", {});
  }

  /**
   * Reject the current plan with reason
   */
  async rejectPlan(reason: string): Promise<void> {
    await this.dispatch("rejectPlan", { reason });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.4 Public API - Generate Phase
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Accept a fragment draft
   */
  async acceptDraft(draftId: string): Promise<void> {
    await this.dispatch("acceptDraft", { draftId });
  }

  /**
   * Reject a fragment draft with reason
   */
  async rejectDraft(draftId: string, reason: string): Promise<void> {
    await this.dispatch("rejectDraft", { draftId, reason });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.5 Public API - Conflict Resolution
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve a conflict by selecting an option
   */
  async resolveConflict(resolutionId: string, selectedOptionId: string): Promise<void> {
    await this.dispatch("resolveConflict", {
      response: {
        requestId: resolutionId,
        selectedOptionId,
        decidedBy: { kind: "human", actorId: "user" },
        timestamp: Date.now(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.6 Public API - Terminal
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fail the compilation with a reason
   */
  async fail(reason: FailureReason): Promise<void> {
    await this.dispatch("fail", { reason });
  }

  /**
   * Reset to idle state
   */
  async reset(): Promise<void> {
    this.currentSourceInput = null;
    await this.dispatch("reset", {});
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §2.7 Private - Effect Loop
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Dispatch intent and handle effects in a loop
   */
  private async dispatchWithEffectLoop(intent: ReturnType<typeof createIntent>): Promise<void> {
    try {
      // Dispatch the initial intent
      const result = await this.host.dispatch(intent);

      if (process.env.DEBUG) {
        console.log("[Compiler] Dispatch result:", {
          action: intent.type,
          hostStatus: result.status,
          error: result.error,
          stateStatus: (result.snapshot.data as CompilerState).status,
        });
      }

      // Get the current snapshot
      let snapshot = result.snapshot;
      let compilerSnapshot = this.toCompilerSnapshot(snapshot);

      // Emit initial phase change
      this.emitPhaseChange(compilerSnapshot);

      // Process pending effects
      while (this.hasPendingEffects(snapshot)) {
        const effects = this.extractPendingEffects(snapshot);

        for (const effect of effects) {
          let nextIntent;

          // Handle auto-actions (dispatch directly as domain actions)
          if (effect.isAutoAction && effect.type.startsWith("action:")) {
            const actionName = effect.type.replace("action:", "");
            nextIntent = createIntent(actionName, effect.params);
          } else {
            // Execute effect with telemetry
            const handlerResult = await this.executeEffect(effect.type, effect.params);
            nextIntent = createIntent(handlerResult.action, handlerResult.input);
          }

          // Dispatch the resulting action
          const nextResult = await this.host.dispatch(nextIntent);
          snapshot = nextResult.snapshot;
          compilerSnapshot = this.toCompilerSnapshot(snapshot);

          // Emit phase change
          this.emitPhaseChange(compilerSnapshot);
        }
      }

      // Notify listeners
      await this.notifyListeners();
    } catch (error) {
      this.telemetry?.onError?.(error as Error, `dispatch:${intent.type}`);
      throw error;
    }
  }

  /**
   * Check if snapshot has pending effects or auto-accept decisions
   */
  private hasPendingEffects(snapshot: Snapshot): boolean {
    const data = snapshot.data as CompilerState;
    const status = data.status;

    // Effects are triggered during these states
    if (
      status === "planning" ||
      status === "generating" ||
      status === "lowering" ||
      status === "linking" ||
      status === "verifying" ||
      status === "emitting"
    ) {
      return true;
    }

    // Auto-accept decisions
    if (status === "awaiting_plan_decision" && this.policy.onPlanDecision === "auto-accept") {
      return true;
    }
    if (status === "awaiting_draft_decision" && this.policy.onDraftDecision === "auto-accept") {
      return true;
    }

    return false;
  }

  /**
   * Extract pending effects from snapshot
   */
  private extractPendingEffects(snapshot: Snapshot): Array<{ type: string; params: Record<string, unknown>; isAutoAction?: boolean }> {
    const data = snapshot.data as CompilerState;
    const status = data.status;

    switch (status) {
      case "planning":
        // Use stored sourceInput since Builder doesn't resolve expressions in objects
        return [{
          type: "llm:plan",
          params: { sourceInput: this.currentSourceInput },
        }];

      case "awaiting_plan_decision":
        // Auto-accept plan
        if (this.policy.onPlanDecision === "auto-accept") {
          return [{
            type: "action:acceptPlan",
            params: {},
            isAutoAction: true,
          }];
        }
        return [];

      case "generating":
        return [{
          type: "llm:generate",
          params: {
            chunk: data.chunks[data.currentChunkIndex],
            plan: data.plan,
            existingFragments: data.fragments,
          },
        }];

      case "awaiting_draft_decision":
        // Auto-accept draft
        if (this.policy.onDraftDecision === "auto-accept") {
          const drafts = Array.isArray(data.fragmentDrafts) ? data.fragmentDrafts : [];
          const pendingDraft = drafts.find(d => d.status === "pending");
          if (pendingDraft) {
            return [{
              type: "action:acceptDraft",
              params: { draftId: pendingDraft.id },
              isAutoAction: true,
            }];
          }
        }
        return [];

      case "lowering":
        return [{
          type: "pass:lower",
          params: {
            drafts: data.fragmentDrafts,
            sourceInputId: data.sourceInput?.id,
            sourceType: data.sourceInput?.type,
            planId: data.plan?.id,
          },
        }];

      case "linking":
        return [{
          type: "linker:link",
          params: {
            fragments: data.fragments,
            sourceInputId: data.sourceInput?.id,
            planId: data.plan?.id,
          },
        }];

      case "verifying":
        return [{
          type: "verifier:verify",
          params: { domainDraft: data.domainDraft },
        }];

      case "emitting":
        return [{
          type: "emitter:emit",
          params: {
            domainDraft: data.domainDraft,
            verification: { valid: true, issues: data.issues },
          },
        }];

      default:
        return [];
    }
  }

  /**
   * Execute effect with telemetry
   */
  private async executeEffect(
    effectType: string,
    params: Record<string, unknown>
  ): Promise<EffectHandlerResult> {
    const handler = this.effectHandlers[effectType];
    if (!handler) {
      throw new Error(`No handler for effect type: ${effectType}`);
    }

    if (process.env.DEBUG) {
      console.log(`[Loop Effect] ${effectType} executing with params:`, JSON.stringify(params)?.slice(0, 200));
    }

    this.telemetry?.onEffectStart?.(effectType as CompilerEffectType, params);

    try {
      const result = await handler(params);
      this.telemetry?.onEffectEnd?.(effectType as CompilerEffectType, result);
      return result;
    } catch (error) {
      this.telemetry?.onError?.(error as Error, `effect:${effectType}`);
      throw error;
    }
  }

  /**
   * Emit telemetry for phase changes
   */
  private emitPhaseChange(snapshot: CompilerSnapshot): void {
    const newStatus = snapshot.status;

    if (this.previousStatus !== newStatus) {
      this.telemetry?.onPhaseChange?.(this.previousStatus, newStatus);
      this.previousStatus = newStatus;
    }

    // Emit specific events
    if (newStatus === "awaiting_plan_decision" && snapshot.plan) {
      this.telemetry?.onPlanReceived?.(snapshot.plan);

      // Create a resolution request for plan decision
      const planResolutionRequest = {
        id: `plan_resolution_${snapshot.plan.id}`,
        stage: "plan" as const,
        reason: `Plan created with ${snapshot.plan.chunks.length} chunk(s) using "${snapshot.plan.strategy}" strategy`,
        conflicts: [],
        options: [
          {
            id: "accept",
            description: "Accept the plan and proceed to generation",
            impact: { kind: "accept_plan" as const, planId: snapshot.plan.id },
          },
          {
            id: "reject",
            description: "Reject the plan and request a new one",
            impact: { kind: "reject_plan" as const, planId: snapshot.plan.id, reason: "User rejected" },
          },
        ],
        context: {
          sourceInputId: snapshot.sourceInput?.id ?? "",
          planId: snapshot.plan.id,
        },
      };
      this.telemetry?.onResolutionRequested?.(planResolutionRequest);
    }

    if (newStatus === "awaiting_draft_decision" && snapshot.fragmentDrafts.length > 0) {
      const latestDraft = snapshot.fragmentDrafts[snapshot.fragmentDrafts.length - 1];
      this.telemetry?.onDraftReceived?.(latestDraft);
    }

    if (newStatus === "awaiting_conflict_resolution" && snapshot.pendingResolution) {
      this.telemetry?.onResolutionRequested?.(snapshot.pendingResolution);
    }

    if (snapshot.isTerminal) {
      this.telemetry?.onComplete?.(snapshot);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private async notifyListeners(): Promise<void> {
    const snapshot = await this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("Listener error:", error);
      }
    }
  }

  /**
   * Convert Host Snapshot to CompilerSnapshot
   */
  private toCompilerSnapshot(snapshot: Snapshot): CompilerSnapshot {
    const data = snapshot.data as CompilerState;
    const computed = snapshot.computed ?? {};

    return {
      ...data,
      // Computed values - status helpers
      isIdle: (computed["computed.isIdle"] as boolean) ?? data.status === "idle",
      isPlanning: (computed["computed.isPlanning"] as boolean) ?? data.status === "planning",
      isAwaitingPlanDecision: (computed["computed.isAwaitingPlanDecision"] as boolean) ?? data.status === "awaiting_plan_decision",
      isGenerating: (computed["computed.isGenerating"] as boolean) ?? data.status === "generating",
      isAwaitingDraftDecision: (computed["computed.isAwaitingDraftDecision"] as boolean) ?? data.status === "awaiting_draft_decision",
      isLowering: (computed["computed.isLowering"] as boolean) ?? data.status === "lowering",
      isLinking: (computed["computed.isLinking"] as boolean) ?? data.status === "linking",
      isAwaitingConflictResolution: (computed["computed.isAwaitingConflictResolution"] as boolean) ?? data.status === "awaiting_conflict_resolution",
      isVerifying: (computed["computed.isVerifying"] as boolean) ?? data.status === "verifying",
      isEmitting: (computed["computed.isEmitting"] as boolean) ?? data.status === "emitting",
      isSuccess: (computed["computed.isSuccess"] as boolean) ?? data.status === "success",
      isFailed: (computed["computed.isFailed"] as boolean) ?? data.status === "failed",

      // Computed values - aggregate helpers
      isTerminal: (computed["computed.isTerminal"] as boolean) ?? (data.status === "success" || data.status === "failed"),
      isProcessing: (computed["computed.isProcessing"] as boolean) ?? ["planning", "generating", "lowering", "linking", "verifying", "emitting"].includes(data.status),
      isAwaitingDecision: (computed["computed.isAwaitingDecision"] as boolean) ?? ["awaiting_plan_decision", "awaiting_draft_decision", "awaiting_conflict_resolution"].includes(data.status),
      canRetry: (computed["computed.canRetryPlan"] as boolean) ?? data.planAttempts < data.config.maxPlanAttempts,
    };
  }
}
