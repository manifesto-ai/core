/**
 * Projection Module
 *
 * LLM 컨텍스트 투영을 위한 모듈
 * Action의 projectionScope에 따라 스냅샷을 투영하고 토큰 예산 내로 제한
 */

// Types
export type {
  ProjectedSnapshot,
  ProjectedContext,
  ProjectionErrorCode,
  ProjectionError,
  ProjectionEngineConfig,
  CompressionStrategy,
  CompressionResult,
} from './types.js';

// Token Estimator
export {
  estimateTokens,
  estimateTokensByPath,
  rankPathsByTokenCost,
  getValueByPath,
  setValueByPath,
  selectPathsWithinBudget,
} from './token-estimator.js';

// Compressor
export { compressSnapshot } from './compressor.js';

// Engine
export { ProjectionEngine, createProjectionEngine } from './engine.js';
