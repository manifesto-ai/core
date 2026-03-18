'use client';

import { X, MessageSquare, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group transition-all duration-200 hover:bg-primary hover:scale-110"
              asChild
            >
              <a href="https://github.com/manifesto-ai/taskflow" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 transition-all duration-200 group-hover:text-primary-foreground group-hover:rotate-12" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Go to GitHub
          </TooltipContent>
        </Tooltip>
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 group transition-all duration-200 hover:bg-destructive hover:scale-110"
              onClick={onClose}
            >
              <X className="h-4 w-4 transition-all duration-200 group-hover:text-destructive-foreground group-hover:rotate-90" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            Close
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
