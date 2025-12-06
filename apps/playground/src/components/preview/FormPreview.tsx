'use client'

import { useCallback, useRef, useMemo, useState } from 'react'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'
import type { FormRuntime } from '@manifesto-ai/engine'
import { FormRenderer } from '@manifesto-ai/react'
import { Button } from '@/components/ui/button'
import { getPlaygroundRegistry } from '@/lib/component-registry'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface FormPreviewProps {
  entitySchema: EntitySchema | null
  viewSchema: FormViewSchema | null
  onRuntimeReady?: (runtime: FormRuntime) => void
  onValuesChange?: (values: Record<string, unknown>) => void
}

export function FormPreview({
  entitySchema,
  viewSchema,
  onRuntimeReady,
  onValuesChange,
}: FormPreviewProps) {
  const runtimeRef = useRef<FormRuntime | null>(null)
  const [isValid, setIsValid] = useState(false)
  const [isSubmitting] = useState(false)

  const handleRuntimeReady = useCallback(
    (runtime: FormRuntime) => {
      runtimeRef.current = runtime
      setIsValid(runtime.getState().isValid)
      onRuntimeReady?.(runtime)
    },
    [onRuntimeReady]
  )

  const handleChange = useCallback(
    (_fieldId: string, _value: unknown) => {
      if (runtimeRef.current) {
        const state = runtimeRef.current.getState()
        onValuesChange?.(state.values)
        setIsValid(state.isValid)
      }
    },
    [onValuesChange]
  )

  const handleReset = useCallback(() => {
    if (runtimeRef.current) {
      runtimeRef.current.dispatch({ type: 'RESET' })
      setIsValid(runtimeRef.current.getState().isValid)
    }
  }, [])

  const handleSubmit = useCallback((data: Record<string, unknown>) => {
    console.log('Form submitted:', data)
    alert('Form submitted!\n\n' + JSON.stringify(data, null, 2))
  }, [])

  // Get field registry
  const fieldRegistry = useMemo(() => getPlaygroundRegistry(), [])

  if (!viewSchema) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Schema Loaded</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Select an example from the sidebar or enter a valid schema to preview the form
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <FormRenderer
        schema={viewSchema}
        entitySchema={entitySchema ?? undefined}
        fieldRegistry={fieldRegistry}
        onRuntimeReady={handleRuntimeReady}
        onChange={handleChange}
        onSubmit={handleSubmit}
        renderHeader={() => {
          const header = viewSchema.header
          if (!header) return null
          return (
            <div className="px-6 py-4 border-b bg-muted/30">
              <h2 className="text-lg font-semibold">{header.title}</h2>
              {header.subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{header.subtitle}</p>
              )}
            </div>
          )
        }}
        renderFooter={() => {
          const footer = viewSchema.footer
          return (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
              <div className="flex items-center gap-2 text-sm">
                {isValid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">Form is valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-muted-foreground">Please fill required fields</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {footer?.actions?.length ? (
                  footer.actions.map((action) => (
                    <Button
                      key={action.id}
                      type={action.id === 'submit' ? 'submit' : 'button'}
                      variant={action.variant === 'secondary' || action.id === 'cancel' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => {
                        if (action.id === 'cancel') {
                          handleReset()
                        }
                      }}
                      disabled={action.id === 'submit' && (!isValid || isSubmitting)}
                    >
                      {isSubmitting && action.id === 'submit' && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      {action.label || action.id}
                    </Button>
                  ))
                ) : (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                      Reset
                    </Button>
                    <Button type="submit" size="sm" disabled={!isValid || isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        }}
      />
      {/* Form content padding wrapper */}
      <style jsx global>{`
        .form-renderer__content {
          padding: 1.5rem;
        }
      `}</style>
    </div>
  )
}
