/**
 * Summarizer Domain Schemas
 *
 * 런타임 검증을 위한 Zod 스키마 정의
 */

import { z } from 'zod';

// ============================================================
// Domain Summary Schemas
// ============================================================

export const ExtractedFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  optional: z.boolean(),
  description: z.string().optional(),
});

export const ExtractedEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['entity', 'value_object', 'enum']),
  fields: z.array(ExtractedFieldSchema),
  sourcePatterns: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const ExtractedActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['command', 'query', 'event']),
  input: ExtractedEntitySchema.optional(),
  output: ExtractedEntitySchema.optional(),
  sourcePatterns: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const DomainBoundarySchema = z.object({
  imports: z.array(z.string()),
  exports: z.array(z.string()),
  sharedState: z.array(z.string()),
});

export const DomainSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  sourceFiles: z.array(z.string()),
  entities: z.array(ExtractedEntitySchema),
  actions: z.array(ExtractedActionSchema),
  boundaries: DomainBoundarySchema,
  suggestedBy: z.string(),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
  reviewNotes: z.array(z.string()),
});

// ============================================================
// Relationship Schemas
// ============================================================

export const RelationshipTypeSchema = z.enum([
  'dependency',
  'shared_state',
  'event_flow',
  'composition',
]);

export const DomainRelationshipSchema = z.object({
  id: z.string(),
  type: RelationshipTypeSchema,
  from: z.string(),
  to: z.string(),
  strength: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  description: z.string().optional(),
});

// ============================================================
// Conflict Schemas
// ============================================================

export const ConflictResolutionSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.enum(['merge', 'split', 'assign', 'rename']),
  params: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
});

export const DomainConflictSchema = z.object({
  id: z.string(),
  type: z.enum(['ownership', 'naming', 'boundary']),
  domains: z.array(z.string()),
  file: z.string().optional(),
  description: z.string(),
  suggestedResolutions: z.array(ConflictResolutionSchema),
});

// ============================================================
// Schema Proposal Schemas
// ============================================================

export const SchemaFieldProposalSchema = z.object({
  path: z.string(),
  type: z.string(),
  description: z.string().optional(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
});

export const SchemaProposalSchema: z.ZodType<{
  id: string;
  domainId: string;
  domainName: string;
  entities: z.infer<typeof SchemaFieldProposalSchema>[];
  state: z.infer<typeof SchemaFieldProposalSchema>[];
  intents: z.infer<typeof SchemaFieldProposalSchema>[];
  confidence: number;
  alternatives: unknown[];
  reviewNotes: string[];
  needsReview: boolean;
}> = z.object({
  id: z.string(),
  domainId: z.string(),
  domainName: z.string(),
  entities: z.array(SchemaFieldProposalSchema),
  state: z.array(SchemaFieldProposalSchema),
  intents: z.array(SchemaFieldProposalSchema),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.lazy(() => SchemaProposalSchema)),
  reviewNotes: z.array(z.string()),
  needsReview: z.boolean(),
});

// ============================================================
// Data & State Schemas
// ============================================================

export const SummarizerConfigSchema = z.object({
  minClusterSize: z.number().int().min(1),
  confidenceThreshold: z.number().min(0).max(1),
  enableLLMEnrichment: z.boolean(),
  maxAlternatives: z.number().int().min(0),
});

export const SummarizerDataSchema = z.object({
  analyzerRef: z.string(),
  domains: z.record(DomainSummarySchema),
  conflicts: z.array(DomainConflictSchema),
  config: SummarizerConfigSchema,
});

export const ClusteringStateSchema = z.object({
  status: z.enum(['idle', 'clustering', 'enriching', 'proposing', 'done']),
  currentPhase: z.string(),
  progress: z.number().min(0).max(100),
});

export const SummarizerErrorSchema = z.object({
  domain: z.string().optional(),
  error: z.string(),
  timestamp: z.number(),
});

export const SummarizerStateSchema = z.object({
  relationships: z.array(DomainRelationshipSchema),
  schemaProposals: z.record(SchemaProposalSchema),
  clustering: ClusteringStateSchema,
  ambiguous: z.array(z.any()), // AmbiguousPattern from analyzer
  meta: z.object({
    attempts: z.number().int(),
    llmCallCount: z.number().int(),
    lastProcessedDomain: z.string().nullable(),
    processingRate: z.number(),
    errors: z.array(SummarizerErrorSchema),
  }),
});

export const SummarizerDerivedSchema = z.object({
  domainsTotal: z.number().int(),
  domainsProcessed: z.number().int(),
  conflictsUnresolved: z.number().int(),
  proposalsReady: z.number().int(),
  overallConfidence: z.number().min(0).max(1),
  progress: z.number().min(0).max(100),
  estimatedTimeRemaining: z.number(),
});

export const SummarizerSnapshotSchema = z.object({
  data: SummarizerDataSchema,
  state: SummarizerStateSchema,
  derived: SummarizerDerivedSchema,
});

// ============================================================
// Input Schemas
// ============================================================

export const SummarizeDomainInputSchema = z.object({
  candidate: z.any(), // DomainCandidate from analyzer
  patterns: z.array(z.any()), // DetectedPattern from parser
});

export const AnalyzeRelationshipsInputSchema = z.object({
  domains: z.array(DomainSummarySchema),
  graph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.object({ source: z.string(), target: z.string() })),
  }),
});

export const GenerateProposalInputSchema = z.object({
  domain: DomainSummarySchema,
  relationships: z.array(DomainRelationshipSchema),
});

export const ResolveConflictInputSchema = z.object({
  conflictId: z.string(),
  resolutionId: z.string(),
});
