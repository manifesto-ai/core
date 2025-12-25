'use client';

/**
 * DetailsPanel Component
 *
 * Shows detailed information about the selected fragment.
 */

import { useMemo } from 'react';
import {
  X,
  Database,
  Box,
  Calculator,
  GitBranch,
  Shield,
  Zap,
  Play,
  FileText,
  ArrowRight,
  ArrowLeft,
  Code,
  FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type Fragment,
  type FragmentKind,
  FRAGMENT_COLORS,
  getFragmentKind,
  getFragmentLabel,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DetailsPanelProps {
  /** Selected fragment */
  fragment: Fragment | null;
  /** Close handler */
  onClose: () => void;
  /** Additional class names */
  className?: string;
}

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
// Component
// ============================================================================

export function DetailsPanel({
  fragment,
  onClose,
  className,
}: DetailsPanelProps) {
  // Get fragment details
  const details = useMemo(() => {
    if (!fragment) return null;

    const kind = getFragmentKind(fragment);
    const label = getFragmentLabel(fragment);
    const color = FRAGMENT_COLORS[kind];
    const Icon = FRAGMENT_ICON_MAP[kind];

    // Extract expression if available (typed for safe rendering)
    let expression: Record<string, unknown> | string | null = null;
    if ('expr' in fragment) {
      expression = fragment.expr as Record<string, unknown> | string;
    }

    // Extract initial value if available (typed for safe rendering)
    let initialValue: Record<string, unknown> | string | number | boolean | null = null;
    if ('initial' in fragment) {
      initialValue = fragment.initial as Record<string, unknown> | string | number | boolean;
    }

    return {
      kind,
      label,
      color,
      Icon,
      expression,
      initialValue,
    };
  }, [fragment]);

  // Empty state
  if (!fragment || !details) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center',
          'rounded-lg border border-dashed border-border bg-card/30',
          className
        )}
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Select a fragment to view details
          </p>
        </div>
      </div>
    );
  }

  const { kind, label, color, Icon, expression, initialValue } = details;

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-border px-4 py-3"
        style={{ borderLeftColor: color, borderLeftWidth: 4 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {kind.replace('Fragment', '')}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* ID */}
        <Section label="Fragment ID">
          <code className="text-xs text-muted-foreground break-all">
            {fragment.id}
          </code>
        </Section>

        {/* Confidence */}
        <Section label="Confidence">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(fragment.confidence ?? 0) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round((fragment.confidence ?? 0) * 100)}%
            </span>
          </div>
        </Section>

        {/* Provides */}
        {fragment.provides.length > 0 && (
          <Section label="Provides" icon={ArrowRight}>
            <div className="flex flex-wrap gap-1">
              {fragment.provides.map((path) => (
                <PathBadge key={path} path={path} color={color} />
              ))}
            </div>
          </Section>
        )}

        {/* Requires */}
        {fragment.requires.length > 0 && (
          <Section label="Requires" icon={ArrowLeft}>
            <div className="flex flex-wrap gap-1">
              {fragment.requires.map((path) => (
                <PathBadge key={path} path={path} />
              ))}
            </div>
          </Section>
        )}

        {/* Expression */}
        {expression && (
          <Section label="Expression" icon={Code}>
            <pre className="overflow-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(expression, null, 2)}
            </pre>
          </Section>
        )}

        {/* Initial Value */}
        {initialValue !== null && initialValue !== undefined && (
          <Section label="Initial Value" icon={FileJson}>
            <pre className="overflow-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(initialValue, null, 2)}
            </pre>
          </Section>
        )}

        {/* Tags */}
        {fragment.tags && fragment.tags.length > 0 && (
          <Section label="Tags">
            <div className="flex flex-wrap gap-1">
              {fragment.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Provenance */}
        <Section label="Origin">
          <div className="rounded-md bg-muted p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Artifact:</span>
              <span className="font-mono">{fragment.origin?.artifactId ?? 'unknown'}</span>
            </div>
            {fragment.origin?.location && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-muted-foreground">Location:</span>
                <span className="font-mono">
                  {JSON.stringify(fragment.origin.location)}
                </span>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

interface SectionProps {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}

function Section({ label, icon: Icon, children }: SectionProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// PathBadge Component
// ============================================================================

interface PathBadgeProps {
  path: string;
  color?: string;
}

function PathBadge({ path, color }: PathBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-mono',
        color ? 'text-foreground' : 'bg-muted text-muted-foreground'
      )}
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {path}
    </span>
  );
}

export default DetailsPanel;
