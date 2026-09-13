import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { documentsApi } from '@/api/documents';
import type { Document } from '@/types/document';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal';
import { DocumentPreviewModal } from '@/components/documents/DocumentPreviewModal';
import { Button } from '@/components/common/Button';
import { 
  UploadCloud, 
  Files, 
  HardDrive, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Check,
  X
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
  
  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  
  // Delete confirm state
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Floating Toast Notification
  const [toast, setToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const handleDownload = async (doc: Document) => {
    if (!activeWorkspace || !activeWorkspace.id) return;

    // RBAC Check: Only Admins can download source files
    if (userRole !== 'ADMIN') {
      setToast({
        type: 'warning',
        message: 'Only workspace admins can download source documents',
      });
      return;
    }

    try {
      const { blob, filename } = await documentsApi.downloadFileBlob(activeWorkspace.id, doc.id, false);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${doc.title}.${doc.file_type.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setToast({ type: 'success', message: `Downloaded "${doc.title}"` });
    } catch (err: any) {
      console.error('Failed to download document:', err);
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        'Only workspace admins can download source documents';
      setToast({ type: 'error', message: errMsg });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !docToDelete) return;
    setIsDeleting(true);
    try {
      await documentsApi.delete(activeWorkspace.id, docToDelete.id);
      setDocToDelete(null);
      await fetchDocuments(false);
      setToast({ type: 'success', message: 'Document removed from workspace' });
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      const errMsg = err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to delete document';
      setToast({ type: 'error', message: errMsg });
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats calculation
  const processedDocs = documents.filter(
    (d) => d.status === 'READY' || d.status === 'PROCESSED' || d.status === 'COMPLETED'
  ).length;

  const totalSizeBytes = documents.reduce((acc, doc) => {
    const bytes = doc.active_version?.file_size_bytes || doc.latest_version?.file_size_bytes || 0;
    return acc + bytes;
  }, 0);

  const formatTotalSize = (bytes: number) => {
    if (bytes === 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalStorageFormatted = formatTotalSize(totalSizeBytes);

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full bg-[#F6F5F0] relative">
      {/* Floating Toast Notification in Top-Right Corner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-auto animate-in slide-in-from-top-3 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl border text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-[#1B1F27] text-white border-[rgba(46,111,94,0.4)] shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
                : toast.type === 'warning'
                ? 'bg-amber-950 text-amber-50 border-amber-800 shadow-[0_10px_30px_rgba(217,119,6,0.25)]'
                : 'bg-red-950 text-red-50 border-red-800 shadow-[0_10px_30px_rgba(220,38,38,0.25)]'
            }`}
          >
            {toast.type === 'success' ? (
              <div className="w-6 h-6 rounded-full bg-[#2E6F5E] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              </div>
            ) : (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'warning' ? 'bg-amber-600' : 'bg-red-600'}`}>
                <AlertCircle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              </div>
            )}
            <span className="flex-1 pr-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1F27] tracking-tight flex items-center gap-2">
            Knowledge Document Hub
          </h1>
          <p className="text-sm text-[#5B6270] mt-1">
            Ingest, preview, and organize knowledge assets powering your workspace RAG search.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center border-[#DDD9CC] bg-white hover:bg-[#F6F5F0] text-[#1B1F27] text-xs sm:text-sm font-medium shadow-xs cursor-pointer"
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
            <div className="text-xs text-[#5B6270]">Search-Ready Documents</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DDD9CC] flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#A9772F]/10 border border-[#A9772F]/20 text-[#8C5D1E] flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B1F27]">{totalStorageFormatted}</div>
            <div className="text-xs text-[#5B6270]">Total Knowledge Storage</div>
          </div>
        </div>
      </div>

      {/* Document List with Search & Filtering */}
      <DocumentList
        documents={documents}
        loading={loading}
        canManageDocs={canManageDocs}
        onPreview={(doc) => setPreviewDoc(doc)}
        onDownload={(doc) => handleDownload(doc)}
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

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownloadClick={(doc) => handleDownload(doc)}
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
              Are you sure you want to delete <span className="font-semibold text-[#1B1F27]">"{docToDelete.title}"</span>? This will permanently remove all associated vector embeddings from the workspace.
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

