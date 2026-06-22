# FoundryNet Scrape

x402-gated **web extraction** gateway for AI agents. Fetch any page and get clean content back — text, markdown, or structured JSON. No API keys, no accounts.

Part of the [FoundryNet Data Network](https://foundrynet.io). Pay-per-call in USDC (x402) or bypass with an `fnet_` Forge key. Also exposed as an MCP server for Smithery/Glama/Claude.

## Tools / Endpoints

| Tool / Route | Price | Description |
|--------------|-------|-------------|
| `extract` — `POST /v1/extract` | $0.01 | `{url, format?: "text"\|"markdown"\|"json"}` → extracted main content |
| `extract_batch` — `POST /v1/extract/batch` | $0.008 | `{urls: string[]}` (max 20) → array of extracted content (volume discount) |

Backends: **Mozilla Readability** (article extraction) + **Turndown** (HTML→markdown) + **Cheerio** (fallback) — all free, no API key. Boilerplate (scripts, nav, ads) is stripped automatically.

## MCP

Streamable HTTP endpoint: `https://foundrynet-scrape-production.up.railway.app/mcp`

```
claude mcp add --transport http foundrynet-scrape https://foundrynet-scrape-production.up.railway.app/mcp
```

Tools list without auth (discoverable). Pass an `fnet_` key as `api_key` (or `Authorization: Bearer`) to bypass payment; otherwise the tool returns an x402 `payment_required` object.

## Payment (x402)

Standard x402 v2 on Solana mainnet USDC. Discovery: `GET /x402`, `GET /.well-known/x402`, per-route `402` at `GET /x402/{route}`. Validated on [402 Index](https://402index.io).

The highest-frequency tool category — every research, content, and data agent needs to read the web.
