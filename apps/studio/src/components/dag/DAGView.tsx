"use client";

/**
 * DAGView Component
 *
 * Main React Flow visualization of the Studio domain DAG.
 * Shows nodes for sources, derived, actions, and policies with their dependencies.
 */

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid, LayoutList, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSetValue, useSelectedBlockId } from "@/runtime";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { useStudioGraph } from "./hooks/useStudioGraph";
import { ExplainPanel } from "./panels/ExplainPanel";
import { ImpactPanel } from "./panels/ImpactPanel";
import { type StudioNodeData, NODE_COLORS, getNodeKindFromPath } from "./types";

// ============================================================================
// Component
// ============================================================================

function DAGViewContent() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    applyLayout,
    layoutDirection,
    isEmpty,
  } = useStudioGraph();

  const { value: selectedBlockId } = useSelectedBlockId();
  const { setValue } = useSetValue();

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string; data?: StudioNodeData }) => {
      setValue("state.selectedBlockId", node.id);
    },
    [setValue]
  );

  // Toggle layout direction
  const toggleLayout = useCallback(() => {
    applyLayout(layoutDirection === "LR" ? "TB" : "LR");
  }, [applyLayout, layoutDirection]);

  // MiniMap node color function
  const getNodeColor = useCallback(
    (node: { data?: Record<string, unknown> }) => {
      const data = node.data as StudioNodeData | undefined;
      if (data?.kind) {
        return NODE_COLORS[data.kind];
      }
      return "#6b7280";
    },
    []
  );

  // Show empty state if no nodes
  if (isEmpty) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center",
          "rounded-lg border border-dashed border-border bg-card/30"
        )}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Network className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No blocks to display
          </p>
          <p className="text-xs text-muted-foreground/70">
            Add schema, derived, action, or policy blocks to see the DAG
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* React Flow Graph */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 1.5,
          }}
          minZoom={0.1}
          maxZoom={2}
          className="bg-background"
          proOptions={{ hideAttribution: true }}
        >
          {/* Background */}
          <Background color="#1e293b" gap={20} size={1} />

          {/* Controls */}
          <Controls
            showInteractive={false}
            className="!rounded-lg !border !border-border !bg-card !shadow-lg"
          />

          {/* MiniMap */}
          <MiniMap
            nodeColor={getNodeColor}
            maskColor="rgba(0, 0, 0, 0.7)"
            className="!rounded-lg !border !border-border !bg-card"
            style={{ height: 80, width: 120 }}
          />

          {/* Stats Panel */}
          <Panel position="top-left" className="rounded-lg bg-card/90 p-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {nodes.length} nodes
              </span>
              <span className="text-muted-foreground">
                {edges.length} edges
              </span>
            </div>
          </Panel>

          {/* Layout Toggle Panel */}
          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLayout}
              className="gap-2 bg-card"
            >
              {layoutDirection === "LR" ? (
                <>
                  <LayoutList className="h-4 w-4" />
                  Vertical
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  Horizontal
                </>
              )}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Bottom Panel: Explain/Impact (shown when node selected) */}
      {selectedBlockId && (
        <div className="h-48 border-t border-border shrink-0">
          <Tabs defaultValue="explain" className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-9">
              <TabsTrigger
                value="explain"
                className="data-[state=active]:bg-background"
              >
                Explain
              </TabsTrigger>
              <TabsTrigger
                value="impact"
                className="data-[state=active]:bg-background"
              >
                Impact
              </TabsTrigger>
            </TabsList>
            <TabsContent value="explain" className="flex-1 overflow-auto m-0 p-3">
              <ExplainPanel path={selectedBlockId} />
            </TabsContent>
            <TabsContent value="impact" className="flex-1 overflow-auto m-0 p-3">
              <ImpactPanel path={selectedBlockId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

export function DAGView() {
  return (
    <ReactFlowProvider>
      <DAGViewContent />
    </ReactFlowProvider>
  );
}

export default DAGView;
