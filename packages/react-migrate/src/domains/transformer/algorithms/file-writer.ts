/**
 * File Writer Algorithm
 *
 * 생성된 스키마를 파일 시스템에 기록합니다.
 */

import type { ManifestoDomainJson, DomainFile, SourceMapping, RollbackPoint } from '../types.js';
import { serializeSchema } from './schema-generator.js';

/**
 * 파일 쓰기 결과
 */
export interface WriteResult {
  success: boolean;
  path: string;
  size: number;
  error?: string;
}

/**
 * 백업 생성 결과
 */
export interface BackupResult {
  success: boolean;
  rollbackPoint: RollbackPoint | null;
  error?: string;
}

/**
 * 출력 디렉토리 구조
 */
export interface OutputStructure {
  domains: DomainFileInfo[];
  meta: MetaFileInfo;
}

/**
 * 도메인 파일 정보
 */
export interface DomainFileInfo {
  name: string;
  path: string;
  content: string;
  size: number;
}

/**
 * 메타 파일 정보
 */
export interface MetaFileInfo {
  migrationLog: MigrationLog;
  sourceMappings: SourceMappingFile;
}

/**
 * 마이그레이션 로그
 */
export interface MigrationLog {
  version: string;
  timestamp: number;
  domains: Array<{
    name: string;
    sourceFiles: string[];
    confidence: number;
  }>;
  summary: {
    totalDomains: number;
    totalEntities: number;
    totalIntents: number;
    averageConfidence: number;
  };
}

/**
 * 소스 매핑 파일
 */
export interface SourceMappingFile {
  version: string;
  timestamp: number;
  mappings: Record<string, SourceMapping[]>; // domain -> mappings
}

/**
 * 출력 구조 생성
 */
export function createOutputStructure(
  domainFiles: DomainFile[],
  outputDir: string
): OutputStructure {
  const domains: DomainFileInfo[] = [];
  const allMappings: Record<string, SourceMapping[]> = {};

  let totalEntities = 0;
  let totalIntents = 0;
  let totalConfidence = 0;

  for (const file of domainFiles) {
    const content = serializeSchema(file.content);

    domains.push({
      name: file.name,
      path: file.path,
      content,
      size: Buffer.byteLength(content, 'utf8'),
    });

    allMappings[file.content.domain] = file.sourceMappings;

    totalEntities += Object.keys(file.content.entities).length;
    totalIntents += Object.keys(file.content.intents).length;
    totalConfidence += file.content.metadata.confidence;
  }

  const migrationLog: MigrationLog = {
    version: '1.0.0',
    timestamp: Date.now(),
    domains: domainFiles.map(f => ({
      name: f.content.domain,
      sourceFiles: f.content.metadata.sourceFiles,
      confidence: f.content.metadata.confidence,
    })),
    summary: {
      totalDomains: domainFiles.length,
      totalEntities,
      totalIntents,
      averageConfidence: domainFiles.length > 0 ? totalConfidence / domainFiles.length : 0,
    },
  };

  const sourceMappings: SourceMappingFile = {
    version: '1.0.0',
    timestamp: Date.now(),
    mappings: allMappings,
  };

  return {
    domains,
    meta: {
      migrationLog,
      sourceMappings,
    },
  };
}

/**
 * 마이그레이션 로그 직렬화
 */
export function serializeMigrationLog(log: MigrationLog): string {
  return JSON.stringify(log, null, 2);
}

/**
 * 소스 매핑 직렬화
 */
export function serializeSourceMappings(mappings: SourceMappingFile): string {
  return JSON.stringify(mappings, null, 2);
}

/**
 * 파일 경로 목록 생성
 */
export function getOutputFilePaths(outputDir: string, domainNames: string[]): string[] {
  const paths: string[] = [];

  for (const domain of domainNames) {
    paths.push(`${outputDir}/${domain}.domain.json`);
  }

  paths.push(`${outputDir}/_meta/migration.log.json`);
  paths.push(`${outputDir}/_meta/source-mapping.json`);

  return paths;
}

/**
 * 롤백 포인트에서 파일 복원을 위한 명령 생성
 */
export function createRestoreCommands(
  rollback: RollbackPoint
): Array<{ action: 'write' | 'delete'; path: string; content?: string }> {
  const commands: Array<{ action: 'write' | 'delete'; path: string; content?: string }> = [];

  for (const file of rollback.files) {
    if (file.content === null) {
      // 파일이 없었으면 삭제
      commands.push({ action: 'delete', path: file.path });
    } else {
      // 파일이 있었으면 복원
      commands.push({ action: 'write', path: file.path, content: file.content });
    }
  }

  return commands;
}

/**
 * 쓰기 작업 계획 생성
 */
export interface WritePlan {
  filesToWrite: Array<{ path: string; content: string }>;
  directoriesToCreate: string[];
  filesToBackup: string[];
}

export function createWritePlan(
  structure: OutputStructure,
  outputDir: string
): WritePlan {
  const filesToWrite: Array<{ path: string; content: string }> = [];
  const directoriesToCreate: Set<string> = new Set();
  const filesToBackup: string[] = [];

  // 도메인 파일들
  for (const domain of structure.domains) {
    filesToWrite.push({
      path: domain.path,
      content: domain.content,
    });
    filesToBackup.push(domain.path);

    // 디렉토리 추출
    const dir = domain.path.substring(0, domain.path.lastIndexOf('/'));
    if (dir) {
      directoriesToCreate.add(dir);
    }
  }

  // 메타 파일들
  const metaDir = `${outputDir}/_meta`;
  directoriesToCreate.add(metaDir);

  filesToWrite.push({
    path: `${metaDir}/migration.log.json`,
    content: serializeMigrationLog(structure.meta.migrationLog),
  });
  filesToBackup.push(`${metaDir}/migration.log.json`);

  filesToWrite.push({
    path: `${metaDir}/source-mapping.json`,
    content: serializeSourceMappings(structure.meta.sourceMappings),
  });
  filesToBackup.push(`${metaDir}/source-mapping.json`);

  return {
    filesToWrite,
    directoriesToCreate: [...directoriesToCreate],
    filesToBackup,
  };
}

/**
 * 쓰기 계획 요약
 */
export function summarizeWritePlan(plan: WritePlan): string {
  const lines: string[] = [
    `Files to write: ${plan.filesToWrite.length}`,
    `Directories to create: ${plan.directoriesToCreate.length}`,
    '',
    'Files:',
    ...plan.filesToWrite.map(f => `  - ${f.path} (${Buffer.byteLength(f.content, 'utf8')} bytes)`),
    '',
    'Directories:',
    ...plan.directoriesToCreate.map(d => `  - ${d}`),
  ];

  return lines.join('\n');
}

/**
 * 총 출력 크기 계산
 */
export function calculateTotalSize(structure: OutputStructure): number {
  let total = 0;

  for (const domain of structure.domains) {
    total += domain.size;
  }

  total += Buffer.byteLength(serializeMigrationLog(structure.meta.migrationLog), 'utf8');
  total += Buffer.byteLength(serializeSourceMappings(structure.meta.sourceMappings), 'utf8');

  return total;
}
