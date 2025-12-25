"use client";

import { useEffect, useCallback, useMemo } from "react";
import { NodeViewProps } from "@tiptap/react";
import { BlockWrapper } from "./BlockWrapper";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  usePolicyBlocks,
  useSources,
  useDerivedBlocks,
  useActionBlocks,
  useSelectedBlockId,
  useValidationResult,
  useSetValue,
} from "@/runtime";
import type { PolicyType } from "@/domain";
import { Shield } from "lucide-react";
import { ExpressionEditor } from "../expression";
import { PathAutocomplete } from "../PathAutocomplete";
import { PathSelector } from "../expression/PathSelector";

const POLICY_TYPES: { value: PolicyType; label: string; description: string }[] = [
  { value: "allow", label: "Allow", description: "Allow access when condition is true" },
  { value: "deny", label: "Deny", description: "Deny access when condition is true" },
];

export function PolicyBlockComponent({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { id, path, targetPath, condition, policyType, description } = node.attrs;

  const { value: policyBlocks } = usePolicyBlocks();
  const { value: sources } = useSources();
  const { value: derivedBlocks } = useDerivedBlocks();
  const { value: actionBlocks } = useActionBlocks();
  const { value: selectedBlockId } = useSelectedBlockId();
  const { value: validation } = useValidationResult();
  const { setValue } = useSetValue();

  // Compute all available paths for condition evaluation
  const allPaths = useMemo(() => {
    const paths: string[] = [];
    for (const source of Object.values(sources ?? {})) {
      if (source.path) paths.push(source.path);
    }
    for (const derived of Object.values(derivedBlocks ?? {})) {
      if (derived.path) paths.push(derived.path);
    }
    for (const action of Object.values(actionBlocks ?? {})) {
      if (action.path) paths.push(action.path);
    }
    return paths;
  }, [sources, derivedBlocks, actionBlocks]);

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
    if (id && policyBlocks) {
      const currentPolicy = policyBlocks[id];
      const newPolicy = {
        id,
        path: path || "",
        targetPath: targetPath || "",
        condition: condition || null,
        policyType: policyType || "allow",
        description: description || "",
      };

      if (JSON.stringify(currentPolicy) !== JSON.stringify(newPolicy)) {
        setValue("data.policies", { ...policyBlocks, [id]: newPolicy });
      }
    }
  }, [id, path, targetPath, condition, policyType, description]);

  // Remove from store on unmount
  useEffect(() => {
    return () => {
      if (id && policyBlocks && policyBlocks[id]) {
        const { [id]: removed, ...remaining } = policyBlocks;
        setValue("data.policies", remaining);
      }
    };
  }, [id]);

  // Update store when attributes change
  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      updateAttributes(updates);
      if (id && policyBlocks) {
        const currentPolicy = policyBlocks[id] || {
          id,
          path: "",
          targetPath: "",
          condition: null,
          policyType: "allow",
          description: "",
        };
        const updatedPolicy = { ...currentPolicy, ...updates };
        setValue("data.policies", { ...policyBlocks, [id]: updatedPolicy });
      }
    },
    [id, policyBlocks, updateAttributes, setValue]
  );

  const handleConditionChange = useCallback(
    (newExpr: unknown) => {
      handleUpdate({ condition: newExpr });
    },
    [handleUpdate]
  );

  const handleDelete = useCallback(() => {
    if (id && policyBlocks) {
      const { [id]: removed, ...remaining } = policyBlocks;
      setValue("data.policies", remaining);
    }
    deleteNode();
  }, [id, policyBlocks, deleteNode, setValue]);

  const handleSelect = useCallback(() => {
    setValue("state.selectedBlockId", id);
  }, [id, setValue]);

  return (
    <BlockWrapper
      variant="policy"
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
          <Shield className="h-4 w-4 text-neon-violet" />
          <Badge variant="policy">Policy</Badge>
          <PathAutocomplete
            value={path || ""}
            onChange={(newPath) => handleUpdate({ path: newPath })}
            availablePaths={[]}
            placeholder="policy.ruleName"
            prefix="policy."
            className="flex-1"
          />
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-2">
          {/* Policy Type */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Policy Type
              </label>
              <Select
                value={policyType || "allow"}
                onChange={(e) => handleUpdate({ policyType: e.target.value })}
                className="h-8 text-sm"
              >
                {POLICY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Target Path
              </label>
              <PathSelector
                value={targetPath || ""}
                onChange={(newPath) => handleUpdate({ targetPath: newPath })}
                availablePaths={allPaths}
                placeholder="Select target..."
                className="h-8"
              />
            </div>
          </div>

          {/* Condition (Expression DSL) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Condition (when to {policyType === "deny" ? "deny" : "allow"})
            </label>
            <ExpressionEditor
              value={condition}
              onChange={handleConditionChange}
              availablePaths={allPaths}
              placeholder="Add condition..."
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
              placeholder="Describe this policy rule..."
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
