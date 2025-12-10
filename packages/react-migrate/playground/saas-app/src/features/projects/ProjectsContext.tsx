import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { Project, ProjectSettings, ProjectMember, Task, PaginatedResponse } from '../../types';
import { projectsApi } from '../../api/projects';
import { useCurrentOrganization } from '../auth/useAuth';

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  tasks: Task[];
  isLoading: boolean;
  isLoadingTasks: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  filters: ProjectFilters;
}

interface ProjectFilters {
  status?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

type ProjectsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_PROJECTS_SUCCESS'; payload: PaginatedResponse<Project> }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'SET_CURRENT_PROJECT'; payload: Project | null }
  | { type: 'CREATE_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'ARCHIVE_PROJECT'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<ProjectFilters> }
  | { type: 'FETCH_TASKS_START' }
  | { type: 'FETCH_TASKS_SUCCESS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_MEMBER'; payload: { projectId: string; member: ProjectMember } }
  | { type: 'REMOVE_MEMBER'; payload: { projectId: string; userId: string } };

const initialState: ProjectsState = {
  projects: [],
  currentProject: null,
  tasks: [],
  isLoading: true,
  isLoadingTasks: false,
  error: null,
  pagination: { page: 1, pageSize: 20, total: 0, hasMore: false },
  filters: { sortBy: 'updatedAt', sortOrder: 'desc' },
};

function projectsReducer(state: ProjectsState, action: ProjectsAction): ProjectsState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_PROJECTS_SUCCESS':
      return {
        ...state,
        projects: action.payload.data,
        pagination: {
          page: action.payload.page,
          pageSize: action.payload.pageSize,
          total: action.payload.total,
          hasMore: action.payload.hasMore,
        },
        isLoading: false,
      };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.payload };
    case 'CREATE_PROJECT':
      return { ...state, projects: [action.payload, ...state.projects] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
        currentProject:
          state.currentProject?.id === action.payload.id
            ? action.payload
            : state.currentProject,
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        currentProject:
          state.currentProject?.id === action.payload ? null : state.currentProject,
      };
    case 'ARCHIVE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload ? { ...p, status: 'archived' as const } : p
        ),
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'FETCH_TASKS_START':
      return { ...state, isLoadingTasks: true };
    case 'FETCH_TASKS_SUCCESS':
      return { ...state, tasks: action.payload, isLoadingTasks: false };
    case 'ADD_TASK':
      return { ...state, tasks: [action.payload, ...state.tasks] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.payload.id ? action.payload : t)),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'ADD_MEMBER':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, members: [...p.members, action.payload.member] }
            : p
        ),
      };
    case 'REMOVE_MEMBER':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.payload.projectId
            ? { ...p, members: p.members.filter(m => m.userId !== action.payload.userId) }
            : p
        ),
      };
    default:
      return state;
  }
}

interface ProjectsContextValue extends ProjectsState {
  fetchProjects: (page?: number) => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<Project>;
  setCurrentProject: (project: Project | null) => void;
  setFilters: (filters: Partial<ProjectFilters>) => void;
  // Tasks
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (projectId: string, data: CreateTaskData) => Promise<Task>;
  updateTask: (taskId: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, status: string) => Promise<void>;
  // Members
  addMember: (projectId: string, userId: string, role: string) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
  updateMemberRole: (projectId: string, userId: string, role: string) => Promise<void>;
}

interface CreateProjectData {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  settings?: Partial<ProjectSettings>;
}

interface CreateTaskData {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: Date;
}

export const ProjectsContext = createContext<ProjectsContextValue | null>(null);

interface ProjectsProviderProps {
  children: ReactNode;
}

export function ProjectsProvider({ children }: ProjectsProviderProps) {
  const [state, dispatch] = useReducer(projectsReducer, initialState);
  const { organization } = useCurrentOrganization();

  const fetchProjects = useCallback(async (page = 1) => {
    if (!organization) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const response = await projectsApi.getProjects(organization.id, {
        page,
        ...state.filters,
      });
      dispatch({ type: 'FETCH_PROJECTS_SUCCESS', payload: response });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [organization, state.filters]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (data: CreateProjectData) => {
    if (!organization) throw new Error('No organization');
    const project = await projectsApi.createProject(organization.id, data);
    dispatch({ type: 'CREATE_PROJECT', payload: project });
    return project;
  }, [organization]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>) => {
    const project = await projectsApi.updateProject(id, data);
    dispatch({ type: 'UPDATE_PROJECT', payload: project });
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await projectsApi.deleteProject(id);
    dispatch({ type: 'DELETE_PROJECT', payload: id });
  }, []);

  const archiveProject = useCallback(async (id: string) => {
    await projectsApi.archiveProject(id);
    dispatch({ type: 'ARCHIVE_PROJECT', payload: id });
  }, []);

  const duplicateProject = useCallback(async (id: string) => {
    const project = await projectsApi.duplicateProject(id);
    dispatch({ type: 'CREATE_PROJECT', payload: project });
    return project;
  }, []);

  const setCurrentProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: project });
  }, []);

  const setFilters = useCallback((filters: Partial<ProjectFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  // Task operations
  const fetchTasks = useCallback(async (projectId: string) => {
    dispatch({ type: 'FETCH_TASKS_START' });
    const tasks = await projectsApi.getTasks(projectId);
    dispatch({ type: 'FETCH_TASKS_SUCCESS', payload: tasks });
  }, []);

  const createTask = useCallback(async (projectId: string, data: CreateTaskData) => {
    const task = await projectsApi.createTask(projectId, data);
    dispatch({ type: 'ADD_TASK', payload: task });
    return task;
  }, []);

  const updateTask = useCallback(async (taskId: string, data: Partial<Task>) => {
    const task = await projectsApi.updateTask(taskId, data);
    dispatch({ type: 'UPDATE_TASK', payload: task });
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    await projectsApi.deleteTask(taskId);
    dispatch({ type: 'DELETE_TASK', payload: taskId });
  }, []);

  const moveTask = useCallback(async (taskId: string, status: string) => {
    const task = await projectsApi.updateTask(taskId, { status: status as any });
    dispatch({ type: 'UPDATE_TASK', payload: task });
  }, []);

  // Member operations
  const addMember = useCallback(async (projectId: string, userId: string, role: string) => {
    const member = await projectsApi.addMember(projectId, userId, role);
    dispatch({ type: 'ADD_MEMBER', payload: { projectId, member } });
  }, []);

  const removeMember = useCallback(async (projectId: string, userId: string) => {
    await projectsApi.removeMember(projectId, userId);
    dispatch({ type: 'REMOVE_MEMBER', payload: { projectId, userId } });
  }, []);

  const updateMemberRole = useCallback(async (projectId: string, userId: string, role: string) => {
    await projectsApi.updateMemberRole(projectId, userId, role);
    // Refetch to get updated member
    fetchProjects();
  }, [fetchProjects]);

  return (
    <ProjectsContext.Provider
      value={{
        ...state,
        fetchProjects,
        createProject,
        updateProject,
        deleteProject,
        archiveProject,
        duplicateProject,
        setCurrentProject,
        setFilters,
        fetchTasks,
        createTask,
        updateTask,
        deleteTask,
        moveTask,
        addMember,
        removeMember,
        updateMemberRole,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
