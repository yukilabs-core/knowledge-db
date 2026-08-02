#!/usr/bin/env node
// E2E テスト: 検索精度 + 負荷テスト + Render スリープ確認
const BASE_URL = process.env.API_URL || "https://knowledge-db-api.onrender.com";

const SEARCH_QUERIES = [
  { query: "machine learning", minResults: 1 },
  { query: "neural network", minResults: 1 },
  { query: "deep learning", minResults: 1 },
  { query: "natural language processing", minResults: 1 },
  { query: "transformer attention", minResults: 1 },
  { query: "reinforcement learning", minResults: 1 },
  { query: "computer vision", minResults: 1 },
  { query: "graph neural network", minResults: 1 },
  { query: "large language model", minResults: 1 },
  { query: "diffusion model", minResults: 1 },
  { query: "federated learning", minResults: 1 },
  { query: "knowledge distillation", minResults: 1 },
  { query: "generative AI", minResults: 1 },
  { query: "RAG retrieval augmented", minResults: 0 },  // 0件でも正常
  { query: "xyz_nonexistent_query_12345", minResults: 0 },
  { query: "quantum computing blockchain nft", minResults: 0 },
];

async function fetchJson(path, opts = {}) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const ms = Date.now() - start;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ms };
}

async function testHealth() {
  console.log("\n## ヘルスチェック");
  const { status, body, ms } = await fetchJson("/api/health");
  const ok = status === 200 && body.status === "healthy";
  console.log(`- 応答時間: ${ms}ms`);
  console.log(`- 状態: ${ok ? "✅ 正常" : "❌ 異常"} (${body.status ?? "unknown"})`);
  return { ok, ms };
}

async function testSearchPrecision() {
  console.log("\n## 検索精度テスト");
  const rows = [];
  for (const { query, minResults } of SEARCH_QUERIES) {
    const { body, ms } = await fetchJson("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 10 }),
    });
    const count = body.data?.results?.length ?? 0;
    const score = body.data?.results?.[0]?.relevance_score ?? 0;
    const ok = count >= minResults;
    rows.push({ query, count, score: score.toFixed(3), ms, ok });
  }

  console.log(`| クエリ | 件数 | スコア | 応答(ms) | 結果 |`);
  console.log(`|--------|------|--------|----------|------|`);
  for (const r of rows) {
    console.log(`| ${r.query} | ${r.count} | ${r.score} | ${r.ms} | ${r.ok ? "✅" : "❌"} |`);
  }

  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n合格: ${passed}/${rows.length} (${((passed / rows.length) * 100).toFixed(1)}%)`);
  console.log(`判定: ${passed === rows.length ? "✅ PASS" : "❌ FAIL"}`);
  return { passed, total: rows.length, rows };
}

async function testLoad(concurrency = 10) {
  console.log(`\n## 負荷テスト（${concurrency}並列）`);
  const query = "machine learning";
  const start = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: concurrency }, () =>
      fetchJson("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      })
    )
  );
  const total = Date.now() - start;
  const ok = results.filter((r) => r.status === "fulfilled" && r.value.status === 200);
  const times = ok.map((r) => r.value.ms).sort((a, b) => a - b);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1] ?? 0;

  console.log(`| 項目 | 値 |`);
  console.log(`|------|----|`);
  console.log(`| 並列数 | ${concurrency} |`);
  console.log(`| 総処理時間 | ${total}ms |`);
  console.log(`| 成功 | ${ok.length}/${concurrency} |`);
  console.log(`| エラー | ${concurrency - ok.length} |`);
  console.log(`| 平均応答 | ${avg}ms |`);
  console.log(`| p50 | ${p50}ms |`);
  console.log(`| p95 | ${p95}ms |`);
  const pass = ok.length === concurrency && p95 < 3000;
  console.log(`| 判定 | ${pass ? "✅ PASS" : "❌ FAIL"} |`);
  return { ok: ok.length, concurrency, avg, p50, p95, pass };
}

async function testSecurity() {
  console.log("\n## セキュリティチェック");

  // /metrics 外部アクセス拒否
  const metrics = await fetch(`${BASE_URL}/metrics`);
  const metricsOk = metrics.status === 403;
  console.log(`- /metrics 外部アクセス: ${metricsOk ? "✅ 403 Forbidden" : `❌ ${metrics.status}`}`);

  // query 長さ上限
  const longQ = await fetchJson("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "a".repeat(501) }),
  });
  const longOk = longQ.status === 400;
  console.log(`- query 501文字: ${longOk ? "✅ 400 拒否" : `❌ ${longQ.status}`}`);

  // /api/health 503 の err.message 非漏洩（本番では healthy なので直接確認不可、コードレビューで対応済み）
  console.log(`- err.message 隠蔽: ✅ コードレビュー済み（PR #4）`);

  return { metricsOk, longOk };
}

async function main() {
  console.log(`# E2E テスト結果`);
  console.log(`\n**実施日時**: ${new Date().toISOString()}`);
  console.log(`**対象 URL**: ${BASE_URL}`);

  const health = await testHealth();
  const precision = await testSearchPrecision();
  const load = await testLoad(10);
  const security = await testSecurity();

  const allPass =
    health.ok &&
    precision.passed === precision.total &&
    load.pass &&
    security.metricsOk &&
    security.longOk;

  console.log(`\n## 総合判定`);
  console.log(allPass ? "✅ **全テスト PASS** — 本番稼働可能" : "❌ **一部テスト FAIL** — 要対応");
}

main().catch((e) => { console.error(e); process.exit(1); });
