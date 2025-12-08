/**
 * ViewSnapshot Overlay Types
 *
 * Modal, Dialog, Toast 오버레이 타입 정의
 */

import type { ViewSnapshotNode } from './nodes'

// ============================================================================
// Overlay Kind
// ============================================================================

/**
 * 오버레이 종류
 */
export type OverlayKind = 'modal' | 'dialog' | 'toast'

/**
 * Toast 변형
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

// ============================================================================
// Overlay Instance
// ============================================================================

/**
 * 런타임에 생성된 오버레이 인스턴스
 */
export interface OverlayInstance {
  /** 런타임 생성 ID */
  readonly instanceId: string
  /** 오버레이 종류 */
  readonly kind: OverlayKind
  /** 사용된 템플릿 */
  readonly template: string
  /** 주입된 데이터 */
  readonly boundData: Readonly<Record<string, unknown>>
  /** 오버레이 내부 컨텐츠 (modal용) */
  readonly content?: ViewSnapshotNode

  // Dialog 전용
  /** 렌더링된 메시지 (템플릿 치환 완료) */
  readonly message?: string

  // Toast 전용
  /** Toast 변형 */
  readonly variant?: ToastVariant
  /** 자동 닫힘 시간 (ms) */
  readonly autoClose?: number

  // 상태
  /** Promise 대기 중 여부 */
  readonly awaitingResult: boolean
}

// ============================================================================
// Overlay Template
// ============================================================================

/**
 * 오버레이 템플릿 정의
 */
export interface OverlayTemplate {
  /** 템플릿 ID */
  readonly id: string
  /** 오버레이 종류 */
  readonly kind: OverlayKind
  /** 제목 */
  readonly title?: string
  /** 메시지 템플릿 ({count} 등 치환 가능) */
  readonly messageTemplate?: string
  /** 확인 버튼 라벨 */
  readonly confirmLabel?: string
  /** 취소 버튼 라벨 */
  readonly cancelLabel?: string

  // Toast 전용
  /** Toast 변형 */
  readonly variant?: ToastVariant
  /** 자동 닫힘 시간 (ms) */
  readonly autoClose?: number

  // Modal 전용
  /** 모달 내부 컨텐츠 빌더 */
  readonly contentBuilder?: (boundData: Record<string, unknown>) => ViewSnapshotNode
}

// ============================================================================
// Overlay Result
// ============================================================================

/**
 * 오버레이 결과 타입
 */
export type OverlayResult<T = unknown> =
  | { readonly type: 'confirmed'; readonly data?: T }
  | { readonly type: 'cancelled' }
  | { readonly type: 'dismissed' }
