'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

// Dynamically import Monaco to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading editor...</span>
    </div>
  ),
})

interface SchemaEditorPanelProps {
  value: string
  onChange: (value: string) => void
  schemaType: 'entity' | 'view'
}

export function SchemaEditorPanel({
  value,
  onChange,
  schemaType,
}: SchemaEditorPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(value)
      onChange(JSON.stringify(parsed, null, 2))
    } catch {
      // Ignore format errors
    }
  }, [value, onChange])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/8 bg-background/80 backdrop-blur">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 text-foreground/80">
        <Badge variant="outline" className="text-[11px] uppercase tracking-[0.12em] text-foreground/80">
          {schemaType === 'entity' ? 'EntitySchema' : 'ViewSchema'}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-8 px-3 text-xs text-foreground/80 hover:text-white"
          >
            Format
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0 text-foreground/80 hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 bg-black/10">
        <Editor
          height="100%"
          language="json"
          value={value}
          onChange={(v) => onChange(v || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            formatOnPaste: true,
            tabSize: 2,
            automaticLayout: true,
            folding: true,
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  )
}
