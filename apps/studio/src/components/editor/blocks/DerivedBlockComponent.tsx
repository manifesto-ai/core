"use client";

import { useEffect, useCallback, useMemo } from "react";
import { NodeViewProps } from "@tiptap/react";
import { BlockWrapper } from "./BlockWrapper";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useDerivedBlocks,
  useSources,
  useSelectedBlockId,
  useValidationResult,
  useSetValue,
} from "@/runtime";
import { Calculator, X } from "lucide-react";
import { ExpressionEditor } from "../expression";
import { PathSelector } from "../expression/PathSelector";
import { PathAutocomplete } from "../PathAutocomplete";

export function DerivedBlockComponent({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { id, path, deps, expr, description } = node.attrs;

  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: sources } = useSources();
  const { value: selectedBlockId } = useSelectedBlockId();
  const { value: validation } = useValidationResult();
  const { setValue } = useSetValue();

  // Compute all available paths
  const allPaths = useMemo(() => {
    const paths: string[] = [];
    for (const source of Object.values(sources ?? {})) {
      if (source.path) paths.push(source.path);
    }
    for (const derived of Object.values(derivedBlocks ?? {})) {
      if (derived.path) paths.push(derived.path);
    }
    return paths;
  }, [sources, derivedBlocks]);

  const availableDeps = allPaths.filter(
    (p) => p !== path && !deps?.includes(p)
  );

  // Get issues for this path
  const issues = useMemo(() => {
    if (!validation || !path) return [];
    return validation.issues.filter(
      (issue) => issue.path === path || issue.path === id
    );
  }, [validation, path, id]);

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const isSelected = selectedBlockId === id;

  // Sync with store on mount
  useEffect(() => {
    if (id && derivedBlocks) {
      const currentDerived = derivedBlocks[id];
      const newDerived = {
        id,
        path: path || "",
        deps: deps || [],
        expr: expr || null,
        description: description || "",
      };

      if (JSON.stringify(currentDerived) !== JSON.stringify(newDerived)) {
        setValue("data.derived", { ...derivedBlocks, [id]: newDerived });
      }
    }
  }, [id, path, deps, expr, description]);

  // Remove from store on unmount
  useEffect(() => {
    return () => {
      if (id && derivedBlocks && derivedBlocks[id]) {
        const { [id]: removed, ...remaining } = derivedBlocks;
        setValue("data.derived", remaining);
      }
    };
  }, [id]);

  // Update store when attributes change
  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      updateAttributes(updates);
      if (id && derivedBlocks) {
        const currentDerived = derivedBlocks[id] || {
          id,
          path: "",
          deps: [],
          expr: null,
          description: "",
        };
        const updatedDerived = { ...currentDerived, ...updates };
        setValue("data.derived", { ...derivedBlocks, [id]: updatedDerived });
      }
    },
    [id, derivedBlocks, updateAttributes, setValue]
  );

  const handleExprChange = useCallback(
    (newExpr: unknown) => {
      handleUpdate({ expr: newExpr });
    },
    [handleUpdate]
  );

  const handleAddDep = useCallback(
    (dep: string) => {
      const newDeps = [...(deps || []), dep];
      handleUpdate({ deps: newDeps });
    },
    [deps, handleUpdate]
  );

  const handleRemoveDep = useCallback(
    (dep: string) => {
      const newDeps = (deps || []).filter((d: string) => d !== dep);
      handleUpdate({ deps: newDeps });
    },
    [deps, handleUpdate]
  );

  const handleDelete = useCallback(() => {
    if (id && derivedBlocks) {
      const { [id]: removed, ...remaining } = derivedBlocks;
      setValue("data.derived", remaining);
    }
    deleteNode();
  }, [id, derivedBlocks, deleteNode, setValue]);

  const handleSelect = useCallback(() => {
    setValue("state.selectedBlockId", id);
  }, [id, setValue]);

  return (
    <BlockWrapper
      variant="derived"
      hasError={hasError}
      hasWarning={hasWarning}
      isSelected={isSelected}
      onDelete={handleDelete}
    >
      <Card
        className="border-0 bg-transparent shadow-none"
        onClick={handleSelect}
      >
        <CardHeader className="flex flex-row items-center gap-2 py-2 px-3 pb-0">
          <Calculator className="h-4 w-4 text-neon-emerald" />
          <Badge variant="derived">Derived</Badge>
          <PathAutocomplete
            value={path || ""}
            onChange={(newPath) => handleUpdate({ path: newPath })}
            availablePaths={allPaths}
            placeholder="derived.fieldName"
            prefix="derived."
            className="flex-1"
          />
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-2">
          {/* Dependencies */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Dependencies
            </label>
            <div className="flex flex-wrap gap-1 items-center">
              {(deps || []).map((dep: string) => (
                <Badge
                  key={dep}
                  variant="secondary"
                  className="text-xs font-mono gap-1"
                >
                  {dep}
                  <button
                    onClick={() => handleRemoveDep(dep)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {availableDeps.length > 0 && (
                <PathSelector
                  value=""
                  onChange={(selectedPath) => {
                    if (selectedPath) {
                      handleAddDep(selectedPath);
                    }
                  }}
                  availablePaths={availableDeps}
                  placeholder="+ Add dep..."
                  className="h-6"
                />
              )}
            </div>
          </div>

          {/* Expression Editor */}
          <ExpressionEditor
            value={expr}
            onChange={handleExprChange}
            availablePaths={allPaths}
            placeholder="Add expression..."
          />

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              value={description || ""}
              onChange={(e) => handleUpdate({ description: e.target.value })}
              placeholder="Describe this computation..."
              className="min-h-[40px] text-sm resize-none"
              rows={1}
            />
          </div>

          {/* Inline issues */}
          {issues.length > 0 && (
            <div className="space-y-1 pt-1">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`text-xs px-2 py-1 rounded ${
                    issue.severity === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-neon-amber/10 text-neon-amber"
                  }`}
                >
                  {issue.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </BlockWrapper>
  );
}
