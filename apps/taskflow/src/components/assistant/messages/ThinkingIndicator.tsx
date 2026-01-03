'use client';

import { motion } from 'framer-motion';
import { Loader } from '@/components/ui/loader';

export function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-start pl-2"
    >
      <Loader variant="typing" size="sm" />
    </motion.div>
  );
}
