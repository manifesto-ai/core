/**
 * NodeRegistry
 *
 * Form/List 런타임을 nodeId로 관리하는 레지스트리
 */

import type { FormRuntime } from '@manifesto-ai/engine'
import type { ListRuntime } from '@manifesto-ai/engine'
import type { FormViewSchema, ListViewSchema } from '@manifesto-ai/schema'

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
 * 노드 타입
 */
export type NodeType = 'form' | 'list'

/**
 * 등록된 노드 (유니온)
 */
export type RegisteredNode = RegisteredFormNode | RegisteredListNode

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
  // 공통
  // ============================================================================

  hasNode(nodeId: string): boolean {
    return this.formNodes.has(nodeId) || this.listNodes.has(nodeId)
  }

  getNodeType(nodeId: string): NodeType | undefined {
    if (this.formNodes.has(nodeId)) return 'form'
    if (this.listNodes.has(nodeId)) return 'list'
    return undefined
  }

  getAllNodeIds(): readonly string[] {
    return [
      ...this.formNodes.keys(),
      ...this.listNodes.keys(),
    ]
  }

  clear(): void {
    this.formNodes.clear()
    this.listNodes.clear()
  }
}

/**
 * NodeRegistry 팩토리 함수
 */
export const createNodeRegistry = (): INodeRegistry => {
  return new NodeRegistry()
}
