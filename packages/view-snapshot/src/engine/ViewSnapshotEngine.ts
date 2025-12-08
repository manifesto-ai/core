/**
 * ViewSnapshotEngine
 *
 * ViewSnapshot 아키텍처의 핵심 엔진
 * - 스냅샷 생성 및 관리
 * - Intent 디스패치
 * - 런타임 등록 및 조율
 */

import type { FormRuntime, ListRuntime } from '@manifesto-ai/engine'
import type { FormViewSchema, ListViewSchema, EntitySchema } from '@manifesto-ai/schema'

import type {
  PageSnapshot,
  ViewSnapshotNode,
  ViewIntent,
  OverlayTemplate,
  ViewAction,
} from '../types'

import { createNodeRegistry, type INodeRegistry } from './NodeRegistry'
import { createTemplateRegistry, registerDefaultTemplates, type ITemplateRegistry } from './TemplateRegistry'
import { createOverlayManager, type IOverlayManager } from './OverlayManager'
import { createIntentDispatcher, type IIntentDispatcher, type IntentDispatcherOptions } from './IntentDispatcher'
import { buildFormSnapshot, type FormSnapshotBuilderOptions } from '../builders/FormSnapshotBuilder'
import { buildTableSnapshot, type TableSnapshotBuilderOptions } from '../builders/TableSnapshotBuilder'
import { buildPageSnapshot } from '../builders/PageSnapshotBuilder'

// ============================================================================
// Types
// ============================================================================

/**
 * ViewSnapshotEngine 인터페이스 (스펙 준수)
 */
export interface IViewSnapshotEngine {
  // Core API (from spec)
  getViewSnapshot(): PageSnapshot
  dispatchIntent(intent: ViewIntent): Promise<PageSnapshot>
  dispatchIntents(intents: ViewIntent[]): Promise<PageSnapshot>

  // Runtime 등록
  registerFormRuntime(nodeId: string, runtime: FormRuntime, schema: FormViewSchema, entitySchema?: EntitySchema): void
  registerListRuntime(nodeId: string, runtime: ListRuntime, schema: ListViewSchema): void
  unregisterRuntime(nodeId: string): boolean

  // 템플릿 등록
  registerTemplate(template: OverlayTemplate): void

  // 구독
  subscribe(listener: (snapshot: PageSnapshot) => void): () => void

  // 정리
  dispose(): void
}

/**
 * ViewSnapshotEngine 옵션
 */
export interface ViewSnapshotEngineOptions {
  /** 페이지 ID */
  pageId: string
  /** 페이지 라벨 */
  pageLabel?: string
  /** 페이지 레벨 액션 */
  pageActions?: readonly ViewAction[]
  /** 기본 템플릿 등록 여부 (기본값: true) */
  registerDefaultTemplates?: boolean
  /** Form 빌더 옵션 */
  formBuilderOptions?: Omit<FormSnapshotBuilderOptions, 'entitySchema'>
  /** Table 빌더 옵션 */
  tableBuilderOptions?: TableSnapshotBuilderOptions
  /** Intent 디스패처 옵션 */
  dispatcherOptions?: IntentDispatcherOptions
  /** 디버그 모드 */
  debug?: boolean
}

/**
 * 스냅샷 변경 리스너
 */
export type SnapshotChangeListener = (snapshot: PageSnapshot) => void

// ============================================================================
// ViewSnapshotEngine
// ============================================================================

/**
 * ViewSnapshotEngine 구현
 */
export class ViewSnapshotEngine implements IViewSnapshotEngine {
  private nodeRegistry: INodeRegistry
  private templateRegistry: ITemplateRegistry
  private overlayManager: IOverlayManager
  private intentDispatcher: IIntentDispatcher

  private entitySchemas: Map<string, EntitySchema> = new Map()
  private listeners: Set<SnapshotChangeListener> = new Set()
  private unsubscribers: Map<string, () => void> = new Map()

  private options: ViewSnapshotEngineOptions & {
    registerDefaultTemplates: boolean
    debug: boolean
  }

  constructor(options: ViewSnapshotEngineOptions) {
    this.options = {
      ...options,
      registerDefaultTemplates: options.registerDefaultTemplates ?? true,
      debug: options.debug ?? false,
    }

    // 컴포넌트 초기화
    this.nodeRegistry = createNodeRegistry()
    this.templateRegistry = createTemplateRegistry()
    this.overlayManager = createOverlayManager(
      this.templateRegistry,
      // OverlayManager가 내부적으로 상태가 변하면(예: autoClose) 호출할 콜백
      () => this.notifyListeners(this.getViewSnapshot())
    )
    this.intentDispatcher = createIntentDispatcher(
      this.nodeRegistry,
      this.overlayManager,
      {
        ...this.options.dispatcherOptions,
        debug: this.options.debug,
      }
    )

    // 기본 템플릿 등록
    if (this.options.registerDefaultTemplates) {
      registerDefaultTemplates(this.templateRegistry)
    }

    this.log('ViewSnapshotEngine initialized', { pageId: options.pageId })
  }

  // ============================================================================
  // Core API
  // ============================================================================

  getViewSnapshot(): PageSnapshot {
    const children: ViewSnapshotNode[] = []

    // Form 스냅샷 생성
    for (const formNode of this.nodeRegistry.getAllFormNodes()) {
      const entitySchema = this.entitySchemas.get(formNode.nodeId)
      const snapshot = buildFormSnapshot(
        formNode.nodeId,
        formNode.runtime,
        formNode.schema,
        {
          ...this.options.formBuilderOptions,
          entitySchema,
        }
      )
      children.push(snapshot)
    }

    // Table 스냅샷 생성
    for (const listNode of this.nodeRegistry.getAllListNodes()) {
      const snapshot = buildTableSnapshot(
        listNode.nodeId,
        listNode.runtime,
        listNode.schema,
        this.options.tableBuilderOptions
      )
      children.push(snapshot)
    }

    // PageSnapshot 생성
    return buildPageSnapshot({
      pageId: this.options.pageId,
      label: this.options.pageLabel,
      children,
      overlays: this.overlayManager.getStack(),
      actions: this.options.pageActions,
    })
  }

  async dispatchIntent(intent: ViewIntent): Promise<PageSnapshot> {
    this.log('Dispatching intent:', intent)

    const result = await this.intentDispatcher.dispatch(intent)

    if (!result.success) {
      this.log('Intent failed:', result)
    }

    const snapshot = this.getViewSnapshot()
    this.notifyListeners(snapshot)

    return snapshot
  }

  async dispatchIntents(intents: ViewIntent[]): Promise<PageSnapshot> {
    this.log('Dispatching intents:', intents.length)

    for (const intent of intents) {
      await this.intentDispatcher.dispatch(intent)
    }

    const snapshot = this.getViewSnapshot()
    this.notifyListeners(snapshot)

    return snapshot
  }

  // ============================================================================
  // Runtime 등록
  // ============================================================================

  registerFormRuntime(
    nodeId: string,
    runtime: FormRuntime,
    schema: FormViewSchema,
    entitySchema?: EntitySchema
  ): void {
    this.nodeRegistry.registerForm(nodeId, runtime, schema)

    if (entitySchema) {
      this.entitySchemas.set(nodeId, entitySchema)
    }

    // Runtime 변경 구독
    const unsubscribe = runtime.subscribe(() => {
      this.notifyListeners(this.getViewSnapshot())
    })
    this.unsubscribers.set(nodeId, unsubscribe)

    this.log('Form runtime registered:', nodeId)
  }

  registerListRuntime(
    nodeId: string,
    runtime: ListRuntime,
    schema: ListViewSchema
  ): void {
    this.nodeRegistry.registerList(nodeId, runtime, schema)

    // Runtime 변경 구독
    const unsubscribe = runtime.subscribe(() => {
      this.notifyListeners(this.getViewSnapshot())
    })
    this.unsubscribers.set(nodeId, unsubscribe)

    this.log('List runtime registered:', nodeId)
  }

  unregisterRuntime(nodeId: string): boolean {
    // 구독 해제
    const unsubscribe = this.unsubscribers.get(nodeId)
    if (unsubscribe) {
      unsubscribe()
      this.unsubscribers.delete(nodeId)
    }

    // Entity 스키마 제거
    this.entitySchemas.delete(nodeId)

    // 노드 제거
    const nodeType = this.nodeRegistry.getNodeType(nodeId)
    if (nodeType === 'form') {
      return this.nodeRegistry.unregisterForm(nodeId)
    } else if (nodeType === 'list') {
      return this.nodeRegistry.unregisterList(nodeId)
    }

    return false
  }

  // ============================================================================
  // 템플릿 등록
  // ============================================================================

  registerTemplate(template: OverlayTemplate): void {
    this.templateRegistry.register(template)
    this.log('Template registered:', template.id)
  }

  // ============================================================================
  // 구독
  // ============================================================================

  subscribe(listener: SnapshotChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ============================================================================
  // 정리
  // ============================================================================

  dispose(): void {
    // 모든 구독 해제
    for (const [_nodeId, unsubscribe] of this.unsubscribers) {
      unsubscribe()
    }
    this.unsubscribers.clear()

    // 오버레이 정리
    this.overlayManager.closeAll()

    // 레지스트리 정리
    this.nodeRegistry.clear()
    this.templateRegistry.clear()
    this.entitySchemas.clear()
    this.listeners.clear()

    this.log('ViewSnapshotEngine disposed')
  }

  // ============================================================================
  // Private
  // ============================================================================

  private notifyListeners(snapshot: PageSnapshot): void {
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[ViewSnapshotEngine]', ...args)
    }
  }
}

/**
 * ViewSnapshotEngine 팩토리 함수
 */
export const createViewSnapshotEngine = (options: ViewSnapshotEngineOptions): IViewSnapshotEngine => {
  return new ViewSnapshotEngine(options)
}
