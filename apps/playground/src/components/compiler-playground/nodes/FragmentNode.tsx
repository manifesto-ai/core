'use client';

/**
 * FragmentNode Component
 *
 * Custom React Flow node for displaying Fragment information.
 * Features glow effects, issue/conflict badges, and fragment-type colors.
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Database,
  Box,
  Calculator,
  GitBranch,
  Shield,
  Zap,
  Play,
  FileText,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type FragmentNodeData,
  type FragmentKind,
  FRAGMENT_COLORS,
  getFragmentKind,
  getFragmentLabel,
} from '../types';

// ============================================================================
// Icon Map
// ============================================================================

const FRAGMENT_ICON_MAP: Record<FragmentKind, React.ElementType> = {
  SchemaFragment: Database,
  SourceFragment: Box,
  ExpressionFragment: Calculator,
  DerivedFragment: GitBranch,
  PolicyFragment: Shield,
  EffectFragment: Zap,
  ActionFragment: Play,
  StatementFragment: FileText,
};

// ============================================================================
// Types
// ============================================================================

interface FragmentNodeProps {
  data: FragmentNodeData;
  selected?: boolean;
}

// ============================================================================
// Component
// ============================================================================

function FragmentNodeComponent({ data, selected }: FragmentNodeProps) {
  const { fragment, isSelected, isHighlighted, hasIssues, hasConflicts, issueCount, conflictCount } = data;

  const kind = getFragmentKind(fragment);
  const label = getFragmentLabel(fragment);
  const color = FRAGMENT_COLORS[kind];
  const Icon = FRAGMENT_ICON_MAP[kind];

  // Determine visual state
  const isActive = selected || isSelected || isHighlighted;
  const showGlow = isActive;

  return (
    <div
      className={cn(
        'fragment-node relative min-w-[160px] max-w-[220px]',
        'rounded-lg border-2 bg-card/90 backdrop-blur-sm',
        'px-3 py-2 transition-all duration-200',
        isActive && 'ring-2 ring-offset-2 ring-offset-background'
      )}
      style={{
        borderColor: color,
        boxShadow: showGlow ? `0 0 20px ${color}40` : 'none',
        ['--ring-color' as string]: color,
      }}
    >
      {/* Target Handle (incoming edges) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />

      {/* Content */}
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>

        {/* Label and Kind */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium text-foreground"
            title={label}
          >
            {label}
          </p>
          <p className="text-xs text-muted-foreground">{kind.replace('Fragment', '')}</p>
        </div>
      </div>

      {/* Badges */}
      {(hasIssues || hasConflicts) && (
        <div className="absolute -right-1 -top-1 flex gap-1">
          {hasIssues && (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500"
              title={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
            >
              <AlertCircle className="h-3 w-3 text-white" />
            </div>
          )}
          {hasConflicts && (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500"
              title={`${conflictCount} conflict${conflictCount !== 1 ? 's' : ''}`}
            >
              <AlertTriangle className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      )}

      {/* Confidence indicator */}
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(fragment.confidence ?? 0) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round((fragment.confidence ?? 0) * 100)}%
        </span>
      </div>

      {/* Source Handle (outgoing edges) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-border !bg-muted"
      />
    </div>
  );
}

export const FragmentNode = memo(FragmentNodeComponent);
export default FragmentNode;
