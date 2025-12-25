'use client';

/**
 * NextStepsPanel Component
 *
 * Displays suggested next steps after compilation.
 */

import { Lightbulb, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NextStep } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface NextStepsPanelProps {
  /** Next steps from compilation */
  nextSteps: NextStep[];
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Priority Styles
// ============================================================================

const PRIORITY_STYLES: Record<NextStep['priority'], {
  bg: string;
  text: string;
  border: string;
  icon: React.ElementType;
}> = {
  high: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/30',
    icon: AlertCircle,
  },
  medium: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    icon: AlertTriangle,
  },
  low: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    icon: Info,
  },
};

const PRIORITY_LABELS: Record<NextStep['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// ============================================================================
// Component
// ============================================================================

export function NextStepsPanel({
  nextSteps,
  className,
}: NextStepsPanelProps) {
  // Don't render if no steps
  if (nextSteps.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-foreground">Next Steps</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {nextSteps.length}
        </span>
      </div>

      {/* Steps List */}
      <div className="flex flex-col gap-2 p-3 max-h-[200px] overflow-y-auto">
        {nextSteps.map((step) => {
          const style = PRIORITY_STYLES[step.priority];
          const PriorityIcon = style.icon;

          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-col gap-1 rounded-md border p-2',
                style.bg,
                style.border
              )}
            >
              {/* Step Header */}
              <div className="flex items-center gap-2">
                <PriorityIcon className={cn('h-3.5 w-3.5 shrink-0', style.text)} />
                <span className={cn('text-xs font-medium', style.text)}>
                  {PRIORITY_LABELS[step.priority]}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {step.action}
                </span>
              </div>

              {/* Step Description */}
              {step.description && (
                <p className="text-xs text-muted-foreground pl-5 line-clamp-2">
                  {step.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NextStepsPanel;
