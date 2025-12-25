"use client";

import { useEffect, useCallback, useMemo } from "react";
import { NodeViewProps } from "@tiptap/react";
import { BlockWrapper } from "./BlockWrapper";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useActionBlocks,
  useSources,
  useDerivedBlocks,
  useSelectedBlockId,
  useValidationResult,
  useSetValue,
} from "@/runtime";
import type { EffectType } from "@/domain";
import { Zap } from "lucide-react";
import { ExpressionEditor } from "../expression";
import { PathAutocomplete } from "../PathAutocomplete";

const EFFECT_TYPES: { value: EffectType; label: string; description: string }[] = [
  { value: "setState", label: "Set State", description: "Update state values" },
  { value: "apiCall", label: "API Call", description: "Make HTTP request" },
  { value: "navigate", label: "Navigate", description: "Change route/URL" },
  { value: "custom", label: "Custom", description: "Custom effect handler" },
];

export function ActionBlockComponent({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { id, path, preconditions, effectType, effectConfig, description } = node.attrs;

  const { value: actionBlocks } = useActionBlocks();
  const { value: sources } = useSources();
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: selectedBlockId } = useSelectedBlockId();
  const { value: validation } = useValidationResult();
  const { setValue } = useSetValue();

  // Compute all available paths for preconditions
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
    if (id && actionBlocks) {
      const currentAction = actionBlocks[id];
      const newAction = {
        id,
        path: path || "",
        preconditions: preconditions || null,
        effectType: effectType || "setState",
        effectConfig: effectConfig || null,
        description: description || "",
      };

      if (JSON.stringify(currentAction) !== JSON.stringify(newAction)) {
        setValue("data.actions", { ...actionBlocks, [id]: newAction });
      }
    }
  }, [id, path, preconditions, effectType, effectConfig, description]);

  // Remove from store on unmount
  useEffect(() => {
    return () => {
      if (id && actionBlocks && actionBlocks[id]) {
        const { [id]: removed, ...remaining } = actionBlocks;
        setValue("data.actions", remaining);
      }
    };
  }, [id]);

  // Update store when attributes change
  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      updateAttributes(updates);
      if (id && actionBlocks) {
        const currentAction = actionBlocks[id] || {
          id,
          path: "",
          preconditions: null,
          effectType: "setState",
          effectConfig: null,
          description: "",
        };
        const updatedAction = { ...currentAction, ...updates };
        setValue("data.actions", { ...actionBlocks, [id]: updatedAction });
      }
    },
    [id, actionBlocks, updateAttributes, setValue]
  );

  const handlePreconditionsChange = useCallback(
    (newExpr: unknown) => {
      handleUpdate({ preconditions: newExpr });
    },
    [handleUpdate]
  );

  const handleDelete = useCallback(() => {
    if (id && actionBlocks) {
      const { [id]: removed, ...remaining } = actionBlocks;
      setValue("data.actions", remaining);
    }
    deleteNode();
  }, [id, actionBlocks, deleteNode, setValue]);

  const handleSelect = useCallback(() => {
    setValue("state.selectedBlockId", id);
  }, [id, setValue]);

  return (
    <BlockWrapper
      variant="action"
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
          <Zap className="h-4 w-4 text-neon-rose" />
          <Badge variant="action">Action</Badge>
          <PathAutocomplete
            value={path || ""}
            onChange={(newPath) => handleUpdate({ path: newPath })}
            availablePaths={[]}
            placeholder="action.doSomething"
            prefix="action."
            className="flex-1"
          />
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-2">
          {/* Effect Type */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Effect Type
            </label>
            <Select
              value={effectType || "setState"}
              onChange={(e) => handleUpdate({ effectType: e.target.value })}
              className="h-8 text-sm"
            >
              {EFFECT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Preconditions (Expression DSL) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Preconditions (must be true to execute)
            </label>
            <ExpressionEditor
              value={preconditions}
              onChange={handlePreconditionsChange}
              availablePaths={allPaths}
              placeholder="Add precondition..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              value={description || ""}
              onChange={(e) => handleUpdate({ description: e.target.value })}
              placeholder="Describe what this action does..."
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
