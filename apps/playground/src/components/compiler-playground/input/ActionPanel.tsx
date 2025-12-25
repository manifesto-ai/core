'use client';

/**
 * ActionPanel Component
 *
 * Displays compilation status and provides quick actions.
 */

import { RefreshCw, CheckCircle, AlertCircle, XCircle, Loader2, StopCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompilerPhase } from '../types';
import { PHASE_LABELS, PHASE_COLORS } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ActionPanelProps {
  /** Current compiler phase */
  phase: CompilerPhase | null;
  /** Progress info */
  progress?: {
    stage: number;
    total: number;
    message: string;
  };
  /** Number of fragments */
  fragmentsCount: number;
  /** Number of issues */
  issuesCount: number;
  /** Number of conflicts */
  conflictsCount: number;
  /** Whether compilation is loading */
  isLoading: boolean;
  /** Whether SSE connection is active */
  isConnected?: boolean;
  /** Reset handler */
  onReset: () => void;
  /** Abort handler */
  onAbort?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ActionPanel({
  phase,
  progress,
  fragmentsCount,
  issuesCount,
  conflictsCount,
  isLoading,
  isConnected = false,
  onReset,
  onAbort,
  className,
}: ActionPanelProps) {
  // Determine status icon and color
  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />;
    }

    switch (phase) {
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        if (issuesCount > 0 || conflictsCount > 0) {
          return <AlertCircle className="h-5 w-5 text-amber-500" />;
        }
        return null;
    }
  };

  const phaseColor = phase ? PHASE_COLORS[phase] : undefined;

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-card/50 p-4',
        className
      )}
    >
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {phase ? PHASE_LABELS[phase] : 'Ready'}
              </span>
              {phase && (
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: phaseColor }}
                />
              )}
            </div>
            {progress && progress.message && (
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          {isLoading && (
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                isConnected
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isConnected ? 'Live' : 'Connecting'}</span>
            </div>
          )}

          {/* Abort button (shown while loading) */}
          {isLoading && onAbort && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAbort}
              className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              title="Abort compilation"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          )}

          {/* Reset button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onReset}
            disabled={isLoading}
            className="h-8 w-8"
            title="Reset"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {isLoading && progress && progress.total > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-neon-cyan transition-all duration-300"
            style={{
              width: `${(progress.stage / progress.total) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Fragments"
          value={fragmentsCount}
          color="text-neon-cyan"
        />
        <StatCard
          label="Issues"
          value={issuesCount}
          color={issuesCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}
        />
        <StatCard
          label="Conflicts"
          value={conflictsCount}
          color={conflictsCount > 0 ? 'text-red-500' : 'text-muted-foreground'}
        />
      </div>
    </div>
  );
}

// ============================================================================
// StatCard Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

function StatCard({ label, value, color = 'text-foreground' }: StatCardProps) {
  return (
    <div className="flex flex-col items-center rounded-md bg-muted/50 px-3 py-2">
      <span className={cn('text-lg font-bold', color)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default ActionPanel;
