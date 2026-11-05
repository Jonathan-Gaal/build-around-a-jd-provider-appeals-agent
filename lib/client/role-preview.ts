import { z } from "zod";
import { canPreparePreviewHandoff, demoReceiptPattern, getSubmissionExample, samePreviewPacket, type SubmissionScenario } from "./submission-preview";

export const previewStateSchema = z.object({
  sourceRequested: z.boolean(), sourceAttached: z.boolean(), handoffAt: z.string().nullable(),
  assignee: z.enum(["Casey Rivera, LCSW", "Jordan Lee, LCSW"]),
  escalation: z.object({ owner: z.enum(["Coordinator", "Clinician", "Manager"]), reason: z.string().max(300), status: z.enum(["open", "routed"]) }),
  events: z.array(z.object({ id: z.string(), actor: z.string(), message: z.string(), at: z.string() })).max(40),
  submissionScenario: z.enum(["pending", "approved", "changed"]).default("pending"),
  preparedPacket: z.object({ version: z.number().int().positive(), hash: z.string() }).nullable().default(null),
  receipt: z.object({ reference: z.string().regex(demoReceiptPattern), destination: z.enum(["Offline handoff preview", "Internal team handoff preview"]), version: z.number().int().positive(), hash: z.string(), at: z.string() }).nullable().default(null),
});
export type RolePreviewState = z.infer<typeof previewStateSchema>;
export const initialRolePreview: RolePreviewState = {
  sourceRequested: false, sourceAttached: false, handoffAt: null,
  assignee: "Casey Rivera, LCSW",
  escalation: { owner: "Coordinator", reason: "Original November 2 progress note is missing.", status: "open" },
  events: [],
  submissionScenario: "pending", preparedPacket: null, receipt: null,
};
export type PreviewAction =
  | { type: "request_source" }
  | { type: "attach_source" }
  | { type: "handoff" }
  | { type: "assign"; assignee: RolePreviewState["assignee"] }
  | { type: "route"; owner: RolePreviewState["escalation"]["owner"]; reason: string }
  | { type: "submission_scenario"; scenario: SubmissionScenario }
  | { type: "prepare_handoff" }
  | { type: "record_receipt"; reference: string; destination: "Offline handoff preview" | "Internal team handoff preview" };
export function applyPreviewAction(state: RolePreviewState, action: PreviewAction, at: string, id: string): RolePreviewState {
  let next = state;
  let actor = "Coordinator", message = "";
  switch (action.type) {
    case "request_source":
      if (state.sourceRequested || state.sourceAttached) return state;
      next = { ...state, sourceRequested: true }; message = "Original synthetic November 2 note requested."; break;
    case "attach_source":
      if (state.sourceAttached) return state;
      next = { ...state, sourceAttached: true }; message = "Original synthetic November 2 note attached to the preview source inventory."; break;
    case "handoff":
      if (!state.sourceAttached || state.handoffAt) return state;
      next = { ...state, handoffAt: at }; message = "Source collection handed to the clinician for review. Clinical issues remain for the clinician."; break;
    case "assign":
      if (state.assignee === action.assignee) return state;
      next = { ...state, assignee: action.assignee }; actor = "Manager"; message = `Preview review assigned to ${action.assignee}.`; break;
    case "route":
      if (!action.reason.trim()) return state;
      next = { ...state, escalation: { owner: action.owner, reason: action.reason, status: "routed" } }; actor = "Manager"; message = `Escalation routed to ${action.owner}: ${action.reason}`; break;
    case "submission_scenario":
      if (state.submissionScenario === action.scenario) return state;
      return { ...state, submissionScenario: action.scenario, preparedPacket: null };
    case "prepare_handoff": {
      const example = getSubmissionExample(state.submissionScenario);
      if (!canPreparePreviewHandoff(example)) return state;
      next = { ...state, preparedPacket: { ...example.packet } }; actor = "Submission staff"; message = `Prepared a local handoff preview for exact packet v${example.packet.version}. Nothing was transmitted.`; break;
    }
    case "record_receipt": {
      const example = getSubmissionExample(state.submissionScenario);
      if (!canPreparePreviewHandoff(example) || !samePreviewPacket(state.preparedPacket, example.packet) || !demoReceiptPattern.test(action.reference.trim())) return state;
      next = { ...state, receipt: { reference: action.reference.trim(), destination: action.destination, ...example.packet, at } }; actor = "Submission staff"; message = `Recorded fictional handoff reference ${action.reference.trim()} for packet v${example.packet.version}. No payer submission occurred.`; break;
    }
  }
  return { ...next, events: [{ id, actor, message, at }, ...state.events].slice(0, 40) };
}
