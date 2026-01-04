/**
 * BabyBench Actors Module
 *
 * Provides different actor implementations:
 * - BFS Actor: Deterministic pathfinding (no LLM)
 * - LLM Actor: Full LLM decision making (every step)
 * - Hybrid Actor: LLM planning + BFS execution
 */

export { createBFSActor, type BFSActorOptions } from "./bfs-actor.js";
export { createLLMActor, type LLMActorOptions } from "./llm-actor.js";
export { createHybridActor, type HybridActorOptions } from "./hybrid-actor.js";
