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
  original_filename?: string;
  file_name?: string;
  file_size_bytes: number;
  file_hash_sha256?: string;
  mime_type?: string;
  processing_status?: DocumentStatus;
  status?: DocumentStatus;
  status_message?: string;
  error_message?: string;
  is_active?: boolean;
  file_url?: string;
  chunks_count?: number;
  created_at: string;
}

export interface Document {
  id: string;
  workspace_id?: string;
  title: string;
  description?: string;
  file_type: string;
  status: DocumentStatus;
  current_version_number?: number;
  total_versions_count?: number;
  chunks_count?: number;
  chunk_count?: number;
  active_version?: DocumentVersion;
  latest_version?: DocumentVersion;
  versions?: DocumentVersion[];
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

