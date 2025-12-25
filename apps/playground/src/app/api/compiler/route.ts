/**
 * Compiler API Route
 *
 * Server-side endpoint for compiling natural language to fragments.
 * This keeps @swc/core and other Node.js-only dependencies on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createCompiler, createOpenAIAdapter } from '@manifesto-ai/compiler';
import type { Artifact, Fragment, Issue, Conflict } from '@manifesto-ai/compiler';

// ============================================================================
// Types
// ============================================================================

interface CompileRequest {
  artifacts: Array<{
    id: string;
    type: 'text';
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  model?: string;
}

interface PlaygroundSnapshot {
  phase: string;
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  nextSteps: Array<{
    id: string;
    action: string;
    priority: string;
    description: string;
  }>;
  progress: {
    stage: number;
    total: number;
    message: string;
  };
}

interface PlaygroundCompileResult {
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  stats: {
    fragmentCount: number;
    issueCount: number;
    conflictCount: number;
  };
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CompileRequest;
    const { artifacts, model = 'gpt-4o' } = body;

    if (!artifacts || !Array.isArray(artifacts) || artifacts.length === 0) {
      return NextResponse.json(
        { error: 'No artifacts provided' },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Create LLM adapter
    const llmAdapter = createOpenAIAdapter({
      apiKey,
      model,
      maxConfidence: 0.85,
    });

    // Create compiler using the factory function
    const compiler = createCompiler({
      coreVersion: '0.3.0',
      llmAdapter,
    });

    // Create session and compile
    const session = compiler.createSession();

    // Convert to proper Artifact type (using 'kind' instead of 'type')
    const compilerArtifacts: Artifact[] = artifacts.map((a) => ({
      id: a.id,
      kind: 'text' as const,
      content: a.content,
      metadata: a.metadata,
    }));

    // Run compilation
    const result = await session.compile({ artifacts: compilerArtifacts });

    // Get current snapshot from compiler
    const compilerSnapshot = session.getSnapshot();

    // Build response in playground format
    const playgroundResult: PlaygroundCompileResult = {
      fragments: result.fragments,
      issues: result.issues,
      conflicts: result.conflicts,
      stats: {
        fragmentCount: result.fragments.length,
        issueCount: result.issues.length,
        conflictCount: result.conflicts.length,
      },
    };

    const playgroundSnapshot: PlaygroundSnapshot = {
      phase: compilerSnapshot.phase,
      fragments: result.fragments,
      issues: result.issues,
      conflicts: result.conflicts,
      nextSteps: compilerSnapshot.nextSteps.map((step, index) => ({
        id: `step-${index}`,
        action: step.kind,
        priority: 'medium' as const,
        description: step.rationale,
      })),
      progress: compilerSnapshot.progress,
    };

    // Return result
    return NextResponse.json({
      success: true,
      result: playgroundResult,
      snapshot: playgroundSnapshot,
    });
  } catch (error) {
    console.error('Compilation error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Compilation failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
