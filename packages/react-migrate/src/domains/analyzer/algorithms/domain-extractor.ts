/**
 * Domain Candidate Extractor
 *
 * 패턴과 의존성 그래프를 분석하여 도메인 후보를 추출합니다.
 */

import type { FileAnalysis, DetectedPattern } from '../../../parser/types.js';
import type {
  DomainCandidate,
  DomainSuggestedBy,
  DomainRelationship,
  PatternCollection,
  DependencyGraph,
  AmbiguousPattern,
  SuggestedResolution,
} from '../types.js';
import { generateId } from '../analyzer.js';
import { findConnectedComponents, analyzeContextSharing } from './dependency-graph.js';
import { inferDomainFromPath, isFeatureDirectory } from './priority.js';

/**
 * 도메인 이름 추론 (Context 이름에서)
 */
export function inferDomainName(name: string): string {
  // AuthContext -> auth
  // UserProfileContext -> userProfile -> user-profile
  let domainName = name
    .replace(/Context$/, '')
    .replace(/Provider$/, '')
    .replace(/Reducer$/, '');

  // PascalCase를 kebab-case로
  domainName = domainName
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');

  return domainName;
}

/**
 * 도메인 이름 정규화
 */
export function normalizeDomainName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Context 기반 도메인 후보 추출
 */
export function extractContextBasedCandidates(
  patterns: PatternCollection,
  analyses: FileAnalysis[]
): DomainCandidate[] {
  const candidates: DomainCandidate[] = [];

  for (const contextPattern of patterns.contexts) {
    // Provider가 있는 Context만 도메인으로 간주
    if (!contextPattern.metadata.hasProvider) continue;

    const contextName = contextPattern.metadata.contextName as string | undefined;
    if (!contextName) continue;

    const domainName = inferDomainName(contextName);
    const sourceFile = contextPattern.metadata.sourceFile as string;

    // 이 Context를 사용하는 파일들 찾기
    const relatedFiles = analyses
      .filter(a =>
        a.patterns.some(p =>
          p.type === 'context' &&
          p.metadata.contextName === contextName
        )
      )
      .map(a => a.path);

    candidates.push({
      id: `ctx-${domainName}-${generateId()}`,
      name: domainName,
      suggestedBy: 'context',
      sourceFiles: [...new Set([sourceFile, ...relatedFiles])],
      patterns: [contextPattern],
      confidence: 0.9,
      relationships: [],
    });
  }

  return candidates;
}

/**
 * Reducer 기반 도메인 후보 추출
 */
export function extractReducerBasedCandidates(
  patterns: PatternCollection
): DomainCandidate[] {
  const candidates: DomainCandidate[] = [];
  const processedFiles = new Set<string>();

  for (const reducerPattern of patterns.reducers) {
    const sourceFile = reducerPattern.metadata.sourceFile as string;

    // 같은 파일의 reducer는 한 번만 처리
    if (processedFiles.has(sourceFile)) continue;
    processedFiles.add(sourceFile);

    // 파일 경로에서 도메인 이름 추출 (features/auth/AuthContext.tsx -> auth)
    const domainFromPath = inferDomainFromPath(sourceFile);
    // 패턴 이름에서 추출 (authReducer -> auth)
    const domainFromName = inferDomainName(reducerPattern.name);

    // 파일 경로 기반이 더 신뢰성 높음, 'use' 같은 무의미한 이름 방지
    const domainName = domainFromPath && domainFromPath !== 'use' && domainFromPath !== 'reducer'
      ? domainFromPath
      : domainFromName !== 'use' && domainFromName !== 'reducer'
        ? domainFromName
        : inferDomainFromFileName(sourceFile);

    candidates.push({
      id: `reducer-${domainName}-${generateId()}`,
      name: domainName,
      suggestedBy: 'reducer',
      sourceFiles: [sourceFile],
      patterns: [reducerPattern],
      confidence: 0.8,
      relationships: [],
    });
  }

  return candidates;
}

/**
 * 파일명에서 도메인 이름 추출
 */
function inferDomainFromFileName(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? '';
  // AuthContext.tsx -> auth
  const contextMatch = fileName.match(/^([A-Z][a-zA-Z]*)Context\.(tsx?|jsx?)$/);
  if (contextMatch && contextMatch[1]) {
    return contextMatch[1].toLowerCase();
  }
  // authReducer.ts -> auth
  const reducerMatch = fileName.match(/^([a-z][a-zA-Z]*)Reducer\.(tsx?|jsx?)$/);
  if (reducerMatch && reducerMatch[1]) {
    return reducerMatch[1].toLowerCase();
  }
  // Fallback: 파일명 자체
  return fileName.replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
}

/**
 * Hook 기반 도메인 후보 추출
 */
export function extractHookBasedCandidates(
  patterns: PatternCollection
): DomainCandidate[] {
  const candidates: DomainCandidate[] = [];

  for (const hookPattern of patterns.hooks) {
    // Custom hook만 대상
    if (!hookPattern.metadata.isCustomHook) continue;

    // 너무 일반적인 훅은 제외 (useEffect, useState 래퍼 등)
    const hookName = hookPattern.name;
    if (isGenericHook(hookName)) continue;

    const sourceFile = hookPattern.metadata.sourceFile as string;

    // 1순위: 파일 경로에서 도메인 추출 (features/auth/useAuth.ts -> auth)
    const domainFromPath = inferDomainFromPath(sourceFile);
    // 2순위: 훅 이름에서 추출 (useAuth -> auth)
    const domainFromHook = hookName.replace(/^use/, '').toLowerCase();

    // 파일 경로 기반 우선, 무의미한 이름 방지
    const domainName = domainFromPath && domainFromPath.length > 2
      ? domainFromPath
      : domainFromHook;

    candidates.push({
      id: `hook-${domainName}-${generateId()}`,
      name: domainName,
      suggestedBy: 'hook',
      sourceFiles: [sourceFile],
      patterns: [hookPattern],
      confidence: 0.7,
      relationships: [],
    });
  }

  return candidates;
}

/**
 * 파일 구조 기반 도메인 후보 추출
 */
export function extractFileStructureCandidates(
  analyses: FileAnalysis[]
): DomainCandidate[] {
  const candidates: DomainCandidate[] = [];
  const directoryGroups = new Map<string, FileAnalysis[]>();

  // 디렉토리별 그룹핑
  for (const analysis of analyses) {
    const domainFromPath = inferDomainFromPath(analysis.relativePath);
    if (domainFromPath) {
      if (!directoryGroups.has(domainFromPath)) {
        directoryGroups.set(domainFromPath, []);
      }
      directoryGroups.get(domainFromPath)!.push(analysis);
    }
  }

  // 충분한 파일이 있는 그룹만 도메인 후보로
  for (const [domainName, files] of directoryGroups) {
    if (files.length >= 2) {
      const allPatterns = files.flatMap(f => f.patterns);
      const avgConfidence = files.reduce((sum, f) => sum + f.confidence, 0) / files.length;

      candidates.push({
        id: `dir-${domainName}-${generateId()}`,
        name: domainName,
        suggestedBy: 'file_structure',
        sourceFiles: files.map(f => f.path),
        patterns: allPatterns,
        confidence: Math.min(0.6, avgConfidence),
        relationships: [],
      });
    }
  }

  return candidates;
}

/**
 * 모든 전략으로 도메인 후보 추출
 */
export function extractDomainCandidates(
  patterns: PatternCollection,
  analyses: FileAnalysis[],
  graph: DependencyGraph
): DomainCandidate[] {
  // 각 전략별 후보 추출
  const contextCandidates = extractContextBasedCandidates(patterns, analyses);
  const reducerCandidates = extractReducerBasedCandidates(patterns);
  const hookCandidates = extractHookBasedCandidates(patterns);
  const fileCandidates = extractFileStructureCandidates(analyses);

  // 모든 후보 합치기
  let allCandidates = [
    ...contextCandidates,
    ...reducerCandidates,
    ...hookCandidates,
    ...fileCandidates,
  ];

  // 중복/겹치는 후보 병합
  allCandidates = mergeCandidates(allCandidates);

  // 관계 계산
  allCandidates = calculateRelationships(allCandidates, graph);

  return allCandidates;
}

/**
 * 겹치는 도메인 후보 병합
 */
export function mergeCandidates(
  candidates: DomainCandidate[]
): DomainCandidate[] {
  const merged: DomainCandidate[] = [];
  const processed = new Set<string>();

  // 이름이 같거나 파일이 80% 이상 겹치는 후보 병합
  for (const candidate of candidates) {
    if (processed.has(candidate.id)) continue;

    const similar = candidates.filter(c => {
      if (c.id === candidate.id || processed.has(c.id)) return false;

      // 이름이 같으면 병합
      if (normalizeDomainName(c.name) === normalizeDomainName(candidate.name)) {
        return true;
      }

      // 파일 겹침 확인
      const overlap = c.sourceFiles.filter(f => candidate.sourceFiles.includes(f));
      const overlapRatio = overlap.length / Math.min(c.sourceFiles.length, candidate.sourceFiles.length);
      return overlapRatio >= 0.8;
    });

    if (similar.length > 0) {
      // 가장 높은 신뢰도의 suggestedBy 선택
      const allToMerge = [candidate, ...similar];
      const bestConfidence = Math.max(...allToMerge.map(c => c.confidence));
      const best = allToMerge.find(c => c.confidence === bestConfidence)!;

      // 모든 파일과 패턴 합치기
      const allFiles = [...new Set(allToMerge.flatMap(c => c.sourceFiles))];
      const allPatterns = deduplicatePatterns(allToMerge.flatMap(c => c.patterns));

      merged.push({
        id: best.id,
        name: normalizeDomainName(best.name),
        suggestedBy: best.suggestedBy,
        sourceFiles: allFiles,
        patterns: allPatterns,
        confidence: bestConfidence,
        relationships: [],
      });

      for (const c of allToMerge) {
        processed.add(c.id);
      }
    } else {
      merged.push({
        ...candidate,
        name: normalizeDomainName(candidate.name),
      });
      processed.add(candidate.id);
    }
  }

  return merged;
}

/**
 * 패턴 중복 제거
 */
function deduplicatePatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  const seen = new Set<string>();
  return patterns.filter(p => {
    const key = `${p.type}-${p.name}-${p.location.start.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 도메인 간 관계 계산
 */
export function calculateRelationships(
  candidates: DomainCandidate[],
  graph: DependencyGraph
): DomainCandidate[] {
  return candidates.map(candidate => {
    const relationships: DomainRelationship[] = [];

    for (const other of candidates) {
      if (other.id === candidate.id) continue;

      // Import 관계 확인
      const hasImport = graph.edges.some(e =>
        candidate.sourceFiles.includes(e.source) &&
        other.sourceFiles.includes(e.target)
      );

      if (hasImport) {
        relationships.push({
          type: 'imports',
          targetDomainId: other.id,
          strength: 0.5,
        });
      }

      // Context 공유 확인
      const candidateContexts = new Set(
        candidate.patterns
          .filter(p => p.type === 'context')
          .map(p => p.metadata.contextName as string)
      );

      const otherContexts = new Set(
        other.patterns
          .filter(p => p.type === 'context')
          .map(p => p.metadata.contextName as string)
      );

      const sharedContexts = [...candidateContexts].filter(c => otherContexts.has(c));
      if (sharedContexts.length > 0) {
        relationships.push({
          type: 'shared_state',
          targetDomainId: other.id,
          strength: 0.8,
        });
      }
    }

    return {
      ...candidate,
      relationships,
    };
  });
}

/**
 * 애매한 패턴 감지
 */
export function detectAmbiguousPatterns(
  analyses: FileAnalysis[],
  candidates: DomainCandidate[],
  confidenceThreshold: number
): AmbiguousPattern[] {
  const ambiguous: AmbiguousPattern[] = [];

  for (const analysis of analyses) {
    for (const pattern of analysis.patterns) {
      const reasons: string[] = [];

      // 낮은 신뢰도
      if (pattern.confidence < confidenceThreshold) {
        reasons.push(`Low confidence: ${pattern.confidence.toFixed(2)}`);
      }

      // 명시적 리뷰 필요
      if (pattern.needsReview) {
        reasons.push('Pattern explicitly marked for review');
      }

      // 여러 도메인이 이 파일을 소유
      const claimingDomains = candidates.filter(c =>
        c.sourceFiles.includes(analysis.path)
      );
      if (claimingDomains.length > 1) {
        reasons.push(
          `File claimed by ${claimingDomains.length} domains: ${claimingDomains.map(c => c.name).join(', ')}`
        );
      }

      // Reducer가 많은 액션을 가짐
      if (pattern.type === 'reducer') {
        const actions = pattern.metadata.actions as string[] | undefined;
        if (actions && actions.length > 8) {
          reasons.push(`Reducer has ${actions.length} actions - consider splitting`);
        }
      }

      if (reasons.length > 0) {
        const suggestedResolutions = generateResolutions(
          pattern,
          claimingDomains,
          candidates
        );

        ambiguous.push({
          id: `ambig-${analysis.path}-${pattern.name}-${Date.now()}`,
          filePath: analysis.path,
          pattern,
          reason: reasons.join('; '),
          suggestedResolutions,
        });
      }
    }
  }

  return ambiguous;
}

/**
 * 해결 제안 생성
 */
function generateResolutions(
  pattern: DetectedPattern,
  claimingDomains: DomainCandidate[],
  allCandidates: DomainCandidate[]
): SuggestedResolution[] {
  const resolutions: SuggestedResolution[] = [];

  // 여러 도메인이 소유를 주장하는 경우
  if (claimingDomains.length > 1) {
    for (const domain of claimingDomains) {
      resolutions.push({
        id: `classify-${domain.id}`,
        label: `Assign to "${domain.name}" domain`,
        action: 'classify_as',
        params: { domainId: domain.id },
        confidence: domain.confidence,
      });
    }
  }

  // Reducer 분할 제안
  if (pattern.type === 'reducer') {
    const actions = pattern.metadata.actions as string[] | undefined;
    if (actions && actions.length > 8) {
      resolutions.push({
        id: 'split-reducer',
        label: 'Split into multiple domains',
        action: 'split',
        params: { suggestedSplitCount: Math.ceil(actions.length / 5) },
        confidence: 0.6,
      });
    }
  }

  // 건너뛰기 옵션
  resolutions.push({
    id: 'skip',
    label: 'Skip and mark for manual review',
    action: 'skip',
    params: {},
    confidence: 0.3,
  });

  return resolutions;
}

/**
 * 일반적인 훅인지 확인 (도메인으로 추출하지 않음)
 */
function isGenericHook(hookName: string): boolean {
  const genericPatterns = [
    /^use(Effect|State|Ref|Memo|Callback|Reducer|Context|LayoutEffect)$/i,
    /^use(Debug|Deferred|Transition|Sync|Id|Imperative)$/i,
    /^use(Toggle|Boolean|Counter|Input|Form|Previous)$/i,
    /^use(Fetch|Async|Promise|Query|Mutation)$/i,
    /^use(Local|Session)Storage$/i,
    /^use(Window|Document|Event|Scroll|Resize)$/i,
  ];

  return genericPatterns.some(p => p.test(hookName));
}

/**
 * 도메인 이름에서 설명 생성
 */
export function generateDomainDescription(
  candidate: DomainCandidate
): string {
  const patternTypes = [...new Set(candidate.patterns.map(p => p.type))];
  const fileCount = candidate.sourceFiles.length;

  const typeDescriptions: Record<string, string> = {
    context: 'Context-based state management',
    reducer: 'Reducer-based state logic',
    hook: 'Custom hook functionality',
    component: 'UI components',
    effect: 'Side effects',
  };

  const mainType = patternTypes[0] ?? 'unknown';
  const description = typeDescriptions[mainType] ?? 'Domain functionality';

  return `${candidate.name} - ${description} (${fileCount} files, ${candidate.patterns.length} patterns)`;
}
