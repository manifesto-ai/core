/**
 * @manifesto-ai/agent - Handlers Index
 *
 * 모든 Effect 핸들러 재내보내기
 */

// Registry
export type {
  HandlerContext,
  Tool,
  ToolRegistry,
  EffectHandler,
  EffectHandlerRegistry,
} from './registry.js';
export {
  createEffectHandlerRegistry,
  createToolRegistry,
  defineTool,
} from './registry.js';

// Tool call handler
export type { ToolCallResult } from './tool-call.js';
export {
  createToolCallHandler,
  executeToolCall,
} from './tool-call.js';

// Patch handler
export type { PatchResult } from './patch.js';
export {
  createSnapshotPatchHandler,
  PatchValidationError,
  applyPatch,
  applyPatchOpToObject,
} from './patch.js';

// Log handler
export type {
  LogEntry,
  LogCollector,
  ConsoleLogOptions,
} from './log.js';
export {
  createLogCollector,
  defaultLogFormatter,
  createLogEmitHandler,
  getGlobalLogCollector,
  resetGlobalLogCollector,
} from './log.js';

/**
 * 모든 기본 핸들러를 포함한 레지스트리 생성
 */
import { createEffectHandlerRegistry } from './registry.js';
import { createToolCallHandler } from './tool-call.js';
import { createSnapshotPatchHandler } from './patch.js';
import { createLogEmitHandler, type LogCollector, type ConsoleLogOptions } from './log.js';

export type DefaultHandlersOptions<S = unknown> = {
  logCollector?: LogCollector;
  consoleLogOptions?: ConsoleLogOptions;
};

/**
 * 기본 핸들러들이 등록된 레지스트리 생성
 */
export function createDefaultHandlerRegistry<S = unknown>(
  options?: DefaultHandlersOptions<S>
) {
  const registry = createEffectHandlerRegistry<S>();

  // tool.call 핸들러
  registry.register(createToolCallHandler<S>());

  // snapshot.patch 핸들러
  registry.register(createSnapshotPatchHandler<S>());

  // log.emit 핸들러
  registry.register(createLogEmitHandler<S>(
    options?.logCollector,
    options?.consoleLogOptions
  ));

  return registry;
}
