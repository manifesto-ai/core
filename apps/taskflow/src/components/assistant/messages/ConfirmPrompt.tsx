'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmPromptProps {
  message: string;
  sessionId: string;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function ConfirmPrompt({
  message,
  sessionId,
  onApprove,
  onReject,
  isLoading = false,
}: ConfirmPromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4"
    >
      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              Confirmation Required
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {message}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={isLoading}
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
