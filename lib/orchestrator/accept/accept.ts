import { createHash } from 'node:crypto';
import { ISSUE_TYPES, ISSUE_SEVERITIES, type IssueType, type IssueSeverity, type CheckResult } from '../../db/enums';
import { CODE_CLAIM_AUTHOR, PERIOD_FACT_IDS, isPeriodFactId } from '../../validation/period-facts';
import { scanText } from './boundary';

export type AcceptContext = { caseId: string; agentName: string; agentRunId: string; verifiedFactIds: ReadonlySet<string>; verifiedQuotes: readonly string[]; runAgentNames: ReadonlySet<string> };
export type ClaimDraft = { caseId: string; agentRunId: string | null; author: string; sectionHeading: string; position: number; text: string; type: 'clinical_fact' | 'narrative' | 'administrative_fact'; sourceKind: 'direct_quote' | 'extracted_fact' | 'agent_synthesis'; status: 'source_verified' | 'unsupported'; material: true; factIds: string[]; boundaryFlagged: boolean; originalText: null };
export type IssueDraft = { caseId: string; type: IssueType; severity: IssueSeverity; blocking: boolean; status: 'open'; source: string; sourceRunId: string; description: string; ownerId: null; dedupeKey: string; sendBackTo: string | null; requiredDocumentType: 'progress_note' | null; requiredServiceDate: string | null };

// Model-named notes are keyed like the code's own progress-note issues, so a rerun cannot open a second copy.
const KEYED_DOCUMENT_TYPE = 'progress_note';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const PERIOD_SECTION_HEADING = 'Review periods';
export type Check = { name: string; result: CheckResult; origin: 'code' | 'model'; affected?: readonly string[] };

export function findDuplicateIds(items: ReadonlyArray<{ id: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { id } of items) { if (seen.has(id)) duplicates.add(id); seen.add(id); }
  return [...duplicates].sort();
}

export function resolveFactIds(factIds: readonly string[], verifiedFactIds: ReadonlySet<string>): { resolved: boolean; missing: string[] } {
  // Period IDs never resolve: code writes those claims, and a model fact could be named after one.
  const missing = [...new Set(factIds.filter((id) => isPeriodFactId(id) || !verifiedFactIds.has(id)))];
  return { resolved: factIds.length > 0 && missing.length === 0, missing };
}

export function acceptDraftClaims(sections: ReadonlyArray<{ heading: string; claims: ReadonlyArray<Record<string, unknown>> }>, ctx: AcceptContext): ClaimDraft[] {
  const drafts: ClaimDraft[] = [];
  for (const section of sections) {
    for (const claim of section.claims) {
      const text = typeof claim.text === 'string' ? claim.text : '';
      const factIds = Array.isArray(claim.factIds) ? claim.factIds.filter((id): id is string => typeof id === 'string') : [];
      const sourceKind = claim.sourceKind === 'direct_quote' || claim.sourceKind === 'extracted_fact' ? claim.sourceKind : 'agent_synthesis';
      drafts.push({ caseId: ctx.caseId, agentRunId: ctx.agentRunId, author: ctx.agentName, sectionHeading: section.heading, position: drafts.length,
        text, type: sourceKind === 'agent_synthesis' ? 'narrative' : 'clinical_fact', sourceKind,
        status: resolveFactIds(factIds, ctx.verifiedFactIds).resolved ? 'source_verified' : 'unsupported', material: true,
        factIds: [...factIds], boundaryFlagged: scanText(text, ctx.verifiedQuotes).length > 0, originalText: null });
    }
  }
  return drafts;
}

type Period = { start: string; end: string };

// The only claims code writes. They restate stored dates and pass no model text through.
export function buildPeriodClaims(periods: { requested: Period; authorized: Period }, caseId: string, firstPosition: number): ClaimDraft[] {
  const rows = [['Requested', periods.requested, PERIOD_FACT_IDS.requested], ['Authorized', periods.authorized, PERIOD_FACT_IDS.authorized]] as const;
  return rows.map(([label, { start, end }, factId], index) => ({ caseId, agentRunId: null, author: CODE_CLAIM_AUTHOR, sectionHeading: PERIOD_SECTION_HEADING, position: firstPosition + index,
    text: `${label} period: ${start} through ${end}.`, type: 'administrative_fact', sourceKind: 'extracted_fact', status: 'source_verified', material: true, factIds: [factId], boundaryFlagged: false, originalText: null }));
}

export function acceptQualityIssues(issues: ReadonlyArray<Record<string, unknown>>, ctx: AcceptContext): IssueDraft[] {
  return issues.map((issue) => {
    const type = ISSUE_TYPES.find((value) => value === issue.type) ?? 'other';
    const severity = ISSUE_SEVERITIES.find((value) => value === issue.severity) ?? 'critical';
    const description = typeof issue.description === 'string' ? issue.description : '';
    const sendBackTo = typeof issue.sendBackTo === 'string' && ctx.runAgentNames.has(issue.sendBackTo) ? issue.sendBackTo : null;
    const requiredDocumentType = issue.requiredDocumentType === KEYED_DOCUMENT_TYPE ? KEYED_DOCUMENT_TYPE : null;
    const requiredServiceDate = typeof issue.serviceDate === 'string' && ISO_DATE.test(issue.serviceDate) ? issue.serviceDate : null;
    return { caseId: ctx.caseId, type, severity, blocking: issue.blocking !== false, status: 'open', source: ctx.agentName,
      sourceRunId: ctx.agentRunId, description, ownerId: null, requiredDocumentType, requiredServiceDate,
      dedupeKey: qualityDedupeKey(ctx.agentName, type, requiredDocumentType, requiredServiceDate, description), sendBackTo };
  });
}

// Wording changes between runs, so the key comes from what is missing, not from the sentence.
function qualityDedupeKey(agentName: string, type: IssueType, documentType: string | null, serviceDate: string | null, description: string): string {
  if (type === 'missing_document' && documentType && serviceDate) return `missing_document:${documentType}:${serviceDate}`;
  if (type === 'date_conflict') return `${agentName}:date_conflict`;
  return `${agentName}:${type}:${createHash('sha256').update(description).digest('hex').slice(0, 16)}`;
}

/**
 * The stored report. A failed check names the claims a clinician can act on to clear it.
 * Model findings naming no real claim, and quote failures no claim relies on, stay visible as needs_review.
 */
export function reportChecks(merged: readonly Check[], claimIds: ReadonlyMap<string, string>, quoteFailureClaims: readonly string[]) {
  return merged.map((check) => {
    const named = check.origin === 'code' ? (check.name === 'quote_support' ? quoteFailureClaims : []) : (check.affected ?? []).flatMap((alias) => claimIds.get(alias) ?? []);
    const affected = [...new Set(named)];
    const nothingToAct = affected.length === 0 && (check.origin === 'model' || check.name === 'quote_support');
    return { name: check.name, origin: check.origin, detail: '', affected, result: check.result === 'fail' && nothingToAct ? 'needs_review' as const : check.result };
  });
}

export function mergeChecks(codeChecks: readonly Check[], modelChecks: readonly Check[]): Check[] {
  const rank = { pass: 0, needs_review: 1, fail: 2 };
  const merged = new Map<string, Check>();
  for (const check of [...codeChecks.map((entry) => ({ ...entry, origin: 'code' as const })), ...modelChecks.map((entry) => ({ ...entry, origin: 'model' as const }))]) {
    const previous = merged.get(check.name);
    if (!previous || rank[check.result] > rank[previous.result] || (rank[check.result] === rank[previous.result] && check.origin === 'code')) merged.set(check.name, { ...check });
  }
  return [...merged.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
