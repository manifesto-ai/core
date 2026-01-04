#!/usr/bin/env npx tsx
/**
 * Interactive BabyAI Mode
 *
 * Watch the grid world in real-time and optionally control the agent manually.
 *
 * Usage:
 *   npx tsx examples/interactive-mode.ts              # Human control
 *   npx tsx examples/interactive-mode.ts --actor bfs  # Watch BFS actor
 *   npx tsx examples/interactive-mode.ts --actor llm  # Watch LLM actor
 *   npx tsx examples/interactive-mode.ts --task 5     # Use task index 5
 *
 * Controls (human mode):
 *   W/Arrow Up: moveForward
 *   A/Arrow Left: turnLeft
 *   D/Arrow Right: turnRight
 *   P: pickup
 *   O: drop
 *   T: toggle (open door)
 *   Q: quit
 *
 * Controls (actor mode):
 *   Space: step once
 *   Enter: auto-run
 *   H: take over (HITL)
 *   Q: quit
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env.local") });

import { parseArgs } from "util";
import * as readline from "readline";
import {
  createTask,
  type TaskContext,
  type BenchTask,
} from "../src/bench/index.js";
import { createBFSActor, createLLMActor, createHybridActor } from "../src/actors/index.js";
import { loadDataset } from "../src/dataset/index.js";
import { createBenchWorld, createTaskSnapshot, registerActor } from "../src/bench/setup.js";
import { createIntentInstance, type WorldId } from "@manifesto-ai/world";
import type { BabyAIState, BabyAIAction } from "../src/domain/index.js";
import type { Actor } from "../src/bench/index.js";

// =============================================================================
// Grid Renderer
// =============================================================================

const DIRECTION_ARROWS = ["→", "↓", "←", "↑"]; // East, South, West, North
const COLORS: Record<string, string> = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  purple: "\x1b[35m",
  grey: "\x1b[90m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const BG_GREEN = "\x1b[42m";

function renderGrid(state: BabyAIState): string {
  const { grid, agent, objects } = state;
  const lines: string[] = [];

  // Header with coordinates
  let header = "   ";
  for (let x = 0; x < grid.width; x++) {
    header += (x % 10) + " ";
  }
  lines.push(header);

  lines.push("  ┌" + "─".repeat(grid.width * 2) + "┐");

  for (let y = 0; y < grid.height; y++) {
    let row = (y % 10) + " │";
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y]?.[x];

      // Check if agent is here
      if (agent.x === x && agent.y === y) {
        const arrow = DIRECTION_ARROWS[agent.direction];
        row += BG_GREEN + BOLD + arrow + RESET + " ";
        continue;
      }

      // Check for object
      const obj = objects.find((o) => o.x === x && o.y === y);
      if (obj) {
        const color = COLORS[obj.color] || "";
        let symbol = "?";
        switch (obj.type) {
          case "key": symbol = "K"; break;
          case "ball": symbol = "O"; break;
          case "box": symbol = "B"; break;
          case "door": symbol = obj.isOpen ? "░" : "D"; break;
        }
        row += color + symbol + RESET + " ";
        continue;
      }

      // Empty cell or wall
      if (cell === "wall") {
        row += "█ ";
      } else if (cell === "floor") {
        row += ". ";
      } else {
        row += "  ";
      }
    }
    row += "│";
    lines.push(row);
  }

  lines.push("  └" + "─".repeat(grid.width * 2) + "┘");

  return lines.join("\n");
}

function renderLegend(): string {
  return [
    "Legend: → Agent   █ Wall   . Floor",
    `        ${COLORS.red}K${RESET} Key     ${COLORS.blue}O${RESET} Ball   ${COLORS.green}B${RESET} Box`,
    `        D Door(closed)  ░ Door(open)`,
  ].join("\n");
}

function renderStatus(state: BabyAIState, task: BenchTask): string {
  const lines: string[] = [];
  lines.push(`Mission: ${BOLD}${state.mission}${RESET}`);
  lines.push(`Steps: ${state.steps}/${state.maxSteps}`);
  lines.push(`Position: (${state.agent.x}, ${state.agent.y}) facing ${["East", "South", "West", "North"][state.agent.direction]}`);
  if (state.agent.carrying) {
    lines.push(`Carrying: ${COLORS[state.agent.carrying.color] || ""}${state.agent.carrying.color} ${state.agent.carrying.type}${RESET}`);
  }
  if (state.goalReached) {
    lines.push(`${BG_GREEN}${BOLD} ★ GOAL REACHED! ★ ${RESET}`);
  }
  return lines.join("\n");
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function render(state: BabyAIState, task: BenchTask, mode: string, message?: string, isHitl = false) {
  clearScreen();
  console.log("═".repeat(60));
  console.log(`  BabyAI Interactive Mode [${mode}]${isHitl ? " - HITL ACTIVE" : ""}`);
  console.log("═".repeat(60));
  console.log();
  console.log(renderGrid(state));
  console.log();
  console.log(renderLegend());
  console.log();
  console.log("─".repeat(60));
  console.log(renderStatus(state, task));
  console.log("─".repeat(60));

  if (message) {
    console.log();
    console.log(`> ${message}`);
  }
  console.log();

  if (mode === "human" || isHitl) {
    console.log("Controls: W/↑=forward  A/←=left  D/→=right");
    console.log("          P=pickup  O=drop  T=toggle  Q=quit");
    if (isHitl) {
      console.log("          R=return to actor");
    }
  } else {
    console.log("Controls: Space=step  Enter=auto-run  H=HITL  Q=quit");
  }
}

// =============================================================================
// Interactive Runner
// =============================================================================

interface InteractiveConfig {
  mode: "human" | "bfs" | "llm" | "hybrid";
  model: string;
  taskIndex: number;
  stepDelay: number;
  datasetConfig: "predict" | "plan";
  autoStart: boolean;
  maxSteps: number;
}

function parseConfig(): InteractiveConfig {
  const { values } = parseArgs({
    options: {
      actor: { type: "string", short: "a", default: "human" },
      model: { type: "string", short: "m", default: "gpt-4o-mini" },
      task: { type: "string", short: "t", default: "0" },
      delay: { type: "string", short: "d", default: "300" },
      config: { type: "string", short: "c", default: "predict" },
      auto: { type: "boolean", default: false },
      steps: { type: "string", short: "s", default: "0" },
    },
  });

  return {
    mode: values.actor as InteractiveConfig["mode"],
    model: values.model as string,
    taskIndex: parseInt(values.task as string, 10),
    stepDelay: parseInt(values.delay as string, 10),
    datasetConfig: values.config as "predict" | "plan",
    autoStart: values.auto as boolean,
    maxSteps: parseInt(values.steps as string, 10),
  };
}

async function runInteractive() {
  const config = parseConfig();

  // Load a task
  console.log("Loading dataset...");
  const rows = await loadDataset(config.datasetConfig, { limit: config.taskIndex + 1 });
  if (rows.length <= config.taskIndex) {
    console.error(`Task ${config.taskIndex} not found`);
    process.exit(1);
  }

  const row = rows[config.taskIndex];
  const task = createTask(row, config.datasetConfig);

  // Create world
  const { world, schemaHash } = createBenchWorld(task.initialState);
  registerActor(world, "interactive-agent");

  // Create genesis
  const initialSnapshot = createTaskSnapshot(task.initialState);
  const genesis = await world.createGenesis(initialSnapshot);
  let currentWorldId = genesis.worldId as WorldId;

  // Get initial state
  const getState = async (): Promise<BabyAIState> => {
    const snapshot = await world.getSnapshot(currentWorldId);
    return snapshot!.data as BabyAIState;
  };

  let state = await getState();

  // Create actor (if not human mode)
  let actor: Actor | null = null;
  if (config.mode !== "human") {
    switch (config.mode) {
      case "bfs":
        actor = createBFSActor({ debug: false });
        break;
      case "llm":
        actor = createLLMActor({ model: config.model, debug: false });
        break;
      case "hybrid":
        actor = createHybridActor({ model: config.model, debug: false });
        break;
    }
  }

  // Setup keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let running = true;
  let autoRun = false;
  let hitlMode = config.mode === "human";
  let lastMessage = "";
  let stepCount = 0;

  const executeAction = async (action: BabyAIAction): Promise<boolean> => {
    if (action === "done" || state.goalReached || state.steps >= state.maxSteps) {
      return false;
    }

    try {
      const intent = await createIntentInstance({
        body: { type: action, input: {} },
        schemaHash,
        projectionId: "interactive",
        source: { kind: "agent", eventId: `step-${stepCount}` },
        actor: { actorId: "interactive-agent", kind: "agent" },
      });

      const result = await world.submitProposal("interactive-agent", intent, currentWorldId);

      if (result.resultWorld) {
        currentWorldId = result.resultWorld.worldId as WorldId;
        state = await getState();
        stepCount++;
        lastMessage = `✓ ${action}`;
        return true;
      } else {
        const errorMsg = result.error?.message ??
          (result.decision?.decision.kind === "rejected"
            ? (result.decision.decision as { reason: string }).reason
            : "unknown");
        lastMessage = `✗ ${action} rejected: ${errorMsg}`;
        return false;
      }
    } catch (error) {
      lastMessage = `✗ Error: ${error}`;
      return false;
    }
  };

  const actorStep = async (): Promise<boolean> => {
    if (!actor) return false;
    if (state.goalReached || state.steps >= state.maxSteps) {
      return false;
    }

    const context: TaskContext = {
      task,
      step: stepCount,
      availableActions: ["turnLeft", "turnRight", "moveForward", "pickup", "drop", "toggle", "done"],
    };

    const proposal = await actor.proposeAction(state, context);

    if (proposal.action === "done") {
      lastMessage = "Actor declared done";
      return false;
    }

    lastMessage = `Actor: ${proposal.action}${proposal.reasoning ? ` (${proposal.reasoning})` : ""}`;
    return await executeAction(proposal.action);
  };

  // Initial render
  render(state, task, config.mode, "Press any key to start...");

  process.stdin.on("keypress", async (str, key) => {
    if (!running) return;

    // Quit
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      running = false;
      autoRun = false;
      process.stdin.setRawMode(false);
      clearScreen();
      console.log("\n👋 Bye!\n");
      console.log(`Final: ${state.goalReached ? "SUCCESS" : "INCOMPLETE"} in ${stepCount} steps\n`);
      process.exit(0);
    }

    // HITL mode controls (human or actor in HITL)
    if (hitlMode) {
      let action: BabyAIAction | null = null;

      switch (key.name) {
        case "w":
        case "up":
          action = "moveForward";
          break;
        case "a":
        case "left":
          action = "turnLeft";
          break;
        case "d":
        case "right":
          action = "turnRight";
          break;
        case "p":
          action = "pickup";
          break;
        case "o":
          action = "drop";
          break;
        case "t":
          action = "toggle";
          break;
        case "r":
          // Return to actor mode
          if (config.mode !== "human" && actor) {
            hitlMode = false;
            lastMessage = "Returning control to actor...";
            render(state, task, config.mode, lastMessage, false);
          }
          return;
      }

      if (action) {
        await executeAction(action);
        render(state, task, config.mode, lastMessage, hitlMode && config.mode !== "human");
      }
    } else {
      // Actor mode controls
      if (key.name === "space") {
        // Single step
        autoRun = false;
        await actorStep();
        render(state, task, config.mode, lastMessage);
      } else if (key.name === "return") {
        // Toggle auto-run
        autoRun = !autoRun;

        if (autoRun) {
          lastMessage = "▶ Auto-running...";
          render(state, task, config.mode, lastMessage);

          while (autoRun && running && !state.goalReached && state.steps < state.maxSteps) {
            const continued = await actorStep();
            render(state, task, config.mode, lastMessage);

            if (!continued) break;
            await new Promise((r) => setTimeout(r, config.stepDelay));
          }

          autoRun = false;
          if (state.goalReached) {
            lastMessage = "🎉 Goal reached!";
          } else if (state.steps >= state.maxSteps) {
            lastMessage = "⏱ Max steps reached";
          } else {
            lastMessage = "⏸ Stopped";
          }
          render(state, task, config.mode, lastMessage);
        } else {
          lastMessage = "⏸ Paused";
          render(state, task, config.mode, lastMessage);
        }
      } else if (key.name === "h") {
        // Enter HITL mode
        hitlMode = true;
        autoRun = false;
        lastMessage = "🎮 HITL mode activated - you have control!";
        render(state, task, config.mode, lastMessage, true);
      }
    }
  });

  // Auto-start mode (for non-interactive testing)
  if (config.autoStart && config.mode !== "human" && actor) {
    render(state, task, config.mode, "▶ Auto-starting...");
    await new Promise((r) => setTimeout(r, 500));

    const maxAutoSteps = config.maxSteps > 0 ? config.maxSteps : state.maxSteps;
    let autoStepCount = 0;

    while (running && !state.goalReached && state.steps < state.maxSteps && autoStepCount < maxAutoSteps) {
      const continued = await actorStep();
      render(state, task, config.mode, lastMessage);

      if (!continued) break;
      autoStepCount++;
      await new Promise((r) => setTimeout(r, config.stepDelay));
    }

    // Print final result
    clearScreen();
    console.log("═".repeat(60));
    console.log("  BabyAI Interactive Mode - COMPLETED");
    console.log("═".repeat(60));
    console.log();
    console.log(renderGrid(state));
    console.log();
    console.log(`Mission: ${state.mission}`);
    console.log(`Result: ${state.goalReached ? "✅ SUCCESS" : "❌ INCOMPLETE"}`);
    console.log(`Steps: ${stepCount}/${state.maxSteps}`);
    console.log();
    process.exit(state.goalReached ? 0 : 1);
  }

  // Keep process alive
  await new Promise(() => {});
}

runInteractive().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
