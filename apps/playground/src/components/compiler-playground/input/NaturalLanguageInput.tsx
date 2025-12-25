'use client';

/**
 * NaturalLanguageInput Component
 *
 * Textarea for entering natural language domain descriptions.
 * Features auto-resize, placeholder examples, and keyboard shortcuts.
 */

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface NaturalLanguageInputProps {
  /** Current input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Submit handler */
  onSubmit: (value: string) => void;
  /** Whether compilation is in progress */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PLACEHOLDER = `Describe your domain in natural language...

Examples:
• "A counter that tracks a number value. It can be incremented, decremented, or reset to zero."
• "A shopping cart with items. Each item has a name and price. The total is the sum of all prices."
• "A form with email and password fields. Email must be valid. Password must be at least 8 characters."

Press Ctrl+Enter to compile.`;

// ============================================================================
// Component
// ============================================================================

export function NaturalLanguageInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = DEFAULT_PLACEHOLDER,
  disabled = false,
  className,
}: NaturalLanguageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (value.trim() && !isLoading && !disabled) {
          onSubmit(value);
        }
      }
    },
    [value, isLoading, disabled, onSubmit]
  );

  // Handle submit button click
  const handleSubmit = useCallback(() => {
    if (value.trim() && !isLoading && !disabled) {
      onSubmit(value);
    }
  }, [value, isLoading, disabled, onSubmit]);

  const canSubmit = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border transition-all',
        isFocused
          ? 'border-neon-cyan ring-1 ring-neon-cyan/30'
          : 'border-border',
        disabled && 'opacity-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Sparkles className="h-4 w-4 text-neon-violet" />
        <span className="text-sm font-medium text-foreground">
          Natural Language Input
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          Ctrl+Enter to compile
        </span>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'h-full min-h-[200px] w-full resize-none bg-transparent',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none disabled:cursor-not-allowed'
          )}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {value.length} characters
        </span>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="sm"
          className={cn(
            'gap-2 transition-all',
            canSubmit &&
              'bg-neon-cyan text-background hover:bg-neon-cyan/90 shadow-glow-cyan'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Compiling...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Compile
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default NaturalLanguageInput;
