export interface PrescriptionInquiryRow {
  readonly inquiry_id: string;
  readonly prescription_id: string;
  readonly directed_to: string;
  readonly content: string;
  readonly answer: string | null;
  readonly answered_by: string | null;
  readonly answered_at: Date | string | null;
  readonly result: string | null;
  readonly created_by: string;
  readonly created_at: Date | string;
  readonly idempotency_key: string;
  readonly answer_idempotency_key: string | null;
  readonly recorded_seq: string | number;
}

export interface PrescriptionVersionRow {
  readonly version: number;
  readonly content: unknown;
  readonly content_hash: string;
  readonly supersedes_version: number | null;
  readonly inquiry_id: string | null;
  readonly amended_by: string | null;
  readonly amended_at: Date | string | null;
  readonly amend_idempotency_key: string | null;
  readonly confirmed_by: string;
  readonly confirmed_at: Date | string;
  readonly finalized_by: string;
  readonly finalized_at: Date | string;
  readonly created_at: Date | string;
}

export const INQUIRY_SELECT_COLUMNS = `
  inquiry_id,
  prescription_id,
  directed_to,
  content,
  answer,
  answered_by,
  answered_at,
  result,
  created_by,
  created_at,
  idempotency_key,
  answer_idempotency_key,
  recorded_seq
`;

export const VERSION_SELECT_COLUMNS = `
  version,
  content,
  content_hash,
  supersedes_version,
  inquiry_id,
  amended_by,
  amended_at,
  amend_idempotency_key,
  confirmed_by,
  confirmed_at,
  finalized_by,
  finalized_at,
  created_at
`;

