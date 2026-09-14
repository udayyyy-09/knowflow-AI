import React from 'react';
import type { CitationSource } from '@/types/chat';

interface CitationBadgeProps {
  sourceId: number;
  citation?: CitationSource;
  onClick: (sourceId: number, citation?: CitationSource) => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  sourceId,
  citation,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(sourceId, citation)}
      className="inline-flex items-center justify-center font-mono text-[11px] font-bold px-1.5 py-0.5 mx-0.5 rounded-md bg-[#A9772F]/10 hover:bg-[#A9772F]/20 text-[#8C5D1E] hover:text-[#5E3D0F] border border-[#A9772F]/30 hover:border-[#A9772F]/60 transition cursor-pointer align-baseline select-none shadow-xs"
      title={
        citation
          ? `${citation.document_title}${citation.page_number ? ` (Page ${citation.page_number})` : ''}`
          : `Source [${sourceId}]`
      }
    >
      [{sourceId}]
    </button>
  );
};
