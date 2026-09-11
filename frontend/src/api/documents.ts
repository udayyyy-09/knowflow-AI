import { apiClient } from '@/api/client';
import type { Document, DocumentChunk, DocumentVersion } from '@/types/document';

export const documentsApi = {
  async list(workspaceId: string, params?: { status?: string; file_type?: string; search?: string }): Promise<Document[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/documents/`, { params });
    const items = res.data.data || res.data.results || res.data.documents || res.data;
    return Array.isArray(items) ? items : [];
  },

  async upload(workspaceId: string, file: File, title?: string, description?: string): Promise<Document> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (description) formData.append('description', description);

    const res = await apiClient.post(`/workspaces/${workspaceId}/documents/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data || res.data.document || res.data;
  },

  async get(workspaceId: string, documentId: string): Promise<Document> {
    if (!workspaceId || workspaceId === 'undefined') throw new Error('Invalid workspace ID');
    const res = await apiClient.get(`/workspaces/${workspaceId}/documents/${documentId}/`);
    return res.data.data || res.data.document || res.data;
  },

  async listVersions(workspaceId: string, documentId: string): Promise<DocumentVersion[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/documents/${documentId}/versions/`);
    const items = res.data.data || res.data.results || res.data.versions || res.data;
    return Array.isArray(items) ? items : [];
  },

  async listChunks(workspaceId: string, documentId: string): Promise<DocumentChunk[]> {
    if (!workspaceId || workspaceId === 'undefined') return [];
    const res = await apiClient.get(`/workspaces/${workspaceId}/documents/${documentId}/chunks/`);
    const items = res.data.data || res.data.results || res.data.chunks || res.data;
    return Array.isArray(items) ? items : [];
  },

  async delete(workspaceId: string, documentId: string): Promise<void> {
    if (!workspaceId || workspaceId === 'undefined') return;
    await apiClient.delete(`/workspaces/${workspaceId}/documents/${documentId}/`);
  },

  async reprocess(workspaceId: string, documentId: string): Promise<void> {
    if (!workspaceId || workspaceId === 'undefined') return;
    await apiClient.post(`/workspaces/${workspaceId}/documents/${documentId}/reprocess/`);
  }
};
