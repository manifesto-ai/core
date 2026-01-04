/**
 * ReAct Baseline - Custom Implementation
 *
 * Implements the ReAct (Reasoning + Acting) pattern using raw OpenAI API.
 * LLM reasons about each step explicitly before taking action.
 *
 * Expected behavior: Thought → Action → Observation loop.
 * Typically more LLM calls than function calling due to explicit reasoning.
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ExperimentState, ExperimentResult, TaskCategory, OpenAIModel } from '../types';
import { createMetricsCollector, calculateCost, generateRunId, compareStates, isStateMatch } from '../measure';
import { createMCPServerInstance } from '../mcp/server';

// ============================================
// ReAct Prompt
// ============================================

const REACT_SYSTEM_PROMPT = `You are a helpful task management assistant that follows the ReAct pattern.

Available Tools:
- create_task: Create tasks. Args: { tasks: [{ title, description?, priority?, dueDate?, tags?, assignee? }] }
- list_tasks: List tasks. Args: { status?: "all"|"todo"|"in-progress"|"review"|"done", includeDeleted?: boolean }
- update_task: Update a task. Args: { id, title?, description?, priority?, dueDate?, tags?, assignee? }
- change_status: Change task status. Args: { id, status: "todo"|"in-progress"|"review"|"done" }
- bulk_change_status: Change multiple tasks' status. Args: { ids: string[], status }
- delete_task: Delete tasks. Args: { ids: string[] }
- restore_task: Restore a task. Args: { id }
- change_view: Change view mode. Args: { viewMode: "kanban"|"table"|"todo" }
- set_filter: Set filter. Args: { status?, priority? }
- clear_filter: Clear all filters. Args: {}

Use this format:

Thought: I need to understand what the user wants...
Action: tool_name
Action Input: {"arg1": "value1", ...}

Wait for Observation, then continue with next Thought/Action or give Final Answer.

When done, respond with:
Thought: I have completed the task.
Final Answer: [your response to the user]

Today: {TODAY}`;

// ============================================
// ReAct Baseline Implementation
// ============================================

export async function runReact(
  input: string,
  initialState: ExperimentState,
  model: OpenAIModel,
  taskId: string,
  taskCategory: TaskCategory
): Promise<ExperimentResult> {
  const openai = new OpenAI();
  const metrics = createMetricsCollector();
  const mcpServer = createMCPServerInstance(initialState);

  const runId = generateRunId(taskId, 'react', model, 0);
  const today = new Date().toISOString().split('T')[0];

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: REACT_SYSTEM_PROMPT.replace('{TODAY}', today) },
    { role: 'user', content: input },
  ];

  const MAX_ITERATIONS = 20;
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Get next reasoning step
      const response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: 500,
        temperature: 0,
      });

      metrics.recordLLMCall(
        model,
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0
      );

      const content = response.choices[0]?.message?.content || '';
      messages.push({ role: 'assistant', content });

      // Check for Final Answer
      if (content.includes('Final Answer:')) {
        break;
      }

      // Parse Action and Action Input (support multi-line JSON)
      const actionMatch = content.match(/Action:\s*(\w+)/);
      // Match JSON that may span multiple lines
      const actionInputMatch = content.match(/Action Input:\s*(\{[\s\S]*?\})\s*(?:\n|$)/);

      if (actionMatch && actionInputMatch) {
        const toolName = actionMatch[1];
        let toolArgs: unknown;

        try {
          toolArgs = JSON.parse(actionInputMatch[1]);
        } catch {
          // If JSON parsing fails, add error observation
          messages.push({
            role: 'user',
            content: 'Observation: Error parsing Action Input. Please provide valid JSON.',
          });
          continue;
        }

        // Execute tool
        const result = await mcpServer.executeTool(toolName, toolArgs);
        metrics.recordToolCall(toolName, toolArgs, result);

        // Add observation
        messages.push({
          role: 'user',
          content: `Observation: ${JSON.stringify(result)}`,
        });
      } else {
        // No valid action found
        messages.push({
          role: 'user',
          content: 'Observation: No valid Action found. Please follow the format: Action: tool_name followed by Action Input: {...}',
        });
      }
    }

    // Check if we hit max iterations
    if (iterations >= MAX_ITERATIONS) {
      hitMaxIterations = true;
    }

    // Finalize metrics
    const summary = metrics.finalize();
    const actualState = mcpServer.getState();
    const stateDiff = compareStates(initialState, actualState);

    // Success = completed without max iterations AND executed at least one tool
    const success = !hitMaxIterations && summary.toolCalls > 0;

    return {
      runId,
      method: 'react',
      model,
      taskId,
      taskCategory,
      llmCalls: summary.llmCalls,
      success,
      totalTokens: summary.totalTokens,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      costUsd: calculateCost(model, summary.inputTokens, summary.outputTokens),
      latencyMs: summary.latencyMs,
      toolCalls: summary.toolCalls,
      minRequiredTools: 1,
      expectedState: initialState,
      actualState,
      stateDiff,
      trace: summary.trace,
      ...(hitMaxIterations && { error: 'Hit max iterations limit', errorType: 'timeout' as const }),
    };
  } catch (error) {
    const summary = metrics.finalize();
    const actualState = mcpServer.getState();
    const stateDiff = compareStates(initialState, actualState);

    return {
      runId,
      method: 'react',
      model,
      taskId,
      taskCategory,
      llmCalls: summary.llmCalls,
      success: false,
      totalTokens: summary.totalTokens,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      costUsd: calculateCost(model, summary.inputTokens, summary.outputTokens),
      latencyMs: summary.latencyMs,
      toolCalls: summary.toolCalls,
      minRequiredTools: 1,
      expectedState: initialState,
      actualState,
      stateDiff,
      trace: summary.trace,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: 'api_error',
    };
  }
}
