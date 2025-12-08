/**
 * Guards Tests
 */

import { describe, it, expect } from 'vitest'
import {
  // Node guards
  isPageSnapshot,
  isFormSnapshot,
  isTableSnapshot,
  isTabsSnapshot,
  isDetailTableSnapshot,
  findNodeById,
  // Intent guards
  isSetFieldValueIntent,
  isSubmitFormIntent,
  isFormIntent,
  isTableIntent,
  isOverlayIntent,
  hasNodeId,
  hasInstanceId,
} from '../guards'

import type {
  PageSnapshot,
  FormSnapshot,
  TableSnapshot,
  TabsSnapshot,
  DetailTableSnapshot,
  ViewIntent,
} from '../types'

describe('Node Guards', () => {
  const mockPageSnapshot: PageSnapshot = {
    nodeId: 'page-1',
    kind: 'page',
    label: 'Test Page',
    children: [],
    overlays: [],
    actions: [],
  }

  const mockFormSnapshot: FormSnapshot = {
    nodeId: 'form-1',
    kind: 'form',
    label: 'Test Form',
    fields: [],
    isValid: true,
    isDirty: false,
    isSubmitting: false,
    actions: [],
  }

  const mockTableSnapshot: TableSnapshot = {
    nodeId: 'table-1',
    kind: 'table',
    label: 'Test Table',
    columns: [],
    rows: [],
    selection: { mode: 'none', selectedRowIds: [] },
    pagination: { currentPage: 1, totalPages: 1, pageSize: 10, totalItems: 0 },
    actions: [],
  }

  const mockTabsSnapshot: TabsSnapshot = {
    nodeId: 'tabs-1',
    kind: 'tabs',
    label: 'Test Tabs',
    activeTabId: 'tab-1',
    tabs: [{ id: 'tab-1', label: 'Tab 1' }],
    actions: [],
  }

  const mockDetailTableSnapshot: DetailTableSnapshot = {
    nodeId: 'detail-1',
    kind: 'detailTable',
    label: 'Test Detail',
    rows: [],
    actions: [],
  }

  describe('isPageSnapshot', () => {
    it('should return true for PageSnapshot', () => {
      expect(isPageSnapshot(mockPageSnapshot)).toBe(true)
    })

    it('should return false for other snapshots', () => {
      expect(isPageSnapshot(mockFormSnapshot)).toBe(false)
      expect(isPageSnapshot(mockTableSnapshot)).toBe(false)
    })
  })

  describe('isFormSnapshot', () => {
    it('should return true for FormSnapshot', () => {
      expect(isFormSnapshot(mockFormSnapshot)).toBe(true)
    })

    it('should return false for other snapshots', () => {
      expect(isFormSnapshot(mockPageSnapshot)).toBe(false)
      expect(isFormSnapshot(mockTableSnapshot)).toBe(false)
    })
  })

  describe('isTableSnapshot', () => {
    it('should return true for TableSnapshot', () => {
      expect(isTableSnapshot(mockTableSnapshot)).toBe(true)
    })

    it('should return false for other snapshots', () => {
      expect(isTableSnapshot(mockPageSnapshot)).toBe(false)
      expect(isTableSnapshot(mockFormSnapshot)).toBe(false)
    })
  })

  describe('isTabsSnapshot', () => {
    it('should return true for TabsSnapshot', () => {
      expect(isTabsSnapshot(mockTabsSnapshot)).toBe(true)
    })

    it('should return false for other snapshots', () => {
      expect(isTabsSnapshot(mockPageSnapshot)).toBe(false)
    })
  })

  describe('isDetailTableSnapshot', () => {
    it('should return true for DetailTableSnapshot', () => {
      expect(isDetailTableSnapshot(mockDetailTableSnapshot)).toBe(true)
    })

    it('should return false for other snapshots', () => {
      expect(isDetailTableSnapshot(mockPageSnapshot)).toBe(false)
    })
  })

  describe('findNodeById', () => {
    it('should find root node', () => {
      const found = findNodeById(mockPageSnapshot, 'page-1')
      expect(found).toBe(mockPageSnapshot)
    })

    it('should find child node', () => {
      const pageWithChildren: PageSnapshot = {
        ...mockPageSnapshot,
        children: [mockFormSnapshot, mockTableSnapshot],
      }

      const found = findNodeById(pageWithChildren, 'form-1')
      expect(found).toBe(mockFormSnapshot)
    })

    it('should return undefined for non-existent node', () => {
      const found = findNodeById(mockPageSnapshot, 'non-existent')
      expect(found).toBeUndefined()
    })
  })
})

describe('Intent Guards', () => {
  const setFieldValueIntent: ViewIntent = {
    type: 'setFieldValue',
    nodeId: 'form-1',
    fieldId: 'name',
    value: 'test',
  }

  const submitIntent: ViewIntent = {
    type: 'submit',
    nodeId: 'form-1',
  }

  const selectRowIntent: ViewIntent = {
    type: 'selectRow',
    nodeId: 'table-1',
    rowId: 'row-1',
  }

  const openOverlayIntent: ViewIntent = {
    type: 'openOverlay',
    template: 'confirm',
  }

  const closeOverlayIntent: ViewIntent = {
    type: 'closeOverlay',
    instanceId: 'overlay-1',
  }

  describe('isSetFieldValueIntent', () => {
    it('should return true for SetFieldValueIntent', () => {
      expect(isSetFieldValueIntent(setFieldValueIntent)).toBe(true)
    })

    it('should return false for other intents', () => {
      expect(isSetFieldValueIntent(submitIntent)).toBe(false)
    })
  })

  describe('isSubmitFormIntent', () => {
    it('should return true for SubmitFormIntent', () => {
      expect(isSubmitFormIntent(submitIntent)).toBe(true)
    })

    it('should return false for other intents', () => {
      expect(isSubmitFormIntent(setFieldValueIntent)).toBe(false)
    })
  })

  describe('isFormIntent', () => {
    it('should return true for form intents', () => {
      expect(isFormIntent(setFieldValueIntent)).toBe(true)
      expect(isFormIntent(submitIntent)).toBe(true)
    })

    it('should return false for non-form intents', () => {
      expect(isFormIntent(selectRowIntent)).toBe(false)
      expect(isFormIntent(openOverlayIntent)).toBe(false)
    })
  })

  describe('isTableIntent', () => {
    it('should return true for table intents', () => {
      expect(isTableIntent(selectRowIntent)).toBe(true)
    })

    it('should return false for non-table intents', () => {
      expect(isTableIntent(setFieldValueIntent)).toBe(false)
    })
  })

  describe('isOverlayIntent', () => {
    it('should return true for overlay intents', () => {
      expect(isOverlayIntent(openOverlayIntent)).toBe(true)
      expect(isOverlayIntent(closeOverlayIntent)).toBe(true)
    })

    it('should return false for non-overlay intents', () => {
      expect(isOverlayIntent(setFieldValueIntent)).toBe(false)
    })
  })

  describe('hasNodeId', () => {
    it('should return true for intents with nodeId', () => {
      expect(hasNodeId(setFieldValueIntent)).toBe(true)
      expect(hasNodeId(selectRowIntent)).toBe(true)
    })

    it('should return false for intents without nodeId', () => {
      expect(hasNodeId(openOverlayIntent)).toBe(false)
    })
  })

  describe('hasInstanceId', () => {
    it('should return true for intents with instanceId', () => {
      expect(hasInstanceId(closeOverlayIntent)).toBe(true)
    })

    it('should return false for intents without instanceId', () => {
      expect(hasInstanceId(setFieldValueIntent)).toBe(false)
      expect(hasInstanceId(openOverlayIntent)).toBe(false)
    })
  })
})
