/**
 * Common Zod Schemas
 *
 * 공통으로 사용되는 기본 스키마 정의
 * 타입은 z.infer<>로 도출
 */

import { z } from 'zod'

// ============================================================================
// Schema Version
// ============================================================================

export const schemaVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Invalid version format (expected x.y.z)')

export type SchemaVersion = z.infer<typeof schemaVersionSchema>

// ============================================================================
// Schema Metadata
// ============================================================================

export const schemaMetadataSchema = z.object({
  id: z.string().min(1),
  version: schemaVersionSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type SchemaMetadata = z.infer<typeof schemaMetadataSchema>
