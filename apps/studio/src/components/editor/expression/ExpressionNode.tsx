"use client";

import { useCallback, useState } from "react";
import { Plus, X, Copy, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LiteralInput } from "./LiteralInput";
import { PathSelector } from "./PathSelector";
import { NodeTypeSelector } from "./NodeTypeSelector";
import { useExpressionClipboard } from "./ExpressionClipboard";
import { OPERATORS, CATEGORY_COLORS, createDefaultExpr } from "./operators";
import { isLiteral, isGetExpr, isOperatorExpr, getOperator, getArgs } from "./types";
import type { ExpressionNodeProps, LiteralValue, OperatorCategory } from "./types";

/**
 * ExpressionNode - Recursive component for rendering expression tree nodes
 *
 * Renders different UI based on expression type:
 * - Literal: LiteralInput
 * - Get: PathSelector
 * - Operator: OperatorNode with child ExpressionNodes
 */
export function ExpressionNode({
  expr,
  nodePath,
  onChange,
  onDelete,
  availablePaths,
  depth,
}: ExpressionNodeProps) {
  // Handler to update this node
  const handleChange = useCallback(
    (newExpr: unknown) => {
      onChange(newExpr);
    },
    [onChange]
  );

  // Handler to update a child at index
  const handleChildChange = useCallback(
    (index: number, newChildExpr: unknown) => {
      if (!isOperatorExpr(expr)) return;
      const newExpr = [...expr];
      newExpr[index + 1] = newChildExpr; // +1 because index 0 is operator
      onChange(newExpr);
    },
    [expr, onChange]
  );

  // Handler to delete a child at index
  const handleChildDelete = useCallback(
    (index: number) => {
      if (!isOperatorExpr(expr)) return;
      const newExpr = [...expr];
      newExpr.splice(index + 1, 1); // +1 because index 0 is operator
      onChange(newExpr);
    },
    [expr, onChange]
  );

  // Handler to add a new argument
  const handleAddArg = useCallback(
    (newArg: unknown) => {
      if (!isOperatorExpr(expr)) return;
      const newExpr = [...expr, newArg];
      onChange(newExpr);
    },
    [expr, onChange]
  );

  // Handler to reorder arguments (for drag & drop)
  const handleReorder = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!isOperatorExpr(expr)) return;
      const args = getArgs(expr);
      const newArgs = [...args];
      const [removed] = newArgs.splice(oldIndex, 1);
      newArgs.splice(newIndex, 0, removed);
      onChange([expr[0], ...newArgs]);
    },
    [expr, onChange]
  );

  // Render based on expression type
  if (isLiteral(expr)) {
    return (
      <LiteralNode
        value={expr}
        onChange={handleChange}
        onDelete={onDelete}
        availablePaths={availablePaths}
        depth={depth}
      />
    );
  }

  if (isGetExpr(expr)) {
    return (
      <GetNode
        path={expr[1]}
        onChange={(path) => handleChange(["get", path])}
        onDelete={onDelete}
        availablePaths={availablePaths}
        depth={depth}
      />
    );
  }

  if (isOperatorExpr(expr)) {
    const op = getOperator(expr)!;
    const args = getArgs(expr);

    return (
      <OperatorNode
        operator={op}
        args={args}
        onOperatorChange={(newOp) => {
          const newExpr = createDefaultExpr(newOp);
          handleChange(newExpr);
        }}
        onArgChange={handleChildChange}
        onArgDelete={handleChildDelete}
        onAddArg={handleAddArg}
        onReorder={handleReorder}
        onDelete={onDelete}
        availablePaths={availablePaths}
        nodePath={nodePath}
        depth={depth}
      />
    );
  }

  // Unknown/null expression - show type selector
  return (
    <EmptyNode
      onSelect={handleChange}
      onDelete={onDelete}
      availablePaths={availablePaths}
      depth={depth}
    />
  );
}

/**
 * CopyButton - Small copy button with feedback
 */
function CopyButton({ expr }: { expr: unknown }) {
  const { copy } = useExpressionClipboard();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copy(expr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }, [expr, copy]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={`h-5 w-5 p-0 ${copied ? "text-neon-emerald" : "text-muted-foreground hover:text-foreground"}`}
      title="Copy this node"
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

/**
 * LiteralNode - Renders a literal value with type toggle
 */
function LiteralNode({
  value,
  onChange,
  onDelete,
  availablePaths,
  depth,
}: {
  value: LiteralValue;
  onChange: (value: unknown) => void;
  onDelete?: () => void;
  availablePaths: string[];
  depth: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
      <NodeTypeSelector onSelect={onChange} availablePaths={availablePaths}>
        <span className="cursor-pointer hover:text-foreground text-muted-foreground text-xs">
          ▼
        </span>
      </NodeTypeSelector>
      <LiteralInput value={value} onChange={onChange as (v: LiteralValue) => void} />
      <CopyButton expr={value} />
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * GetNode - Renders a get expression with path selector
 */
function GetNode({
  path,
  onChange,
  onDelete,
  availablePaths,
  depth,
}: {
  path: string;
  onChange: (path: string) => void;
  onDelete?: () => void;
  availablePaths: string[];
  depth: number;
}) {
  // Check if path is a context variable
  const isContextVar = path.startsWith("$");
  const contextLabel =
    path === "$" ? "item" :
    path === "$index" ? "index" :
    path === "$acc" ? "acc" :
    path.startsWith("$.") ? "item" : null;

  return (
    <div className={`inline-flex items-center gap-1 rounded px-2 py-1 border ${
      isContextVar
        ? "bg-neon-violet/15 border-neon-violet/50"
        : "bg-neon-cyan/10 border-neon-cyan/30"
    }`}>
      <span className={`text-xs font-mono font-medium ${
        isContextVar ? "text-neon-violet" : "text-neon-cyan"
      }`}>get</span>
      <PathSelector
        value={path}
        onChange={onChange}
        availablePaths={availablePaths}
        placeholder="path..."
        isContextVar={isContextVar}
      />
      {contextLabel && (
        <span className="text-[10px] text-neon-violet/70 font-medium">
          {contextLabel}
        </span>
      )}
      <CopyButton expr={["get", path]} />
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * SortableArgument - Wrapper for sortable arguments in variadic operators
 */
function SortableArgument({
  id,
  children,
  showHandle,
}: {
  id: string;
  children: React.ReactNode;
  showHandle: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-1 ${isDragging ? "z-50" : ""}`}
    >
      {showHandle && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1.5 touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {children}
    </div>
  );
}

/**
 * OperatorNode - Renders an operator with its arguments
 */
function OperatorNode({
  operator,
  args,
  onOperatorChange,
  onArgChange,
  onArgDelete,
  onAddArg,
  onReorder,
  onDelete,
  availablePaths,
  nodePath,
  depth,
}: {
  operator: string;
  args: unknown[];
  onOperatorChange: (op: string) => void;
  onArgChange: (index: number, expr: unknown) => void;
  onArgDelete: (index: number) => void;
  onAddArg: (expr: unknown) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onDelete?: () => void;
  availablePaths: string[];
  nodePath: number[];
  depth: number;
}) {
  const meta = OPERATORS[operator];
  const category = meta?.category as OperatorCategory | undefined;
  const colorClass = category ? CATEGORY_COLORS[category] : "text-foreground";

  // Determine if we can add more args (variadic operators)
  const canAddArg =
    meta?.arity === "variadic" ||
    meta?.arity === "special" ||
    (typeof meta?.arity === "number" && args.length < meta.arity);

  // Determine if we can reorder args (only for variadic with 2+ args)
  const canReorder =
    (meta?.arity === "variadic" || meta?.arity === "special") &&
    args.length >= 2;

  // Border color based on depth
  const borderColors = [
    "border-neon-cyan/40",
    "border-neon-violet/40",
    "border-neon-emerald/40",
    "border-neon-amber/40",
    "border-neon-pink/40",
  ];
  const borderColor = borderColors[depth % borderColors.length];

  // Dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = args.findIndex((_, i) => `arg-${i}` === active.id);
        const newIndex = args.findIndex((_, i) => `arg-${i}` === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(oldIndex, newIndex);
        }
      }
    },
    [args, onReorder]
  );

  // Generate sortable IDs
  const sortableIds = args.map((_, i) => `arg-${i}`);

  const renderArguments = () => (
    <>
      {args.map((arg, index) => (
        <SortableArgument
          key={`arg-${index}`}
          id={`arg-${index}`}
          showHandle={canReorder}
        >
          {meta?.argLabels?.[index] && (
            <span className="text-xs text-muted-foreground mt-1.5">
              {meta.argLabels[index]}:
            </span>
          )}
          <ExpressionNode
            expr={arg}
            nodePath={[...nodePath, index + 1]}
            onChange={(newExpr) => onArgChange(index, newExpr)}
            onDelete={
              meta?.arity === "variadic" || meta?.arity === "special"
                ? () => onArgDelete(index)
                : undefined
            }
            availablePaths={availablePaths}
            depth={depth + 1}
          />
        </SortableArgument>
      ))}
    </>
  );

  return (
    <div className={`rounded border ${borderColor} bg-background/50 p-2`}>
      {/* Header with operator name */}
      <div className="flex items-center gap-2 mb-2">
        <NodeTypeSelector
          onSelect={(expr) => {
            // If selecting a new operator, replace current
            if (Array.isArray(expr) && expr.length > 0) {
              onOperatorChange(expr[0] as string);
            }
          }}
          availablePaths={availablePaths}
        >
          <span
            className={`font-mono font-medium cursor-pointer hover:underline ${colorClass}`}
          >
            {operator}
          </span>
        </NodeTypeSelector>

        {meta && (
          <span className="text-xs text-muted-foreground">{meta.name}</span>
        )}

        <div className="flex-1" />

        <CopyButton expr={[operator, ...args]} />

        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Arguments with optional drag & drop */}
      <div className="flex flex-wrap gap-2 items-start">
        {canReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={horizontalListSortingStrategy}
            >
              {renderArguments()}
            </SortableContext>
          </DndContext>
        ) : (
          args.map((arg, index) => (
            <div key={index} className="flex items-start gap-1">
              {meta?.argLabels?.[index] && (
                <span className="text-xs text-muted-foreground mt-1.5">
                  {meta.argLabels[index]}:
                </span>
              )}
              <ExpressionNode
                expr={arg}
                nodePath={[...nodePath, index + 1]}
                onChange={(newExpr) => onArgChange(index, newExpr)}
                onDelete={
                  meta?.arity === "variadic" || meta?.arity === "special"
                    ? () => onArgDelete(index)
                    : undefined
                }
                availablePaths={availablePaths}
                depth={depth + 1}
              />
            </div>
          ))
        )}

        {/* Add argument button for variadic operators */}
        {canAddArg && (
          <NodeTypeSelector onSelect={onAddArg} availablePaths={availablePaths}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </NodeTypeSelector>
        )}
      </div>
    </div>
  );
}

/**
 * EmptyNode - Placeholder for empty/null expressions
 */
function EmptyNode({
  onSelect,
  onDelete,
  availablePaths,
  depth,
}: {
  onSelect: (expr: unknown) => void;
  onDelete?: () => void;
  availablePaths: string[];
  depth: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 border border-dashed border-muted-foreground/30 rounded px-2 py-1">
      <NodeTypeSelector onSelect={onSelect} availablePaths={availablePaths}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </NodeTypeSelector>
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
