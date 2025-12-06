'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sparkles, Zap, Link2, Eraser, Play } from 'lucide-react'
import type { SemanticSnapshot } from '@manifesto-ai/ai-util'

type HighlightType = 'value-change' | 'visibility-change' | 'dependency-chain'
type HighlightIntensity = 'subtle' | 'normal' | 'strong'

interface HighlightManager {
  highlight(config: {
    type: HighlightType
    fieldPath: string
    duration?: number
    intensity?: HighlightIntensity
  }): void
  highlightChain(
    fieldPaths: string[],
    type?: HighlightType,
    options?: { duration?: number; intensity?: HighlightIntensity; chainDelay?: number }
  ): void
  clearHighlight(fieldPath?: string): void
}

interface HighlightControlsProps {
  highlightManager: HighlightManager | null
  snapshot?: SemanticSnapshot | null
}

export function HighlightControls({ highlightManager, snapshot }: HighlightControlsProps) {
  const [selectedField, setSelectedField] = useState<string>('')
  const [highlightType, setHighlightType] = useState<HighlightType>('value-change')
  const [intensity, setIntensity] = useState<HighlightIntensity>('normal')

  // Get available fields from snapshot
  const fields = snapshot?.state.fields ? Object.values(snapshot.state.fields) : []
  const visibleFields = fields.filter((f) => !f.meta.hidden)

  const handleHighlight = () => {
    if (!highlightManager || !selectedField) return

    highlightManager.highlight({
      type: highlightType,
      fieldPath: selectedField,
      duration: 2000,
      intensity,
    })
  }

  const handleClearAll = () => {
    if (!highlightManager) return
    highlightManager.clearHighlight()
  }

  // Demo: Highlight all visible fields in sequence
  const handleDependencyChainDemo = () => {
    if (!highlightManager) return

    const fieldIds = visibleFields.map((f) => f.id)
    highlightManager.highlightChain(fieldIds, 'dependency-chain', {
      duration: 2000,
      intensity: 'normal',
      chainDelay: 200,
    })
  }

  // Demo: Highlight a specific field with visibility-change effect
  const handleVisibilityDemo = () => {
    if (!highlightManager || visibleFields.length === 0) return

    const randomIndex = Math.floor(Math.random() * visibleFields.length)
    const randomField = visibleFields[randomIndex]
    if (!randomField) return

    highlightManager.highlight({
      type: 'visibility-change',
      fieldPath: randomField.id,
      duration: 2000,
      intensity: 'strong',
    })
  }

  if (!highlightManager) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Highlight manager not available.
      </div>
    )
  }

  return (
    <div className="space-y-4 p-3">
      {/* Field Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          Field
        </Label>
        <Select value={selectedField} onValueChange={setSelectedField}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a field..." />
          </SelectTrigger>
          <SelectContent>
            {visibleFields.map((field) => (
              <SelectItem key={field.id} value={field.id} className="text-xs">
                {field.label || field.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Highlight Type */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          Type
        </Label>
        <Select value={highlightType} onValueChange={(v) => setHighlightType(v as HighlightType)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="value-change" className="text-xs">
              <span className="flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                Value Change (Pulse)
              </span>
            </SelectItem>
            <SelectItem value="visibility-change" className="text-xs">
              <span className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Visibility Change (Slide-in)
              </span>
            </SelectItem>
            <SelectItem value="dependency-chain" className="text-xs">
              <span className="flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                Dependency Chain (Cascade)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Intensity */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase">
          Intensity
        </Label>
        <div className="flex gap-1">
          {(['subtle', 'normal', 'strong'] as const).map((level) => (
            <Button
              key={level}
              size="sm"
              variant={intensity === level ? 'default' : 'outline'}
              className="h-6 text-[10px] px-2 flex-1"
              onClick={() => setIntensity(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={handleHighlight}
          disabled={!selectedField}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Highlight
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleClearAll}
        >
          <Eraser className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Demo Section */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase mb-3 block">
          Demos
        </Label>
        <div className="space-y-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-full h-8 text-xs justify-start"
            onClick={handleVisibilityDemo}
            disabled={visibleFields.length === 0}
          >
            <Play className="h-3 w-3 mr-2" />
            Visibility Change Demo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-full h-8 text-xs justify-start"
            onClick={handleDependencyChainDemo}
            disabled={visibleFields.length === 0}
          >
            <Play className="h-3 w-3 mr-2" />
            Dependency Chain Demo
          </Button>
        </div>
      </div>
    </div>
  )
}
