"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AlertCircle, Check, Code, Eye, Clipboard, ClipboardPaste, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExpressionNode } from "./ExpressionNode";
import { NodeTypeSelector } from "./NodeTypeSelector";
import { ExpressionClipboardProvider, useExpressionClipboard } from "./ExpressionClipboard";
import { useExpressionHistory } from "./useExpressionHistory";
import type { ExpressionEditorProps } from "./types";

/**
 * ExpressionEditor - Visual expression tree editor
 *
 * Features:
 * - Visual tree view of expression
 * - JSON raw view toggle
 * - Add/delete/modify nodes
 * - Path autocomplete
 * - Validation feedback
 * - Copy/Paste with Ctrl+C/V
 */
export function ExpressionEditor(props: ExpressionEditorProps) {
  return (
    <ExpressionClipboardProvider>
      <ExpressionEditorInner {...props} />
    </ExpressionClipboardProvider>
  );
}

function ExpressionEditorInner({
  value,
  onChange,
  availablePaths,
  error,
  placeholder = "Add an expression...",
}: ExpressionEditorProps) {
  const { copy, paste, hasContent } = useExpressionClipboard();
  const {
    value: historyValue,
    set: historySet,
    setImmediate: historySetImmediate,
    undo,
    redo,
    canUndo,
    canRedo
  } = useExpressionHistory(value);

  const containerRef = useRef<HTMLDivElement>(null);
  const [showJson, setShowJson] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Sync history value to parent
  useEffect(() => {
    if (JSON.stringify(historyValue) !== JSON.stringify(value)) {
      onChange(historyValue);
    }
  }, [historyValue, onChange, value]);

  // Keyboard shortcuts for copy/paste/undo/redo
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle when focus is within this editor
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== containerRef.current) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 'c' && !showJson) {
        // Copy entire expression
        if (value !== null && value !== undefined) {
          e.preventDefault();
          await copy(value);
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 1500);
        }
      } else if (modKey && e.key === 'v' && !showJson) {
        // Paste expression
        e.preventDefault();
        const pasted = await paste();
        if (pasted !== null) {
          historySetImmediate(pasted);
        }
      } else if (modKey && e.key === 'z' && !e.shiftKey && !showJson) {
        // Undo
        e.preventDefault();
        undo();
      } else if (modKey && e.key === 'z' && e.shiftKey && !showJson) {
        // Redo (Cmd/Ctrl+Shift+Z)
        e.preventDefault();
        redo();
      } else if (modKey && e.key === 'y' && !showJson) {
        // Redo (Ctrl+Y for Windows)
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [value, copy, paste, undo, redo, historySetImmediate, showJson]);

  // Copy button handler
  const handleCopy = useCallback(async () => {
    if (value !== null && value !== undefined) {
      await copy(value);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  }, [value, copy]);

  // Paste button handler
  const handlePaste = useCallback(async () => {
    const pasted = await paste();
    if (pasted !== null) {
      historySetImmediate(pasted);
    }
  }, [paste, historySetImmediate]);

  // Undo button handler
  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  // Redo button handler
  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  // Check if expression is empty/null
  const isEmpty = value === null || value === undefined;

  // Validate and format JSON
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }, [value]);

  // Handle visual tree change (with debounce for history)
  const handleChange = useCallback(
    (newExpr: unknown) => {
      historySet(newExpr);
    },
    [historySet]
  );

  // Handle JSON input change
  const handleJsonChange = useCallback(
    (jsonStr: string) => {
      setJsonInput(jsonStr);
      try {
        const parsed = JSON.parse(jsonStr);
        setJsonError(null);
        historySetImmediate(parsed);
      } catch (e) {
        setJsonError("Invalid JSON");
      }
    },
    [historySetImmediate]
  );

  // Toggle JSON view
  const handleToggleJson = useCallback(() => {
    if (!showJson) {
      // Switching to JSON view - sync the input
      setJsonInput(formattedJson);
      setJsonError(null);
    }
    setShowJson(!showJson);
  }, [showJson, formattedJson]);

  // Handle adding initial expression
  const handleAddInitial = useCallback(
    (expr: unknown) => {
      historySetImmediate(expr);
    },
    [historySetImmediate]
  );

  return (
    <div ref={containerRef} className="space-y-2" tabIndex={-1}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Expression</span>
          {!isEmpty && !error && !jsonError && (
            <Badge
              variant="outline"
              className="text-neon-emerald border-neon-emerald/50 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Valid
            </Badge>
          )}
          {(error || jsonError) && (
            <Badge
              variant="outline"
              className="text-destructive border-destructive/50 text-xs"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              {error || jsonError}
            </Badge>
          )}
          {copyFeedback && (
            <Badge
              variant="outline"
              className="text-neon-cyan border-neon-cyan/50 text-xs animate-pulse"
            >
              Copied!
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Copy button */}
          {!showJson && !isEmpty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 px-2 text-xs"
              title="Copy expression (Ctrl+C)"
            >
              <Clipboard className="h-3 w-3" />
            </Button>
          )}

          {/* Paste button */}
          {!showJson && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="h-6 px-2 text-xs"
              title="Paste expression (Ctrl+V)"
            >
              <ClipboardPaste className="h-3 w-3" />
            </Button>
          )}

          {/* Separator */}
          {!showJson && (
            <div className="w-px h-4 bg-border mx-1" />
          )}

          {/* Undo button */}
          {!showJson && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              className="h-6 px-2 text-xs"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3 w-3" />
            </Button>
          )}

          {/* Redo button */}
          {!showJson && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              className="h-6 px-2 text-xs"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3 w-3" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleJson}
            className="h-6 px-2 text-xs"
          >
            {showJson ? (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Visual
              </>
            ) : (
              <>
                <Code className="h-3 w-3 mr-1" />
                JSON
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor content */}
      {showJson ? (
        // JSON view
        <Textarea
          value={jsonInput}
          onChange={(e) => handleJsonChange(e.target.value)}
          placeholder='["get", "data.path"]'
          className={`min-h-[100px] font-mono text-xs resize-none ${
            jsonError ? "border-destructive" : ""
          }`}
          rows={5}
        />
      ) : (
        // Visual tree view
        <div className="border rounded-md p-3 bg-muted/20 min-h-[60px]">
          {isEmpty ? (
            // Empty state
            <NodeTypeSelector
              onSelect={handleAddInitial}
              availablePaths={availablePaths}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
              >
                {placeholder}
              </Button>
            </NodeTypeSelector>
          ) : (
            // Render expression tree
            <ExpressionNode
              expr={value}
              nodePath={[]}
              onChange={handleChange}
              availablePaths={availablePaths}
              depth={0}
            />
          )}
        </div>
      )}

      {/* Quick actions */}
      {!showJson && !isEmpty && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tip: Click on operators to change them, or use the dropdowns to add nodes.</span>
        </div>
      )}

      {/* Context variables hint */}
      {!showJson && (
        <div className="text-xs text-muted-foreground">
          <span className="font-mono text-neon-cyan">$</span> = current item in map/filter,{" "}
          <span className="font-mono text-neon-cyan">$index</span> = current index,{" "}
          <span className="font-mono text-neon-cyan">$acc</span> = accumulator in reduce
        </div>
      )}
    </div>
  );
}
