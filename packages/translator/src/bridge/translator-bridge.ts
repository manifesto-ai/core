/**
 * TranslatorBridge
 *
 * Wraps the translation pipeline with Bridge-style interface.
 *
 * Per SPEC-1.1.1v:
 * - Bridge is a core component for World Protocol Intent/Projection
 * - Translator-specific projections handle translate and resolve
 */

import type {
  TranslationResult,
  TranslationContext,
  AmbiguityResolution,
  DomainSchema,
  TranslatorConfig,
  PatchFragment,
  WorldId,
  ActorRef,
  Snapshot,
} from "../domain/index.js";
import { createPipeline } from "../pipeline/index.js";
import type { TranslatorPipeline } from "../pipeline/index.js";
import { deriveTypeIndex, generateIntentId } from "../utils/index.js";

/**
 * TranslatorBridge configuration
 */
export interface TranslatorBridgeConfig {
  /** World ID to operate on */
  worldId: WorldId;
  /** Schema hash for intent computation */
  schemaHash: string;
  /** Domain schema */
  schema: DomainSchema;
  /** Default actor */
  actor: ActorRef;
  /** Translator configuration */
  translatorConfig?: TranslatorConfig;
  /** Optional snapshot provider */
  getSnapshot?: () => Promise<Snapshot | undefined>;
}

/**
 * TranslatorBridge
 *
 * Provides translator functionality with Bridge-style interface.
 */
export class TranslatorBridge {
  private readonly worldId: WorldId;
  private readonly schemaHash: string;
  private readonly schema: DomainSchema;
  private readonly actor: ActorRef;
  private readonly pipeline: TranslatorPipeline;
  private readonly getSnapshotFn?: () => Promise<Snapshot | undefined>;

  /** Pending ambiguity reports keyed by reportId */
  private readonly pendingReports = new Map<string, TranslationResult>();

  constructor(config: TranslatorBridgeConfig) {
    this.worldId = config.worldId;
    this.schemaHash = config.schemaHash;
    this.schema = config.schema;
    this.actor = config.actor;
    this.getSnapshotFn = config.getSnapshot;

    // Create the translation pipeline
    const translatorConfig = config.translatorConfig ?? createDefaultConfig();
    this.pipeline = createPipeline(translatorConfig);
  }

  /**
   * Translate natural language to semantic changes
   *
   * @param input - Natural language input
   * @returns Translation result (fragments, ambiguity, or error)
   */
  async translate(input: string): Promise<TranslationResult> {
    // Build translation context
    const context = await this.buildContext();

    // Run translation pipeline
    const result = await this.pipeline.translate(input, context);

    // If ambiguity, store for later resolution
    if (result.kind === "ambiguity") {
      this.pendingReports.set(result.report.reportId, result);
    }

    return result;
  }

  /**
   * Resolve an ambiguity
   *
   * @param resolution - Ambiguity resolution
   * @returns Translation result after resolution
   */
  async resolve(resolution: AmbiguityResolution): Promise<TranslationResult> {
    // Check if we have a pending report
    const pendingResult = this.pendingReports.get(resolution.reportId);
    if (!pendingResult || pendingResult.kind !== "ambiguity") {
      return createErrorResult(
        "INVALID_CONTEXT",
        `No pending report found for ${resolution.reportId}`,
        this.worldId
      );
    }

    // Find the selected option
    const selectedOptionId =
      resolution.choice.kind === "option" ? resolution.choice.optionId : null;

    if (selectedOptionId === "opt-cancel") {
      // User cancelled
      this.pendingReports.delete(resolution.reportId);
      return createErrorResult(
        "INVALID_INPUT",
        "User cancelled resolution",
        this.worldId,
        pendingResult.trace
      );
    }

    // Find the selected candidate
    const report = pendingResult.report;
    const candidate = report.candidates.find(
      (c) => c.optionId === selectedOptionId
    );

    if (!candidate) {
      return createErrorResult(
        "INVALID_INPUT",
        `Option ${selectedOptionId} not found in report`,
        this.worldId,
        pendingResult.trace
      );
    }

    // Clean up pending report
    this.pendingReports.delete(resolution.reportId);

    // Return fragments from the selected candidate
    return {
      kind: "fragment",
      fragments: candidate.fragments,
      trace: {
        ...pendingResult.trace,
        ambiguityResolution: resolution,
      },
    };
  }

  /**
   * Get fragments from a translation result
   *
   * @param result - Translation result
   * @returns Patch fragments or null if not available
   */
  getFragments(result: TranslationResult): PatchFragment[] | null {
    if (result.kind === "fragment") {
      return result.fragments;
    }
    return null;
  }

  /**
   * Build translation context
   */
  private async buildContext(): Promise<TranslationContext> {
    // Get current snapshot
    const snapshot = this.getSnapshotFn
      ? await this.getSnapshotFn()
      : undefined;

    // Derive type index from schema
    const typeIndex = deriveTypeIndex(this.schema);

    return {
      atWorldId: this.worldId,
      schema: this.schema,
      typeIndex,
      snapshot,
      intentId: generateIntentId(),
      actor: this.actor,
    };
  }

  /**
   * Get pending ambiguity reports
   */
  getPendingReports(): Map<string, TranslationResult> {
    return new Map(this.pendingReports);
  }

  /**
   * Clear pending reports
   */
  clearPendingReports(): void {
    this.pendingReports.clear();
  }

  /**
   * Get the underlying pipeline
   */
  getPipeline(): TranslatorPipeline {
    return this.pipeline;
  }
}

/**
 * Create default translator config
 */
function createDefaultConfig(): TranslatorConfig {
  return {
    retrievalTier: 0,
    slmModel: "gpt-4o-mini",
    escalationThreshold: 0.5,
    fastPathEnabled: true,
    fastPathOnly: false,
    confidencePolicy: {
      autoAcceptThreshold: 0.8,
      rejectThreshold: 0.3,
    },
    traceConfig: {
      sink: "none",
      includeRawInput: false,
      includeRawModelResponse: false,
      includeInputPreview: true,
      maxPreviewLength: 100,
      redactSensitiveData: true,
    },
  };
}

/**
 * Create error result helper
 */
function createErrorResult(
  code: string,
  message: string,
  worldId: WorldId,
  existingTrace?: any
): TranslationResult {
  return {
    kind: "error",
    error: {
      code: code as any,
      message,
      recoverable: false,
      details: {},
    },
    trace: existingTrace ?? {
      traceId: "",
      request: {
        intentId: "",
        atWorldId: worldId,
        inputLength: 0,
        inputHash: "",
        language: "en",
      },
      stages: {},
      resultKind: "error",
      timing: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      },
    },
  };
}

/**
 * Create TranslatorBridge
 */
export function createTranslatorBridge(
  config: TranslatorBridgeConfig
): TranslatorBridge {
  return new TranslatorBridge(config);
}
