/**
 * @manifesto-ai/agent - Effect Structure Validation
 *
 * Effect 객체의 구조 검증.
 * 핸들러 실행 전 기본적인 형식 체크.
 */

import type { Effect } from '../types/effect.js';

/**
 * Effect 검증 결과
 */
export type EffectValidationResult =
  | { ok: true }
  | { ok: false; issue: string };

/**
 * Effect 구조 검증
 *
 * @param effect - 검증할 Effect
 * @returns 검증 결과
 */
export function validateEffectStructure(effect: unknown): EffectValidationResult {
  // null/undefined 체크
  if (effect === null || effect === undefined) {
    return { ok: false, issue: 'Effect is null or undefined' };
  }

  // 객체 타입 체크
  if (typeof effect !== 'object') {
    return { ok: false, issue: `Effect must be an object, got ${typeof effect}` };
  }

  const eff = effect as Record<string, unknown>;

  // type 필드 체크
  if (!('type' in eff)) {
    return { ok: false, issue: 'Effect must have a "type" field' };
  }

  if (typeof eff.type !== 'string') {
    return { ok: false, issue: `Effect type must be a string, got ${typeof eff.type}` };
  }

  // id 필드 체크
  if (!('id' in eff)) {
    return { ok: false, issue: 'Effect must have an "id" field' };
  }

  if (typeof eff.id !== 'string') {
    return { ok: false, issue: `Effect id must be a string, got ${typeof eff.id}` };
  }

  // 타입별 추가 검증
  switch (eff.type) {
    case 'tool.call':
      return validateToolCallEffect(eff);
    case 'snapshot.patch':
      return validateSnapshotPatchEffect(eff);
    case 'log.emit':
      return validateLogEmitEffect(eff);
    default:
      return { ok: false, issue: `Unknown effect type: ${eff.type}` };
  }
}

/**
 * tool.call Effect 검증
 */
function validateToolCallEffect(eff: Record<string, unknown>): EffectValidationResult {
  if (!('tool' in eff)) {
    return { ok: false, issue: 'tool.call effect must have a "tool" field' };
  }

  if (typeof eff.tool !== 'string') {
    return { ok: false, issue: `tool.call effect "tool" must be a string, got ${typeof eff.tool}` };
  }

  if (!('input' in eff)) {
    return { ok: false, issue: 'tool.call effect must have an "input" field' };
  }

  return { ok: true };
}

/**
 * snapshot.patch Effect 검증
 */
function validateSnapshotPatchEffect(eff: Record<string, unknown>): EffectValidationResult {
  if (!('ops' in eff)) {
    return { ok: false, issue: 'snapshot.patch effect must have an "ops" field' };
  }

  if (!Array.isArray(eff.ops)) {
    return { ok: false, issue: `snapshot.patch effect "ops" must be an array, got ${typeof eff.ops}` };
  }

  // 각 op 검증
  for (let i = 0; i < eff.ops.length; i++) {
    const op = eff.ops[i] as Record<string, unknown>;
    const opResult = validatePatchOp(op, i);
    if (!opResult.ok) {
      return opResult;
    }
  }

  return { ok: true };
}

/**
 * PatchOp 검증
 */
function validatePatchOp(op: Record<string, unknown>, index: number): EffectValidationResult {
  if (op === null || op === undefined || typeof op !== 'object') {
    return { ok: false, issue: `ops[${index}] must be an object` };
  }

  if (!('op' in op)) {
    return { ok: false, issue: `ops[${index}] must have an "op" field` };
  }

  if (op.op !== 'set' && op.op !== 'append') {
    return { ok: false, issue: `ops[${index}].op must be "set" or "append", got "${op.op}"` };
  }

  if (!('path' in op)) {
    return { ok: false, issue: `ops[${index}] must have a "path" field` };
  }

  if (typeof op.path !== 'string') {
    return { ok: false, issue: `ops[${index}].path must be a string` };
  }

  if (!('value' in op)) {
    return { ok: false, issue: `ops[${index}] must have a "value" field` };
  }

  return { ok: true };
}

/**
 * log.emit Effect 검증
 */
function validateLogEmitEffect(eff: Record<string, unknown>): EffectValidationResult {
  if (!('level' in eff)) {
    return { ok: false, issue: 'log.emit effect must have a "level" field' };
  }

  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(eff.level as string)) {
    return { ok: false, issue: `log.emit effect "level" must be one of ${validLevels.join(', ')}, got "${eff.level}"` };
  }

  if (!('message' in eff)) {
    return { ok: false, issue: 'log.emit effect must have a "message" field' };
  }

  if (typeof eff.message !== 'string') {
    return { ok: false, issue: `log.emit effect "message" must be a string, got ${typeof eff.message}` };
  }

  return { ok: true };
}

/**
 * AgentDecision 구조 검증
 */
export function validateAgentDecision(decision: unknown): EffectValidationResult {
  if (decision === null || decision === undefined) {
    return { ok: false, issue: 'Decision is null or undefined' };
  }

  if (typeof decision !== 'object') {
    return { ok: false, issue: `Decision must be an object, got ${typeof decision}` };
  }

  const dec = decision as Record<string, unknown>;

  if (!('effects' in dec)) {
    return { ok: false, issue: 'Decision must have an "effects" field' };
  }

  if (!Array.isArray(dec.effects)) {
    return { ok: false, issue: `Decision "effects" must be an array, got ${typeof dec.effects}` };
  }

  // 각 effect 검증
  for (let i = 0; i < dec.effects.length; i++) {
    const result = validateEffectStructure(dec.effects[i]);
    if (!result.ok) {
      return { ok: false, issue: `effects[${i}]: ${result.issue}` };
    }
  }

  return { ok: true };
}
