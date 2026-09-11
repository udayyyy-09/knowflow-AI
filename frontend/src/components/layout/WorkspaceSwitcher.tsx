import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Briefcase } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

interface WorkspaceSwitcherProps {
  onCreateWorkspaceClick: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onCreateWorkspaceClick }) => {
  const { workspaces, activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#ECE9DF] border border-[#DDD9CC] text-xs font-semibold text-[#1B1F27] transition-colors shadow-2xs cursor-pointer"
      >
        <div className="w-5 h-5 rounded-md bg-[rgba(46,111,94,0.12)] text-[#2E6F5E] flex items-center justify-center font-bold">
          <Briefcase className="w-3 h-3" />
        </div>
        <span className="max-w-[140px] truncate font-semibold">
          {activeWorkspace?.name || 'Select Workspace'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#5B6270]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-[#FDFCFA] rounded-2xl p-1.5 shadow-xl border border-[#DDD9CC] z-50 animate-slide-up text-[#1B1F27]">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#5B6270] border-b border-[#DDD9CC]">
            Your Workspaces
          </div>

          <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#1B1F27] text-[#F6F5F0]' : 'text-[#1B1F27] hover:bg-[#ECE9DF]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#ECE9DF] text-[#1B1F27]'
                    }`}>
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{ws.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#2E6F5E] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-1.5 mt-1 border-t border-[#DDD9CC]">
            <button
              onClick={() => {
                setIsOpen(false);
                onCreateWorkspaceClick();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#2E6F5E] hover:bg-[rgba(46,111,94,0.1)] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
