import { z } from "zod";

export const previewStateSchema = z.object({
  sourceRequested: z.boolean(), sourceAttached: z.boolean(), handoffAt: z.string().nullable(),
  assignee: z.enum(["Casey Rivera, LCSW", "Jordan Lee, LCSW"]),
  escalation: z.object({ owner: z.enum(["Coordinator", "Clinician", "Manager"]), reason: z.string().max(300), status: z.enum(["open", "routed"]) }),
  events: z.array(z.object({ id: z.string(), actor: z.string(), message: z.string(), at: z.string() })).max(40),
});
export type RolePreviewState = z.infer<typeof previewStateSchema>;
export const initialRolePreview: RolePreviewState = {
  sourceRequested: false, sourceAttached: false, handoffAt: null,
  assignee: "Casey Rivera, LCSW",
  escalation: { owner: "Coordinator", reason: "Original November 2 progress note is missing.", status: "open" },
  events: [],
};
export type PreviewAction =
  | { type: "request_source" }
  | { type: "attach_source" }
  | { type: "handoff" }
  | { type: "assign"; assignee: RolePreviewState["assignee"] }
  | { type: "route"; owner: RolePreviewState["escalation"]["owner"]; reason: string };
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
  }
  return { ...next, events: [{ id, actor, message, at }, ...state.events].slice(0, 40) };
}
