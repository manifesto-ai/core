'use client';

import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import type { AssistantMessage } from '@/types/taskflow';

interface AssistantPanelProps {
  onClose: () => void;
  messages: AssistantMessage[];
  onSubmit: (message: string) => void;
  isLoading?: boolean;
}

export function AssistantPanel({
  onClose,
  messages,
  onSubmit,
  isLoading = false,
}: AssistantPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <AssistantHeader onClose={onClose} />
      <AssistantMessages messages={messages} />
      <AssistantInput
        onSubmit={onSubmit}
        isLoading={isLoading}
        placeholder="Ask the assistant to manage tasks..."
      />
    </div>
  );
}
