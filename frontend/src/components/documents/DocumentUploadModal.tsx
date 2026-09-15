import React, { useState, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { documentsApi } from '@/api/documents';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { 
  UploadCloud, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  FileCode, 
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { SAMPLE_DOCUMENTS, fetchSampleFileObject, type SampleDocumentItem } from '@/utils/sampleDocuments';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedFile {
  file: File;
  title: string;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { activeWorkspace } = useWorkspace();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = ['.pdf', '.docx', '.txt', '.md', '.csv'];

  const validateFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return `File type "${ext}" not supported. Allowed: ${allowedExtensions.join(', ')}`;
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File size exceeds 50MB limit.';
    }
    return null;
  };

  const handleFileSelection = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setGlobalError(null);

    const validNewFiles: SelectedFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const error = validateFile(file);
      if (error) {
        setGlobalError(error);
        continue;
      }
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      validNewFiles.push({
        file,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        status: 'idle',
      });
    }

    setFiles((prev) => [...prev, ...validNewFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelection(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

  const handleLoadSample = async (sample: SampleDocumentItem) => {
    setLoadingSampleId(sample.id);
    setGlobalError(null);
    try {
      const fileObj = await fetchSampleFileObject(sample);
      const isAlreadyAdded = files.some((f) => f.file.name === fileObj.name);
      if (isAlreadyAdded) {
        setGlobalError(`"${sample.filename}" is already in the queue.`);
        return;
      }
      setFiles((prev) => [
        ...prev,
        {
          file: fileObj,
          title: sample.title,
          status: 'idle',
        },
      ]);
    } catch (err) {
      console.error('Failed to load sample document:', err);
      setGlobalError('Failed to load sample document.');
    } finally {
      setLoadingSampleId(null);
    }
  };

  const updateFileTitle = (index: number, title: string) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index].title = title;
      return updated;
    });
  };

  const handleUploadAll = async () => {
    if (!activeWorkspace || !activeWorkspace.id || files.length === 0) return;
    setIsSubmitting(true);
    setGlobalError(null);

    let hasSuccess = false;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'success') continue;

      setFiles((prev) => {
        const updated = [...prev];
        updated[i].status = 'uploading';
        return updated;
      });

      try {
        await documentsApi.upload(activeWorkspace.id, files[i].file, files[i].title);
        hasSuccess = true;
        setFiles((prev) => {
          const updated = [...prev];
          updated[i].status = 'success';
          return updated;
        });
      } catch (err: any) {
        const errMsg = err?.response?.data?.file?.[0] || err?.response?.data?.detail || 'Upload failed';
        setFiles((prev) => {
          const updated = [...prev];
          updated[i].status = 'error';
          updated[i].error = errMsg;
          return updated;
        });
      }
    }

    setIsSubmitting(false);
    if (hasSuccess) {
      onSuccess();
      setTimeout(() => {
        setFiles([]);
        onClose();
      }, 1200);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    if (ext === 'md' || ext === 'txt') return <FileCode className="w-5 h-5 text-blue-400" />;
    return <FileText className="w-5 h-5 text-brand-400" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Upload Knowledge Documents"
      maxWidth="xl"
    >
      <div className="space-y-5">
        {globalError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[#2E6F5E] bg-[#2E6F5E]/5 scale-[0.99]'
              : 'border-[#DDD9CC] hover:border-[#2E6F5E] hover:bg-[#F6F5F0]/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
          />

          <div className="w-14 h-14 rounded-2xl bg-[#2E6F5E]/10 border border-[#2E6F5E]/20 text-[#2E6F5E] flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h4 className="text-base font-semibold text-[#1B1F27] mb-1">
            Drag & Drop your files here, or <span className="text-[#2E6F5E] underline">browse</span>
          </h4>
          <p className="text-xs text-[#5B6270] max-w-sm mx-auto">
            Supports PDF, DOCX, TXT, Markdown, and CSV files up to 50MB each. Automatic chunking & pgvector embedding starts immediately upon upload.
          </p>
        </div>

        {/* 1-Click Quick Sample Files Chip Bar */}
        <div className="bg-[#FAF9F5] border border-[#DDD9CC] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#5B6270]">
            <Sparkles className="w-3.5 h-3.5 text-[#2E6F5E] shrink-0" />
            <span className="font-medium text-[#1B1F27]">No files ready?</span>
            <span>Click to load a sample:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {SAMPLE_DOCUMENTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleLoadSample(sample)}
                disabled={loadingSampleId === sample.id || isSubmitting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#F6F5F0] border border-[#DDD9CC] hover:border-[#1B1F27]/40 text-[11px] font-semibold text-[#1B1F27] transition shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {loadingSampleId === sample.id ? (
                  <Spinner size="sm" />
                ) : (
                  <span className="text-[#2E6F5E] font-bold">+</span>
                )}
                <span>{sample.title}</span>
                <span className="text-[10px] font-mono text-[#5B6270]">({sample.fileType})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-[#5B6270] uppercase tracking-wider flex justify-between items-center">
              <span>Ready for Ingestion ({files.length})</span>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-[11px] text-[#5B6270] hover:text-red-600 transition font-medium"
              >
                Clear all
              </button>
            </div>

            {files.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#F6F5F0] p-3 rounded-xl flex items-center justify-between gap-3 border border-[#DDD9CC]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-white border border-[#DDD9CC] shrink-0">
                    {getFileIcon(item.file.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateFileTitle(idx, e.target.value)}
                      disabled={isSubmitting || item.status === 'success'}
                      className="text-xs font-medium text-[#1B1F27] bg-transparent border-b border-transparent hover:border-[#DDD9CC] focus:border-[#1B1F27] focus:outline-none w-full truncate"
                      placeholder="Document title"
                    />
                    <div className="text-[10px] text-[#5B6270] flex items-center gap-2 mt-0.5">
                      <span>{item.file.name}</span>
                      <span>•</span>
                      <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                </div>

                {/* Status indicator / Action */}
                <div className="flex items-center gap-2">
                  {item.status === 'uploading' && <Spinner size="sm" />}
                  {item.status === 'success' && (
                    <span className="text-[#2E6F5E] flex items-center gap-1 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Ready
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-red-600 flex items-center gap-1 text-xs font-medium" title={item.error}>
                      <AlertCircle className="w-4 h-4" /> Error
                    </span>
                  )}
                  {!isSubmitting && item.status !== 'success' && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1 rounded text-[#5B6270] hover:text-red-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DDD9CC]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleUploadAll}
            disabled={files.length === 0 || isSubmitting}
            isLoading={isSubmitting}
          >
            Upload and Index {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
