/**
 * CLI-specific types for the Manifesto Compiler
 */

import type { CompilerStatus, ResolutionOption } from "../domain/types.js";

// ════════════════════════════════════════════════════════════════════════════
// Verbosity Modes
// ════════════════════════════════════════════════════════════════════════════

export type Verbosity = "simple" | "verbose" | "full";

// ════════════════════════════════════════════════════════════════════════════
// Provider Configuration
// ════════════════════════════════════════════════════════════════════════════

export type Provider = "openai" | "anthropic";

export interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  model?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// CLI Flags
// ════════════════════════════════════════════════════════════════════════════

export interface CLIFlags {
  simple: boolean;
  verbose: boolean;
  full: boolean;
  provider: string;
  apiKey?: string;
  model?: string;
  file?: string;
  stdin: boolean;
  output?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Compiler State for UI
// ════════════════════════════════════════════════════════════════════════════

export interface EffectTiming {
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  details?: Record<string, unknown>;
}

export interface CompilerMetrics {
  startTime: number;
  endTime?: number;
  phaseTimings: Record<string, number>;
  effectTimings: EffectTiming[];
  attemptCount: number;
  segmentCount?: number;
  intentCount?: number;
}

export interface ResolutionPending {
  reason: string;
  options: ResolutionOption[];
}

export interface CompilerUIState {
  status: CompilerStatus;
  phase: string;
  progress: number; // 0-100
  metrics: CompilerMetrics;
  result: unknown | null;
  error: string | null;
  resolutionPending: ResolutionPending | null;
}

// ════════════════════════════════════════════════════════════════════════════
// App Props
// ════════════════════════════════════════════════════════════════════════════

export interface AppProps {
  input: string;
  provider: Provider;
  apiKey: string;
  model?: string;
  verbosity: Verbosity;
  outputFile?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Component Props
// ════════════════════════════════════════════════════════════════════════════

export interface HeaderProps {
  version: string;
  input: string;
}

export interface StatusBarProps {
  status: CompilerStatus;
  phase: string;
  isSpinning: boolean;
}

export interface ProgressProps {
  status: CompilerStatus;
  currentPhase: string;
}

export interface MetricsProps {
  metrics: CompilerMetrics;
  status: CompilerStatus;
}

export interface ResolutionProps {
  reason: string;
  options: ResolutionOption[];
  onSelect: (optionId: string) => void;
  onSkip: () => void;
}

export interface ResultProps {
  result: unknown;
  verbosity: Verbosity;
  outputFile?: string;
}

export interface ErrorProps {
  reason: string | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Phase Configuration
// ════════════════════════════════════════════════════════════════════════════

export const PHASES = [
  "segmenting",
  "normalizing",
  "proposing",
  "validating",
] as const;

export type Phase = (typeof PHASES)[number];

export const PHASE_LABELS: Record<Phase, string> = {
  segmenting: "Segmenting",
  normalizing: "Normalizing",
  proposing: "Proposing",
  validating: "Validating",
};

export function getPhaseIndex(status: CompilerStatus): number {
  const index = PHASES.indexOf(status as Phase);
  return index >= 0 ? index : -1;
}

export function isActivePhase(status: CompilerStatus): boolean {
  return PHASES.includes(status as Phase);
}
