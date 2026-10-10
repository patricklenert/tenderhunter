#!/usr/bin/env node

const usage = `Tenderhunter CLI

Usage:
  node cli/tenderhunter.mjs search [options]

Environment:
  TENDERHUNTER_API_URL       JSON endpoint (default: http://localhost:3000/api/mcp/search)
  TENDERHUNTER_MCP_API_KEY   Optional bearer token

Search options:
  --query, -q <text>         Search text
  --bundesland <name>        German state
  --city <name>              City
  --limit <number>           Number of results, 1-30
  --page <number>            Result page
  --sort <deadline|newest>   Sort order
  --deadline-filter <value>  all, minimum3, minimum7, minimum14, next7, next30, custom, missing
  --deadline-from <date>     YYYY-MM-DD for custom filter
  --deadline-to <date>       YYYY-MM-DD for custom filter
  --today-new                Only tenders found in the last three days
  --url <url>                Override TENDERHUNTER_API_URL
  --help                     Show this help
`;

function readOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--today-new") {
      options.todayNew = true;
      continue;
    }

    const [inlineName, inlineValue] = argument.split("=", 2);
    const name = inlineName.startsWith("--") ? inlineName : argument;
    const aliases = { "-q": "query" };
    const key = aliases[name] ?? name.replace(/^--/, "");
    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error(`Wert fehlt für ${name}`);
    }
    if (inlineValue === undefined) index += 1;
    options[key] = value;
  }
  return options;
}

function asInteger(value, name, minimum, maximum) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} muss zwischen ${minimum} und ${maximum} liegen.`);
  }
  return parsed;
}

async function search(options) {
  const endpoint = options.url ?? process.env.TENDERHUNTER_API_URL ?? "http://localhost:3000/api/mcp/search";
  const body = {
    query: options.query ?? "",
    limit: asInteger(options.limit, "limit", 1, 30) ?? 10,
    page: asInteger(options.page, "page", 1, 1_000) ?? 1,
    todayNew: Boolean(options.todayNew),
    ...(options.bundesland ? { bundesland: options.bundesland } : {}),
    ...(options.city ? { city: options.city } : {}),
    ...(options.sort ? { sort: options.sort } : {}),
    ...(options.deadlineFilter ? { deadlineFilter: options.deadlineFilter } : {}),
    ...(options.deadlineFrom ? { deadlineFrom: options.deadlineFrom } : {}),
    ...(options.deadlineTo ? { deadlineTo: options.deadlineTo } : {}),
  };

  const headers = { "content-type": "application/json" };
  const token = process.env.TENDERHUNTER_MCP_API_KEY;
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!response.ok) process.exitCode = 1;
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage);
    return;
  }
  if (command !== "search") throw new Error(`Unbekannter Befehl: ${command}`);

  const options = readOptions(args);
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  await search(options);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
  process.exitCode = 1;
});
