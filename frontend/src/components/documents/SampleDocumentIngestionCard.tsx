import React, { useState } from 'react';
import { 
  SAMPLE_DOCUMENTS, 
  fetchSampleFileObject, 
  createSampleDocumentObject,
  type SampleDocumentItem 
} from '@/utils/sampleDocuments';
import { documentsApi } from '@/api/documents';
import { useWorkspace } from '@/context/WorkspaceContext';
import { 
  Sparkles, 
  Eye, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Info,
  Cpu,
  Shield,
  Briefcase
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { SampleDocumentPreviewModal } from '@/components/documents/SampleDocumentPreviewModal';

import type { Document } from '@/types/document';

interface SampleDocumentIngestionCardProps {
  onDocumentUploaded: () => void;
  onShowToast: (toast: { type: 'success' | 'warning' | 'error'; message: string }) => void;
  onPreviewSample?: (sampleDoc: any) => void;
  existingDocuments?: Document[];
}

export const SampleDocumentIngestionCard: React.FC<SampleDocumentIngestionCardProps> = ({
  onDocumentUploaded,
  onShowToast,
  onPreviewSample,
  existingDocuments = [],
}) => {
  const { activeWorkspace, userRole } = useWorkspace();
  const canUpload = userRole === 'ADMIN' || userRole === 'MANAGER';
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [ingestedSampleIds, setIngestedSampleIds] = useState<Set<string>>(new Set());
  const [previewingSample, setPreviewingSample] = useState<SampleDocumentItem | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isSampleIngested = (sample: SampleDocumentItem) => {
    if (ingestedSampleIds.has(sample.id)) return true;
    if (existingDocuments && existingDocuments.length > 0) {
      return existingDocuments.some(
        (d) =>
          (d.title?.trim().toLowerCase() === sample.title.trim().toLowerCase() ||
           d.active_version?.original_filename?.toLowerCase() === sample.filename.toLowerCase() ||
           d.latest_version?.original_filename?.toLowerCase() === sample.filename.toLowerCase()) &&
          d.status !== 'FAILED'
      );
    }
    return false;
  };

  const handleViewSample = (sample: SampleDocumentItem) => {
    if (onPreviewSample) {
      onPreviewSample(createSampleDocumentObject(sample));
    } else {
      setPreviewingSample(sample);
    }
  };

  const handleIngestSample = async (sample: SampleDocumentItem) => {
    if (!activeWorkspace || !activeWorkspace.id) return;
    
    if (!canUpload) {
      onShowToast({
        type: 'warning',
        message: 'Only workspace Admins and Managers can ingest documents.',
      });
      return;
    }

    if (isSampleIngested(sample)) {
      onShowToast({
        type: 'warning',
        message: `"${sample.title}" is already ingested into this workspace.`,
      });
      return;
    }

    setLoadingSampleId(sample.id);
    try {
      const fileObj = await fetchSampleFileObject(sample);
      await documentsApi.upload(activeWorkspace.id, fileObj, sample.title);
      
      setIngestedSampleIds((prev) => new Set([...prev, sample.id]));
      onShowToast({
        type: 'success',
        message: `Ingested "${sample.title}"! Pipeline is chunking & vectorizing...`,
      });
      onDocumentUploaded();

      // Close preview modal if it was open
      if (previewingSample?.id === sample.id) {
        setPreviewingSample(null);
      }
    } catch (err: any) {
      console.error('Failed to ingest sample document:', err);
      const msg = err?.response?.data?.error?.message || err?.response?.data?.detail || 'Failed to upload sample document.';
      onShowToast({
        type: 'error',
        message: msg,
      });
    } finally {
      setLoadingSampleId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.toLowerCase().includes('engineering') || category.toLowerCase().includes('architecture')) {
      return <Cpu className="w-3.5 h-3.5 text-blue-600" />;
    }
    if (category.toLowerCase().includes('security')) {
      return <Shield className="w-3.5 h-3.5 text-red-600" />;
    }
    return <Briefcase className="w-3.5 h-3.5 text-[#2E6F5E]" />;
  };

  const getFileBadge = (fileType: string) => {
    switch (fileType) {
      case 'PDF':
        return <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">PDF</span>;
      case 'MD':
        return <span className="bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">MD</span>;
      default:
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">TXT</span>;
    }
  };

  return (
    <>
      <div className="bg-[#FAF9F5] border border-[#DDD9CC] rounded-2xl p-3.5 sm:p-5 shadow-xs transition-all w-full">
        {/* Header with Responsive Toggle */}
        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#1B1F27] leading-tight">
                  Try Sample Ingestion Pipeline
                </h2>
                {/* <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20 shrink-0">
                  1-Click Test
                </span> */}
              </div>
              <p className="text-[11px] sm:text-xs text-[#5B6270] mt-0.5 leading-relaxed">
                Test how KnowFlow indexes <strong className="text-[#1B1F27]">Technical Architecture Specs</strong> alongside corporate policies.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-[#ECE9DF] text-[#5B6270] hover:text-[#1B1F27] transition cursor-pointer shrink-0 mt-0.5"
            title={isCollapsed ? 'Expand sample docs' : 'Collapse sample docs'}
            aria-label="Toggle sample documents"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Interactive Sample Document Cards Grid */}
        {!isCollapsed && (
          <div className="mt-3.5 pt-3.5 border-t border-[#DDD9CC]/60 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5">
            {SAMPLE_DOCUMENTS.map((sample) => {
              const isLoading = loadingSampleId === sample.id;
              const isIngested = isSampleIngested(sample);

              return (
                <div
                  key={sample.id}
                  className="bg-white border border-[#DDD9CC] hover:border-[#1B1F27]/40 rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-3 transition-all hover:shadow-xs group"
                >
                  <div>
                    {/* Top Row: Format & View Button */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getFileBadge(sample.fileType)}
                        <span className="text-[10px] font-medium text-[#5B6270] flex items-center gap-1">
                          {getCategoryIcon(sample.category)}
                          <span className="truncate max-w-[120px]">{sample.category}</span>
                        </span>
                      </div>

                      {/* View / Preview Button with Eye Icon */}
                      <button
                        type="button"
                        onClick={() => handleViewSample(sample)}
                        className="text-[11px] font-semibold text-[#2E6F5E] hover:text-[#1B4D40] bg-[#2E6F5E]/10 hover:bg-[#2E6F5E]/15 border border-[#2E6F5E]/20 px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer"
                        title="View full document preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-[#1B1F27] line-clamp-1 group-hover:text-[#2E6F5E] transition-colors">
                      {sample.title}
                    </h3>
                    <p className="text-[11px] text-[#5B6270] mt-1 line-clamp-2 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>

                  {/* 1-Click Action Button */}
                  <div className="pt-2 border-t border-[#F6F5F0]">
                    <button
                      onClick={() => handleIngestSample(sample)}
                      disabled={isLoading || isIngested}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs ${
                        isIngested
                          ? 'bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/30 cursor-default select-none'
                          : isLoading
                          ? 'bg-[#1B1F27] text-white opacity-80 cursor-wait'
                          : 'bg-[#1B1F27] hover:bg-[#2E6F5E] text-white cursor-pointer'
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Spinner size="sm" className="text-white" />
                          <span>Vectorizing...</span>
                        </>
                      ) : isIngested ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#2E6F5E]" />
                          <span>Ingested</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#A9772F]" />
                          <span>1-Click Ingest</span>
                          <ArrowRight className="w-3 h-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Helpful Hint Footer */}
        {!isCollapsed && (
          <div className="mt-3 pt-2.5 flex items-center gap-1.5 text-[11px] text-[#5B6270]">
            <Info className="w-3.5 h-3.5 text-[#2E6F5E] shrink-0" />
            <span className="truncate">
              Supports technical architecture specs, engineering SOPs, and company policies.
            </span>
          </div>
        )}
      </div>

      {/* Sample Document Preview Modal */}
      <SampleDocumentPreviewModal
        sample={previewingSample}
        isOpen={!!previewingSample}
        onClose={() => setPreviewingSample(null)}
        onIngest={(s) => handleIngestSample(s)}
        isIngesting={loadingSampleId === previewingSample?.id}
        isAlreadyIngested={previewingSample ? isSampleIngested(previewingSample) : false}
      />
    </>
  );
};
