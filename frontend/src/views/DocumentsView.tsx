import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { documentsApi } from '@/api/documents';
import type { Document } from '@/types/document';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal';
import { ChunkDrawer } from '@/components/documents/ChunkDrawer';
import { Button } from '@/components/common/Button';
import { 
  UploadCloud, 
  Files, 
  Layers, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

import { clientCache } from '@/utils/clientCache';

export const DocumentsView: React.FC = () => {
  const { activeWorkspace, userRole } = useWorkspace();
  const canManageDocs = userRole === 'ADMIN' || userRole === 'MANAGER';
  const cacheKey = activeWorkspace?.id ? `docs_${activeWorkspace.id}` : '';
  const initialCachedDocs = cacheKey ? clientCache.get<Document[]>(cacheKey) : null;

  const [documents, setDocuments] = useState<Document[]>(initialCachedDocs || []);
  const [loading, setLoading] = useState(!initialCachedDocs);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  // Chunk inspection drawer state
  const [selectedDocForChunks, setSelectedDocForChunks] = useState<Document | null>(null);
  
  // Delete confirm state
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDocuments = useCallback(async (showLoading = true) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    if (showLoading && !clientCache.get(cacheKey)) {
      setLoading(true);
    }
    try {
      const data = await documentsApi.list(activeWorkspace.id);
      setDocuments(data);
      if (cacheKey) {
        clientCache.set(cacheKey, data);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, cacheKey]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchDocuments(false);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    // If cached data exists, revalidate quietly; otherwise show loader
    const hasCache = !!clientCache.get(cacheKey);
    fetchDocuments(!hasCache);
  }, [fetchDocuments, cacheKey]);

  // Polling when any document is in in-flight states
  useEffect(() => {
    const hasPendingOrProcessing = documents.some(
      (d) =>
        d.status === 'PENDING' ||
        d.status === 'PROCESSING' ||
        d.status === 'QUEUED' ||
        d.status === 'UPLOADED' ||
        d.status === 'EMBEDDING'
    );

    if (!hasPendingOrProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleDeleteConfirm = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !docToDelete) return;
    setIsDeleting(true);
    try {
      await documentsApi.delete(activeWorkspace.id, docToDelete.id);
      setDocToDelete(null);
      await fetchDocuments(false);
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats calculation
  const totalChunks = documents.reduce((acc, doc) => acc + (doc.chunks_count ?? doc.chunk_count ?? 0), 0);
  const processedDocs = documents.filter(
    (d) => d.status === 'READY' || d.status === 'PROCESSED' || d.status === 'COMPLETED'
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full bg-[#F6F5F0]">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F27] tracking-tight flex items-center gap-2">
            Knowledge Document Hub
          </h1>
          <p className="text-sm text-[#5B6270] mt-1">
            Ingest, manage, and inspect text embeddings powering your workspace RAG search.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center border-[#DDD9CC] bg-white hover:bg-[#F6F5F0] text-[#1B1F27] text-xs sm:text-sm font-medium shadow-xs"
            title="Refresh document processing status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2E6F5E]' : 'text-[#5B6270]'}`} />
            <span></span>
          </Button>
          {canManageDocs && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsUploadOpen(true)}
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#DDD9CC] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] flex items-center justify-center shrink-0">
            <Files className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B1F27]">{documents.length}</div>
            <div className="text-xs text-[#5B6270]">Total Documents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DDD9CC] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B1F27]">{processedDocs}</div>
            <div className="text-xs text-[#5B6270]">Indexed & Searchable</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DDD9CC] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#A9772F]/10 border border-[#A9772F]/20 text-[#8C5D1E] flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B1F27]">{totalChunks}</div>
            <div className="text-xs text-[#5B6270]">Total Vector Chunks</div>
          </div>
        </div>
      </div>

      {/* Document List with Search & Filtering */}
      <DocumentList
        documents={documents}
        loading={loading}
        canManageDocs={canManageDocs}
        onInspectChunks={(doc) => setSelectedDocForChunks(doc)}
        onDelete={(doc) => setDocToDelete(doc)}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          fetchDocuments(false);
        }}
      />

      {/* Chunk Inspection Drawer */}
      <ChunkDrawer
        documentId={selectedDocForChunks?.id || null}
        documentTitle={selectedDocForChunks?.title || ''}
        isOpen={!!selectedDocForChunks}
        onClose={() => setSelectedDocForChunks(null)}
      />

      {/* Delete Confirmation Dialog */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => !isDeleting && setDocToDelete(null)}
          />
          <div className="relative bg-[#FDFCFA] p-6 rounded-2xl border border-red-200 max-w-md w-full z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1B1F27]">Delete Document?</h3>
            </div>
            <p className="text-sm text-[#5B6270]">
              Are you sure you want to delete <span className="font-semibold text-[#1B1F27]">"{docToDelete.title}"</span>? This will permanently remove all associated vector embeddings from pgvector.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDocToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
