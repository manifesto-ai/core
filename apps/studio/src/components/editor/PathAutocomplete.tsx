"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type PathAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  availablePaths: string[];
  placeholder?: string;
  prefix?: "data." | "derived." | "action." | "policy.";
  className?: string;
};

/**
 * PathAutocomplete - Input with autocomplete for semantic paths
 *
 * Unlike PathSelector (dropdown only), this allows free-form input
 * with suggestions from available paths.
 *
 * Features:
 * - Free text input
 * - Dropdown suggestions filtered by input
 * - Auto-prefix option
 * - Keyboard navigation
 */
export function PathAutocomplete({
  value,
  onChange,
  availablePaths,
  placeholder = "Enter path...",
  prefix,
  className,
}: PathAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter paths based on input
  const filteredPaths = useMemo(() => {
    if (!inputValue) return availablePaths;
    const search = inputValue.toLowerCase();
    return availablePaths.filter((path) =>
      path.toLowerCase().includes(search)
    );
  }, [availablePaths, inputValue]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setOpen(true);

      // Apply prefix if needed
      let finalValue = newValue;
      if (prefix && newValue && !newValue.startsWith(prefix)) {
        // Don't auto-add prefix while typing - let validation handle it
      }
      onChange(finalValue);
    },
    [onChange, prefix]
  );

  // Handle selection from dropdown
  const handleSelect = useCallback(
    (selectedPath: string) => {
      setInputValue(selectedPath);
      onChange(selectedPath);
      setOpen(false);
      inputRef.current?.focus();
    },
    [onChange]
  );

  // Handle blur - apply prefix if configured
  const handleBlur = useCallback(() => {
    if (prefix && inputValue && !inputValue.startsWith(prefix)) {
      const prefixedValue = `${prefix}${inputValue}`;
      setInputValue(prefixedValue);
      onChange(prefixedValue);
    }
    // Delay closing to allow click on dropdown items
    setTimeout(() => setOpen(false), 200);
  }, [prefix, inputValue, onChange]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setOpen(true);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="h-7 text-sm font-mono pr-6"
          />
          <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[250px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {filteredPaths.length === 0 ? (
              <CommandEmpty>
                <span className="text-xs text-muted-foreground">
                  {inputValue ? "No matching paths" : "No existing paths"}
                </span>
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Available Paths">
                {filteredPaths.slice(0, 10).map((path) => (
                  <CommandItem
                    key={path}
                    value={path}
                    onSelect={() => handleSelect(path)}
                    className="text-xs font-mono cursor-pointer"
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
                {filteredPaths.length > 10 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    ...and {filteredPaths.length - 10} more
                  </div>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
