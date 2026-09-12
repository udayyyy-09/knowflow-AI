import { apiClient } from '@/api/client';
import type {
  Workspace,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceInvitation,
  InvitationPublicDetail
} from '@/types/workspace';

export const workspacesApi = {
  async list(): Promise<Workspace[]> {
    const res = await apiClient.get('/workspaces/');
    const items = res.data.data || res.data.results || res.data.workspaces || res.data;
    return Array.isArray(items) ? items : [];
  },

  async create(data: { name: string; description?: string }): Promise<Workspace> {
    const res = await apiClient.post('/workspaces/', data);
    return res.data.data || res.data.workspace || res.data;
  },

  async get(id: string): Promise<Workspace> {
    if (!id || id === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.get(`/workspaces/${id}/`);
    return res.data.data || res.data.workspace || res.data;
  },

  async update(id: string, data: { name?: string; description?: string }): Promise<Workspace> {
    if (!id || id === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.patch(`/workspaces/${id}/`, data);
    return res.data.data || res.data.workspace || res.data;
  },

  async delete(id: string): Promise<void> {
    if (!id || id === 'undefined') return;
    await apiClient.delete(`/workspaces/${id}/`);
  },

  async listMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/members/`);
    const items = res.data.data || res.data.results || res.data.members || res.data;
    return Array.isArray(items) ? items : [];
  },

  async addMember(workspaceId: string, email: string, role: WorkspaceRole = 'EMPLOYEE'): Promise<WorkspaceMembership> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.post(`/workspaces/${workspaceId}/members/`, { email, role });
    return res.data.data || res.data.membership || res.data;
  },

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMembership> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.patch(`/workspaces/${workspaceId}/members/${userId}/`, { role });
    return res.data.data || res.data.membership || res.data;
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    if (!workspaceId || workspaceId === 'undefined') return;
    await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}/`);
  },

  // --- Email Invitations ---
  async listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/invitations/`);
    const items = res.data.data || res.data.results || res.data;
    return Array.isArray(items) ? items : [];
  },

  async sendInvitation(workspaceId: string, email: string, role: WorkspaceRole = 'EMPLOYEE'): Promise<WorkspaceInvitation> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.post(`/workspaces/${workspaceId}/invitations/`, { email, role });
    return res.data.data || res.data;
  },

  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    if (!workspaceId || !invitationId) return;
    await apiClient.delete(`/workspaces/${workspaceId}/invitations/${invitationId}/`);
  },

  async resendInvitation(workspaceId: string, invitationId: string): Promise<WorkspaceInvitation> {
    if (!workspaceId || !invitationId) throw new Error('Invalid workspace or invitation ID');
    const res = await apiClient.post(`/workspaces/${workspaceId}/invitations/${invitationId}/resend/`);
    return res.data.data || res.data;
  },

  async getPublicInvitation(token: string): Promise<InvitationPublicDetail> {
    const res = await apiClient.get(`/invitations/${token}/`);
    return res.data.data || res.data;
  },

  async acceptInvitation(token: string): Promise<{ workspace: Workspace; role: WorkspaceRole }> {
    const res = await apiClient.post(`/invitations/${token}/accept/`);
    return res.data.data || res.data;
  }
};
