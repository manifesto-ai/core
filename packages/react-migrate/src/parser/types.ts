import type { Module } from '@swc/core';

/**
 * React 패턴 타입
 */
export type PatternType =
  | 'component'
  | 'hook'
  | 'context'
  | 'reducer'
  | 'form'
  | 'effect'
  | 'unknown';

/**
 * 소스 코드 위치
 */
export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * 패턴별 메타데이터
 */
export interface PatternMetadata {
  // Component-specific
  props?: string[];
  hooks?: string[];
  isForwardRef?: boolean;
  isMemo?: boolean;

  // Hook-specific
  dependencies?: string[];
  returnType?: string;
  isCustomHook?: boolean;

  // Context-specific
  contextName?: string;
  contextValue?: string;
  hasProvider?: boolean;
  hasConsumer?: boolean;

  // State-specific
  stateShape?: Record<string, unknown>;
  actions?: string[];
  initialState?: unknown;

  // Form-specific
  formLibrary?: 'react-hook-form' | 'formik' | 'native' | 'unknown';
  fields?: string[];

  // Generic
  [key: string]: unknown;
}

/**
 * 감지된 패턴
 */
export interface DetectedPattern {
  type: PatternType;
  name: string;
  location: SourceLocation;
  confidence: number;
  metadata: PatternMetadata;
  needsReview: boolean;
  rawCode?: string;
}

/**
 * Import 정보
 */
export interface ImportInfo {
  source: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  isTypeOnly: boolean;
}

/**
 * Export 정보
 */
export interface ExportInfo {
  name: string;
  isDefault: boolean;
  isTypeOnly: boolean;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'unknown';
}

/**
 * 분석 이슈
 */
export interface AnalysisIssue {
  code: string;
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * 파일 분석 결과
 */
export interface FileAnalysis {
  path: string;
  relativePath: string;
  type: 'component' | 'hook' | 'context' | 'util' | 'store' | 'unknown';
  ast: Module | null;
  patterns: DetectedPattern[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  confidence: number;
  issues: AnalysisIssue[];
  parseTime: number;
}

/**
 * 파싱 옵션
 */
export interface ParseOptions {
  syntax: 'typescript' | 'ecmascript';
  tsx?: boolean;
  jsx?: boolean;
  decorators?: boolean;
}

/**
 * 파싱 에러
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  snippet?: string;
}

/**
 * 파싱 결과
 */
export interface ParseResult {
  success: boolean;
  ast: Module | null;
  errors: ParseError[];
  filePath: string;
  parseTime: number;
}

/**
 * 스캔된 파일
 */
export interface ScannedFile {
  path: string;
  relativePath: string;
  extension: string;
  content: string;
  size: number;
}

/**
 * 스캔 옵션
 */
export interface ScanOptions {
  rootDir: string;
  include?: string[];
  exclude?: string[];
  maxFileSize?: number;
}

/**
 * 배치 분석 결과
 */
export interface BatchAnalysisResult {
  files: FileAnalysis[];
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalPatterns: number;
  totalParseTime: number;
  issues: AnalysisIssue[];
}

/**
 * 패턴 감지기 인터페이스
 */
export interface PatternDetector {
  readonly type: PatternType;
  detect(ast: Module, filePath: string): DetectedPattern[];
}
