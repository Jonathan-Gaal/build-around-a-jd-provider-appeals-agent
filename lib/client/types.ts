export type CaseSummary = {
  id: string; patientLabel: string; type: string; levelOfCare: string;
  dueAt: string | null; status: string; issueCount: number;
  blockingIssueCount: number; lastUpdatedAt: string; overdue: boolean; synthetic: true;
};
