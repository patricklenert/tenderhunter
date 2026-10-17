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

Use `search_tenders` for discovery. It supports free-text search, German state,
city, deadline filters, sorting, pagination, and a maximum page size of 30. It
searches only qualified tenders currently in Tenderhunter's index. Known
deadlines have not passed, but entries with unknown deadlines may be included;
it is not a complete crawl of all German procurement portals. For an empty
result, report the exact filters and do not infer that no suitable tender exists.

Use `match_tenders` to check formal mandatory eligibility requirements against
available tender documents. It accepts a main bidder profile and an optional,
named partner profile, plus `query` and up to seven focused `searchQueries` for
different service terms. For a partner, specify only planned roles:
`subcontractor`, `capacity_provider` (Eignungsleihe), or `consortium_member`.
Do not treat an ordinary subcontractor as a capacity provider unless that route
is explicitly planned and permitted. Unknown supplier facts must be omitted, not guessed.
Its `no_barrier_found` verdict is not a technical-fit, profitability, legal
subcontracting, or award recommendation. Review original tender documents and
the Dossier before recommending a bid. A category must be one of Tenderhunter's
allowed values; for software/IT use `IT-Dienstleistungen` and put terms such as
"KI" in a free-text query, not in `category`.

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
