/**
 * useTranslator Hook
 *
 * State management for the Translator CLI.
 */

import { useState, useCallback } from "react";
import type {
  TranslatorState,
  UseTranslatorResult,
  CLIState,
  TranslationProgress,
  Provider,
} from "../types.js";
import type {
  TranslationResult,
  TranslatorConfig,
  DomainSchema,
} from "../../domain/index.js";
import type { PipelineStage } from "../../pipeline/types.js";
import { createTranslatorBridge } from "../../bridge/index.js";
import { createLLMProvider, createAutoProvider } from "../../llm/index.js";
import type { LLMProvider } from "../../llm/index.js";

/**
 * Hook options
 */
export interface UseTranslatorOptions {
  worldId: string;
  schema?: DomainSchema;
  provider?: Provider;
  apiKey?: string;
  model?: string;
  onStageChange?: (progress: TranslationProgress) => void;
}

/**
 * Stage names for display
 */
const STAGE_NAMES: Record<PipelineStage, string> = {
  idle: "Idle",
  chunking: "Chunking",
  normalization: "Normalizing",
  fastPath: "Fast Path",
  retrieval: "Retrieving",
  memory: "Memory",
  proposer: "Proposing",
  assembly: "Assembling",
  complete: "Complete",
};

/**
 * Stage indices for progress
 */
const STAGE_ORDER: PipelineStage[] = [
  "chunking",
  "normalization",
  "fastPath",
  "retrieval",
  "memory",
  "proposer",
  "assembly",
];

/**
 * Get stage index
 */
function getStageIndex(stage: PipelineStage): number {
  const index = STAGE_ORDER.indexOf(stage);
  return index >= 0 ? index : 0;
}

/**
 * Create translation progress
 */
function createProgress(stage: PipelineStage): TranslationProgress {
  return {
    stage,
    stageName: STAGE_NAMES[stage] || stage,
    stageIndex: getStageIndex(stage),
    totalStages: STAGE_ORDER.length,
  };
}

/**
 * useTranslator hook
 */
export function useTranslator(
  options: UseTranslatorOptions
): UseTranslatorResult {
  const [state, setState] = useState<CLIState>("idle");
  const [progress, setProgress] = useState<TranslationProgress | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Create LLM provider
  const createProvider = useCallback((): LLMProvider | undefined => {
    if (!options.apiKey && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return undefined;
    }

    if (options.provider === "anthropic") {
      return createLLMProvider({
        type: "anthropic",
        apiKey: options.apiKey,
        model: options.model,
      });
    }

    return createLLMProvider({
      type: "openai",
      apiKey: options.apiKey,
      model: options.model,
    });
  }, [options.provider, options.apiKey, options.model]);

  // Translate function
  const translate = useCallback(
    async (input: string) => {
      setState("translating");
      setProgress(createProgress("chunking"));
      setError(null);

      try {
        // Create default schema if not provided
        const schema: DomainSchema = options.schema ?? {
          id: options.worldId,
          version: "1.0.0",
          hash: "cli-session",
          state: {},
          actions: {},
          computed: {},
          types: {},
        };

        // Create translator bridge
        const bridge = createTranslatorBridge({
          worldId: options.worldId,
          schemaHash: "cli-session",
          schema,
          actor: { kind: "human", actorId: "cli-user" },
          translatorConfig: createConfig(createProvider()),
        });

        // Run translation
        const translationResult = await bridge.translate(input);

        setResult(translationResult);

        if (translationResult.kind === "ambiguity") {
          setState("ambiguity");
        } else if (translationResult.kind === "error") {
          setState("error");
          setError(new Error(translationResult.error.message));
        } else {
          setState("complete");
        }
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [options, createProvider]
  );

  // Resolve function
  const resolve = useCallback(
    async (optionId: string) => {
      if (state !== "ambiguity" || !result || result.kind !== "ambiguity") {
        return;
      }

      setState("translating");
      setProgress(createProgress("assembly"));

      try {
        const schema: DomainSchema = options.schema ?? {
          id: options.worldId,
          version: "1.0.0",
          hash: "cli-session",
          state: {},
          actions: {},
          computed: {},
          types: {},
        };

        const bridge = createTranslatorBridge({
          worldId: options.worldId,
          schemaHash: "cli-session",
          schema,
          actor: { kind: "human", actorId: "cli-user" },
          translatorConfig: createConfig(createProvider()),
        });

        // Find the selected candidate and return its fragments
        const candidate = result.report.candidates.find(
          (c) => c.optionId === optionId
        );

        if (!candidate) {
          setState("error");
          setError(new Error(`Invalid option: ${optionId}`));
          return;
        }

        // Create a resolution result directly
        const resolutionResult: TranslationResult = {
          kind: "fragment",
          fragments: candidate.fragments,
          trace: result.trace,
        };

        setResult(resolutionResult);
        setState("complete");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [state, result, options, createProvider]
  );

  return {
    state,
    progress,
    result,
    error,
    translate,
    resolve,
  };
}

/**
 * Create translator config
 */
function createConfig(provider?: LLMProvider): TranslatorConfig {
  return {
    retrievalTier: 0,
    slmModel: provider?.defaultModel ?? "gpt-4o-mini",
    escalationThreshold: 0.5,
    fastPathEnabled: true,
    fastPathOnly: !provider, // Fast path only if no LLM
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
