/**
 * @manifesto-ai/llm-babybench
 *
 * Dataset types for HuggingFace LLM-BabyBench.
 */

/**
 * Dataset configuration types.
 */
export type DatasetConfig = "decompose" | "plan" | "predict";

/**
 * HuggingFace dataset row structure.
 */
export interface BabyBenchRow {
  /** BabyAI level name, e.g. "BabyAI-GoToObj-v0" */
  level_name: string;

  /** Random seed */
  seed: number;

  /** Natural language environment description */
  env_description: string;

  /** Initial state as Python tuple string, e.g. "((3, 4), 3)" */
  initial_state: string;

  // decompose config fields
  /** Mission text */
  mission?: string;
  /** Number of help requests */
  help_count?: number;

  // plan config fields
  /** Target subgoal to achieve */
  target_subgoal?: string;
  /** Expert action sequence */
  expert_action_sequence?: string;

  // predict config fields
  /** Action sequence to execute */
  action_sequence?: string;
  /** Expected final state */
  target_state?: string;
}

/**
 * Dataset loading options.
 */
export interface DatasetLoadOptions {
  /** Number of rows to load (default: all) */
  limit?: number;

  /** Number of rows to skip (default: 0) */
  offset?: number;

  /** Use local cache if available */
  cache?: boolean;

  /** Filter by level name */
  levelName?: string;
}

/**
 * Dataset metadata.
 */
export interface DatasetMetadata {
  /** Total number of rows */
  totalRows: number;

  /** Available level names */
  levelNames: string[];

  /** Dataset version/timestamp */
  version: string;
}

/**
 * Parsed environment state from env_description.
 */
export interface ParsedEnvironment {
  /** Grid size (typically 8x8) */
  gridSize: { width: number; height: number };

  /** Number of rooms */
  roomCount: number;

  /** Agent initial position */
  agentPosition: { x: number; y: number };

  /** Agent facing direction */
  agentDirection: "north" | "south" | "east" | "west";

  /** Objects in the environment */
  objects: Array<{
    type: "key" | "ball" | "box";
    color: string;
    position: { x: number; y: number };
  }>;

  /** Doors in the environment */
  doors: Array<{
    color: string;
    position: { x: number; y: number };
    isOpen: boolean;
    isLocked: boolean;
  }>;

  /** Mission text */
  mission: string;
}

/**
 * Parsed initial state from initial_state string.
 */
export interface ParsedInitialState {
  x: number;
  y: number;
  direction: 0 | 1 | 2 | 3; // 0=east, 1=south, 2=west, 3=north
}
