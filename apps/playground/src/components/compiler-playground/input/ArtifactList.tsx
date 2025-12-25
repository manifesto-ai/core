'use client';

/**
 * ArtifactList Component
 *
 * Manages multiple input artifacts for compilation.
 */

import { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InputArtifact } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactListProps {
  /** List of artifacts */
  artifacts: InputArtifact[];
  /** Add artifact handler */
  onAdd: (name: string, content: string) => void;
  /** Remove artifact handler */
  onRemove: (id: string) => void;
  /** Whether compilation is in progress */
  isLoading: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ArtifactList({
  artifacts,
  onAdd,
  onRemove,
  isLoading,
  className,
}: ArtifactListProps) {
  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  // Handle add submit
  const handleAdd = useCallback(() => {
    if (!newName.trim() || !newContent.trim()) return;
    onAdd(newName.trim(), newContent.trim());
    setNewName('');
    setNewContent('');
    setIsAdding(false);
  }, [newName, newContent, onAdd]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setNewName('');
    setNewContent('');
    setIsAdding(false);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Artifacts</span>
          {artifacts.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {artifacts.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          disabled={isLoading || isAdding}
          className="h-7 gap-1 px-2 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="border-b border-border p-3">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Artifact name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={cn(
                'w-full rounded-md border border-border bg-background px-3 py-1.5',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-1 focus:ring-neon-cyan'
              )}
              autoFocus
            />
            <textarea
              placeholder="Content..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className={cn(
                'w-full resize-none rounded-md border border-border bg-background px-3 py-2',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-1 focus:ring-neon-cyan'
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="h-7 px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || !newContent.trim()}
                className="h-7 px-3 text-xs"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Artifacts List */}
      <div className="flex flex-col gap-2 p-3 max-h-[200px] overflow-y-auto">
        {artifacts.length === 0 && !isAdding ? (
          <p className="text-center text-xs text-muted-foreground py-2">
            No additional artifacts. Click "Add" to include more input.
          </p>
        ) : (
          artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className={cn(
                'flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2',
                'group'
              )}
            >
              {/* Artifact Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate">
                  {artifact.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(artifact.id)}
                  disabled={isLoading}
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Artifact Content Preview */}
              <p className="text-xs text-muted-foreground line-clamp-2">
                {artifact.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ArtifactList;
