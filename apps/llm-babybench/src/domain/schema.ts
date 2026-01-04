/**
 * BabyAI State Schema
 *
 * Zod schema definitions for BabyAI grid world state.
 */

import { z } from "zod";

// Cell types
export const CellTypeSchema = z.enum(["empty", "wall", "floor"]);
export type CellType = z.infer<typeof CellTypeSchema>;

// Object colors
export const ColorSchema = z.enum([
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "grey",
]);
export type Color = z.infer<typeof ColorSchema>;

// Object types
export const ObjectTypeSchema = z.enum(["key", "ball", "box", "door"]);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

// Grid
export const GridSchema = z.object({
  width: z.number(),
  height: z.number(),
  cells: z.array(z.array(CellTypeSchema)),
});
export type Grid = z.infer<typeof GridSchema>;

// Carried object
export const CarriedObjectSchema = z.object({
  kind: z.enum(["key", "ball", "box"]),
  color: z.string(),
});
export type CarriedObject = z.infer<typeof CarriedObjectSchema>;

// Agent
export const AgentSchema = z.object({
  x: z.number(),
  y: z.number(),
  direction: z.number(), // 0=East, 1=South, 2=West, 3=North
  carrying: CarriedObjectSchema.nullable(),
});
export type Agent = z.infer<typeof AgentSchema>;

// World object
export const WorldObjectSchema = z.object({
  id: z.string(),
  kind: z.string(),
  color: z.string(),
  x: z.number(),
  y: z.number(),
  isOpen: z.boolean().nullable().optional(),
});
export type WorldObject = z.infer<typeof WorldObjectSchema>;

// Full BabyAI state
export const BabyAIStateSchema = z.object({
  grid: GridSchema,
  agent: AgentSchema,
  objects: z.array(WorldObjectSchema),
  mission: z.string(),
  steps: z.number(),
  maxSteps: z.number(),
  goalReached: z.boolean(),
  // Re-entry markers for idempotent effects
  lastMoveIntent: z.string().nullable().default(null),
  lastPickupIntent: z.string().nullable().default(null),
  lastDropIntent: z.string().nullable().default(null),
  lastToggleIntent: z.string().nullable().default(null),
});

export type BabyAIState = z.infer<typeof BabyAIStateSchema>;

// Action types
export const BabyAIActionSchema = z.enum([
  "turnLeft",
  "turnRight",
  "moveForward",
  "pickup",
  "drop",
  "toggle",
  "done",
]);
export type BabyAIAction = z.infer<typeof BabyAIActionSchema>;
