/**
 * Rename Detector
 *
 * 필드 이름 변경을 휴리스틱으로 감지
 */

import type { EntityField, Constraint } from '../../types'
import type { FieldMappingHint } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface RenameCandidate {
  readonly oldField: EntityField
  readonly newField: EntityField
  readonly confidence: number
  readonly reasons: readonly string[]
}

// ============================================================================
// String Similarity (Levenshtein Distance)
// ============================================================================

/**
 * Levenshtein distance 계산
 */
const levenshteinDistance = (a: string, b: string): number => {
  // Initialize matrix with proper dimensions
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    Array.from({ length: a.length + 1 }, () => 0)
  )

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i]![0] = i
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

/**
 * 문자열 유사도 계산 (0-1)
 */
export const stringSimilarity = (a: string, b: string): number => {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  const maxLength = Math.max(a.length, b.length)

  return 1 - distance / maxLength
}

// ============================================================================
// Constraint Similarity
// ============================================================================

/**
 * Constraint 배열 유사도 계산
 */
const constraintsSimilarity = (
  a: readonly Constraint[] | undefined,
  b: readonly Constraint[] | undefined
): number => {
  if (!a && !b) return 1
  if (!a || !b) return 0
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  const aTypes = new Set(a.map(c => c.type))
  const bTypes = new Set(b.map(c => c.type))

  const intersection = [...aTypes].filter(t => bTypes.has(t)).length
  const union = new Set([...aTypes, ...bTypes]).size

  return union === 0 ? 1 : intersection / union
}

// ============================================================================
// Rename Detection
// ============================================================================

/**
 * 두 필드가 이름 변경 관계인지 분석
 */
const analyzeRenamePair = (
  oldField: EntityField,
  newField: EntityField
): RenameCandidate | null => {
  const reasons: string[] = []
  let score = 0

  // 1. ID 유사도 (weight: 0.3)
  const idSimilarity = stringSimilarity(oldField.id, newField.id)
  if (idSimilarity >= 0.6) {
    score += idSimilarity * 0.3
    reasons.push(`ID similarity: ${(idSimilarity * 100).toFixed(0)}%`)
  }

  // 2. 동일한 DataType (weight: 0.25)
  if (oldField.dataType === newField.dataType) {
    score += 0.25
    reasons.push('Same dataType')
  }

  // 3. 동일한 Label (weight: 0.2)
  if (oldField.label === newField.label) {
    score += 0.2
    reasons.push('Same label')
  } else {
    const labelSimilarity = stringSimilarity(oldField.label, newField.label)
    if (labelSimilarity >= 0.8) {
      score += labelSimilarity * 0.15
      reasons.push(`Label similarity: ${(labelSimilarity * 100).toFixed(0)}%`)
    }
  }

  // 4. 동일한 Constraints (weight: 0.15)
  const constraintSim = constraintsSimilarity(oldField.constraints, newField.constraints)
  if (constraintSim >= 0.8) {
    score += constraintSim * 0.15
    reasons.push(`Constraint similarity: ${(constraintSim * 100).toFixed(0)}%`)
  }

  // 5. 동일한 Description (weight: 0.1)
  if (oldField.description && newField.description) {
    if (oldField.description === newField.description) {
      score += 0.1
      reasons.push('Same description')
    } else {
      const descSimilarity = stringSimilarity(oldField.description, newField.description)
      if (descSimilarity >= 0.8) {
        score += descSimilarity * 0.08
        reasons.push(`Description similarity: ${(descSimilarity * 100).toFixed(0)}%`)
      }
    }
  }

  // 최소 신뢰도 0.5 이상이어야 후보로 인정
  if (score < 0.5) {
    return null
  }

  return {
    oldField,
    newField,
    confidence: Math.min(score, 1),
    reasons,
  }
}

/**
 * 사용자 힌트에서 이름 변경 찾기
 */
const findRenameFromHints = (
  removed: readonly EntityField[],
  added: readonly EntityField[],
  hints: readonly FieldMappingHint[]
): RenameCandidate[] => {
  const candidates: RenameCandidate[] = []

  for (const hint of hints) {
    const oldField = removed.find(f => f.id === hint.oldFieldId)
    const newField = added.find(f => f.id === hint.newFieldId)

    if (oldField && newField) {
      candidates.push({
        oldField,
        newField,
        confidence: 1.0, // 사용자 힌트는 최고 신뢰도
        reasons: ['User-provided mapping hint'],
      })
    }
  }

  return candidates
}

/**
 * 휴리스틱으로 이름 변경 감지
 */
const detectRenamesHeuristic = (
  removed: readonly EntityField[],
  added: readonly EntityField[]
): RenameCandidate[] => {
  const candidates: RenameCandidate[] = []

  for (const oldField of removed) {
    for (const newField of added) {
      const candidate = analyzeRenamePair(oldField, newField)
      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  // 신뢰도 순으로 정렬
  return candidates.sort((a, b) => b.confidence - a.confidence)
}

/**
 * 이름 변경 후보 중 최적 매칭 선택 (Greedy)
 *
 * 각 old/new 필드는 하나의 매칭에만 사용됨
 */
const selectBestMatches = (candidates: readonly RenameCandidate[]): RenameCandidate[] => {
  const selected: RenameCandidate[] = []
  const usedOld = new Set<string>()
  const usedNew = new Set<string>()

  // 신뢰도 높은 순으로 정렬된 후보에서 greedy 선택
  for (const candidate of candidates) {
    if (usedOld.has(candidate.oldField.id) || usedNew.has(candidate.newField.id)) {
      continue
    }

    selected.push(candidate)
    usedOld.add(candidate.oldField.id)
    usedNew.add(candidate.newField.id)
  }

  return selected
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 제거된 필드와 추가된 필드에서 이름 변경 감지
 *
 * @param removed - 제거된 필드 목록
 * @param added - 추가된 필드 목록
 * @param hints - 사용자 제공 매핑 힌트 (선택)
 * @returns 감지된 이름 변경 후보 목록
 */
export const detectRenames = (
  removed: readonly EntityField[],
  added: readonly EntityField[],
  hints?: readonly FieldMappingHint[]
): RenameCandidate[] => {
  // 1. 사용자 힌트에서 먼저 찾기
  const hintCandidates = hints ? findRenameFromHints(removed, added, hints) : []
  const usedOldFromHints = new Set(hintCandidates.map(c => c.oldField.id))
  const usedNewFromHints = new Set(hintCandidates.map(c => c.newField.id))

  // 2. 힌트에서 사용되지 않은 필드에서 휴리스틱 감지
  const remainingRemoved = removed.filter(f => !usedOldFromHints.has(f.id))
  const remainingAdded = added.filter(f => !usedNewFromHints.has(f.id))

  const heuristicCandidates = detectRenamesHeuristic(remainingRemoved, remainingAdded)
  const selectedHeuristic = selectBestMatches(heuristicCandidates)

  // 3. 결과 병합
  return [...hintCandidates, ...selectedHeuristic]
}

/**
 * 신뢰도 임계값 이상의 이름 변경만 필터링
 */
export const filterByConfidence = (
  candidates: readonly RenameCandidate[],
  threshold: number = 0.7
): RenameCandidate[] => {
  return candidates.filter(c => c.confidence >= threshold)
}
