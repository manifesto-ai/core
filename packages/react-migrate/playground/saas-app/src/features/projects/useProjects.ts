import { useContext, useMemo, useCallback } from 'react';
import { ProjectsContext } from './ProjectsContext';
import { Task, TaskStatus, TaskPriority } from '../../types';

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}

export function useCurrentProject() {
  const { currentProject, setCurrentProject, isLoading } = useProjects();
  return { currentProject, setCurrentProject, isLoading };
}

export function useProjectList() {
  const { projects, isLoading, pagination, fetchProjects, filters, setFilters } = useProjects();

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'active'),
    [projects]
  );

  const archivedProjects = useMemo(
    () => projects.filter(p => p.status === 'archived'),
    [projects]
  );

  return {
    projects,
    activeProjects,
    archivedProjects,
    isLoading,
    pagination,
    fetchProjects,
    filters,
    setFilters,
  };
}

export function useTasks(projectId?: string) {
  const {
    tasks,
    isLoadingTasks,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    currentProject,
  } = useProjects();

  const effectiveProjectId = projectId || currentProject?.id;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      canceled: [],
    };

    for (const task of tasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [tasks]);

  const tasksByPriority = useMemo(() => {
    const grouped: Record<TaskPriority, Task[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const task of tasks) {
      grouped[task.priority].push(task);
    }

    return grouped;
  }, [tasks]);

  const overdueTasks = useMemo(
    () =>
      tasks.filter(
        t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
      ),
    [tasks]
  );

  const myTasks = useCallback(
    (userId: string) => tasks.filter(t => t.assigneeId === userId),
    [tasks]
  );

  return {
    tasks,
    tasksByStatus,
    tasksByPriority,
    overdueTasks,
    myTasks,
    isLoading: isLoadingTasks,
    fetchTasks: () => effectiveProjectId && fetchTasks(effectiveProjectId),
    createTask: (data: any) => effectiveProjectId && createTask(effectiveProjectId, data),
    updateTask,
    deleteTask,
    moveTask,
  };
}

export function useProjectMembers(projectId?: string) {
  const { currentProject, addMember, removeMember, updateMemberRole } = useProjects();

  const project = projectId
    ? useProjects().projects.find(p => p.id === projectId)
    : currentProject;

  const members = project?.members || [];

  const getMemberByUserId = useCallback(
    (userId: string) => members.find(m => m.userId === userId),
    [members]
  );

  const isProjectOwner = useCallback(
    (userId: string) => {
      const member = getMemberByUserId(userId);
      return member?.role === 'owner';
    },
    [getMemberByUserId]
  );

  const canEditProject = useCallback(
    (userId: string) => {
      const member = getMemberByUserId(userId);
      return member && ['owner', 'admin', 'editor'].includes(member.role);
    },
    [getMemberByUserId]
  );

  return {
    members,
    getMemberByUserId,
    isProjectOwner,
    canEditProject,
    addMember: (userId: string, role: string) =>
      project && addMember(project.id, userId, role),
    removeMember: (userId: string) => project && removeMember(project.id, userId),
    updateMemberRole: (userId: string, role: string) =>
      project && updateMemberRole(project.id, userId, role),
  };
}
