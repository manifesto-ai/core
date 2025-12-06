/**
 * Pending Update Manager
 *
 * deferred 모드에서 숨겨진 필드에 대한 업데이트를 보류하고
 * 조건이 충족되면 자동으로 적용
 */

import type { PendingUpdate } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface AppliedUpdate {
  readonly fieldId: string
  readonly value: unknown
  readonly appliedAt: number
}

// ============================================================================
// Pending Update Manager
// ============================================================================

export class PendingUpdateManager {
  private pendings: Map<string, PendingUpdate> = new Map()

  /**
   * Pending update 생성
   */
  create(fieldId: string, value: unknown, blockedBy: readonly string[]): PendingUpdate {
    const pending: PendingUpdate = {
      fieldId,
      value,
      blockedBy,
      createdAt: Date.now(),
    }
    this.pendings.set(fieldId, pending)
    return pending
  }

  /**
   * Pending update 가져오기
   */
  get(fieldId: string): PendingUpdate | undefined {
    return this.pendings.get(fieldId)
  }

  /**
   * Pending update 제거
   */
  remove(fieldId: string): boolean {
    return this.pendings.delete(fieldId)
  }

  /**
   * 모든 pending updates 가져오기
   */
  getAll(): Readonly<Record<string, PendingUpdate>> {
    const result: Record<string, PendingUpdate> = {}
    for (const [fieldId, pending] of this.pendings) {
      result[fieldId] = pending
    }
    return result
  }

  /**
   * 특정 필드 변경으로 인해 적용 가능한 pending updates 확인
   *
   * @param changedFieldId - 변경된 필드 ID
   * @param isFieldVisible - 필드가 현재 visible한지 확인하는 함수
   */
  checkApplicable(
    changedFieldId: string,
    isFieldVisible: (fieldId: string) => boolean
  ): readonly PendingUpdate[] {
    const applicable: PendingUpdate[] = []

    for (const [fieldId, pending] of this.pendings) {
      // 변경된 필드가 blockedBy에 있으면 재검토
      if (pending.blockedBy.includes(changedFieldId)) {
        // 해당 필드가 이제 visible한지 확인
        if (isFieldVisible(fieldId)) {
          applicable.push(pending)
        }
      }
    }

    return applicable
  }

  /**
   * Pending update 적용 후 제거
   */
  apply(fieldId: string): AppliedUpdate | null {
    const pending = this.pendings.get(fieldId)
    if (!pending) return null

    this.pendings.delete(fieldId)

    return {
      fieldId: pending.fieldId,
      value: pending.value,
      appliedAt: Date.now(),
    }
  }

  /**
   * 모든 pending updates 초기화
   */
  clear(): void {
    this.pendings.clear()
  }

  /**
   * Pending update 개수
   */
  get size(): number {
    return this.pendings.size
  }

  /**
   * 특정 필드에 pending update가 있는지 확인
   */
  has(fieldId: string): boolean {
    return this.pendings.has(fieldId)
  }
}

// ============================================================================
// Factory
// ============================================================================

export const createPendingManager = (): PendingUpdateManager => {
  return new PendingUpdateManager()
}
