'use client';

/**
 * PhaseNode Component
 *
 * Custom React Flow node for compiler phases in Pipeline view.
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FileCode,
  Layers,
  ArrowDown,
  Link2,
  CheckCircle2,
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PhaseNodeData, PHASE_COLORS, PHASE_LABELS, type CompilerPhase } from '../types';

// ============================================================================
// Icon Map
// ============================================================================

const PHASE_ICON_MAP: Record<CompilerPhase, React.ElementType> = {
  idle: FileCode,
  parsing: FileCode,
  extracting: Layers,
  lowering: ArrowDown,
  linking: Link2,
  verifying: CheckCircle2,
  repairing: Wrench,
  done: CheckCircle,
  error: XCircle,
};

// ============================================================================
// Types
// ============================================================================

interface PhaseNodeProps {
  data: PhaseNodeData;
}

// ============================================================================
// Component
// ============================================================================

function PhaseNodeComponent({ data }: PhaseNodeProps) {
  const { phase, status, progress, issueCount, conflictCount } = data;

  const color = PHASE_COLORS[phase];
  const label = PHASE_LABELS[phase];
  const Icon = PHASE_ICON_MAP[phase];

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isError = status === 'error';
  const isPending = status === 'pending';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center',
        'h-20 w-32 rounded-xl border-2 bg-card/90 backdrop-blur-sm',
        'transition-all duration-300',
        isActive && 'phase-node-active ring-2 ring-offset-2 ring-offset-background',
        isPending && 'opacity-50'
      )}
      style={{
        borderColor: isActive || isCompleted ? color : 'hsl(var(--border))',
        boxShadow: isActive ? `0 0 30px ${color}50` : 'none',
        ['--ring-color' as string]: color,
      }}
    >
      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />

      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          'transition-all duration-300'
        )}
        style={{
          backgroundColor: isActive || isCompleted ? `${color}20` : 'hsl(var(--muted))',
        }}
      >
        {isActive ? (
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color }}
          />
        ) : (
          <Icon
            className="h-4 w-4"
            style={{ color: isCompleted ? color : 'hsl(var(--muted-foreground))' }}
          />
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'mt-1.5 text-xs font-medium',
          isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>

      {/* Progress */}
      {isActive && progress && progress.total > 0 && (
        <div className="absolute -bottom-1 left-2 right-2 h-0.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(progress.stage / progress.total) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}

      {/* Issue/Conflict badges */}
      {(issueCount > 0 || conflictCount > 0) && (
        <div className="absolute -right-1 -top-1 flex gap-0.5">
          {issueCount > 0 && (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white"
              title={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
            >
              {issueCount}
            </div>
          )}
          {conflictCount > 0 && (
            <div
              className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
              title={`${conflictCount} conflict${conflictCount !== 1 ? 's' : ''}`}
            >
              {conflictCount}
            </div>
          )}
        </div>
      )}

      {/* Completion checkmark */}
      {isCompleted && (
        <div
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: color }}
        >
          <CheckCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Error indicator */}
      {isError && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
          <XCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />
    </div>
  );
}

export const PhaseNode = memo(PhaseNodeComponent);
export default PhaseNode;
