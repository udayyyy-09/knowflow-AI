export type MessageRole = 'user' | 'assistant' | 'system' | 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface CitationSource {
  citation_index?: number;
  source_id?: number;
  chunk_id?: string;
  document_id?: string;
  document_title: string;
  original_filename?: string;
  section?: string;
  section_header?: string;
  page_number?: number | null;
  similarity?: number;
  similarity_score?: number;
  snippet?: string;
  content?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  total_tokens?: number;
  latency_ms?: number;
  model_name?: string;
  error_message?: string;
  sources?: CitationSource[];
  citations?: CitationSource[];
  isStreaming?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  workspace_id?: string;
  messages_count?: number;
  last_message_preview?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}
