/**
 * Source documents as the agents see them.
 *
 * PATTERN: agents never receive raw strings glued together. Every document is
 * wrapped in a <document> tag carrying its id and metadata, so the model can cite
 * `documentId` and the harness can verify quotes against the exact same text.
 */

export type DocumentType =
  | "intake"
  | "treatment_plan"
  | "progress_note"
  | "authorization_record"
  | "denial_letter"
  | "policy"
  | "criteria_summary";

export interface SourceDocument {
  id: string; // stable id; quotes cite this
  type: DocumentType;
  title: string;
  author?: string;
  serviceDate?: string; // ISO date, e.g. "2026-11-03"
  version: number;
  content: string; // the exact text quotes are verified against
}

/** Escape characters that could close our wrapper tag early. */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Wrap documents for a prompt. The shared rules tell the model that anything
 * inside <document> is untrusted data, never instructions (prompt-injection guard).
 */
export function formatDocuments(docs: SourceDocument[]): string {
  return docs
    .map(
      (d) =>
        `<document id="${escapeAttr(d.id)}" type="${d.type}" title="${escapeAttr(d.title)}"` +
        (d.serviceDate ? ` service_date="${d.serviceDate}"` : "") +
        ` version="${d.version}">\n${d.content}\n</document>`,
    )
    .join("\n\n");
}
