import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

type ComposeService = {
  ports?: unknown[];
  environment?: Record<string, string>;
  depends_on?: Record<string, { condition?: string }>;
};

type ComposeConfig = {
  services: Record<string, ComposeService>;
};

const config = JSON.parse(
  execFileSync("docker", ["compose", "config", "--format", "json"], { encoding: "utf8" }),
) as ComposeConfig;

assert.equal(
  config.services.postgres.ports?.length ?? 0,
  0,
  "PostgreSQL should stay on the internal Compose network instead of binding a fixed host port",
);

for (const serviceName of ["app", "worker"]) {
  const service = config.services[serviceName];
  assert.equal(
    service.environment?.DATABASE_URL,
    "postgresql://tenderhunter:tenderhunter@postgres:5432/tenderhunter",
    `${serviceName} should connect to PostgreSQL through the internal service name`,
  );
  assert.equal(
    service.depends_on?.postgres?.condition,
    "service_healthy",
    `${serviceName} should wait for PostgreSQL readiness`,
  );
}

console.log("Compose database networking regression tests passed.");
