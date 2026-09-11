import React, { useState } from 'react';
import { Briefcase, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useWorkspace } from '@/context/WorkspaceContext';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ isOpen, onClose }) => {
  const { createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      await createWorkspace(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.message || err.message || 'Failed to create workspace.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Workspace"
      description="Workspaces isolate documents, vectors, and chats into distinct team boundaries."
      maxWidth="md"
    >
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#1B1F27] mb-1">
            Workspace Name <span className="text-[#2E6F5E]">*</span>
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-[#8C93A0] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Legal & Compliance, HR Policies"
              className="w-full bg-white border border-[#DDD9CC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#1B1F27] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1B1F27] mb-1">
            Description <span className="text-[#8C93A0]">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What knowledge documents will be stored in this workspace?"
            className="w-full bg-white border border-[#DDD9CC] rounded-xl p-3 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#1B1F27] transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
};
