# Knowledge DB - 検索AI / ナレッジデータベース

分散した情報を収集・構造化し、自然言語で検索・参照できるナレッジ基盤。

## 技術スタック

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Vercel + Next.js | 無料、デプロイ簡単、100GB bandwidth |
| API | Cloud Run + Node.js | 無料、2M requests/月、自動スケール |
| Database | Neon (PostgreSQL + pgvector) | 無料 3GB + Full Text Search |
| Crawler | Puppeteer on Cloud Run | ブラウザ自動化、スクレイピング |
| Search | PostgreSQL Full Text Search | インデックス設計が見える |
| Deployment | GitHub + Vercel + Cloud Run | 完全無料、自動デプロイ |

## セットアップ

### 1. Neon データベース作成

1. [Neon.tech](https://neon.tech) でアカウント作成
2. Postgres 16+ を選択
3. DATABASE_URL を `.env` に設定

```bash
cp .env.example .env
# .env を編集して DATABASE_URL を設定
```

### 2. DB スキーマ作成

```bash
# psql で接続
psql $DATABASE_URL -f scripts/schema.sql
```

### 3. API サーバー実行

```bash
npm install
npm run dev
```

Health check: `curl http://localhost:3000/api/health`

## API 仕様

### POST /search

```json
{
  "query": "RAGの精度を上げる方法",
  "limit": 10
}
```

Response:
```json
{
  "query": "RAGの精度を上げる方法",
  "results": [
    {
      "id": "uuid-1",
      "title": "論文タイトル",
      "abstract": "要約...",
      "source_url": "https://...",
      "published_at": "2024-01-15",
      "relevance_score": 0.87
    }
  ],
  "total_count": 3,
  "response_ms": 45
}
```

### GET /documents

List all documents.

## 実装フェーズ

- [x] Phase 1: セットアップ
- [ ] Phase 2: Crawler
- [ ] Phase 3: Search API
- [ ] Phase 4: Frontend
- [ ] Phase 5: ドキュメント & 公開

## 費用

完全無料（毎月 $0）

- Neon: 無料 3GB
- Cloud Run: 無料 2M requests/月
- Vercel: 無料 100GB bandwidth
