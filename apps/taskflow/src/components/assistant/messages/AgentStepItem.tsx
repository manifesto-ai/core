'use client';

import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentStep } from '@/lib/agents/types';

interface AgentStepItemProps {
  step: AgentStep;
}

export function AgentStepItem({ step }: AgentStepItemProps) {
  const text = step.description || step.agentName;

  return (
    <div className="flex items-center gap-2 py-1">
      <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
      <AnimatePresence mode="wait">
        <motion.span
          key={step.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-muted-foreground"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
