import React, { useState, useEffect } from 'react';
import { workspacesApi } from '@/api/workspaces';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { InvitationPublicDetail } from '@/types/workspace';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  Lock,
  Mail
} from 'lucide-react';

interface InviteAcceptViewProps {
  token: string;
  onSuccess: (workspaceId: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onGoHome: () => void;
}

export const InviteAcceptView: React.FC<InviteAcceptViewProps> = ({
  token,
  onSuccess,
  onOpenAuth,
  onGoHome,
}) => {
  const { isAuthenticated, user } = useAuth();
  const { refreshWorkspaces, setActiveWorkspaceId } = useWorkspace();
  const [invitation, setInvitation] = useState<InvitationPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await workspacesApi.getPublicInvitation(token);
        setInvitation(data);
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Invalid or expired invitation link.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInvite();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      onOpenAuth('login');
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const res = await workspacesApi.acceptInvitation(token);
      setAcceptedSuccess(true);
      await refreshWorkspaces();
      if (res.workspace?.id) {
        setActiveWorkspaceId(res.workspace.id);
      }
      setTimeout(() => {
        onSuccess(res.workspace?.id || '');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to accept invitation.';
      setError(msg);
      setIsAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex flex-col items-center justify-center p-6 text-[#1B1F27]">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] flex items-center justify-center text-[#2E6F5E] mb-4">
          <Lock className="w-6 h-6 animate-pulse" />
        </div>
        <Spinner size="lg" />
        <p className="text-xs text-[#5B6270] mt-3 font-mono">Verifying secure cryptographic invitation token...</p>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 text-[#1B1F27]">
        <div className="bg-[#FDFCFA] p-8 md:p-10 rounded-3xl border border-[#DDD9CC] max-w-md w-full text-center space-y-6 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1B1F27] mb-2 font-serif">Invitation Unavailable</h2>
            <p className="text-sm text-[#5B6270] leading-relaxed">
              {error || 'This invitation token is invalid, expired, or has already been accepted.'}
            </p>
          </div>
          <Button variant="primary" onClick={onGoHome} className="w-full justify-center">
            Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  if (acceptedSuccess) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 text-[#1B1F27]">
        <div className="bg-[#FDFCFA] p-8 md:p-10 rounded-3xl border border-[#DDD9CC] max-w-md w-full text-center space-y-6 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(46,111,94,0.1)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 animate-bounce" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#1B1F27] mb-2">Welcome to {invitation.workspace_name}!</h2>
            <p className="text-sm text-[#5B6270] leading-relaxed">
              You are now an active <span className="font-semibold text-[#1B1F27]">{invitation.role}</span> member. Redirecting to your workspace hub...
            </p>
          </div>
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 text-[#1B1F27]">
      <div className="bg-[#FDFCFA] p-8 md:p-10 rounded-3xl border border-[#DDD9CC] max-w-lg w-full space-y-6 shadow-xl animate-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DDD9CC]">
          <div className="flex items-center gap-2 font-bold text-sm text-[#1B1F27]">
            <div className="w-6 h-6 rounded bg-[#1B1F27] flex items-center justify-center text-white text-xs font-serif font-black">
              K
            </div>
            <span>KnowFlow AI</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-mono text-[#2E6F5E] bg-[#2E6F5E]/10 px-2.5 py-1 rounded-full border border-[#2E6F5E]/20">
            <Lock className="w-3 h-3" /> Secure Token
          </span>
        </div>

        {/* Invitation Context */}
        <div className="space-y-2 text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#1B1F27]">
            Join {invitation.workspace_name}
          </h2>
          <p className="text-sm text-[#5B6270] leading-relaxed">
            <span className="font-semibold text-[#1B1F27]">{invitation.inviter_name}</span> ({invitation.inviter_email}) has invited you to collaborate in this workspace.
          </p>
        </div>

        {/* Workspace Summary Card */}
        <div className="bg-[#F6F5F0] p-4 rounded-2xl border border-[#DDD9CC] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#5B6270] font-medium">Invited Email</span>
            <span className="font-mono text-[#1B1F27] font-semibold flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-[#8C93A0]" />
              {invitation.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#5B6270] font-medium">Assigned Role</span>
            <span className="font-mono px-2.5 py-0.5 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 font-bold">
              {invitation.role}
            </span>
          </div>
          {invitation.workspace_description && (
            <div className="pt-2 border-t border-[#DDD9CC] text-[#5B6270]">
              <span className="font-medium text-[#1B1F27]">About Workspace: </span>
              {invitation.workspace_description}
            </div>
          )}
        </div>

        {/* Role Privileges Callout */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#DDD9CC] text-xs text-[#5B6270]">
          <ShieldCheck className="w-5 h-5 text-[#2E6F5E] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#1B1F27]">Role Permissions: </span>
            {invitation.role === 'ADMIN' && 'Full workspace control, user management, and document uploads.'}
            {invitation.role === 'MANAGER' && 'Upload and re-index documents, inspect vector chunks, and search.'}
            {invitation.role === 'EMPLOYEE' && 'Search knowledge base, chat with RAG assistant, and view verified citations.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {isAuthenticated ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-[#5B6270]">
                Signed in as <span className="font-semibold text-[#1B1F27]">{user?.email}</span>
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleAccept}
                isLoading={isAccepting}
                className="w-full justify-center py-3 text-sm"
              >
                <span>Accept & Join Workspace</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onOpenAuth('register')}
                className="w-full justify-center py-3 text-sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                <span>Create Account to Join</span>
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => onOpenAuth('login')}
                className="w-full justify-center py-2.5 text-xs"
              >
                <LogIn className="w-4 h-4 mr-2" />
                <span>Already have an account? Sign In</span>
              </Button>
            </div>
          )}
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onGoHome}
            className="text-xs text-[#5B6270] hover:text-[#1B1F27] transition font-medium"
          >
            Not interested? Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};
