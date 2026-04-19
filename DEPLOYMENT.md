# Knowledge DB - デプロイガイド

## 本番環境デプロイ Checklist

### Step 1: Neon データベース確認

- [x] Neon アカウント作成済み
- [x] PostgreSQL プロジェクト作成済み: `bitter-night-50585456`
- [x] DATABASE_URL 取得済み
- [x] スキーマ実行完了 (documents, crawl_jobs, search_logs)

### Step 2: API サーバー (Render)

**やること:**
1. GitHub にプッシュ確認
```bash
cd knowledge-db
git log --oneline -1  # 最新コミット確認
```

2. [Render Dashboard](https://dashboard.render.com/) を開く
3. 「New +」→「Web Service」を選択
4. GitHub リポジトリ接続：`yukilabs-core/knowledge-db`
5. 設定入力：
   - **Name:** knowledge-db-api
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     ```
     NODE_ENV=production
     DATABASE_URL=postgresql://neondb_owner:<PASSWORD>@ep-fancy-bread-amucak4i-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     PORT=10000
     ```
6. "Create Web Service" をクリック
7. デプロイ完了後、API URL が割り当たります (例: `https://knowledge-db-api.onrender.com`)

**確認:**
```bash
curl https://knowledge-db-api.onrender.com/api/health
# 応答: {"status":"healthy","timestamp":"...","database":"connected"}
```

### Step 3: フロントエンド (Vercel)

**やること:**
1. [Vercel Dashboard](https://vercel.com/dashboard) を開く
2. 「Add New」→「Project」
3. GitHub リポジトリ選択：`yukilabs-core/knowledge-db-web`
4. Framework: Next.js を選択
5. Environment Variables を設定：
   ```
   NEXT_PUBLIC_API_URL=https://knowledge-db-api.onrender.com/api
   ```
6. "Deploy" をクリック
7. デプロイ完了後、Vercel URL が割り当たります

### Step 4: 本番環境 確認テスト

```bash
# 1. 検索 API テスト
curl -X POST https://knowledge-db-api.onrender.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 5}'

# 2. ドキュメント一覧 テスト
curl https://knowledge-db-api.onrender.com/api/documents

# 3. 統計情報 テスト
curl https://knowledge-db-api.onrender.com/api/stats
```

### Step 5: ポートフォリオサイトに リンク追加

`portfolio-site` の Project③ セクションに以下を追加：
```markdown
## Project③ 検索AI / ナレッジDB

[🚀 yukiLabs Search に移動](https://knowledge-db-web.vercel.app)

**デモ:**
- ドキュメント検索（Full Text Search）
- 統計情報表示
- PostgreSQL + Neon 統合
```

## トラブルシューティング

### Render でビルド失敗
```bash
# ローカルでビルド確認
npm run build
npm start
```

### API が 503 応答する
- Render のダッシュボードで ログ確認
- DATABASE_URL が正しくセットされているか確認
- Neon ダッシュボードで PostgreSQL 接続状態確認

### フロントエンドが API に接続できない
- `.env.local` (local) or Vercel environment (prod) の NEXT_PUBLIC_API_URL を確認
- CORS が設定されているか確認 (API の `cors()` middleware)

## 本番環境 監視

### Render UptimeRobot 設定（オプション）

Render のスリープ防止：
1. [UptimeRobot](https://uptimerobot.com/) にログイン
2. "Add Monitoring" → "HTTPS"
3. URL: `https://knowledge-db-api.onrender.com/api/health`
4. 間隔: 5分
5. これで 24/7 稼働させられます

### ログ監視

```bash
# Render ログ確認
cd knowledge-db
git remote -v  # Render Git URL 確認
```

## 完了

- [ ] API サーバー デプロイ完了
- [ ] フロントエンド デプロイ完了
- [ ] 本番環境テスト成功
- [ ] ポートフォリオサイトにリンク追加
