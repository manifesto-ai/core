export { ComponentPatternDetector, componentDetector } from './component.js';
export { HookPatternDetector, hookDetector } from './hook.js';
export { ContextPatternDetector, contextDetector } from './context.js';
export { TypeScriptPatternDetector, typescriptDetector } from './typescript.js';

import type { Module } from '@swc/core';
import type { DetectedPattern, PatternDetector } from '../types.js';
import { componentDetector } from './component.js';
import { hookDetector } from './hook.js';
import { contextDetector } from './context.js';
import { typescriptDetector } from './typescript.js';

/**
 * 모든 패턴 감지기
 */
export const allDetectors: PatternDetector[] = [
  componentDetector,
  hookDetector,
  contextDetector,
  typescriptDetector,
];

/**
 * AST에서 모든 패턴 감지
 */
export function detectAllPatterns(ast: Module, filePath: string): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (const detector of allDetectors) {
    const detected = detector.detect(ast, filePath);
    patterns.push(...detected);
  }

  // 중복 제거 (같은 위치의 패턴)
  const uniquePatterns = deduplicatePatterns(patterns);

  // confidence 순으로 정렬
  uniquePatterns.sort((a, b) => b.confidence - a.confidence);

  return uniquePatterns;
}

/**
 * 패턴 중복 제거
 */
function deduplicatePatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  const seen = new Map<string, DetectedPattern>();

  for (const pattern of patterns) {
    const key = `${pattern.type}:${pattern.name}:${pattern.location.start.column}`;
    const existing = seen.get(key);

    // 더 높은 confidence의 패턴 유지
    if (!existing || existing.confidence < pattern.confidence) {
      seen.set(key, pattern);
    }
  }

  return Array.from(seen.values());
}

/**
 * 특정 타입의 패턴만 필터링
 */
export function filterPatternsByType(
  patterns: DetectedPattern[],
  type: DetectedPattern['type']
): DetectedPattern[] {
  return patterns.filter(p => p.type === type);
}

/**
 * 리뷰가 필요한 패턴만 필터링
 */
export function filterPatternsNeedingReview(patterns: DetectedPattern[]): DetectedPattern[] {
  return patterns.filter(p => p.needsReview);
}

/**
 * confidence threshold 이상의 패턴만 필터링
 */
export function filterPatternsByConfidence(
  patterns: DetectedPattern[],
  threshold: number
): DetectedPattern[] {
  return patterns.filter(p => p.confidence >= threshold);
}
