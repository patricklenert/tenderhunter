import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { Client } from "minio";
import { settings } from "../lib/config";

interface ColdSidecar {
  segment: string;
  id: string;
  sha256: string;
  fileCount: number;
  packMs: number;
  createdAt: string;
}

interface FolderStats {
  count: number;
  bytes: number;
  symlinks: number;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
};
const hasFlag = (name: string): boolean => args.includes(name);

const dryRun = hasFlag("--dry-run");
const limit = Number(flag("--limit") ?? "0");
const minAgeDays = Number(flag("--min-age-days") ?? "30");
const segmentFilter = flag("--segment");
const onlyCold = hasFlag("--only-cold");

const STAGING_DIRNAME = ".cold-staging";
const TEMP_DIR = path.join("/tmp", "cold-migrate");

const log = (message: string): void => {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
};

const endpointUrl = new URL(process.env.COLD_S3_ENDPOINT ?? "http://127.0.0.1:9000");
const bucket = process.env.COLD_S3_BUCKET ?? "tender-cold";

const client = new Client({
  endPoint: endpointUrl.hostname,
  port: Number(endpointUrl.port) || (endpointUrl.protocol === "https:" ? 443 : 80),
  useSSL: endpointUrl.protocol === "https:",
  accessKey: process.env.COLD_S3_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "minioadmin",
  secretKey: process.env.COLD_S3_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "minioadmin",
});

const packArchive = (tarFile: string, parentDir: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const tar = spawn("tar", ["-C", parentDir, "-cf", "-", id], { stdio: ["ignore", "pipe", "pipe"] });
    const zstd = spawn("zstd", ["-9", "-q", "-", "-o", tarFile], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      tar.kill("SIGKILL");
      zstd.kill("SIGKILL");
      reject(new Error("pack timeout"));
    }, 30 * 60_000);
    tar.stdout?.pipe(zstd.stdin);
    const collector = (chunk: Buffer): void => {
      if (stderr.length < 2_000) stderr += chunk.toString("utf8");
    };
    tar.stderr?.on("data", collector);
    zstd.stderr?.on("data", collector);
    tar.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    zstd.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    tar.on("close", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        zstd.kill("SIGKILL");
        reject(new Error(`tar Code ${code}: ${stderr.trim().slice(-300)}`));
      }
    });
    zstd.on("close", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`zstd Code ${code}: ${stderr.trim().slice(-300)}`));
        return;
      }
      clearTimeout(timer);
      resolve();
    });
  });

const listMembers = (tarFile: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const child = spawn("tar", ["--zstd", "-tf", tarFile], { stdio: ["ignore", "pipe", "pipe"] });
    const members: string[] = [];
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("tar -tf timeout"));
    }, 30 * 60_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split("\n")) {
        if (line) members.push(line);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 2_000) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(members);
      else reject(new Error(`tar -tf Code ${code}: ${stderr.trim().slice(-300)}`));
    });
  });

const fileSha256 = (file: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const walkFolder = (directory: string): FolderStats => {
  let count = 0;
  let bytes = 0;
  let symlinks = 0;
  const stack: string[] = [directory];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        symlinks += 1;
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        count += 1;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { count, bytes, symlinks };
};

const prettyBytes = (bytes: number): string => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;

const validateMembers = (members: string[], id: string, expectedFileCount: number): void => {
  for (const member of members) {
    const normalized = member.startsWith("./") ? member.slice(2) : member;
    if (normalized === "" || normalized === "/") continue;
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error(`unsicheres Archiv-Member: ${normalized}`);
    }
    if (!normalized.startsWith(`${id}/`)) {
      throw new Error(`fremdes Archiv-Member: ${normalized}`);
    }
  }
  const files = members.filter((member) => {
    const normalized = member.startsWith("./") ? member.slice(2) : member;
    return normalized !== "" && !normalized.endsWith("/");
  });
  if (files.length !== expectedFileCount) {
    throw new Error(`Archiv-Member-Anzahl ${files.length} ≠ ${expectedFileCount}`);
  }
};

const main = async (): Promise<void> => {
  if (!fs.existsSync(settings.objectStorePath)) {
    throw new Error(
      `OBJECT_STORE_PATH unwirksam (${settings.objectStorePath}). Auf dem Host setzen: OBJECT_STORE_PATH=/var/lib/docker/volumes/tenderhunter_app_data/_data/object_store`,
    );
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  for (const bucketProbe of [bucket]) {
    try {
      const exists = await client.bucketExists(bucketProbe);
      if (!exists) await client.makeBucket(bucketProbe);
    } catch (error) {
      log(`bucket-Setup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const segments = segmentFilter ? [segmentFilter] : ["tenders", "us-tenders"];
  const cutoffMs = Date.now() - minAgeDays * 86_400_000;

  type Candidate = { segment: string; id: string; dir: string; bytes: number };
  const candidates: Candidate[] = [];
  let warmBytes = 0;
  let coldBytesEstimated = 0;

  for (const segment of segments) {
    const segmentDir = path.join(settings.objectStorePath, segment);
    if (!fs.existsSync(segmentDir)) continue;
    for (const id of fs.readdirSync(segmentDir)) {
      if (id === STAGING_DIRNAME || id.startsWith(".")) continue;
      const dir = path.join(segmentDir, id);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      const folder = walkFolder(dir);
      if (folder.symlinks > 0) {
        log(`skip ${segment}/${id}: symbolische Links`);
        warmBytes += folder.bytes;
        continue;
      }
      if (stat.mtimeMs >= cutoffMs) {
        warmBytes += folder.bytes;
        continue;
      }
      coldBytesEstimated += folder.bytes;
      candidates.push({ segment, id, dir, bytes: folder.bytes });
    }
  }

  let limited = limit > 0 ? Math.min(limit, candidates.length) : candidates.length;
  if (onlyCold) {
    const reArchiveable: Candidate[] = [];
    for (const candidate of candidates) {
      try {
        await client.statObject(bucket, `${candidate.segment}/${candidate.id}.tar.zst`);
        reArchiveable.push(candidate);
      } catch {
        // Noch nie kalt gespeichert — Bewahrungsziel der Migrations-Task, hier überspringen.
      }
    }
    coldBytesEstimated = reArchiveable.reduce((sum, candidate) => sum + candidate.bytes, 0);
    candidates.length = 0;
    candidates.push(...reArchiveable);
    limited = limit > 0 ? Math.min(limit, candidates.length) : candidates.length;
  }
  log(
    `Kandidaten: ${limited}${limit > 0 ? `/${candidates.length}` : ""}, Bytes zu verlagern: ${prettyBytes(coldBytesEstimated)}, warm/Skip: ${prettyBytes(warmBytes)}${dryRun ? " [dry-run]" : ""}`,
  );
  if (dryRun) return;

  let migrated = 0;
  let failures = 0;
  let freedBytes = 0;
  const startedAt = Date.now();

  for (const candidate of candidates.slice(0, limit > 0 ? limit : candidates.length)) {
    const { segment, id, dir } = candidate;
    const base = `${segment}-${id}`;
    const tarFile = path.join(TEMP_DIR, `${base}.tar.zst`);
    const sidecarFile = path.join(TEMP_DIR, `${base}.sha256.json`);
    const verifyFile = path.join(TEMP_DIR, `${base}.verify.tar.zst`);
    try {
      const packStarted = Date.now();
      await packArchive(tarFile, path.dirname(dir), id);
      const sha = await fileSha256(tarFile);
      const folder = walkFolder(dir);
      const sidecar: ColdSidecar = {
        segment,
        id,
        sha256: sha,
        fileCount: folder.count,
        packMs: Date.now() - packStarted,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(sidecarFile, JSON.stringify(sidecar));

      await client.fPutObject(bucket, `${segment}/${id}.tar.zst`, tarFile, { "Content-Type": "application/zstd" });
      await client.fPutObject(bucket, `${segment}/${id}.sha256.json`, sidecarFile, { "Content-Type": "application/json" });

      await client.fGetObject(bucket, `${segment}/${id}.tar.zst`, verifyFile);
      if ((await fileSha256(verifyFile)) !== sha) throw new Error("verify-sha-mismatch");
      const members = await listMembers(verifyFile);
      validateMembers(members, id, sidecar.fileCount);
      fs.rmSync(verifyFile, { force: true });

      const staging = path.join(settings.objectStorePath, STAGING_DIRNAME, segment);
      fs.mkdirSync(staging, { recursive: true });
      const staged = path.join(staging, id);
      fs.renameSync(dir, staged);
      fs.rmSync(staged, { recursive: true, force: true });

      freedBytes += folder.bytes;
      migrated += 1;
      fs.rmSync(tarFile, { force: true });
      fs.rmSync(sidecarFile, { force: true });
      if (migrated % 25 === 0) {
        const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
        log(`+${migrated}/${candidates.length} verlagert, freigegeben ${prettyBytes(freedBytes)}, ${minutes} min`);
      }
    } catch (error) {
      failures += 1;
      log(`FEHLER ${segment}/${id}: ${error instanceof Error ? error.message : String(error)}`);
      fs.rmSync(verifyFile, { force: true });
      fs.rmSync(tarFile, { force: true });
      fs.rmSync(sidecarFile, { force: true });
      if (failures >= 25) {
        log("Zu viele Fehler — Abbruch.");
        break;
      }
    }
  }

  log(`Fertig. Verlagert: ${migrated}, Fehler: ${failures}, freigegeben: ${prettyBytes(freedBytes)}`);
};

main().catch((error) => {
  log(`fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
