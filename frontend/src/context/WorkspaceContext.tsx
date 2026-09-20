import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Workspace, WorkspaceRole } from '@/types/workspace';
import { workspacesApi } from '@/api/workspaces';
import { useAuth } from '@/context/AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  loading: boolean;
  userRole?: WorkspaceRole;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshWorkspaces = useCallback(async () => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await workspacesApi.list();
      const wsList = Array.isArray(data) ? data : [];
      setWorkspaces(wsList);

      // Restore previously selected workspace if available
      const savedWsId = localStorage.getItem('knowflow_active_workspace_id');
      const found = (savedWsId && savedWsId !== 'undefined' ? wsList.find((w) => w.id === savedWsId) : null) || wsList[0] || null;
      setActiveWorkspace(found);
      if (found && found.id) {
        localStorage.setItem('knowflow_active_workspace_id', found.id);
      } else {
        localStorage.removeItem('knowflow_active_workspace_id');
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = (id: string) => {
    if (!id || id === 'undefined') return;
    const found = workspaces.find((w) => w.id === id) || null;
    setActiveWorkspace(found);
    if (found && found.id) {
      localStorage.setItem('knowflow_active_workspace_id', found.id);
    }
  };

  const createWorkspace = async (name: string, description?: string): Promise<Workspace> => {
    const newWs = await workspacesApi.create({ name, description });
    await refreshWorkspaces();
    if (newWs && newWs.id) {
      setActiveWorkspace(newWs);
      localStorage.setItem('knowflow_active_workspace_id', newWs.id);
    }
    return newWs;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        isLoading,
        loading: isLoading,
        userRole: activeWorkspace?.user_role || activeWorkspace?.current_user_role || 'EMPLOYEE',
        setActiveWorkspaceId,
        refreshWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
