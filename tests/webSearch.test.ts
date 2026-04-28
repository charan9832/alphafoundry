import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { webSearchTool } from "../src/tools/webSearch.js";

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("web search tool security and providers", () => {
  it("allows loopback HTTP only when explicitly allowed", async () => {
    const blocked = await webSearchTool({ endpoint: "http://127.0.0.1:8080/search" }).execute({ query: "ai agents" }, { workspace: "/tmp" });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error ?? "", /localhost|loopback|https/i);

    const allowed = await webSearchTool({
      provider: "searxng",
      endpoint: "http://127.0.0.1:8080/search",
      allowLocalEndpoints: true,
      fetchImpl: async () => jsonResponse({ provider: "searxng", results: [{ title: "A", url: "https://example.com", snippet: "B" }] }),
    }).execute({ query: "ai agents" }, { workspace: "/tmp" });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.data?.results.length, 1);
  });

  it("blocks private and link-local HTTP endpoints even when local endpoints are allowed", async () => {
    for (const endpoint of [
      "http://10.0.0.5/search",
      "http://192.168.1.1/search",
      "http://172.16.0.1/search",
      "http://169.254.169.254/latest/meta-data",
    ]) {
      const result = await webSearchTool({ endpoint, allowLocalEndpoints: true }).execute({ query: "ai" }, { workspace: "/tmp" });
      assert.equal(result.ok, false, endpoint);
      assert.match(result.error ?? "", /private|link-local|loopback|local/i);
    }
  });

  it("blocks private and link-local HTTPS IPv4/IPv6 endpoints", async () => {
    for (const endpoint of [
      "https://10.0.0.5/search",
      "https://192.168.1.1/search",
      "https://172.16.0.1/search",
      "https://169.254.169.254/latest/meta-data",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://[::]/search",
      "https://[::ffff:10.0.0.1]/search",
      "https://[::ffff:192.168.1.1]/search",
      "https://[fc00::1]/search",
      "https://[fd00::1]/search",
      "https://[fe80::1]/search",
    ]) {
      const result = await webSearchTool({ endpoint }).execute({ query: "ai" }, { workspace: "/tmp" });
      assert.equal(result.ok, false, endpoint);
      assert.match(result.error ?? "", /private|link-local/i);
    }
  });

  it("rejects endpoint URLs with embedded credentials", async () => {
    const result = await webSearchTool({ endpoint: "https://user:pass@example.com/search" }).execute({ query: "ai" }, { workspace: "/tmp" });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /credentials/i);
  });

  it("rejects secret-like queries before network calls", async () => {
    let calls = 0;
    const result = await webSearchTool({ endpoint: "https://example.com/search", fetchImpl: async () => { calls += 1; return jsonResponse({ results: [] }); } }).execute({ query: "api_key=sk-123456789abcdef" }, { workspace: "/tmp" });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
  });

  it("sanitizes result HTML/control characters and drops unsafe URLs", async () => {
    const result = await webSearchTool({
      endpoint: "https://example.com/search",
      fetchImpl: async () => jsonResponse({ results: [
        { title: "<b>Hello</b>\u0000", url: "javascript:alert(1)", snippet: "bad" },
        { title: "Creds", url: "https://user:pass@example.com/a", snippet: "bad" },
        { title: "Local", url: "http://127.0.0.1/a", snippet: "bad" },
        { title: "Private", url: "https://[::ffff:10.0.0.1]/a", snippet: "bad" },
        { title: "<b>Hello</b>\u0000", url: "https://example.com/a", snippet: "<script>x</script> useful\ntext" },
      ] }),
    }).execute({ query: "ai" }, { workspace: "/tmp" });
    assert.equal(result.ok, true);
    assert.equal(result.data?.results.length, 1);
    assert.equal(result.data?.results[0]?.title, "Hello");
    assert.equal(result.data?.results[0]?.snippet, "x useful text");
  });

  it("uses Firecrawl POST search and maps data responses", async () => {
    let method = "";
    let body = "";
    const result = await webSearchTool({
      provider: "firecrawl",
      endpoint: "http://127.0.0.1:3002/v1/search",
      allowLocalEndpoints: true,
      fetchImpl: async (_url, init) => {
        method = init?.method ?? "";
        body = String(init?.body ?? "");
        return jsonResponse({ data: [{ title: "Fire", url: "https://example.com/fire", description: "Crawl" }] });
      },
    }).execute({ query: "agent runtime", maxResults: 3 }, { workspace: "/tmp" });
    assert.equal(result.ok, true);
    assert.equal(method, "POST");
    assert.match(body, /agent runtime/);
    assert.equal(result.data?.provider, "firecrawl");
    assert.equal(result.data?.results[0]?.snippet, "Crawl");
  });
});
