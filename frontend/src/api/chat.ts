import { apiClient, API_BASE_URL } from '@/api/client';
import type { Conversation, ConversationDetail, Message, CitationSource } from '@/types/chat';

export interface StreamCallbacks {
  onToken: (delta: string) => void;
  onCitations: (citations: CitationSource[]) => void;
  onDone: (metadata: { message_id: string; latency_ms?: number; response?: string; citations?: CitationSource[]; total_tokens?: number; model_name?: string }) => void;
  onError: (error: string) => void;
}

export const chatApi = {
  async listConversations(workspaceId: string): Promise<Conversation[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/conversations/`);
    const items = res.data.data || res.data.results || res.data.conversations || res.data;
    return Array.isArray(items) ? items : [];
  },

  async createConversation(workspaceId: string, title?: string): Promise<Conversation> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.post(`/workspaces/${workspaceId}/conversations/`, { title });
    return res.data.data || res.data.conversation || res.data;
  },

  async getConversation(conversationId: string): Promise<ConversationDetail> {
    if (!conversationId || conversationId === 'undefined') throw new Error('Invalid conversation ID');
    const res = await apiClient.get(`/conversations/${conversationId}/`);
    return res.data.data || res.data.conversation || res.data;
  },

  async deleteConversation(conversationId: string): Promise<void> {
    if (!conversationId || conversationId === 'undefined') return;
    await apiClient.delete(`/conversations/${conversationId}/`);
  },

  async sendMessageSync(conversationId: string, content: string): Promise<{ message: Message; citations_count: number }> {
    const res = await apiClient.post(`/conversations/${conversationId}/messages/`, { content, stream: false });
    return res.data;
  },

  async sendMessageStream(
    conversationId: string,
    content: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const token = localStorage.getItem('knowflow_access_token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages/?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content, stream: true }),
        signal,
      });

      if (!response.ok) {
        let errMessage = response.statusText;
        try {
          const errData = await response.json();
          errMessage = errData.error?.message || errData.message || response.statusText;
        } catch (e) {
          // Fallback to text
        }
        callbacks.onError(`Request failed (${response.status}): ${errMessage}`);
        return;
      }

      if (!response.body) {
        callbacks.onError('ReadableStream not supported by browser or response body is empty.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || ''; // Keep incomplete trailing fragment

        for (const block of blocks) {
          if (!block.trim()) continue;

          const eventMatch = block.match(/event:\s*([a-zA-Z0-9_-]+)/);
          const dataMatch = block.match(/data:\s*(.*)/s);

          const eventType = eventMatch ? eventMatch[1] : 'message';
          const rawData = dataMatch ? dataMatch[1].trim() : '';

          if (eventType === 'token') {
            try {
              const parsed = JSON.parse(rawData);
              if (parsed.delta) {
                callbacks.onToken(parsed.delta);
              }
            } catch (e) {
              // Ignore single JSON parse errors in stream
            }
          } else if (eventType === 'citations') {
            try {
              const citations = JSON.parse(rawData);
              if (Array.isArray(citations)) {
                callbacks.onCitations(citations);
              }
            } catch (e) {
              // Ignore
            }
          } else if (eventType === 'done') {
            try {
              const doneMeta = JSON.parse(rawData);
              callbacks.onDone(doneMeta);
            } catch (e) {
              callbacks.onDone({ message_id: '' });
            }
          } else if (eventType === 'error') {
            try {
              const errObj = JSON.parse(rawData);
              callbacks.onError(errObj.error || 'Stream error occurred.');
            } catch (e) {
              callbacks.onError(rawData || 'Stream error occurred.');
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stream aborted by user
        return;
      }
      callbacks.onError(err.message || 'Stream connection error.');
    }
  }
};
