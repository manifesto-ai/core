/**
 * Orchestrate Stream API Route (SSE)
 *
 * Real-time streaming of agent execution events.
 * Uses Server-Sent Events to push updates to the client.
 */

import { NextRequest } from 'next/server';
import {
  runOrchestrator,
  runTaskCreator,
  runTaskMutator,
  runViewControl,
  runQueryAgent,
  calculateTasksSummary,
  generateStepId,
  type OrchestrateRequest,
  type AgentStep,
  type AgentEffect,
  type TaskCreatorInput,
  type TaskMutatorInput,
  type ViewControlInput,
  type QueryAgentInput,
} from '@/lib/agents';
import type { Task } from '@/manifesto';

// SSE Event Types
type SSEEventType =
  | 'step:start'
  | 'step:complete'
  | 'agent:start'
  | 'agent:complete'
  | 'agent:error'
  | 'done'
  | 'error';

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const body: OrchestrateRequest = await request.json();
  const { instruction, snapshot } = body;

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      formatSSE({ type: 'error', data: { message: 'OPENAI_API_KEY not configured' } }),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  const encoder = new TextEncoder();
  const steps: AgentStep[] = [];
  const allEffects: AgentEffect[] = [];
  let finalMessage = '';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      try {
        // Step 1: Orchestrator
        const orchestratorStep: AgentStep = {
          id: generateStepId(),
          agentName: 'Orchestrator',
          agentIcon: '🎯',
          status: 'running',
          description: 'Analyzing request...',
          startTime: new Date(),
        };
        steps.push(orchestratorStep);

        send({
          type: 'step:start',
          data: { step: serializeStep(orchestratorStep) },
        });

        const orchestratorResult = await runOrchestrator({ instruction, snapshot });

        orchestratorStep.status = 'completed';
        orchestratorStep.endTime = new Date();
        orchestratorStep.duration = orchestratorStep.endTime.getTime() - orchestratorStep.startTime.getTime();
        orchestratorStep.output = {
          intent: orchestratorResult.decision.intent,
          agents: orchestratorResult.decision.agents.map(a => a.agent),
        };

        send({
          type: 'step:complete',
          data: { step: serializeStep(orchestratorStep) },
        });

        // Step 2: Run specialized agents
        for (const agentCall of orchestratorResult.decision.agents) {
          const agentStep: AgentStep = {
            id: generateStepId(),
            agentName: getAgentDisplayName(agentCall.agent),
            agentIcon: getAgentIcon(agentCall.agent),
            status: 'running',
            description: agentCall.reason,
            startTime: new Date(),
          };
          steps.push(agentStep);

          send({
            type: 'agent:start',
            data: { step: serializeStep(agentStep), agentType: agentCall.agent },
          });

          try {
            const agentResult = await runAgent(agentCall.agent, {
              instruction,
              snapshot,
              params: agentCall.params,
            });

            agentStep.status = 'completed';
            agentStep.endTime = new Date();
            agentStep.duration = agentStep.endTime.getTime() - agentStep.startTime.getTime();
            agentStep.output = {
              message: agentResult.message,
              effectsCount: agentResult.effects.length,
            };

            allEffects.push(...agentResult.effects);
            finalMessage = agentResult.message;

            send({
              type: 'agent:complete',
              data: {
                step: serializeStep(agentStep),
                agentType: agentCall.agent,
                effects: agentResult.effects,
              },
            });
          } catch (error) {
            agentStep.status = 'failed';
            agentStep.endTime = new Date();
            agentStep.duration = agentStep.endTime.getTime() - agentStep.startTime.getTime();
            agentStep.error = error instanceof Error ? error.message : 'Unknown error';

            send({
              type: 'agent:error',
              data: { step: serializeStep(agentStep), error: agentStep.error },
            });
          }
        }

        // Done
        send({
          type: 'done',
          data: {
            message: finalMessage,
            effects: allEffects,
            steps: steps.map(serializeStep),
          },
        });
      } catch (error) {
        send({
          type: 'error',
          data: { message: error instanceof Error ? error.message : 'Unknown error' },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Serialize step for JSON (handle Date objects)
function serializeStep(step: AgentStep): Record<string, unknown> {
  return {
    ...step,
    startTime: step.startTime.toISOString(),
    endTime: step.endTime?.toISOString(),
  };
}

function getAgentDisplayName(agent: string): string {
  const names: Record<string, string> = {
    'task-creator': 'TaskCreator',
    'task-mutator': 'TaskMutator',
    'view-control': 'ViewControl',
    'query': 'QueryAgent',
  };
  return names[agent] || agent;
}

function getAgentIcon(agent: string): string {
  const icons: Record<string, string> = {
    'task-creator': '📝',
    'task-mutator': '✏️',
    'view-control': '🎨',
    'query': '💬',
  };
  return icons[agent] || '🤖';
}

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

function findTargetTasks(
  instruction: string,
  tasks: Task[]
): Array<{ index: number; task: Task }> {
  const lowerInstruction = instruction.toLowerCase();
  const matchingTasks: Array<{ index: number; task: Task }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const lowerTitle = task.title.toLowerCase();

    if (lowerInstruction.includes(lowerTitle)) {
      matchingTasks.push({ index: i, task });
      continue;
    }

    const words = lowerTitle.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3 && lowerInstruction.includes(word)) {
        matchingTasks.push({ index: i, task });
        break;
      }
    }
  }

  if (matchingTasks.length === 0) {
    if (lowerInstruction.includes('all') || lowerInstruction.includes('모든')) {
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
      return tasks.map((task, index) => ({ index, task }));
    }
  }

  if (matchingTasks.length === 0) {
    return tasks.map((task, index) => ({ index, task }));
  }

  return matchingTasks;
}
