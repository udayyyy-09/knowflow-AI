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
  Bookmark
} from 'lucide-react';

interface CitationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationSource | null;
  sourceId: number | null;
}

export const CitationDetailModal: React.FC<CitationDetailModalProps> = ({
  isOpen,
  onClose,
  citation,
  sourceId,
}) => {
  const [copied, setCopied] = useState(false);

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

  if (!isOpen || !citation) return null;

  const contentText = citation.content || citation.snippet || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(contentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const citationNum = sourceId || citation.source_id || citation.citation_index || 1;
  const sectionName = citation.section || citation.section_header;
  const pageNumber = citation.page_number;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Lightweight Backdrop */}
      <div 
        className="fixed inset-0 bg-black/25 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Side Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-lg w-full flex pl-10">
        <div className="w-full bg-[#FDFCFA] border-l border-[#DDD9CC] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250 ease-out">
          {/* Header */}
          <div className="p-5 md:p-6 border-b border-[#DDD9CC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 text-xs font-bold font-mono">
                  Source [{citationNum}]
                </span>
                <span className="flex items-center gap-1 text-xs text-[#2E6F5E] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Citation
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[#F2EFE9] text-[#5B6270] hover:text-[#1B1F27] transition"
                aria-label="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Title & Meta */}
            <div>
              <h3 className="text-lg font-serif font-bold text-[#1B1F27] leading-snug flex items-start gap-2">
                <FileText className="w-5 h-5 text-[#2E6F5E] shrink-0 mt-0.5" />
                <span>{citation.document_title}</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                {sectionName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#5B6270]">
                    <Bookmark className="w-3 h-3 text-[#A9772F]" />
                    <span>{sectionName}</span>
                  </span>
                )}
                {pageNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#F6F5F0] border border-[#DDD9CC] text-xs text-[#5B6270] font-mono">
                    <BookOpen className="w-3 h-3 text-[#5B6270]" />
                    <span>p. {pageNumber}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Excerpt Body */}
          <div className="p-5 md:p-6 flex-1 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5B6270] uppercase tracking-wider">
                Document Excerpt
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
                    Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Excerpt
                  </>
                )}
              </Button>
            </div>

            {/* Clean Editorial Quoted Text */}
            <div className="bg-[#F6F5F0] p-4 md:p-5 rounded-2xl border border-[#DDD9CC] border-l-4 border-l-[#2E6F5E] text-xs md:text-sm text-[#1B1F27] leading-relaxed whitespace-pre-wrap font-sans selection:bg-[#A9772F]/20 shadow-xs">
              {contentText}
            </div>

            {/* Verification Callout */}
            <div className="p-3.5 rounded-xl bg-white border border-[#DDD9CC] text-xs text-[#5B6270] space-y-1">
              <div className="font-semibold text-[#1B1F27] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2E6F5E]" />
                Audit-Proof Answer Grounding
              </div>
              <p className="leading-relaxed text-[11px]">
                The AI response claim linked to <span className="font-mono font-semibold text-[#1B1F27]">[{citationNum}]</span> is directly derived from the verified policy excerpt above.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 md:p-5 border-t border-[#DDD9CC] bg-[#F6F5F0] flex items-center justify-between">
            <span className="text-xs text-[#5B6270] font-mono">
              KnowFlow Grounding Engine
            </span>
            <Button variant="primary" size="sm" onClick={onClose} className="px-5">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

