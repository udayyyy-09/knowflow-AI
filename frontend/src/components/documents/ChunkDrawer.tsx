import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { documentsApi } from '@/api/documents';
import type { DocumentChunk } from '@/types/document';
import { 
  X, 
  Layers, 
  Copy, 
  Check, 
  Search, 
  AlertCircle
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { Badge } from '@/components/common/Badge';

interface ChunkDrawerProps {
  documentId: string | null;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChunkDrawer: React.FC<ChunkDrawerProps> = ({
  documentId,
  documentTitle,
  isOpen,
  onClose,
}) => {
  const { activeWorkspace } = useWorkspace();
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && documentId && activeWorkspace && activeWorkspace.id) {
      loadChunks();
    } else {
      setChunks([]);
      setError(null);
      setSearchQuery('');
    }
  }, [isOpen, documentId, activeWorkspace]);

  const loadChunks = async () => {
    if (!activeWorkspace || !activeWorkspace.id || !documentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentsApi.listChunks(activeWorkspace.id, documentId);
      setChunks(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load vector chunks');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  const filteredChunks = chunks.filter((chunk) =>
    chunk.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chunk.section_header && chunk.section_header.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (chunk.metadata?.section && String(chunk.metadata.section).toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-[#FDFCFA] border-l border-[#DDD9CC] shadow-2xl h-screen max-h-screen inset-y-0 top-0 right-0 bottom-0 flex flex-col z-10 animate-in slide-in-from-right duration-300 rounded-none overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-[#DDD9CC] flex items-center justify-between shrink-0 bg-[#FDFCFA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 flex items-center justify-center text-[#2E6F5E] shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1B1F27] flex items-center gap-2">
                Vector Chunks Inspection
              </h3>
              <p className="text-xs text-[#5B6270] truncate max-w-md">
                Document: <span className="text-[#1B1F27] font-medium">{documentTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#F2EFE9] transition cursor-pointer"
            title="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & Search */}
        <div className="p-4 border-b border-[#DDD9CC] bg-[#F6F5F0] space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs text-[#5B6270]">
            <div className="flex items-center gap-2">
              <Badge variant="brand">{chunks.length} Total Chunks</Badge>
              <Badge variant="neutral">OpenAI text-embedding-3-small (1536d)</Badge>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C93A0]" />
            <input
              type="text"
              placeholder="Search within chunks text or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#DDD9CC] rounded-lg text-sm text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#1B1F27]"
            />
          </div>
        </div>

        {/* Chunk Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-[#5B6270]">Fetching pgvector embeddings...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-16 text-[#8C93A0] text-sm">
              {searchQuery ? 'No chunks matched your query' : 'No chunks available for this document yet.'}
            </div>
          ) : (
            filteredChunks.map((chunk) => {
              const section = chunk.section_header || (chunk.metadata?.section as string | undefined);
              const tokens = chunk.token_count || chunk.token_count_estimate;
              return (
                <div
                  key={chunk.id}
                  className="bg-white p-4 rounded-xl border border-[#DDD9CC] hover:border-[#2E6F5E]/60 transition shadow-xs group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20">
                        Chunk #{chunk.chunk_index}
                      </span>
                      {section && (
                        <span className="text-xs text-[#1B1F27] font-medium truncate max-w-xs">
                          § {section}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tokens && (
                        <span className="text-[11px] text-[#5B6270] font-mono">
                          {tokens} tokens
                        </span>
                      )}
                      <button
                        onClick={() => handleCopy(chunk.id, chunk.content)}
                        className="p-1 rounded text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#F2EFE9] transition"
                        title="Copy chunk text"
                      >
                        {copiedId === chunk.id ? (
                          <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#F6F5F0] rounded-lg p-3 border border-[#DDD9CC] text-xs text-[#1B1F27] font-mono leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {chunk.content}
                  </div>

                  {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-[#DDD9CC] flex flex-wrap gap-2 text-[10px] text-[#5B6270] font-mono">
                      {Object.entries(chunk.metadata).map(([k, v]) => (
                        <span key={k} className="bg-[#F6F5F0] px-2 py-0.5 rounded border border-[#DDD9CC] text-[#1B1F27]">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
