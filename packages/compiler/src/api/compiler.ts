import { createHost, createIntent, type ManifestoHost, type Snapshot } from "@manifesto-ai/host";
import { CompilerDomain, INITIAL_STATE } from "../domain/domain.js";
import type {
  Compiler,
  CompilerSnapshot,
  CompilerState,
  CompilerStatus,
  CompileInput,
  Unsubscribe,
  DiscardReason,
  LLMAdapter,
  CompilerResolutionPolicy,
  CompilerTelemetry,
  EffectHandlerResult,
} from "../domain/types.js";
import {
  createLLMEffectHandlers,
  createBuilderValidateHandler,
  type EffectHandlerResult as LLMEffectHandlerResult,
} from "../effects/index.js";

/**
 * ManifestoCompiler - Implementation of the Compiler interface
 *
 * Per FDR-C001: Compiler is implemented as a Manifesto Application.
 * This class wraps the CompilerDomain Host and provides the public API.
 */
export class ManifestoCompiler implements Compiler {
  private host: ManifestoHost;
  private listeners: Set<(state: CompilerSnapshot) => void> = new Set();
  private effectHandlers: Record<string, (params: Record<string, unknown>) => Promise<LLMEffectHandlerResult>>;
  private policy: CompilerResolutionPolicy;
  private telemetry?: CompilerTelemetry;
  private previousStatus: CompilerStatus = "idle";

  constructor(
    adapter: LLMAdapter,
    options: {
      maxRetries?: number;
      traceDrafts?: boolean;
      resolutionPolicy?: CompilerResolutionPolicy;
      telemetry?: CompilerTelemetry;
    } = {}
  ) {
    this.policy = options.resolutionPolicy ?? { onResolutionRequired: "discard" };
    this.telemetry = options.telemetry;

    // Create effect handlers
    const llmHandlers = createLLMEffectHandlers(adapter, this.policy);
    const builderHandler = createBuilderValidateHandler();

    this.effectHandlers = {
      ...llmHandlers,
      "builder:validate": builderHandler,
    };

    // Create Host with CompilerDomain
    this.host = createHost(CompilerDomain.schema, {
      initialData: {
        ...INITIAL_STATE,
        maxRetries: options.maxRetries ?? INITIAL_STATE.maxRetries,
        traceDrafts: options.traceDrafts ?? INITIAL_STATE.traceDrafts,
      },
    });

    // Register effect handlers with Host
    for (const [type, handler] of Object.entries(this.effectHandlers)) {
      this.host.registerEffect(type, async (effectType, params) => {
        // Execute the handler
        const result = await handler(params as Record<string, unknown>);

        // Return patches that schedule the next action
        // The Host will apply these and continue the loop
        return [];
      });
    }
  }

  /**
   * Start compilation with input
   */
  async start(input: CompileInput): Promise<void> {
    const intent = createIntent("start", {
      text: input.text,
      schema: input.schema,
      context: input.context,
      maxRetries: input.maxRetries,
      traceDrafts: input.traceDrafts,
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

  /**
   * Resolve ambiguity
   */
  async resolve(selectedOptionId: string): Promise<void> {
    await this.dispatch("resolve", { selectedOptionId });
  }

  /**
   * Discard compilation
   */
  async discard(reason?: DiscardReason): Promise<void> {
    await this.dispatch("discard", { reason: reason ?? "RESOLUTION_REQUIRED_BUT_DISABLED" });
  }

  /**
   * Reset to idle
   */
  async reset(): Promise<void> {
    await this.dispatch("reset", {});
  }

  /**
   * Dispatch intent and handle effects in a loop
   *
   * This implements the effect execution loop that the Host normally handles.
   * We need custom logic because our effect handlers return actions to dispatch.
   */
  private async dispatchWithEffectLoop(intent: ReturnType<typeof createIntent>): Promise<void> {
    // Track previous attempt count to detect new attempts
    let previousAttemptCount = 0;

    try {
      // Dispatch the initial intent
      const result = await this.host.dispatch(intent);

      // Debug: Check dispatch result
      if (process.env.DEBUG) {
        console.log("[Compiler] Dispatch result:", {
          action: intent.type,
          hostStatus: result.status,
          error: result.error,
          stateStatus: (result.snapshot.data as CompilerState).status,
          traces: result.traces?.length ?? 0,
        });
      }

      // Get the current snapshot to check for pending effects
      let snapshot = result.snapshot;
      let compilerSnapshot = this.toCompilerSnapshot(snapshot);

      // Emit initial phase change
      this.emitPhaseChange(compilerSnapshot);
      previousAttemptCount = compilerSnapshot.attemptCount;

      // Process pending effects
      while (this.hasPendingEffects(snapshot)) {
        const effects = this.extractPendingEffects(snapshot);

        for (const effect of effects) {
          // Execute effect with telemetry
          const handlerResult = await this.executeEffect(effect.type, effect.params);

          // Dispatch the resulting action
          const nextIntent = createIntent(handlerResult.action, handlerResult.input);
          const nextResult = await this.host.dispatch(nextIntent);
          snapshot = nextResult.snapshot;
          compilerSnapshot = this.toCompilerSnapshot(snapshot);

          // Emit phase change
          this.emitPhaseChange(compilerSnapshot);

          // Emit attempt if new attempt was recorded
          if (compilerSnapshot.attemptCount > previousAttemptCount) {
            this.emitAttempt(compilerSnapshot);
            previousAttemptCount = compilerSnapshot.attemptCount;
          }
        }
      }

      // Notify listeners
      await this.notifyListeners();
    } catch (error) {
      // Emit error telemetry
      this.telemetry?.onError?.(error as Error, `dispatch:${intent.type}`);
      throw error;
    }
  }

  /**
   * Check if snapshot has pending effects
   */
  private hasPendingEffects(snapshot: Snapshot): boolean {
    // Check trace for effect nodes
    const data = snapshot.data as CompilerState;
    const status = data.status;

    // Effects are triggered during state transitions
    // We detect pending effects by checking if we're in a transitional state
    return (
      status === "segmenting" ||
      status === "normalizing" ||
      status === "proposing" ||
      status === "validating"
    );
  }

  /**
   * Extract pending effects from snapshot
   */
  private extractPendingEffects(snapshot: Snapshot): Array<{ type: string; params: Record<string, unknown> }> {
    const data = snapshot.data as CompilerState;
    const status = data.status;

    // Map status to effect type
    switch (status) {
      case "segmenting":
        return [{ type: "llm:segment", params: { text: data.input } }];

      case "normalizing":
        return [
          {
            type: "llm:normalize",
            params: {
              segments: data.segments,
              schema: data.targetSchema,
              context: data.context,
            },
          },
        ];

      case "proposing":
        return [
          {
            type: "llm:propose",
            params: {
              schema: data.targetSchema,
              intents: data.intents,
              history: data.attempts,
              context: data.context,
            },
          },
        ];

      case "validating":
        return [
          {
            type: "builder:validate",
            params: { draft: data.currentDraft },
          },
        ];

      default:
        return [];
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
   * Emit telemetry for phase changes
   * Per SPEC §15.2
   */
  private emitPhaseChange(snapshot: CompilerSnapshot): void {
    const newStatus = snapshot.status;

    // Emit phase change if status changed
    if (this.previousStatus !== newStatus) {
      this.telemetry?.onPhaseChange?.(this.previousStatus, newStatus);
      this.previousStatus = newStatus;
    }

    // Emit resolution requested if awaiting resolution
    if (newStatus === "awaiting_resolution" && snapshot.resolutionReason) {
      this.telemetry?.onResolutionRequested?.(
        snapshot.resolutionReason,
        snapshot.resolutionOptions
      );
    }

    // Emit complete if terminal
    if (snapshot.isTerminal) {
      this.telemetry?.onComplete?.(snapshot);
    }
  }

  /**
   * Execute effect with telemetry
   */
  private async executeEffect(
    effectType: string,
    params: Record<string, unknown>
  ): Promise<LLMEffectHandlerResult> {
    const handler = this.effectHandlers[effectType];
    if (!handler) {
      throw new Error(`No handler for effect type: ${effectType}`);
    }

    // Emit effect start
    this.telemetry?.onEffectStart?.(effectType, params);

    try {
      const result = await handler(params);

      // Emit effect end
      this.telemetry?.onEffectEnd?.(effectType, result);

      return result;
    } catch (error) {
      // Emit error
      this.telemetry?.onError?.(error as Error, `effect:${effectType}`);
      throw error;
    }
  }

  /**
   * Emit attempt telemetry
   */
  private emitAttempt(snapshot: CompilerSnapshot): void {
    if (snapshot.traceDrafts && snapshot.attempts.length > 0) {
      const latestAttempt = snapshot.attempts[snapshot.attempts.length - 1];
      this.telemetry?.onAttempt?.(latestAttempt);
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
      // Computed values
      isIdle: (computed["computed.isIdle"] as boolean) ?? data.status === "idle",
      isSegmenting: (computed["computed.isSegmenting"] as boolean) ?? data.status === "segmenting",
      isNormalizing: (computed["computed.isNormalizing"] as boolean) ?? data.status === "normalizing",
      isProposing: (computed["computed.isProposing"] as boolean) ?? data.status === "proposing",
      isValidating: (computed["computed.isValidating"] as boolean) ?? data.status === "validating",
      isAwaitingResolution:
        (computed["computed.isAwaitingResolution"] as boolean) ?? data.status === "awaiting_resolution",
      isTerminal:
        (computed["computed.isTerminal"] as boolean) ??
        (data.status === "success" || data.status === "discarded"),
      canRetry: (computed["computed.canRetry"] as boolean) ?? data.attemptCount < data.maxRetries,
    };
  }
}
