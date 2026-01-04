/**
 * OpenAI Functions Baseline
 *
 * Uses OpenAI's function calling API with tool_choice: "auto".
 * LLM decides which tools to call and when to stop.
 *
 * Expected behavior: Multiple LLM calls in a loop until task is complete.
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { ExperimentState, ExperimentResult, TaskCategory, OpenAIModel } from '../types';
import { createMetricsCollector, calculateCost, generateRunId, compareStates, isStateMatch } from '../measure';
import { createMCPServerInstance } from '../mcp/server';

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are a task management assistant. Help users manage their tasks using the provided tools.

Rules:
1. Use tools to complete the user's request
2. Always verify your actions by listing tasks if needed
3. Complete the request in minimum tool calls
4. Respond in the same language as the user

Today's date: {TODAY}`;

// ============================================
// OpenAI Functions Baseline Implementation
// ============================================

export async function runOpenAIFunctions(
  input: string,
  initialState: ExperimentState,
  model: OpenAIModel,
  taskId: string,
  taskCategory: TaskCategory
): Promise<ExperimentResult> {
  const openai = new OpenAI();
  const metrics = createMetricsCollector();
  const mcpServer = createMCPServerInstance(initialState);

  const runId = generateRunId(taskId, 'openai-func', model, 0);
  const today = new Date().toISOString().split('T')[0];

  const tools: ChatCompletionTool[] = mcpServer.getToolsAsOpenAI();

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT.replace('{TODAY}', today) },
    { role: 'user', content: input },
  ];

  const MAX_ITERATIONS = 20; // Safety limit
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
      });

      metrics.recordLLMCall(
        model,
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0
      );

      const choice = response.choices[0];

      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      // Check if done
      if (choice.finish_reason === 'stop') {
        break;
      }

      // Handle tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          // Type assertion for tool call structure
          const tc = toolCall as { id: string; function: { name: string; arguments: string } };
          const toolName = tc.function.name;
          const toolArgs = JSON.parse(tc.function.arguments);

          const result = await mcpServer.executeTool(toolName, toolArgs);
          metrics.recordToolCall(toolName, toolArgs, result);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      } else {
        // No tool calls and not stopped - add message and continue
        if (choice.message.content) {
          messages.push(choice.message);
        }
        break;
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
      method: 'openai-func',
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
      method: 'openai-func',
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
