'use client';

import { MessageSquare } from 'lucide-react';
import {
  ChatContainerContent,
  ChatContainerRoot,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import { cn } from '@/lib/utils';
import type { AssistantMessage } from '@/types/taskflow';

interface AssistantMessagesProps {
  messages: AssistantMessage[];
}

export function AssistantMessages({ messages }: AssistantMessagesProps) {
  return (
    <ChatContainerRoot className="relative min-h-0 flex-1">
      <ChatContainerContent className="space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              TaskFlow Assistant
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Ask me to create, update, move, or delete tasks using natural language.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
                message.tone === 'muted' && 'text-muted-foreground',
              )}
            >
              {message.content}
            </div>
          </div>
        ))}
      </ChatContainerContent>

      <div className="absolute bottom-4 right-4">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  );
}
