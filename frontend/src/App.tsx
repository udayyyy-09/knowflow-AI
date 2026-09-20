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
import { AppInitialLoader, APP_INITIAL_LOADER_DURATION_MS } from '@/components/common/AppInitialLoader';
import { PlusCircle, Sparkles, Building2 } from 'lucide-react';
import { Button } from '@/components/common/Button';

const MainLayout: React.FC = () => {
  const { isAuthenticated, loading: authLoading, openAuthModal } = useAuth();
  const { workspaces, loading: workspaceLoading, setActiveWorkspaceId } = useWorkspace();

  const getInitialTab = (): 'chat' | 'documents' | 'members' => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('documents')) return 'documents';
    if (hash.includes('members') || hash.includes('team')) return 'members';
    if (hash.includes('chat')) return 'chat';

    const saved = localStorage.getItem('knowflow_active_tab');
    if (saved === 'documents' || saved === 'members' || saved === 'chat') {
      return saved;
    }
    return 'chat';
  };

  const getInitialShowLanding = (): boolean => {
    const hash = window.location.hash.toLowerCase();
    if (
      hash.includes('home') ||
      hash.includes('landing') ||
      hash.includes('features') ||
      hash.includes('how-it-works') ||
      hash.includes('security')
    ) {
      return true;
    }
    if (hash.includes('chat') || hash.includes('documents') || hash.includes('members')) {
      return false;
    }
    const saved = localStorage.getItem('knowflow_view');
    if (saved === 'landing') return true;
    if (saved === 'app') return false;
    // Default to true (landing page) for unauthenticated or first-time visits
    return false;
  };

  const [isInitialSplash, setIsInitialSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState<'chat' | 'documents' | 'members'>(getInitialTab);
  const [showLanding, setShowLanding] = useState<boolean>(getInitialShowLanding);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialSplash(false);
    }, APP_INITIAL_LOADER_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  const handleSelectTab = (tab: 'chat' | 'documents' | 'members') => {
    setCurrentTab(tab);
    setShowLanding(false);
    localStorage.setItem('knowflow_active_tab', tab);
    localStorage.setItem('knowflow_view', 'app');
    window.location.hash = tab;
  };

  const handleNavigateLanding = () => {
    setShowLanding(true);
    localStorage.setItem('knowflow_view', 'landing');
    window.location.hash = 'home';
  };

  const handleEnterApp = () => {
    setShowLanding(false);
    localStorage.setItem('knowflow_view', 'app');
    window.location.hash = currentTab;
  };

  // Sync with URL hash and query string
  useEffect(() => {
    const parseUrlState = () => {
      // 1. Check invite token
      const hash = window.location.hash;
      const hashMatch = hash.match(/#invite=([a-zA-Z0-9_-]+)/);
      if (hashMatch) {
        setInviteToken(hashMatch[1]);
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const tokenParam = searchParams.get('invite') || searchParams.get('token');
      if (tokenParam) {
        setInviteToken(tokenParam);
        return;
      }
      setInviteToken(null);

      // 2. Check tab / landing navigation in hash
      const lowerHash = hash.toLowerCase();
      if (
        lowerHash.includes('home') ||
        lowerHash.includes('landing') ||
        lowerHash.includes('features') ||
        lowerHash.includes('how-it-works') ||
        lowerHash.includes('security')
      ) {
        setShowLanding(true);
        localStorage.setItem('knowflow_view', 'landing');
      } else if (lowerHash.includes('documents')) {
        setShowLanding(false);
        setCurrentTab('documents');
        localStorage.setItem('knowflow_view', 'app');
        localStorage.setItem('knowflow_active_tab', 'documents');
      } else if (lowerHash.includes('members') || lowerHash.includes('team')) {
        setShowLanding(false);
        setCurrentTab('members');
        localStorage.setItem('knowflow_view', 'app');
        localStorage.setItem('knowflow_active_tab', 'members');
      } else if (lowerHash.includes('chat')) {
        setShowLanding(false);
        setCurrentTab('chat');
        localStorage.setItem('knowflow_view', 'app');
        localStorage.setItem('knowflow_active_tab', 'chat');
      }
    };

    parseUrlState();
    window.addEventListener('hashchange', parseUrlState);
    window.addEventListener('popstate', parseUrlState);
    return () => {
      window.removeEventListener('hashchange', parseUrlState);
      window.removeEventListener('popstate', parseUrlState);
    };
  }, []);

  // 1. Initial Application Splash Screen (Configurable 3-second loader on startup / URL open)
  if (isInitialSplash) {
    return <AppInitialLoader />;
  }

  // 2. Handle invitation view
  if (inviteToken) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#1B1F27]">
        <InviteAcceptView
          token={inviteToken}
          onSuccess={(wsId) => {
            window.location.hash = '';
            setInviteToken(null);
            setShowLanding(false);
            localStorage.setItem('knowflow_view', 'app');
            if (wsId) {
              setActiveWorkspaceId(wsId);
            }
          }}
          onOpenAuth={(mode) => openAuthModal(mode)}
          onGoHome={() => {
            window.location.hash = 'home';
            setInviteToken(null);
            setShowLanding(true);
            localStorage.setItem('knowflow_view', 'landing');
          }}
        />
        <LoginModal />
      </div>
    );
  }

  // 3. If auth is still checking
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex flex-col items-center justify-center gap-5 text-[#1B1F27]">
        <div className="w-14 h-14 rounded-2xl bg-white border border-[#DDD9CC] shadow-sm flex items-center justify-center text-[#2E6F5E]">
          <Sparkles className="w-7 h-7 animate-pulse text-[#2E6F5E]" />
        </div>
        <div className="loader my-1" />
        <p className="text-xs font-medium text-[#5B6270]">Initializing KnowFlow AI session...</p>
      </div>
    );
  }

  // 4. If not logged in, or user explicitly requested to view the landing page
  if (!isAuthenticated || showLanding) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] text-[#1B1F27]">
        <HomePage onEnterApp={handleEnterApp} />
        <LoginModal />
      </div>
    );
  }

  // 5. If logged in, but workspaces are still loading
  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F0] flex flex-col items-center justify-center gap-5 text-[#1B1F27]">
        <div className="loader my-1" />
        <p className="text-xs font-medium text-[#5B6270]">Loading your knowledge workspaces...</p>
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
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F6F5F0]">
        <AppHeader
          currentTab={currentTab}
          onNavigateLanding={handleNavigateLanding}
          onOpenCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
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
