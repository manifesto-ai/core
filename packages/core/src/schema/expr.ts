import { z } from "zod";
import { SemanticPath } from "./common.js";

/**
 * ExprNode - Pure expression language for ComputedSpec and FlowSpec
 * All expressions are deterministic and side-effect free
 */

// Forward declaration for recursive types
export type ExprNode =
  // Literals
  | LitExpr
  | GetExpr
  // Comparison
  | EqExpr
  | NeqExpr
  | GtExpr
  | GteExpr
  | LtExpr
  | LteExpr
  // Logical
  | AndExpr
  | OrExpr
  | NotExpr
  // Conditional
  | IfExpr
  // Arithmetic
  | AddExpr
  | SubExpr
  | MulExpr
  | DivExpr
  | ModExpr
  | NegExpr
  | AbsExpr
  | MinExpr
  | MaxExpr
  // v0.3.2: Array aggregation
  | SumArrayExpr
  | MinArrayExpr
  | MaxArrayExpr
  | FloorExpr
  | CeilExpr
  | RoundExpr
  | SqrtExpr
  | PowExpr
  // String
  | ConcatExpr
  | SubstringExpr
  | TrimExpr
  | ToLowerExpr
  | ToUpperExpr
  | StrLenExpr
  // Collection
  | LenExpr
  | AtExpr
  | FirstExpr
  | LastExpr
  | SliceExpr
  | IncludesExpr
  | FilterExpr
  | MapExpr
  | FindExpr
  | EveryExpr
  | SomeExpr
  | AppendExpr
  // Object
  | ObjectExpr
  | KeysExpr
  | ValuesExpr
  | EntriesExpr
  | MergeExpr
  // Type
  | TypeofExpr
  | IsNullExpr
  | CoalesceExpr
  // Conversion
  | ToStringExpr;

// ============ Literals ============

export const LitExpr = z.object({
  kind: z.literal("lit"),
  value: z.unknown(),
});
export type LitExpr = z.infer<typeof LitExpr>;

export const GetExpr = z.object({
  kind: z.literal("get"),
  path: SemanticPath,
});
export type GetExpr = z.infer<typeof GetExpr>;

// ============ Comparison ============

export const EqExpr: z.ZodType<{ kind: "eq"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("eq"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type EqExpr = z.infer<typeof EqExpr>;

export const NeqExpr: z.ZodType<{ kind: "neq"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("neq"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type NeqExpr = z.infer<typeof NeqExpr>;

export const GtExpr: z.ZodType<{ kind: "gt"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("gt"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type GtExpr = z.infer<typeof GtExpr>;

export const GteExpr: z.ZodType<{ kind: "gte"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("gte"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type GteExpr = z.infer<typeof GteExpr>;

export const LtExpr: z.ZodType<{ kind: "lt"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("lt"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type LtExpr = z.infer<typeof LtExpr>;

export const LteExpr: z.ZodType<{ kind: "lte"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("lte"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type LteExpr = z.infer<typeof LteExpr>;

// ============ Logical ============

export const AndExpr: z.ZodType<{ kind: "and"; args: ExprNode[] }> = z.object({
  kind: z.literal("and"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type AndExpr = z.infer<typeof AndExpr>;

export const OrExpr: z.ZodType<{ kind: "or"; args: ExprNode[] }> = z.object({
  kind: z.literal("or"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type OrExpr = z.infer<typeof OrExpr>;

export const NotExpr: z.ZodType<{ kind: "not"; arg: ExprNode }> = z.object({
  kind: z.literal("not"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type NotExpr = z.infer<typeof NotExpr>;

// ============ Conditional ============

export const IfExpr: z.ZodType<{ kind: "if"; cond: ExprNode; then: ExprNode; else: ExprNode }> = z.object({
  kind: z.literal("if"),
  cond: z.lazy(() => ExprNodeSchema),
  then: z.lazy(() => ExprNodeSchema),
  else: z.lazy(() => ExprNodeSchema),
});
export type IfExpr = z.infer<typeof IfExpr>;

// ============ Arithmetic ============

export const AddExpr: z.ZodType<{ kind: "add"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("add"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type AddExpr = z.infer<typeof AddExpr>;

export const SubExpr: z.ZodType<{ kind: "sub"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("sub"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type SubExpr = z.infer<typeof SubExpr>;

export const MulExpr: z.ZodType<{ kind: "mul"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("mul"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type MulExpr = z.infer<typeof MulExpr>;

export const DivExpr: z.ZodType<{ kind: "div"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("div"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type DivExpr = z.infer<typeof DivExpr>;

export const ModExpr: z.ZodType<{ kind: "mod"; left: ExprNode; right: ExprNode }> = z.object({
  kind: z.literal("mod"),
  left: z.lazy(() => ExprNodeSchema),
  right: z.lazy(() => ExprNodeSchema),
});
export type ModExpr = z.infer<typeof ModExpr>;

export const NegExpr: z.ZodType<{ kind: "neg"; arg: ExprNode }> = z.object({
  kind: z.literal("neg"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type NegExpr = z.infer<typeof NegExpr>;

export const AbsExpr: z.ZodType<{ kind: "abs"; arg: ExprNode }> = z.object({
  kind: z.literal("abs"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type AbsExpr = z.infer<typeof AbsExpr>;

export const MinExpr: z.ZodType<{ kind: "min"; args: ExprNode[] }> = z.object({
  kind: z.literal("min"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type MinExpr = z.infer<typeof MinExpr>;

export const MaxExpr: z.ZodType<{ kind: "max"; args: ExprNode[] }> = z.object({
  kind: z.literal("max"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type MaxExpr = z.infer<typeof MaxExpr>;

// v0.3.2: Array aggregation expressions
export const SumArrayExpr: z.ZodType<{ kind: "sumArray"; array: ExprNode }> = z.object({
  kind: z.literal("sumArray"),
  array: z.lazy(() => ExprNodeSchema),
});
export type SumArrayExpr = z.infer<typeof SumArrayExpr>;

export const MinArrayExpr: z.ZodType<{ kind: "minArray"; array: ExprNode }> = z.object({
  kind: z.literal("minArray"),
  array: z.lazy(() => ExprNodeSchema),
});
export type MinArrayExpr = z.infer<typeof MinArrayExpr>;

export const MaxArrayExpr: z.ZodType<{ kind: "maxArray"; array: ExprNode }> = z.object({
  kind: z.literal("maxArray"),
  array: z.lazy(() => ExprNodeSchema),
});
export type MaxArrayExpr = z.infer<typeof MaxArrayExpr>;

export const FloorExpr: z.ZodType<{ kind: "floor"; arg: ExprNode }> = z.object({
  kind: z.literal("floor"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type FloorExpr = z.infer<typeof FloorExpr>;

export const CeilExpr: z.ZodType<{ kind: "ceil"; arg: ExprNode }> = z.object({
  kind: z.literal("ceil"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type CeilExpr = z.infer<typeof CeilExpr>;

export const RoundExpr: z.ZodType<{ kind: "round"; arg: ExprNode }> = z.object({
  kind: z.literal("round"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type RoundExpr = z.infer<typeof RoundExpr>;

export const SqrtExpr: z.ZodType<{ kind: "sqrt"; arg: ExprNode }> = z.object({
  kind: z.literal("sqrt"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type SqrtExpr = z.infer<typeof SqrtExpr>;

export const PowExpr: z.ZodType<{ kind: "pow"; base: ExprNode; exponent: ExprNode }> = z.object({
  kind: z.literal("pow"),
  base: z.lazy(() => ExprNodeSchema),
  exponent: z.lazy(() => ExprNodeSchema),
});
export type PowExpr = z.infer<typeof PowExpr>;

// ============ String ============

export const ConcatExpr: z.ZodType<{ kind: "concat"; args: ExprNode[] }> = z.object({
  kind: z.literal("concat"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type ConcatExpr = z.infer<typeof ConcatExpr>;

export const SubstringExpr: z.ZodType<{ kind: "substring"; str: ExprNode; start: ExprNode; end?: ExprNode }> = z.object({
  kind: z.literal("substring"),
  str: z.lazy(() => ExprNodeSchema),
  start: z.lazy(() => ExprNodeSchema),
  end: z.lazy(() => ExprNodeSchema).optional(),
});
export type SubstringExpr = z.infer<typeof SubstringExpr>;

export const TrimExpr: z.ZodType<{ kind: "trim"; str: ExprNode }> = z.object({
  kind: z.literal("trim"),
  str: z.lazy(() => ExprNodeSchema),
});
export type TrimExpr = z.infer<typeof TrimExpr>;

export const ToLowerExpr: z.ZodType<{ kind: "toLowerCase"; str: ExprNode }> = z.object({
  kind: z.literal("toLowerCase"),
  str: z.lazy(() => ExprNodeSchema),
});
export type ToLowerExpr = z.infer<typeof ToLowerExpr>;

export const ToUpperExpr: z.ZodType<{ kind: "toUpperCase"; str: ExprNode }> = z.object({
  kind: z.literal("toUpperCase"),
  str: z.lazy(() => ExprNodeSchema),
});
export type ToUpperExpr = z.infer<typeof ToUpperExpr>;

export const StrLenExpr: z.ZodType<{ kind: "strLen"; str: ExprNode }> = z.object({
  kind: z.literal("strLen"),
  str: z.lazy(() => ExprNodeSchema),
});
export type StrLenExpr = z.infer<typeof StrLenExpr>;

// ============ Collection ============

export const LenExpr: z.ZodType<{ kind: "len"; arg: ExprNode }> = z.object({
  kind: z.literal("len"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type LenExpr = z.infer<typeof LenExpr>;

export const AtExpr: z.ZodType<{ kind: "at"; array: ExprNode; index: ExprNode }> = z.object({
  kind: z.literal("at"),
  array: z.lazy(() => ExprNodeSchema),
  index: z.lazy(() => ExprNodeSchema),
});
export type AtExpr = z.infer<typeof AtExpr>;

export const FirstExpr: z.ZodType<{ kind: "first"; array: ExprNode }> = z.object({
  kind: z.literal("first"),
  array: z.lazy(() => ExprNodeSchema),
});
export type FirstExpr = z.infer<typeof FirstExpr>;

export const LastExpr: z.ZodType<{ kind: "last"; array: ExprNode }> = z.object({
  kind: z.literal("last"),
  array: z.lazy(() => ExprNodeSchema),
});
export type LastExpr = z.infer<typeof LastExpr>;

export const SliceExpr: z.ZodType<{ kind: "slice"; array: ExprNode; start: ExprNode; end?: ExprNode }> = z.object({
  kind: z.literal("slice"),
  array: z.lazy(() => ExprNodeSchema),
  start: z.lazy(() => ExprNodeSchema),
  end: z.lazy(() => ExprNodeSchema).optional(),
});
export type SliceExpr = z.infer<typeof SliceExpr>;

export const IncludesExpr: z.ZodType<{ kind: "includes"; array: ExprNode; item: ExprNode }> = z.object({
  kind: z.literal("includes"),
  array: z.lazy(() => ExprNodeSchema),
  item: z.lazy(() => ExprNodeSchema),
});
export type IncludesExpr = z.infer<typeof IncludesExpr>;

export const FilterExpr: z.ZodType<{ kind: "filter"; array: ExprNode; predicate: ExprNode }> = z.object({
  kind: z.literal("filter"),
  array: z.lazy(() => ExprNodeSchema),
  predicate: z.lazy(() => ExprNodeSchema),
});
export type FilterExpr = z.infer<typeof FilterExpr>;

export const MapExpr: z.ZodType<{ kind: "map"; array: ExprNode; mapper: ExprNode }> = z.object({
  kind: z.literal("map"),
  array: z.lazy(() => ExprNodeSchema),
  mapper: z.lazy(() => ExprNodeSchema),
});
export type MapExpr = z.infer<typeof MapExpr>;

export const FindExpr: z.ZodType<{ kind: "find"; array: ExprNode; predicate: ExprNode }> = z.object({
  kind: z.literal("find"),
  array: z.lazy(() => ExprNodeSchema),
  predicate: z.lazy(() => ExprNodeSchema),
});
export type FindExpr = z.infer<typeof FindExpr>;

export const EveryExpr: z.ZodType<{ kind: "every"; array: ExprNode; predicate: ExprNode }> = z.object({
  kind: z.literal("every"),
  array: z.lazy(() => ExprNodeSchema),
  predicate: z.lazy(() => ExprNodeSchema),
});
export type EveryExpr = z.infer<typeof EveryExpr>;

export const SomeExpr: z.ZodType<{ kind: "some"; array: ExprNode; predicate: ExprNode }> = z.object({
  kind: z.literal("some"),
  array: z.lazy(() => ExprNodeSchema),
  predicate: z.lazy(() => ExprNodeSchema),
});
export type SomeExpr = z.infer<typeof SomeExpr>;

export const AppendExpr: z.ZodType<{ kind: "append"; array: ExprNode; items: ExprNode[] }> = z.object({
  kind: z.literal("append"),
  array: z.lazy(() => ExprNodeSchema),
  items: z.array(z.lazy(() => ExprNodeSchema)),
});
export type AppendExpr = z.infer<typeof AppendExpr>;

// ============ Object ============

export const ObjectExpr: z.ZodType<{ kind: "object"; fields: Record<string, ExprNode> }> = z.object({
  kind: z.literal("object"),
  fields: z.record(z.string(), z.lazy(() => ExprNodeSchema)),
}) as z.ZodType<{ kind: "object"; fields: Record<string, ExprNode> }>;
export type ObjectExpr = z.infer<typeof ObjectExpr>;

export const KeysExpr: z.ZodType<{ kind: "keys"; obj: ExprNode }> = z.object({
  kind: z.literal("keys"),
  obj: z.lazy(() => ExprNodeSchema),
});
export type KeysExpr = z.infer<typeof KeysExpr>;

export const ValuesExpr: z.ZodType<{ kind: "values"; obj: ExprNode }> = z.object({
  kind: z.literal("values"),
  obj: z.lazy(() => ExprNodeSchema),
});
export type ValuesExpr = z.infer<typeof ValuesExpr>;

export const EntriesExpr: z.ZodType<{ kind: "entries"; obj: ExprNode }> = z.object({
  kind: z.literal("entries"),
  obj: z.lazy(() => ExprNodeSchema),
});
export type EntriesExpr = z.infer<typeof EntriesExpr>;

export const MergeExpr: z.ZodType<{ kind: "merge"; objects: ExprNode[] }> = z.object({
  kind: z.literal("merge"),
  objects: z.array(z.lazy(() => ExprNodeSchema)),
});
export type MergeExpr = z.infer<typeof MergeExpr>;

// ============ Type ============

export const TypeofExpr: z.ZodType<{ kind: "typeof"; arg: ExprNode }> = z.object({
  kind: z.literal("typeof"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type TypeofExpr = z.infer<typeof TypeofExpr>;

export const IsNullExpr: z.ZodType<{ kind: "isNull"; arg: ExprNode }> = z.object({
  kind: z.literal("isNull"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type IsNullExpr = z.infer<typeof IsNullExpr>;

export const CoalesceExpr: z.ZodType<{ kind: "coalesce"; args: ExprNode[] }> = z.object({
  kind: z.literal("coalesce"),
  args: z.array(z.lazy(() => ExprNodeSchema)),
});
export type CoalesceExpr = z.infer<typeof CoalesceExpr>;

// ============ Conversion ============

export const ToStringExpr: z.ZodType<{ kind: "toString"; arg: ExprNode }> = z.object({
  kind: z.literal("toString"),
  arg: z.lazy(() => ExprNodeSchema),
});
export type ToStringExpr = z.infer<typeof ToStringExpr>;

// ============ Combined Schema ============

export const ExprNodeSchema: z.ZodType<ExprNode> = z.union([
  // Literals
  LitExpr,
  GetExpr,
  // Comparison
  EqExpr,
  NeqExpr,
  GtExpr,
  GteExpr,
  LtExpr,
  LteExpr,
  // Logical
  AndExpr,
  OrExpr,
  NotExpr,
  // Conditional
  IfExpr,
  // Arithmetic
  AddExpr,
  SubExpr,
  MulExpr,
  DivExpr,
  ModExpr,
  NegExpr,
  AbsExpr,
  MinExpr,
  MaxExpr,
  // v0.3.2: Array aggregation
  SumArrayExpr,
  MinArrayExpr,
  MaxArrayExpr,
  FloorExpr,
  CeilExpr,
  RoundExpr,
  SqrtExpr,
  PowExpr,
  // String
  ConcatExpr,
  SubstringExpr,
  TrimExpr,
  ToLowerExpr,
  ToUpperExpr,
  StrLenExpr,
  // Collection
  LenExpr,
  AtExpr,
  FirstExpr,
  LastExpr,
  SliceExpr,
  IncludesExpr,
  FilterExpr,
  MapExpr,
  FindExpr,
  EveryExpr,
  SomeExpr,
  AppendExpr,
  // Object
  ObjectExpr,
  KeysExpr,
  ValuesExpr,
  EntriesExpr,
  MergeExpr,
  // Type
  TypeofExpr,
  IsNullExpr,
  CoalesceExpr,
  // Conversion
  ToStringExpr,
]) as z.ZodType<ExprNode>;

/**
 * Expression kinds enum for pattern matching
 */
export const ExprKind = z.enum([
  "lit", "get",
  "eq", "neq", "gt", "gte", "lt", "lte",
  "and", "or", "not",
  "if",
  "add", "sub", "mul", "div", "mod", "neg", "abs", "min", "max",
  "sumArray", "minArray", "maxArray",  // v0.3.2: Array aggregation
  "floor", "ceil", "round", "sqrt", "pow",
  "concat", "substring", "trim", "toLowerCase", "toUpperCase", "strLen",
  "len", "at", "first", "last", "slice", "includes", "filter", "map", "find", "every", "some", "append",
  "object", "keys", "values", "entries", "merge",
  "typeof", "isNull", "coalesce",
  "toString",
]);
export type ExprKind = z.infer<typeof ExprKind>;
