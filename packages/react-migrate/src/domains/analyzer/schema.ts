/**
 * Analyzer Domain Zod Schemas
 *
 * 런타임 유효성 검사를 위한 Zod 스키마 정의
 */

import { z } from 'zod';

// ============================================================
// Base Schemas (reused from parser types)
// ============================================================

export const SourceLocationSchema = z.object({
  start: z.object({ line: z.number(), column: z.number() }),
  end: z.object({ line: z.number(), column: z.number() }),
});

export const PatternMetadataSchema = z.record(z.unknown());

export const DetectedPatternSchema = z.object({
  type: z.enum(['component', 'hook', 'context', 'reducer', 'form', 'effect', 'unknown']),
  name: z.string(),
  location: SourceLocationSchema,
  confidence: z.number().min(0).max(1),
  metadata: PatternMetadataSchema,
  needsReview: z.boolean(),
  rawCode: z.string().optional(),
});

// ============================================================
// File Task Schemas
// ============================================================

export const FileTaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'done',
  'skipped',
  'failed',
]);

export const FileTaskSchema = z.object({
  path: z.string(),
  relativePath: z.string(),
  priority: z.number().min(0).max(100),
  dependencies: z.array(z.string()),
  status: FileTaskStatusSchema,
  hash: z.string().optional(),
});

// ============================================================
// Domain Candidate Schemas
// ============================================================

export const DomainSuggestedBySchema = z.enum([
  'context',
  'reducer',
  'hook',
  'file_structure',
  'llm',
]);

export const DomainRelationshipSchema = z.object({
  type: z.enum(['imports', 'provides_context', 'consumes_context', 'shared_state']),
  targetDomainId: z.string(),
  strength: z.number().min(0).max(1),
});

export const DomainCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  suggestedBy: DomainSuggestedBySchema,
  sourceFiles: z.array(z.string()),
  patterns: z.array(DetectedPatternSchema),
  confidence: z.number().min(0).max(1),
  relationships: z.array(DomainRelationshipSchema),
});

// ============================================================
// Ambiguous Pattern Schemas
// ============================================================

export const ResolutionActionSchema = z.enum([
  'classify_as',
  'skip',
  'merge_with',
  'split',
]);

export const SuggestedResolutionSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: ResolutionActionSchema,
  params: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
});

export const AmbiguousPatternSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  pattern: DetectedPatternSchema,
  reason: z.string(),
  suggestedResolutions: z.array(SuggestedResolutionSchema),
  resolvedAt: z.number().optional(),
  resolution: z.string().optional(),
});

// ============================================================
// Analysis Error Schema
// ============================================================

export const AnalysisErrorSchema = z.object({
  file: z.string(),
  error: z.string(),
  timestamp: z.number(),
});

// ============================================================
// Dependency Graph Schemas
// ============================================================

export const ImportEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  specifiers: z.array(z.string()),
  isReexport: z.boolean(),
});

export const DependencyGraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(ImportEdgeSchema),
});

// ============================================================
// Config Schema
// ============================================================

export const AnalyzerConfigSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  enableLLMFallback: z.boolean().default(true),
  maxConcurrency: z.number().min(1).default(1),
});

// ============================================================
// Analyzer Data Schema
// ============================================================

export const AnalyzerDataSchema = z.object({
  queue: z.array(FileTaskSchema),
  current: FileTaskSchema.nullable(),
  results: z.record(z.any()), // FileAnalysis는 parser에서 정의
  domainCandidates: z.record(DomainCandidateSchema),
  config: AnalyzerConfigSchema,
});

// ============================================================
// Pattern Collection Schema
// ============================================================

export const PatternCollectionSchema = z.object({
  components: z.array(DetectedPatternSchema),
  hooks: z.array(DetectedPatternSchema),
  contexts: z.array(DetectedPatternSchema),
  reducers: z.array(DetectedPatternSchema),
  effects: z.array(DetectedPatternSchema),
});

// ============================================================
// Analyzer State Schema
// ============================================================

export const AnalyzerStateSchema = z.object({
  patterns: PatternCollectionSchema,
  ambiguous: z.array(AmbiguousPatternSchema),
  dependencyGraph: DependencyGraphSchema,
  meta: z.object({
    attempts: z.number().min(0),
    confidence: z.number().min(0).max(1),
    lastProcessedFile: z.string().nullable(),
    processingRate: z.number().min(0),
    errors: z.array(AnalysisErrorSchema),
  }),
});

// ============================================================
// Analyzer Derived Schema
// ============================================================

export const AnalyzerDerivedSchema = z.object({
  filesTotal: z.number().min(0),
  filesProcessed: z.number().min(0),
  filesSkipped: z.number().min(0),
  filesFailed: z.number().min(0),
  parseErrors: z.number().min(0),
  ambiguousPatterns: z.number().min(0),
  domainsDiscovered: z.number().min(0),
  overallConfidence: z.number().min(0).max(1),
  estimatedTimeRemaining: z.number().min(0),
  progress: z.number().min(0).max(100),
});

// ============================================================
// Analyzer Snapshot Schema
// ============================================================

export const AnalyzerSnapshotSchema = z.object({
  data: AnalyzerDataSchema,
  state: AnalyzerStateSchema,
  derived: AnalyzerDerivedSchema,
});

// ============================================================
// Event Payload Schemas
// ============================================================

export const AnalyzerStartedPayloadSchema = z.object({
  totalFiles: z.number(),
});

export const FileStartedPayloadSchema = z.object({
  path: z.string(),
  index: z.number(),
});

export const FileCompletedPayloadSchema = z.object({
  path: z.string(),
  patterns: z.number(),
  confidence: z.number(),
});

export const FileFailedPayloadSchema = z.object({
  path: z.string(),
  error: z.string(),
});

export const ProgressPayloadSchema = z.object({
  completed: z.number(),
  total: z.number(),
  confidence: z.number(),
});

export const ErrorPayloadSchema = z.object({
  error: z.string(),
  fatal: z.boolean(),
});

// ============================================================
// Action Input Schemas
// ============================================================

export const AnalyzeFileInputSchema = z.object({
  path: z.string(),
});

export const AnalyzeBatchInputSchema = z.object({
  paths: z.array(z.string()),
});

export const MarkAmbiguousInputSchema = z.object({
  path: z.string(),
  pattern: DetectedPatternSchema,
  reason: z.string(),
});

export const SkipFileInputSchema = z.object({
  path: z.string(),
  reason: z.string(),
});

export const ResolveAmbiguousInputSchema = z.object({
  ambiguousId: z.string(),
  resolutionId: z.string(),
});

// ============================================================
// Type Exports (inferred from schemas)
// ============================================================

export type FileTaskSchemaType = z.infer<typeof FileTaskSchema>;
export type DomainCandidateSchemaType = z.infer<typeof DomainCandidateSchema>;
export type AmbiguousPatternSchemaType = z.infer<typeof AmbiguousPatternSchema>;
export type AnalyzerDataSchemaType = z.infer<typeof AnalyzerDataSchema>;
export type AnalyzerStateSchemaType = z.infer<typeof AnalyzerStateSchema>;
export type AnalyzerDerivedSchemaType = z.infer<typeof AnalyzerDerivedSchema>;
export type AnalyzerSnapshotSchemaType = z.infer<typeof AnalyzerSnapshotSchema>;
