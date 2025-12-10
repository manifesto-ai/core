import { globby } from 'globby';
import { readFile, stat } from 'fs/promises';
import { resolve, relative } from 'path';
import type { ScannedFile, ScanOptions } from './types.js';

/**
 * 기본 포함 패턴
 */
const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.tsx',
  '**/*.ts',
  '**/*.jsx',
  '**/*.js',
];

/**
 * 기본 제외 패턴
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/vite.config.*',
  '**/vitest.config.*',
  '**/webpack.config.*',
  '**/rollup.config.*',
  '**/eslint.config.*',
  '**/prettier.config.*',
  '**/tailwind.config.*',
  '**/postcss.config.*',
  '**/jest.config.*',
];

/**
 * 기본 최대 파일 크기 (1MB)
 */
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

/**
 * 파일 확장자 추출
 */
function getExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? (parts.pop() ?? '') : '';
}

/**
 * 디렉토리의 파일들을 스캔
 */
export async function scanFiles(options: ScanOptions): Promise<ScannedFile[]> {
  const {
    rootDir,
    include = DEFAULT_INCLUDE_PATTERNS,
    exclude = DEFAULT_EXCLUDE_PATTERNS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
  } = options;

  const resolvedRoot = resolve(rootDir);

  // globby로 파일 목록 가져오기
  const filePaths = await globby(include, {
    cwd: resolvedRoot,
    ignore: exclude,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  const files: ScannedFile[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  // 파일 내용 읽기 (병렬 처리)
  const filePromises = filePaths.map(async (filePath) => {
    try {
      const fileStat = await stat(filePath);

      // 파일 크기 체크
      if (fileStat.size > maxFileSize) {
        errors.push({
          path: filePath,
          error: `File too large: ${fileStat.size} bytes (max: ${maxFileSize})`,
        });
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      const relativePath = relative(resolvedRoot, filePath);

      return {
        path: filePath,
        relativePath,
        extension: getExtension(filePath),
        content,
        size: content.length,
      } satisfies ScannedFile;
    } catch (error) {
      errors.push({
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  });

  const results = await Promise.all(filePromises);

  for (const result of results) {
    if (result !== null) {
      files.push(result);
    }
  }

  // 크기순으로 정렬 (작은 파일 먼저 처리하면 더 빠름)
  files.sort((a, b) => a.size - b.size);

  return files;
}

/**
 * 파일 개수만 빠르게 조회
 */
export async function countFiles(options: ScanOptions): Promise<number> {
  const {
    rootDir,
    include = DEFAULT_INCLUDE_PATTERNS,
    exclude = DEFAULT_EXCLUDE_PATTERNS,
  } = options;

  const resolvedRoot = resolve(rootDir);

  const filePaths = await globby(include, {
    cwd: resolvedRoot,
    ignore: exclude,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  return filePaths.length;
}

/**
 * React 파일인지 확인 (내용 기반)
 */
export function isReactFile(content: string): boolean {
  // React import 확인
  const hasReactImport =
    /import\s+(?:React|\{[^}]*\})\s+from\s+['"]react['"]/.test(content) ||
    /import\s+\*\s+as\s+React\s+from\s+['"]react['"]/.test(content) ||
    /require\s*\(\s*['"]react['"]\s*\)/.test(content);

  // JSX 문법 확인
  const hasJSX = /<[A-Z][a-zA-Z0-9]*[\s/>]/.test(content) || /<\/[A-Z]/.test(content);

  // React hooks 사용 확인
  const hasHooks = /use[A-Z][a-zA-Z]*\s*\(/.test(content);

  return hasReactImport || hasJSX || hasHooks;
}

/**
 * 파일 타입 추론
 */
export function inferFileType(
  filePath: string,
  content: string
): 'component' | 'hook' | 'context' | 'util' | 'store' | 'unknown' {
  const fileName = filePath.split('/').pop() ?? '';
  const fileNameLower = fileName.toLowerCase();

  // 파일명 기반 추론
  if (fileNameLower.includes('context')) return 'context';
  if (fileNameLower.includes('store') || fileNameLower.includes('slice')) return 'store';
  if (fileNameLower.startsWith('use') && /^use[A-Z]/.test(fileName)) return 'hook';
  if (fileNameLower.includes('util') || fileNameLower.includes('helper')) return 'util';

  // 내용 기반 추론
  if (/createContext\s*<?\s*\(/.test(content)) return 'context';
  if (/^export\s+(default\s+)?function\s+use[A-Z]/m.test(content)) return 'hook';
  if (/^(export\s+)?(default\s+)?(function|const)\s+[A-Z][a-zA-Z]*\s*[=(<]/m.test(content)) {
    if (/<[A-Z][a-zA-Z]*[\s/>]/.test(content)) return 'component';
  }

  return 'unknown';
}

export { DEFAULT_INCLUDE_PATTERNS, DEFAULT_EXCLUDE_PATTERNS, DEFAULT_MAX_FILE_SIZE };
