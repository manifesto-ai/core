import { useContext, useMemo } from 'react';
import { TeamContext } from './TeamContext';
import { TeamMemberStatus, UserRole } from '../../types';

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
}

export function useTeamMembers() {
  const { members, isLoading } = useTeam();

  const activeMembers = useMemo(
    () => members.filter(m => m.status === 'active'),
    [members]
  );

  const pendingMembers = useMemo(
    () => members.filter(m => m.status === 'pending'),
    [members]
  );

  const suspendedMembers = useMemo(
    () => members.filter(m => m.status === 'suspended'),
    [members]
  );

  const membersByRole = useMemo(() => {
    const grouped: Record<UserRole, typeof members> = {
      owner: [],
      admin: [],
      member: [],
      viewer: [],
    };

    for (const member of members) {
      grouped[member.role].push(member);
    }

    return grouped;
  }, [members]);

  const getMemberById = (id: string) => members.find(m => m.id === id);
  const getMemberByUserId = (userId: string) => members.find(m => m.userId === userId);

  return {
    members,
    activeMembers,
    pendingMembers,
    suspendedMembers,
    membersByRole,
    getMemberById,
    getMemberByUserId,
    isLoading,
    totalCount: members.length,
    activeCount: activeMembers.length,
  };
}

export function useInvitations() {
  const { invitations, inviteMember, resendInvitation, revokeInvitation, isLoading } = useTeam();

  const pendingInvitations = useMemo(
    () => invitations.filter(i => i.status === 'pending'),
    [invitations]
  );

  const expiredInvitations = useMemo(
    () => invitations.filter(i => i.status === 'expired'),
    [invitations]
  );

  return {
    invitations,
    pendingInvitations,
    expiredInvitations,
    inviteMember,
    resendInvitation,
    revokeInvitation,
    isLoading,
  };
}

export function useDepartments() {
  const { departments, members, createDepartment, updateDepartment, deleteDepartment, assignToDepartment, isLoading } = useTeam();

  const getDepartmentMembers = (departmentId: string) =>
    members.filter(m => m.departmentId === departmentId);

  const getDepartmentById = (id: string) =>
    departments.find(d => d.id === id);

  const getRootDepartments = () =>
    departments.filter(d => !d.parentDepartmentId);

  const getChildDepartments = (parentId: string) =>
    departments.filter(d => d.parentDepartmentId === parentId);

  return {
    departments,
    getDepartmentMembers,
    getDepartmentById,
    getRootDepartments,
    getChildDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    assignToDepartment,
    isLoading,
  };
}
