import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { chatApi } from '@/api/chat';
import { documentsApi } from '@/api/documents';
import type { Conversation, Message, CitationSource } from '@/types/chat';
import type { Document } from '@/types/document';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { CitationDetailModal } from '@/components/chat/CitationDetailModal';

// Clean filename into human readable subject
const formatDocTitle = (rawTitle: string): string => {
  return rawTitle
    .replace(/\.[a-zA-Z0-9]+$/, '') // remove .pdf, .docx, .md, .txt
    .replace(/[_-]+/g, ' ') // replace underscores/hyphens with spaces
    .replace(/\s+/g, ' ')
    .trim();
};

export const ChatView: React.FC = () => {
  const { activeWorkspace } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobileConvSidebarOpen, setIsMobileConvSidebarOpen] = useState(false);
  
  // Citation Modal state
  const [selectedCitation, setSelectedCitation] = useState<{
    sourceId: number;
    citation: CitationSource | null;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load active workspace documents for dynamic suggestion pills
  useEffect(() => {
    if (!activeWorkspace || !activeWorkspace.id) {
      setDocuments([]);
      return;
    }
    const loadDocs = async () => {
      try {
        const docs = await documentsApi.list(activeWorkspace.id);
        setDocuments(docs);
      } catch (err) {
        console.error('Failed to load documents for dynamic suggestions:', err);
      }
    };
    loadDocs();
  }, [activeWorkspace?.id]);

  // Derive smart question pills from active workspace documents
  const dynamicSuggestions = useMemo(() => {
    const activeDocs = documents.filter(
      (d) => d.status !== 'ARCHIVED' && d.status !== 'FAILED'
    );
    if (activeDocs.length === 0) return [];

    const cleanTitles = activeDocs.map((d) => formatDocTitle(d.title));
    const pills: string[] = [];

    if (cleanTitles.length === 1) {
      const title = cleanTitles[0];
      pills.push(`Summarize the key points in ${title}`);
      pills.push(`What are the core policies and rules in ${title}?`);
      pills.push(`Explain the main procedures in ${title}`);
    } else if (cleanTitles.length === 2) {
      pills.push(`Summarize the key points in ${cleanTitles[0]}`);
      pills.push(`What guidelines are outlined in ${cleanTitles[1]}?`);
      pills.push(`Compare policies between ${cleanTitles[0]} and ${cleanTitles[1]}`);
    } else {
      pills.push(`Summarize ${cleanTitles[0]}`);
      pills.push(`What are the key rules in ${cleanTitles[1]}?`);
      pills.push(`Explain the guidelines in ${cleanTitles[2]}`);
      if (cleanTitles.length > 3) {
        pills.push(`What does ${cleanTitles[3]} cover?`);
      }
    }

    return pills.slice(0, 4);
  }, [documents]);

  // Load conversations on workspace change
  const fetchConversations = useCallback(async () => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    setLoadingConversations(true);
    try {
      const data = await chatApi.listConversations(activeWorkspace.id);
      setConversations(data);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when activeConversationId changes
  useEffect(() => {
    if (!activeWorkspace || !activeWorkspace.id || !activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const detail = await chatApi.getConversation(activeConversationId);
        setMessages(detail.messages || []);
      } catch (err) {
        console.error('Failed to load conversation messages:', err);
      }
    };

    loadMessages();
  }, [activeWorkspace, activeConversationId]);

  const handleNewConversation = async () => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    try {
      const newConv = await chatApi.createConversation(activeWorkspace.id, 'New Conversation');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await chatApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeWorkspace || !activeWorkspace.id) return;

    let convId = activeConversationId;

    // If no active conversation, create one first
    if (!convId) {
      try {
        const newConv = await chatApi.createConversation(
          activeWorkspace.id,
          text.slice(0, 40)
        );
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        convId = newConv.id;
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        return;
      }
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content: text,
      created_at: new Date().toISOString(),
    };

    const initialAssistantMessage: Message = {
      id: `asst-${Date.now()}`,
      role: 'ASSISTANT',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';
    let citations: CitationSource[] = [];

    await chatApi.sendMessageStream(
      convId,
      text,
      {
        onToken: (delta: string) => {
          accumulatedContent += delta;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && (last.role === 'ASSISTANT' || last.role === 'assistant')) {
              updated[updated.length - 1] = {
                ...last,
                content: accumulatedContent,
              };
            }
            return updated;
          });
        },
        onCitations: (newCitations: CitationSource[]) => {
          citations = newCitations;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && (last.role === 'ASSISTANT' || last.role === 'assistant')) {
              updated[updated.length - 1] = {
                ...last,
                citations: newCitations,
              };
            }
            return updated;
          });
        },
        onDone: (data: { message_id: string; latency_ms?: number }) => {
          setIsStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && (last.role === 'ASSISTANT' || last.role === 'assistant')) {
              updated[updated.length - 1] = {
                ...last,
                id: data.message_id || last.id,
                content: accumulatedContent || last.content,
                citations: citations.length > 0 ? citations : last.citations || [],
                isStreaming: false,
                latency_ms: data.latency_ms,
                model_name: 'gemini-3.1-flash-lite',
              };
            }
            return updated;
          });
          // Update conversation title list
          fetchConversations();
        },
        onError: (error: string) => {
          setIsStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && (last.role === 'ASSISTANT' || last.role === 'assistant')) {
              updated[updated.length - 1] = {
                ...last,
                content:
                  accumulatedContent ||
                  `⚠️ Error: ${error || 'Failed to complete RAG response.'}`,
                isStreaming: false,
              };
            }
            return updated;
          });
        },
      },
      controller.signal
    );
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && (last.role === 'ASSISTANT' || last.role === 'assistant')) {
          updated[updated.length - 1] = {
            ...last,
            isStreaming: false,
          };
        }
        return updated;
      });
    }
  };

  const handleCitationClick = (sourceId: number, citation?: CitationSource) => {
    setSelectedCitation({
      sourceId,
      citation: citation || null,
    });
  };

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-[#F6F5F0] text-[#1B1F27]">
      {/* Conversations sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        loading={loadingConversations}
        isMobileOpen={isMobileConvSidebarOpen}
        onCloseMobile={() => setIsMobileConvSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <ChatWindow
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onStopStreaming={handleStopStreaming}
        onCitationClick={handleCitationClick}
        workspaceName={activeWorkspace?.name || 'Workspace'}
        suggestions={dynamicSuggestions}
        onToggleHistory={() => setIsMobileConvSidebarOpen(!isMobileConvSidebarOpen)}
        onNewChat={handleNewConversation}
      />

      {/* Citation Slide-over / Modal */}
      <CitationDetailModal
        isOpen={!!selectedCitation}
        onClose={() => setSelectedCitation(null)}
        citation={selectedCitation?.citation || null}
        sourceId={selectedCitation?.sourceId || null}
      />
    </div>
  );
};
