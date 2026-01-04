'use client';

import { motion } from 'framer-motion';
import type { UserMessage as UserMessageType } from '@/types/assistant';

interface UserMessageProps {
  message: UserMessageType;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5">
        <p className="text-sm text-secondary-foreground whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </motion.div>
  );
}
