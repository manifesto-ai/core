'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Pencil, ArrowRight, Trash2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Message } from '@/components/ui/message';
import type {
  TaskCreatedMessage,
  TaskUpdatedMessage,
  TaskDeletedMessage,
} from '@/types/assistant';

type TaskResultMessage = TaskCreatedMessage | TaskUpdatedMessage | TaskDeletedMessage;

interface TaskResultCardProps {
  message: TaskResultMessage;
  onViewTask?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
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

export function TaskResultCard({ message, onViewTask, onEditTask }: TaskResultCardProps) {
  const isDeleted = message.type === 'task-deleted';
  const isUpdated = message.type === 'task-updated';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
    >
      <Message className="items-start">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {/* 결과 헤더 */}
          <div className="mb-2 flex items-center gap-2">
            {isDeleted ? (
              <div className="rounded-full bg-red-100 p-1 dark:bg-red-900/30">
                <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
              </div>
            ) : (
              <div className="rounded-full bg-green-100 p-1 dark:bg-green-900/30">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            )}
            <span className="text-sm text-muted-foreground">{message.summary}</span>
          </div>

          {/* Task 카드 */}
          {!isDeleted && 'task' in message && message.task && (
            <Card className="overflow-hidden">
              <CardContent className="p-3">
                {/* 제목과 우선순위 */}
                <div className="flex items-start gap-2">
                  <Badge
                    variant="secondary"
                    className={priorityStyles[message.task.priority]}
                  >
                    {message.task.priority.charAt(0).toUpperCase() + message.task.priority.slice(1)}
                  </Badge>
                  <span className="flex-1 font-medium text-sm">
                    {message.task.title}
                  </span>
                </div>

                {/* 상태 */}
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Status:</span>
                  <span className="font-medium">
                    {statusLabels[message.task.status] || message.task.status}
                  </span>

                  {/* 변경 사항 표시 (업데이트인 경우) */}
                  {isUpdated && 'changes' in message && message.changes?.status && (
                    <span className="flex items-center gap-1 text-primary">
                      <ArrowRight className="h-3 w-3" />
                      {statusLabels[message.changes.status as keyof typeof statusLabels] || message.changes.status}
                    </span>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onViewTask?.(message.task!.id)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onEditTask?.(message.task!.id)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 삭제된 경우 */}
          {isDeleted && (
            <Card className="overflow-hidden border-dashed opacity-60">
              <CardContent className="p-3">
                <span className="text-sm text-muted-foreground line-through">
                  {message.taskTitle}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </Message>
    </motion.div>
  );
}
