import React from 'react';
import { 
  MessageSquare, 
  Files, 
  Users, 
  PanelLeftClose, 
  PanelLeftOpen
} from 'lucide-react';

interface AppSidebarProps {
  currentTab: 'chat' | 'documents' | 'members';
  onSelectTab: (tab: 'chat' | 'documents' | 'members') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'chat' as const,
      label: 'RAG Assistant',
      description: 'Streamed Q&A with citations',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      id: 'documents' as const,
      label: 'Knowledge Hub',
      description: 'Ingest & inspect chunks',
      icon: Files,
    },
    {
      id: 'members' as const,
      label: 'Access Control',
      description: 'Roles & workspace members',
      icon: Users,
    },
  ];

  const handleTabClick = (tabId: 'chat' | 'documents' | 'members') => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Top Header & Logo */}
        <div className={`h-16 border-b border-[#DDD9CC] flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#1B1F27] flex items-center justify-center text-white text-xs font-serif font-black shadow-xs shrink-0">
              K
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="truncate">
                <div className="font-bold text-[#1B1F27] tracking-tight flex items-center gap-1.5 text-sm">
                  <span>KnowFlow-AI</span>
                  
                </div>
                <div className="text-[10px] text-[#5B6270] font-mono leading-tight">Enterprise RAG</div>
              </div>
            )}
          </div>

          {/* Sidebar Collapse / Close Button */}
          {!isCollapsed && !isMobileOpen && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition-colors cursor-pointer hidden md:block"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition-colors cursor-pointer md:hidden"
              title="Close menu"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="p-3 space-y-1.5">
          {(!isCollapsed || isMobileOpen) && (
            <div className="px-3 py-1 text-[10px] font-bold text-[#5B6270] uppercase tracking-wider">
              Workspace Hub
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const showDetails = !isCollapsed || isMobileOpen;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                title={!showDetails ? `${item.label} — ${item.description}` : undefined}
                className={`w-full text-left rounded-xl transition-all flex items-center group relative cursor-pointer ${
                  !showDetails ? 'justify-center p-3' : 'px-3 py-2.5 gap-3'
                } ${
                  isActive
                    ? 'bg-[#1B1F27] text-[#F6F5F0] shadow-sm'
                    : 'text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] border border-transparent'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    isActive
                      ? 'bg-[#2E6F5E] text-white'
                      : 'bg-[#ECE9DF] text-[#5B6270] group-hover:text-[#1B1F27]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {showDetails && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-inherit truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            isActive
                              ? 'bg-[rgba(46,111,94,0.4)] text-emerald-300'
                              : 'bg-[rgba(46,111,94,0.12)] text-[#2E6F5E] border border-[rgba(46,111,94,0.25)]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-[#DDD9CC]' : 'text-[#5B6270]'}`}>
                      {item.description}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Area with Expand Button if collapsed */}
      {isCollapsed && !isMobileOpen && (
        <div className="p-3 border-t border-[#DDD9CC] flex justify-center hidden md:flex">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-xl text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition-colors cursor-pointer w-full flex items-center justify-center"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`border-r border-[#DDD9CC] bg-[#FDFCFA] hidden md:flex flex-col justify-between h-screen sticky top-0 shrink-0 text-[#1B1F27] transition-all duration-300 ease-in-out z-40 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="relative w-72 max-w-[80vw] bg-[#FDFCFA] border-r border-[#DDD9CC] shadow-2xl h-full flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
