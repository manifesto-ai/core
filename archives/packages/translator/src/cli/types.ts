/**
 * CLI Types
 *
 * Type definitions for the Translator CLI.
 */

import type { TranslationResult } from "../domain/index.js";
import type { PipelineStage } from "../pipeline/types.js";

/**
 * LLM provider type
 */
export type Provider = "openai" | "anthropic";

/**
 * Output verbosity level
 */
export type Verbosity = "simple" | "verbose" | "full";

/**
 * CLI state
 */
export type CLIState =
  | "idle"
  | "translating"
  | "ambiguity"
  | "complete"
  | "error";

/**
 * Translation progress info
 */
export interface TranslationProgress {
  stage: PipelineStage;
  stageName: string;
  stageIndex: number;
  totalStages: number;
  durationMs?: number;
}

/**
 * App props
 */
export interface AppProps {
  /** Natural language input */
  input: string;
  /** World ID */
  worldId: string;
  /** Optional schema */
  schema?: unknown;
  /** LLM provider */
  provider: Provider;
  /** API key (optional, can use env) */
  apiKey?: string;
  /** Model name override */
  model?: string;
  /** Output verbosity */
  verbosity: Verbosity;
  /** Output file path */
  outputFile?: string;
  /** Trace file path */
  traceFile?: string;
}

/**
 * Translator hook state
 */
export interface TranslatorState {
  state: CLIState;
  progress: TranslationProgress | null;
  result: TranslationResult | null;
  error: Error | null;
}

/**
 * Translator hook result
 */
export interface UseTranslatorResult extends TranslatorState {
  translate: (input: string) => Promise<void>;
  resolve: (optionId: string) => Promise<void>;
}
