/**
 * Stable ID Generation - 2단계 정체성 모델
 *
 * 리뷰어 피드백 반영: 단순 해시만으로는 부분 수정 UX가 깨질 수 있음.
 * - 코드 줄 이동
 * - 자연어 문장 수정
 * - 변수명 변경
 * → 동일 의미 fragment가 다른 ID로 재생성될 수 있음
 *
 * 해결책: 2단계 정체성 모델
 * - primaryId: 구조적 형태(AST/DSL 구조) 기반 해시
 * - secondaryHints: origin, semantic signature, requires/provides 등
 *
 * Linker 단계에서 기존 fragment와의 구조적 유사도 매칭을 수행하여
 * rename/move를 deterministic heuristic으로 감지
 *
 * AGENT_README Section 6.3.3: Stable ID Policy
 */

import type { FragmentKind } from '../types/fragment.js';
import type { Provenance, OriginLocation } from '../types/provenance.js';

// ============================================================================
// Fragment Identity Model
// ============================================================================

/**
 * Fragment의 2단계 정체성 모델
 *
 * Linker에서 기존 fragment와 매칭할 때 사용
 */
export interface FragmentIdentity {
  /** 구조 기반 primary ID (AST/DSL 구조 해시) */
  primaryId: string;

  /** 매칭에 사용할 보조 힌트 */
  secondaryHints: {
    /** 원본 위치 해시 */
    originHash?: string;
    /** 의미 시그니처 (kind + requires + provides) */
    semanticSignature: string;
    /** 의존하는 경로들 (정렬됨) */
    requiresSet: string[];
    /** 제공하는 경로들 (정렬됨) */
    providesSet: string[];
    /** 구조적 형태 해시 (AST 구조) */
    structuralHash: string;
  };
}

/**
 * 유사도 매칭 결과
 */
export interface SimilarityMatch {
  /** 매칭된 fragment ID */
  matchedId: string;
  /** 유사도 점수 (0-1) */
  similarity: number;
  /** 매칭 종류 */
  matchType: 'exact' | 'structural' | 'semantic' | 'partial';
  /** 변경 유형 (추정) */
  changeType?: 'rename' | 'move' | 'modify' | 'none';
}

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Simple hash function for string input
 * Uses djb2 algorithm for fast, reasonable distribution
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to base36 for shorter IDs
  return (hash >>> 0).toString(36);
}

/**
 * 강력한 해시 함수 (더 긴 출력)
 * 구조적 해시에 사용
 */
function strongHashString(str: string): string {
  // Use two different hash functions and combine
  let hash1 = 5381;
  let hash2 = 52711;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 31) ^ char;
  }

  return (hash1 >>> 0).toString(36) + (hash2 >>> 0).toString(36);
}

// ============================================================================
// Structural Shape Extraction
// ============================================================================

/**
 * Expression의 구조적 형태 추출 (값 제외, 구조만)
 *
 * 예: ['>', ['get', 'data.hello'], 10]
 * → ['>', ['get', '_'], '_'] (리터럴은 placeholder로)
 */
export function extractStructuralShape(expr: unknown): string {
  if (expr === null) return 'null';
  if (typeof expr === 'undefined') return 'undefined';

  if (typeof expr !== 'object') {
    // 리터럴은 타입만 유지
    if (typeof expr === 'number') return 'NUM';
    if (typeof expr === 'string') {
      // SemanticPath는 유지 (data.*, derived.* 등)
      if (isSemanticPath(expr)) return `PATH:${getPathNamespace(expr)}`;
      // 일반 문자열은 placeholder
      return 'STR';
    }
    if (typeof expr === 'boolean') return 'BOOL';
    return typeof expr;
  }

  if (Array.isArray(expr)) {
    const [op, ...args] = expr;
    const shapeArgs = args.map((arg) => extractStructuralShape(arg));
    return `[${op},${shapeArgs.join(',')}]`;
  }

  // Object - key 구조만 유지
  const keys = Object.keys(expr).sort();
  const shapeEntries = keys.map((k) => `${k}:${extractStructuralShape((expr as Record<string, unknown>)[k])}`);
  return `{${shapeEntries.join(',')}}`;
}

/**
 * SemanticPath인지 확인
 */
function isSemanticPath(str: string): boolean {
  return (
    str.startsWith('data.') ||
    str.startsWith('state.') ||
    str.startsWith('derived.') ||
    str.startsWith('async.') ||
    str.startsWith('$')
  );
}

/**
 * Path의 namespace 추출
 */
function getPathNamespace(path: string): string {
  const dotIndex = path.indexOf('.');
  if (dotIndex === -1) return path;
  return path.slice(0, dotIndex);
}

/**
 * Effect의 구조적 형태 추출
 */
export function extractEffectStructuralShape(effect: unknown): string {
  if (!effect || typeof effect !== 'object') return 'unknown';

  const eff = effect as Record<string, unknown>;
  const tag = eff['_tag'];

  if (!tag) return 'unknown';

  switch (tag) {
    case 'SetValue':
    case 'SetState':
      return `${tag}:PATH:${extractStructuralShape(eff['value'])}`;
    case 'ApiCall':
      return `${tag}:${eff['method']}`;
    case 'Navigate':
      return `${tag}`;
    case 'Delay':
      return `${tag}`;
    case 'Sequence':
      const seqEffects = eff['effects'] as unknown[];
      return `${tag}:[${seqEffects?.map((e) => extractEffectStructuralShape(e)).join(',')}]`;
    case 'Parallel':
      const parEffects = eff['effects'] as unknown[];
      return `${tag}:[${parEffects?.map((e) => extractEffectStructuralShape(e)).join(',')}]`;
    case 'Conditional':
      return `${tag}:${extractStructuralShape(eff['condition'])}:${extractEffectStructuralShape(eff['then'])}:${eff['else'] ? extractEffectStructuralShape(eff['else']) : 'none'}`;
    case 'Catch':
      return `${tag}:${extractEffectStructuralShape(eff['try'])}`;
    case 'EmitEvent':
      return `${tag}:${eff['channel']}`;
    default:
      return `${tag}`;
  }
}

// ============================================================================
// Identity Generation
// ============================================================================

/**
 * Fragment의 2단계 정체성 생성
 */
export function generateFragmentIdentity(
  kind: FragmentKind,
  origin: Provenance,
  requires: string[],
  provides: string[],
  structuralContent?: unknown
): FragmentIdentity {
  const sortedRequires = [...requires].sort();
  const sortedProvides = [...provides].sort();

  // Semantic signature
  const semanticSignature = `${kind}:req(${sortedRequires.join(',')}):prov(${sortedProvides.join(',')})`;

  // Structural hash (from expression/effect if available)
  let structuralHash: string;
  if (structuralContent !== undefined) {
    const shape = extractStructuralShape(structuralContent);
    structuralHash = strongHashString(shape);
  } else {
    // Fallback: use semantic signature
    structuralHash = strongHashString(semanticSignature);
  }

  // Primary ID: 구조 기반
  const primaryId = generatePrimaryId(kind, structuralHash);

  // Origin hash
  const originHash = origin.originHash ?? normalizeOriginLocation(origin.location);

  return {
    primaryId,
    secondaryHints: {
      originHash,
      semanticSignature,
      requiresSet: sortedRequires,
      providesSet: sortedProvides,
      structuralHash,
    },
  };
}

/**
 * Primary ID 생성 (kind prefix + structural hash)
 */
function generatePrimaryId(kind: FragmentKind, structuralHash: string): string {
  const prefix = getKindPrefix(kind);
  return `${prefix}_${structuralHash}`;
}

/**
 * Normalize origin location for hashing
 */
function normalizeOriginLocation(location: OriginLocation): string {
  switch (location.kind) {
    case 'code':
      // Use relative line/col, ignore absolute file path
      return `code:${location.span.startLine}:${location.span.startCol}:${location.span.endLine}:${location.span.endCol}`;
    case 'text':
      return `text:${location.span.startOffset}:${location.span.endOffset}`;
    case 'generated':
      return `gen:${location.note}`;
    case 'patch':
      return `patch:${location.patchId}`;
    case 'llm':
      return `llm:${location.model}:${location.promptHash ?? 'none'}`;
    default:
      return 'unknown';
  }
}

/**
 * Get a short prefix for each fragment kind
 */
function getKindPrefix(kind: FragmentKind): string {
  const prefixes: Record<FragmentKind, string> = {
    SchemaFragment: 'sch',
    SourceFragment: 'src',
    ExpressionFragment: 'expr',
    DerivedFragment: 'der',
    PolicyFragment: 'pol',
    EffectFragment: 'eff',
    ActionFragment: 'act',
    StatementFragment: 'stmt',
  };
  return prefixes[kind];
}

// ============================================================================
// Stable ID Generation (Public API)
// ============================================================================

/**
 * Generate a stable fragment ID
 *
 * 2단계 정체성 모델의 primaryId를 반환.
 * Linker 단계에서 secondaryHints를 사용하여 기존 fragment와 매칭.
 */
export function generateStableFragmentId(
  kind: FragmentKind,
  origin: Provenance,
  requires: string[],
  provides: string[],
  structuralContent?: unknown
): string {
  const identity = generateFragmentIdentity(kind, origin, requires, provides, structuralContent);
  return identity.primaryId;
}

/**
 * Generate a random fragment ID (when stable ID is not needed)
 */
export function generateRandomFragmentId(kind: FragmentKind): string {
  const prefix = getKindPrefix(kind);
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate an origin hash from content
 */
export function generateOriginHash(content: string): string {
  // Normalize whitespace for more stable hashing
  const normalized = content.replace(/\s+/g, ' ').trim();
  return hashString(normalized);
}

/**
 * Check if a fragment ID matches a pattern
 */
export function fragmentIdMatchesKind(id: string, kind: FragmentKind): boolean {
  const prefix = getKindPrefix(kind);
  return id.startsWith(`${prefix}_`);
}

/**
 * Extract kind from fragment ID (best effort)
 */
export function extractKindFromFragmentId(id: string): FragmentKind | null {
  const kindPrefixes: [string, FragmentKind][] = [
    ['sch_', 'SchemaFragment'],
    ['src_', 'SourceFragment'],
    ['expr_', 'ExpressionFragment'],
    ['der_', 'DerivedFragment'],
    ['pol_', 'PolicyFragment'],
    ['eff_', 'EffectFragment'],
    ['act_', 'ActionFragment'],
    ['stmt_', 'StatementFragment'],
  ];

  for (const [prefix, kind] of kindPrefixes) {
    if (id.startsWith(prefix)) {
      return kind;
    }
  }
  return null;
}

// ============================================================================
// Similarity Matching (Linker에서 사용)
// ============================================================================

/**
 * 두 Fragment Identity의 유사도 계산
 *
 * Linker 단계에서 기존 fragment와 새 fragment 매칭에 사용
 */
export function calculateSimilarity(
  existing: FragmentIdentity,
  incoming: FragmentIdentity
): SimilarityMatch | null {
  // 1. Exact match (primaryId 동일)
  if (existing.primaryId === incoming.primaryId) {
    return {
      matchedId: existing.primaryId,
      similarity: 1.0,
      matchType: 'exact',
      changeType: 'none',
    };
  }

  // 2. Structural match (structuralHash 동일)
  if (existing.secondaryHints.structuralHash === incoming.secondaryHints.structuralHash) {
    // 구조는 같지만 ID가 다름 → rename/move 감지
    const changeType = detectChangeType(existing, incoming);
    return {
      matchedId: existing.primaryId,
      similarity: 0.9,
      matchType: 'structural',
      changeType,
    };
  }

  // 3. Semantic match (requires/provides 동일)
  const reqOverlap = calculateSetOverlap(
    existing.secondaryHints.requiresSet,
    incoming.secondaryHints.requiresSet
  );
  const provOverlap = calculateSetOverlap(
    existing.secondaryHints.providesSet,
    incoming.secondaryHints.providesSet
  );

  if (reqOverlap === 1.0 && provOverlap === 1.0) {
    return {
      matchedId: existing.primaryId,
      similarity: 0.8,
      matchType: 'semantic',
      changeType: 'modify',
    };
  }

  // 4. Partial match (높은 overlap)
  const avgOverlap = (reqOverlap + provOverlap) / 2;
  if (avgOverlap >= 0.7) {
    return {
      matchedId: existing.primaryId,
      similarity: avgOverlap * 0.7, // 0.49 ~ 0.7
      matchType: 'partial',
      changeType: 'modify',
    };
  }

  // No significant match
  return null;
}

/**
 * 집합 overlap 계산
 */
function calculateSetOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;

  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * 변경 유형 감지 (rename vs move)
 */
function detectChangeType(
  existing: FragmentIdentity,
  incoming: FragmentIdentity
): 'rename' | 'move' | 'modify' {
  const provOverlap = calculateSetOverlap(
    existing.secondaryHints.providesSet,
    incoming.secondaryHints.providesSet
  );

  // provides가 다르면 rename 가능성
  if (provOverlap < 1.0 && provOverlap > 0.5) {
    return 'rename';
  }

  // origin이 다르면 move 가능성
  if (existing.secondaryHints.originHash !== incoming.secondaryHints.originHash) {
    return 'move';
  }

  return 'modify';
}

/**
 * 기존 Fragment 목록에서 best match 찾기
 */
export function findBestMatch(
  incoming: FragmentIdentity,
  existingIdentities: FragmentIdentity[],
  minSimilarity: number = 0.5
): SimilarityMatch | null {
  let bestMatch: SimilarityMatch | null = null;

  for (const existing of existingIdentities) {
    const match = calculateSimilarity(existing, incoming);
    if (match && match.similarity >= minSimilarity) {
      if (!bestMatch || match.similarity > bestMatch.similarity) {
        bestMatch = match;
      }
    }
  }

  return bestMatch;
}

/**
 * Regenerate fragment ID if needed (기존 API 호환)
 */
export function regenerateFragmentIdIfNeeded(
  fragment: { kind: FragmentKind; origin: Provenance; requires: string[]; provides: string[] },
  newRequires?: string[],
  newProvides?: string[]
): string {
  const requires = newRequires ?? fragment.requires;
  const provides = newProvides ?? fragment.provides;

  return generateStableFragmentId(fragment.kind, fragment.origin, requires, provides);
}
