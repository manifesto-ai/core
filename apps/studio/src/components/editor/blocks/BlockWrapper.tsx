"use client";

import { ReactNode } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BlockWrapperProps = {
  children: ReactNode;
  variant: "schema" | "derived" | "action" | "policy";
  hasError?: boolean;
  hasWarning?: boolean;
  isSelected?: boolean;
  onDelete?: () => void;
};

const variantStyles = {
  schema: "border-neon-cyan/30 hover:border-neon-cyan/50",
  derived: "border-neon-emerald/30 hover:border-neon-emerald/50",
  action: "border-neon-rose/30 hover:border-neon-rose/50",
  policy: "border-neon-violet/30 hover:border-neon-violet/50",
};

export function BlockWrapper({
  children,
  variant,
  hasError,
  hasWarning,
  isSelected,
  onDelete,
}: BlockWrapperProps) {
  return (
    <NodeViewWrapper className={`${variant}-block`}>
      <div
        className={cn(
          "group relative rounded-lg border bg-card transition-all",
          variantStyles[variant],
          hasError && "border-destructive",
          hasWarning && !hasError && "border-neon-amber",
          isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
      >
        {/* Drag handle */}
        <div
          className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
          data-drag-handle
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Delete button */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {children}
      </div>
    </NodeViewWrapper>
  );
}
