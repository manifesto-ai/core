/**
 * Source Mapper Algorithm
 *
 * React 소스 코드와 생성된 Manifesto 스키마 간의 매핑을 생성합니다.
 */

import type { DetectedPattern } from '../../../parser/types.js';
import type { SchemaProposal, SchemaFieldProposal } from '../../summarizer/types.js';
import type { SourceMapping, ManifestoDomainJson } from '../types.js';

/**
 * 패턴에서 소스 매핑 생성
 */
export function createSourceMappings(
  schema: ManifestoDomainJson,
  proposal: SchemaProposal,
  patterns: DetectedPattern[],
  patternFileMap: Map<DetectedPattern, string>
): SourceMapping[] {
  const mappings: SourceMapping[] = [];

  // 엔티티 매핑
  for (const entityField of proposal.entities) {
    const mapping = createMappingFromField(entityField, patterns, patternFileMap);
    if (mapping) {
      mappings.push(mapping);
    }
  }

  // 상태 매핑
  for (const stateField of proposal.state) {
    const mapping = createMappingFromField(stateField, patterns, patternFileMap);
    if (mapping) {
      mappings.push(mapping);
    }
  }

  // 인텐트 매핑
  for (const intentField of proposal.intents) {
    const mapping = createMappingFromField(intentField, patterns, patternFileMap);
    if (mapping) {
      mappings.push(mapping);
    }
  }

  return mappings;
}

/**
 * 필드 제안에서 소스 매핑 생성
 */
function createMappingFromField(
  field: SchemaFieldProposal,
  patterns: DetectedPattern[],
  patternFileMap: Map<DetectedPattern, string>
): SourceMapping | null {
  // source에서 패턴 이름 추출
  const sourcePatternNames = field.source.split(', ');

  // 해당 패턴 찾기
  for (const patternName of sourcePatternNames) {
    const pattern = patterns.find(p => p.name === patternName);
    if (pattern) {
      const sourcePath = patternFileMap.get(pattern);
      if (sourcePath) {
        return {
          sourcePath,
          sourceLocation: pattern.location.start,
          targetPath: field.path,
          confidence: field.confidence,
          patternType: pattern.type,
        };
      }
    }
  }

  return null;
}

/**
 * 매핑으로부터 역참조 인덱스 생성
 * (스키마 경로 -> 소스 위치들)
 */
export function createReverseIndex(
  mappings: SourceMapping[]
): Map<string, SourceMapping[]> {
  const index = new Map<string, SourceMapping[]>();

  for (const mapping of mappings) {
    if (!index.has(mapping.targetPath)) {
      index.set(mapping.targetPath, []);
    }
    index.get(mapping.targetPath)!.push(mapping);
  }

  return index;
}

/**
 * 소스 파일별로 매핑 그룹화
 */
export function groupMappingsByFile(
  mappings: SourceMapping[]
): Map<string, SourceMapping[]> {
  const byFile = new Map<string, SourceMapping[]>();

  for (const mapping of mappings) {
    if (!byFile.has(mapping.sourcePath)) {
      byFile.set(mapping.sourcePath, []);
    }
    byFile.get(mapping.sourcePath)!.push(mapping);
  }

  return byFile;
}

/**
 * 패턴 타입별로 매핑 그룹화
 */
export function groupMappingsByPatternType(
  mappings: SourceMapping[]
): Map<string, SourceMapping[]> {
  const byType = new Map<string, SourceMapping[]>();

  for (const mapping of mappings) {
    if (!byType.has(mapping.patternType)) {
      byType.set(mapping.patternType, []);
    }
    byType.get(mapping.patternType)!.push(mapping);
  }

  return byType;
}

/**
 * 매핑 통계 계산
 */
export interface MappingStats {
  totalMappings: number;
  byPatternType: Record<string, number>;
  byFile: Record<string, number>;
  averageConfidence: number;
  lowConfidenceCount: number; // < 0.7
}

export function calculateMappingStats(
  mappings: SourceMapping[],
  confidenceThreshold: number = 0.7
): MappingStats {
  if (mappings.length === 0) {
    return {
      totalMappings: 0,
      byPatternType: {},
      byFile: {},
      averageConfidence: 0,
      lowConfidenceCount: 0,
    };
  }

  const byPatternType: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  let totalConfidence = 0;
  let lowConfidenceCount = 0;

  for (const mapping of mappings) {
    // 패턴 타입별 카운트
    byPatternType[mapping.patternType] = (byPatternType[mapping.patternType] ?? 0) + 1;

    // 파일별 카운트
    byFile[mapping.sourcePath] = (byFile[mapping.sourcePath] ?? 0) + 1;

    // 신뢰도 합산
    totalConfidence += mapping.confidence;

    // 낮은 신뢰도 카운트
    if (mapping.confidence < confidenceThreshold) {
      lowConfidenceCount++;
    }
  }

  return {
    totalMappings: mappings.length,
    byPatternType,
    byFile,
    averageConfidence: totalConfidence / mappings.length,
    lowConfidenceCount,
  };
}

/**
 * 매핑을 사람이 읽을 수 있는 형태로 포맷팅
 */
export function formatMapping(mapping: SourceMapping): string {
  return `${mapping.sourcePath}:${mapping.sourceLocation.line}:${mapping.sourceLocation.column} -> ${mapping.targetPath} (${mapping.patternType}, confidence: ${(mapping.confidence * 100).toFixed(0)}%)`;
}

/**
 * 매핑 목록을 마크다운으로 렌더링
 */
export function renderMappingsAsMarkdown(mappings: SourceMapping[]): string {
  const lines: string[] = [
    '# Source Mappings',
    '',
    '| Source | Location | Target Path | Pattern Type | Confidence |',
    '|--------|----------|-------------|--------------|------------|',
  ];

  for (const mapping of mappings) {
    lines.push(
      `| ${mapping.sourcePath} | ${mapping.sourceLocation.line}:${mapping.sourceLocation.column} | ${mapping.targetPath} | ${mapping.patternType} | ${(mapping.confidence * 100).toFixed(0)}% |`
    );
  }

  return lines.join('\n');
}

/**
 * 매핑 검증
 */
export function validateMappings(
  mappings: SourceMapping[],
  schema: ManifestoDomainJson
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const mapping of mappings) {
    // 타겟 경로가 스키마에 존재하는지 확인
    const pathParts = mapping.targetPath.split('.');
    if (pathParts[0] !== schema.domain) {
      errors.push(`Mapping target "${mapping.targetPath}" domain mismatch: expected "${schema.domain}"`);
      continue;
    }

    const section = pathParts[1];
    const name = pathParts[2];

    if (!section || !name) {
      errors.push(`Invalid mapping target path: ${mapping.targetPath}`);
      continue;
    }

    // 섹션에 따라 존재 여부 확인
    if (section === 'entities' && !schema.entities[name]) {
      errors.push(`Entity "${name}" not found in schema for mapping ${mapping.targetPath}`);
    } else if (section === 'state' && !schema.state[name]) {
      errors.push(`State field "${name}" not found in schema for mapping ${mapping.targetPath}`);
    } else if (section === 'intents' && !schema.intents[name]) {
      errors.push(`Intent "${name}" not found in schema for mapping ${mapping.targetPath}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
