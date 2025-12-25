/**
 * Compiler Playground Types
 *
 * Types for React Flow visualization of the Manifesto Compiler.
 * Note: These are client-side types. The actual @manifesto-ai/compiler
 * types are only used on the server side (API routes) to avoid
 * bundling Node.js dependencies in the browser.
 */

import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// Fragment Types (Client-side mirror of compiler types)
// ============================================================================

/**
 * Fragment ID type
 */
export type FragmentId = string;

/**
 * Fragment origin information
 */
export interface FragmentOrigin {
  artifactId: string;
  location?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

/**
 * Base fragment interface (mirrors compiler Fragment type)
 */
export interface Fragment {
  id: FragmentId;
  kind: FragmentKind;
  provides: string[];
  requires: string[];
  confidence: number;
  origin?: FragmentOrigin;
  tags?: string[];
  // Optional fields depending on fragment type
  expr?: Record<string, unknown> | string;
  initial?: unknown;
  path?: string;
}

/**
 * Issue from compilation
 */
export interface Issue {
  id: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  relatedFragments?: FragmentId[];
}

/**
 * Conflict between fragments
 */
export interface Conflict {
  path: string;
  candidates: FragmentId[];
  resolved?: boolean;
}

/**
 * Next step suggestion
 */
export interface NextStep {
  id: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

/**
 * Provenance tracking
 */
export interface Provenance {
  fragmentId: FragmentId;
  artifactId: string;
  promptHash?: string;
}

/**
 * Input artifact for compilation
 */
export interface InputArtifact {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

// ============================================================================
// Compiler Phases
// ============================================================================

/**
 * Compiler phase type
 */
export type CompilerPhase =
  | 'idle'
  | 'parsing'
  | 'extracting'
  | 'lowering'
  | 'linking'
  | 'verifying'
  | 'repairing'
  | 'done'
  | 'error';

// ============================================================================
// Compile Result
// ============================================================================

/**
 * Result of compilation (mirrors compiler CompileResult)
 */
export interface CompileResult {
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  stats?: {
    fragmentCount: number;
    issueCount: number;
    conflictCount: number;
  };
}

// ============================================================================
// Session Snapshot (Playground-specific)
// ============================================================================

/**
 * Compiler session snapshot for playground
 * This is a simplified version for UI display
 */
export interface CompilerSessionSnapshot {
  phase: CompilerPhase;
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  nextSteps: NextStep[];
  progress: {
    stage: number;
    total: number;
    message: string;
  };
}

// ============================================================================
// Fragment Kind and Colors
// ============================================================================

export type FragmentKind =
  | 'SchemaFragment'
  | 'SourceFragment'
  | 'ExpressionFragment'
  | 'DerivedFragment'
  | 'PolicyFragment'
  | 'EffectFragment'
  | 'ActionFragment'
  | 'StatementFragment';

/**
 * Neon colors for each fragment kind
 */
export const FRAGMENT_COLORS: Record<FragmentKind, string> = {
  SchemaFragment: '#22d3ee', // cyan-400
  SourceFragment: '#a78bfa', // violet-400
  ExpressionFragment: '#fbbf24', // amber-400
  DerivedFragment: '#34d399', // emerald-400
  PolicyFragment: '#f472b6', // pink-400
  EffectFragment: '#fb923c', // orange-400
  ActionFragment: '#60a5fa', // blue-400
  StatementFragment: '#9ca3af', // gray-400
};

/**
 * Tailwind glow shadow classes for each fragment kind
 */
export const FRAGMENT_GLOW_CLASSES: Record<FragmentKind, string> = {
  SchemaFragment: 'shadow-glow-cyan',
  SourceFragment: 'shadow-glow-violet',
  ExpressionFragment: 'shadow-glow-amber',
  DerivedFragment: 'shadow-glow-emerald',
  PolicyFragment: 'shadow-glow-pink',
  EffectFragment: 'shadow-glow-orange',
  ActionFragment: 'shadow-glow-blue',
  StatementFragment: '',
};

/**
 * Icons for each fragment kind (Lucide icon names)
 */
export const FRAGMENT_ICONS: Record<FragmentKind, string> = {
  SchemaFragment: 'Database',
  SourceFragment: 'Box',
  ExpressionFragment: 'Calculator',
  DerivedFragment: 'GitBranch',
  PolicyFragment: 'Shield',
  EffectFragment: 'Zap',
  ActionFragment: 'Play',
  StatementFragment: 'FileText',
};

// ============================================================================
// Phase Colors
// ============================================================================

/**
 * Colors for each compiler phase
 */
export const PHASE_COLORS: Record<CompilerPhase, string> = {
  idle: '#6b7280', // gray-500
  parsing: '#8b5cf6', // violet-500
  extracting: '#06b6d4', // cyan-500
  lowering: '#10b981', // emerald-500
  linking: '#f59e0b', // amber-500
  verifying: '#3b82f6', // blue-500
  repairing: '#ef4444', // red-500
  done: '#22c55e', // green-500
  error: '#dc2626', // red-600
};

/**
 * Phase display labels
 */
export const PHASE_LABELS: Record<CompilerPhase, string> = {
  idle: 'Idle',
  parsing: 'Parsing',
  extracting: 'Extracting',
  lowering: 'Lowering',
  linking: 'Linking',
  verifying: 'Verifying',
  repairing: 'Repairing',
  done: 'Done',
  error: 'Error',
};

// ============================================================================
// React Flow Node Data Types
// ============================================================================

/**
 * Data for fragment nodes in React Flow
 */
export interface FragmentNodeData extends Record<string, unknown> {
  fragment: Fragment;
  isSelected: boolean;
  isHighlighted: boolean;
  hasIssues: boolean;
  hasConflicts: boolean;
  issueCount: number;
  conflictCount: number;
}

/**
 * Data for phase nodes in pipeline view
 */
export interface PhaseNodeData extends Record<string, unknown> {
  phase: CompilerPhase;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: {
    stage: number;
    total: number;
    message: string;
  };
  issueCount: number;
  conflictCount: number;
}

/**
 * React Flow node types
 */
export type FragmentFlowNode = Node<FragmentNodeData>;
export type PhaseFlowNode = Node<PhaseNodeData>;

// ============================================================================
// React Flow Edge Data Types
// ============================================================================

/**
 * Data for dependency edges
 */
export interface DependencyEdgeData extends Record<string, unknown> {
  fromPath: string;
  toPath: string;
  isHighlighted: boolean;
  isAnimated: boolean;
}

/**
 * Data for phase connection edges
 */
export interface PhaseEdgeData extends Record<string, unknown> {
  isActive: boolean;
  isCompleted: boolean;
}

/**
 * React Flow edge types
 */
export type DependencyFlowEdge = Edge<DependencyEdgeData>;
export type PhaseFlowEdge = Edge<PhaseEdgeData>;

// ============================================================================
// Playground State
// ============================================================================

/**
 * Active visualization view
 */
export type VisualizationView = 'dag' | 'pipeline';

/**
 * Complete playground state
 */
export interface PlaygroundState {
  // Input
  input: string;
  isCompiling: boolean;

  // Results
  result: CompileResult | null;
  snapshot: CompilerSessionSnapshot | null;

  // UI state
  activeView: VisualizationView;
  selectedFragmentId: FragmentId | null;
  highlightedPaths: string[];

  // Error
  error: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the kind of a fragment
 */
export function getFragmentKind(fragment: Fragment): FragmentKind {
  return fragment.kind as FragmentKind;
}

/**
 * Get a display label for a fragment
 */
export function getFragmentLabel(fragment: Fragment): string {
  if (fragment.path) {
    return fragment.path;
  }
  if (fragment.provides.length > 0) {
    return fragment.provides[0];
  }
  return fragment.id;
}

/**
 * Check if a fragment has issues
 */
export function fragmentHasIssues(fragment: Fragment, issues: Issue[]): boolean {
  return issues.some(
    (issue) => issue.relatedFragments?.includes(fragment.id) ?? false
  );
}

/**
 * Check if a fragment has conflicts
 */
export function fragmentHasConflicts(
  fragment: Fragment,
  conflicts: Conflict[]
): boolean {
  return conflicts.some((conflict) => conflict.candidates.includes(fragment.id));
}

/**
 * Count issues for a fragment
 */
export function countFragmentIssues(fragment: Fragment, issues: Issue[]): number {
  return issues.filter(
    (issue) => issue.relatedFragments?.includes(fragment.id) ?? false
  ).length;
}

/**
 * Count conflicts for a fragment
 */
export function countFragmentConflicts(
  fragment: Fragment,
  conflicts: Conflict[]
): number {
  return conflicts.filter((conflict) =>
    conflict.candidates.includes(fragment.id)
  ).length;
}
