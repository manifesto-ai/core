'use client';

import { motion } from 'framer-motion';
import { Bot, Check } from 'lucide-react';
import { Message } from '@/components/ui/message';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { AgentStepItem } from './AgentStepItem';
import type { AgentExecutionMessage } from '@/types/assistant';

interface AgentExecutionCardProps {
  message: AgentExecutionMessage;
}

export function AgentExecutionCard({ message }: AgentExecutionCardProps) {
  const isComplete = message.status === 'completed' || message.status === 'failed';

  // Show the most recent step until summary appears
  const currentStep = message.steps.length > 0
    ? message.steps[message.steps.length - 1]
    : null;

  // Show step only when there's no summary yet
  const showStep = !message.summary && currentStep;

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
          {/* Show the current step until summary arrives */}
          {showStep && (
            <div className="mb-3">
              <AgentStepItem step={currentStep} />
            </div>
          )}

          {/* Summary message with typing effect and completion check */}
          {message.summary && (
            <div className="flex items-start gap-2">
              {isComplete && (
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              )}
              {message.skipAnimation ? (
                <span className="text-sm text-foreground">{message.summary}</span>
              ) : (
                <TextEffect
                  per="char"
                  preset="fade"
                  speedReveal={1.5}
                  className="text-sm text-foreground"
                >
                  {message.summary}
                </TextEffect>
              )}
            </div>
          )}
        </div>
      </Message>
    </motion.div>
  );
}
