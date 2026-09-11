import React, { useRef, useEffect } from 'react';
import type { Message, CitationSource } from '@/types/chat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  Lock,
  MessageSquare,
  Plus
} from 'lucide-react';

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onCitationClick: (sourceId: number, citation?: CitationSource) => void;
  workspaceName: string;
  suggestions?: string[];
  onToggleHistory?: () => void;
  onNewChat?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isStreaming,
  onSendMessage,
  onStopStreaming,
  onCitationClick,
  workspaceName,
  suggestions = [],
  onToggleHistory,
  onNewChat,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F6F5F0] overflow-hidden relative text-[#1B1F27]">
      {/* Mobile-Only Top Action Bar */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-2 border-b border-[#DDD9CC] bg-[#FDFCFA] text-xs font-semibold">
        <button
          onClick={onToggleHistory}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#ECE9DF] text-[#1B1F27] hover:bg-[#DDD9CC] transition"
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#2E6F5E]" />
          <span>Chat History</span>
        </button>

        {onNewChat && (
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1B1F27] text-white hover:bg-[#2E6F5E] transition text-[11px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4 py-8 space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1B1F27] flex items-center justify-center text-[#F6F5F0] shadow-sm">
              <Sparkles className="w-7 h-7 text-[#F6F5F0]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1B1F27] tracking-tight">
                Ask <span className="text-[#2E6F5E]">{workspaceName}</span> Knowledge
              </h2>
              <p className="text-sm text-[#5B6270] leading-relaxed">
                KnowFlow AI delivers strictly grounded enterprise answers backed by pgvector semantic retrieval and real-time verifiable inline citations.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left pt-2">
              <div className="bg-white p-3.5 rounded-xl border border-[#DDD9CC] shadow-2xs">
                <div className="text-[#2E6F5E] mb-1.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-[#1B1F27]">Strict Grounding</div>
                <div className="text-[11px] text-[#5B6270] mt-0.5">Zero ungrounded hallucinations</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-[#DDD9CC] shadow-2xs">
                <div className="text-[#A9772F] mb-1.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-[#1B1F27]">Inline Citations</div>
                <div className="text-[11px] text-[#5B6270] mt-0.5">Click [N] to inspect source text</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-[#DDD9CC] shadow-2xs">
                <div className="text-[#1B1F27] mb-1.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-[#1B1F27]">RBAC Isolation</div>
                <div className="text-[11px] text-[#5B6270] mt-0.5">Tenant-isolated vector store</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id || idx}
                message={msg}
                onCitationClick={onCitationClick}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Field */}
      <MessageInput
        onSendMessage={onSendMessage}
        disabled={false}
        isStreaming={isStreaming}
        onStop={onStopStreaming}
        suggestions={suggestions}
      />
    </div>
  );
};
