'use client';

import { X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

interface AssistantHeaderProps {
  onClose: () => void;
}

export function AssistantHeader({ onClose }: AssistantHeaderProps) {
  return (
    <div className="flex h-12 items-center justify-between border-b px-3 bg-muted/50">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Assistant</span>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
