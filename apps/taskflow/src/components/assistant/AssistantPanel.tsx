'use client';

import { AssistantHeader } from './AssistantHeader';
import { AssistantMessages } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import type { AssistantMessage } from '@/types/taskflow';

interface AssistantPanelProps {
  onClose: () => void;
  messages: AssistantMessage[];
  onSubmit: (message: string) => void;
}

export function AssistantPanel({
  onClose,
  messages,
  onSubmit,
}: AssistantPanelProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <AssistantHeader onClose={onClose} />
      <AssistantMessages messages={messages} />
      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Natural-language execution is removed from this shell. Inputs stay local and are meant only
        to preserve the rebuilt panel contract.
      </div>
      <AssistantInput
        onSubmit={onSubmit}
        isLoading={false}
        placeholder="Message the TaskFlow shell..."
      />
    </div>
  );
}
