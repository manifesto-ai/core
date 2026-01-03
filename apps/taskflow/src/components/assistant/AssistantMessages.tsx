'use client';

import { AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import {
  ChatContainerRoot,
  ChatContainerContent,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import type { AssistantMessage } from '@/types/assistant';
import {
  UserMessage,
  TextMessage,
  TaskResultCard,
  TaskListCard,
  AgentExecutionCard,
} from './messages';

interface AssistantMessagesProps {
  messages: AssistantMessage[];
  isThinking: boolean;
  onViewTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onSelectTask?: (taskId: string) => void;
}

export function AssistantMessages({
  messages,
  isThinking,
  onViewTask,
  onEditTask,
  onSelectTask,
}: AssistantMessagesProps) {
  return (
    <ChatContainerRoot className="flex-1 min-h-0 relative">
      <ChatContainerContent className="p-4 space-y-4">
        {/* 빈 상태 */}
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              How can I help you?
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Create and manage your tasks
            </p>
          </div>
        )}

        {/* 메시지 목록 */}
        <AnimatePresence mode="popLayout">
          {messages.map((message) => {
            switch (message.type) {
              case 'user':
                return <UserMessage key={message.id} message={message} />;

              case 'text':
                return <TextMessage key={message.id} message={message} />;

              case 'task-created':
              case 'task-updated':
              case 'task-deleted':
                return (
                  <TaskResultCard
                    key={message.id}
                    message={message}
                    onViewTask={onViewTask}
                    onEditTask={onEditTask}
                  />
                );

              case 'task-list':
                return (
                  <TaskListCard
                    key={message.id}
                    message={message}
                    onSelectTask={onSelectTask}
                  />
                );

              case 'agent-execution':
                return (
                  <AgentExecutionCard
                    key={message.id}
                    message={message}
                  />
                );

              case 'error':
                return (
                  <TextMessage
                    key={message.id}
                    message={{ ...message, type: 'text' }}
                  />
                );

              default:
                return null;
            }
          })}
        </AnimatePresence>
      </ChatContainerContent>

      {/* Scroll to bottom 버튼 */}
      <div className="absolute bottom-4 right-4">
        <ScrollButton />
      </div>
    </ChatContainerRoot>
  );
}
