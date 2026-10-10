import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { Client } from "minio";
import { settings } from "@/lib/config";

const COLD_SEGMENTS = new Set(["tenders", "us-tenders"]);
const LOCK_WAIT_MS = 5 * 60_000;
const LOCK_POLL_MS = 500;
const TARBALL_TIMEOUT_MS = 10 * 60_000;

export class ColdStorageError extends Error {}

interface ColdSidecar {
  segment: string;
  id: string;
  sha256: string;
  fileCount: number;
}

const endpointUrl = (): URL =>
  new URL(process.env.COLD_S3_ENDPOINT ?? "http://host.docker.internal:9000");

let cachedClient: Client | null = null;

const coldClient = (): Client => {
  if (!cachedClient) {
    const url = endpointUrl();
    const accessKey = process.env.COLD_S3_ACCESS_KEY;
    const secretKey = process.env.COLD_S3_SECRET_KEY;
    if (!accessKey || !secretKey) {
      throw new ColdStorageError("Cold-Storage-Konfiguration fehlt (COLD_S3_ACCESS_KEY/COLD_S3_SECRET_KEY)");
    }
    cachedClient = new Client({
      endPoint: url.hostname,
      port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
      useSSL: url.protocol === "https:",
      accessKey,
      secretKey,
    });
  }
  return cachedClient;
};

const coldBucket = (): string => process.env.COLD_S3_BUCKET ?? "tender-cold";

const hydrationEnabled = (): boolean => process.env.COLD_HYDRATION_ENABLED !== "0";

/** Mirror of the download-route guard: only relative paths inside the object store. */
const safeAbsoluteFromStored = (storagePath: string): string | null => {
  if (!storagePath || storagePath.includes("\0") || storagePath.includes("\\") || path.isAbsolute(storagePath)) {
    return null;
  }
  const segments = storagePath.split("/");
  if (segments.some((segment) => segment === "..")) return null;
  if (segments.length < 2) return null;
  return path.join(settings.objectStorePath, ...segments);
};

const parseColdKey = (
  storagePath: string,
): { segment: string; id: string; absolute: string } | null => {
  const absolute = safeAbsoluteFromStored(storagePath);
  if (!absolute) return null;
  const [segment, id] = storagePath.split("/");
  if (!COLD_SEGMENTS.has(segment)) return null;
  if (!/^[\w .-]{1,64}$/.test(id) || id === "." || id === "..") return null;
  return { segment, id, absolute };
};

const archiveKey = (segment: string, id: string): string => `${segment}/${id}.tar.zst`;

const sidecarKey = (segment: string, id: string): string => `${segment}/${id}.sha256.json`;

const runTar = async (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4_000) stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ColdStorageError(`tar timeout: ${(stderr || "").trim().slice(-300)}`));
    }, TARBALL_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new ColdStorageError(`tar fehlgeschlagen: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new ColdStorageError(`tar beendete mit Code ${code}: ${(stderr || "").trim().slice(-300)}`));
    });
  });

const listTarMembers = async (tarFile: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const child = spawn("tar", ["--zstd", "-tf", tarFile], { stdio: ["ignore", "pipe", "pipe"] });
    const members: string[] = [];
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split("\n")) {
        if (line) members.push(line);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4_000) stderr += chunk.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new ColdStorageError(`tar -tf timeout: ${(stderr || "").trim().slice(-300)}`));
    }, TARBALL_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new ColdStorageError(`tar -tf fehlgeschlagen: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(members);
      else reject(new ColdStorageError(`tar -tf Code ${code}: ${(stderr || "").trim().slice(-300)}`));
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

const downloadSidecar = async (segment: string, id: string): Promise<ColdSidecar | null> => {
  const temporary = path.join(fs.mkdtempSync(path.join("/tmp", "cold-sidecar-")), "sidecar.json");
  try {
    await coldClient().fGetObject(coldBucket(), sidecarKey(segment, id), temporary);
    const parsed = JSON.parse(fs.readFileSync(temporary, "utf8")) as ColdSidecar;
    if (!parsed?.sha256 || !Number.isInteger(parsed.fileCount)) return null;
    return parsed;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "NoSuchKey") return null;
    throw error;
  } finally {
    fs.rmSync(path.dirname(temporary), { force: true, recursive: true });
  }
};

const validateMembers = (members: string[], id: string, expected: ColdSidecar): void => {
  const files = members.filter((member) => member !== `${id}/` && member !== `./${id}/`);
  for (const member of members) {
    const normalized = member.startsWith("./") ? member.slice(2) : member;
    if (normalized === "" || normalized === "/") continue;
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new ColdStorageError(`unsichere Pfadangabe im Archiv: ${normalized}`);
    }
    if (!normalized.startsWith(`${id}/`)) {
      throw new ColdStorageError(`Archiv-Member außerhalb des Tender-Ordners: ${normalized}`);
    }
  }
  if (files.length !== expected.fileCount) {
    throw new ColdStorageError(`Archiv-Member-Anzahl ${files.length} ≠ ${expected.fileCount}`);
  }
};

const acquireLock = (lockDir: string): boolean => {
  try {
    fs.mkdirSync(path.dirname(lockDir), { recursive: true });
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, ".lock"), String(process.pid));
    return true;
  } catch {
    return false;
  }
};

const releaseLock = (lockDir: string): void => {
  fs.rmSync(lockDir, { force: true, recursive: true });
};

const waitOrTimeoutLock = async (lockDir: string): Promise<void> => {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    if (acquireLock(lockDir)) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  throw new ColdStorageError("Hydration abgebrochen: Lock-Timeout");
};

/**
 * Stellt einen relativen Pfad aus dem Cold-Storage (MinIO) wieder her, wenn die
 * Datei lokal nicht existiert. Gibt sonst den absoluten Pfad unverändert zurück.
 */
export const ensureLocalStored = async (storagePath: string): Promise<string> => {
  const fallback = path.join(settings.objectStorePath, storagePath);
  const cold = parseColdKey(storagePath);
  if (!cold || !hydrationEnabled()) return fallback;

  const { segment, id, absolute } = cold;
  if (fs.existsSync(absolute)) return absolute;

  const lockDir = path.join(settings.objectStorePath, ".cold-hydrating", `${segment}-${id}`);
  const temporaryDir = fs.mkdtempSync(path.join("/tmp", "cold-hydrate-"));
  const archiveFile = path.join(temporaryDir, `${id}.tar.zst`);
  try {
    await waitOrTimeoutLock(lockDir);
    try {
      if (fs.existsSync(absolute)) return absolute;
      await coldClient().fGetObject(coldBucket(), archiveKey(segment, id), archiveFile);
      const sidecar = await downloadSidecar(segment, id);
      if (sidecar) {
        const actual = await fileSha256(archiveFile);
        if (actual !== sidecar.sha256) {
          throw new ColdStorageError(`SHA256 des Archivs stimmt nicht überein (${segment}/${id})`);
        }
        const members = await listTarMembers(archiveFile);
        validateMembers(members, id, sidecar);
      }
      // Archive members are relative to the segment folder (e.g. tenders/),
      // so extraction targets objectStorePath/<segment>.
      const segmentDir = path.join(settings.objectStorePath, segment);
      fs.mkdirSync(segmentDir, { recursive: true });
      await runTar(["--zstd", "-xf", archiveFile, "-C", segmentDir, "--no-same-owner", "--no-same-permissions"]);
      // Directory lookups in the huge tenders/ folder can lag briefly behind
      // the tar exit code; retry the existence check a few times.
      let hydrated = fs.existsSync(absolute);
      for (let attempt = 0; !hydrated && attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        hydrated = fs.existsSync(absolute);
      }
      if (!hydrated) {
        throw new ColdStorageError(`Hydration abgeschlossen, Datei fehlt weiterhin: ${storagePath}`);
      }
      return absolute;
    } finally {
      releaseLock(lockDir);
    }
  } finally {
    fs.rmSync(temporaryDir, { force: true, recursive: true });
  }
};
