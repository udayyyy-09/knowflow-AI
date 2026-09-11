import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, CitationSource } from '@/types/chat';
import { CitationBadge } from '@/components/chat/CitationBadge';
import { 
  Bot, 
  User as UserIcon, 
  Copy, 
  Check, 
  Layers
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (sourceId: number, citation?: CitationSource) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onCitationClick,
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'USER' || message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const citationsList = message.citations || message.sources || [];

  // Find citation object by source_id number or index
  const findCitation = (id: number): CitationSource | undefined => {
    return citationsList.find((c) => (c.source_id ?? c.citation_index) === id);
  };

  // Custom Markdown renderer with interactive citation tags
  const renderCustomContent = (content: string) => {
    if (!content && message.isStreaming) {
      return (
        <div className="flex items-center gap-2 text-[#2E6F5E] text-sm py-1">
          <Spinner size="sm" />
          <span className="animate-pulse font-medium">Retrieving grounded context and generating answer...</span>
        </div>
      );
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            return (
              <p className="mb-3 last:mb-0 leading-relaxed text-sm text-[#1B1F27]">
                {React.Children.map(children, (child) => {
                  if (typeof child === 'string') {
                    const parts = child.split(/(\[\d+\])/g);
                    return parts.map((part, index) => {
                      const match = part.match(/^\[(\d+)\]$/);
                      if (match) {
                        const num = parseInt(match[1], 10);
                        const citation = findCitation(num);
                        return (
                          <CitationBadge
                            key={index}
                            sourceId={num}
                            citation={citation}
                            onClick={onCitationClick}
                          />
                        );
                      }
                      return part;
                    });
                  }
                  return child;
                })}
              </p>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm text-[#1B1F27]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm text-[#1B1F27]">
              {children}
            </ol>
          ),
          li: ({ children }) => {
            return (
              <li className="leading-relaxed text-[#1B1F27]">
                {React.Children.map(children, (child) => {
                  if (typeof child === 'string') {
                    const parts = child.split(/(\[\d+\])/g);
                    return parts.map((part, index) => {
                      const match = part.match(/^\[(\d+)\]$/);
                      if (match) {
                        const num = parseInt(match[1], 10);
                        const citation = findCitation(num);
                        return (
                          <CitationBadge
                            key={index}
                            sourceId={num}
                            citation={citation}
                            onClick={onCitationClick}
                          />
                        );
                      }
                      return part;
                    });
                  }
                  return child;
                })}
              </li>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-[#1B1F27]">{children}</strong>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="p-3 my-2 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#1B1F27] font-mono overflow-x-auto">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-[#F6F5F0] border border-[#DDD9CC] text-[#2E6F5E] font-mono text-xs">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 mb-6 group">
        <div className="max-w-2xl bg-[#1B1F27] text-[#F6F5F0] p-4 rounded-2xl rounded-tr-sm shadow-sm border border-[#1B1F27]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {message.content}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-white border border-[#DDD9CC] flex items-center justify-center text-[#1B1F27] shrink-0 font-bold text-xs shadow-xs">
          <UserIcon className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6 group">
      <div className="w-8 h-8 rounded-xl bg-[#1B1F27] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
        <Bot className="w-4 h-4 text-[#F6F5F0]" />
      </div>

      <div className="flex-1 max-w-3xl">
        <div className="bg-white p-5 rounded-2xl rounded-tl-sm border border-[#DDD9CC] shadow-xs relative group/panel">
          {renderCustomContent(message.content)}

          {citationsList.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-[#DDD9CC]">
              <div className="text-[11px] font-bold text-[#5B6270] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#2E6F5E]" />
                Referenced Knowledge Sources ({citationsList.length})
              </div>

              <div className="flex flex-wrap gap-2">
                {citationsList.map((c: CitationSource, idx: number) => {
                  const sourceNum = c.source_id ?? c.citation_index ?? idx + 1;
                  const simScore = c.similarity ?? c.similarity_score ?? 0;
                  return (
                    <button
                      key={sourceNum}
                      onClick={() => onCitationClick(sourceNum, c)}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F6F5F0] hover:bg-[#ECE9DF] border border-[#DDD9CC] hover:border-[#1B1F27] text-xs text-[#1B1F27] transition group/source cursor-pointer"
                    >
                      <span className="font-mono font-bold text-[#A9772F]">
                        [{sourceNum}]
                      </span>
                      <span className="truncate max-w-[180px] font-medium">
                        {c.document_title}
                      </span>
                      {simScore > 0 && (
                        <span className="text-[10px] text-[#2E6F5E] font-mono font-bold">
                          {(simScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="absolute top-3 right-3 opacity-0 group-hover/panel:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-white border border-[#DDD9CC] text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition shadow-xs cursor-pointer"
              title="Copy answer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* <div className="flex items-center gap-3 px-1 mt-1.5 text-[11px] text-[#5B6270] font-mono">
          {message.latency_ms && (
            <span className="flex items-center gap-1 text-[#2E6F5E] font-semibold">
              <Clock className="w-3 h-3" />
              {message.latency_ms}ms
            </span>
          )}

          {message.total_tokens && (
            <span className="flex items-center gap-1 text-[#5B6270]">
              <Sparkles className="w-3 h-3 text-[#A9772F]" />
              {message.total_tokens} tokens
            </span>
          )}

          {message.model_name && (
            <span className="text-[#5B6270]">
              • {message.model_name}
            </span>
          )}
        </div> */}
      </div>
    </div>
  );
};
