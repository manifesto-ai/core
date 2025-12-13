'use client';

import { useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from '@/components/ui/prompt-input';

interface AssistantInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function AssistantInput({
  onSubmit,
  isLoading,
  placeholder = 'Message TaskFlow...',
}: AssistantInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput('');
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={isLoading}
        maxHeight={200}
        className="relative flex items-end gap-2 rounded-2xl border-border/50 bg-muted/50 p-1.5 pl-3"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          className="min-h-[36px] py-2 text-sm placeholder:text-muted-foreground/70"
        />
        <PromptInputActions>
          <Button
            type="button"
            size="icon"
            disabled={isLoading || !input.trim()}
            onClick={handleSubmit}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}
