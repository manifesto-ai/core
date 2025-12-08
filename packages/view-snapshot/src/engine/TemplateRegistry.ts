/**
 * TemplateRegistry
 *
 * 오버레이 템플릿 레지스트리
 */

import type { OverlayTemplate, OverlayKind } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * 템플릿 레지스트리 인터페이스
 */
export interface ITemplateRegistry {
  register(template: OverlayTemplate): void
  unregister(templateId: string): boolean
  get(templateId: string): OverlayTemplate | undefined
  has(templateId: string): boolean
  getByKind(kind: OverlayKind): readonly OverlayTemplate[]
  getAll(): readonly OverlayTemplate[]
  clear(): void
}

// ============================================================================
// TemplateRegistry
// ============================================================================

/**
 * 템플릿 레지스트리 구현
 */
export class TemplateRegistry implements ITemplateRegistry {
  private templates: Map<string, OverlayTemplate> = new Map()

  register(template: OverlayTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with id "${template.id}" is already registered`)
    }

    this.templates.set(template.id, template)
  }

  unregister(templateId: string): boolean {
    return this.templates.delete(templateId)
  }

  get(templateId: string): OverlayTemplate | undefined {
    return this.templates.get(templateId)
  }

  has(templateId: string): boolean {
    return this.templates.has(templateId)
  }

  getByKind(kind: OverlayKind): readonly OverlayTemplate[] {
    return [...this.templates.values()].filter(t => t.kind === kind)
  }

  getAll(): readonly OverlayTemplate[] {
    return [...this.templates.values()]
  }

  clear(): void {
    this.templates.clear()
  }
}

/**
 * TemplateRegistry 팩토리 함수
 */
export const createTemplateRegistry = (): ITemplateRegistry => {
  return new TemplateRegistry()
}

// ============================================================================
// 기본 템플릿들
// ============================================================================

/**
 * 기본 확인 다이얼로그 템플릿
 */
export const DEFAULT_CONFIRM_TEMPLATE: OverlayTemplate = {
  id: 'confirm',
  kind: 'dialog',
  title: '확인',
  messageTemplate: '{message}',
  confirmLabel: '확인',
  cancelLabel: '취소',
}

/**
 * 기본 삭제 확인 다이얼로그 템플릿
 */
export const DEFAULT_DELETE_CONFIRM_TEMPLATE: OverlayTemplate = {
  id: 'deleteConfirm',
  kind: 'dialog',
  title: '삭제 확인',
  messageTemplate: '선택한 {count}개 항목을 삭제하시겠습니까?',
  confirmLabel: '삭제',
  cancelLabel: '취소',
}

/**
 * 기본 성공 토스트 템플릿
 */
export const DEFAULT_SUCCESS_TOAST_TEMPLATE: OverlayTemplate = {
  id: 'success',
  kind: 'toast',
  messageTemplate: '{message}',
  variant: 'success',
  autoClose: 3000,
}

/**
 * 기본 에러 토스트 템플릿
 */
export const DEFAULT_ERROR_TOAST_TEMPLATE: OverlayTemplate = {
  id: 'error',
  kind: 'toast',
  messageTemplate: '{message}',
  variant: 'error',
  autoClose: 5000,
}

/**
 * 기본 템플릿 목록
 */
export const DEFAULT_TEMPLATES: readonly OverlayTemplate[] = [
  DEFAULT_CONFIRM_TEMPLATE,
  DEFAULT_DELETE_CONFIRM_TEMPLATE,
  DEFAULT_SUCCESS_TOAST_TEMPLATE,
  DEFAULT_ERROR_TOAST_TEMPLATE,
]

/**
 * 기본 템플릿들을 레지스트리에 등록
 */
export const registerDefaultTemplates = (registry: ITemplateRegistry): void => {
  for (const template of DEFAULT_TEMPLATES) {
    if (!registry.has(template.id)) {
      registry.register(template)
    }
  }
}
