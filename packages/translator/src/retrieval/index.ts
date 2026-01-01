/**
 * Retrieval Module
 *
 * Tier 0 implementation using lunr.js for BM25 search:
 * - Indexes field names, descriptions, and glossary aliases
 * - Applies weighted scoring: 0.4 BM25 + 0.3 alias + 0.2 type + 0.1 recency
 * - Returns AnchorCandidate[] sorted by score
 */

export { buildAliasTable, buildIndex } from "./indexer.js";
export { search } from "./searcher.js";
export type { SchemaInfo, FieldInfo, RetrievalIndex, SearchOptions } from "./types.js";
