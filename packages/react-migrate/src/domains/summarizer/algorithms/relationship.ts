/**
 * Domain Relationship Analyzer
 *
 * 도메인 간의 관계를 분석합니다.
 */

import type { DependencyGraph } from '../../analyzer/types.js';
import type { DomainSummary, DomainRelationship, RelationshipType } from '../types.js';
import { generateId } from '../summarizer.js';

/**
 * 관계 분석 결과
 */
export interface RelationshipAnalysisResult {
  relationships: DomainRelationship[];
  strongCouplings: Array<{ from: string; to: string; strength: number }>;
  suggestedMerges: Array<{ domains: string[]; reason: string }>;
}

/**
 * 두 도메인 간의 관계 강도 계산
 */
export function calculateDomainRelationshipStrength(
  domain1: DomainSummary,
  domain2: DomainSummary,
  graph: DependencyGraph
): number {
  let strength = 0;

  const files1 = new Set(domain1.sourceFiles);
  const files2 = new Set(domain2.sourceFiles);

  // Import 관계 분석
  let importCount = 0;
  for (const edge of graph.edges) {
    const fromD1 = files1.has(edge.source);
    const fromD2 = files2.has(edge.source);
    const toD1 = files1.has(edge.target);
    const toD2 = files2.has(edge.target);

    if ((fromD1 && toD2) || (fromD2 && toD1)) {
      importCount++;
    }
  }

  // Import 강도 (최대 0.5)
  strength += Math.min(importCount * 0.1, 0.5);

  // 공유 상태 분석
  const sharedState1 = new Set(domain1.boundaries.sharedState);
  const sharedState2 = new Set(domain2.boundaries.sharedState);
  const sharedStates = [...sharedState1].filter(s => sharedState2.has(s));

  // 공유 상태 강도 (최대 0.3)
  strength += Math.min(sharedStates.length * 0.15, 0.3);

  // 파일 인접성 (같은 상위 디렉토리)
  const dirs1 = new Set([...files1].map(f => f.substring(0, f.lastIndexOf('/'))));
  const dirs2 = new Set([...files2].map(f => f.substring(0, f.lastIndexOf('/'))));
  const sharedDirs = [...dirs1].filter(d => dirs2.has(d));

  // 인접성 강도 (최대 0.2)
  strength += Math.min(sharedDirs.length * 0.1, 0.2);

  return Math.min(strength, 1);
}

/**
 * 관계 타입 결정
 */
export function determineRelationshipType(
  domain1: DomainSummary,
  domain2: DomainSummary,
  graph: DependencyGraph
): RelationshipType | null {
  const files1 = new Set(domain1.sourceFiles);
  const files2 = new Set(domain2.sourceFiles);

  // Import 방향 확인
  let d1ImportsD2 = 0;
  let d2ImportsD1 = 0;

  for (const edge of graph.edges) {
    if (files1.has(edge.source) && files2.has(edge.target)) {
      d1ImportsD2++;
    }
    if (files2.has(edge.source) && files1.has(edge.target)) {
      d2ImportsD1++;
    }
  }

  // 공유 상태 확인
  const sharedState1 = new Set(domain1.boundaries.sharedState);
  const sharedState2 = new Set(domain2.boundaries.sharedState);
  const hasSharedState = [...sharedState1].some(s => sharedState2.has(s));

  // Event/Effect 패턴 확인 (actions 기반)
  const hasEventFlow = domain1.actions.some(a => a.type === 'event') ||
                       domain2.actions.some(a => a.type === 'event');

  // 타입 결정
  if (hasSharedState) {
    return 'shared_state';
  }

  if (hasEventFlow && (d1ImportsD2 > 0 || d2ImportsD1 > 0)) {
    return 'event_flow';
  }

  if (d1ImportsD2 > 0 || d2ImportsD1 > 0) {
    return 'dependency';
  }

  return null;
}

/**
 * 관계 생성
 */
export function createRelationship(
  domain1: DomainSummary,
  domain2: DomainSummary,
  graph: DependencyGraph
): DomainRelationship | null {
  const type = determineRelationshipType(domain1, domain2, graph);
  if (!type) return null;

  const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
  if (strength < 0.1) return null; // 너무 약한 관계는 무시

  // 방향 결정 (imports가 더 많은 쪽이 from)
  const files1 = new Set(domain1.sourceFiles);
  const files2 = new Set(domain2.sourceFiles);

  let d1ImportsD2 = 0;
  let d2ImportsD1 = 0;

  for (const edge of graph.edges) {
    if (files1.has(edge.source) && files2.has(edge.target)) {
      d1ImportsD2++;
    }
    if (files2.has(edge.source) && files1.has(edge.target)) {
      d2ImportsD1++;
    }
  }

  const [from, to] = d1ImportsD2 >= d2ImportsD1
    ? [domain1.id, domain2.id]
    : [domain2.id, domain1.id];

  // Evidence 수집
  const evidence: string[] = [];
  for (const edge of graph.edges) {
    if ((files1.has(edge.source) && files2.has(edge.target)) ||
        (files2.has(edge.source) && files1.has(edge.target))) {
      evidence.push(`${edge.source} -> ${edge.target}`);
    }
  }

  return {
    id: `rel-${generateId()}`,
    type,
    from,
    to,
    strength,
    evidence: evidence.slice(0, 5), // 최대 5개
    description: generateRelationshipDescription(type, domain1.name, domain2.name),
  };
}

/**
 * 관계 설명 생성
 */
function generateRelationshipDescription(
  type: RelationshipType,
  fromName: string,
  toName: string
): string {
  switch (type) {
    case 'dependency':
      return `${fromName} depends on ${toName}`;
    case 'shared_state':
      return `${fromName} and ${toName} share state`;
    case 'event_flow':
      return `${fromName} communicates with ${toName} via events`;
    case 'composition':
      return `${fromName} composes ${toName}`;
    default:
      return `${fromName} is related to ${toName}`;
  }
}

/**
 * 모든 도메인 쌍의 관계 분석
 */
export function analyzeAllRelationships(
  domains: DomainSummary[],
  graph: DependencyGraph
): RelationshipAnalysisResult {
  const relationships: DomainRelationship[] = [];
  const strongCouplings: Array<{ from: string; to: string; strength: number }> = [];
  const suggestedMerges: Array<{ domains: string[]; reason: string }> = [];

  // 모든 쌍에 대해 관계 분석
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const domain1 = domains[i]!;
      const domain2 = domains[j]!;

      const relationship = createRelationship(domain1, domain2, graph);

      if (relationship) {
        relationships.push(relationship);

        // 강한 결합 감지
        if (relationship.strength > 0.7) {
          strongCouplings.push({
            from: relationship.from,
            to: relationship.to,
            strength: relationship.strength,
          });
        }
      }

      // 병합 제안 로직
      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      if (strength > 0.8) {
        suggestedMerges.push({
          domains: [domain1.id, domain2.id],
          reason: `High coupling (${(strength * 100).toFixed(0)}%) between ${domain1.name} and ${domain2.name}`,
        });
      }
    }
  }

  return {
    relationships,
    strongCouplings,
    suggestedMerges,
  };
}

/**
 * 도메인 경계 분석
 */
export function analyzeDomainBoundaries(
  domain: DomainSummary,
  allDomains: DomainSummary[],
  graph: DependencyGraph
): DomainSummary {
  const files = new Set(domain.sourceFiles);
  const imports: string[] = [];
  const exports: string[] = [];
  const sharedState: string[] = [];

  // 다른 도메인 파일 맵
  const otherDomainFiles = new Map<string, string>();
  for (const other of allDomains) {
    if (other.id === domain.id) continue;
    for (const file of other.sourceFiles) {
      otherDomainFiles.set(file, other.name);
    }
  }

  // Import/Export 분석
  for (const edge of graph.edges) {
    if (files.has(edge.source)) {
      const targetDomain = otherDomainFiles.get(edge.target);
      if (targetDomain && !imports.includes(targetDomain)) {
        imports.push(targetDomain);
      }
    }

    if (files.has(edge.target)) {
      const sourceDomain = otherDomainFiles.get(edge.source);
      if (sourceDomain && !exports.includes(sourceDomain)) {
        exports.push(sourceDomain);
      }
    }
  }

  // Context 공유 분석 (entities에서 Context 타입 찾기)
  for (const entity of domain.entities) {
    if (entity.type === 'entity' && entity.name.includes('Context')) {
      // 다른 도메인도 같은 Context를 사용하는지 확인
      for (const other of allDomains) {
        if (other.id === domain.id) continue;
        const usesContext = other.entities.some(
          e => e.name === entity.name
        );
        if (usesContext && !sharedState.includes(entity.name)) {
          sharedState.push(entity.name);
        }
      }
    }
  }

  return {
    ...domain,
    boundaries: {
      imports,
      exports,
      sharedState,
    },
  };
}

/**
 * 순환 의존성 감지
 */
export function detectCyclicDependencies(
  domains: DomainSummary[],
  relationships: DomainRelationship[]
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  // 인접 리스트
  const adjacency = new Map<string, string[]>();
  for (const domain of domains) {
    adjacency.set(domain.id, []);
  }

  for (const rel of relationships) {
    if (rel.type === 'dependency') {
      adjacency.get(rel.from)?.push(rel.to);
    }
  }

  function dfs(domainId: string): void {
    visited.add(domainId);
    recursionStack.add(domainId);
    path.push(domainId);

    const neighbors = adjacency.get(domainId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recursionStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }

    path.pop();
    recursionStack.delete(domainId);
  }

  for (const domain of domains) {
    if (!visited.has(domain.id)) {
      dfs(domain.id);
    }
  }

  return cycles;
}
