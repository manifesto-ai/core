/**
 * Claude Tools Baseline
 *
 * Uses Anthropic's tool use API.
 * LLM decides which tools to call and when to stop.
 *
 * Expected behavior: Multiple LLM calls in a loop until task is complete.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ContentBlock,
  ToolResultBlockParam,
  TextBlock,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import type { ExperimentState, ExperimentResult, TaskCategory, ClaudeModel } from '../types';
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
// Claude Tools Baseline Implementation
// ============================================

export async function runClaudeTools(
  input: string,
  initialState: ExperimentState,
  model: ClaudeModel,
  taskId: string,
  taskCategory: TaskCategory
): Promise<ExperimentResult> {
  const anthropic = new Anthropic();
  const metrics = createMetricsCollector();
  const mcpServer = createMCPServerInstance(initialState);

  const runId = generateRunId(taskId, 'claude-tool', model, 0);
  const today = new Date().toISOString().split('T')[0];

  const tools = mcpServer.getToolsAsClaude();

  const messages: MessageParam[] = [{ role: 'user', content: input }];

  const MAX_ITERATIONS = 20; // Safety limit
  let iterations = 0;
  let hitMaxIterations = false;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT.replace('{TODAY}', today),
        messages,
        tools,
      });

      metrics.recordLLMCall(
        model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Check if done
      if (response.stop_reason === 'end_turn') {
        break;
      }

      // Handle tool uses
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No tool calls - done
        break;
      }

      // Add assistant message
      messages.push({ role: 'assistant', content: response.content });

      // Execute tools and collect results
      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await mcpServer.executeTool(toolUse.name, toolUse.input);
        metrics.recordToolCall(toolUse.name, toolUse.input, result);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results as user message
      messages.push({ role: 'user', content: toolResults });
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
      method: 'claude-tool',
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
      method: 'claude-tool',
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
