"use client";

import { useEffect, useCallback, useMemo } from "react";
import { NodeViewProps } from "@tiptap/react";
import { BlockWrapper } from "./BlockWrapper";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSources, useSelectedBlockId, useValidationResult, useSetValue } from "@/runtime";
import type { SchemaType } from "@/domain";
import { Database } from "lucide-react";
import { PathAutocomplete } from "../PathAutocomplete";

const SCHEMA_TYPES: { value: SchemaType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
];

export function SchemaBlockComponent({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { id, path, schemaType, description, defaultValue } = node.attrs;

  const { value: sources } = useSources();
  const { value: selectedBlockId } = useSelectedBlockId();
  const { value: validation } = useValidationResult();
  const { setValue } = useSetValue();

  // Compute available paths for autocomplete (other data.* paths)
  const availablePaths = useMemo(() => {
    const paths: string[] = [];
    for (const source of Object.values(sources ?? {})) {
      if (source.path && source.id !== id) {
        paths.push(source.path);
      }
    }
    return paths;
  }, [sources, id]);

  // Get issues for this path
  const issues = useMemo(() => {
    if (!validation || !path) return [];
    return validation.issues.filter((issue) => issue.path === path || issue.path === id);
  }, [validation, path, id]);

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const isSelected = selectedBlockId === id;

  // Sync with store on mount
  useEffect(() => {
    if (id && sources) {
      const currentSource = sources[id];
      const newSource = {
        id,
        path: path || "",
        schemaType: schemaType || "string",
        description: description || "",
        defaultValue,
      };

      // Only update if different
      if (JSON.stringify(currentSource) !== JSON.stringify(newSource)) {
        const newSources = { ...sources, [id]: newSource };
        setValue("data.sources", newSources);
      }
    }
  }, [id, path, schemaType, description, defaultValue]);

  // Remove from store on unmount
  useEffect(() => {
    return () => {
      if (id && sources && sources[id]) {
        const { [id]: removed, ...remaining } = sources;
        setValue("data.sources", remaining);
      }
    };
  }, [id]);

  // Update store when attributes change
  const handleUpdate = useCallback(
    (updates: Record<string, unknown>) => {
      updateAttributes(updates);
      if (id && sources) {
        const currentSource = sources[id] || {
          id,
          path: "",
          schemaType: "string",
          description: "",
        };
        const updatedSource = { ...currentSource, ...updates };
        setValue("data.sources", { ...sources, [id]: updatedSource });
      }
    },
    [id, sources, updateAttributes, setValue]
  );

  const handleDelete = useCallback(() => {
    if (id && sources) {
      const { [id]: removed, ...remaining } = sources;
      setValue("data.sources", remaining);
    }
    deleteNode();
  }, [id, sources, deleteNode, setValue]);

  const handleSelect = useCallback(() => {
    setValue("state.selectedBlockId", id);
  }, [id, setValue]);

  return (
    <BlockWrapper
      variant="schema"
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
          <Database className="h-4 w-4 text-neon-cyan" />
          <Badge variant="schema">Schema</Badge>
          <PathAutocomplete
            value={path || ""}
            onChange={(newPath) => handleUpdate({ path: newPath })}
            availablePaths={availablePaths}
            placeholder="data.fieldName"
            prefix="data."
            className="flex-1"
          />
        </CardHeader>
        <CardContent className="py-2 px-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Type
              </label>
              <Select
                value={schemaType || "string"}
                onChange={(e) => handleUpdate({ schemaType: e.target.value })}
                className="h-8 text-sm"
              >
                {SCHEMA_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">
                Default
              </label>
              <Input
                value={
                  defaultValue !== null && defaultValue !== undefined
                    ? String(defaultValue)
                    : ""
                }
                onChange={(e) => {
                  let value: unknown = e.target.value;
                  if (schemaType === "number") {
                    value = parseFloat(e.target.value) || 0;
                  } else if (schemaType === "boolean") {
                    value = e.target.value === "true";
                  }
                  handleUpdate({ defaultValue: value });
                }}
                placeholder="Default value"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              value={description || ""}
              onChange={(e) => handleUpdate({ description: e.target.value })}
              placeholder="Describe this field..."
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
