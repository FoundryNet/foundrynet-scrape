"use strict";
/**
 * FoundryNet Scrape — x402-gated web extraction gateway.
 *   POST /v1/extract        $0.01   one URL → text|markdown|json (Readability)
 *   POST /v1/extract/batch  $0.008  many URLs (volume)
 * Also exposes both as MCP tools at /mcp.
 */
const express = require("express");
const { z } = require("zod");
const { x402, paymentRequired, PAY_TO, USDC_MINT, CAIP2, PUBLIC_URL } = require("./lib/x402");
const { mountMcp } = require("./lib/mcp");
const handlers = require("./lib/handlers");

const SERVICE = "foundrynet-scrape";
const app = express();
app.use(express.json({ limit: "1mb" }));

const ROUTES = {
  extract: { price: 0.01, desc: "Extract a page's main content (text|markdown|json)" },
  "extract/batch": { price: 0.008, desc: "Batch-extract many pages (volume)" },
};
const TOOL_SPECS = [
  { name: "extract", price: 0.01, desc: ROUTES.extract.desc,
    schema: { url: z.string().describe("page URL"), format: z.string().optional().describe("text | markdown | json"), api_key: z.string().optional() },
    fn: handlers.extract },
  { name: "extract_batch", price: 0.008, desc: ROUTES["extract/batch"].desc,
    schema: { urls: z.array(z.string()).describe("page URLs (max 20)"), format: z.string().optional(), api_key: z.string().optional() },
    fn: handlers.extractBatch },
];
const KEYWORDS = ["web-scraping", "scrape", "extract", "readability", "html-to-markdown", "content-extraction", "crawler", "research", "data-extraction", "markdown"];

app.get("/health", (req, res) => res.json({ status: "ok", service: SERVICE, tiers: Object.keys(ROUTES) }));

function discoveryIndex() {
  return { x402Version: 2, name: "FoundryNet Scrape", description: "x402 web extraction gateway.",
    network: "FoundryNet Data Network", asset: USDC_MINT, chain: CAIP2, payTo: PAY_TO,
    resources: Object.entries(ROUTES).map(([r, m]) => ({ tool: r, url: `${PUBLIC_URL}/x402/${r}`,
      price_usdc: m.price, amount: String(Math.round(m.price * 1e6)), description: m.desc, method: "POST" })) };
}
app.get("/x402", (req, res) => res.set("Access-Control-Allow-Origin", "*").json(discoveryIndex()));
app.get("/.well-known/x402", (req, res) => res.set("Access-Control-Allow-Origin", "*").json(discoveryIndex()));
app.get(/^\/x402\/(extract\/batch|extract)$/, (req, res) => {
  const r = req.params[0];
  if (!ROUTES[r]) return res.status(404).json({ error: "unknown_resource", available: Object.keys(ROUTES) });
  res.set("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(paymentRequired(r, ROUTES[r].price, ROUTES[r].desc))).toString("base64"));
  res.set("WWW-Authenticate", 'x402 version="2"').set("Access-Control-Allow-Origin", "*");
  return res.status(402).json(paymentRequired(r, ROUTES[r].price, ROUTES[r].desc));
});

const mw = (name) => x402(name, ROUTES[name].price, ROUTES[name].desc);
app.post("/v1/extract", mw("extract"), async (req, res) => {
  try { res.json({ billing: req.billing, ...(await handlers.extract(req.body || {})) }); }
  catch (e) { res.status(e.code === "bad_request" ? 400 : 502).json({ error: "extract_error", detail: String(e.message || e).slice(0, 300) }); }
});
app.post("/v1/extract/batch", mw("extract/batch"), async (req, res) => {
  try { res.json({ billing: req.billing, ...(await handlers.extractBatch(req.body || {})) }); }
  catch (e) { res.status(e.code === "bad_request" ? 400 : 502).json({ error: "batch_error", detail: String(e.message || e).slice(0, 300) }); }
});

mountMcp(app, SERVICE, TOOL_SPECS);

const AGENT_CARD = { name: "FoundryNet Scrape", description: "x402 web extraction gateway (Readability + Turndown).",
  url: `${PUBLIC_URL}/mcp`, transport: ["streamable-http"], tools: TOOL_SPECS.map((t) => t.name),
  pricing: { model: "per-call", currency: "USDC", rates: { extract: 0.01, extract_batch: 0.008 } },
  keywords: KEYWORDS, network: { name: "FoundryNet Data Network", homepage: "https://foundrynet.io" },
  provider: { name: "FoundryNet", url: "https://foundrynet.io" } };
const card = (req, res) => res.set("Access-Control-Allow-Origin", "*").set("Cache-Control", "public, max-age=300").json(AGENT_CARD);
app.get("/.well-known/mcp.json", card);
app.get("/agent-card.json", card);

app.listen(process.env.PORT || 3000, () => console.log(`${SERVICE} listening`));
module.exports = app;
