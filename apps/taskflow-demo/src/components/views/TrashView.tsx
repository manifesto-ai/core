'use client';

import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTasksStore } from '@/store/useTasksStore';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

const priorityColors = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function TrashView() {
  const tasks = useTasksStore((state) => state.tasks);
  const restoreTask = useTasksStore((state) => state.restoreTask);
  const permanentlyDeleteTask = useTasksStore((state) => state.permanentlyDeleteTask);
  const emptyTrash = useTasksStore((state) => state.emptyTrash);

  // Get only deleted tasks
  const deletedTasks = tasks.filter((t) => t.deletedAt);

  if (deletedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trash2 className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Trash is empty</p>
        <p className="text-sm">Deleted tasks will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Empty Trash button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trash2 className="h-5 w-5" />
          <span className="font-medium">{deletedTasks.length} deleted tasks</span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Empty Trash
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Empty Trash
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {deletedTasks.length} tasks in the trash.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={emptyTrash}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Deleted tasks list */}
      <div className="space-y-2">
        {deletedTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{task.title}</span>
                <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </div>
              {task.deletedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deleted {formatDistanceToNow(parseISO(task.deletedAt), { addSuffix: true })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => restoreTask(task.id)}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Restore
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Permanently</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to permanently delete "{task.title}"?
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => permanentlyDeleteTask(task.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
