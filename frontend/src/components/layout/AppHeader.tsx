import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { Button } from '@/components/common/Button';
import { 
  LogOut, 
  ExternalLink
} from 'lucide-react';

interface AppHeaderProps {
  currentTab: 'chat' | 'documents' | 'members';
  onNavigateLanding?: () => void;
  onOpenCreateWorkspace: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onNavigateLanding,
  onOpenCreateWorkspace,
}) => {
  const { user, logout } = useAuth();
  const { userRole } = useWorkspace();

  const getTabTitle = () => {
    switch (currentTab) {
      case 'chat':
        return 'Knowledge Assistant';
      case 'documents':
        return 'Document Hub';
      case 'members':
        return 'Team & Permissions';
      default:
        return 'Workspace';
    }
  };

  const displayName = user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Knowledge User');
  const initial = displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className="h-16 border-b border-[#DDD9CC] bg-[#FDFCFA]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 text-[#1B1F27]">
      {/* Left section: Breadcrumb & Workspace Switcher */}
      <div className="flex items-center gap-4">
        <WorkspaceSwitcher onCreateWorkspaceClick={onOpenCreateWorkspace} />

        <div className="h-5 w-px bg-[#DDD9CC] hidden md:block" />

        <div className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-[#5B6270]">Section:</span>
          <span className="font-semibold text-[#1B1F27] px-2.5 py-0.5 rounded bg-[rgba(46,111,94,0.1)] text-[#2E6F5E] border border-[rgba(46,111,94,0.2)] text-xs">
            {getTabTitle()}
          </span>
          {userRole && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-[#DDD9CC] text-[#5B6270] font-mono font-medium">
              {userRole}
            </span>
          )}
        </div>
      </div>

      {/* Right section: User profile & Actions */}
      <div className="flex items-center gap-3">
        {onNavigateLanding && (
          <button
            onClick={onNavigateLanding}
            className="text-xs text-[#5B6270] hover:text-[#1B1F27] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#ECE9DF] border border-transparent hover:border-[#DDD9CC] transition cursor-pointer"
            title="View Landing Page"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden lg:inline font-medium">Home</span>
          </button>
        )}

        <div className="h-5 w-px bg-[#DDD9CC]" />

        {/* User Badge */}
        <div className="flex items-center gap-3 pl-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1B1F27] flex items-center justify-center text-[#F6F5F0] font-semibold text-xs shadow-xs">
              {initial}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-[#1B1F27] leading-tight">
                {displayName}
              </div>
              <div className="text-[10px] text-[#5B6270] truncate max-w-[120px] leading-tight">
                {user?.email}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-[#5B6270] hover:text-red-600 hover:bg-red-50 p-2 rounded-lg"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
