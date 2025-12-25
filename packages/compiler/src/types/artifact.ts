/**
 * Artifact Types - Input types for the compiler
 *
 * Artifacts are the raw inputs that the compiler processes.
 * They can be code, natural language text, or existing Manifesto fragments.
 */

/** Unique identifier for an artifact */
export type ArtifactId = string;

/**
 * Code artifact - JavaScript/TypeScript source code
 */
export interface CodeArtifact {
  id: ArtifactId;
  kind: 'code';
  language: 'js' | 'ts' | 'json';
  content: string;
  /** Optional file path for provenance tracking */
  filePath?: string;
}

/**
 * Text artifact - Natural language text (PRD, requirements, etc.)
 */
export interface TextArtifact {
  id: ArtifactId;
  kind: 'text';
  content: string;
  /** Optional document identifier for provenance tracking */
  docId?: string;
}

/**
 * Manifesto artifact - Existing Manifesto domain or fragments
 */
export interface ManifestoArtifact {
  id: ArtifactId;
  kind: 'manifesto';
  /** Can be existing fragments or partial domain definition */
  content: unknown;
}

/**
 * Union type of all artifact kinds
 */
export type Artifact = CodeArtifact | TextArtifact | ManifestoArtifact;

/**
 * Selection span within an artifact
 * Used to compile only a portion of the artifact
 */
export interface SelectionSpan {
  /** Line-based selection (1-indexed) */
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
  /** Offset-based selection (0-indexed) */
  startOffset?: number;
  endOffset?: number;
}

/**
 * Selection within a specific artifact
 */
export interface ArtifactSelection {
  artifactId: ArtifactId;
  span: SelectionSpan;
}

/**
 * Input to the compiler
 */
export interface CompileInput {
  /** List of artifacts to compile */
  artifacts: Artifact[];
  /** Optional selection for partial compilation */
  selection?: ArtifactSelection;
}

/**
 * Type guard for CodeArtifact
 */
export function isCodeArtifact(artifact: Artifact): artifact is CodeArtifact {
  return artifact.kind === 'code';
}

/**
 * Type guard for TextArtifact
 */
export function isTextArtifact(artifact: Artifact): artifact is TextArtifact {
  return artifact.kind === 'text';
}

/**
 * Type guard for ManifestoArtifact
 */
export function isManifestoArtifact(artifact: Artifact): artifact is ManifestoArtifact {
  return artifact.kind === 'manifesto';
}

/**
 * Create a unique artifact ID
 */
export function createArtifactId(): ArtifactId {
  return `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
