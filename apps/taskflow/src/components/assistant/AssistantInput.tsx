'use client';

import { useState, useRef, useEffect } from 'react';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasLoadingRef = useRef(false);

  // Focus input when loading completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      // Loading just completed, focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput('');
  };

  return (
    <div className="border-t bg-background px-3 sm:px-4 pt-3 pb-6 safe-area-bottom">
      <PromptInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        disabled={isLoading}
        maxHeight={200}
        inputRef={inputRef}
        className="relative flex items-end gap-2 rounded-2xl border-border/50 bg-muted/50 p-1.5 pl-3 mb-3"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          className="min-h-[40px] sm:min-h-[36px] py-2 text-base sm:text-sm placeholder:text-muted-foreground/70"
        />
        <PromptInputActions>
          <Button
            type="button"
            size="icon"
            disabled={isLoading || !input.trim()}
            onClick={handleSubmit}
            className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-full"
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
