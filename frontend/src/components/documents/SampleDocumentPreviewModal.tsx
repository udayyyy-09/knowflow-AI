import React, { useEffect, useState } from 'react';
import type { SampleDocumentItem } from '@/utils/sampleDocuments';
import { 
  X, 
  FileText, 
  FileCode, 
  Sparkles, 
  Copy, 
  Check, 
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/common/Button';

interface SampleDocumentPreviewModalProps {
  sample: SampleDocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onIngest: (sample: SampleDocumentItem) => void;
  isIngesting?: boolean;
  isAlreadyIngested?: boolean;
}

export const SampleDocumentPreviewModal: React.FC<SampleDocumentPreviewModalProps> = ({
  sample,
  isOpen,
  onClose,
  onIngest,
  isIngesting = false,
  isAlreadyIngested = false,
}) => {
  const [copied, setCopied] = useState(false);

  // Esc key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sample) return null;

  const handleCopy = () => {
    if (!sample.inlineContent) return;
    navigator.clipboard.writeText(sample.inlineContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFormatBadge = () => {
    switch (sample.fileType as string) {
      case 'PDF':
        return <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">PDF</span>;
      case 'MD':
        return <span className="bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">MARKDOWN</span>;
      default:
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">TXT</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl border border-[#DDD9CC] shadow-2xl w-full max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#FAF9F5] border-b border-[#DDD9CC] px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white border border-[#DDD9CC] text-[#2E6F5E] shrink-0">
              {sample.fileType === 'PDF' ? <FileText className="w-5 h-5 text-red-600" /> : <FileCode className="w-5 h-5 text-[#2E6F5E]" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-[#1B1F27] truncate">
                  {sample.title}
                </h3>
                {getFormatBadge()}
                <span className="text-[11px] text-[#5B6270] font-mono">
                  • {sample.sizeFormatted}
                </span>
              </div>
              <p className="text-xs text-[#5B6270] mt-0.5 truncate">
                Category: <span className="font-semibold text-[#1B1F27]">{sample.category}</span> • File: <span className="font-mono text-[11px]">{sample.filename}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg border border-[#DDD9CC] text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition cursor-pointer hidden sm:flex items-center gap-1 text-xs font-medium"
              title="Copy full text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#2E6F5E]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#5B6270] hover:text-[#1B1F27] hover:bg-[#ECE9DF] transition cursor-pointer"
              title="Close preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Suggested Queries Bar */}
        {sample.suggestedQuestions.length > 0 && (
          <div className="bg-[#F6F5F0] border-b border-[#DDD9CC] px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1 font-bold text-[#2E6F5E] shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Example Questions:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-0.5">
              {sample.suggestedQuestions.map((q, idx) => (
                <span
                  key={idx}
                  className="bg-white border border-[#DDD9CC] px-2 py-0.5 rounded-md text-[11px] text-[#1B1F27] italic truncate max-w-[280px]"
                >
                  "{q}"
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content Viewer */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF9F5]/40 font-mono text-xs sm:text-[13px] text-[#1B1F27] leading-relaxed whitespace-pre-wrap selection:bg-[#2E6F5E]/20">
          {sample.inlineContent || 'No preview text available.'}
        </div>

        {/* Footer with Actions */}
        <div className="bg-[#FAF9F5] border-t border-[#DDD9CC] px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-[#5B6270] hidden sm:flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#2E6F5E]" />
            <span>Ready to test in RAG pipeline</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-[#5B6270]"
            >
              Close
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => onIngest(sample)}
              isLoading={isIngesting}
              disabled={isAlreadyIngested || isIngesting}
              className={`text-xs font-semibold flex items-center gap-1.5 ${
                isAlreadyIngested
                  ? 'bg-[#2E6F5E]/15 text-[#2E6F5E] border border-[#2E6F5E]/30 hover:bg-[#2E6F5E]/15 cursor-default'
                  : 'bg-[#1B1F27] hover:bg-[#2E6F5E] text-white'
              }`}
            >
              {isAlreadyIngested ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                  <span>Ingested</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#A9772F]" />
                  <span>1-Click Ingest Document</span>
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
