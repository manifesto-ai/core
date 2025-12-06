'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { HighlightControls } from '@/components/debug/HighlightControls'
import type { SemanticSnapshot } from '@manifesto-ai/ai-util'
import type { ToolResult } from '@/lib/form-agent'
import type { HighlightManager } from '@manifesto-ai/ui'

interface RightPanelProps {
  entitySchema: unknown
  viewSchema: unknown
  snapshot?: SemanticSnapshot | null
  onToolCall?: (action: ToolResult) => void
  highlightManager?: HighlightManager
}

export function RightPanel({ entitySchema, viewSchema, snapshot, onToolCall, highlightManager }: RightPanelProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-white/8 bg-background/80 p-3 shadow-[0_10px_60px_rgba(0,0,0,0.28)] backdrop-blur-lg">
      <ResizablePanelGroup
        direction="vertical"
        className="h-full rounded-lg border border-white/10 bg-background/85"
      >
        {/* AI Chatbot */}
        <ResizablePanel defaultSize={50} minSize={30} className="!overflow-hidden">
          <div className="flex h-full flex-col bg-transparent">
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(56,189,248,0.18)]" />
              <h2 className="text-sm font-semibold tracking-tight">AI Assistant</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                entitySchema={entitySchema}
                viewSchema={viewSchema}
                snapshot={snapshot}
                onToolCall={onToolCall}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-white/10 after:bg-white/30" />

        {/* Debug Panel */}
        <ResizablePanel defaultSize={50} minSize={30} className="!overflow-hidden">
          <div className="flex h-full flex-col bg-transparent">
            <Tabs defaultValue="state" className="flex flex-1 flex-col">
              <div className="border-b border-white/10 bg-white/5 px-3 pt-2">
                <TabsList className="w-full rounded-lg border border-white/10 bg-white/10 p-1 text-foreground/70">
                  <TabsTrigger value="state" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
                    State
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
                    Fields
                  </TabsTrigger>
                  <TabsTrigger value="highlight" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
                    Highlight
                  </TabsTrigger>
                  <TabsTrigger value="log" className="flex-1 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:text-white">
                    Log
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="state" className="mt-0 flex-1 overflow-hidden">
                <DebugPanel tab="state" snapshot={snapshot} />
              </TabsContent>

              <TabsContent value="fields" className="mt-0 flex-1 overflow-hidden">
                <DebugPanel tab="fields" snapshot={snapshot} />
              </TabsContent>

              <TabsContent value="highlight" className="mt-0 flex-1 overflow-hidden">
                <HighlightControls highlightManager={highlightManager ?? null} snapshot={snapshot} />
              </TabsContent>

              <TabsContent value="log" className="mt-0 flex-1 overflow-hidden">
                <DebugPanel tab="log" snapshot={snapshot} />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
