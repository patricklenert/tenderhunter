import { z } from "zod";
import { TRACKED_TENDER_STATUSES, TRACKING_EVENT_TYPES } from "@/lib/tracked-tender-types";

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
