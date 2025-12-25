/**
 * Provenance Types - Origin and evidence tracking
 *
 * Every fragment must have provenance to explain "where it came from".
 * This is a core invariant of the compiler (AGENT_README Invariant #4).
 */

import type { ArtifactId } from './artifact.js';

/**
 * Code span location within a source file
 */
export interface CodeSpan {
  /** Optional file path */
  file?: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** Start column (0-indexed) */
  startCol: number;
  /** End line (1-indexed) */
  endLine: number;
  /** End column (0-indexed) */
  endCol: number;
}

/**
 * Text span location within a document
 */
export interface TextSpan {
  /** Optional document identifier */
  docId?: string;
  /** Start offset (0-indexed) */
  startOffset: number;
  /** End offset (0-indexed) */
  endOffset: number;
}

/**
 * Location types for provenance tracking
 */
export type OriginLocation =
  | { kind: 'code'; span: CodeSpan }
  | { kind: 'text'; span: TextSpan }
  | { kind: 'generated'; note: string }
  | { kind: 'patch'; patchId: string }
  | { kind: 'llm'; model: string; promptHash?: string };

/**
 * Provenance metadata for a fragment
 *
 * Tracks where a fragment came from and how it was created.
 */
export interface Provenance {
  /** ID of the source artifact */
  artifactId: ArtifactId;
  /** Location within the artifact */
  location: OriginLocation;
  /**
   * Stable hash of the normalized origin content
   * Used for stable ID generation
   */
  originHash?: string;
  /** Timestamp when this provenance was created */
  createdAt?: number;
}

/**
 * Evidence kinds for explaining why a fragment was created
 */
export type EvidenceKind =
  | 'quote' // Direct quote from source
  | 'ast_node' // Reference to AST node
  | 'rule' // Compiler rule that triggered this
  | 'link' // Reference to another resource
  | 'fragment_ref' // Reference to another fragment
  | 'llm_reasoning'; // LLM chain of thought

/**
 * Evidence for why a fragment was created
 *
 * Evidence provides the reasoning behind compiler decisions.
 */
export interface Evidence {
  /** Type of evidence */
  kind: EvidenceKind;
  /** Reference to the source (e.g., AST node kind, rule ID, URL) */
  ref: string;
  /** Short excerpt or explanation */
  excerpt?: string;
  /** Confidence score (0-1) for LLM-generated evidence */
  confidence?: number;
}

/**
 * Create a code-based origin location
 */
export function codeOrigin(span: CodeSpan): OriginLocation {
  return { kind: 'code', span };
}

/**
 * Create a text-based origin location
 */
export function textOrigin(span: TextSpan): OriginLocation {
  return { kind: 'text', span };
}

/**
 * Create a generated origin location
 */
export function generatedOrigin(note: string): OriginLocation {
  return { kind: 'generated', note };
}

/**
 * Create a patch-based origin location
 */
export function patchOrigin(patchId: string): OriginLocation {
  return { kind: 'patch', patchId };
}

/**
 * Create an LLM-based origin location
 */
export function llmOrigin(model: string, promptHash?: string): OriginLocation {
  return { kind: 'llm', model, promptHash };
}

/**
 * Create provenance metadata
 */
export function createProvenance(
  artifactId: ArtifactId,
  location: OriginLocation,
  originHash?: string
): Provenance {
  return {
    artifactId,
    location,
    originHash,
    createdAt: Date.now(),
  };
}

/**
 * Create evidence
 */
export function createEvidence(
  kind: EvidenceKind,
  ref: string,
  excerpt?: string,
  confidence?: number
): Evidence {
  return { kind, ref, excerpt, confidence };
}
