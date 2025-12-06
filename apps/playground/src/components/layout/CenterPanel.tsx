'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'
import { FormPreview } from '@/components/preview/FormPreview'
import { HighlightProvider } from '@manifesto-ai/react'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import type { FormRuntime } from '@manifesto-ai/engine'
import type { HighlightManager } from '@manifesto-ai/ui'

interface CenterPanelProps {
  entitySchema: EntitySchema | null
  viewSchema: FormViewSchema | null
  parseError: string | null
  onRuntimeReady?: (runtime: FormRuntime) => void
  onValuesChange?: (values: Record<string, unknown>) => void
  highlightManager?: HighlightManager
}

export function CenterPanel({
  entitySchema,
  viewSchema,
  parseError,
  onRuntimeReady,
  onValuesChange,
  highlightManager,
}: CenterPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-white/8 bg-background/80 shadow-[0_10px_60px_rgba(0,0,0,0.28)] backdrop-blur-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(56,189,248,0.18)]" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Form Preview
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {entitySchema && viewSchema ? (
            <Badge variant="success" className="shadow-[0_12px_40px_rgba(16,185,129,0.35)]">
              Valid
            </Badge>
          ) : parseError ? (
            <Badge variant="destructive">Error</Badge>
          ) : (
            <Badge variant="secondary" className="text-foreground">
              No Schema
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {parseError ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Parse Error</p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {parseError}
                </pre>
              </div>
            </div>
          ) : (
            <HighlightProvider manager={highlightManager}>
              <FormPreview
                entitySchema={entitySchema}
                viewSchema={viewSchema}
                onRuntimeReady={onRuntimeReady}
                onValuesChange={onValuesChange}
              />
            </HighlightProvider>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
