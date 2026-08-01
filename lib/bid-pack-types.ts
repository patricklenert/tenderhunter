export const BID_PACK_DECISION_STATUSES = ["undecided", "go", "no_go"] as const;
export type BidPackDecisionStatus = (typeof BID_PACK_DECISION_STATUSES)[number];

export const BID_PACK_REQUIREMENT_STATUSES = ["open", "met", "not_met", "waived"] as const;
export type BidPackRequirementStatus = (typeof BID_PACK_REQUIREMENT_STATUSES)[number];

export const BID_PACK_TASK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type BidPackTaskStatus = (typeof BID_PACK_TASK_STATUSES)[number];
