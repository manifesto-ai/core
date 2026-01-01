/**
 * Effect Types for Translator
 *
 * Defines interfaces for external dependencies:
 * - LLMAdapter: Abstraction for LLM API calls
 * - SchemaRegistry: Abstraction for domain schema access
 */

import type { TypeExpr, ResolvedType, TypeIndex } from "../types/index.js";

/**
 * LLM Adapter interface
 *
 * Abstracts LLM API calls for testability and provider flexibility.
 * Implementations may use OpenAI, Anthropic, local models, etc.
 */
export interface LLMAdapter {
  /**
   * Call an LLM with a protocol and input
   *
   * @param protocol - Protocol identifier (e.g., "translator.normalize")
   * @param input - Protocol-specific input object
   * @returns Protocol-specific output object
   * @throws Error on API failure (handler converts to patches)
   */
  call(protocol: string, input: unknown): Promise<unknown>;
}

/**
 * Schema field info
 */
export interface SchemaFieldInfo {
  name: string;
  type: TypeExpr;
  description?: string;
}

/**
 * Domain schema structure
 */
export interface DomainSchemaInfo {
  id: string;
  state: {
    fields: Record<string, SchemaFieldInfo>;
  };
}

/**
 * Schema Registry interface
 *
 * Provides access to domain schemas for type checking and retrieval.
 */
export interface SchemaRegistry {
  /**
   * Get a domain schema by ID
   *
   * @param schemaId - Domain schema identifier
   * @returns Domain schema info
   * @throws Error if schema not found
   */
  getSchema(schemaId: string): DomainSchemaInfo;

  /**
   * Get type index for a schema
   *
   * Maps field paths to resolved types for type-aware operations.
   *
   * @param schemaId - Domain schema identifier
   * @returns Type index mapping paths to resolved types
   */
  getTypeIndex(schemaId: string): TypeIndex;
}

/**
 * Translator Host configuration
 */
export interface TranslatorHostConfig {
  /**
   * LLM adapter for normalize and propose effects
   */
  llmAdapter: LLMAdapter;

  /**
   * Schema registry for type information
   */
  schemaRegistry: SchemaRegistry;

  /**
   * Glossary entries for multilingual support
   */
  glossary?: import("../types/index.js").GlossaryEntry[];

  /**
   * Retrieval tier (0 = lunr.js, 1 = embedding, 2 = hybrid)
   * Default: 0
   */
  tier?: 0 | 1 | 2;
}
