'use client'

import type { Message, ToolInvocation } from 'ai'
import Markdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { User, Bot, Loader2, CheckCircle, Wrench } from 'lucide-react'

interface ChatMessageProps {
  message: Message
}

function formatResult(result: unknown): { text: string; isError: boolean } {
  const r = result as {
    type?: string
    fieldId?: string
    value?: unknown
    fieldIds?: string[]
    success?: boolean
    error?: string
  }
  if (r.type === 'updateField') {
    if (r.success === false && r.error) {
      return { text: `Failed: ${r.error}`, isError: true }
    }
    return { text: `${r.fieldId} = ${JSON.stringify(r.value)}`, isError: false }
  }
  if (r.type === 'reset') {
    return { text: 'Form reset', isError: false }
  }
  if (r.type === 'validate') {
    return {
      text: r.fieldIds ? `Validated: ${r.fieldIds.join(', ')}` : 'Form validated',
      isError: false,
    }
  }
  if (r.type === 'submit') {
    return { text: 'Form submitted', isError: false }
  }
  return { text: JSON.stringify(result), isError: false }
}

function ToolInvocationCard({ invocation }: { invocation: ToolInvocation }) {
  const isStreaming = invocation.state === 'partial-call'
  const isExecuting = invocation.state === 'call'
  const isComplete = invocation.state === 'result'

  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs font-mono">
      <div className="flex items-center gap-2">
        {(isStreaming || isExecuting) && (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
        )}
        {isComplete && (
          <CheckCircle className="h-3 w-3 text-green-500" />
        )}
        <Wrench className="h-3 w-3" />
        <span className="font-semibold">{invocation.toolName}</span>
        <span className="text-muted-foreground">
          {isStreaming && 'receiving args...'}
          {isExecuting && 'executing...'}
          {isComplete && 'done'}
        </span>
      </div>

      {/* Args display (streaming/call states) */}
      {(isStreaming || isExecuting) && invocation.args && (
        <pre className="mt-1 text-[10px] text-muted-foreground overflow-auto max-h-20">
          {JSON.stringify(invocation.args, null, 2)}
        </pre>
      )}

      {/* Result display (completed state) */}
      {isComplete && invocation.result && (() => {
        const { text, isError } = formatResult(invocation.result)
        return (
          <div className={`mt-1 text-[10px] ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {isError ? '✗ ' : '✓ '}{text}
          </div>
        )
      })()}
    </div>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {message.content && (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children, className }) => {
                  const isInline = !className
                  return isInline ? (
                    <code className="rounded bg-background/50 px-1 py-0.5 font-mono text-xs">{children}</code>
                  ) : (
                    <code className="block overflow-x-auto rounded bg-background/50 p-2 font-mono text-xs">{children}</code>
                  )
                },
                pre: ({ children }) => <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                a: ({ href, children }) => (
                  <a href={href} className="underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </Markdown>
          )
        )}

        {/* Tool Invocations */}
        {message.toolInvocations?.map((invocation) => (
          <ToolInvocationCard
            key={invocation.toolCallId}
            invocation={invocation}
          />
        ))}
      </div>
    </div>
  )
}
