import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { scrapeWebsite } from "@/lib/firecrawl";
import { extractCompanyProfile } from "@/lib/perplexity";
import { computeScores, type CompanyRow } from "@/lib/scoring";
import { normalizeStructured, type StructuredData } from "@/lib/structurer";
import { companyMatchPreviews, companyUrlCache, companyUrlMatchCache, structuredData, tenders } from "@/lib/schema";

export const PREVIEW_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
export const PREVIEW_MATCH_TTL_MS = 15 * 60 * 1000;
export const PREVIEW_EXPIRY_MS = 15 * 60 * 1000;
export const PREVIEW_SCORING_VERSION = "v1";

export class PreviewUrlError extends Error {
  constructor(message: string, public readonly code = "INVALID_PREVIEW_URL") {
    super(message);
    this.name = "PreviewUrlError";
  }
}

export const isPreviewRequestAllowed = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol)
      && !parsed.username
      && !parsed.password
      && !parsed.port
      && parsed.hostname !== "localhost"
      && !parsed.hostname.endsWith(".internal")
      && !isPrivateAddress(parsed.hostname);
  } catch {
    return false;
  }
};

const isPrivateAddress = (address: string): boolean => {
  if (!net.isIP(address)) return false;
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return false;
};

export async function canonicalizePreviewUrl(value: string): Promise<{ canonicalUrl: string; urlHash: string }> {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new PreviewUrlError("Ungueltige Website-URL."); }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.port) throw new PreviewUrlError("Nur öffentliche HTTP(S)-Websites ohne Zugangsdaten sind erlaubt.");
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".internal") || isPrivateAddress(hostname)) throw new PreviewUrlError("Private oder interne Adressen sind nicht erlaubt.");
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new PreviewUrlError("Private oder interne Adressen sind nicht erlaubt.");
  } catch (error) {
    if (error instanceof PreviewUrlError) throw error;
    throw new PreviewUrlError("Website konnte nicht sicher geprüft werden.", "URL_DNS_FAILED");
  }
  const pathname = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const canonicalUrl = `${parsed.protocol}//${hostname}${pathname}${parsed.search}`;
  return { canonicalUrl, urlHash: crypto.createHash("sha256").update(canonicalUrl).digest("hex") };
}

const asStringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
const sanitizedProfile = (profile: Awaited<ReturnType<typeof extractCompanyProfile>>) => ({
  name: profile.name,
  description: profile.description,
  industry: profile.industry,
  capabilities: asStringList(profile.capabilities),
  certifications: asStringList(profile.certifications),
  regions: asStringList(profile.regions),
  team_size: profile.team_size,
});
const parseStructured = (value: unknown, title: string): StructuredData => {
  if (value && typeof value === "object") return normalizeStructured(value, title);
  return normalizeStructured({}, title);
};

const companyRow = (profile: Record<string, unknown>): CompanyRow => ({
  capabilities_json: JSON.stringify(profile.capabilities ?? []),
  certifications_json: JSON.stringify(profile.certifications ?? []),
  regions_json: JSON.stringify(profile.regions ?? []),
  team_size: typeof profile.team_size === "number" ? profile.team_size : null,
  industry: typeof profile.industry === "string" ? profile.industry : null,
});

const previewReason = (score: ReturnType<typeof computeScores>): string => {
  const details = score.details as Record<string, unknown>;
  const domainReason = typeof details.domain_reason === "string" ? details.domain_reason : "Fachliche Passung erkannt.";
  const regionReason = typeof details.location_reason === "string" ? details.location_reason : "Regionale Prüfung erfolgt.";
  return `${domainReason} ${regionReason}`.trim().slice(0, 280);
};

export async function processCompanyUrlPreview(cacheId: number): Promise<void> {
  const cacheRows = await db.select().from(companyUrlCache).where(eq(companyUrlCache.id, cacheId)).limit(1);
  if (!cacheRows[0]) throw new Error("Preview-Cache nicht gefunden");
  const cache = cacheRows[0];
  try {
    let profile: Record<string, unknown>;
    if (cache.status === "ready" && cache.profileJson && cache.expiresAt && cache.expiresAt > new Date()) {
      profile = cache.profileJson as Record<string, unknown>;
    } else {
      const scraped = await scrapeWebsite(cache.canonicalUrl, { requestUrlGuard: isPreviewRequestAllowed });
      if (!scraped.markdown || scraped.markdown.trim().length < 50) throw new Error("WEBSITE_CONTENT_EMPTY");
      await canonicalizePreviewUrl(scraped.url);
      profile = sanitizedProfile(await extractCompanyProfile(scraped.markdown, scraped.url));
      const profileJson = profile as Record<string, unknown>;
      await db.update(companyUrlCache).set({
        finalUrl: scraped.url,
        profileJson,
        profileFingerprint: crypto.createHash("sha256").update(JSON.stringify(profileJson)).digest("hex"),
        status: "ready",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + PREVIEW_PROFILE_TTL_MS),
        failureCode: null,
        updatedAt: new Date(),
      }).where(eq(companyUrlCache.id, cacheId));
    }

    const now = new Date();
    const rows = await db.select({
      id: tenders.id,
      title: tenders.title,
      source: tenders.source,
      url: tenders.url,
      deadlineAt: tenders.deadlineAt,
      metadataJson: tenders.metadataJson,
      structuredJson: structuredData.jsonBlob,
    }).from(tenders).leftJoin(structuredData, eq(structuredData.tenderId, tenders.id)).where(and(
      or(eq(tenders.qualityStatus, "qualified"), eq(tenders.qualityStatus, "candidate")),
      gt(tenders.deadlineAt, now),
    )).orderBy(desc(tenders.createdAt)).limit(500);
    const scored = rows.map((row) => {
      const structured = parseStructured(row.structuredJson, row.title ?? "");
      const metadata = row.metadataJson && typeof row.metadataJson === "object" ? row.metadataJson as Record<string, unknown> : {};
      const score = computeScores(row.title ?? "", structured, companyRow(profile), undefined, {
        metadataLocation: metadata.location,
        metadataDescription: metadata.description,
        structuredLocation: structured.hard_facts.location,
      });
      return { row, score };
    }).filter((entry) => !entry.score.kill_switch).sort((a, b) => b.score.fit - a.score.fit || b.score.win_probability - a.score.win_probability || a.row.id - b.row.id).slice(0, 3);
    await db.delete(companyUrlMatchCache).where(eq(companyUrlMatchCache.cacheId, cacheId));
    if (scored.length > 0) {
      await db.insert(companyUrlMatchCache).values(scored.map(({ row, score }, index) => ({
        cacheId,
        rank: index + 1,
        tenderId: row.id,
        titleSnapshot: row.title ?? `Ausschreibung #${row.id}`,
        sourceSnapshot: row.source ?? "Unbekannte Quelle",
        urlSnapshot: row.url ?? null,
        deadlineAtSnapshot: row.deadlineAt,
        fit: score.fit,
        winProbability: score.win_probability,
        reason: previewReason(score),
        detailsJson: {},
        scoringVersion: PREVIEW_SCORING_VERSION,
        expiresAt: new Date(Date.now() + PREVIEW_MATCH_TTL_MS),
      })));
    }
    await db.update(companyMatchPreviews).set({ status: "completed", cacheId, completedAt: now, expiresAt: new Date(Date.now() + PREVIEW_EXPIRY_MS), updatedAt: now }).where(and(eq(companyMatchPreviews.cacheId, cacheId), or(eq(companyMatchPreviews.status, "queued"), eq(companyMatchPreviews.status, "processing"))));
  } catch (error) {
    await db.update(companyUrlCache).set({ status: "failed", failureCode: error instanceof Error ? error.message.slice(0, 120) : "PREVIEW_FAILED", expiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date() }).where(eq(companyUrlCache.id, cacheId));
    await db.update(companyMatchPreviews).set({ status: "failed", errorCode: "PREVIEW_FAILED", updatedAt: new Date() }).where(and(eq(companyMatchPreviews.cacheId, cacheId), or(eq(companyMatchPreviews.status, "queued"), eq(companyMatchPreviews.status, "processing"))));
    throw error;
  }
}
