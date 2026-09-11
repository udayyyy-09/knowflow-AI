import React, { useState } from 'react';
import type { Conversation } from '@/types/chat';
import { Button } from '@/components/common/Button';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Search
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  loading: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  loading,
}) => {
  const [search, setSearch] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-72 border-r border-[#DDD9CC] bg-[#FDFCFA] flex flex-col h-full shrink-0 text-[#1B1F27]">
      {/* Top Header & New Chat Button */}
      <div className="p-4 border-b border-[#DDD9CC] space-y-3">
        <Button
          variant="primary"
          onClick={onNewConversation}
          className="w-full justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Conversation
        </Button>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6270]" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#DDD9CC] rounded-lg text-xs text-[#1B1F27] placeholder-[#5B6270] focus:outline-none focus:border-[#1B1F27] transition"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-[#5B6270]">Loading chats...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-[#5B6270]">
            {search ? 'No conversations found' : 'No previous conversations. Start a new one!'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-left relative ${
                  isActive
                    ? 'bg-white text-[#1B1F27] border border-[#DDD9CC] shadow-xs'
                    : 'text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#2E6F5E]' : 'text-[#5B6270] group-hover:text-[#1B1F27]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${isActive ? 'text-[#1B1F27]' : 'text-[#1B1F27]'}`}>
                      {conv.title || 'Untitled Conversation'}
                    </div>
                    <div className="text-[10px] text-[#5B6270] truncate mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Delete conversation action */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#5B6270] hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
