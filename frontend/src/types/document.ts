export type DocumentStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PENDING'
  | 'PROCESSING'
  | 'EMBEDDING'
  | 'READY'
  | 'PROCESSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ARCHIVED';
export type DocumentFileType = 'PDF' | 'DOCX' | 'TXT' | 'MARKDOWN' | 'MD' | 'CSV';

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  content: string;
  char_count?: number;
  token_count?: number;
  token_count_estimate?: number;
  section_header?: string;
  page_number?: number | null;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  file_name: string;
  file_size_bytes: number;
  file_hash_sha256?: string;
  status: DocumentStatus;
  status_message?: string;
  chunks_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  file_type: string;
  status: DocumentStatus;
  current_version_number?: number;
  chunks_count?: number;
  chunk_count?: number;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
  latest_version?: DocumentVersion;
}
