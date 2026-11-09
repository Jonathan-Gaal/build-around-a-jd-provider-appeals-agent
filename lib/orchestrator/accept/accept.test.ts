import { describe, expect, it } from 'vitest';
import { acceptDraftClaims, acceptQualityIssues, buildPeriodClaims, findDuplicateIds, mergeChecks, reportChecks, resolveFactIds, type AcceptContext } from './accept';

describe('reportChecks', () => {
  const aliases = new Map([['claim-1', 'id-1'], ['claim-2', 'id-2']]);
  it('names the claims relying on a failed quote', () => {
    expect(reportChecks([{ name: 'quote_support', result: 'fail', origin: 'code' }], aliases, ['id-2', 'id-2'])).toEqual([{ name: 'quote_support', origin: 'code', detail: '', affected: ['id-2'], result: 'fail' }]);
  });
  it('downgrades a failed quote no claim relies on', () => {
    expect(reportChecks([{ name: 'quote_support', result: 'fail', origin: 'code' }], aliases, [])[0].result).toBe('needs_review');
  });
  it('maps model aliases to claim IDs and drops invented ones', () => {
    expect(reportChecks([{ name: 'm', result: 'fail', origin: 'model', affected: ['claim-1', 'claim-9', 'id-2'] }], aliases, [])[0]).toMatchObject({ result: 'fail', affected: ['id-1'] });
  });
  it('downgrades a model failure naming no real claim', () => {
    for (const affected of [undefined, [], ['claim-9']]) expect(reportChecks([{ name: 'm', result: 'fail', origin: 'model', affected }], aliases, [])[0]).toMatchObject({ result: 'needs_review', affected: [] });
  });
  it('keeps other code failures as hard blocks with nothing to clear them', () => {
    expect(reportChecks([{ name: 'output_boundary', result: 'fail', origin: 'code', affected: ['claim-1'] }], aliases, ['id-1'])[0]).toMatchObject({ result: 'fail', affected: [] });
  });
  it('strips model text and never upgrades a result', () => {
    expect(reportChecks([{ name: 'm', result: 'pass', origin: 'model', detail: 'text' } as never], aliases, [])[0]).toEqual({ name: 'm', origin: 'model', detail: '', affected: [], result: 'pass' });
  });
});
import { CLAIM_STATUSES, ISSUE_TYPES, PACKET_KINDS } from '../../db/enums';
const ctx: AcceptContext = { caseId: 'UR-1042', agentName: 'drafting', agentRunId: 'run-1', verifiedFactIds: new Set(['f1']), verifiedQuotes: [], runAgentNames: new Set(['clinical-documentation', 'drafting', 'quality']) };
const draft = (claim: Record<string, unknown>) => acceptDraftClaims([{ heading: 'Summary', claims: [claim] }], ctx)[0];
describe('accept output', () => {
  it('ignores protected columns in hostile output', () => {
    expect(draft({ text: 'Patient reported passive SI.', sourceKind: 'direct_quote', factIds: ['f1'], material: false, status: 'source_verified', case_id: 'UR-OTHER', type: 'objection', boundaryFlagged: false })).toEqual({ caseId: 'UR-1042', agentRunId: 'run-1', author: 'drafting', sectionHeading: 'Summary', position: 0, text: 'Patient reported passive SI.', type: 'clinical_fact', sourceKind: 'direct_quote', status: 'source_verified', material: true, factIds: ['f1'], boundaryFlagged: false, originalText: null });
  });
  it('requires every fact reference, and at least one, to verify', () => {
    expect(resolveFactIds(['f1', 'f9'], ctx.verifiedFactIds)).toEqual({ resolved: false, missing: ['f9'] });
    expect(draft({ text: 'Fact', sourceKind: 'direct_quote', factIds: ['f1', 'f9'] }).status).toBe('unsupported');
    expect(draft({ text: 'Synthesis', sourceKind: 'agent_synthesis', factIds: [] })).toMatchObject({ status: 'unsupported', type: 'narrative' });
    expect(draft({ text: 'Fact', sourceKind: 'clinician_text', factIds: ['f1'] })).toMatchObject({ sourceKind: 'agent_synthesis', type: 'narrative' });
  });
  it('never verifies a drafted claim that cites a period ID, whatever its text', () => {
    // The ID can reach the verified set if the extraction agent names its own fact after a period.
    const collided = { ...ctx, verifiedFactIds: new Set(['f1', 'period-requested', 'period-authorized']) };
    const accept = (factIds: string[]) => acceptDraftClaims([{ heading: 'Summary', claims: [{ text: 'Patient may be discharged on 2026-11-03.', sourceKind: 'extracted_fact', factIds }] }], collided)[0];
    expect(accept(['period-authorized'])).toMatchObject({ status: 'unsupported', type: 'clinical_fact' });
    expect(accept(['period-requested'])).toMatchObject({ status: 'unsupported', type: 'clinical_fact' });
    expect(accept(['f1', 'period-authorized']).status).toBe('unsupported');
    expect(accept(['f1']).status).toBe('source_verified');
  });
  it('writes each period claim from the stored values, keeping the two periods separate', () => {
    expect(buildPeriodClaims({ requested: { start: '2026-11-04', end: '2026-11-06' }, authorized: { start: '2026-11-01', end: '2026-11-03' } }, 'UR-1042', 21)).toEqual([
      { caseId: 'UR-1042', agentRunId: null, author: 'code', sectionHeading: 'Review periods', position: 21, text: 'Requested period: 2026-11-04 through 2026-11-06.', type: 'administrative_fact', sourceKind: 'extracted_fact', status: 'source_verified', material: true, factIds: ['period-requested'], boundaryFlagged: false, originalText: null },
      { caseId: 'UR-1042', agentRunId: null, author: 'code', sectionHeading: 'Review periods', position: 22, text: 'Authorized period: 2026-11-01 through 2026-11-03.', type: 'administrative_fact', sourceKind: 'extracted_fact', status: 'source_verified', material: true, factIds: ['period-authorized'], boundaryFlagged: false, originalText: null },
    ]);
  });
  it('scans boundary rather than trusting flags', () => {
    expect(draft({ text: 'Medical necessity is met.', factIds: ['f1'] }).boundaryFlagged).toBe(true);
    expect(acceptDraftClaims([{ heading: '', claims: [{ text: 'Medical necessity is met.', factIds: ['f1'] }] }], { ...ctx, verifiedQuotes: ['Medical necessity is met.'] })[0].boundaryFlagged).toBe(false);
  });
  it('preserves packet-wide order and detects duplicate ids', () => {
    expect(acceptDraftClaims([{ heading: 'A', claims: [{}, {}] }, { heading: 'B', claims: [{}] }], ctx).map(({ position, sectionHeading }) => [position, sectionHeading])).toEqual([[0, 'A'], [1, 'A'], [2, 'B']]);
    expect(findDuplicateIds([{ id: 'f1' }, { id: 'f2' }, { id: 'f1' }, { id: 'f1' }])).toEqual(['f1']);
  });
  it('cannot target or close an existing issue', () => {
    const output = acceptQualityIssues([{ type: 'missing_document', severity: 'minor', blocking: false, status: 'resolved', issueId: 'existing', description: 'Note on file; resolved.' }], ctx);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ status: 'open', ownerId: null, source: 'drafting', sourceRunId: 'run-1', caseId: 'UR-1042' });
    expect(output[0]).not.toHaveProperty('id'); expect(output[0]).not.toHaveProperty('issueId');
  });
  it('defaults fail closed and restricts routing to agents in this run', () => {
    expect(acceptQualityIssues([{ type: 'approve_now', severity: 'urgent', blocking: 'no', sendBackTo: 'payer-portal' }, { sendBackTo: 'clinical-documentation' }], ctx)).toMatchObject([{ type: 'other', severity: 'critical', blocking: true, sendBackTo: null }, { sendBackTo: 'clinical-documentation' }]);
  });
  it('uses stable description hashes', () => {
    // node -e "console.log(require('crypto').createHash('sha256').update('hello').digest('hex').slice(0,16))"
    expect(acceptQualityIssues([{ description: 'hello' }], ctx)[0].dedupeKey).toBe('drafting:other:2cf24dba5fb0a30e');
  });
  it('keys a missing note by what is missing, so rewording cannot open a second copy', () => {
    const [first] = acceptQualityIssues([{ type: 'missing_document', description: 'Progress note for Nov 2 absent', requiredDocumentType: 'progress_note', serviceDate: '2026-11-02' }], ctx);
    const [reworded] = acceptQualityIssues([{ type: 'missing_document', description: 'No note on file for 11/02', requiredDocumentType: 'progress_note', serviceDate: '2026-11-02' }], ctx);
    expect(first).toMatchObject({ dedupeKey: 'missing_document:progress_note:2026-11-02', requiredDocumentType: 'progress_note', requiredServiceDate: '2026-11-02' });
    expect(reworded.dedupeKey).toBe(first.dedupeKey);
  });
  it('keeps one open date conflict per agent whatever the wording', () => {
    const [first] = acceptQualityIssues([{ type: 'date_conflict', description: 'Request runs past approval' }], ctx);
    const [reworded] = acceptQualityIssues([{ type: 'date_conflict', description: 'Requested days exceed authorized days' }], ctx);
    expect(first.dedupeKey).toBe('drafting:date_conflict');
    expect(reworded.dedupeKey).toBe(first.dedupeKey);
  });
  it('falls back to a description key when the model names a bad type or date', () => {
    const [malformed] = acceptQualityIssues([{ type: 'missing_document', description: 'x', requiredDocumentType: 'policy', serviceDate: 'Nov 2' }], ctx);
    const [bare] = acceptQualityIssues([{ type: 'missing_document', description: 'x' }], ctx);
    expect(malformed).toMatchObject({ requiredDocumentType: null, requiredServiceDate: null });
    expect(malformed.dedupeKey).toBe(bare.dedupeKey);
    expect(malformed.dedupeKey).toMatch(/^drafting:missing_document:/);
  });
  it('model passes never clear code failure, ties favour code', () => {
    expect(mergeChecks([{ name: 'date_coverage', result: 'fail', origin: 'code' }], [{ name: 'date_coverage', result: 'pass', origin: 'model' }, { name: 'dates_consistent', result: 'fail', origin: 'model' }])).toEqual([{ name: 'date_coverage', result: 'fail', origin: 'code' }, { name: 'dates_consistent', result: 'fail', origin: 'model' }]);
    expect(mergeChecks([{ name: 'b', result: 'needs_review', origin: 'code' }], [{ name: 'b', result: 'needs_review', origin: 'model' }, { name: 'a', result: 'fail', origin: 'model' }])).toEqual([{ name: 'a', result: 'fail', origin: 'model' }, { name: 'b', result: 'needs_review', origin: 'code' }]);
  });
  it('handles empty inputs without inventing output', () => {
    expect(mergeChecks([], [])).toEqual([]);
    expect(acceptDraftClaims([], ctx)).toEqual([]); expect(acceptQualityIssues([], ctx)).toEqual([]);
  });
  it('pins shared enum values', () => {
    expect(ISSUE_TYPES).toEqual(['missing_document', 'date_conflict', 'unsupported_claim', 'stale_policy', 'extraction_uncertain', 'insurer_objection', 'other']);
    expect(CLAIM_STATUSES).toEqual(['agent_prepared', 'source_verified', 'unsupported', 'clinician_edited', 'clinician_approved', 'stale', 'rejected']);
    expect(PACKET_KINDS).toEqual(['review_packet', 'appeal_letter', 'p2p_points', 'document_request']);
  });
});
