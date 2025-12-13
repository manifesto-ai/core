'use client';

import { motion } from 'framer-motion';
import { Plus, LayoutGrid, Calendar, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickActionsProps {
  onNewTask?: () => void;
  onShowAll?: () => void;
  onTodayTasks?: () => void;
  onWeekTasks?: () => void;
}

export function QuickActions({ onNewTask, onShowAll, onTodayTasks, onWeekTasks }: QuickActionsProps) {
  const actions = [
    { icon: Plus, label: 'New Task', onClick: onNewTask },
    { icon: LayoutGrid, label: 'Show All', onClick: onShowAll },
    { icon: Calendar, label: 'Due Today', onClick: onTodayTasks },
    { icon: CalendarDays, label: 'This Week', onClick: onWeekTasks },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="rounded-lg border bg-muted/30 p-3"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={action.onClick}
          >
            <action.icon className="mr-1.5 h-3.5 w-3.5" />
            {action.label}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}
