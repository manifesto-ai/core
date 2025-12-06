'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { SemanticSnapshot } from '@manifesto-ai/ai-util'

interface DebugPanelProps {
  tab: 'state' | 'fields' | 'log'
  snapshot?: SemanticSnapshot | null
}

export function DebugPanel({ tab, snapshot }: DebugPanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        {tab === 'state' && <StateTab snapshot={snapshot} />}
        {tab === 'fields' && <FieldsTab snapshot={snapshot} />}
        {tab === 'log' && <LogTab snapshot={snapshot} />}
      </div>
    </ScrollArea>
  )
}

function StateTab({ snapshot }: { snapshot?: SemanticSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Form State
        </h3>
        <p className="text-xs text-muted-foreground">
          No form state available. Load a schema to see form state.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">
        Form State
      </h3>
      <div className="space-y-2">
        <div className="flex gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${
              snapshot.state.form.isValid
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {snapshot.state.form.isValid ? 'Valid' : 'Invalid'}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${
              snapshot.state.form.isDirty
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {snapshot.state.form.isDirty ? 'Dirty' : 'Clean'}
          </span>
          {snapshot.state.form.isSubmitting && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
              Submitting
            </span>
          )}
        </div>
      </div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase mt-4">
        Values
      </h4>
      <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">
        {JSON.stringify(snapshot.state.values, null, 2)}
      </pre>
    </div>
  )
}

function FieldsTab({ snapshot }: { snapshot?: SemanticSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Field Metadata
        </h3>
        <p className="text-xs text-muted-foreground">
          No fields available. Load a schema to see field metadata.
        </p>
      </div>
    )
  }

  const fields = Object.values(snapshot.state.fields)

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">
        Field Metadata ({fields.length} fields)
      </h3>
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field.id} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{field.id}</span>
              <div className="flex gap-1">
                {field.meta.hidden ? (
                  <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                    hidden
                  </span>
                ) : (
                  <span className="rounded bg-green-100 px-1 text-[10px] text-green-700">
                    visible
                  </span>
                )}
                {field.meta.disabled ? (
                  <span className="rounded bg-orange-100 px-1 text-[10px] text-orange-700">
                    disabled
                  </span>
                ) : (
                  <span className="rounded bg-blue-100 px-1 text-[10px] text-blue-700">
                    enabled
                  </span>
                )}
                {field.meta.valid ? (
                  <span className="rounded bg-green-100 px-1 text-[10px] text-green-700">
                    valid
                  </span>
                ) : (
                  <span className="rounded bg-red-100 px-1 text-[10px] text-red-700">
                    invalid
                  </span>
                )}
              </div>
            </div>
            {field.label && (
              <p className="text-[10px] text-muted-foreground mt-1">{field.label}</p>
            )}
            {field.meta.errors.length > 0 && (
              <div className="mt-1">
                {field.meta.errors.map((err, i) => (
                  <p key={i} className="text-[10px] text-red-600">{err}</p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Value: {JSON.stringify(field.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function LogTab({ snapshot }: { snapshot?: SemanticSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Available Interactions
        </h3>
        <p className="text-xs text-muted-foreground">
          No interactions available. Load a schema to see available actions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">
        Available Interactions
      </h3>
      <div className="space-y-1">
        {snapshot.interactions.map((interaction) => (
          <div
            key={interaction.id}
            className={`flex items-start gap-2 rounded-md p-2 ${
              interaction.available ? 'bg-muted' : 'bg-muted/50 opacity-50'
            }`}
          >
            <span
              className={`rounded px-1 text-[10px] ${
                interaction.available
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {interaction.intent}
            </span>
            <span className="text-xs flex-1">{interaction.id}</span>
            {interaction.reason && (
              <span className="text-[10px] text-muted-foreground">
                {interaction.reason}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
