'use client'

import { useChat } from 'ai/react'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useMemo, useEffect, useRef } from 'react'
import type { ToolInvocation } from 'ai'
import type { SemanticSnapshot } from '@manifesto-ai/ai-util'
import type { ToolResult } from '@/lib/form-agent'

interface ChatPanelProps {
  entitySchema: unknown
  viewSchema: unknown
  snapshot?: SemanticSnapshot | null
  onToolCall?: (action: ToolResult) => void
}

export function ChatPanel({ entitySchema, viewSchema, snapshot, onToolCall }: ChatPanelProps) {
  // Track processed tool IDs to prevent duplicate executions
  const processedToolIds = useRef(new Set<string>())

  // Create a simplified schema summary for the AI context
  const schemaContext = useMemo(() => {
    return {
      hasEntitySchema: !!entitySchema,
      hasViewSchema: !!viewSchema,
      entityId: (entitySchema as { id?: string })?.id,
      viewId: (viewSchema as { id?: string })?.id,
    }
  }, [entitySchema, viewSchema])

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: '/api/chat',
      body: {
        schemaContext,
        snapshot,
      },
    })

  // Handle tool calls from AI responses (with deduplication)
  useEffect(() => {
    if (!onToolCall) return

    // Iterate through ALL messages to handle tools (not just the last one)
    for (const message of messages) {
      if (message.role !== 'assistant' || !message.toolInvocations) continue

      for (const toolInvocation of message.toolInvocations as ToolInvocation[]) {
        // Only process completed tools that haven't been handled yet
        if (
          toolInvocation.state === 'result' &&
          toolInvocation.result &&
          !processedToolIds.current.has(toolInvocation.toolCallId)
        ) {
          // Mark as processed to prevent duplicate execution
          processedToolIds.current.add(toolInvocation.toolCallId)

          const result = toolInvocation.result as ToolResult
          onToolCall(result)
        }
      }
    }
  }, [messages, onToolCall])

  // Auto-scroll to bottom when new messages arrive
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  return (
    <div className="flex h-full flex-col min-h-0">
      {/* Messages - scrollable container */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3"
      >
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              <p>Ask questions about your schema!</p>
              <p className="mt-2 text-xs">
                Try: &quot;Set the email to test@example.com&quot; or &quot;Fill in the full name&quot;
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Thinking...
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <p className="font-medium">
                {error.message.includes('429') || error.message.includes('Rate limit')
                  ? 'Rate limit exceeded'
                  : 'Error'}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {error.message.includes('429') || error.message.includes('Rate limit')
                  ? 'You have reached the maximum number of requests (10/hour). Please try again later.'
                  : error.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 bg-background/85 p-3 backdrop-blur">
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
