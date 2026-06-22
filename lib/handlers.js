"use strict";
/** Web extraction — Readability (article) + Turndown (markdown) + Cheerio (fallback). No API key. */

const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const TurndownService = require("turndown");
const cheerio = require("cheerio");

const UA = "foundrynet-scrape/1.0 (+https://foundrynet.io)";
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

async function fetchHtml(url) {
  if (!/^https?:\/\//i.test(url)) throw Object.assign(new Error("url must be http(s)"), { code: "bad_request" });
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) throw Object.assign(new Error(`upstream ${r.status}`), { code: "upstream" });
    const ct = r.headers.get("content-type") || "";
    if (!/html|xml|text/.test(ct)) throw Object.assign(new Error(`unsupported content-type ${ct}`), { code: "bad_request" });
    return await r.text();
  } finally { clearTimeout(to); }
}

function extractFrom(html, url, format) {
  const dom = new JSDOM(html, { url });
  let article = null;
  try { article = new Readability(dom.window.document).parse(); } catch { /* fallback below */ }
  const fmt = (format || "text").toLowerCase();

  if (article && article.content) {
    if (fmt === "markdown") return { url, title: article.title, format: "markdown", content: turndown.turndown(article.content), excerpt: article.excerpt, byline: article.byline, length: article.length };
    if (fmt === "json") return { url, title: article.title, format: "json", byline: article.byline, excerpt: article.excerpt, text: article.textContent?.trim(), length: article.length, site: article.siteName };
    return { url, title: article.title, format: "text", content: (article.textContent || "").trim(), excerpt: article.excerpt, byline: article.byline, length: article.length };
  }
  // Fallback: cheerio strip boilerplate.
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,iframe").remove();
  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const bodyHtml = $("main").html() || $("article").html() || $("body").html() || "";
  if (fmt === "markdown") return { url, title, format: "markdown", content: turndown.turndown(bodyHtml).trim(), fallback: true };
  const text = $("body").text().replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  if (fmt === "json") return { url, title, format: "json", text, fallback: true };
  return { url, title, format: "text", content: text, fallback: true };
}

async function extract({ url, format }) {
  if (!url) throw Object.assign(new Error("url required"), { code: "bad_request" });
  const html = await fetchHtml(url);
  return extractFrom(html, url, format);
}

async function extractBatch({ urls, format }) {
  if (!Array.isArray(urls) || !urls.length) throw Object.assign(new Error("urls (string[]) required"), { code: "bad_request" });
  if (urls.length > 20) throw Object.assign(new Error("max 20 urls per batch"), { code: "bad_request" });
  const results = await Promise.all(urls.map(async (u) => {
    try { return await extract({ url: u, format }); }
    catch (e) { return { url: u, error: e.code || "error", detail: String(e.message || e).slice(0, 120) }; }
  }));
  return { count: results.length, ok: results.filter((r) => !r.error).length, results };
}

module.exports = { extract, extractBatch };
