import type { SemanticPath } from '../domain/types.js';
import type { ProjectedSnapshot } from './types.js';

/**
 * 기본 토큰 추정 함수
 * JSON 직렬화 후 문자 수를 기반으로 추정
 *
 * 추정 방식:
 * - 영어/숫자: 약 4자당 1토큰
 * - 한글: 약 2자당 1토큰 (더 많은 토큰 사용)
 * - JSON 구조 오버헤드 포함
 *
 * @param obj - 토큰 수를 추정할 객체
 * @returns 추정된 토큰 수
 */
export function estimateTokens(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 1;
  }

  const jsonString = JSON.stringify(obj);
  const length = jsonString.length;

  // 한글 문자 수 계산 (유니코드 범위: AC00-D7AF)
  const koreanChars = (jsonString.match(/[\uAC00-\uD7AF]/g) || []).length;

  // 한글은 2자당 1토큰, 나머지는 4자당 1토큰으로 추정
  const koreanTokens = Math.ceil(koreanChars / 2);
  const otherTokens = Math.ceil((length - koreanChars) / 4);

  return koreanTokens + otherTokens;
}

/**
 * 경로별 토큰 비용 계산
 *
 * @param snapshot - 스냅샷 객체
 * @param path - 계산할 경로
 * @returns 해당 경로의 추정 토큰 수
 */
export function estimateTokensByPath(
  snapshot: ProjectedSnapshot,
  path: SemanticPath
): number {
  const value = getValueByPath(snapshot, path);
  if (value === undefined) {
    return 0;
  }
  return estimateTokens(value);
}

/**
 * 경로들을 토큰 비용 순으로 정렬
 *
 * @param snapshot - 스냅샷 객체
 * @param paths - 정렬할 경로 목록
 * @returns 토큰 비용과 함께 정렬된 경로 목록 (비용 오름차순)
 */
export function rankPathsByTokenCost(
  snapshot: ProjectedSnapshot,
  paths: SemanticPath[]
): Array<{ path: SemanticPath; tokens: number }> {
  const ranked = paths.map((path) => ({
    path,
    tokens: estimateTokensByPath(snapshot, path),
  }));

  return ranked.sort((a, b) => a.tokens - b.tokens);
}

/**
 * 경로에서 값 추출
 *
 * @param obj - 소스 객체
 * @param path - 추출할 경로 (예: 'state.currentQuery.raw')
 * @returns 해당 경로의 값
 */
export function getValueByPath(obj: unknown, path: SemanticPath): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * 경로에 값 설정
 *
 * @param obj - 대상 객체
 * @param path - 설정할 경로
 * @param value - 설정할 값
 */
export function setValueByPath(
  obj: Record<string, unknown>,
  path: SemanticPath,
  value: unknown
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

/**
 * 토큰 예산 내에서 포함 가능한 경로 선택
 *
 * @param snapshot - 스냅샷 객체
 * @param paths - 후보 경로 목록
 * @param budget - 토큰 예산
 * @returns 예산 내에 포함 가능한 경로 목록
 */
export function selectPathsWithinBudget(
  snapshot: ProjectedSnapshot,
  paths: SemanticPath[],
  budget: number
): { selected: SemanticPath[]; totalTokens: number; excluded: SemanticPath[] } {
  const ranked = rankPathsByTokenCost(snapshot, paths);

  const selected: SemanticPath[] = [];
  const excluded: SemanticPath[] = [];
  let totalTokens = 0;

  // JSON 구조 오버헤드 (대략 20토큰)
  const overhead = 20;

  for (const { path, tokens } of ranked) {
    if (totalTokens + tokens + overhead <= budget) {
      selected.push(path);
      totalTokens += tokens;
    } else {
      excluded.push(path);
    }
  }

  return { selected, totalTokens: totalTokens + overhead, excluded };
}
