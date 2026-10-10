---
name: tenderhunter
description: Read-only access to current qualified German tenders through Tenderhunter.
---

# Tenderhunter

Use Tenderhunter only for read-only tender discovery. Never claim that the
service can create, modify, delete, or track a tender through this skill.

## Preferred connection

If the client supports remote MCP, connect to:

```text
https://DEINE-DOMAIN/api/mcp
```

Use the `search_tenders` tool. It supports free-text search, German state,
city, deadline filters, sorting, pagination, and a maximum page size of 30.

## Local CLI fallback

From the Tenderhunter project root, use:

```bash
TENDERHUNTER_API_URL=https://DEINE-DOMAIN/api/mcp/search \
  npm run tenderhunter -- search --query "Suchbegriff" --limit 10
```

Add `TENDERHUNTER_MCP_API_KEY` to the command environment when the server has
`MCP_API_KEY` enabled. Do not put the token into prompts, source files, or
committed configuration.

## Quota

The MCP and CLI search facade share one server-side quota: at most 50 tender
records are delivered per UTC calendar day. Always report the `quota.remaining`
value when it is relevant. An exhausted quota is not a search failure and must
not be worked around by calling another Tenderhunter endpoint.
