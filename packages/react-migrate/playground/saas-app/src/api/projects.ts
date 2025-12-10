import { Project, Task, ProjectMember, PaginatedResponse } from '../types';

interface GetProjectsParams {
  page?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export const projectsApi = {
  async getProjects(orgId: string, params: GetProjectsParams = {}): Promise<PaginatedResponse<Project>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.append(key, String(value));
    });

    const response = await fetch(`/api/organizations/${orgId}/projects?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch projects');
    return response.json();
  },

  async getProject(projectId: string): Promise<Project> {
    const response = await fetch(`/api/projects/${projectId}`);
    if (!response.ok) throw new Error('Failed to fetch project');
    return response.json();
  },

  async createProject(orgId: string, data: Partial<Project>): Promise<Project> {
    const response = await fetch(`/api/organizations/${orgId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create project');
    return response.json();
  },

  async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update project');
    return response.json();
  },

  async deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete project');
  },

  async archiveProject(projectId: string): Promise<void> {
    const response = await fetch(`/api/projects/${projectId}/archive`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to archive project');
  },

  async duplicateProject(projectId: string): Promise<Project> {
    const response = await fetch(`/api/projects/${projectId}/duplicate`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to duplicate project');
    return response.json();
  },

  // Tasks
  async getTasks(projectId: string): Promise<Task[]> {
    const response = await fetch(`/api/projects/${projectId}/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json();
  },

  async createTask(projectId: string, data: Partial<Task>): Promise<Task> {
    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  },

  async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  },

  async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete task');
  },

  // Members
  async addMember(projectId: string, userId: string, role: string): Promise<ProjectMember> {
    const response = await fetch(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    if (!response.ok) throw new Error('Failed to add member');
    return response.json();
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to remove member');
  },

  async updateMemberRole(projectId: string, userId: string, role: string): Promise<void> {
    const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error('Failed to update member role');
  },
};
