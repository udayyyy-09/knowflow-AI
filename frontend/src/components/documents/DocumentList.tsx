import React, { useState } from 'react';
import type { Document } from '@/types/document';
import { DocumentStatusBadge } from '@/components/documents/DocumentStatusBadge';
import { Button } from '@/components/common/Button';
import { 
  FileText, 
  FileCode, 
  FileSpreadsheet, 
  Layers, 
  Trash2, 
  Search, 
  Calendar, 
  HardDrive,
  UploadCloud
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';

interface DocumentListProps {
  documents: Document[];
  loading: boolean;
  onInspectChunks: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  onOpenUpload: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  loading,
  onInspectChunks,
  onDelete,
  onOpenUpload,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const getFileIcon = (fileType: string) => {
    switch (fileType?.toUpperCase()) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'CSV':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'MD':
      case 'TXT':
      case 'MARKDOWN':
        return <FileCode className="w-5 h-5 text-blue-400" />;
      default:
        return <FileText className="w-5 h-5 text-brand-400" />;
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.file_type.toLowerCase().includes(search.toLowerCase());

    const isProcessed =
      doc.status === 'READY' ||
      doc.status === 'PROCESSED' ||
      doc.status === 'COMPLETED';

    const isProcessing =
      doc.status === 'PROCESSING' ||
      doc.status === 'EMBEDDING' ||
      doc.status === 'QUEUED' ||
      doc.status === 'UPLOADED' ||
      doc.status === 'PENDING';

    const isFailed = doc.status === 'FAILED';

    let matchesStatus = true;
    if (statusFilter === 'PROCESSED') {
      matchesStatus = isProcessed;
    } else if (statusFilter === 'PROCESSING') {
      matchesStatus = isProcessing;
    } else if (statusFilter === 'FAILED') {
      matchesStatus = isFailed;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C93A0]" />
          <input
            type="text"
            placeholder="Search documents by title or extension..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#DDD9CC] rounded-xl text-sm text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#1B1F27] transition shadow-xs"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'PROCESSED', 'PROCESSING', 'FAILED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === status
                  ? 'bg-[#1B1F27] text-white shadow-xs'
                  : 'bg-white text-[#5B6270] hover:text-[#1B1F27] border border-[#DDD9CC]'
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Documents View Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-[#5B6270]">Loading workspace knowledge documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-[#DDD9CC] shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-[#1B1F27] mb-1">
            {search || statusFilter !== 'ALL'
              ? 'No documents matched your filter'
              : 'No documents in this workspace yet'}
          </h3>
          <p className="text-sm text-[#5B6270] max-w-md mx-auto mb-6">
            Upload policies, technical manuals, onboarding guides, or product specs to empower your RAG assistant.
          </p>
          <Button variant="primary" onClick={onOpenUpload}>
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const count = doc.chunks_count ?? doc.chunk_count ?? 0;
            return (
              <div
                key={doc.id}
                className="bg-white p-5 rounded-2xl border border-[#DDD9CC] hover:border-[#2E6F5E]/60 hover:shadow-md transition-all flex flex-col justify-between group shadow-xs"
              >
                <div>
                  {/* Top Row: Icon + Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC]">
                      {getFileIcon(doc.file_type)}
                    </div>
                    <DocumentStatusBadge
                      status={doc.status}
                      errorMessage={doc.error_message}
                    />
                  </div>

                  {/* Title & Metadata */}
                  <h4 className="font-semibold text-[#1B1F27] text-base leading-snug line-clamp-2 mb-2 group-hover:text-[#2E6F5E] transition">
                    {doc.title}
                  </h4>

                  <div className="space-y-1.5 text-xs text-[#5B6270] mb-4">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5 text-[#8C93A0]" />
                      <span>
                        {count} {count === 1 ? 'Chunk' : 'Chunks'} Indexed
                      </span>
                      <span>•</span>
                      <span className="uppercase font-mono text-[10px] bg-[#F6F5F0] px-1.5 py-0.5 rounded border border-[#DDD9CC] text-[#1B1F27]">
                        {doc.file_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#8C93A0]" />
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-[#DDD9CC]/60 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onInspectChunks(doc)}
                    className="text-xs flex items-center gap-1.5 flex-1 justify-center border-[#DDD9CC] hover:bg-[#F6F5F0]"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#2E6F5E]" />
                    Chunks ({count})
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(doc)}
                    className="p-2 text-[#5B6270] hover:text-red-600 hover:bg-red-50"
                    title="Delete Document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
