/**
 * @manifesto-ai/agent - Projection Module
 *
 * LLM 컨텍스트 투영 기능 모듈.
 * 전체 스냅샷에서 필요한 부분만 추출하여 토큰 예산 내로 제한.
 *
 * @version 0.1.x
 */

// Types
export type {
  ProjectedSnapshot,
  ProjectionMetadata,
  ProjectionResult,
  CompressionStrategy,
  ProjectionProviderConfig,
  ProjectionProvider,
  CreateProjectionProviderOptions,
} from './types.js';

// Providers
export {
  createSimpleProjectionProvider,
  createIdentityProjectionProvider,
  createDynamicProjectionProvider,
} from './provider.js';
