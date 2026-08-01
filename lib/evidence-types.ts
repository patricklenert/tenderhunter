export const EVIDENCE_VERIFICATION_STATUSES = ["unverified", "verified", "rejected"] as const;
export type EvidenceVerificationStatus = (typeof EVIDENCE_VERIFICATION_STATUSES)[number];

export type EvidenceValidityStatus = "valid" | "expiring_soon" | "expired" | "no_expiry";

export const EVIDENCE_MAX_FILE_BYTES = Number(process.env.EVIDENCE_MAX_FILE_BYTES ?? 25 * 1024 * 1024);

export const ALLOWED_EVIDENCE_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

export const evidenceValidity = (expiresAt: Date | null, now = new Date()): EvidenceValidityStatus => {
  if (!expiresAt) return "no_expiry";
  const timeLeft = expiresAt.getTime() - now.getTime();
  if (timeLeft <= 0) return "expired";
  if (timeLeft <= 30 * 24 * 60 * 60 * 1000) return "expiring_soon";
  return "valid";
};

export const evidenceUsable = (
  verificationStatus: string,
  validityStatus: EvidenceValidityStatus,
  hasCleanFile: boolean,
  sourceUrl: string | null,
): boolean => (
  verificationStatus === "verified"
  && validityStatus !== "expired"
  && (hasCleanFile || Boolean(sourceUrl))
);
