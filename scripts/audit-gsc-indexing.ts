import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const exportRoot = resolve(process.cwd(), "google-indexing");
const requiredFiles = [
  "Chart.csv",
  "Critical issues.csv",
  "Metadata.csv",
  "Non-critical issues.csv",
] as const;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function readCsv(filePath: string): Record<string, string>[] {
  const lines = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    throw new Error(`empty export: ${filePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function findNewestExport(): string {
  if (!statSync(exportRoot, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`refresh required for: ${requiredFiles.join(", ")}`);
  }

  const directories = readdirSync(exportRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(exportRoot, entry.name))
    .filter((directory) => /\d{4}-\d{2}-\d{2}/.test(directory.split("/").pop() ?? ""))
    .sort((left, right) => {
      const leftDate = left.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
      const rightDate = right.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
      return rightDate.localeCompare(leftDate) || statSync(right).mtimeMs - statSync(left).mtimeMs;
    });

  if (directories.length === 0) {
    throw new Error(`refresh required for: ${requiredFiles.join(", ")}`);
  }
  return directories[0];
}

function findPreviousAudit(): string | undefined {
  return readdirSync(exportRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^audit-\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
    .map((entry) => join(exportRoot, entry.name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

function readPreviousCounts(filePath: string | undefined): Map<string, number> {
  if (!filePath) return new Map();

  const counts = new Map<string, number>();
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 4 || !cells[1] || !/^\d[\d.]*$/.test(cells[2])) continue;
    counts.set(cells[1], Number(cells[2].replace(/\./g, "")));
  }
  return counts;
}

const exportPath = findNewestExport();
const missingFiles = requiredFiles.filter((file) => {
  const filePath = join(exportPath, file);
  return !statSync(filePath, { throwIfNoEntry: false }) || statSync(filePath).size === 0;
});

if (missingFiles.length > 0) {
  throw new Error(`refresh required for: ${missingFiles.join(", ")}`);
}

const criticalRows = readCsv(join(exportPath, "Critical issues.csv"));
const chartRows = readCsv(join(exportPath, "Chart.csv"));
const metadataRows = readCsv(join(exportPath, "Metadata.csv"));
const nonCriticalRows = readCsv(join(exportPath, "Non-critical issues.csv"));
const notIndexed = chartRows.at(-1)?.["Not indexed"];
const reasonTotal = criticalRows.reduce((sum, row) => sum + Number(row.Pages), 0);
const chartNotIndexed = Number(notIndexed);
const previousAudit = findPreviousAudit();
const previousCounts = readPreviousCounts(previousAudit);
const exportDate = exportPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
const previousAuditDate = previousAudit?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
const refreshRequired = Boolean(exportDate && previousAuditDate && exportDate < previousAuditDate);

if (refreshRequired) {
  process.stderr.write(
    `GSC export is stale compared with the latest local audit: export ${exportDate} < audit ${previousAuditDate}.\n`,
  );
}

if (!Number.isFinite(chartNotIndexed) || reasonTotal !== chartNotIndexed) {
  throw new Error(`reason total ${reasonTotal} does not match Chart.csv Not indexed ${notIndexed ?? "missing"}`);
}
if (metadataRows.length === 0) {
  throw new Error("refresh required for: Metadata.csv (missing metadata row)");
}

const reasonMetrics = criticalRows.map((row) => {
  const pages = Number(row.Pages);
  const previous = previousCounts.get(row.Reason);
  const delta = previous === undefined ? null : pages - previous;
  return {
    reason: row.Reason,
    source: row.Source,
    validation: row.Validation,
    pages,
    delta,
    deltaPercent: previous === undefined || previous === 0 || delta === null ? null : (delta / previous) * 100,
  };
});

const chartWithNumbers = chartRows.map((row) => ({
  date: row.Date,
  notIndexed: Number(row["Not indexed"]),
  indexed: Number(row.Indexed),
})).filter((row) => Number.isFinite(row.notIndexed) && Number.isFinite(row.indexed));
const trendBreaks = chartWithNumbers.slice(1).flatMap((row, index) => {
  const previous = chartWithNumbers[index];
  const notIndexedDelta = row.notIndexed - previous.notIndexed;
  const indexedDelta = row.indexed - previous.indexed;
  const knownUrlsDelta = notIndexedDelta + indexedDelta;
  return Math.max(Math.abs(notIndexedDelta), Math.abs(indexedDelta), Math.abs(knownUrlsDelta)) >= 30
    ? [{ from: previous.date, to: row.date, notIndexedDelta, indexedDelta, knownUrlsDelta }]
    : [];
});

console.log(JSON.stringify({
  export: exportPath,
  files: requiredFiles,
  previousAudit,
  refreshRequired,
  refreshReason: refreshRequired
    ? `No newer complete four-file export is present under ${exportRoot}`
    : null,
  metadata: metadataRows,
  nonCriticalFindings: nonCriticalRows.length,
  reasonTotal,
  chartLastRow: chartRows.at(-1),
  reasons: reasonMetrics,
  trendBreaks,
}, null, 2));
