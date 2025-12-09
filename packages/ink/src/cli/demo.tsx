#!/usr/bin/env node
/**
 * Ink Demo CLI
 *
 * ViewSnapshot Terminal UI 데모
 * 실행: pnpm --filter @manifesto-ai/ink demo
 */

import React, { useState } from 'react'
import { render, Box, Text, useApp, useInput } from 'ink'
import type {
  PageSnapshot,
  FormSnapshot,
  TableSnapshot,
  ViewIntent,
  IViewSnapshotEngine,
  SetFieldValueIntent,
  SelectRowIntent,
  ChangePageIntent,
} from '@manifesto-ai/view-snapshot'
import { InkProvider, PageRenderer } from '../composition'

// ============================================================================
// Mock Snapshot Data
// ============================================================================

const createMockFormSnapshot = (): FormSnapshot => ({
  nodeId: 'order-filter',
  kind: 'form',
  label: '주문 필터',
  fields: [
    {
      id: 'search',
      type: 'text',
      label: '검색어',
      value: '',
    },
    {
      id: 'status',
      type: 'select',
      label: '상태',
      value: 'all',
      options: [
        { value: 'all', label: '전체' },
        { value: 'pending', label: '대기 중' },
        { value: 'completed', label: '완료됨' },
        { value: 'cancelled', label: '취소됨' },
      ],
    },
    {
      id: 'dateRange',
      type: 'text',
      label: '기간',
      value: '2024-01-01 ~ 2024-12-31',
    },
  ],
  isValid: true,
  isDirty: false,
  isSubmitting: false,
  actions: [
    { type: 'search', label: 'Search' },
    { type: 'reset', label: 'Reset' },
  ],
})

const createMockTableSnapshot = (): TableSnapshot => ({
  nodeId: 'order-table',
  kind: 'table',
  label: '주문 목록',
  columns: [
    { id: 'id', label: '주문번호', sortable: true },
    { id: 'customer', label: '고객명', sortable: true },
    { id: 'amount', label: '금액', type: 'number', sortable: true },
    { id: 'status', label: '상태', type: 'status' },
    { id: 'date', label: '주문일', type: 'date', sortable: true },
  ],
  rows: [
    { id: '1', data: { id: 'ORD-001', customer: '김철수', amount: 50000, status: '완료', date: '2024-01-15' } },
    { id: '2', data: { id: 'ORD-002', customer: '이영희', amount: 30000, status: '대기', date: '2024-01-16' } },
    { id: '3', data: { id: 'ORD-003', customer: '박민수', amount: 80000, status: '완료', date: '2024-01-17' } },
    { id: '4', data: { id: 'ORD-004', customer: '정수진', amount: 45000, status: '취소', date: '2024-01-18' } },
    { id: '5', data: { id: 'ORD-005', customer: '최동훈', amount: 120000, status: '대기', date: '2024-01-19' } },
  ],
  selection: {
    mode: 'multiple',
    selectedRowIds: [],
  },
  pagination: {
    currentPage: 1,
    totalPages: 3,
    pageSize: 5,
    totalItems: 15,
  },
  sorting: {
    columnId: 'date',
    direction: 'desc',
  },
  actions: [
    { type: 'export', label: 'Export', condition: { requiresSelection: false } },
    { type: 'delete', label: 'Delete', condition: { requiresSelection: true, minSelection: 1 } },
  ],
})

const createMockPageSnapshot = (): PageSnapshot => ({
  nodeId: 'order-management',
  kind: 'page',
  label: '주문 관리',
  children: [createMockFormSnapshot(), createMockTableSnapshot()],
  overlays: [],
  actions: [],
})

// ============================================================================
// Mock Engine
// ============================================================================

class MockViewSnapshotEngine implements IViewSnapshotEngine {
  private snapshot: PageSnapshot
  private listeners: Set<(snapshot: PageSnapshot) => void> = new Set()

  constructor() {
    this.snapshot = createMockPageSnapshot()
  }

  getViewSnapshot(): PageSnapshot {
    return this.snapshot
  }

  async dispatchIntent(intent: ViewIntent): Promise<PageSnapshot> {
    console.log('Intent dispatched:', intent)

    // 간단한 Intent 처리 시뮬레이션
    if (intent.type === 'setFieldValue') {
      const fieldIntent = intent as SetFieldValueIntent
      this.snapshot = this.updateFormField(
        fieldIntent.nodeId,
        fieldIntent.fieldId,
        fieldIntent.value
      )
    } else if (intent.type === 'selectRow') {
      const selectIntent = intent as SelectRowIntent
      this.snapshot = this.toggleRowSelection(selectIntent.nodeId, selectIntent.rowId)
    } else if (intent.type === 'changePage') {
      const pageIntent = intent as ChangePageIntent
      this.snapshot = this.changePage(pageIntent.nodeId, pageIntent.page)
    }

    this.notifyListeners()
    return this.snapshot
  }

  async dispatchIntents(intents: ViewIntent[]): Promise<PageSnapshot> {
    for (const intent of intents) {
      await this.dispatchIntent(intent)
    }
    return this.snapshot
  }

  subscribe(listener: (snapshot: PageSnapshot) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.listeners.clear()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot)
    }
  }

  private updateFormField(nodeId: string, fieldId: string, value: unknown): PageSnapshot {
    return {
      ...this.snapshot,
      children: this.snapshot.children.map((child) => {
        if (child.kind === 'form' && child.nodeId === nodeId) {
          const form = child as FormSnapshot
          return {
            ...form,
            isDirty: true,
            fields: form.fields.map((field) =>
              field.id === fieldId ? { ...field, value } : field
            ),
          }
        }
        return child
      }),
    }
  }

  private toggleRowSelection(nodeId: string, rowId: string): PageSnapshot {
    return {
      ...this.snapshot,
      children: this.snapshot.children.map((child) => {
        if (child.kind === 'table' && child.nodeId === nodeId) {
          const table = child as TableSnapshot
          const selectedRowIds = table.selection.selectedRowIds.includes(rowId)
            ? table.selection.selectedRowIds.filter((id) => id !== rowId)
            : [...table.selection.selectedRowIds, rowId]

          return {
            ...table,
            selection: {
              ...table.selection,
              selectedRowIds,
            },
          }
        }
        return child
      }),
    }
  }

  private changePage(nodeId: string, page: number): PageSnapshot {
    return {
      ...this.snapshot,
      children: this.snapshot.children.map((child) => {
        if (child.kind === 'table' && child.nodeId === nodeId) {
          const table = child as TableSnapshot
          return {
            ...table,
            pagination: {
              ...table.pagination,
              currentPage: page,
            },
          }
        }
        return child
      }),
    }
  }

  // IViewSnapshotEngine 인터페이스의 나머지 메서드 (no-op)
  registerFormRuntime(): void {}
  registerListRuntime(): void {}
  unregisterRuntime(): boolean {
    return true
  }
  registerTabs(): void {}
  unregisterTabs(): boolean {
    return true
  }
  registerTemplate(): void {}
  getOverlayManager(): any {
    return null
  }
}

// ============================================================================
// Demo App
// ============================================================================

interface DemoAppProps {
  isInteractive?: boolean
}

const DemoApp: React.FC<DemoAppProps> = ({ isInteractive = true }) => {
  const [engine] = useState(() => new MockViewSnapshotEngine())
  const { exit } = useApp()

  // Ctrl+C로 종료 (interactive 모드에서만)
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        exit()
      }
    },
    { isActive: isInteractive }
  )

  return (
    <InkProvider engine={engine} isInteractive={isInteractive}>
      <Box flexDirection="column">
        <Box borderStyle="double" borderColor="green" paddingX={1} marginBottom={1}>
          <Text bold color="green">
            Manifesto Ink Demo - ViewSnapshot Terminal UI
          </Text>
        </Box>
        <PageRenderer />
      </Box>
    </InkProvider>
  )
}

// ============================================================================
// Main
// ============================================================================

// TTY 체크: stdin이 TTY가 아니면 비대화형 모드
const isTTY = process.stdin.isTTY ?? false

console.clear()
render(<DemoApp isInteractive={isTTY} />)
