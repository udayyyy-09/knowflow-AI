import React, { useState, useEffect } from 'react';
import type { CitationSource } from '@/types/chat';
import { Button } from '@/components/common/Button';
import { 
  FileText, 
  Copy, 
  Check, 
  ShieldCheck, 
  X, 
  BookOpen, 
  Bookmark, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FolderOpen
} from 'lucide-react';

interface CitationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationSource | null;
  sourceId: number | null;
  workspaceName?: string;
  onOpenDocument?: (docId?: string) => void;
  onOpenViewer?: (citation: CitationSource) => void;
}

export const CitationDetailModal: React.FC<CitationDetailModalProps> = ({
  isOpen,
  onClose,
  citation,
  sourceId,
  workspaceName = 'Active Workspace',
  onOpenDocument,
  onOpenViewer,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset expand state when citation changes
  useEffect(() => {
    setIsExpanded(false);
  }, [citation]);

  if (!isOpen || !citation) return null;

  const contentText = citation.content || citation.snippet || '';
  const isLongText = contentText.length > 350;
  const displayExcerpt = isLongText && !isExpanded 
    ? `${contentText.slice(0, 320)}...` 
    : contentText;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJumpToKnowledge = () => {
    if (onOpenDocument) {
      onOpenDocument(citation.document_id);
    } else {
      window.location.hash = 'documents';
    }
    onClose();
  };

  const citationNum = sourceId || citation.source_id || citation.citation_index || 1;
  const sectionName = citation.section || citation.section_header;
  const pageNumber = citation.page_number;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-end md:items-stretch justify-end">
      {/* Dim Backdrop with quick click-dismiss */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Side Drawer (Desktop) / Bottom Sheet (Mobile) */}
      <div className="relative z-10 w-full md:max-w-lg bg-[#FDFCFA] md:h-full max-h-[85vh] rounded-t-3xl md:rounded-none border-t md:border-t-0 md:border-l border-[#DDD9CC] shadow-2xl flex flex-col justify-between animate-in slide-in-from-bottom md:slide-in-from-right duration-250 ease-out">
        
        {/* Mobile Drag Indicator */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-[#DDD9CC] rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-5 md:p-6 border-b border-[#DDD9CC] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 text-xs font-bold font-mono">
                Source [{citationNum}]
              </span>
              {/* <span className="flex items-center gap-1 text-xs text-[#2E6F5E] font-medium bg-[#2E6F5E]/5 px-2 py-0.5 rounded-md border border-[#2E6F5E]/15">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Grounding
              </span> */}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#5B6270] hover:text-[#1B1F27] transition cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Document Title & Hierarchy */}
          <div>
            <h3 className="text-lg font-serif font-bold text-[#1B1F27] leading-snug flex items-start gap-2">
              <FileText className="w-5 h-5 text-[#2E6F5E] shrink-0 mt-0.5" />
              <span>{citation.document_title}</span>
            </h3>

            {/* Scope & Hierarchy Metadata Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {/* Workspace Scope */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#5B6270]">
                <FolderOpen className="w-3 h-3 text-[#2E6F5E]" />
                <span className="font-medium text-[#1B1F27]">{workspaceName}</span>
              </span>

              {/* Section Tag */}
              {sectionName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#5B6270]">
                  <Bookmark className="w-3 h-3 text-[#A9772F]" />
                  <span>{sectionName}</span>
                </span>
              )}

              {/* Page Number */}
              {pageNumber && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#5B6270] font-mono">
                  <BookOpen className="w-3 h-3 text-[#5B6270]" />
                  <span>p. {pageNumber}</span>
                </span>
              )}

            
            </div>
          </div>
        </div>

        {/* Excerpt Body with High Legibility & Expansion */}
        <div className="p-5 md:p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5B6270] uppercase tracking-wider">
              Verbatim Document Excerpt
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-xs text-[#5B6270] hover:text-[#1B1F27] h-8 px-2.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-[#2E6F5E]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy Excerpt
                </>
              )}
            </Button>
          </div>

          {/* High-Contrast Excerpt Card */}
          <div className="bg-[#F8F7F2] p-4 md:p-5 rounded-2xl border border-[#DDD9CC] border-l-4 border-l-[#2E6F5E] shadow-2xs">
            <p className="text-xs md:text-sm text-[#1B1F27] leading-relaxed whitespace-pre-wrap font-sans selection:bg-[#A9772F]/20">
              {displayExcerpt}
            </p>

            {isLongText && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2E6F5E] hover:text-[#1B4D40] hover:underline cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> View full chunk ({contentText.length} chars)
                  </>
                )}
              </button>
            )}
          </div>

          {/* Verification Callout */}
          <div className="p-3.5 rounded-xl bg-white border border-[#DDD9CC] text-xs text-[#5B6270] space-y-1.5 shadow-2xs">
            <div className="font-semibold text-[#1B1F27] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2E6F5E]" />
              Direct Policy Provenance
            </div>
            <p className="leading-relaxed text-[11px] text-[#5B6270]">
              The response claim linked to <span className="font-mono font-semibold text-[#1B1F27]">[{citationNum}]</span> is grounded directly in the verified excerpt above from your workspace document repository.
            </p>
          </div>
        </div>

        {/* Footer Actions: Jump to Documents & Close */}
        <div className="p-4 md:p-5 border-t border-[#DDD9CC] bg-[#F6F5F0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onOpenViewer ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenViewer(citation);
                }}
                className="text-xs border-[#DDD9CC] text-[#1B1F27] hover:bg-white flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#2E6F5E]" />
                {pageNumber ? `View Original PDF (Page ${pageNumber})` : 'View Original Document'}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleJumpToKnowledge}
                className="text-xs border-[#DDD9CC] text-[#1B1F27] hover:bg-white flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#2E6F5E]" />
                Open in Knowledge Hub
              </Button>
            )}
          </div>

          <Button variant="primary" size="sm" onClick={onClose} className="px-5">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
