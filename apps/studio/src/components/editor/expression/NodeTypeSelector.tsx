"use client";

import { useState, useCallback } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  OPERATORS,
  OPERATOR_GROUPS,
  CATEGORY_NAMES,
  CATEGORY_COLORS,
  createDefaultExpr,
} from "./operators";
import type { NodeTypeSelectorProps, OperatorCategory } from "./types";

/**
 * NodeTypeSelector - Dropdown for selecting expression node type
 *
 * Shows operators grouped by category with search.
 * Also includes options for:
 * - Literals (string, number, boolean, null)
 * - Path reference (get)
 */
export function NodeTypeSelector({
  onSelect,
  availablePaths,
  children,
}: NodeTypeSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelectOperator = useCallback(
    (op: string) => {
      const expr = createDefaultExpr(op);
      onSelect(expr);
      setOpen(false);
    },
    [onSelect]
  );

  const handleSelectLiteral = useCallback(
    (type: "string" | "number" | "boolean" | "null") => {
      let value: unknown;
      switch (type) {
        case "string":
          value = "";
          break;
        case "number":
          value = 0;
          break;
        case "boolean":
          value = true;
          break;
        case "null":
          value = null;
          break;
      }
      onSelect(value);
      setOpen(false);
    },
    [onSelect]
  );

  const handleSelectPath = useCallback(
    (path: string) => {
      onSelect(["get", path]);
      setOpen(false);
    },
    [onSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search operators..." className="text-xs" />
          <CommandList className="max-h-[350px]">
            <CommandEmpty>No operator found.</CommandEmpty>

            {/* Literals */}
            <CommandGroup heading="Literals">
              <CommandItem
                onSelect={() => handleSelectLiteral("string")}
                className="text-xs"
              >
                <span className="font-mono mr-2">S</span>
                <span>String</span>
                <span className="ml-auto text-muted-foreground">텍스트 값</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectLiteral("number")}
                className="text-xs"
              >
                <span className="font-mono mr-2">#</span>
                <span>Number</span>
                <span className="ml-auto text-muted-foreground">숫자 값</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectLiteral("boolean")}
                className="text-xs"
              >
                <span className="font-mono mr-2">?</span>
                <span>Boolean</span>
                <span className="ml-auto text-muted-foreground">true/false</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelectLiteral("null")}
                className="text-xs"
              >
                <span className="font-mono mr-2">∅</span>
                <span>Null</span>
                <span className="ml-auto text-muted-foreground">빈 값</span>
              </CommandItem>
            </CommandGroup>

            {/* Quick paths */}
            {availablePaths.length > 0 && (
              <CommandGroup heading="Paths (get)">
                {availablePaths.slice(0, 5).map((path) => (
                  <CommandItem
                    key={path}
                    onSelect={() => handleSelectPath(path)}
                    className="text-xs font-mono"
                  >
                    <span className="text-neon-cyan mr-2">get</span>
                    <span>{path}</span>
                  </CommandItem>
                ))}
                {availablePaths.length > 5 && (
                  <CommandItem
                    onSelect={() => handleSelectOperator("get")}
                    className="text-xs text-muted-foreground"
                  >
                    ... and {availablePaths.length - 5} more
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            {/* Operators by category */}
            {(Object.entries(OPERATOR_GROUPS) as [OperatorCategory, string[]][]).map(
              ([category, ops]) => (
                <CommandGroup
                  key={category}
                  heading={CATEGORY_NAMES[category]}
                >
                  {ops.map((op) => {
                    const meta = OPERATORS[op];
                    if (!meta) return null;

                    return (
                      <CommandItem
                        key={op}
                        value={`${op} ${meta.name} ${meta.description}`}
                        onSelect={() => handleSelectOperator(op)}
                        className="text-xs"
                      >
                        <span
                          className={`font-mono mr-2 ${CATEGORY_COLORS[category]}`}
                        >
                          {op}
                        </span>
                        <span>{meta.name}</span>
                        <span className="ml-auto text-muted-foreground truncate max-w-[120px]">
                          {meta.description}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
