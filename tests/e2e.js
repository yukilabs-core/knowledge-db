#!/usr/bin/env node
/**
 * E2E: search accuracy + load test for knowledge-db API
 * Usage: BASE_URL=https://... node tests/e2e.js
 */

const BASE_URL =
  process.env.BASE_URL || "https://knowledge-db-api.onrender.com";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10");
const SCORE_THRESHOLD = parseFloat(process.env.SCORE_THRESHOLD || "0.0");
const PASS_RATE_TARGET = parseFloat(process.env.PASS_RATE_TARGET || "0.9");

const SEARCH_QUERIES = [
  { query: "machine learning", expectResults: true },
  { query: "neural network", expectResults: true },
  { query: "deep learning", expectResults: true },
  { query: "natural language processing", expectResults: true },
  { query: "transformer attention", expectResults: true },
  { query: "reinforcement learning", expectResults: true },
  { query: "computer vision", expectResults: true },
  { query: "graph neural network", expectResults: true },
  { query: "large language model", expectResults: true },
  { query: "diffusion model", expectResults: true },
  { query: "federated learning", expectResults: true },
  { query: "knowledge distillation", expectResults: true },
  { query: "xyz_nonexistent_query_12345", expectResults: false },
  { query: "quantum computing blockchain nft", expectResults: false },
];

let passed = 0;
let failed = 0;
const failures = [];

async function searchPost(query) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 5 }),
  });
  const ms = Date.now() - start;
  const json = await res.json();
  return { status: res.status, ms, ...json };
}

async function runAccuracyTests() {
  console.log("\n=== 検索精度テスト ===");
  const results = [];

  for (const { query, expectResults } of SEARCH_QUERIES) {
    try {
      const r = await searchPost(query);
      const hasResults = r.data?.total_count > 0;
      const topScore = r.data?.results?.[0]?.relevance_score ?? 0;
      const ok =
        r.status === 200 &&
        r.success &&
        hasResults === expectResults &&
        (!expectResults || topScore >= SCORE_THRESHOLD);

      const mark = ok ? "✅" : "❌";
      console.log(
        `${mark} "${query}" → count=${r.data?.total_count ?? "?"} score=${topScore.toFixed(3)} ${r.ms}ms`,
      );

      if (ok) passed++;
      else {
        failed++;
        failures.push({
          query,
          expected: expectResults,
          got: hasResults,
          score: topScore,
        });
      }
      results.push({
        query,
        count: r.data?.total_count,
        topScore,
        ms: r.ms,
        ok,
      });
    } catch (e) {
      console.log(`❌ "${query}" → ERROR: ${e.message}`);
      failed++;
      failures.push({ query, error: e.message });
    }
  }

  const passRate = passed / (passed + failed);
  console.log(
    `\n合格率: ${passed}/${passed + failed} = ${(passRate * 100).toFixed(1)}%`,
  );
  return { passRate, results };
}

async function runLoadTest() {
  console.log(`\n=== 負荷テスト (並列${CONCURRENCY}リクエスト) ===`);
  const queries = [
    "machine learning",
    "deep learning",
    "neural network",
    "computer vision",
    "natural language processing",
    "reinforcement learning",
    "transformer model",
    "graph network",
    "federated learning",
    "diffusion model",
  ];

  const jobs = Array.from({ length: CONCURRENCY }, (_, i) =>
    searchPost(queries[i % queries.length]),
  );

  const start = Date.now();
  const results = await Promise.allSettled(jobs);
  const totalMs = Date.now() - start;

  let errors = 0;
  const times = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.success) {
      times.push(r.value.ms);
    } else {
      errors++;
    }
  }

  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b) / times.length)
    : 0;

  console.log(`並列${CONCURRENCY}リクエスト 完了: ${totalMs}ms`);
  console.log(`  成功: ${times.length}/${CONCURRENCY}  エラー: ${errors}`);
  console.log(`  レスポンス(ms) avg=${avg} p50=${p50} p95=${p95}`);

  return {
    concurrency: CONCURRENCY,
    totalMs,
    successCount: times.length,
    errors,
    avg,
    p50,
    p95,
  };
}

async function checkSleepRecovery() {
  console.log("\n=== スリープ復帰時間確認 ===");
  const start = Date.now();
  const r = await fetch(`${BASE_URL}/api/health`).catch((e) => ({
    ok: false,
    error: e.message,
  }));
  const ms = Date.now() - start;
  const status = r.ok ? "awake" : "sleep-recovered";
  console.log(`ヘルスチェック: ${ms}ms (${status})`);
  if (ms > 10000) {
    console.log(
      "⚠️  スリープ復帰: Render 無料プランのコールドスタートが発生 (~30s)",
    );
    console.log(
      "   対策: 定期的なヘルスチェック ping または有料プランへの移行を検討",
    );
  }
  return { ms, status };
}

async function main() {
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(
    `SCORE_THRESHOLD: ${SCORE_THRESHOLD}, PASS_RATE_TARGET: ${PASS_RATE_TARGET * 100}%`,
  );

  const health = await checkSleepRecovery();
  const { passRate, results: accuracyResults } = await runAccuracyTests();
  const loadResult = await runLoadTest();

  const passRateOk = passRate >= PASS_RATE_TARGET;
  const loadOk = loadResult.errors === 0;

  console.log("\n=== 総合結果 ===");
  console.log(
    `検索精度テスト: ${passRateOk ? "✅ PASS" : "❌ FAIL"} (${(passRate * 100).toFixed(1)}% ≥ ${PASS_RATE_TARGET * 100}%)`,
  );
  console.log(
    `負荷テスト:     ${loadOk ? "✅ PASS" : "❌ FAIL"} (エラー${loadResult.errors}件)`,
  );

  if (failures.length) {
    console.log("\n失敗詳細:");
    for (const f of failures) console.log(" ", JSON.stringify(f));
  }

  // Write results doc
  const doc = generateResultsDoc({
    health,
    passRate,
    accuracyResults,
    loadResult,
    passRateOk,
    loadOk,
  });
  const fs = await import("fs");
  fs.writeFileSync("docs/load-test-results.md", doc);
  console.log("\n📄 docs/load-test-results.md に結果を保存しました");

  process.exit(passRateOk && loadOk ? 0 : 1);
}

function generateResultsDoc({
  health,
  passRate,
  accuracyResults,
  loadResult,
  passRateOk,
  loadOk,
}) {
  const now = new Date().toISOString();
  return `# E2E テスト結果

**実施日時**: ${now}
**対象 URL**: ${BASE_URL}

## ヘルスチェック（コールドスタート確認）

- 応答時間: ${health.ms}ms
- 状態: ${health.ms > 10000 ? "⚠️ コールドスタート発生（Render 無料プラン）" : "✅ 正常（ウォーム状態）"}
- 対策: 定期 ping（例: 14分毎に GET /api/health）でスリープを防止可能

## 検索精度テスト

| 結果 | 件数 |
|------|------|
| 合格 | ${accuracyResults.filter((r) => r.ok).length} |
| 不合格 | ${accuracyResults.filter((r) => !r.ok).length} |
| **合格率** | **${(passRate * 100).toFixed(1)}%** |
| 判定 | ${passRateOk ? "✅ PASS" : "❌ FAIL"} |

### クエリ別結果

| クエリ | 件数 | スコア | 応答(ms) | 結果 |
|--------|------|--------|----------|------|
${accuracyResults.map((r) => `| ${r.query} | ${r.count ?? "-"} | ${r.topScore?.toFixed(3) ?? "-"} | ${r.ms} | ${r.ok ? "✅" : "❌"} |`).join("\n")}

## 負荷テスト（${loadResult.concurrency}並列）

| 項目 | 値 |
|------|----|
| 並列数 | ${loadResult.concurrency} |
| 総処理時間 | ${loadResult.totalMs}ms |
| 成功 | ${loadResult.successCount}/${loadResult.concurrency} |
| エラー | ${loadResult.errors} |
| 平均応答 | ${loadResult.avg}ms |
| p50 | ${loadResult.p50}ms |
| p95 | ${loadResult.p95}ms |
| 判定 | ${loadOk ? "✅ PASS" : "❌ FAIL"} |

## 総合判定

${passRateOk && loadOk ? "✅ **全テスト PASS** — 本番稼働可能" : "❌ **テスト失敗** — 修正が必要"}
`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
