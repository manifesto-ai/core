/**
 * DataCell - Column type-specific cell rendering
 */

import React, { useMemo } from 'react'
import type { ListColumn, ColumnType, ColumnFormat } from '@manifesto-ai/schema'
import type { ColumnMeta } from '@manifesto-ai/engine'

export interface DataCellProps {
  column: ColumnMeta
  columnSchema: ListColumn
  value: unknown
  row: Record<string, unknown>
  renderCell?: (
    column: ColumnMeta,
    value: unknown,
    row: Record<string, unknown>
  ) => React.ReactNode
}

export const DataCell: React.FC<DataCellProps> = ({
  column,
  columnSchema,
  value,
  row,
  renderCell,
}) => {
  // Custom render prop takes priority
  if (renderCell) {
    const customContent = renderCell(column, value, row)
    if (customContent !== null) {
      return (
        <td
          className={`list-row__cell list-row__cell--${columnSchema.type}`}
          style={{ textAlign: columnSchema.align }}
          data-column-id={columnSchema.id}
        >
          {customContent}
        </td>
      )
    }
  }

  const format = columnSchema.format
  const content = useMemo(
    () => formatCellValue(value, columnSchema.type, format),
    [value, columnSchema.type, format]
  )

  const cellClassName = useMemo(() => {
    const classes = ['list-row__cell', `list-row__cell--${columnSchema.type}`]
    if (columnSchema.align) {
      classes.push(`list-row__cell--align-${columnSchema.align}`)
    }
    return classes.join(' ')
  }, [columnSchema.type, columnSchema.align])

  return (
    <td
      className={cellClassName}
      style={{ textAlign: columnSchema.align }}
      data-column-id={columnSchema.id}
    >
      {content}
    </td>
  )
}

// ============================================================================
// Cell Value Formatting
// ============================================================================

function formatCellValue(
  value: unknown,
  type: ColumnType,
  format?: ColumnFormat
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="list-cell__empty">-</span>
  }

  switch (type) {
    case 'text':
      return formatText(value)

    case 'number':
      return formatNumber(value, format?.numberFormat)

    case 'date':
      return formatDate(value, format?.dateFormat ?? 'yyyy-MM-dd')

    case 'datetime':
      return formatDate(value, format?.dateFormat ?? 'yyyy-MM-dd HH:mm')

    case 'boolean':
      return formatBoolean(value)

    case 'enum':
      return formatEnum(value, format?.enumMap)

    case 'badge':
      return formatBadge(value, format?.badgeMap)

    case 'link':
      return formatLink(value, format?.linkTemplate)

    case 'image':
      return formatImage(value, format?.imageSize)

    case 'actions':
      // Actions are handled by ActionCell
      return null

    case 'custom':
      // Custom should be handled by renderCell prop
      return formatText(value)

    default:
      return formatText(value)
  }
}

function formatText(value: unknown): React.ReactNode {
  return <span className="list-cell__text">{String(value)}</span>
}

function formatNumber(
  value: unknown,
  format?: {
    decimals?: number
    prefix?: string
    suffix?: string
    locale?: string
    style?: 'decimal' | 'currency' | 'percent'
    currency?: string
  }
): React.ReactNode {
  const num = Number(value)
  if (isNaN(num)) {
    return <span className="list-cell__empty">-</span>
  }

  const locale = format?.locale ?? 'en-US'
  const decimals = format?.decimals
  const style = format?.style ?? 'decimal'

  let formatted: string

  if (style === 'currency' && format?.currency) {
    // Currency formatting using Intl.NumberFormat
    formatted = num.toLocaleString(locale, {
      style: 'currency',
      currency: format.currency,
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0,
    })
  } else if (style === 'percent') {
    formatted = num.toLocaleString(locale, {
      style: 'percent',
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 2,
    })
  } else {
    formatted =
      decimals !== undefined
        ? num.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : num.toLocaleString(locale)
  }

  const prefix = format?.prefix ?? ''
  const suffix = format?.suffix ?? ''

  return (
    <span className="list-cell__number">
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

function formatDate(value: unknown, formatString: string): React.ReactNode {
  let date: Date

  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value)
  } else {
    return <span className="list-cell__empty">-</span>
  }

  if (isNaN(date.getTime())) {
    return <span className="list-cell__empty">-</span>
  }

  // Simple format implementation
  const formatted = simpleFormatDate(date, formatString)

  return <span className="list-cell__date">{formatted}</span>
}

function simpleFormatDate(date: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

function formatBoolean(value: unknown): React.ReactNode {
  const bool = Boolean(value)
  return (
    <span className={`list-cell__boolean list-cell__boolean--${bool}`}>
      {bool ? '\u2713' : '\u2717'}
    </span>
  )
}

function formatEnum(
  value: unknown,
  enumMap?: Record<string, string>
): React.ReactNode {
  const strValue = String(value)
  const label = enumMap?.[strValue] ?? strValue

  return <span className="list-cell__enum">{label}</span>
}

function formatBadge(
  value: unknown,
  badgeMap?: Record<string, { label?: string; variant?: string; color?: string; bgColor?: string }>
): React.ReactNode {
  const strValue = String(value)
  const config = badgeMap?.[strValue]
  const label = config?.label ?? strValue

  // variant가 있으면 CSS class 사용, 없으면 inline style (하위 호환)
  const variantClass = config?.variant ? `list-cell__badge--${config.variant}` : ''

  const style: React.CSSProperties = {}
  if (!config?.variant) {
    if (config?.color) style.color = config.color
    if (config?.bgColor) style.backgroundColor = config.bgColor
  }

  return (
    <span className={`list-cell__badge ${variantClass}`.trim()} style={style}>
      {label}
    </span>
  )
}

function formatLink(value: unknown, template?: string): React.ReactNode {
  const strValue = String(value)

  if (template) {
    // URL template like "/users/{value}"
    const href = template.replace('{value}', encodeURIComponent(strValue))
    return (
      <a href={href} className="list-cell__link">
        {strValue}
      </a>
    )
  }

  // Check if value is already a URL
  if (strValue.startsWith('http://') || strValue.startsWith('https://')) {
    return (
      <a
        href={strValue}
        className="list-cell__link"
        target="_blank"
        rel="noopener noreferrer"
      >
        {strValue}
      </a>
    )
  }

  return <span className="list-cell__link">{strValue}</span>
}

function formatImage(
  value: unknown,
  size?: { width: number; height: number }
): React.ReactNode {
  const src = String(value)
  const width = size?.width ?? 40
  const height = size?.height ?? 40

  return (
    <img
      src={src}
      alt=""
      className="list-cell__image"
      width={width}
      height={height}
      loading="lazy"
    />
  )
}

export default DataCell
