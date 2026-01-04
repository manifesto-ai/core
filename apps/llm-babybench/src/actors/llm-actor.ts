/**
 * LLM Actor - Full LLM-based decision making
 *
 * Uses LLM for every action decision.
 * This is the "naive" approach that uses LLM excessively.
 */

import OpenAI from "openai";
import type { Actor, ActorProposal, TaskContext } from "../bench/index.js";
import type { BabyAIState, BabyAIAction } from "../domain/index.js";

// =============================================================================
// Types
// =============================================================================

export interface LLMActorOptions {
  /** OpenAI model to use */
  model?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Debug mode */
  debug?: boolean;
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildSystemPrompt(): string {
  return `You are a BabyAI agent navigating a grid world to complete missions.

The grid uses a coordinate system where:
- Direction 0 = East (right, +x)
- Direction 1 = South (down, +y)
- Direction 2 = West (left, -x)
- Direction 3 = North (up, -y)

Available actions:
- turnLeft: Rotate 90 degrees counter-clockwise
- turnRight: Rotate 90 degrees clockwise
- moveForward: Move one cell in facing direction
- pickup: Pick up object in front
- drop: Drop carried object in front
- toggle: Toggle door in front
- done: Mark task as complete

Respond with a JSON object: {"action": "...", "reasoning": "..."}`;
}

function buildUserPrompt(state: BabyAIState, context: TaskContext): string {
  const { agent, objects, mission, steps, maxSteps } = state;
  const directions = ["East", "South", "West", "North"];

  const objectList = objects
    .map((o) => `- ${o.color} ${o.kind} at (${o.x}, ${o.y})${o.kind === "door" ? (o.isOpen ? " [open]" : " [closed]") : ""}`)
    .join("\n");

  return `## Current State
Agent Position: (${agent.x}, ${agent.y})
Agent Direction: ${directions[agent.direction]} (${agent.direction})
Carrying: ${agent.carrying ? `${agent.carrying.color} ${agent.carrying.kind}` : "nothing"}
Step: ${steps}/${maxSteps}

## Objects in World
${objectList || "No objects"}

## Mission
${mission}

## Available Actions
${context.availableActions.join(", ")}

Choose the best action to complete the mission.`;
}

// =============================================================================
// LLM Actor
// =============================================================================

export function createLLMActor(options: LLMActorOptions = {}): Actor {
  const { model = "gpt-4o-mini", temperature = 0.2, debug = false } = options;
  const client = new OpenAI();

  return {
    id: `llm-${model}`,

    async proposeAction(
      state: BabyAIState,
      context: TaskContext
    ): Promise<ActorProposal> {
      try {
        const response = await client.chat.completions.create({
          model,
          temperature,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(state, context) },
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content) as {
          action?: string;
          reasoning?: string;
        };

        if (debug) {
          console.log(`[LLM] Response: ${content}`);
        }

        const action = result.action as BabyAIAction;

        // Validate action
        if (!context.availableActions.includes(action)) {
          if (debug) {
            console.log(`[LLM] Invalid action: ${action}, defaulting to turnRight`);
          }
          return {
            action: "turnRight",
            reasoning: `LLM returned invalid action: ${action}`,
          };
        }

        return {
          action,
          reasoning: result.reasoning,
        };
      } catch (error) {
        if (debug) {
          console.error(`[LLM] Error:`, error);
        }
        return {
          action: "done",
          reasoning: `LLM error: ${error}`,
        };
      }
    },

    reset() {
      // No state to reset
    },
  };
}
