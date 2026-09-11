import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { HomePage } from '@/views/HomePage';
import { ChatView } from '@/views/ChatView';
import { DocumentsView } from '@/views/DocumentsView';
import { MembersView } from '@/views/MembersView';
import { InviteAcceptView } from '@/views/InviteAcceptView';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoginModal } from '@/components/auth/LoginModal';
import { CreateWorkspaceModal } from '@/components/layout/CreateWorkspaceModal';
import { Spinner } from '@/components/common/Spinner';
import { PlusCircle, Sparkles, Building2 } from 'lucide-react';
import { Button } from '@/components/common/Button';

const MainLayout: React.FC = () => {
  const { isAuthenticated, loading: authLoading, openAuthModal } = useAuth();
  const { workspaces, loading: workspaceLoading, setActiveWorkspaceId } = useWorkspace();
  const [currentTab, setCurrentTab] = useState<'chat' | 'documents' | 'members'>('chat');
  const [showLanding, setShowLanding] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Check URL hash and query string for invite token
  useEffect(() => {
    const parseInviteToken = () => {
      // Check hash #invite=<token>
      const hash = window.location.hash;
      const hashMatch = hash.match(/#invite=([a-zA-Z0-9_-]+)/);
      if (hashMatch) {
        setInviteToken(hashMatch[1]);
        return;
      }

      // Check search param ?invite=<token> or ?token=<token>
      const searchParams = new URLSearchParams(window.location.search);
      const tokenParam = searchParams.get('invite') || searchParams.get('token');
      if (tokenParam) {
        setInviteToken(tokenParam);
      }
    };

    parseInviteToken();
    window.addEventListener('hashchange', parseInviteToken);
    return () => window.removeEventListener('hashchange', parseInviteToken);
  }, []);

  // Handle invitation view
  if (inviteToken) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#1B1F27]">
        <InviteAcceptView
          token={inviteToken}
          onSuccess={(wsId) => {
            window.location.hash = '';
            setInviteToken(null);
            setShowLanding(false);
            if (wsId) {
              setActiveWorkspaceId(wsId);
            }
          }}
          onOpenAuth={(mode) => openAuthModal(mode)}
          onGoHome={() => {
            window.location.hash = '';
            setInviteToken(null);
            setShowLanding(true);
          }}
        />
        <LoginModal />
      </div>
    );
  }

  // If auth is still checking
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex flex-col items-center justify-center gap-4 text-[#1B1F27]">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(46,111,94,0.12)] border border-[rgba(46,111,94,0.25)] flex items-center justify-center text-[#2E6F5E]">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <Spinner size="lg" />
        <p className="text-sm text-[#5B6270]">Initializing KnowFlow AI session...</p>
      </div>
    );
  }

  // If not logged in, or user explicitly requested to view the landing page
  if (!isAuthenticated || showLanding) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#1B1F27]">
        <HomePage onEnterApp={() => setShowLanding(false)} />
        <LoginModal />
      </div>
    );
  }

  // If logged in, but workspaces are still loading
  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex flex-col items-center justify-center gap-4 text-[#1B1F27]">
        <Spinner size="lg" />
        <p className="text-sm text-[#5B6270]">Loading your knowledge workspaces...</p>
      </div>
    );
  }

  // If user has zero workspaces, prompt to create one
  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex items-center justify-center p-6 text-[#1B1F27]">
        <div className="bg-white p-8 md:p-10 rounded-3xl border border-[#DDD9CC] max-w-md w-full text-center space-y-6 animate-in zoom-in-95 duration-200 shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(46,111,94,0.1)] border border-[rgba(46,111,94,0.25)] text-[#2E6F5E] flex items-center justify-center mx-auto shadow-sm">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-[#1B1F27] mb-2">Create Your First Workspace</h2>
            <p className="text-sm text-[#5B6270] leading-relaxed">
              Knowledge bases, documents, vector embeddings, and conversations in KnowFlow are organized inside isolated workspaces.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsCreateWorkspaceOpen(true)}
            className="w-full justify-center py-3"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Workspace
          </Button>
        </div>

        <CreateWorkspaceModal
          isOpen={isCreateWorkspaceOpen}
          onClose={() => setIsCreateWorkspaceOpen(false)}
        />
        <LoginModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#1B1F27] flex overflow-hidden">
      {/* Navigation Sidebar */}
      <AppSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F6F5F0]">
        <AppHeader
          currentTab={currentTab}
          onNavigateLanding={() => setShowLanding(true)}
          onOpenCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
        />

        <main className="flex-1 flex overflow-hidden bg-[#F6F5F0]">
          {currentTab === 'chat' && <ChatView />}
          {currentTab === 'documents' && <DocumentsView />}
          {currentTab === 'members' && <MembersView />}
        </main>
      </div>

      {/* Global Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
      <LoginModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <MainLayout />
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;
