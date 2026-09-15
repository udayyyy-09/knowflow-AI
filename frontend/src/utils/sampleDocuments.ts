export interface SampleDocumentItem {
  id: string;
  title: string;
  filename: string;
  fileType: 'PDF' | 'TXT';
  category: string;
  sizeFormatted: string;
  description: string;
  suggestedQuestions: string[];
  publicUrl: string;
  inlineContent?: string;
}

export const SAMPLE_DOCUMENTS: SampleDocumentItem[] = [
  {
    id: 'sample-tech-spec',
    title: 'Technical Team Project Spec',
    filename: 'technical_team_project.pdf',
    fileType: 'PDF',
    category: 'Engineering & Architecture',
    sizeFormatted: '4.8 KB',
    description: 'Microservices architecture, PostgreSQL 16 pgvector HNSW indexing, Celery worker fleet, and multi-tier LLM failover protocol.',
    suggestedQuestions: [
      'What is the microservices topology and message flow?',
      'How are pgvector HNSW indices configured for multi-tenancy?',
      'What are the failover tiers for LLM streaming inference?'
    ],
    publicUrl: '/sample_documents/technical_team_project.pdf',
  },
  {
    id: 'sample-security-policy',
    title: 'Company Security Policy',
    filename: 'company_policy.pdf',
    fileType: 'PDF',
    category: 'Security & Compliance',
    sizeFormatted: '6.6 KB',
    description: 'Multi-factor authentication (MFA), 90-day password rotation, data classification, and incident response protocol.',
    suggestedQuestions: [
      'What are the password complexity and rotation rules?',
      'When is Multi-Factor Authentication (MFA) required?',
      'What is the data classification framework?'
    ],
    publicUrl: '/sample_documents/company_policy.pdf',
  },
  {
    id: 'sample-remote-policy',
    title: 'Remote Work & Travel Policy',
    filename: 'remote_work_and_travel_expense_policy.txt',
    fileType: 'TXT',
    category: 'HR & Operations',
    sizeFormatted: '1.4 KB',
    description: 'Guidelines for remote work stipends ($75/month), daily business travel per diem ($75/day), and flight class rules.',
    suggestedQuestions: [
      'What is the daily per diem allowance for business meals?',
      'What is the monthly internet stipend for remote employees?',
      'What class of air travel is reimbursable?'
    ],
    publicUrl: '/sample_documents/remote_work_and_travel_expense_policy.txt',
    inlineContent: `ACME CORP — REMOTE WORK & TRAVEL EXPENSE POLICY
Effective Date: January 1, 2026
Applies to: All Remote & Hybrid Employees

1. REMOTE WORK ELIGIBILITY & STIPEND
- Remote employees receive a $75/month home internet and utilities stipend.
- One-time ergonomic home office setup allowance of $500 upon hiring.
- Core working hours: 10:00 AM to 4:00 PM in local time zone.

2. TRAVEL EXPENSES & MEAL ALLOWANCES
- Domestic flight bookings must be economy class booked at least 14 days in advance.
- International flights exceeding 7 hours are eligible for Premium Economy.
- Daily business travel meal allowance (per diem) is capped at $75/day ($15 breakfast, $25 lunch, $35 dinner).
- Hotel accommodation is reimbursable up to $200/night for standard business hubs.

3. EXPENSE REIMBURSEMENT PROCESS
- All receipts must be submitted via the KnowFlow expense portal within 30 days of travel.
- Corporate card is preferred for expenses exceeding $100.
`,
  },
];

/**
 * Converts a sample item into a virtual Document object compatible with DocumentPreviewModal.
 */
export function createSampleDocumentObject(sample: SampleDocumentItem): any {
  return {
    id: sample.id,
    title: sample.title,
    file_type: sample.fileType,
    status: 'READY',
    isSample: true,
    sampleUrl: sample.publicUrl,
    inlineContent: sample.inlineContent,
    active_version: {
      original_filename: sample.filename,
      file_size_bytes: sample.fileType === 'PDF' ? 4900 : 1400,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Loads a sample file as a browser `File` object ready to pass to `documentsApi.upload`.
 */
export async function fetchSampleFileObject(sample: SampleDocumentItem): Promise<File> {
  try {
    const response = await fetch(sample.publicUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching sample file`);
    }
    const blob = await response.blob();
    const mimeType = sample.fileType === 'PDF' 
      ? 'application/pdf' 
      : 'text/plain';
      
    return new File([blob], sample.filename, { type: mimeType });
  } catch (err) {
    console.warn(`Could not fetch from public URL (${sample.publicUrl}), using inline fallback:`, err);
    if (sample.inlineContent) {
      return new File([sample.inlineContent], sample.filename, { type: 'text/plain' });
    }
    throw err;
  }
}

/**
 * Triggers a browser download of the sample file.
 */
export async function downloadSampleDocument(sample: SampleDocumentItem): Promise<void> {
  const file = await fetchSampleFileObject(sample);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = sample.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
