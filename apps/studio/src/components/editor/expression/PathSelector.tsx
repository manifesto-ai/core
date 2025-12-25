"use client";

import { useState, useCallback } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import type { PathSelectorProps } from "./types";

/**
 * PathSelector - Combobox for selecting semantic paths
 *
 * Features:
 * - Searchable dropdown with all available paths
 * - Groups paths by prefix (data.*, derived.*, state.*)
 * - Allows custom path entry
 */
// Context variables for map/filter/reduce expressions
const CONTEXT_VARIABLES = [
  { value: "$", label: "$", description: "현재 아이템 (map/filter)" },
  { value: "$index", label: "$index", description: "현재 인덱스" },
  { value: "$acc", label: "$acc", description: "누적값 (reduce)" },
];

export function PathSelector({
  value,
  onChange,
  availablePaths,
  placeholder = "Select path...",
  className,
  isContextVar,
}: PathSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSelect = useCallback(
    (selectedPath: string) => {
      onChange(selectedPath);
      setOpen(false);
      setInputValue("");
    },
    [onChange]
  );

  const handleInputChange = useCallback((search: string) => {
    setInputValue(search);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && inputValue && !availablePaths.includes(inputValue)) {
        // Allow custom path entry
        onChange(inputValue);
        setOpen(false);
        setInputValue("");
        e.preventDefault();
      }
    },
    [inputValue, availablePaths, onChange]
  );

  // Group paths by prefix
  const groupedPaths = groupPathsByPrefix(availablePaths);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-mono text-xs h-7 min-w-[120px]",
            !value && "text-muted-foreground",
            isContextVar && "border-neon-violet/50 text-neon-violet",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search paths..."
            value={inputValue}
            onValueChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty>
              {inputValue ? (
                <div className="py-2 text-center text-xs">
                  <span className="text-muted-foreground">Press Enter to use: </span>
                  <code className="text-foreground">{inputValue}</code>
                </div>
              ) : (
                <span className="text-muted-foreground">No paths found.</span>
              )}
            </CommandEmpty>

            {/* Context Variables Group */}
            <CommandGroup heading="Context Variables">
              {CONTEXT_VARIABLES.map((ctx) => (
                <CommandItem
                  key={ctx.value}
                  value={ctx.value}
                  onSelect={() => handleSelect(ctx.value)}
                  className="text-xs font-mono"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      value === ctx.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-neon-violet">{ctx.label}</span>
                  <span className="ml-2 text-muted-foreground text-[10px]">
                    {ctx.description}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Available Paths Groups */}
            {Object.entries(groupedPaths).map(([prefix, paths]) => (
              <CommandGroup key={prefix} heading={prefix || "Other"}>
                {paths.map((path) => (
                  <CommandItem
                    key={path}
                    value={path}
                    onSelect={() => handleSelect(path)}
                    className="text-xs font-mono"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3 w-3",
                        value === path ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{path}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Group paths by their prefix (data, derived, state, etc.)
 */
function groupPathsByPrefix(paths: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  for (const path of paths) {
    const prefix = path.split(".")[0] || "other";
    if (!groups[prefix]) {
      groups[prefix] = [];
    }
    groups[prefix].push(path);
  }

  // Sort groups by common prefixes first
  const order = ["data", "derived", "state", "$"];
  const sortedGroups: Record<string, string[]> = {};

  for (const prefix of order) {
    if (groups[prefix]) {
      sortedGroups[prefix] = groups[prefix].sort();
      delete groups[prefix];
    }
  }

  // Add remaining groups
  for (const prefix of Object.keys(groups).sort()) {
    sortedGroups[prefix] = groups[prefix].sort();
  }

  return sortedGroups;
}
