import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { workspacesApi } from '@/api/workspaces';
import type { WorkspaceMembership, WorkspaceRole, WorkspaceInvitation } from '@/types/workspace';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Mail, 
  AlertCircle,
  Clock,
  Lock,
  Send,
  XCircle,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

import { clientCache } from '@/utils/clientCache';

export const MembersView: React.FC = () => {
  const { activeWorkspace, userRole } = useWorkspace();
  const cacheKeyMembers = activeWorkspace?.id ? `members_${activeWorkspace.id}` : '';
  const cacheKeyInvites = activeWorkspace?.id ? `invites_${activeWorkspace.id}` : '';

  const initialCachedMembers = cacheKeyMembers ? clientCache.get<WorkspaceMembership[]>(cacheKeyMembers) : null;
  const initialCachedInvites = cacheKeyInvites ? clientCache.get<WorkspaceInvitation[]>(cacheKeyInvites) : null;

  const [members, setMembers] = useState<WorkspaceMembership[]>(initialCachedMembers || []);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>(initialCachedInvites || []);
  const [loading, setLoading] = useState(!initialCachedMembers);
  const [loadingInvitations, setLoadingInvitations] = useState(!initialCachedInvites && userRole === 'ADMIN');
  
  // Invite Member Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('EMPLOYEE');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Remove Member Confirm
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMembership | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Revoke Invitation Confirm
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkspaceInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchMembers = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    if (showLoading && !clientCache.get(cacheKeyMembers)) {
      setLoading(true);
    }
    try {
      const data = await workspacesApi.listMembers(activeWorkspace.id);
      setMembers(data);
      if (cacheKeyMembers) {
        clientCache.set(cacheKeyMembers, data);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, cacheKeyMembers]);

  const fetchInvitations = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !activeWorkspace.id || userRole !== 'ADMIN') return;
    if (showLoading && !clientCache.get(cacheKeyInvites)) {
      setLoadingInvitations(true);
    }
    try {
      const data = await workspacesApi.listInvitations(activeWorkspace.id);
      setInvitations(data);
      if (cacheKeyInvites) {
        clientCache.set(cacheKeyInvites, data);
      }
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoadingInvitations(false);
    }
  }, [activeWorkspace, userRole, cacheKeyInvites]);

  useEffect(() => {
    const hasCachedMembers = !!clientCache.get(cacheKeyMembers);
    const hasCachedInvites = !!clientCache.get(cacheKeyInvites);
    fetchMembers(!hasCachedMembers);
    fetchInvitations(!hasCachedInvites);
  }, [fetchMembers, fetchInvitations, cacheKeyMembers, cacheKeyInvites]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !activeWorkspace.id || !inviteEmail.trim()) return;
    setIsSubmittingInvite(true);
    setInviteError(null);
    setInviteSuccessMsg(null);

    try {
      await workspacesApi.sendInvitation(
        activeWorkspace.id,
        inviteEmail.trim(),
        inviteRole
      );
      setInviteSuccessMsg(`Invitation sent to ${inviteEmail.trim()}! An email with a secure join link has been dispatched.`);
      setInviteEmail('');
      setInviteRole('EMPLOYEE');
      fetchInvitations();
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Failed to send invitation. Please check the email address.';
      setInviteError(errorMsg);
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    try {
      await workspacesApi.updateMemberRole(activeWorkspace.id, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      console.error('Failed to update member role:', err);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !memberToRemove) return;
    setIsRemoving(true);
    try {
      await workspacesApi.removeMember(activeWorkspace.id, memberToRemove.id);
      setMemberToRemove(null);
      fetchMembers();
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !invitationToRevoke) return;
    setIsRevoking(true);
    try {
      await workspacesApi.revokeInvitation(activeWorkspace.id, invitationToRevoke.id);
      setInvitationToRevoke(null);
      fetchInvitations();
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/#invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full bg-[#F6F5F0]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F27] tracking-tight flex items-center gap-2">
            Team & Access Control
          </h1>
          <p className="text-sm text-[#5B6270] mt-1">
            Manage multi-tenant permissions, workspace roles, and secure email invitations.
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => {
              setInviteError(null);
              setInviteSuccessMsg(null);
              setIsInviteOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Teammate
          </Button>
        )}
      </div>

      {/* Active Members Table */}
      <div className="bg-white rounded-2xl border border-[#DDD9CC] overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#DDD9CC] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[#1B1F27] text-sm">
            <Users className="w-4 h-4 text-[#2E6F5E]" />
            Active Workspace Members ({members.length})
          </div>
          <span className="text-xs text-[#5B6270] font-mono">
            Active Workspace: <span className="text-[#1B1F27] font-medium">{activeWorkspace?.name}</span>
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="md" />
            <span className="text-xs text-[#5B6270]">Loading workspace roster...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-[#5B6270] text-sm">
            No active members found in this workspace.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#1B1F27]">
              <thead className="bg-[#F6F5F0] text-xs font-semibold text-[#5B6270] uppercase tracking-wider border-b border-[#DDD9CC]">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Joined</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD9CC]">
                {members.map((m) => {
                  const name = m.user.first_name ? `${m.user.first_name} ${m.user.last_name || ''}`.trim() : 'Member';
                  const initial = name.charAt(0).toUpperCase() || m.user.email.charAt(0).toUpperCase();
                  return (
                    <tr key={m.id} className="hover:bg-[#F6F5F0]/50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1B1F27] flex items-center justify-center text-white font-medium text-xs shadow-xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-medium text-[#1B1F27]">
                              {name}
                            </div>
                            <div className="text-xs text-[#5B6270] flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5 text-[#8C93A0]" />
                              {m.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as WorkspaceRole)}
                            className="bg-[#F6F5F0] border border-[#DDD9CC] rounded-lg text-xs font-medium text-[#1B1F27] px-2.5 py-1.5 focus:outline-none focus:border-[#1B1F27]"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="EMPLOYEE">EMPLOYEE</option>
                          </select>
                        ) : (
                          <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 font-bold">
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-[#5B6270]">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setMemberToRemove(m)}
                            className="p-1.5 rounded-lg text-[#5B6270] hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations Table (Admins only) */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-[#DDD9CC] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#DDD9CC] flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-[#1B1F27] text-sm">
              <Clock className="w-4 h-4 text-[#A9772F]" />
              Pending Email Invitations ({invitations.length})
            </div>
            <span className="text-xs text-[#5B6270] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#2E6F5E]" /> 7-Day Cryptographic Expiry
            </span>
          </div>

          {loadingInvitations ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-[#5B6270]">Checking pending invites...</span>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-[#5B6270] text-xs">
              No pending invitations. Click "Invite Teammate" above to send an email invite.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#1B1F27]">
                <thead className="bg-[#F6F5F0] text-xs font-semibold text-[#5B6270] uppercase tracking-wider border-b border-[#DDD9CC]">
                  <tr>
                    <th className="px-6 py-3">Invited Email</th>
                    <th className="px-6 py-3">Assigned Role</th>
                    <th className="px-6 py-3">Sent By</th>
                    <th className="px-6 py-3">Expires</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD9CC]">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F6F5F0]/50 transition text-xs">
                      <td className="px-6 py-3.5 font-medium flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#8C93A0]" />
                        <span>{inv.email}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 font-bold">
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-[#5B6270]">
                        {inv.invited_by_name || inv.invited_by_email}
                      </td>
                      <td className="px-6 py-3.5 text-[#5B6270]">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleCopyInviteLink(inv.token)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DDD9CC] text-[#1B1F27] hover:bg-[#F6F5F0] transition font-medium cursor-pointer"
                          title="Copy Invitation URL"
                        >
                          {copiedToken === inv.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#8C93A0]" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setInvitationToRevoke(inv)}
                          className="p-1 rounded-lg text-[#5B6270] hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Revoke Invitation"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Role Matrix Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#DDD9CC] space-y-4 shadow-xs">
        <h3 className="text-base font-semibold text-[#1B1F27] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#2E6F5E]" />
          Role Permission Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-2">
            <div className="font-bold text-[#1B1F27] text-sm">ADMIN</div>
            <p className="text-[#5B6270] leading-relaxed">
              Full control. Manage workspace settings, invite/remove members, upload documents, delete resources, and chat.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-2">
            <div className="font-bold text-[#1B1F27] text-sm">MANAGER</div>
            <p className="text-[#5B6270] leading-relaxed">
              Knowledge administrator. Upload documents, trigger re-indexing, inspect vector chunks, and manage team assets.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] space-y-2">
            <div className="font-bold text-[#1B1F27] text-sm">EMPLOYEE</div>
            <p className="text-[#5B6270] leading-relaxed">
              Workspace collaborator. Query the knowledge base, inspect grounded citations, and interact with the RAG assistant.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {inviteError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccessMsg && (
            <div className="p-3 rounded-xl bg-[rgba(46,111,94,0.1)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{inviteSuccessMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#1B1F27] mb-1.5">
              Recipient Email Address
            </label>
            <input
              type="email"
              required
              placeholder="colleague@gmail.com, name@outlook.com, team@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9CC] rounded-xl text-sm text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#1B1F27] transition"
            />
            <p className="text-[11px] text-[#5B6270] mt-1">
              Supports any valid email (Gmail, Outlook, Yahoo, Corporate Domains).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1B1F27] mb-1.5">
              Assigned Workspace Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#DDD9CC] rounded-xl text-sm text-[#1B1F27] focus:outline-none focus:border-[#1B1F27] transition cursor-pointer"
            >
              <option value="EMPLOYEE">EMPLOYEE (Query, Search & Chat with RAG)</option>
              <option value="MANAGER">MANAGER (Upload, Index & Manage Documents)</option>
              <option value="ADMIN">ADMIN (Full Workspace & Team Management)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] flex items-center gap-2.5 text-xs text-[#5B6270]">
            <Lock className="w-4 h-4 text-[#2E6F5E] shrink-0" />
            <span>
              Generates a cryptographically signed one-time join token valid for 7 days.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmittingInvite}
            >
              <Send className="w-3.5 h-3.5 mr-2" />
              Send Email Invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Invitation Modal */}
      {invitationToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => !isRevoking && setInvitationToRevoke(null)}
          />
          <div className="relative bg-[#FDFCFA] p-6 rounded-2xl border border-red-200 max-w-md w-full z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1B1F27]">Revoke Invitation?</h3>
            <p className="text-sm text-[#5B6270]">
              Are you sure you want to cancel the invitation sent to <span className="font-semibold text-[#1B1F27]">{invitationToRevoke.email}</span>? The link will immediately become invalid.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setInvitationToRevoke(null)}
                disabled={isRevoking}
              >
                Keep Active
              </Button>
              <Button
                variant="danger"
                onClick={handleRevokeInvitation}
                isLoading={isRevoking}
              >
                Revoke Invitation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => !isRemoving && setMemberToRemove(null)}
          />
          <div className="relative bg-[#FDFCFA] p-6 rounded-2xl border border-red-200 max-w-md w-full z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#1B1F27]">Remove Member?</h3>
            <p className="text-sm text-[#5B6270]">
              Are you sure you want to remove <span className="font-semibold text-[#1B1F27]">{memberToRemove.user.email}</span> from this workspace?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setMemberToRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveConfirm}
                isLoading={isRemoving}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

