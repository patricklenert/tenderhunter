import { z } from "zod";
import { TRACKED_TENDER_STATUSES, TRACKING_EVENT_TYPES } from "@/lib/tracked-tender-types";
import {
  BID_PACK_DECISION_STATUSES,
  BID_PACK_REQUIREMENT_STATUSES,
  BID_PACK_TASK_STATUSES,
} from "@/lib/bid-pack-types";

export const sourceItemSchema = z.object({
  key: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().url()
});

export const crawlSchema = z.object({
  sources: z.array(sourceItemSchema).optional()
});

export const manualTenderSchema = z.object({
  source: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  external_id: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export const companyProfileSchema = z.object({
  name: z.string().min(1),
  capabilities: z.array(z.string().min(1)),
  certifications: z.array(z.string().min(1)).default([]),
  team_size: z.number().int().positive().optional(),
  regions: z.array(z.string().min(1)).default([]),
  markets: z.array(z.enum(["DE", "US"])).default([]),
  naics_codes: z.array(z.string().regex(/^\d{6}$/)).default([]),
  psc_codes: z.array(z.string().min(2).max(4)).default([]),
  uei: z.string().trim().min(12).max(12).optional(),
  cage_code: z.string().trim().min(5).max(5).optional(),
  socio_economic: z.array(z.enum(["small_business", "wosb", "edwosb", "sdvosb", "vosb", "8a", "hubzone"])).default([]),
});

export const trackEventSchema = z.object({
  tender_id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  event_type: z.enum(TRACKING_EVENT_TYPES),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export const trackedTenderStatusSchema = z.enum(TRACKED_TENDER_STATUSES);

export const trackedTenderCreateSchema = z.object({
  tender_id: z.number().int().positive(),
  company_id: z.number().int().positive(),
  status: trackedTenderStatusSchema.default("tracked"),
  owner: z.string().trim().max(120).optional(),
  deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const trackedTenderUpdateSchema = z
  .object({
    status: trackedTenderStatusSchema.optional(),
    owner: z.string().trim().max(120).nullable().optional(),
    deadline_at: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "mindestens ein Feld ist erforderlich",
  });

export const bidPackCreateSchema = z.object({
  tracked_tender_id: z.number().int().positive(),
  decision_status: z.enum(BID_PACK_DECISION_STATUSES).optional(),
  decision_note: z.string().trim().max(2000).nullable().optional(),
});

export const bidPackDecisionUpdateSchema = z
  .object({
    decision_status: z.enum(BID_PACK_DECISION_STATUSES).optional(),
    decision_note: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "mindestens ein Feld ist erforderlich",
  });

export const bidPackRequirementUpdateSchema = z.object({
  status: z.enum(BID_PACK_REQUIREMENT_STATUSES),
});

export const bidPackTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(500),
  requirement_id: z.number().int().positive().nullable().optional(),
  assignee: z.string().trim().max(120).nullable().optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const bidPackTaskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    status: z.enum(BID_PACK_TASK_STATUSES).optional(),
    requirement_id: z.number().int().positive().nullable().optional(),
    assignee: z.string().trim().max(120).nullable().optional(),
    due_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "mindestens ein Feld ist erforderlich",
  });

export const companyEvidenceCreateSchema = z.object({
  evidence_type: z.string().trim().min(1).max(80).default("other"),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000).nullable().optional(),
  issuer: z.string().trim().max(240).nullable().optional(),
  issued_at: z.string().datetime({ offset: true }).nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const companyEvidenceUpdateSchema = companyEvidenceCreateSchema.partial();

export const companyEvidenceVerificationSchema = z.object({
  status: z.enum(["unverified", "verified", "rejected"]),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const requirementEvidenceLinkSchema = z.object({
  evidence_id: z.number().int().positive(),
  rationale: z.string().trim().max(1000).nullable().optional(),
});
