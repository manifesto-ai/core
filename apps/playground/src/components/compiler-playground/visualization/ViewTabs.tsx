'use client';

/**
 * ViewTabs Component
 *
 * Tab switcher for DAG and Pipeline views.
 */

import { GitBranch, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisualizationView } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ViewTabsProps {
  /** Currently active view */
  activeView: VisualizationView;
  /** View change handler */
  onViewChange: (view: VisualizationView) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Tab Definition
// ============================================================================

const TABS: Array<{
  id: VisualizationView;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    id: 'dag',
    label: 'Fragment DAG',
    icon: GitBranch,
    description: 'Dependency graph',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: Workflow,
    description: 'Compilation phases',
  },
];

// ============================================================================
// Component
// ============================================================================

export function ViewTabs({
  activeView,
  onViewChange,
  className,
}: ViewTabsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg bg-muted/50 p-1',
        className
      )}
    >
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5',
              'text-sm font-medium transition-all',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={tab.description}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewTabs;
