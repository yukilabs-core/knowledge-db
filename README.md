# Knowledge DB — ナレッジデータベース API

分散した情報を収集・構造化し、自然言語で検索できるナレッジ基盤。arXiv 論文と dev.to 記事を自動収集し、PostgreSQL FTS で全文検索を提供する。

**本番 URL:** `https://knowledge-db-api.onrender.com`

## アーキテクチャ

```text
┌─────────────────┐     GET /api/search      ┌──────────────────────┐
│  knowledge-db-  │ ───────────────────────▶ │  knowledge-db API    │
│  web (Vercel)   │                           │  (Render / Node.js)  │
└─────────────────┘                           └──────────┬───────────┘
                                                         │ pg Pool
                                              ┌──────────▼───────────┐
┌─────────────────┐   GitHub Actions (daily)  │  Neon PostgreSQL     │
│  arXiv / dev.to │ ─────────────────────────▶│  (FTS5 + pgvector)   │
│  クローラー      │   INSERT ON CONFLICT       └──────────────────────┘
└─────────────────┘   DO NOTHING

                      Prometheus /metrics
┌─────────────────┐ ◀──────────────────────── knowledge-db API
│  MINIPC         │
│  Prometheus     │   Slack / Discord アラート（5xx / Down）
│  + Grafana      │ ──────────────────────────────────────▶ Discord
└─────────────────┘
```

## 技術スタック

| Layer | Technology |
| ----- | ---------- |
| API | Node.js (Express) on Render |
| Database | Neon (PostgreSQL 16) |
| Search | PostgreSQL Full Text Search |
| Observability | prom-client + pino |
| Crawler | arXiv REST API + dev.to API |
| Deployment | Render (API) + Vercel (Web) |

## クイックスタート（ローカル）

```bash
# 1. 依存インストール
npm install

# 2. 環境変数設定
cp .env.example .env
# .env に DATABASE_URL を設定（Neon の接続文字列）

# 3. DB スキーマ作成（初回のみ）
psql "$DATABASE_URL" -f scripts/schema.sql

# 4. 開発サーバー起動
npm run dev
```

動作確認:

```bash
curl http://localhost:3000/api/health
curl "http://localhost:3000/api/search?q=machine+learning&limit=5"
curl http://localhost:3000/metrics
```

## 環境変数

| 変数名 | 必須 | 説明 |
| ------ | ---- | ---- |
| `DATABASE_URL` | ✅ | Neon PostgreSQL 接続文字列 |
| `LOG_LEVEL` | — | ログレベル（デフォルト: info） |
| `DISCORD_WEBHOOK_INFRA` | — | 5xx エラー時の Discord 通知先 |

## API エンドポイント

| Method | Path | 説明 |
| ------ | ---- | ---- |
| `GET` | `/api/health` | DB 死活確認 |
| `GET` | `/api/search?q=<query>&limit=<n>` | 全文検索 |
| `GET` | `/metrics` | Prometheus メトリクス |

### GET /api/search

```bash
curl "https://knowledge-db-api.onrender.com/api/search?q=RAG&limit=5"
```

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "論文タイトル",
      "abstract": "要約...",
      "source_url": "https://arxiv.org/...",
      "published_at": "2024-01-15",
      "relevance_score": 0.87
    }
  ],
  "total_count": 5,
  "response_ms": 45
}
```

## クローラー

GitHub Actions で毎日 11:00 JST に自動実行。手動実行:

```bash
gh workflow run crawl.yml --repo yukilabs-core/knowledge-db
```

ローカル実行:

```bash
DATABASE_URL="..." node scripts/run-crawler.js --source arxiv --limit 50
DATABASE_URL="..." node scripts/run-crawler.js --source devto --limit 50
```

## ドキュメント

| ドキュメント | 内容 |
| ------------ | ---- |
| [docs/operations.md](docs/operations.md) | デプロイ手順・go-live チェックリスト・定期メンテ |
| [docs/sla-and-monitoring.md](docs/sla-and-monitoring.md) | SLA 目標値・監視メトリクス定義 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | 障害対応ガイド（8パターン） |
| [docs/recovery.md](docs/recovery.md) | データ復旧手順 |

## 実装フェーズ

- [x] Phase 1: セットアップ（DB スキーマ・Express 基盤）
- [x] Phase 2: Crawler（arXiv + dev.to）
- [x] Phase 3: Search API（PostgreSQL FTS）
- [x] Phase 4: Frontend（knowledge-db-web）
- [x] Phase 5: 観測性（prom-client + pino）
- [x] Phase 6: 信頼性（ON CONFLICT dedup + retry）
- [x] Phase 7: ドキュメント整備
