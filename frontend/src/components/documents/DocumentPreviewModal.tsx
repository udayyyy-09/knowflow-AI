import React, { useState, useEffect } from 'react';
import type { Document } from '@/types/document';
import { documentsApi } from '@/api/documents';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  AlertCircle, 
  FileCode,
  FileSpreadsheet,
  FileCheck,
  ShieldCheck,
  Copy,
  Check,
  BookOpen
} from 'lucide-react';

interface DocumentPreviewModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onDownloadClick?: (doc: Document) => void;
  targetPage?: number | null;
  citationNum?: number;
  highlightSnippet?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  isOpen,
  onClose,
  onDownloadClick,
  targetPage,
  citationNum,
  highlightSnippet,
}) => {
  const { activeWorkspace, userRole } = useWorkspace();
  const [textContent, setTextContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const fileType = document?.file_type?.toUpperCase() || 'OTHER';
  const isPdf = fileType === 'PDF';
  const isTextBased = ['TXT', 'MD', 'MARKDOWN', 'CSV', 'JSON', 'LOG', 'XML', 'YAML', 'YML'].includes(fileType);

  useEffect(() => {
    if (!isOpen || !document || !activeWorkspace) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setTextContent(null);
      setBlobUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch document stream using authenticated Bearer token
    documentsApi
      .downloadFileBlob(activeWorkspace.id, document.id, true)
      .then(async ({ blob }) => {
        if (isTextBased) {
          const text = await blob.text();
          setTextContent(text);
        } else if (isPdf) {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          const url = URL.createObjectURL(pdfBlob);
          setBlobUrl(url);
        } else {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      })
      .catch((err: any) => {
        console.error('Failed to load preview stream:', err);
        const msg = err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to load document content for preview.';
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, document?.id, activeWorkspace?.id]);

  // Handle Escape key to close preview modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCopySnippet = () => {
    if (!highlightSnippet) return;
    navigator.clipboard.writeText(highlightSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  if (!isOpen || !document) return null;

  const isAdmin = userRole === 'ADMIN';
  const pageNum = targetPage && targetPage > 0 ? targetPage : undefined;

  const getFormatIcon = () => {
    switch (fileType) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-red-600" />;
      case 'MD':
      case 'MARKDOWN':
        return <FileCode className="w-5 h-5 text-[#2E6F5E]" />;
      case 'CSV':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      default:
        return <FileCheck className="w-5 h-5 text-[#5B6270]" />;
    }
  };

  const handleDownload = () => {
    if (onDownloadClick) {
      onDownloadClick(document);
    }
  };

  const handleOpenStandalone = () => {
    if (blobUrl) {
      const pageAnchor = pageNum ? `#page=${pageNum}` : '';
      window.open(`${blobUrl}${pageAnchor}`, '_blank');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileSize = formatFileSize(document.active_version?.file_size_bytes || document.latest_version?.file_size_bytes);

  // Compute PDF src with deep linking page anchor
  const pdfSrc = blobUrl 
    ? `${blobUrl}#page=${pageNum || 1}&view=FitH&toolbar=0&navpanes=0` 
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl bg-[#FDFCFA] rounded-2xl border border-[#DDD9CC] shadow-2xl h-[92vh] flex flex-col z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#DDD9CC] bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[#F6F5F0] border border-[#DDD9CC] shrink-0">
              {getFormatIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#1B1F27] truncate">
                  {document.title}
                </h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#F6F5F0] border border-[#DDD9CC] text-[#1B1F27] font-semibold shrink-0">
                  {fileType}
                </span>
                {pageNum && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] font-bold shrink-0">
                    <BookOpen className="w-3 h-3" />
                    Page {pageNum}
                  </span>
                )}
                {fileSize && (
                  <span className="text-xs text-[#5B6270] font-mono shrink-0 hidden sm:inline">
                    • {fileSize}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5B6270] truncate mt-0.5">
                Workspace: <span className="font-medium text-[#1B1F27]">{activeWorkspace?.name}</span>
                {document.active_version?.original_filename && (
                  <> • Source: <span className="font-mono text-[11px]">{document.active_version.original_filename}</span></>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs flex items-center gap-1.5 border-[#DDD9CC] hover:bg-[#F6F5F0]"
              title={isAdmin ? "Download source document" : "Only admins can download source files"}
            >
              <Download className="w-3.5 h-3.5 text-[#2E6F5E]" />
              <span className="hidden sm:inline">Download</span>
            </Button>

            {/* Direct Open in New Tab for PDF */}
            {isPdf && blobUrl && (
              <button
                onClick={handleOpenStandalone}
                className="p-2 rounded-lg border border-[#DDD9CC] text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#F6F5F0] transition hidden sm:inline-flex items-center cursor-pointer"
                title="Open in standalone tab with page anchor"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Citation Grounding Bar (Shown when jumped from a citation) */}
        {(citationNum || highlightSnippet || pageNum) && (
          <div className="bg-[#FAF9F5] border-b border-[#DDD9CC] px-4 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 font-bold font-mono shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                Source [{citationNum || 1}]
              </span>
              {pageNum && (
                <span className="px-2 py-0.5 rounded-md bg-[#F6F5F0] border border-[#DDD9CC] text-[#1B1F27] font-semibold font-mono shrink-0">
                  Target: Page {pageNum}
                </span>
              )}
              {highlightSnippet && (
                <p className="text-[#5B6270] truncate italic max-w-xl hidden md:inline">
                  "{highlightSnippet.slice(0, 140)}..."
                </p>
              )}
            </div>

            {highlightSnippet && (
              <button
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E6F5E] hover:text-[#1B4D40] hover:underline shrink-0 cursor-pointer ml-auto"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Excerpt
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Viewer Content */}
        <div className="flex-1 bg-[#F6F5F0] overflow-hidden relative flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 bg-white">
              <Spinner size="lg" />
              <p className="text-xs text-[#5B6270]">Loading document viewer...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2 max-w-md">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              key={`${document.id}-p${pageNum || 1}`}
              src={pdfSrc}
              className="w-full h-full border-0 bg-white"
              title={document.title}
            />
          ) : isTextBased ? (
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-white">
              {highlightSnippet && (
                <div className="max-w-4xl mx-auto mb-6 p-4 rounded-xl bg-[#2E6F5E]/5 border border-[#2E6F5E]/20 text-xs">
                  <span className="font-semibold text-[#2E6F5E] block mb-1">
                    Verified Citation Excerpt:
                  </span>
                  <p className="text-[#1B1F27] leading-relaxed font-mono">
                    {highlightSnippet}
                  </p>
                </div>
              )}
              <div className="max-w-4xl mx-auto bg-[#F6F5F0]/50 p-6 rounded-2xl border border-[#DDD9CC] font-mono text-xs sm:text-sm text-[#1B1F27] leading-relaxed whitespace-pre-wrap">
                {textContent || 'No text content available in this file.'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 bg-white">
              <div className="w-16 h-16 rounded-2xl bg-[#F6F5F0] border border-[#DDD9CC] flex items-center justify-center text-[#5B6270]">
                {getFormatIcon()}
              </div>
              <div className="max-w-md">
                <h4 className="text-base font-bold text-[#1B1F27] mb-1">
                  Preview not available for {fileType} format
                </h4>
                <p className="text-xs text-[#5B6270] leading-relaxed">
                  This document format cannot be rendered directly in the inline viewer. Workspace administrators can download the original file to view it locally.
                </p>
              </div>
              {isAdmin ? (
                <Button variant="primary" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              ) : (
                <div className="text-xs text-[#5B6270] bg-[#F6F5F0] px-4 py-2 rounded-xl border border-[#DDD9CC]">
                  Only workspace administrators can download original source files.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

