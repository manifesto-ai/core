/**
 * NodeRegistry
 *
 * Form/List 런타임과 Tabs 상태를 nodeId로 관리하는 레지스트리
 */

import type { FormRuntime } from '@manifesto-ai/engine'
import type { ListRuntime } from '@manifesto-ai/engine'
import type { FormViewSchema, ListViewSchema } from '@manifesto-ai/schema'
import type { TabItem } from '../types'

// ============================================================================
// Types
// ============================================================================

/**
 * 등록된 Form 노드
 */
export interface RegisteredFormNode {
  readonly nodeId: string
  readonly runtime: FormRuntime
  readonly schema: FormViewSchema
}

/**
 * 등록된 List 노드
 */
export interface RegisteredListNode {
  readonly nodeId: string
  readonly runtime: ListRuntime
  readonly schema: ListViewSchema
}

/**
 * 등록된 Tabs 노드
 */
export interface RegisteredTabsNode {
  readonly nodeId: string
  readonly label?: string
  readonly tabs: readonly TabItem[]
  activeTabId: string
}

/**
 * 노드 타입
 */
export type NodeType = 'form' | 'list' | 'tabs'

/**
 * 등록된 노드 (유니온)
 */
export type RegisteredNode = RegisteredFormNode | RegisteredListNode | RegisteredTabsNode

// ============================================================================
// NodeRegistry
// ============================================================================

/**
 * 노드 레지스트리 인터페이스
 */
export interface INodeRegistry {
  // Form 노드
  registerForm(nodeId: string, runtime: FormRuntime, schema: FormViewSchema): void
  unregisterForm(nodeId: string): boolean
  getFormNode(nodeId: string): RegisteredFormNode | undefined
  getAllFormNodes(): readonly RegisteredFormNode[]

  // List 노드
  registerList(nodeId: string, runtime: ListRuntime, schema: ListViewSchema): void
  unregisterList(nodeId: string): boolean
  getListNode(nodeId: string): RegisteredListNode | undefined
  getAllListNodes(): readonly RegisteredListNode[]

  // Tabs 노드
  registerTabs(nodeId: string, tabs: readonly TabItem[], options?: { label?: string; activeTabId?: string }): void
  unregisterTabs(nodeId: string): boolean
  getTabsNode(nodeId: string): RegisteredTabsNode | undefined
  getAllTabsNodes(): readonly RegisteredTabsNode[]
  setActiveTab(nodeId: string, tabId: string): boolean

  // 공통
  hasNode(nodeId: string): boolean
  getNodeType(nodeId: string): NodeType | undefined
  getAllNodeIds(): readonly string[]
  clear(): void
}

/**
 * 노드 레지스트리 구현
 */
export class NodeRegistry implements INodeRegistry {
  private formNodes: Map<string, RegisteredFormNode> = new Map()
  private listNodes: Map<string, RegisteredListNode> = new Map()
  private tabsNodes: Map<string, RegisteredTabsNode> = new Map()

  // ============================================================================
  // Form 노드
  // ============================================================================

  registerForm(nodeId: string, runtime: FormRuntime, schema: FormViewSchema): void {
    if (this.hasNode(nodeId)) {
      throw new Error(`Node with id "${nodeId}" is already registered`)
    }

    this.formNodes.set(nodeId, { nodeId, runtime, schema })
  }

  unregisterForm(nodeId: string): boolean {
    return this.formNodes.delete(nodeId)
  }

  getFormNode(nodeId: string): RegisteredFormNode | undefined {
    return this.formNodes.get(nodeId)
  }

  getAllFormNodes(): readonly RegisteredFormNode[] {
    return [...this.formNodes.values()]
  }

  // ============================================================================
  // List 노드
  // ============================================================================

  registerList(nodeId: string, runtime: ListRuntime, schema: ListViewSchema): void {
    if (this.hasNode(nodeId)) {
      throw new Error(`Node with id "${nodeId}" is already registered`)
    }

    this.listNodes.set(nodeId, { nodeId, runtime, schema })
  }

  unregisterList(nodeId: string): boolean {
    return this.listNodes.delete(nodeId)
  }

  getListNode(nodeId: string): RegisteredListNode | undefined {
    return this.listNodes.get(nodeId)
  }

  getAllListNodes(): readonly RegisteredListNode[] {
    return [...this.listNodes.values()]
  }

  // ============================================================================
  // Tabs 노드
  // ============================================================================

  registerTabs(
    nodeId: string,
    tabs: readonly TabItem[],
    options?: { label?: string; activeTabId?: string }
  ): void {
    if (this.hasNode(nodeId)) {
      throw new Error(`Node with id "${nodeId}" is already registered`)
    }

    // 기본 활성 탭: 첫 번째 비활성화되지 않은 탭
    const defaultActiveTab = options?.activeTabId
      ?? tabs.find((t) => !t.disabled)?.id
      ?? tabs[0]?.id
      ?? ''

    this.tabsNodes.set(nodeId, {
      nodeId,
      label: options?.label,
      tabs,
      activeTabId: defaultActiveTab,
    })
  }

  unregisterTabs(nodeId: string): boolean {
    return this.tabsNodes.delete(nodeId)
  }

  getTabsNode(nodeId: string): RegisteredTabsNode | undefined {
    return this.tabsNodes.get(nodeId)
  }

  getAllTabsNodes(): readonly RegisteredTabsNode[] {
    return [...this.tabsNodes.values()]
  }

  setActiveTab(nodeId: string, tabId: string): boolean {
    const node = this.tabsNodes.get(nodeId)
    if (!node) return false

    // 존재하는 탭인지 확인
    const tab = node.tabs.find((t) => t.id === tabId)
    if (!tab || tab.disabled) return false

    node.activeTabId = tabId
    return true
  }

  // ============================================================================
  // 공통
  // ============================================================================

  hasNode(nodeId: string): boolean {
    return (
      this.formNodes.has(nodeId) ||
      this.listNodes.has(nodeId) ||
      this.tabsNodes.has(nodeId)
    )
  }

  getNodeType(nodeId: string): NodeType | undefined {
    if (this.formNodes.has(nodeId)) return 'form'
    if (this.listNodes.has(nodeId)) return 'list'
    if (this.tabsNodes.has(nodeId)) return 'tabs'
    return undefined
  }

  getAllNodeIds(): readonly string[] {
    return [
      ...this.formNodes.keys(),
      ...this.listNodes.keys(),
      ...this.tabsNodes.keys(),
    ]
  }

  clear(): void {
    this.formNodes.clear()
    this.listNodes.clear()
    this.tabsNodes.clear()
  }
}

/**
 * NodeRegistry 팩토리 함수
 */
export const createNodeRegistry = (): INodeRegistry => {
  return new NodeRegistry()
}
