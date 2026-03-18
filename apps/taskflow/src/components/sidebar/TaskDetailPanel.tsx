'use client';

import type { ReactNode } from 'react';
import { Calendar, Circle, Flag, Tag, Trash2, User, X } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/taskflow';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

const statusColors = {
  todo: 'bg-secondary text-secondary-foreground',
  'in-progress': 'bg-primary/10 text-primary',
  review: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  done: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

const priorityColors = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function TaskDetailPanel({ task, onClose, onDelete }: TaskDetailPanelProps) {
  if (!task) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-12 items-center justify-between border-b bg-muted/50 px-3">
          <span className="text-sm font-medium">Task details</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a task to inspect the preserved UI shell.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b bg-muted/50 px-3">
        <span className="text-sm font-medium text-muted-foreground">Task details</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => {
              if (task) {
                onDelete?.(task.id);
                onClose();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4">
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">{task.title}</h2>
            {task.description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn('text-xs', statusColors[task.status])}>
              {task.status}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            {task.deletedAt ? (
              <Badge variant="outline" className="text-xs text-destructive">
                deleted
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-card p-4">
          <DetailRow
            icon={<Circle className="h-4 w-4" />}
            label="Status"
            value={task.status}
          />
          <DetailRow
            icon={<Flag className="h-4 w-4" />}
            label="Priority"
            value={task.priority}
          />
          <DetailRow
            icon={<User className="h-4 w-4" />}
            label="Assignee"
            value={task.assignee ?? 'Unassigned'}
          />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label="Due date"
            value={task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'No date'}
          />
          <div className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-muted-foreground">
              <Tag className="h-4 w-4" />
            </span>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {task.tags.length > 0 ? (
                  task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No tags</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
          <p>Created: {format(parseISO(task.createdAt), 'MMM d, yyyy h:mm a')}</p>
          <p className="mt-2">Updated: {format(parseISO(task.updatedAt), 'MMM d, yyyy h:mm a')}</p>
          {task.deletedAt ? (
            <p className="mt-2">
              Deleted {formatDistanceToNow(parseISO(task.deletedAt), { addSuffix: true })}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

interface DetailRowProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p>{value}</p>
      </div>
    </div>
  );
}
