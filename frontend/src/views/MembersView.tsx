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
  Check,
  X,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp
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
  
  // Floating Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Invite Member Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('EMPLOYEE');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  // Resend / Revoke
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendSuccessId, setResendSuccessId] = useState<string | null>(null);

  // Remove Member Confirm
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMembership | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Revoke Invitation Confirm
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkspaceInvitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Toggle Matrix comparison view
  const [showFullMatrix, setShowFullMatrix] = useState(false);

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
    const targetEmail = inviteEmail.trim();
    setIsSubmittingInvite(true);
    setInviteError(null);
    setInviteSuccessMsg(null);

    try {
      await workspacesApi.sendInvitation(
        activeWorkspace.id,
        targetEmail,
        inviteRole
      );
      setInviteSuccessMsg(`Invitation email sent successfully to ${targetEmail}! A secure onboarding link has been dispatched to their inbox.`);
      setInviteEmail('');
      setInviteRole('EMPLOYEE');
      fetchInvitations(false);
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

  const handleResendInvitation = async (invitationId: string) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    setResendingId(invitationId);
    try {
      await workspacesApi.resendInvitation(activeWorkspace.id, invitationId);
      setResendSuccessId(invitationId);
      setTimeout(() => setResendSuccessId(null), 3000);
      fetchInvitations(false);
      setToast({ type: 'success', message: 'Invitation email resent successfully' });
    } catch (err) {
      console.error('Failed to resend invitation email:', err);
      setToast({ type: 'error', message: 'Failed to resend invitation email' });
    } finally {
      setResendingId(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    try {
      await workspacesApi.updateMemberRole(activeWorkspace.id, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId || m.user?.id === memberId ? { ...m, role: newRole } : m))
      );
      if (cacheKeyMembers) {
        clientCache.invalidate(cacheKeyMembers);
      }
      setToast({ type: 'success', message: 'Role Changed Successfully' });
    } catch (err: any) {
      console.error('Failed to update member role:', err);
      const errMsg =
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.role?.[0] ||
        (Array.isArray(err?.response?.data) ? err?.response?.data[0] : null) ||
        'Failed to update member role';
      setToast({ type: 'error', message: errMsg });
    }
  };

  const handleRemoveConfirm = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !memberToRemove) return;
    setIsRemoving(true);
    try {
      await workspacesApi.removeMember(activeWorkspace.id, memberToRemove.user?.id || memberToRemove.id);
      setMemberToRemove(null);
      fetchMembers();
      setToast({ type: 'success', message: 'Member removed from workspace' });
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to remove member';
      setToast({ type: 'error', message: errMsg });
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
      setToast({ type: 'success', message: 'Invitation revoked successfully' });
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
      setToast({ type: 'error', message: 'Failed to revoke invitation' });
    } finally {
      setIsRevoking(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? 'Recently'
      : d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  const isAdmin = userRole === 'ADMIN';
  const effectiveRole = userRole || 'EMPLOYEE';

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full bg-[#F6F5F0] relative">
      {/* Floating Toast Notification in Top-Right Corner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-auto animate-in slide-in-from-top-3 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl border text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-[#1B1F27] text-white border-[rgba(46,111,94,0.4)] shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
                : 'bg-red-950 text-red-50 border-red-800 shadow-[0_10px_30px_rgba(220,38,38,0.25)]'
            }`}
          >
            {toast.type === 'success' ? (
              <div className="w-6 h-6 rounded-full bg-[#2E6F5E] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              </div>
            )}
            <span className="flex-1 pr-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                  <th className="px-6 py-3.5">Joined Date</th>
                  {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD9CC]">
                {members.map((m) => {
                  const name = m.user.first_name ? `${m.user.first_name} ${m.user.last_name || ''}`.trim() : 'Member';
                  const initial = name.charAt(0).toUpperCase() || m.user.email.charAt(0).toUpperCase();
                  const memberTargetId = m.user?.id || m.id;

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
                            onChange={(e) => handleRoleChange(memberTargetId, e.target.value as WorkspaceRole)}
                            className="bg-[#F6F5F0] border border-[#DDD9CC] rounded-lg text-xs font-medium text-[#1B1F27] px-2.5 py-1.5 focus:outline-none focus:border-[#1B1F27] cursor-pointer hover:border-[#1B1F27]/50 transition"
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
                        {formatDate(m.joined_at || m.created_at)}
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
                        {formatDate(inv.expires_at)}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleResendInvitation(inv.id)}
                          disabled={resendingId === inv.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DDD9CC] text-[#1B1F27] hover:bg-[#F6F5F0] transition font-medium cursor-pointer disabled:opacity-50"
                          title="Resend invitation email"
                        >
                          {resendingId === inv.id ? (
                            <Spinner size="sm" />
                          ) : resendSuccessId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                              <span>Sent!</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5 text-[#2E6F5E]" />
                              <span>Resend Email</span>
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

      {/* Dynamic Personalized Role & Capabilities Card */}
      <div className="bg-white rounded-2xl border border-[#DDD9CC] overflow-hidden shadow-xs">
        <div className="p-5 sm:p-6 border-b border-[#DDD9CC] bg-gradient-to-r from-white via-[#FDFCFA] to-[#F6F5F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#1B1F27] text-white flex items-center justify-center shadow-xs shrink-0">
                {effectiveRole === 'ADMIN' ? (
                  <ShieldCheck className="w-6 h-6 text-[#2E6F5E]" />
                ) : effectiveRole === 'MANAGER' ? (
                  <FileText className="w-6 h-6 text-[#A9772F]" />
                ) : (
                  <Sparkles className="w-6 h-6 text-[#2E6F5E]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-[#1B1F27]">
                    Your Role & Workspace Privileges
                  </h2>
                  <span
                    className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      effectiveRole === 'ADMIN'
                        ? 'bg-[#2E6F5E]/10 text-[#2E6F5E] border-[#2E6F5E]/30'
                        : effectiveRole === 'MANAGER'
                        ? 'bg-[#A9772F]/10 text-[#A9772F] border-[#A9772F]/30'
                        : 'bg-[#5B6270]/10 text-[#5B6270] border-[#5B6270]/30'
                    }`}
                  >
                    {effectiveRole}
                  </span>
                </div>
                <p className="text-xs text-[#5B6270] mt-1">
                  {effectiveRole === 'ADMIN' && (
                    <>You are logged in as a <strong>Workspace Administrator</strong> with full operational and team governance rights.</>
                  )}
                  {effectiveRole === 'MANAGER' && (
                    <>You are logged in as a <strong>Knowledge Manager</strong> with document indexing, chunk inspection, and content administration capabilities.</>
                  )}
                  {effectiveRole === 'EMPLOYEE' && (
                    <>You are logged in as a <strong>Workspace Collaborator</strong> with query, search, and AI assistant privileges.</>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFullMatrix(!showFullMatrix)}
              className="text-xs font-medium text-[#5B6270] hover:text-[#1B1F27] flex items-center gap-1.5 self-start sm:self-center px-3 py-1.5 rounded-lg border border-[#DDD9CC] hover:bg-[#F6F5F0] transition cursor-pointer shrink-0"
            >
              <span>{showFullMatrix ? 'Hide All Roles Matrix' : 'Compare All Roles'}</span>
              {showFullMatrix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Active Privileges Checklist */}
        <div className="p-5 sm:p-6 bg-white">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5B6270] mb-3">
            Active Capabilities Enabled For You:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {effectiveRole === 'ADMIN' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Manage Workspace Settings</span>
                    <span className="text-[#5B6270]">Configure workspace metadata, delete or update workspace.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Invite & Manage Members</span>
                    <span className="text-[#5B6270]">Send email invites, revoke links, change member roles, and remove members.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Upload & Process Documents</span>
                    <span className="text-[#5B6270]">Upload PDF, DOCX, TXT files, trigger vector indexing, and delete files.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Inspect Vector Chunks</span>
                    <span className="text-[#5B6270]">Audit chunking embeddings, vector boundaries, and processing health.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Interactive RAG Chat Assistant</span>
                    <span className="text-[#5B6270]">Execute multi-turn grounded conversations with verified citations.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Full Security & Tenant Isolation</span>
                    <span className="text-[#5B6270]">Complete data governance with cryptographic invitation tokens.</span>
                  </div>
                </div>
              </>
            )}

            {effectiveRole === 'MANAGER' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Upload Knowledge Documents</span>
                    <span className="text-[#5B6270]">Ingest PDF, DOCX, Markdown, and TXT sources into the workspace.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Trigger Vector Re-indexing</span>
                    <span className="text-[#5B6270]">Reprocess documents and regenerate vector chunk embeddings.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Inspect Vector Chunks</span>
                    <span className="text-[#5B6270]">Audit document chunk segmentation, similarity scores, and tokens.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Knowledge Assistant Chat</span>
                    <span className="text-[#5B6270]">Query the AI assistant with real-time knowledge base retrieval.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Grounded Citations</span>
                    <span className="text-[#5B6270]">Verify source context and document references in assistant answers.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70">
                  <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-900 block">Restricted Administration</span>
                    <span className="text-amber-700">Workspace settings and member invitations are reserved for Admins.</span>
                  </div>
                </div>
              </>
            )}

            {effectiveRole === 'EMPLOYEE' && (
              <>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">AI Knowledge Assistant</span>
                    <span className="text-[#5B6270]">Ask questions and engage in multi-turn AI chat against workspace knowledge.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Grounded Fact Citations</span>
                    <span className="text-[#5B6270]">Inspect citations and verified excerpts backing every assistant answer.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Check className="w-4 h-4 text-[#2E6F5E] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Knowledge Base Access</span>
                    <span className="text-[#5B6270]">Read and browse workspace knowledge materials in read-only mode.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Lock className="w-4 h-4 text-[#5B6270] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Document Ingestion</span>
                    <span className="text-[#5B6270]">Uploading and re-indexing are managed by Managers and Admins.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F6F5F0]/60 border border-[#DDD9CC]/70">
                  <Lock className="w-4 h-4 text-[#5B6270] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-[#1B1F27] block">Team & Access Control</span>
                    <span className="text-[#5B6270]">User invitations and role assignments are managed by Admins.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Collapsible Full Role Comparison Matrix */}
        {showFullMatrix && (
          <div className="p-5 sm:p-6 border-t border-[#DDD9CC] bg-[#F6F5F0]/50 space-y-4 animate-in fade-in duration-200">
            <h3 className="text-sm font-semibold text-[#1B1F27] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2E6F5E]" />
              Workspace Role Comparison Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className={`p-4 rounded-xl border space-y-2 ${effectiveRole === 'ADMIN' ? 'bg-white border-[#2E6F5E] shadow-xs' : 'bg-white border-[#DDD9CC]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1B1F27] text-sm">ADMIN</span>
                  {effectiveRole === 'ADMIN' && <span className="text-[10px] font-bold text-[#2E6F5E] bg-[#2E6F5E]/10 px-2 py-0.5 rounded-full">Your Role</span>}
                </div>
                <p className="text-[#5B6270] leading-relaxed">
                  Full control. Manage workspace settings, invite/remove members, update roles, upload documents, delete resources, and chat.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${effectiveRole === 'MANAGER' ? 'bg-white border-[#A9772F] shadow-xs' : 'bg-white border-[#DDD9CC]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1B1F27] text-sm">MANAGER</span>
                  {effectiveRole === 'MANAGER' && <span className="text-[10px] font-bold text-[#A9772F] bg-[#A9772F]/10 px-2 py-0.5 rounded-full">Your Role</span>}
                </div>
                <p className="text-[#5B6270] leading-relaxed">
                  Knowledge administrator. Upload documents, trigger re-indexing, inspect vector chunks, and manage workspace knowledge assets.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${effectiveRole === 'EMPLOYEE' ? 'bg-white border-[#5B6270] shadow-xs' : 'bg-white border-[#DDD9CC]'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1B1F27] text-sm">EMPLOYEE</span>
                  {effectiveRole === 'EMPLOYEE' && <span className="text-[10px] font-bold text-[#5B6270] bg-[#5B6270]/10 px-2 py-0.5 rounded-full">Your Role</span>}
                </div>
                <p className="text-[#5B6270] leading-relaxed">
                  Workspace collaborator. Query the knowledge base, inspect grounded citations, read documents, and interact with the RAG assistant.
                </p>
              </div>
            </div>
          </div>
        )}
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
              Dispatches a cryptographically signed invitation link valid for 7 days directly to their inbox.
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


