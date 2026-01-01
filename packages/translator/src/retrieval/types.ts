/**
 * Retrieval Types
 */

import type { TypeExpr } from "../types/index.js";
import type lunr from "lunr";

/** Field info from schema */
export interface FieldInfo {
  name: string;
  description?: string;
  type: TypeExpr;
}

/** Schema info for indexing */
export interface SchemaInfo {
  fields: Record<string, FieldInfo>;
}

/** Search options */
export interface SearchOptions {
  maxCandidates?: number;
}

/** Retrieval index structure */
export interface RetrievalIndex {
  lunrIndex: lunr.Index;
  aliasTable: Map<string, string[]>;
  schemaInfo: SchemaInfo;
  fieldNameToPath: Map<string, string[]>;
}
