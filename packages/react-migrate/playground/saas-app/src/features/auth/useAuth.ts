import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useCurrentUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}

export function useCurrentOrganization() {
  const { organization, isLoading } = useAuth();
  return { organization, isLoading };
}

export function usePermissions() {
  const { user, organization } = useAuth();

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canManageTeam = () => hasRole(['owner', 'admin']);
  const canManageBilling = () => hasRole(['owner']);
  const canCreateProjects = () => hasRole(['owner', 'admin', 'member']);
  const canInviteMembers = () => hasRole(['owner', 'admin']);

  const isOwner = () => organization?.ownerId === user?.id;

  return {
    hasRole,
    canManageTeam,
    canManageBilling,
    canCreateProjects,
    canInviteMembers,
    isOwner,
  };
}
