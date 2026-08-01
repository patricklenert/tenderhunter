import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bidPacks,
  companyProfiles,
  insights,
  scores,
  structuredData,
  tenders,
  trackedTenders,
  userCompanies,
} from "@/lib/schema";
import { user } from "@/lib/auth-schema";
import {
  BidPackError,
  createBidPack,
  createBidPackTask,
  getBidPackForUser,
  linkBidPackEvidence,
  updateBidPack,
  updateBidPackRequirement,
  updateBidPackTask,
} from "@/lib/bid-packs";
import { createCompanyEvidence, deleteCompanyEvidence, listCompanyEvidence, uploadCompanyEvidenceFile, verifyCompanyEvidence } from "@/lib/company-evidence";

const suffix = Date.now().toString();
const userId = `bid-pack-test-user-${suffix}`;
const otherUserId = `bid-pack-test-other-${suffix}`;
const email = `bid-pack-${suffix}@example.test`;
const otherEmail = `bid-pack-other-${suffix}@example.test`;

let companyId: number | null = null;
let tenderId: number | null = null;
let trackedTenderId: number | null = null;
let evidenceId: number | null = null;

const run = async () => {
  await db.insert(user).values([
    { id: userId, name: "Bid Pack Test", email },
    { id: otherUserId, name: "Bid Pack Other", email: otherEmail },
  ]);

  const company = await db.insert(companyProfiles).values({
    name: `Bid Pack Test Company ${suffix}`,
    websiteUrl: `https://bid-pack-${suffix}.example.test`,
    capabilitiesJson: ["Softwareentwicklung", "IT-Beratung"],
    certificationsJson: ["ISO 9001"],
    regionsJson: ["Deutschland"],
  }).returning({ id: companyProfiles.id });
  companyId = company[0].id;

  await db.insert(userCompanies).values({ userId, companyId, isActive: true });

  const tender = await db.insert(tenders).values({
    source: "bid-pack-test",
    url: `https://bid-pack-${suffix}.example.test/tender`,
    title: "Softwareplattform für öffentliche Verwaltung",
    deadlineAt: new Date("2026-09-30T12:00:00.000Z"),
  }).returning({ id: tenders.id });
  tenderId = tender[0].id;

  await db.insert(structuredData).values({
    tenderId,
    jsonBlob: {
      title: "Softwareplattform für öffentliche Verwaltung",
      decision_relevant: {
        requirements: ["Erfahrung mit öffentlichen Auftraggebern"],
        mandatory_documents: ["Referenzliste"],
        scope: ["Entwicklung und Betrieb einer Webplattform"],
        award_criteria: ["Qualität", "Preis"],
      },
      procurement: {
        participation_requirements: ["Eigenerklärung zur Eignung"],
        contract_value: { min: null, max: 100000, currency: "EUR" },
      },
      summary: "Testausschreibung",
      confidence: 0.9,
    },
  });
  await db.insert(scores).values({
    tenderId,
    companyId,
    fit: 82,
    winProbability: 71,
    effort: 48,
    requirementCoverage: 0.75,
    killSwitch: false,
    detailsJson: { domain_status: "match" },
  });
  await db.insert(insights).values({
    tenderId,
    companyId,
    explanation: "Die Testfirma passt fachlich zur Ausschreibung.",
    actionsJson: ["Referenzliste prüfen", "Kalkulation vorbereiten"],
    missingItemsJson: ["Versicherungsnachweis"],
  });

  const tracked = await db.insert(trackedTenders).values({
    tenderId,
    companyId,
    status: "reviewing",
    deadlineAt: new Date("2026-09-30T12:00:00.000Z"),
  }).returning({ id: trackedTenders.id });
  trackedTenderId = tracked[0].id;

  const first = await createBidPack({ userId, trackedTenderId });
  assert.equal(first.decisionStatus, "undecided");
  assert.equal(first.workflowStatus, "reviewing");
  assert.equal(first.requirements.length, 4);
  assert.equal(first.tasks.length, 2);
  assert.equal(first.requirements.filter((item) => item.isMandatory).length, 3);

  const second = await createBidPack({ userId, trackedTenderId });
  assert.equal(second.id, first.id, "creation must be idempotent");

  await db.update(tenders).set({ title: "Spätere Tender-Aktualisierung" }).where(eq(tenders.id, tenderId));
  await db.update(scores).set({ fit: 12 }).where(and(eq(scores.tenderId, tenderId), eq(scores.companyId, companyId)));
  const frozen = await getBidPackForUser(userId, first.id);
  assert.equal(frozen.title, "Softwareplattform für öffentliche Verwaltung", "pack metadata must use its snapshot");
  assert.equal(frozen.analysis.fit, 82, "pack analysis must use its snapshot");

  const decided = await updateBidPack(userId, first.id, {
    decisionStatus: "go",
    decisionNote: "Fachlich passend, Nachweise werden geprüft.",
  });
  assert.equal(decided.decisionStatus, "go");
  assert.equal(decided.workflowStatus, "reviewing", "decision must not change workflow status");

  const requirement = decided.requirements[0];
  const evidence = await createCompanyEvidence(userId, companyId, {
    evidenceType: "reference",
    title: "Referenz Stadtverwaltung",
    description: "Testreferenz für kommunale Softwareprojekte.",
  });
  evidenceId = evidence.id;
  const uploadedFile = await uploadCompanyEvidenceFile(userId, companyId, evidence.id, new File([Buffer.from("%PDF-1.7\nTestnachweis")], "referenz.pdf", { type: "application/pdf" }));
  assert.equal(uploadedFile.contentType, "application/pdf");
  assert.ok((await listCompanyEvidence(userId, companyId)).find((item) => item.id === evidence.id)?.files.length === 1);
  await verifyCompanyEvidence(userId, companyId, evidence.id, "verified", "Testprüfung");
  const linked = await linkBidPackEvidence(userId, first.id, requirement.id, evidence.id, "Passt zur geforderten Erfahrung.");
  assert.equal(linked.requirements.find((item) => item.id === requirement.id)?.evidence[0]?.title, evidence.title);
  const requirementUpdated = await updateBidPackRequirement(userId, first.id, requirement.id, "met");
  assert.equal(requirementUpdated.requirements.find((item) => item.id === requirement.id)?.status, "met");

  const taskAdded = await createBidPackTask(userId, first.id, {
    title: "Vier-Augen-Prüfung einplanen",
    assignee: "Geschäftsführung",
  });
  const addedTask = taskAdded.tasks.find((task) => task.title === "Vier-Augen-Prüfung einplanen");
  assert.ok(addedTask);
  const taskUpdated = await updateBidPackTask(userId, first.id, addedTask.id, { status: "done" });
  assert.equal(taskUpdated.tasks.find((task) => task.id === addedTask.id)?.status, "done");

  await assert.rejects(
    () => getBidPackForUser(otherUserId, first.id),
    (error: unknown) => error instanceof BidPackError && error.status === 404,
  );

  const packRows = await db.select({ id: bidPacks.id }).from(bidPacks).where(eq(bidPacks.id, first.id));
  assert.equal(packRows.length, 1);
  console.log("Bid Pack: creation, snapshot, idempotency, membership isolation, decision, requirements and tasks OK");
};

const cleanup = async () => {
  if (trackedTenderId !== null) {
    await db.delete(trackedTenders).where(eq(trackedTenders.id, trackedTenderId));
  }
  if (tenderId !== null) {
    await db.delete(structuredData).where(eq(structuredData.tenderId, tenderId));
    await db.delete(scores).where(eq(scores.tenderId, tenderId));
    await db.delete(insights).where(eq(insights.tenderId, tenderId));
    await db.delete(tenders).where(eq(tenders.id, tenderId));
  }
  if (companyId !== null) {
    if (evidenceId !== null) {
      await deleteCompanyEvidence(userId, companyId, evidenceId).catch(() => undefined);
    }
    await db.delete(userCompanies).where(eq(userCompanies.companyId, companyId));
    await db.delete(companyProfiles).where(eq(companyProfiles.id, companyId));
  }
  await db.delete(user).where(and(eq(user.id, userId), eq(user.email, email)));
  await db.delete(user).where(and(eq(user.id, otherUserId), eq(user.email, otherEmail)));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => cleanup().catch((error) => {
    console.error("Bid Pack test cleanup failed:", error);
    process.exitCode = 1;
  }));
