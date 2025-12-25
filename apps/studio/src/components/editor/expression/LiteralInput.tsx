"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LiteralInputProps, LiteralValue } from "./types";

/**
 * LiteralInput - Input for literal values (string, number, boolean, null)
 *
 * Renders different UI based on value type:
 * - string: text input
 * - number: number input
 * - boolean: toggle button
 * - null: null indicator with type selector
 */
export function LiteralInput({ value, onChange, className }: LiteralInputProps) {
  const [inputValue, setInputValue] = useState(() => {
    if (value === null) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  });

  const valueType = getValueType(value);

  const handleChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);

      // Try to parse as number first if it looks like a number
      if (/^-?\d+(\.\d+)?$/.test(newValue)) {
        const num = parseFloat(newValue);
        if (!isNaN(num)) {
          onChange(num);
          return;
        }
      }

      // Boolean
      if (newValue === "true") {
        onChange(true);
        return;
      }
      if (newValue === "false") {
        onChange(false);
        return;
      }

      // Null
      if (newValue === "" || newValue === "null") {
        onChange(null);
        return;
      }

      // String
      onChange(newValue);
    },
    [onChange]
  );

  const handleTypeToggle = useCallback(() => {
    // Cycle through types: string -> number -> boolean -> null -> string
    if (valueType === "string") {
      const num = parseFloat(inputValue);
      if (!isNaN(num)) {
        onChange(num);
      } else {
        onChange(0);
        setInputValue("0");
      }
    } else if (valueType === "number") {
      onChange(true);
      setInputValue("true");
    } else if (valueType === "boolean") {
      onChange(null);
      setInputValue("");
    } else {
      onChange("");
      setInputValue("");
    }
  }, [valueType, inputValue, onChange]);

  const handleBooleanToggle = useCallback(() => {
    if (typeof value === "boolean") {
      onChange(!value);
      setInputValue(!value ? "true" : "false");
    }
  }, [value, onChange]);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleTypeToggle}
        className="h-6 w-6 p-0 text-xs font-mono text-muted-foreground hover:text-foreground"
        title={`Type: ${valueType} (click to change)`}
      >
        {getTypeIcon(valueType)}
      </Button>

      {valueType === "boolean" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBooleanToggle}
          className={`h-7 min-w-[60px] text-xs ${
            value === true
              ? "bg-neon-emerald/20 text-neon-emerald border-neon-emerald/50"
              : "bg-destructive/20 text-destructive border-destructive/50"
          }`}
        >
          {value === true ? "true" : "false"}
        </Button>
      ) : valueType === "null" ? (
        <span className="text-xs text-muted-foreground italic px-2">null</span>
      ) : (
        <Input
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          className="h-7 text-xs font-mono min-w-[80px]"
          placeholder={valueType === "number" ? "0" : "value"}
          type={valueType === "number" ? "number" : "text"}
        />
      )}
    </div>
  );
}

function getValueType(value: LiteralValue): "string" | "number" | "boolean" | "null" {
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "string";
}

function getTypeIcon(type: "string" | "number" | "boolean" | "null"): string {
  switch (type) {
    case "string":
      return "S";
    case "number":
      return "#";
    case "boolean":
      return "?";
    case "null":
      return "∅";
  }
}
