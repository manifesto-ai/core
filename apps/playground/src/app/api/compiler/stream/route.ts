/**
 * Compiler Streaming API Route
 *
 * SSE endpoint for real-time compilation progress streaming.
 * Uses CompilerSession's onSnapshotChange subscription to stream
 * compilation state changes to the client.
 */

import { NextRequest } from 'next/server';
import { createCompiler, createOpenAIAdapter } from '@manifesto-ai/compiler';
import type { Artifact, CompilerSessionSnapshot, CompilerPhase } from '@manifesto-ai/compiler';

// Force Node.js runtime for @swc/core compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// Types
// ============================================================================

interface StreamRequest {
  artifacts: Array<{
    id: string;
    type: 'text';
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  model?: string;
}

// ============================================================================
// SSE Event Types
// ============================================================================

interface SSEConnectedEvent {
  type: 'connected';
  sessionId: string;
  timestamp: number;
}

interface SSEPhaseEvent {
  type: 'phase';
  phase: CompilerPhase;
  previousPhase: CompilerPhase;
  timestamp: number;
}

interface SSEProgressEvent {
  type: 'progress';
  progress: {
    stage: number;
    total: number;
    message: string;
  };
  timestamp: number;
}

interface SSESnapshotEvent {
  type: 'snapshot';
  snapshot: {
    phase: CompilerPhase;
    progress: { stage: number; total: number; message: string };
    fragmentsCount: number;
    conflictsCount: number;
    blockingIssuesCount: number;
  };
  timestamp: number;
}

interface SSECompleteEvent {
  type: 'complete';
  result: {
    fragments: unknown[];
    issues: unknown[];
    conflicts: unknown[];
    stats: {
      fragmentCount: number;
      issueCount: number;
      conflictCount: number;
    };
  };
  snapshot: {
    phase: CompilerPhase;
    nextSteps: Array<{
      id: string;
      action: string;
      priority: string;
      description: string;
    }>;
    progress: { stage: number; total: number; message: string };
  };
  timestamp: number;
}

interface SSEErrorEvent {
  type: 'error';
  error: string;
  details?: string;
  phase?: CompilerPhase;
  timestamp: number;
}

type SSEEvent =
  | SSEConnectedEvent
  | SSEPhaseEvent
  | SSEProgressEvent
  | SSESnapshotEvent
  | SSECompleteEvent
  | SSEErrorEvent;

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // 1. Parse request body
  let body: StreamRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { artifacts, model = 'gpt-4o' } = body;

  // 2. Validate input
  if (!artifacts || !Array.isArray(artifacts) || artifacts.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No artifacts provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 4. Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Helper to send SSE events
  const sendEvent = async (event: SSEEvent) => {
    const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    try {
      await writer.write(encoder.encode(eventString));
    } catch (e) {
      // Connection closed, ignore
      console.warn('Failed to write SSE event:', e);
    }
  };

  // 5. Run compilation in background
  (async () => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let previousPhase: CompilerPhase = 'idle';

    try {
      // Send connected event
      await sendEvent({
        type: 'connected',
        sessionId,
        timestamp: Date.now(),
      });

      // Create LLM adapter and compiler
      const llmAdapter = createOpenAIAdapter({
        apiKey,
        model,
        maxConfidence: 0.85,
      });

      const compiler = createCompiler({
        coreVersion: '0.3.0',
        llmAdapter,
      });

      const session = compiler.createSession();

      // Subscribe to snapshot changes
      const unsubscribe = session.onSnapshotChange(async (snapshot: CompilerSessionSnapshot) => {
        // Check for phase change
        if (snapshot.phase !== previousPhase) {
          await sendEvent({
            type: 'phase',
            phase: snapshot.phase,
            previousPhase,
            timestamp: Date.now(),
          });
          previousPhase = snapshot.phase;
        }

        // Send progress update
        await sendEvent({
          type: 'progress',
          progress: snapshot.progress,
          timestamp: Date.now(),
        });

        // Send snapshot update
        await sendEvent({
          type: 'snapshot',
          snapshot: {
            phase: snapshot.phase,
            progress: snapshot.progress,
            fragmentsCount: snapshot.fragmentsCount,
            conflictsCount: snapshot.conflictsCount,
            blockingIssuesCount: snapshot.blockingIssuesCount,
          },
          timestamp: Date.now(),
        });
      });

      // Convert artifacts to compiler format
      const compilerArtifacts: Artifact[] = artifacts.map((a) => ({
        id: a.id,
        kind: 'text' as const,
        content: a.content,
        metadata: a.metadata,
      }));

      // Run compilation
      const result = await session.compile({ artifacts: compilerArtifacts });

      // Unsubscribe from snapshot changes
      unsubscribe();

      // Get final snapshot
      const finalSnapshot = session.getSnapshot();

      // Send completion event
      await sendEvent({
        type: 'complete',
        result: {
          fragments: result.fragments,
          issues: result.issues,
          conflicts: result.conflicts,
          stats: {
            fragmentCount: result.fragments.length,
            issueCount: result.issues.length,
            conflictCount: result.conflicts.length,
          },
        },
        snapshot: {
          phase: finalSnapshot.phase,
          nextSteps: finalSnapshot.nextSteps.map((step, index) => ({
            id: `step-${index}`,
            action: step.kind,
            priority: 'medium',
            description: step.rationale,
          })),
          progress: finalSnapshot.progress,
        },
        timestamp: Date.now(),
      });

      await writer.close();
    } catch (error) {
      // Send error event
      await sendEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Compilation failed',
        details: error instanceof Error ? error.stack : undefined,
        phase: previousPhase,
        timestamp: Date.now(),
      });

      try {
        await writer.close();
      } catch {
        // Ignore close errors
      }
    }
  })();

  // 6. Return streaming response with SSE headers
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
