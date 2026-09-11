export type WorkspaceRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface WorkspaceMembership {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  role: WorkspaceRole;
  joined_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
  user_role?: WorkspaceRole;
  members_count?: number;
  documents_count?: number;
  created_at: string;
  updated_at: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  invited_by_email: string;
  invited_by_name: string;
  token: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

export interface InvitationPublicDetail {
  token: string;
  workspace_name: string;
  workspace_description?: string;
  inviter_name: string;
  inviter_email: string;
  role: WorkspaceRole;
  email: string;
  expires_at: string;
  is_valid: boolean;
}
