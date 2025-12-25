'use client';

/**
 * CompilerPlayground Component
 *
 * Main container component that orchestrates the interactive compiler experience.
 * Features:
 * - Natural language input
 * - Real-time compilation with OpenAI
 * - Fragment DAG visualization with React Flow
 * - Pipeline phase visualization
 * - Fragment details panel
 */

import { useState, useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useCompilerSession } from './hooks/useCompilerSession';
import { NaturalLanguageInput, ActionPanel, ArtifactList } from './input';
import { FragmentDAGView, PipelineView, ViewTabs, DetailsPanel, NextStepsPanel } from './visualization';
import type { VisualizationView, Fragment, InputArtifact } from './types';

// ============================================================================
// Types
// ============================================================================

export interface CompilerPlaygroundProps {
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CompilerPlayground({
  className,
}: CompilerPlaygroundProps) {
  // Input state
  const [input, setInput] = useState('');
  const [artifacts, setArtifacts] = useState<InputArtifact[]>([]);

  // View state
  const [activeView, setActiveView] = useState<VisualizationView>('dag');
  const [selectedFragmentId, setSelectedFragmentId] = useState<string | null>(null);
  const [hoveredFragmentId, setHoveredFragmentId] = useState<string | null>(null);

  // Compiler session hook (uses SSE streaming API)
  const {
    snapshot,
    isCompiling,
    isConnected,
    error,
    fragments,
    issues,
    conflicts,
    nextSteps,
    compileNL,
    reset,
    abort,
  } = useCompilerSession();

  // Find selected fragment
  const selectedFragment = useMemo<Fragment | null>(() => {
    if (!selectedFragmentId) return null;
    return fragments.find((f) => f.id === selectedFragmentId) ?? null;
  }, [fragments, selectedFragmentId]);

  // Get highlighted paths from hovered or selected fragment (hover takes precedence)
  const highlightedPaths = useMemo<string[]>(() => {
    const targetId = hoveredFragmentId ?? selectedFragmentId;
    if (!targetId) return [];
    const fragment = fragments.find((f) => f.id === targetId);
    if (!fragment) return [];
    return [...fragment.provides, ...fragment.requires];
  }, [hoveredFragmentId, selectedFragmentId, fragments]);

  // Handle submit
  const handleSubmit = useCallback(
    async (value: string) => {
      setSelectedFragmentId(null);
      await compileNL(value, artifacts);
    },
    [compileNL, artifacts]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    setInput('');
    setArtifacts([]);
    setSelectedFragmentId(null);
    reset();
  }, [reset]);

  // Handle artifact add
  const handleAddArtifact = useCallback((name: string, content: string) => {
    setArtifacts((prev) => [
      ...prev,
      {
        id: `artifact-${Date.now()}`,
        name,
        content,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  // Handle artifact remove
  const handleRemoveArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Handle fragment selection
  const handleSelectFragment = useCallback((fragmentId: string) => {
    setSelectedFragmentId((prev) => (prev === fragmentId ? null : fragmentId));
  }, []);

  // Handle close details panel
  const handleCloseDetails = useCallback(() => {
    setSelectedFragmentId(null);
  }, []);

  // Handle node hover
  const handleNodeMouseEnter = useCallback((fragmentId: string) => {
    setHoveredFragmentId(fragmentId);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredFragmentId(null);
  }, []);

  return (
    <ReactFlowProvider>
      <div
        className={cn(
          'flex h-full w-full flex-col overflow-hidden bg-background',
          className
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Manifesto Compiler
            </h1>
            <p className="text-sm text-muted-foreground">
              Transform natural language into domain fragments
            </p>
          </div>
          <ViewTabs activeView={activeView} onViewChange={setActiveView} />
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Input */}
          <div className="flex w-[400px] shrink-0 flex-col border-r border-border p-4 gap-4">
            {/* Natural Language Input */}
            <NaturalLanguageInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              isLoading={isCompiling}
              className="flex-1 min-h-[120px]"
            />

            {/* Artifact List */}
            <ArtifactList
              artifacts={artifacts}
              onAdd={handleAddArtifact}
              onRemove={handleRemoveArtifact}
              isLoading={isCompiling}
            />

            {/* Action Panel */}
            <ActionPanel
              phase={snapshot?.phase ?? null}
              progress={snapshot?.progress}
              fragmentsCount={fragments.length}
              issuesCount={issues.length}
              conflictsCount={conflicts.length}
              isLoading={isCompiling}
              isConnected={isConnected}
              onReset={handleReset}
              onAbort={abort}
            />

            {/* Next Steps Panel */}
            <NextStepsPanel nextSteps={nextSteps} />

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-red-500">
                    Compilation Error
                  </p>
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Center Panel - Visualization */}
          <div className="flex-1 overflow-hidden p-4">
            {activeView === 'dag' ? (
              <FragmentDAGView
                fragments={fragments}
                issues={issues}
                conflicts={conflicts}
                selectedId={selectedFragmentId}
                highlightedPaths={highlightedPaths}
                onSelectFragment={handleSelectFragment}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                className="h-full"
              />
            ) : (
              <PipelineView snapshot={snapshot} className="h-full" />
            )}
          </div>

          {/* Right Panel - Details (only shown when DAG view and fragment selected) */}
          {activeView === 'dag' && (
            <div className="w-[320px] shrink-0 border-l border-border p-4">
              <DetailsPanel
                fragment={selectedFragment}
                onClose={handleCloseDetails}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default CompilerPlayground;
