'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { LeftSidebar } from './LeftSidebar'
import { RightPanel } from './RightPanel'
import { CenterPanel } from './CenterPanel'
import { useSchemaState } from '@/hooks/useSchemaState'
import type { FormRuntime, FormState } from '@manifesto-ai/engine'
import type { FormViewSchema } from '@manifesto-ai/schema'
import { buildSemanticSnapshot, type SemanticSnapshot } from '@manifesto-ai/ai-util'
import type { ToolResult } from '@/lib/form-agent'
import { createHighlightManager, type HighlightManager } from '@manifesto-ai/ui'

export function PlaygroundLayout() {
  const schemaState = useSchemaState()
  const [formState, setFormState] = useState<FormState | null>(null)
  const runtimeRef = useRef<FormRuntime | null>(null)
  const baselineValuesRef = useRef<Record<string, unknown>>({})

  // Highlight manager for demo purposes
  const highlightManagerRef = useRef<HighlightManager | null>(null)
  if (!highlightManagerRef.current) {
    highlightManagerRef.current = createHighlightManager()
  }
  const highlightManager = highlightManagerRef.current

  // Handle runtime ready from FormPreview
  const handleRuntimeReady = useCallback((runtime: FormRuntime) => {
    runtimeRef.current = runtime
    const state = runtime.getState()
    setFormState(state)
    baselineValuesRef.current = { ...state.values }

    // Subscribe to state changes
    runtime.subscribe((newState) => {
      setFormState(newState)
    })
  }, [])

  // Handle values change (for re-rendering)
  const handleValuesChange = useCallback((_values: Record<string, unknown>) => {
    // State is already synced via subscription
  }, [])

  // Build semantic snapshot for AI
  const snapshot = useMemo((): SemanticSnapshot | null => {
    const viewSchema = schemaState.parsedViewSchema as FormViewSchema | null
    if (!viewSchema || !formState) {
      return null
    }

    return buildSemanticSnapshot({
      viewSchema,
      state: formState,
      baselineValues: baselineValuesRef.current,
      entitySchema: schemaState.parsedEntitySchema ?? undefined,
    })
  }, [schemaState.parsedViewSchema, schemaState.parsedEntitySchema, formState])

  // Handle tool calls from AI
  const handleToolCall = useCallback((action: ToolResult) => {
    const runtime = runtimeRef.current
    if (!runtime) {
      console.warn('No runtime available for tool call')
      return
    }

    console.log('AI Tool Call:', action)

    switch (action.type) {
      case 'updateField':
        // Skip if validation failed in the tool
        if (!action.success) {
          console.warn('AI Tool validation failed:', action.error)
          return
        }

        // Highlight the field being changed by AI
        highlightManager.highlight({
          type: 'value-change',
          fieldPath: action.fieldId,
          duration: 2500,
          intensity: 'normal',
        })

        runtime.dispatch({
          type: 'FIELD_CHANGE',
          fieldId: action.fieldId,
          value: action.value,
        })
        break

      case 'reset':
        runtime.dispatch({ type: 'RESET' })
        break

      case 'validate':
        if (action.fieldIds && action.fieldIds.length > 0) {
          // Highlight fields being validated
          highlightManager.highlightChain(action.fieldIds, 'dependency-chain', {
            duration: 2000,
            chainDelay: 150,
          })
          runtime.dispatch({ type: 'VALIDATE', fieldIds: action.fieldIds })
        } else {
          runtime.dispatch({ type: 'VALIDATE' })
        }
        break

      case 'submit':
        runtime.dispatch({ type: 'SUBMIT' })
        break
    }
  }, [highlightManager])

  return (
    <div className="relative h-full w-full overflow-hidden px-6 py-5">
      <div className="flex h-full flex-col gap-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/5 px-6 py-4 shadow-[0_18px_90px_rgba(0,0,0,0.35)] backdrop-blur-lg">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/70">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Playground
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold leading-tight text-white">Manifesto Playground</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden rounded-xl border border-white/8 bg-background/75 p-3 shadow-[0_22px_110px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full rounded-lg border border-white/10 bg-background/80"
          >
            {/* Left Sidebar - Schema Editors */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="!overflow-hidden">
              <LeftSidebar
                entitySchemaJson={schemaState.entitySchemaJson}
                viewSchemaJson={schemaState.viewSchemaJson}
                onEntitySchemaChange={schemaState.setEntitySchemaJson}
                onViewSchemaChange={schemaState.setViewSchemaJson}
                onLoadExample={schemaState.loadExample}
              />
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-white/10 after:bg-white/25" />

            {/* Center Panel - Form Preview */}
            <ResizablePanel defaultSize={40} minSize={30} className="!overflow-hidden">
              <CenterPanel
                entitySchema={schemaState.parsedEntitySchema}
                viewSchema={schemaState.parsedViewSchema as FormViewSchema | null}
                parseError={schemaState.parseError}
                onRuntimeReady={handleRuntimeReady}
                onValuesChange={handleValuesChange}
                highlightManager={highlightManager}
              />
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-white/10 after:bg-white/25" />

            {/* Right Panel - Chat & Debug */}
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="!overflow-hidden">
              <RightPanel
                entitySchema={schemaState.parsedEntitySchema}
                viewSchema={schemaState.parsedViewSchema}
                snapshot={snapshot}
                onToolCall={handleToolCall}
                highlightManager={highlightManager}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  )
}
