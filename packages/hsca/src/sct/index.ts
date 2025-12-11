/**
 * SCT (Semantic Compression Tree) Module
 *
 * 대규모 컨텍스트를 계층적으로 압축하여 LLM이 효율적으로 탐색할 수 있게 합니다.
 *
 * @example
 * ```typescript
 * import { SemanticCompressionTree, chunkText } from '@manifesto-ai/hsca';
 *
 * // 텍스트 청킹만 사용
 * const chunks = chunkText(largeText, { strategy: 'semantic' });
 *
 * // SCT 전체 구축
 * const tree = await SemanticCompressionTree.build(largeText, llm);
 * ```
 */

// Types
export type {
  // Core types
  SummaryNode,
  CompressionTree,
  CompressionTreeMetadata,
  SourceType,
  // Chunk types
  Chunk,
  ChunkResult,
  ChunkingConfig,
  ChunkingStrategy,
  // Summarizer types
  SummaryResult,
  SummarizerConfig,
  // Build config
  SCTBuildConfig,
  // Errors
  SCTError,
  SCTErrorCode,
  SummarizerError,
} from './types.js';

// Constants
export {
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_SUMMARIZER_CONFIG,
  DEFAULT_SCT_BUILD_CONFIG,
  SummaryNodeSchema,
  CompressionTreeSchema,
} from './types.js';

// Chunker
export { chunkText, fixedChunker, semanticChunker, adaptiveChunker } from './chunker.js';

// Summarizer
export { summarizeChunk, summarizeGroup, hierarchicalSummarize } from './summarizer.js';

// Tree
export { SemanticCompressionTree } from './tree.js';
