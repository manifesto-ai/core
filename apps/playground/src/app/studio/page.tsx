'use client';

/**
 * Studio Page - Compiler Playground
 *
 * Interactive compiler playground with React Flow visualization.
 * Features:
 * - Natural language input for domain description
 * - Real-time compilation with OpenAI
 * - Fragment DAG visualization
 * - Pipeline phase tracking
 */

import { CompilerPlayground } from '@/components/compiler-playground';

export default function StudioPage() {
  return (
    <div className="h-screen w-screen overflow-hidden dark">
      <CompilerPlayground />
    </div>
  );
}
