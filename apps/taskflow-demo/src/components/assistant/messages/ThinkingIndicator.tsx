'use client';

import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';
import { Loader } from '@/components/ui/loader';
import { Message } from '@/components/ui/message';

export function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Message className="items-start">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2 py-1">
          <Loader variant="typing" size="sm" />
        </div>
      </Message>
    </motion.div>
  );
}
