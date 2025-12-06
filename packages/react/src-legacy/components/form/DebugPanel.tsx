/**
 * DebugPanel - Developer tools panel for form debugging
 *
 * PRD Requirements: DevTools
 * - Visualize current field evaluation results (True/False)
 * - Visualize executed action logs
 * - Real-time form state display
 * - Dependency graph visualization
 * - Draggable floating panel
 * - FAB mode when minimized
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { FormViewSchema, ViewField, Expression } from '@manifesto-ai/schema'
import type { FieldMeta } from '@manifesto-ai/engine'
import type { UseFormRuntimeReturn } from '../../hooks/useFormRuntime'

// Expression evaluation result type
interface ExpressionInfo {
  fieldId: string
  type: 'hidden' | 'disabled' | 'value'
  expression: Expression
  result: unknown
}

// Dependency info type
interface DependencyInfo {
  fieldId: string
  dependsOn: string[]
  dependents: string[]
}

// Value change log type
interface ValueChange {
  timestamp: number
  fieldId: string
  oldValue: unknown
  newValue: unknown
}

// Position type
interface Position {
  x: number
  y: number
}

export interface DebugPanelProps {
  /** Form runtime instance */
  runtime: UseFormRuntimeReturn
  /** View schema */
  schema: FormViewSchema
  /** Initial collapsed state */
  collapsed?: boolean
}

const MAX_LOGS = 50

// Storage key for position
const POSITION_STORAGE_KEY = 'debug-panel-position'
const MINIMIZED_STORAGE_KEY = 'debug-panel-minimized'

export const DebugPanel: React.FC<DebugPanelProps> = ({
  runtime,
  schema,
  collapsed: initialCollapsed = true,
}) => {
  // Panel collapsed state (body hidden but header visible)
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)

  // Panel minimized state (FAB mode)
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MINIMIZED_STORAGE_KEY) === 'true'
    }
    return false
  })

  // Current tab
  const [activeTab, setActiveTab] = useState<'state' | 'fields' | 'expressions' | 'deps' | 'actions'>('state')

  // Value changes log
  const [valueChanges, setValueChanges] = useState<ValueChange[]>([])

  // Position state
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          // ignore
        }
      }
    }
    return { x: window?.innerWidth - 420 || 400, y: window?.innerHeight - 400 || 300 }
  })

  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef<Position>({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // Previous values ref
  const previousValuesRef = useRef<Record<string, unknown>>({})

  // Get state from runtime
  const state = runtime.getState()
  const values = runtime.values
  const schemaName = schema.name || 'Form'

  // Track value changes
  useEffect(() => {
    const prevValues = previousValuesRef.current

    for (const key of Object.keys(values)) {
      if (prevValues[key] !== values[key]) {
        setValueChanges((prev) => {
          const newChanges = [
            {
              timestamp: Date.now(),
              fieldId: key,
              oldValue: prevValues[key],
              newValue: values[key],
            },
            ...prev,
          ]
          return newChanges.slice(0, MAX_LOGS)
        })
      }
    }

    previousValuesRef.current = { ...values }
  }, [values])

  // Save position to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isDragging) {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position))
    }
  }, [position, isDragging])

  // Save minimized state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(MINIMIZED_STORAGE_KEY, String(isMinimized))
    }
  }, [isMinimized])

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.debug-panel__tab, .debug-panel__toggle, .debug-panel__minimize, .debug-panel__clear-btn')) {
      return
    }
    e.preventDefault()
    setIsDragging(true)
    const rect = panelRef.current?.getBoundingClientRect()
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y))
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Field meta array
  const fieldsArray = useMemo((): FieldMeta[] => {
    if (!state?.fields) return []
    return Array.from(state.fields.values())
  }, [state?.fields])

  // Hidden fields count
  const hiddenFieldsCount = useMemo(() => {
    return fieldsArray.filter((f) => f.hidden).length
  }, [fieldsArray])

  // Disabled fields count
  const disabledFieldsCount = useMemo(() => {
    return fieldsArray.filter((f) => f.disabled).length
  }, [fieldsArray])

  // Error fields count
  const errorFieldsCount = useMemo(() => {
    return fieldsArray.filter((f) => f.errors.length > 0).length
  }, [fieldsArray])

  // All schema fields flattened
  const allSchemaFields = useMemo((): ViewField[] => {
    const fields: ViewField[] = []
    for (const section of schema.sections) {
      fields.push(...section.fields)
    }
    return fields
  }, [schema.sections])

  // Check if value is an expression
  const isExpression = useCallback((value: unknown): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.startsWith('$')) return true
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') return true
    return false
  }, [])

  // Expression evaluation results
  const expressionResults = useMemo((): ExpressionInfo[] => {
    const results: ExpressionInfo[] = []

    for (const field of allSchemaFields) {
      const meta = fieldsArray.find((f) => f.id === field.id)

      if (field.props?.hidden && isExpression(field.props.hidden)) {
        results.push({
          fieldId: field.id,
          type: 'hidden',
          expression: field.props.hidden as Expression,
          result: meta?.hidden ?? false,
        })
      }

      if (field.props?.disabled && isExpression(field.props.disabled)) {
        results.push({
          fieldId: field.id,
          type: 'disabled',
          expression: field.props.disabled as Expression,
          result: meta?.disabled ?? false,
        })
      }
    }

    return results
  }, [allSchemaFields, fieldsArray, isExpression])

  // Dependency map
  const dependencyMap = useMemo((): DependencyInfo[] => {
    const map: DependencyInfo[] = []
    const dependentsMap: Map<string, Set<string>> = new Map()

    for (const field of allSchemaFields) {
      const dependsOn = field.dependsOn ?? []

      for (const dep of dependsOn) {
        if (!dependentsMap.has(dep)) {
          dependentsMap.set(dep, new Set())
        }
        dependentsMap.get(dep)!.add(field.id)
      }

      map.push({
        fieldId: field.id,
        dependsOn: [...dependsOn],
        dependents: [],
      })
    }

    for (const info of map) {
      info.dependents = [...(dependentsMap.get(info.fieldId) ?? [])]
    }

    return map.filter((d) => d.dependsOn.length > 0 || d.dependents.length > 0)
  }, [allSchemaFields])

  // Format expression
  const formatExpression = useCallback((expr: Expression): string => {
    if (typeof expr === 'string') return expr
    if (Array.isArray(expr)) {
      return JSON.stringify(expr)
    }
    return String(expr)
  }, [])

  // Format time
  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [])

  // Format value
  const formatValue = useCallback((value: unknown): string => {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (Array.isArray(value)) return `[${value.length} items]`
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }, [])

  // Clear logs
  const clearLogs = useCallback(() => {
    setValueChanges([])
  }, [])

  // Toggle panel body
  const togglePanel = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  // Minimize to FAB
  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMinimized(true)
  }, [])

  // Restore from FAB
  const handleRestore = useCallback(() => {
    setIsMinimized(false)
  }, [])

  // FAB mode
  if (isMinimized) {
    return (
      <button
        type="button"
        className="debug-panel-fab"
        onClick={handleRestore}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
        }}
        title={`${schemaName} DevTools - ${errorFieldsCount > 0 ? `${errorFieldsCount} errors` : 'Valid'}`}
      >
        <span className="debug-panel-fab__icon">🔧</span>
        {errorFieldsCount > 0 && (
          <span className="debug-panel-fab__badge">{errorFieldsCount}</span>
        )}
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className={`debug-panel debug-panel--floating ${isCollapsed ? 'debug-panel--collapsed' : ''} ${isDragging ? 'debug-panel--dragging' : ''}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div
        className="debug-panel__header"
        onMouseDown={handleMouseDown}
      >
        <div className="debug-panel__title">
          <span className="debug-panel__icon">🔧</span>
          <span>{schemaName} DevTools</span>
        </div>
        <div className="debug-panel__badges">
          {!state.isValid && (
            <span className="debug-panel__badge debug-panel__badge--error">
              {errorFieldsCount} errors
            </span>
          )}
          {state.isDirty && (
            <span className="debug-panel__badge debug-panel__badge--warning">dirty</span>
          )}
          <span className="debug-panel__badge">{fieldsArray.length} fields</span>
        </div>
        <button
          type="button"
          className="debug-panel__minimize"
          onClick={handleMinimize}
          aria-label="Minimize to FAB"
          title="Minimize"
        >
          _
        </button>
        <button
          type="button"
          className="debug-panel__toggle"
          onClick={togglePanel}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="debug-panel__body">
          {/* Tabs */}
          <div className="debug-panel__tabs">
            {(['state', 'fields', 'expressions', 'deps', 'actions'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`debug-panel__tab ${activeTab === tab ? 'debug-panel__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'state'
                  ? 'State'
                  : tab === 'fields'
                    ? 'Fields'
                    : tab === 'expressions'
                      ? 'Expr'
                      : tab === 'deps'
                        ? 'Deps'
                        : 'Log'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="debug-panel__content">
            {/* State Tab */}
            {activeTab === 'state' && (
              <div className="debug-panel__state">
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Valid:</span>
                  <span
                    className={`debug-panel__state-value ${
                      state.isValid
                        ? 'debug-panel__state-value--success'
                        : 'debug-panel__state-value--error'
                    }`}
                  >
                    {String(state.isValid)}
                  </span>
                </div>
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Dirty:</span>
                  <span className="debug-panel__state-value">{String(state.isDirty)}</span>
                </div>
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Submitting:</span>
                  <span className="debug-panel__state-value">{String(state.isSubmitting)}</span>
                </div>
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Hidden Fields:</span>
                  <span className="debug-panel__state-value">{hiddenFieldsCount}</span>
                </div>
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Disabled Fields:</span>
                  <span className="debug-panel__state-value">{disabledFieldsCount}</span>
                </div>
                <div className="debug-panel__state-row">
                  <span className="debug-panel__state-label">Error Fields:</span>
                  <span
                    className={`debug-panel__state-value ${
                      errorFieldsCount > 0 ? 'debug-panel__state-value--error' : ''
                    }`}
                  >
                    {errorFieldsCount}
                  </span>
                </div>

                {/* Values */}
                <div className="debug-panel__values">
                  <div className="debug-panel__values-header">Values:</div>
                  <pre className="debug-panel__values-content">
                    {JSON.stringify(values, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Fields Tab */}
            {activeTab === 'fields' && (
              <div className="debug-panel__fields">
                {fieldsArray.map((field) => (
                  <div
                    key={field.id}
                    className={`debug-panel__field ${field.hidden ? 'debug-panel__field--hidden' : ''} ${
                      field.disabled ? 'debug-panel__field--disabled' : ''
                    } ${field.errors.length > 0 ? 'debug-panel__field--error' : ''}`}
                  >
                    <div className="debug-panel__field-header">
                      <span className="debug-panel__field-id">{field.id}</span>
                      <div className="debug-panel__field-tags">
                        {field.hidden && (
                          <span className="debug-panel__field-tag debug-panel__field-tag--hidden">
                            hidden
                          </span>
                        )}
                        {field.disabled && (
                          <span className="debug-panel__field-tag debug-panel__field-tag--disabled">
                            disabled
                          </span>
                        )}
                        {field.errors.length > 0 && (
                          <span className="debug-panel__field-tag debug-panel__field-tag--error">
                            {field.errors.length} error(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="debug-panel__field-value">
                      Value: <code>{formatValue(values[field.id])}</code>
                    </div>
                    {field.errors.length > 0 && (
                      <div className="debug-panel__field-errors">
                        {field.errors.map((error, idx) => (
                          <div key={idx} className="debug-panel__field-error">
                            {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Expressions Tab */}
            {activeTab === 'expressions' && (
              <div className="debug-panel__expressions">
                {expressionResults.length === 0 ? (
                  <div className="debug-panel__empty">No expressions with reactive evaluation</div>
                ) : (
                  expressionResults.map((expr, idx) => (
                    <div
                      key={idx}
                      className={`debug-panel__expr ${
                        expr.result === true
                          ? 'debug-panel__expr--true'
                          : 'debug-panel__expr--false'
                      }`}
                    >
                      <div className="debug-panel__expr-header">
                        <span className="debug-panel__expr-field">{expr.fieldId}</span>
                        <span className="debug-panel__expr-type">{expr.type}</span>
                        <span
                          className={`debug-panel__expr-result ${
                            expr.result === true
                              ? 'debug-panel__expr-result--true'
                              : 'debug-panel__expr-result--false'
                          }`}
                        >
                          {String(expr.result)}
                        </span>
                      </div>
                      <code className="debug-panel__expr-code">
                        {formatExpression(expr.expression)}
                      </code>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Dependencies Tab */}
            {activeTab === 'deps' && (
              <div className="debug-panel__deps">
                {dependencyMap.length === 0 ? (
                  <div className="debug-panel__empty">No field dependencies defined</div>
                ) : (
                  dependencyMap.map((dep) => (
                    <div key={dep.fieldId} className="debug-panel__dep">
                      <div className="debug-panel__dep-field">{dep.fieldId}</div>
                      {dep.dependsOn.length > 0 && (
                        <div className="debug-panel__dep-row">
                          <span className="debug-panel__dep-label">depends on:</span>
                          <div className="debug-panel__dep-items">
                            {dep.dependsOn.map((d) => (
                              <span
                                key={d}
                                className="debug-panel__dep-item debug-panel__dep-item--upstream"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dep.dependents.length > 0 && (
                        <div className="debug-panel__dep-row">
                          <span className="debug-panel__dep-label">affects:</span>
                          <div className="debug-panel__dep-items">
                            {dep.dependents.map((d) => (
                              <span
                                key={d}
                                className="debug-panel__dep-item debug-panel__dep-item--downstream"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="debug-panel__actions">
                <div className="debug-panel__actions-header">
                  <span>Value Changes</span>
                  <button type="button" className="debug-panel__clear-btn" onClick={clearLogs}>
                    Clear
                  </button>
                </div>
                {valueChanges.length === 0 ? (
                  <div className="debug-panel__empty">No changes recorded yet</div>
                ) : (
                  valueChanges.map((change, idx) => (
                    <div key={idx} className="debug-panel__action">
                      <span className="debug-panel__action-time">
                        {formatTime(change.timestamp)}
                      </span>
                      <span className="debug-panel__action-field">{change.fieldId}</span>
                      <span className="debug-panel__action-arrow">→</span>
                      <code className="debug-panel__action-value">
                        {formatValue(change.newValue)}
                      </code>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DebugPanel
