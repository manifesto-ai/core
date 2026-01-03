/**
 * Stage 1: Parse Request
 *
 * HTTP 요청 바디를 파싱하고 검증
 */

import { Result, Ok, Err } from '../result';
import { Errors, SimpleAgentError, SimpleAgentInput } from '../types';
import type { Snapshot } from '@/lib/agents/runtime';

/**
 * 요청 바디를 SimpleAgentInput으로 파싱
 *
 * @param body - 파싱되지 않은 요청 바디
 * @returns Result<SimpleAgentInput, SimpleAgentError>
 */
export function parseRequest(body: unknown): Result<SimpleAgentInput, SimpleAgentError> {
  if (!body || typeof body !== 'object') {
    return Err(Errors.validation('body', 'Request body must be an object'));
  }

  const { instruction, snapshot } = body as Record<string, unknown>;

  if (!instruction) {
    return Err(Errors.validation('instruction', 'Instruction is required'));
  }

  if (typeof instruction !== 'string') {
    return Err(Errors.validation('instruction', 'Instruction must be a string'));
  }

  if (!snapshot) {
    return Err(Errors.validation('snapshot', 'Snapshot is required'));
  }

  if (typeof snapshot !== 'object') {
    return Err(Errors.validation('snapshot', 'Snapshot must be an object'));
  }

  // Snapshot 기본 구조 검증
  const snap = snapshot as Record<string, unknown>;
  if (!snap.data || typeof snap.data !== 'object') {
    return Err(Errors.validation('snapshot.data', 'Snapshot must have data object'));
  }

  if (!snap.state || typeof snap.state !== 'object') {
    return Err(Errors.validation('snapshot.state', 'Snapshot must have state object'));
  }

  return Ok({
    instruction: instruction.trim(),
    snapshot: snapshot as Snapshot,
  });
}
