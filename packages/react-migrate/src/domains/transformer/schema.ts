/**
 * Transformer Domain Zod Schemas
 */

import { z } from 'zod';

// ============================================================
// Schema & Output Schemas
// ============================================================

export const ManifestoFieldSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  optional: z.boolean().optional(),
  default: z.unknown().optional(),
});

// Note: variants is simplified to unknown due to recursive type complexity
export const ManifestoEntitySchema: z.ZodType<{
  type: 'object' | 'enum' | 'union';
  description?: string;
  fields?: Record<string, z.infer<typeof ManifestoFieldSchema>>;
  values?: string[];
  variants?: unknown[];
}> = z.object({
  type: z.enum(['object', 'enum', 'union']),
  description: z.string().optional(),
  fields: z.record(ManifestoFieldSchema).optional(),
  values: z.array(z.string()).optional(),
  variants: z.array(z.unknown()).optional(),
});

export const ManifestoStateFieldSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  initial: z.unknown().optional(),
  derived: z.string().optional(),
});

export const ManifestoIntentSchema = z.object({
  type: z.enum(['command', 'query', 'event']),
  description: z.string().optional(),
  input: z.record(ManifestoFieldSchema).optional(),
  output: z.record(ManifestoFieldSchema).optional(),
  effects: z.array(z.string()).optional(),
});

export const ManifestoDomainMetadataSchema = z.object({
  generatedAt: z.number(),
  generatedBy: z.string(),
  sourceFiles: z.array(z.string()),
  confidence: z.number(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().optional(),
});

export const ManifestoDomainJsonSchema = z.object({
  $schema: z.string(),
  domain: z.string(),
  version: z.string(),
  entities: z.record(ManifestoEntitySchema),
  state: z.record(ManifestoStateFieldSchema),
  intents: z.record(ManifestoIntentSchema),
  metadata: ManifestoDomainMetadataSchema,
});

// ============================================================
// Transformation Schemas
// ============================================================

export const TransformationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'validating',
  'review',
  'writing',
  'done',
  'failed',
]);

export const ValidationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  severity: z.literal('error'),
});

export const ValidationWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  severity: z.literal('warning'),
});

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationWarningSchema),
});

export const TransformationTaskSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  domainName: z.string(),
  status: TransformationStatusSchema,
  proposal: z.unknown(), // SchemaProposal from summarizer
  generatedSchema: ManifestoDomainJsonSchema.nullable(),
  validation: ValidationResultSchema.nullable(),
  error: z.string().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});

// ============================================================
// Source Mapping Schemas
// ============================================================

export const SourceMappingSchema = z.object({
  sourcePath: z.string(),
  sourceLocation: z.object({
    line: z.number(),
    column: z.number(),
  }),
  targetPath: z.string(),
  confidence: z.number(),
  patternType: z.string(),
});

export const DomainFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  content: ManifestoDomainJsonSchema,
  sourceMappings: z.array(SourceMappingSchema),
  writtenAt: z.number().nullable(),
});

// ============================================================
// Rollback Schemas
// ============================================================

export const RollbackPointSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  description: z.string(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string().nullable(),
  })),
});

// ============================================================
// Transformer Data & State Schemas
// ============================================================

export const TransformerConfigSchema = z.object({
  outputDir: z.string(),
  schemaVersion: z.string(),
  includeSourceMappings: z.boolean(),
  validateBeforeWrite: z.boolean(),
  createBackup: z.boolean(),
});

export const TransformerDataSchema = z.object({
  summarizerRef: z.string(),
  tasks: z.record(TransformationTaskSchema),
  domainFiles: z.record(DomainFileSchema),
  config: TransformerConfigSchema,
});

export const TransformerErrorSchema = z.object({
  taskId: z.string().optional(),
  error: z.string(),
  timestamp: z.number(),
});

export const TransformerStateSchema = z.object({
  currentTask: z.string().nullable(),
  rollbackPoints: z.array(RollbackPointSchema),
  currentRollbackPoint: z.string().nullable(),
  validationCache: z.record(ValidationResultSchema),
  meta: z.object({
    attempts: z.number(),
    llmCallCount: z.number(),
    filesWritten: z.number(),
    lastWrittenFile: z.string().nullable(),
    processingRate: z.number(),
    errors: z.array(TransformerErrorSchema),
  }),
});

export const TransformerDerivedSchema = z.object({
  tasksTotal: z.number(),
  tasksCompleted: z.number(),
  tasksFailed: z.number(),
  tasksNeedingReview: z.number(),
  filesGenerated: z.number(),
  filesWritten: z.number(),
  overallProgress: z.number(),
  estimatedTimeRemaining: z.number(),
});

export const TransformerSnapshotSchema = z.object({
  data: TransformerDataSchema,
  state: TransformerStateSchema,
  derived: TransformerDerivedSchema,
});

// ============================================================
// Input Schemas
// ============================================================

export const CreateTaskInputSchema = z.object({
  domainId: z.string(),
  domainName: z.string(),
  proposal: z.unknown(),
  summary: z.unknown(),
});

export const GenerateSchemaInputSchema = z.object({
  taskId: z.string(),
});

export const WriteFileInputSchema = z.object({
  taskId: z.string(),
  overwrite: z.boolean().optional(),
});

export const RollbackInputSchema = z.object({
  rollbackPointId: z.string(),
});
