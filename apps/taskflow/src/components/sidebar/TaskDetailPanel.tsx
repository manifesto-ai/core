'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Calendar, User, Tag, Flag, Circle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useTasks, useTasksState } from '@/store/provider';
import type { Task } from '@/manifesto';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}

const statusOptions = [
  { value: 'todo', label: 'To Do', color: 'bg-secondary' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-primary/20' },
  { value: 'review', label: 'Review', color: 'bg-purple-500/20' },
  { value: 'done', label: 'Done', color: 'bg-green-500/20' },
] as const;

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-red-600' },
] as const;

// Controlled text input that syncs with external value changes
function ControlledInput({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useRef(false);

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <Input
      ref={inputRef}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        if (localValue !== value) {
          onChange(localValue);
        }
      }}
      {...props}
    />
  );
}

// Controlled textarea that syncs with external value changes
function ControlledTextarea({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  const [localValue, setLocalValue] = useState(value);
  const isFocused = useRef(false);

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <Textarea
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => {
        isFocused.current = false;
        if (localValue !== value) {
          onChange(localValue);
        }
      }}
      {...props}
    />
  );
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const tasksContext = useTasks();
  const tasksState = useTasksState();
  const tasks = tasksState?.tasks ?? [];

  const task = tasks.find((t) => t.id === taskId);

  // Only local state for new tag input
  const [newTag, setNewTag] = useState('');

  const handleUpdate = useCallback((changes: Partial<Task>) => {
    if (task) {
      tasksContext.updateTask({
        id: task.id,
        ...changes,
      });
    }
  }, [task, tasksContext]);

  const handleAddTag = useCallback(() => {
    if (task && newTag.trim() && !task.tags.includes(newTag.trim())) {
      tasksContext.updateTask({
        id: task.id,
        tags: [...task.tags, newTag.trim()],
      });
      setNewTag('');
    }
  }, [newTag, task, tasksContext]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    if (task) {
      tasksContext.updateTask({
        id: task.id,
        tags: task.tags.filter((t) => t !== tagToRemove),
      });
    }
  }, [task, tasksContext]);

  const handleDelete = useCallback(() => {
    if (task && confirm('Move this task to trash?')) {
      tasksContext.deleteTask(task.id);
      onClose();
    }
  }, [task, tasksContext, onClose]);

  if (!task) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex h-12 items-center justify-between border-b px-3 bg-muted/50">
          <span className="font-medium text-sm">Task not found</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const dueDate = task.dueDate ? parseISO(task.dueDate) : undefined;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex h-12 sm:h-12 items-center justify-between border-b px-3 sm:px-3 bg-muted/50">
        <span className="font-medium text-sm text-muted-foreground">Task Details</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-4 space-y-4 sm:space-y-4">
        {/* Title */}
        <div>
          <ControlledInput
            value={task.title}
            onChange={(value) => handleUpdate({ title: value })}
            placeholder="Task title"
            className="text-lg font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0"
          />
        </div>

        {/* Properties */}
        <div className="space-y-4 sm:space-y-3">
          {/* Status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="w-full sm:w-24 flex items-center gap-2 text-sm text-muted-foreground">
              <Circle className="h-4 w-4" />
              <span>Status</span>
            </div>
            <Select
              value={task.status}
              onValueChange={(value) => tasksContext.moveTask(task.id, value as Task['status'])}
            >
              <SelectTrigger className="w-full sm:w-40 h-10 sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', opt.color)} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="w-full sm:w-24 flex items-center gap-2 text-sm text-muted-foreground">
              <Flag className="h-4 w-4" />
              <span>Priority</span>
            </div>
            <Select
              value={task.priority}
              onValueChange={(value) => handleUpdate({ priority: value as Task['priority'] })}
            >
              <SelectTrigger className="w-full sm:w-40 h-10 sm:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={opt.color}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="w-full sm:w-24 flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Assignee</span>
            </div>
            <ControlledInput
              value={task.assignee || ''}
              onChange={(value) => handleUpdate({ assignee: value || undefined })}
              placeholder="Unassigned"
              className="w-full sm:w-40 h-10 sm:h-8"
            />
          </div>

          {/* Due Date */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="w-full sm:w-24 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due date</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full sm:w-40 h-10 sm:h-8 justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  {dueDate ? format(dueDate, 'MMM d, yyyy') : 'No date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => handleUpdate({ dueDate: date?.toISOString() })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tags */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
            <div className="w-full sm:w-24 flex items-center gap-2 text-sm text-muted-foreground sm:pt-1">
              <Tag className="h-4 w-4" />
              <span>Tags</span>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5 sm:gap-1">
                {task.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive/20 py-1 px-2"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag"
                  className="h-10 sm:h-8 text-sm sm:text-xs flex-1"
                />
                <Button size="sm" variant="outline" className="h-10 sm:h-8 px-4" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="pt-4 border-t">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Description
          </label>
          <ControlledTextarea
            value={task.description || ''}
            onChange={(value) => handleUpdate({ description: value || undefined })}
            placeholder="Add a description..."
            className="min-h-[120px] resize-none text-base sm:text-sm"
          />
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
          <p>Created: {format(parseISO(task.createdAt), 'MMM d, yyyy h:mm a')}</p>
          <p>Updated: {format(parseISO(task.updatedAt), 'MMM d, yyyy h:mm a')}</p>
        </div>
      </div>
    </div>
  );
}
