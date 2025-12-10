import { TeamMember, Invitation, Department, UserRole } from '../types';

export const teamApi = {
  async getMembers(orgId: string): Promise<TeamMember[]> {
    const response = await fetch(`/api/organizations/${orgId}/members`);
    if (!response.ok) throw new Error('Failed to fetch members');
    return response.json();
  },

  async getInvitations(orgId: string): Promise<Invitation[]> {
    const response = await fetch(`/api/organizations/${orgId}/invitations`);
    if (!response.ok) throw new Error('Failed to fetch invitations');
    return response.json();
  },

  async getDepartments(orgId: string): Promise<Department[]> {
    const response = await fetch(`/api/organizations/${orgId}/departments`);
    if (!response.ok) throw new Error('Failed to fetch departments');
    return response.json();
  },

  async inviteMember(orgId: string, email: string, role: UserRole): Promise<Invitation> {
    const response = await fetch(`/api/organizations/${orgId}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) throw new Error('Failed to invite member');
    return response.json();
  },

  async resendInvitation(invitationId: string): Promise<void> {
    const response = await fetch(`/api/invitations/${invitationId}/resend`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to resend invitation');
  },

  async revokeInvitation(invitationId: string): Promise<void> {
    const response = await fetch(`/api/invitations/${invitationId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to revoke invitation');
  },

  async updateMemberRole(memberId: string, role: UserRole): Promise<TeamMember> {
    const response = await fetch(`/api/members/${memberId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error('Failed to update member role');
    return response.json();
  },

  async suspendMember(memberId: string): Promise<void> {
    const response = await fetch(`/api/members/${memberId}/suspend`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to suspend member');
  },

  async reactivateMember(memberId: string): Promise<void> {
    const response = await fetch(`/api/members/${memberId}/reactivate`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to reactivate member');
  },

  async removeMember(memberId: string): Promise<void> {
    const response = await fetch(`/api/members/${memberId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to remove member');
  },

  async transferOwnership(orgId: string, memberId: string): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/transfer-ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (!response.ok) throw new Error('Failed to transfer ownership');
  },

  async createDepartment(orgId: string, name: string, managerId?: string): Promise<Department> {
    const response = await fetch(`/api/organizations/${orgId}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, managerId }),
    });
    if (!response.ok) throw new Error('Failed to create department');
    return response.json();
  },

  async updateDepartment(departmentId: string, data: Partial<Department>): Promise<Department> {
    const response = await fetch(`/api/departments/${departmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update department');
    return response.json();
  },

  async deleteDepartment(departmentId: string): Promise<void> {
    const response = await fetch(`/api/departments/${departmentId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete department');
  },

  async assignToDepartment(memberId: string, departmentId: string): Promise<TeamMember> {
    const response = await fetch(`/api/members/${memberId}/department`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId }),
    });
    if (!response.ok) throw new Error('Failed to assign to department');
    return response.json();
  },
};
