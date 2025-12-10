import React, { useEffect, useState } from 'react';
import { useTasks, useCurrentProject } from './useProjects';
import { useCurrentUser } from '../auth/useAuth';
import { Task, TaskStatus, TaskPriority } from '../../types';

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#6b7280' },
  { key: 'todo', label: 'To Do', color: '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
  { key: 'done', label: 'Done', color: '#10b981' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
};

interface TaskBoardProps {
  projectId?: string;
}

export function TaskBoard({ projectId }: TaskBoardProps) {
  const { currentProject } = useCurrentProject();
  const { user } = useCurrentUser();
  const {
    tasksByStatus,
    isLoading,
    fetchTasks,
    createTask,
    moveTask,
  } = useTasks(projectId);

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInColumn, setCreateInColumn] = useState<TaskStatus | null>(null);

  const effectiveProjectId = projectId || currentProject?.id;

  useEffect(() => {
    if (effectiveProjectId) {
      fetchTasks();
    }
  }, [effectiveProjectId, fetchTasks]);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: TaskStatus) => {
    if (draggedTask && draggedTask.status !== status) {
      await moveTask(draggedTask.id, status);
    }
    setDraggedTask(null);
  };

  const handleCreateTask = (status: TaskStatus) => {
    setCreateInColumn(status);
    setShowCreateModal(true);
  };

  if (!effectiveProjectId) {
    return <div className="no-project">Select a project to view tasks</div>;
  }

  if (isLoading) {
    return <div className="loading">Loading tasks...</div>;
  }

  return (
    <div className="task-board">
      <div className="board-header">
        <h2>Task Board</h2>
        <div className="board-actions">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            + New Task
          </button>
        </div>
      </div>

      <div className="board-columns">
        {STATUS_COLUMNS.map(column => (
          <div
            key={column.key}
            className="board-column"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.key)}
          >
            <div className="column-header" style={{ borderTopColor: column.color }}>
              <h3>{column.label}</h3>
              <span className="task-count">{tasksByStatus[column.key].length}</span>
              <button
                className="add-task-btn"
                onClick={() => handleCreateTask(column.key)}
              >
                +
              </button>
            </div>

            <div className="column-tasks">
              {tasksByStatus[column.key].map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={() => handleDragStart(task)}
                  isDragging={draggedTask?.id === task.id}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          projectId={effectiveProjectId}
          initialStatus={createInColumn || 'todo'}
          onClose={() => {
            setShowCreateModal(false);
            setCreateInColumn(null);
          }}
          onCreate={createTask}
        />
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onDragStart: () => void;
  isDragging: boolean;
  currentUserId?: string;
}

function TaskCard({ task, onDragStart, isDragging, currentUserId }: TaskCardProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const isAssignedToMe = task.assigneeId === currentUserId;

  return (
    <div
      className={`task-card ${isDragging ? 'dragging' : ''} ${isOverdue ? 'overdue' : ''}`}
      draggable
      onDragStart={onDragStart}
    >
      <div className="task-header">
        <span
          className="priority-indicator"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={task.priority}
        />
        <span className="task-id">#{task.id.slice(0, 6)}</span>
      </div>

      <h4 className="task-title">{task.title}</h4>

      {task.labels.length > 0 && (
        <div className="task-labels">
          {task.labels.slice(0, 3).map(label => (
            <span key={label} className="label">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="more-labels">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      <div className="task-footer">
        {task.dueDate && (
          <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {isAssignedToMe && <span className="assigned-to-me">Assigned to me</span>}
        {task.subtasks.length > 0 && (
          <span className="subtasks">
            {task.subtasks.length} subtasks
          </span>
        )}
        {task.comments.length > 0 && (
          <span className="comments">{task.comments.length} 💬</span>
        )}
      </div>
    </div>
  );
}

interface CreateTaskModalProps {
  projectId: string;
  initialStatus: TaskStatus;
  onClose: () => void;
  onCreate: (data: any) => Promise<any>;
}

function CreateTaskModal({ projectId, initialStatus, onClose, onCreate }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        status: initialStatus,
        priority,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Create New Task</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter task title"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
