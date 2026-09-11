import React from 'react';
import type { DocumentStatus } from '@/types/document';
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  errorMessage?: string | null;
}

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  status,
  errorMessage,
}) => {
  switch (status) {
    case 'PROCESSED':
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2E6F5E]/10 text-[#2E6F5E] border border-[#2E6F5E]/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Processed & Indexed
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
          Vectorizing...
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3.5 h-3.5" />
          Queued
        </span>
      );
    case 'FAILED':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200 group relative cursor-help"
          title={errorMessage || 'Processing error'}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F6F5F0] text-[#5B6270] border border-[#DDD9CC]">
          {status}
        </span>
      );
  }
};
