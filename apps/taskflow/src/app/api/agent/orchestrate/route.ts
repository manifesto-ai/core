/**
 * Orchestrate API Route
 *
 * Main entry point for multi-agent task management.
 * Coordinates orchestrator and specialized agents.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runOrchestrator,
  runTaskCreator,
  runTaskMutator,
  runViewControl,
  runQueryAgent,
  calculateTasksSummary,
  generateStepId,
  type OrchestrateRequest,
  type OrchestrateResponse,
  type AgentStep,
  type AgentEffect,
  type AgentTrace,
  type TaskCreatorInput,
  type TaskMutatorInput,
  type ViewControlInput,
  type QueryAgentInput,
} from '@/lib/agents';
import type { Task } from '@/manifesto';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: OrchestrateRequest = await request.json();
    const { instruction, snapshot } = body;

    console.log('[orchestrate] ========== REQUEST START ==========');
    console.log('[orchestrate] Instruction:', instruction);
    console.log('[orchestrate] Snapshot tasks count:', snapshot?.data?.tasks?.length ?? 0);
    console.log('[orchestrate] Current view mode:', snapshot?.state?.viewMode);

    if (!process.env.OPENAI_API_KEY) {
      console.error('[orchestrate] ERROR: OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const steps: AgentStep[] = [];
    const allEffects: AgentEffect[] = [];
    const agentTraces: Record<string, AgentTrace> = {};
    let finalMessage = '';

    // Step 1: Run Orchestrator
    const orchestratorStep: AgentStep = {
      id: generateStepId(),
      agentName: 'Orchestrator',
      agentIcon: '🎯',
      status: 'running',
      description: 'Analyzing request...',
      startTime: new Date(),
    };
    steps.push(orchestratorStep);

    const orchestratorResult = await runOrchestrator({
      instruction,
      snapshot,
    });

    orchestratorStep.status = 'completed';
    orchestratorStep.endTime = new Date();
    orchestratorStep.duration = orchestratorStep.endTime.getTime() - orchestratorStep.startTime.getTime();
    orchestratorStep.output = {
      intent: orchestratorResult.decision.intent,
      agents: orchestratorResult.decision.agents.map(a => a.agent),
      reasoning: orchestratorResult.decision.reasoning,
    };

    console.log('[orchestrate] Orchestrator decision:', {
      intent: orchestratorResult.decision.intent,
      agents: orchestratorResult.decision.agents.map(a => a.agent),
      reasoning: orchestratorResult.decision.reasoning,
    });

    if (orchestratorResult.trace) {
      agentTraces['orchestrator'] = orchestratorResult.trace;
    }

    // Step 2: Run specialized agents based on orchestrator decision
    for (const agentCall of orchestratorResult.decision.agents) {
      const agentStep: AgentStep = {
        id: generateStepId(),
        agentName: getAgentDisplayName(agentCall.agent),
        agentIcon: getAgentIcon(agentCall.agent),
        status: 'running',
        description: agentCall.reason,
        input: agentCall.params,
        startTime: new Date(),
      };
      steps.push(agentStep);

      try {
        console.log(`[orchestrate] Running agent: ${agentCall.agent}`, { params: agentCall.params });

        const agentResult = await runAgent(agentCall.agent, {
          instruction,
          snapshot,
          params: agentCall.params,
        });

        console.log(`[orchestrate] Agent ${agentCall.agent} result:`, {
          message: agentResult.message,
          effectsCount: agentResult.effects.length,
          effects: agentResult.effects,
        });

        agentStep.status = 'completed';
        agentStep.endTime = new Date();
        agentStep.duration = agentStep.endTime.getTime() - agentStep.startTime.getTime();
        agentStep.output = {
          message: agentResult.message,
          effectsCount: agentResult.effects.length,
        };

        // Collect effects and message
        allEffects.push(...agentResult.effects);
        finalMessage = agentResult.message; // Use last agent's message

        if (agentResult.trace) {
          agentTraces[agentCall.agent] = agentResult.trace;
        }
      } catch (error) {
        console.error(`[orchestrate] Agent ${agentCall.agent} error:`, error);
        agentStep.status = 'failed';
        agentStep.endTime = new Date();
        agentStep.duration = agentStep.endTime.getTime() - agentStep.startTime.getTime();
        agentStep.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Build response
    const response: OrchestrateResponse = {
      message: finalMessage,
      effects: allEffects,
      steps,
      trace: {
        orchestrator: orchestratorResult.trace,
        agents: agentTraces,
      },
    };

    console.log('[orchestrate] ========== RESPONSE ==========');
    console.log('[orchestrate] Final message:', finalMessage);
    console.log('[orchestrate] Total effects:', allEffects.length);
    console.log('[orchestrate] Effects detail:', JSON.stringify(allEffects, null, 2));
    console.log('[orchestrate] Duration:', Date.now() - startTime, 'ms');

    return NextResponse.json(response);
  } catch (error) {
    console.error('Orchestrate API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'An error occurred. Please try again.',
        effects: [],
        steps: [],
      },
      { status: 500 }
    );
  }
}

// Helper to get agent display name
function getAgentDisplayName(agent: string): string {
  const names: Record<string, string> = {
    'task-creator': 'TaskCreator',
    'task-mutator': 'TaskMutator',
    'view-control': 'ViewControl',
    'query': 'QueryAgent',
  };
  return names[agent] || agent;
}

// Helper to get agent icon
function getAgentIcon(agent: string): string {
  const icons: Record<string, string> = {
    'task-creator': '📝',
    'task-mutator': '✏️',
    'view-control': '🎨',
    'query': '💬',
  };
  return icons[agent] || '🤖';
}

// Run the appropriate agent based on type
async function runAgent(
  agentType: string,
  context: {
    instruction: string;
    snapshot: OrchestrateRequest['snapshot'];
    params: Record<string, unknown>;
  }
) {
  const { instruction, snapshot, params } = context;
  const tasks = snapshot.data.tasks;
  const activeTasks = tasks.filter((t: Task) => !t.deletedAt);

  switch (agentType) {
    case 'task-creator': {
      const input: TaskCreatorInput = {
        instruction: (params.instruction as string) || instruction,
        currentTaskCount: activeTasks.length,
        existingTags: [...new Set(activeTasks.flatMap((t: Task) => t.tags))],
      };
      return runTaskCreator(input);
    }

    case 'task-mutator': {
      // Find target tasks based on instruction
      const targetTasks = findTargetTasks(instruction, activeTasks);
      const input: TaskMutatorInput = {
        instruction: (params.instruction as string) || instruction,
        targetTasks,
        allTasksForReference: activeTasks.map((t: Task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      };
      return runTaskMutator(input);
    }

    case 'view-control': {
      const input: ViewControlInput = {
        instruction: (params.instruction as string) || instruction,
        currentViewMode: snapshot.state.viewMode,
        currentDateFilter: snapshot.state.dateFilter,
        taskList: activeTasks.map((t: Task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate ?? undefined,
        })),
      };
      return runViewControl(input);
    }

    case 'query': {
      const tasksSummary = calculateTasksSummary(tasks);
      const input: QueryAgentInput = {
        instruction: (params.instruction as string) || instruction,
        tasksSummary,
        tasks: activeTasks.map((t: Task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ?? undefined,
          tags: t.tags,
        })),
      };
      return runQueryAgent(input);
    }

    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

// Helper to find target tasks for mutation
function findTargetTasks(
  instruction: string,
  tasks: Task[]
): Array<{ index: number; task: Task }> {
  const lowerInstruction = instruction.toLowerCase();

  // If instruction mentions specific task names, find them
  const matchingTasks: Array<{ index: number; task: Task }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const lowerTitle = task.title.toLowerCase();

    // Check if task title is mentioned in instruction
    if (lowerInstruction.includes(lowerTitle)) {
      matchingTasks.push({ index: i, task });
      continue;
    }

    // Check for partial matches (at least 3 chars)
    const words = lowerTitle.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3 && lowerInstruction.includes(word)) {
        matchingTasks.push({ index: i, task });
        break;
      }
    }
  }

  // If no specific matches, check for status-based targeting
  if (matchingTasks.length === 0) {
    if (lowerInstruction.includes('all') || lowerInstruction.includes('모든')) {
      // Target all tasks if "all" mentioned
      if (lowerInstruction.includes('todo') || lowerInstruction.includes('할 일')) {
        return tasks
          .map((task, index) => ({ index, task }))
          .filter(({ task }) => task.status === 'todo');
      }
      if (lowerInstruction.includes('done') || lowerInstruction.includes('완료')) {
        return tasks
          .map((task, index) => ({ index, task }))
          .filter(({ task }) => task.status === 'done');
      }
      if (lowerInstruction.includes('in-progress') || lowerInstruction.includes('진행')) {
        return tasks
          .map((task, index) => ({ index, task }))
          .filter(({ task }) => task.status === 'in-progress');
      }
      // If just "all" without status, return all
      return tasks.map((task, index) => ({ index, task }));
    }
  }

  // If still no matches, return all tasks for the agent to figure out
  if (matchingTasks.length === 0) {
    return tasks.map((task, index) => ({ index, task }));
  }

  return matchingTasks;
}
