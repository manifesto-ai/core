// Types
export type {
  PatternType,
  SourceLocation,
  PatternMetadata,
  DetectedPattern,
  ImportInfo,
  ExportInfo,
  AnalysisIssue,
  FileAnalysis,
  ParseOptions,
  ParseError,
  ParseResult,
  ScannedFile,
  ScanOptions,
  BatchAnalysisResult,
  PatternDetector,
} from './types.js';

// SWC Parser
export {
  parseFile,
  parseBatch,
  isValidAST,
  findNodes,
  getNodeLocation,
  extractImports,
  extractExports,
  type Module,
} from './swc-parser.js';

// File Scanner
export {
  scanFiles,
  countFiles,
  isReactFile,
  inferFileType,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_MAX_FILE_SIZE,
} from './file-scanner.js';

// Pattern Detectors
export {
  componentDetector,
  hookDetector,
  contextDetector,
  allDetectors,
  detectAllPatterns,
  filterPatternsByType,
  filterPatternsNeedingReview,
  filterPatternsByConfidence,
} from './patterns/index.js';

import type { Module } from '@swc/core';
import type { FileAnalysis, ScannedFile, BatchAnalysisResult, AnalysisIssue, ScanOptions } from './types.js';
import { parseFile, isValidAST, extractImports, extractExports } from './swc-parser.js';
import { scanFiles, inferFileType, isReactFile } from './file-scanner.js';
import { detectAllPatterns } from './patterns/index.js';

/**
 * 단일 파일 분석
 */
export function analyzeFile(file: ScannedFile): FileAnalysis {
  const parseResult = parseFile(file.content, file.path);

  if (!parseResult.success || !isValidAST(parseResult.ast)) {
    return {
      path: file.path,
      relativePath: file.relativePath,
      type: 'unknown',
      ast: null,
      patterns: [],
      imports: [],
      exports: [],
      confidence: 0,
      issues: parseResult.errors.map(e => ({
        code: 'PARSE_ERROR',
        message: e.message,
        location: { start: { line: e.line, column: e.column }, end: { line: e.line, column: e.column } },
        severity: 'error' as const,
      })),
      parseTime: parseResult.parseTime,
    };
  }

  const ast = parseResult.ast as Module;
  const patterns = detectAllPatterns(ast, file.path);
  const fileType = inferFileType(file.path, file.content);

  // 전체 confidence 계산 (패턴들의 평균)
  const avgConfidence = patterns.length > 0
    ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
    : 0;

  // Extract imports and exports from AST
  const imports = extractImports(ast);
  const exports = extractExports(ast);

  return {
    path: file.path,
    relativePath: file.relativePath,
    type: fileType,
    ast,
    patterns,
    imports,
    exports,
    confidence: avgConfidence,
    issues: [],
    parseTime: parseResult.parseTime,
  };
}

/**
 * 여러 파일 배치 분석
 */
export async function analyzeFiles(options: ScanOptions): Promise<BatchAnalysisResult> {
  const files = await scanFiles(options);
  const analyses: FileAnalysis[] = [];
  const globalIssues: AnalysisIssue[] = [];
  let totalParseTime = 0;
  let successCount = 0;
  let failCount = 0;
  let totalPatterns = 0;

  for (const file of files) {
    // React 파일만 분석
    if (!isReactFile(file.content)) {
      continue;
    }

    const analysis = analyzeFile(file);
    analyses.push(analysis);
    totalParseTime += analysis.parseTime;

    if (analysis.issues.some(i => i.severity === 'error')) {
      failCount++;
    } else {
      successCount++;
    }

    totalPatterns += analysis.patterns.length;
  }

  return {
    files: analyses,
    totalFiles: analyses.length,
    successfulFiles: successCount,
    failedFiles: failCount,
    totalPatterns,
    totalParseTime,
    issues: globalIssues,
  };
}
