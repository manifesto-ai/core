import React, { useEffect, useMemo, useState } from 'react'
import type { ListViewSchema } from '@manifesto-ai/schema'
import type { ListSemanticNode, SemanticRendererRegistry } from '@manifesto-ai/ui'
import { getDefaultSemanticRegistry } from '@manifesto-ai/ui'

export interface ListRendererProps {
  schema: ListViewSchema
  rows?: readonly Record<string, unknown>[]
  includeHiddenColumns?: boolean
  semanticRegistry?: SemanticRendererRegistry
  renderCell?: (params: {
    columnId: string
    rowIndex: number
    row: Record<string, unknown>
    value: unknown
  }) => React.ReactNode
}

export const ListRenderer: React.FC<ListRendererProps> = ({
  schema,
  rows = [],
  includeHiddenColumns = false,
  semanticRegistry,
  renderCell,
}) => {
  const semantic = useMemo(
    () => semanticRegistry ?? getDefaultSemanticRegistry(),
    [semanticRegistry]
  )
  const [tree, setTree] = useState<ListSemanticNode | null>(null)

  useEffect(() => {
    const contract = { kind: 'list' as const, view: schema, rows }
    const built = semantic.build(contract, { includeHidden: includeHiddenColumns })
    setTree(built as ListSemanticNode)
  }, [schema, rows, includeHiddenColumns, semantic])

  if (!tree) return null

  const visibleColumns = tree.columns

  if (rows.length === 0) {
    return (
      <div className="mfs-list mfs-list--empty">
        {tree.emptyState?.title ?? 'No data'}
      </div>
    )
  }

  return (
    <table className="mfs-list">
      <thead>
        <tr>
          {visibleColumns.map((col) => (
            <th key={col.columnId} style={{ textAlign: col.align ?? 'left' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {visibleColumns.map((col) => {
              const value = (row as Record<string, unknown>)[col.entityFieldId]
              return (
                <td key={col.columnId}>
                  {renderCell
                    ? renderCell({ columnId: col.columnId, rowIndex, row: row as Record<string, unknown>, value })
                    : (value as React.ReactNode)}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ListRenderer
