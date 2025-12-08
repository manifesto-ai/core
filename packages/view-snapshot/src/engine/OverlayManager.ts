/**
 * OverlayManager
 *
 * 오버레이 인스턴스 스택 관리
 */

import type {
  OverlayInstance,
  OverlayConfig,
  ToastVariant,
  OverlayResult,
  ViewSnapshotNode,
} from '../types'
import type { ITemplateRegistry } from './TemplateRegistry'

// ============================================================================
// Types
// ============================================================================

/**
 * 오버레이 열기 옵션
 */
export interface OpenOverlayOptions {
  /** 직접 바인딩할 데이터 */
  boundData?: Record<string, unknown>
  /** 모달 내부 컨텐츠 */
  content?: ViewSnapshotNode
  /** 다이얼로그 메시지 (템플릿 치환 완료) */
  message?: string
  /** 토스트 변형 */
  variant?: ToastVariant
  /** 자동 닫힘 시간 (ms) */
  autoClose?: number
}

/**
 * 오버레이 대기 핸들러
 */
export interface OverlayResultHandler {
  resolve: (result: OverlayResult) => void
}

/**
 * 오버레이 관리자 인터페이스
 */
export interface IOverlayManager {
  // 오버레이 열기/닫기
  open(config: OverlayConfig, options?: OpenOverlayOptions): OverlayInstance
  openWithTemplate(templateId: string, options?: OpenOverlayOptions): OverlayInstance | undefined
  close(instanceId: string): boolean
  closeAll(): void

  // 다이얼로그/모달 결과
  confirm(instanceId: string): boolean
  cancel(instanceId: string): boolean
  submit<T = unknown>(instanceId: string, data?: T): boolean

  // 토스트
  dismiss(instanceId: string): boolean

  // 스택 접근
  getStack(): readonly OverlayInstance[]
  getOverlay(instanceId: string): OverlayInstance | undefined
  getTopOverlay(): OverlayInstance | undefined
  hasOverlay(instanceId: string): boolean

  // Promise 기반 API
  waitForResult(instanceId: string): Promise<OverlayResult>

  // 상태
  isEmpty(): boolean
  size(): number
}

// ============================================================================
// OverlayManager
// ============================================================================

/**
 * 상태 변경 리스너 타입
 */
export type OverlayChangeListener = () => void

/**
 * 오버레이 관리자 구현
 */
export class OverlayManager implements IOverlayManager {
  private stack: OverlayInstance[] = []
  private idCounter = 0
  private resultHandlers: Map<string, OverlayResultHandler> = new Map()
  private changeListener?: OverlayChangeListener

  constructor(
    private templateRegistry: ITemplateRegistry,
    changeListener?: OverlayChangeListener
  ) {
    this.changeListener = changeListener
  }

  // ============================================================================
  // 오버레이 열기/닫기
  // ============================================================================

  open(config: OverlayConfig, options: OpenOverlayOptions = {}): OverlayInstance {
    const instanceId = this.generateId()

    // 템플릿에서 기본값 가져오기
    const template = this.templateRegistry.get(config.template)

    // 메시지 템플릿 치환
    let message = options.message
    if (!message && template?.messageTemplate && options.boundData) {
      message = this.interpolateMessage(template.messageTemplate, options.boundData)
    } else if (!message && config.messageTemplate && options.boundData) {
      message = this.interpolateMessage(config.messageTemplate, options.boundData)
    }

    const instance: OverlayInstance = {
      instanceId,
      kind: config.kind,
      template: config.template,
      boundData: options.boundData ?? {},
      content: options.content,
      message,
      variant: options.variant ?? template?.variant,
      autoClose: options.autoClose ?? template?.autoClose,
      awaitingResult: true,
    }

    this.stack.push(instance)

    // 토스트 자동 닫기
    if (instance.kind === 'toast' && instance.autoClose) {
      setTimeout(() => {
        const dismissed = this.dismiss(instanceId)
        if (dismissed) {
          this.changeListener?.()
        }
      }, instance.autoClose)
    }

    return instance
  }

  openWithTemplate(templateId: string, options: OpenOverlayOptions = {}): OverlayInstance | undefined {
    const template = this.templateRegistry.get(templateId)
    if (!template) {
      return undefined
    }

    return this.open(
      {
        kind: template.kind,
        template: templateId,
      },
      {
        ...options,
        variant: options.variant ?? template.variant,
        autoClose: options.autoClose ?? template.autoClose,
      }
    )
  }

  close(instanceId: string): boolean {
    const index = this.stack.findIndex(o => o.instanceId === instanceId)
    if (index === -1) return false

    this.stack.splice(index, 1)

    // 결과 핸들러가 있으면 cancelled로 해결
    const handler = this.resultHandlers.get(instanceId)
    if (handler) {
      handler.resolve({ type: 'cancelled' })
      this.resultHandlers.delete(instanceId)
    }

    return true
  }

  closeAll(): void {
    // 모든 대기 중인 결과를 cancelled로 해결
    for (const [instanceId, handler] of this.resultHandlers) {
      handler.resolve({ type: 'cancelled' })
      this.resultHandlers.delete(instanceId)
    }

    this.stack = []
  }

  // ============================================================================
  // 다이얼로그/모달 결과
  // ============================================================================

  confirm(instanceId: string): boolean {
    const overlay = this.getOverlay(instanceId)
    if (!overlay || overlay.kind === 'toast') return false

    const handler = this.resultHandlers.get(instanceId)
    if (handler) {
      handler.resolve({ type: 'confirmed', data: overlay.boundData })
      this.resultHandlers.delete(instanceId)
    }

    return this.close(instanceId)
  }

  cancel(instanceId: string): boolean {
    return this.close(instanceId)
  }

  submit<T = unknown>(instanceId: string, data?: T): boolean {
    const overlay = this.getOverlay(instanceId)
    if (!overlay || overlay.kind !== 'modal') return false

    const handler = this.resultHandlers.get(instanceId)
    if (handler) {
      handler.resolve({ type: 'confirmed', data })
      this.resultHandlers.delete(instanceId)
    }

    return this.close(instanceId)
  }

  // ============================================================================
  // 토스트
  // ============================================================================

  dismiss(instanceId: string): boolean {
    const overlay = this.getOverlay(instanceId)
    if (!overlay || overlay.kind !== 'toast') return false

    const handler = this.resultHandlers.get(instanceId)
    if (handler) {
      handler.resolve({ type: 'dismissed' })
      this.resultHandlers.delete(instanceId)
    }

    return this.close(instanceId)
  }

  // ============================================================================
  // 스택 접근
  // ============================================================================

  getStack(): readonly OverlayInstance[] {
    return [...this.stack]
  }

  getOverlay(instanceId: string): OverlayInstance | undefined {
    return this.stack.find(o => o.instanceId === instanceId)
  }

  getTopOverlay(): OverlayInstance | undefined {
    return this.stack[this.stack.length - 1]
  }

  hasOverlay(instanceId: string): boolean {
    return this.stack.some(o => o.instanceId === instanceId)
  }

  // ============================================================================
  // Promise 기반 API
  // ============================================================================

  waitForResult(instanceId: string): Promise<OverlayResult> {
    const overlay = this.getOverlay(instanceId)
    if (!overlay) {
      return Promise.resolve({ type: 'cancelled' })
    }

    return new Promise(resolve => {
      this.resultHandlers.set(instanceId, { resolve })
    })
  }

  // ============================================================================
  // 상태
  // ============================================================================

  isEmpty(): boolean {
    return this.stack.length === 0
  }

  size(): number {
    return this.stack.length
  }

  // ============================================================================
  // Private
  // ============================================================================

  private generateId(): string {
    return `overlay-${++this.idCounter}`
  }

  private interpolateMessage(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key) => {
      const value = data[key]
      return value !== undefined ? String(value) : `{${key}}`
    })
  }
}

/**
 * OverlayManager 팩토리 함수
 */
export const createOverlayManager = (
  templateRegistry: ITemplateRegistry,
  changeListener?: OverlayChangeListener
): IOverlayManager => {
  return new OverlayManager(templateRegistry, changeListener)
}
