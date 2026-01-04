'use client';

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message';
import type { TextMessage as TextMessageType } from '@/types/assistant';

interface TextMessageProps {
  message: TextMessageType;
}

export function TextMessage({ message }: TextMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Message className="items-start">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <MessageContent
            markdown
            className="bg-transparent p-0 prose-sm dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          >
            {message.content}
          </MessageContent>
        </div>
      </Message>
    </motion.div>
  );
}
