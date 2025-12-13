'use client';

import { motion } from 'framer-motion';
import { List, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Message } from '@/components/ui/message';
import type { TaskListMessage } from '@/types/assistant';

interface TaskListCardProps {
  message: TaskListMessage;
  onSelectTask?: (taskId: string) => void;
}

const priorityStyles = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const statusLabels = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};

export function TaskListCard({ message, onSelectTask }: TaskListCardProps) {
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
          {/* 헤더 */}
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-full bg-blue-100 p-1 dark:bg-blue-900/30">
              <List className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-muted-foreground">{message.summary}</span>
          </div>

          {/* Task 리스트 */}
          <Card>
            <CardContent className="divide-y p-0">
              {message.tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                  onClick={() => onSelectTask?.(task.id)}
                >
                  <Badge
                    variant="secondary"
                    className={`${priorityStyles[task.priority]} text-[10px]`}
                  >
                    {task.priority.charAt(0).toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabels[task.status] || task.status}
                    </p>
                  </div>
                </motion.div>
              ))}

              {message.tasks.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No tasks found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Message>
    </motion.div>
  );
}
