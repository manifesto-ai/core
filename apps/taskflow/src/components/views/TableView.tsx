'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/taskflow';
import { format, parseISO } from 'date-fns';

// Notion-style subtle colors
const priorityColors = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const statusColors = {
  todo: 'bg-secondary text-secondary-foreground',
  'in-progress': 'bg-primary/10 text-primary',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const statusLabels = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
};

interface TableViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TableView({
  tasks,
  selectedTaskId,
  onSelectTask,
}: TableViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No visible tasks in this shell view.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[500px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[80px] hidden sm:table-cell">Priority</TableHead>
            <TableHead className="w-[100px] hidden md:table-cell">Due Date</TableHead>
            <TableHead className="w-[100px] hidden lg:table-cell">Assignee</TableHead>
            <TableHead className="w-[120px] hidden lg:table-cell">Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className={cn(
                'cursor-pointer touch-manipulation',
                selectedTaskId === task.id && 'bg-muted'
              )}
              onClick={() => onSelectTask(task.id)}
            >
              <TableCell className="py-3">
                <Checkbox
                  checked={task.status === 'done'}
                  disabled
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5"
                />
              </TableCell>
              <TableCell className="py-3">
                <div>
                  <div
                    className={cn(
                      'font-medium',
                      task.status === 'done' && 'line-through text-muted-foreground'
                    )}
                  >
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {task.description}
                    </div>
                  )}
                  {/* Show priority inline on mobile */}
                  <div className="flex items-center gap-2 mt-1 sm:hidden">
                    <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(task.dueDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <Badge variant="outline" className={cn('text-xs', statusColors[task.status])}>
                  {statusLabels[task.status]}
                </Badge>
              </TableCell>
              <TableCell className="py-3 hidden sm:table-cell">
                <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground hidden md:table-cell">
                {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell className="py-3 text-sm text-muted-foreground hidden lg:table-cell">
                {task.assignee || '-'}
              </TableCell>
              <TableCell className="py-3 hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {task.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {task.tags.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{task.tags.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
