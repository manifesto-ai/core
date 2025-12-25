/**
 * Domain Serializer
 *
 * Pure functions for domain export/import (serialization/deserialization).
 * Enables AI-native JSON format for domain definitions.
 */

import { z } from "zod";
import type { EditorSource, EditorDerived, DomainMeta } from "@/domain";
import { EditorSourceSchema, EditorDerivedSchema, DomainMetaSchema } from "@/domain";

/**
 * Domain state structure
 */
export interface DomainState {
  domain: DomainMeta;
  sources: Record<string, EditorSource>;
  derived: Record<string, EditorDerived>;
}

/**
 * Serialized domain export format
 */
export interface DomainExport {
  version: "1.0";
  domain: {
    id: string;
    name: string;
    description: string;
  };
  sources: EditorSource[];
  derived: EditorDerived[];
  exportedAt: string;
}

/**
 * Deserialization error
 */
export interface DeserializeError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Result type for deserialization
 */
export type DeserializeResult =
  | { success: true; data: DomainState }
  | { success: false; error: DeserializeError };

/**
 * Supported versions for deserialization
 */
const SUPPORTED_VERSIONS = ["1.0"];

/**
 * Schema for validating export format
 */
const DomainExportSchema = z.object({
  version: z.string(),
  domain: DomainMetaSchema,
  sources: z.array(z.unknown()),
  derived: z.array(z.unknown()),
  exportedAt: z.string().optional(),
});

/**
 * Serialize domain state to export format
 *
 * @param state - Domain state to serialize
 * @returns Serialized domain export
 */
export function serializeDomain(state: DomainState): DomainExport {
  return {
    version: "1.0",
    domain: {
      id: state.domain.id,
      name: state.domain.name,
      description: state.domain.description,
    },
    sources: Object.values(state.sources),
    derived: Object.values(state.derived),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Deserialize export format to domain state
 *
 * @param input - Raw JSON input to deserialize
 * @returns Result with domain state or error
 */
export function deserializeDomain(input: unknown): DeserializeResult {
  // Validate basic structure
  const parseResult = DomainExportSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: {
        code: "INVALID_FORMAT",
        message: "Invalid export format",
        details: parseResult.error.format(),
      },
    };
  }

  const data = parseResult.data;

  // Check version
  if (!SUPPORTED_VERSIONS.includes(data.version)) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_VERSION",
        message: `Version '${data.version}' is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
      },
    };
  }

  // Validate and convert sources
  const sources: Record<string, EditorSource> = {};
  for (const source of data.sources) {
    const sourceResult = EditorSourceSchema.safeParse(source);
    if (!sourceResult.success) {
      return {
        success: false,
        error: {
          code: "INVALID_SOURCE",
          message: "Invalid source definition",
          details: sourceResult.error.format(),
        },
      };
    }
    sources[sourceResult.data.id] = sourceResult.data;
  }

  // Validate and convert derived
  const derived: Record<string, EditorDerived> = {};
  for (const d of data.derived) {
    const derivedResult = EditorDerivedSchema.safeParse(d);
    if (!derivedResult.success) {
      return {
        success: false,
        error: {
          code: "INVALID_DERIVED",
          message: "Invalid derived definition",
          details: derivedResult.error.format(),
        },
      };
    }
    derived[derivedResult.data.id] = derivedResult.data;
  }

  return {
    success: true,
    data: {
      domain: {
        id: data.domain.id,
        name: data.domain.name,
        description: data.domain.description,
      },
      sources,
      derived,
    },
  };
}
