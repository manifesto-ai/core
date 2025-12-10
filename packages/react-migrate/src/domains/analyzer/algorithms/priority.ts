/**
 * File Priority Calculator
 *
 * 파일 분석 우선순위를 계산합니다.
 * 높은 우선순위의 파일이 먼저 분석되어 컨텍스트를 구축합니다.
 */

import type { ScannedFile } from '../../../parser/types.js';
import type { FileTask } from '../types.js';

/**
 * 우선순위 계산 요소
 */
export interface PriorityFactors {
  /** Entry point 여부 (+30) */
  isEntryPoint: number;
  /** Context 생성 여부 (+25) */
  hasContextCreation: number;
  /** Custom Hook 정의 여부 (+20) */
  hasCustomHook: number;
  /** useReducer 사용 여부 (+20) */
  hasReducer: number;
  /** Provider 패턴 여부 (+15) */
  hasProvider: number;
  /** Export 수 (각 +2) */
  exportBonus: number;
  /** Import 수 (각 -1) */
  importPenalty: number;
  /** 파일 크기 패널티 (-0.001/byte, 최대 -10) */
  sizePenalty: number;
  /** 디렉토리 깊이 패널티 (각 -5) */
  depthPenalty: number;
}

/**
 * Entry point 파일 패턴
 */
const ENTRY_POINT_PATTERNS = [
  /^index\.(tsx?|jsx?)$/,
  /^App\.(tsx?|jsx?)$/,
  /^main\.(tsx?|jsx?)$/,
  /^_app\.(tsx?|jsx?)$/,    // Next.js
  /^layout\.(tsx?|jsx?)$/,  // Next.js App Router
];

/**
 * Context 생성 패턴
 */
const CONTEXT_CREATION_PATTERN = /createContext\s*[<(]/;

/**
 * Custom Hook 정의 패턴
 */
const CUSTOM_HOOK_PATTERN = /export\s+(default\s+)?function\s+use[A-Z]/;

/**
 * useReducer 사용 패턴
 */
const USE_REDUCER_PATTERN = /useReducer\s*\(/;

/**
 * Provider 패턴
 */
const PROVIDER_PATTERN = /Provider[>\s]/;

/**
 * Import/Export 카운트 패턴
 */
const IMPORT_PATTERN = /import\s+/g;
const EXPORT_PATTERN = /export\s+/g;

/**
 * 파일명이 entry point인지 확인
 */
export function isEntryPoint(fileName: string): boolean {
  return ENTRY_POINT_PATTERNS.some(pattern => pattern.test(fileName));
}

/**
 * 단일 파일의 우선순위 계산
 */
export function calculatePriority(file: ScannedFile): number {
  const BASE_PRIORITY = 50;
  let priority = BASE_PRIORITY;

  const content = file.content;
  const fileName = file.relativePath.split('/').pop() ?? '';

  // Entry point 보너스
  if (isEntryPoint(fileName)) {
    priority += 30;
  }

  // Context 생성 보너스
  if (CONTEXT_CREATION_PATTERN.test(content)) {
    priority += 25;
  }

  // Custom Hook 정의 보너스
  if (CUSTOM_HOOK_PATTERN.test(content)) {
    priority += 20;
  }

  // useReducer 사용 보너스
  if (USE_REDUCER_PATTERN.test(content)) {
    priority += 20;
  }

  // Provider 패턴 보너스
  if (PROVIDER_PATTERN.test(content)) {
    priority += 15;
  }

  // Export 수 보너스
  const exportMatches = content.match(EXPORT_PATTERN);
  const exportCount = exportMatches?.length ?? 0;
  priority += Math.min(exportCount * 2, 20); // 최대 +20

  // Import 수 패널티
  const importMatches = content.match(IMPORT_PATTERN);
  const importCount = importMatches?.length ?? 0;
  priority -= Math.min(importCount, 15); // 최대 -15

  // 파일 크기 패널티 (큰 파일은 나중에)
  const sizePenalty = Math.min(file.size * 0.0001, 10);
  priority -= sizePenalty;

  // 디렉토리 깊이 패널티
  const depth = file.relativePath.split('/').length - 1;
  priority -= Math.min(depth * 3, 15); // 최대 -15

  // 0-100 범위로 클램핑
  return Math.max(0, Math.min(100, Math.round(priority)));
}

/**
 * 우선순위 요소 분석 (디버깅/설명용)
 */
export function analyzePriorityFactors(file: ScannedFile): PriorityFactors {
  const content = file.content;
  const fileName = file.relativePath.split('/').pop() ?? '';

  const exportMatches = content.match(EXPORT_PATTERN);
  const importMatches = content.match(IMPORT_PATTERN);

  return {
    isEntryPoint: isEntryPoint(fileName) ? 30 : 0,
    hasContextCreation: CONTEXT_CREATION_PATTERN.test(content) ? 25 : 0,
    hasCustomHook: CUSTOM_HOOK_PATTERN.test(content) ? 20 : 0,
    hasReducer: USE_REDUCER_PATTERN.test(content) ? 20 : 0,
    hasProvider: PROVIDER_PATTERN.test(content) ? 15 : 0,
    exportBonus: Math.min((exportMatches?.length ?? 0) * 2, 20),
    importPenalty: -Math.min(importMatches?.length ?? 0, 15),
    sizePenalty: -Math.min(file.size * 0.0001, 10),
    depthPenalty: -Math.min((file.relativePath.split('/').length - 1) * 3, 15),
  };
}

/**
 * ScannedFile을 FileTask로 변환
 */
export function createFileTask(
  file: ScannedFile,
  rootDir: string
): FileTask {
  return {
    path: file.path,
    relativePath: file.relativePath,
    priority: calculatePriority(file),
    dependencies: [], // 나중에 dependency graph에서 채움
    status: 'pending',
    hash: undefined, // 선택적으로 해시 계산 가능
  };
}

/**
 * 여러 파일을 FileTask 배열로 변환하고 우선순위 정렬
 */
export function createFileTasks(
  files: ScannedFile[],
  rootDir: string
): FileTask[] {
  return files
    .map(file => createFileTask(file, rootDir))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 특정 디렉토리가 feature 디렉토리인지 확인
 */
export function isFeatureDirectory(dirPath: string): boolean {
  const featurePatterns = [
    /features?\//i,
    /modules?\//i,
    /domains?\//i,
    /pages?\//i,
    /views?\//i,
    /screens?\//i,
  ];
  return featurePatterns.some(pattern => pattern.test(dirPath));
}

/**
 * 파일 경로에서 도메인 이름 추론
 */
export function inferDomainFromPath(filePath: string): string | null {
  const parts = filePath.split('/');

  // features/user/... -> user
  // modules/auth/... -> auth
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part && ['features', 'modules', 'domains', 'pages', 'views', 'screens'].includes(part.toLowerCase())) {
      return parts[i + 1] ?? null;
    }
  }

  // hooks/useUser.ts -> user
  const fileName = parts[parts.length - 1] ?? '';
  const hookMatch = fileName.match(/^use([A-Z][a-zA-Z]*)\.(tsx?|jsx?)$/);
  if (hookMatch && hookMatch[1]) {
    return hookMatch[1].toLowerCase();
  }

  // UserContext.tsx -> user
  const contextMatch = fileName.match(/^([A-Z][a-zA-Z]*)Context\.(tsx?|jsx?)$/);
  if (contextMatch && contextMatch[1]) {
    return contextMatch[1].toLowerCase();
  }

  return null;
}
