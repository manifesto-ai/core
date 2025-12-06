'use client'

import { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface ChatInputProps {
  input: string
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form && input.trim()) {
        form.requestSubmit()
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <textarea
        value={input}
        onChange={onInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your schema..."
        rows={1}
        className="flex-1 resize-none rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-foreground/60 backdrop-blur focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !input.trim()}
        className="shrink-0 border border-primary/25 shadow-none"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}
