import { z } from "zod";
import { StateSpec } from "./field.js";
import { ComputedSpec } from "./computed.js";
import { ActionSpec } from "./action.js";
import { TypeSpec } from "./type-spec.js";

/**
 * Schema metadata
 */
export const SchemaMeta = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  authors: z.array(z.string()).optional(),
});
export type SchemaMeta = z.infer<typeof SchemaMeta>;

/**
 * DomainSchema - Complete schema definition
 *
 * Defines:
 * - What the domain looks like (StateSpec)
 * - What can be derived (ComputedSpec)
 * - How state transitions occur (Actions → FlowSpec)
 */
export const DomainSchema = z.object({
  /**
   * Unique identifier for this schema.
   * MUST be a valid URI or UUID.
   */
  id: z.string(),

  /**
   * Semantic version.
   * MUST follow Semantic Versioning 2.0.
   */
  version: z.string(),

  /**
   * Content hash for integrity verification.
   * MUST be computed using the Canonical Form algorithm.
   */
  hash: z.string(),

  /**
   * Named type declarations (compiler v0.3.3).
   * Pure metadata; Core does not interpret these.
   */
  types: z.record(z.string(), TypeSpec),

  /**
   * State structure definition
   */
  state: StateSpec,

  /**
   * Computed values (DAG)
   */
  computed: ComputedSpec,

  /**
   * Intent-to-Flow mappings
   */
  actions: z.record(z.string(), ActionSpec),

  /**
   * Schema metadata
   */
  meta: SchemaMeta.optional(),
});
export type DomainSchema = z.infer<typeof DomainSchema>;
