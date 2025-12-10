import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { TeamMember, Invitation, Department, UserRole } from '../../types';
import { teamApi } from '../../api/team';
import { useCurrentOrganization } from '../auth/useAuth';

interface TeamState {
  members: TeamMember[];
  invitations: Invitation[];
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  selectedMember: TeamMember | null;
}

type TeamAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { members: TeamMember[]; invitations: Invitation[]; departments: Department[] } }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'ADD_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_MEMBER'; payload: TeamMember }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'SUSPEND_MEMBER'; payload: string }
  | { type: 'REACTIVATE_MEMBER'; payload: string }
  | { type: 'ADD_INVITATION'; payload: Invitation }
  | { type: 'REVOKE_INVITATION'; payload: string }
  | { type: 'SET_SELECTED_MEMBER'; payload: TeamMember | null }
  | { type: 'ADD_DEPARTMENT'; payload: Department }
  | { type: 'UPDATE_DEPARTMENT'; payload: Department }
  | { type: 'DELETE_DEPARTMENT'; payload: string };

const initialState: TeamState = {
  members: [],
  invitations: [],
  departments: [],
  isLoading: true,
  error: null,
  selectedMember: null,
};

function teamReducer(state: TeamState, action: TeamAction): TeamState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        members: action.payload.members,
        invitations: action.payload.invitations,
        departments: action.payload.departments,
        isLoading: false,
      };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'ADD_MEMBER':
      return { ...state, members: [...state.members, action.payload] };
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(m =>
          m.id === action.payload.id ? action.payload : m
        ),
      };
    case 'REMOVE_MEMBER':
      return { ...state, members: state.members.filter(m => m.id !== action.payload) };
    case 'SUSPEND_MEMBER':
      return {
        ...state,
        members: state.members.map(m =>
          m.id === action.payload ? { ...m, status: 'suspended' as const } : m
        ),
      };
    case 'REACTIVATE_MEMBER':
      return {
        ...state,
        members: state.members.map(m =>
          m.id === action.payload ? { ...m, status: 'active' as const } : m
        ),
      };
    case 'ADD_INVITATION':
      return { ...state, invitations: [...state.invitations, action.payload] };
    case 'REVOKE_INVITATION':
      return {
        ...state,
        invitations: state.invitations.filter(i => i.id !== action.payload),
      };
    case 'SET_SELECTED_MEMBER':
      return { ...state, selectedMember: action.payload };
    case 'ADD_DEPARTMENT':
      return { ...state, departments: [...state.departments, action.payload] };
    case 'UPDATE_DEPARTMENT':
      return {
        ...state,
        departments: state.departments.map(d =>
          d.id === action.payload.id ? action.payload : d
        ),
      };
    case 'DELETE_DEPARTMENT':
      return {
        ...state,
        departments: state.departments.filter(d => d.id !== action.payload),
      };
    default:
      return state;
  }
}

interface TeamContextValue extends TeamState {
  fetchTeamData: () => Promise<void>;
  inviteMember: (email: string, role: UserRole) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: UserRole) => Promise<void>;
  suspendMember: (memberId: string) => Promise<void>;
  reactivateMember: (memberId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  transferOwnership: (memberId: string) => Promise<void>;
  setSelectedMember: (member: TeamMember | null) => void;
  createDepartment: (name: string, managerId?: string) => Promise<void>;
  updateDepartment: (departmentId: string, data: Partial<Department>) => Promise<void>;
  deleteDepartment: (departmentId: string) => Promise<void>;
  assignToDepartment: (memberId: string, departmentId: string) => Promise<void>;
}

export const TeamContext = createContext<TeamContextValue | null>(null);

interface TeamProviderProps {
  children: ReactNode;
}

export function TeamProvider({ children }: TeamProviderProps) {
  const [state, dispatch] = useReducer(teamReducer, initialState);
  const { organization } = useCurrentOrganization();

  const fetchTeamData = useCallback(async () => {
    if (!organization) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const [members, invitations, departments] = await Promise.all([
        teamApi.getMembers(organization.id),
        teamApi.getInvitations(organization.id),
        teamApi.getDepartments(organization.id),
      ]);
      dispatch({ type: 'FETCH_SUCCESS', payload: { members, invitations, departments } });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [organization]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const inviteMember = useCallback(async (email: string, role: UserRole) => {
    if (!organization) return;
    const invitation = await teamApi.inviteMember(organization.id, email, role);
    dispatch({ type: 'ADD_INVITATION', payload: invitation });
  }, [organization]);

  const resendInvitation = useCallback(async (invitationId: string) => {
    await teamApi.resendInvitation(invitationId);
  }, []);

  const revokeInvitation = useCallback(async (invitationId: string) => {
    await teamApi.revokeInvitation(invitationId);
    dispatch({ type: 'REVOKE_INVITATION', payload: invitationId });
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: UserRole) => {
    const member = await teamApi.updateMemberRole(memberId, role);
    dispatch({ type: 'UPDATE_MEMBER', payload: member });
  }, []);

  const suspendMember = useCallback(async (memberId: string) => {
    await teamApi.suspendMember(memberId);
    dispatch({ type: 'SUSPEND_MEMBER', payload: memberId });
  }, []);

  const reactivateMember = useCallback(async (memberId: string) => {
    await teamApi.reactivateMember(memberId);
    dispatch({ type: 'REACTIVATE_MEMBER', payload: memberId });
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    await teamApi.removeMember(memberId);
    dispatch({ type: 'REMOVE_MEMBER', payload: memberId });
  }, []);

  const transferOwnership = useCallback(async (memberId: string) => {
    if (!organization) return;
    await teamApi.transferOwnership(organization.id, memberId);
    fetchTeamData(); // Refetch to update all roles
  }, [organization, fetchTeamData]);

  const setSelectedMember = useCallback((member: TeamMember | null) => {
    dispatch({ type: 'SET_SELECTED_MEMBER', payload: member });
  }, []);

  const createDepartment = useCallback(async (name: string, managerId?: string) => {
    if (!organization) return;
    const department = await teamApi.createDepartment(organization.id, name, managerId);
    dispatch({ type: 'ADD_DEPARTMENT', payload: department });
  }, [organization]);

  const updateDepartment = useCallback(async (departmentId: string, data: Partial<Department>) => {
    const department = await teamApi.updateDepartment(departmentId, data);
    dispatch({ type: 'UPDATE_DEPARTMENT', payload: department });
  }, []);

  const deleteDepartment = useCallback(async (departmentId: string) => {
    await teamApi.deleteDepartment(departmentId);
    dispatch({ type: 'DELETE_DEPARTMENT', payload: departmentId });
  }, []);

  const assignToDepartment = useCallback(async (memberId: string, departmentId: string) => {
    const member = await teamApi.assignToDepartment(memberId, departmentId);
    dispatch({ type: 'UPDATE_MEMBER', payload: member });
  }, []);

  return (
    <TeamContext.Provider
      value={{
        ...state,
        fetchTeamData,
        inviteMember,
        resendInvitation,
        revokeInvitation,
        updateMemberRole,
        suspendMember,
        reactivateMember,
        removeMember,
        transferOwnership,
        setSelectedMember,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        assignToDepartment,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
