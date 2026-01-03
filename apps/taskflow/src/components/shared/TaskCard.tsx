'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Task } from '@/manifesto';

interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  showCheckbox?: boolean;
  onSelect?: () => void;
  onToggleComplete?: () => void;
  className?: string;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

const statusColors = {
  todo: 'bg-slate-100 text-slate-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  review: 'bg-purple-100 text-purple-800',
  done: 'bg-green-100 text-green-800',
};

export function TaskCard({
  task,
  isSelected,
  showCheckbox,
  onSelect,
  onToggleComplete,
  className,
}: TaskCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        // Touch-friendly styles
        'touch-manipulation active:scale-[0.98] active:shadow-sm',
        isSelected && 'ring-2 ring-primary',
        task.status === 'done' && 'opacity-75',
        className
      )}
      onClick={onSelect}
    >
      <CardHeader className="p-3 sm:p-3 pb-2">
        <div className="flex items-start gap-2 sm:gap-2">
          {showCheckbox && (
            <Checkbox
              checked={task.status === 'done'}
              onCheckedChange={(checked) => {
                if (onToggleComplete) {
                  onToggleComplete();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              // Larger touch target on mobile
              className="mt-0.5 h-5 w-5 sm:h-4 sm:w-4"
            />
          )}
          <CardTitle
            className={cn(
              'text-sm font-medium leading-tight',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-3 pt-0">
        {task.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 sm:gap-1">
          <Badge variant="outline" className={cn('text-xs', priorityColors[task.priority])}>
            {task.priority}
          </Badge>
          {task.assignee && (
            <Badge variant="outline" className="text-xs">
              {task.assignee}
            </Badge>
          )}
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
      </CardContent>
    </Card>
  );
}
