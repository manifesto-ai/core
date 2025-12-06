'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EXAMPLE_SCHEMAS } from '@/lib/example-schemas'
import { useEffect } from 'react'

interface ExampleSelectorProps {
  onSelect: (exampleId: string) => void
}

export function ExampleSelector({ onSelect }: ExampleSelectorProps) {
  useEffect(() => {
    const first = EXAMPLE_SCHEMAS[0]
    if (first) {
      onSelect(first.id)
    }
  }, [onSelect])

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Load Example
      </label>
      <Select onValueChange={onSelect} defaultValue={EXAMPLE_SCHEMAS[0]?.id}>
        <SelectTrigger className="w-full rounded-lg border-white/10 bg-background/80 text-foreground backdrop-blur">
          <SelectValue placeholder="Select an example..." />
        </SelectTrigger>
        <SelectContent className="border-white/15 bg-background/90 backdrop-blur-xl">
          {EXAMPLE_SCHEMAS.map((example) => (
            <SelectItem key={example.id} value={example.id}>
              <div className="flex flex-col">
                <span>{example.name}</span>
                <span className="text-xs text-muted-foreground">
                  {example.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
