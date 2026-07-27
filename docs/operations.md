# knowledge-db — 本番運用ドキュメント

## 環境変数一覧

| 変数名 | 必須 | 説明 | 設定場所 |
|--------|------|------|----------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL 接続文字列 | Render 環境変数 |
| `PORT` | — | サーバーポート（デフォルト 3000） | Render が自動設定 |
| `LOG_LEVEL` | — | ログレベル（info/debug/warn/error、デフォルト info） | Render 環境変数 |
| `DISCORD_WEBHOOK_INFRA` | — | 5xx エラー時の Discord 通知先 Webhook URL | Render 環境変数 |
| `ARXIV_CATEGORY` | — | arXiv クローラーカテゴリ（デフォルト cs.AI） | GitHub Secrets |
| `DEVTO_TAG` | — | dev.to クローラータグ（デフォルト machinelearning） | GitHub Secrets |
| `CRAWL_LIMIT` | — | クローラー 1 回の最大取得件数（デフォルト 50） | GitHub Secrets |

---

## デプロイ手順

### 通常デプロイ（自動）

`main` ブランチへのマージで Render が自動デプロイを実行する。

```bash
# PR マージ後に自動トリガー — 手動操作不要
# デプロイ状況確認
render deploys list --service <service-id> | head -3
```

### 手動デプロイ

```bash
# 最新コードで強制デプロイ
render deploys create --service <service-id>

# ログ追跡
render logs --service <service-id> --tail
```

### 環境変数変更後の再デプロイ

環境変数を Render ダッシュボードで変更した後、デプロイを手動トリガーする必要がある。

```bash
render env set KEY=VALUE --service <service-id>
render deploys create --service <service-id>
```

---

## 日常運用

### クローラー実行

GitHub Actions で毎日 11:00 JST に自動実行（`.github/workflows/crawl.yml`）。

手動実行:

```bash
gh workflow run crawl.yml --repo yukilabs-core/knowledge-db

# 実行ログ確認
gh run list --workflow crawl.yml --limit 5
gh run view <run-id> --log
```

ローカルでの手動実行:

```bash
export DATABASE_URL="..."
node scripts/run-crawler.js --source arxiv --limit 50
node scripts/run-crawler.js --source devto --limit 50
```

### データ確認

```bash
export DATABASE_URL="..."

# 件数確認
psql "$DATABASE_URL" -c "SELECT source, COUNT(*), MAX(created_at) FROM entries GROUP BY source;"

# 最新エントリ確認
psql "$DATABASE_URL" -c "SELECT title, source, created_at FROM entries ORDER BY created_at DESC LIMIT 5;"
```

---

## go-live チェックリスト

### インフラ

- [ ] Render サービスが `live` 状態である
- [ ] DATABASE_URL が Render 環境変数に設定されている
- [ ] `render.yaml` に DATABASE_URL の平文値が含まれていない（削除済み: commit 時点確認）
- [ ] Neon パスワードが rotate 済みである（render.yaml 漏洩対応）
- [ ] Render プランが Starter 以上（Free はスピンダウンあり）

### 動作確認

- [ ] `curl https://<service>.onrender.com/api/health` → `{"status":"ok"}`
- [ ] `curl https://<service>.onrender.com/api/search?q=AI` → 検索結果が返る
- [ ] `curl https://<service>.onrender.com/metrics` → Prometheus メトリクスが返る
- [ ] エントリ件数が 100 件以上ある

### 監視

- [ ] `prometheus/rules/knowledge-db.rules.yml` が dev-infrastructure にマージ済み
- [ ] Prometheus の scrape config（知識 DB）が有効化済み
- [ ] DISCORD_WEBHOOK_INFRA が設定されている（5xx アラート通知先）

### セキュリティ

- [ ] DATABASE_URL が Render 環境変数のみで管理されている
- [ ] GitHub Secrets に DATABASE_URL が設定されている（クローラー用）
- [ ] `.env` ファイルが `.gitignore` に含まれている

### ドキュメント

- [ ] README に本番 URL が記載されている
- [ ] `docs/troubleshooting.md` が存在する
- [ ] `docs/recovery.md` が存在する
- [ ] `docs/sla-and-monitoring.md` が存在する

---

## Runbook

### Neon suspend からの復旧

1. Neon コンソール → Endpoint を `RESUME`
2. `render restarts create --service <service-id>` でサービス再起動
3. `/api/health` が `200 OK` を返すことを確認

### DB 接続プールのリセット

```bash
# サービス再起動（接続プールがリセットされる）
render restarts create --service <service-id>
```

### クローラーの手動トリガー

```bash
gh workflow run crawl.yml --repo yukilabs-core/knowledge-db \
  -f source=all \
  -f limit=100
```

### Qdrant 再インデックス（将来的な拡張時）

現在のアーキテクチャでは Qdrant は使用していない（PostgreSQL FTS のみ）。
将来的にベクトル検索を追加する場合は `embedding-svc` との連携手順を追記すること。

---

## 定期メンテナンスチェックリスト

### 日次（自動）

- [ ] クローラーワークフロー成功確認: `gh run list --workflow crawl.yml --limit 1`
- [ ] `/api/health` が `200 OK` を返していること
- [ ] Render ログに ERROR 行がないこと

### 週次（手動）

- [ ] エントリ件数の増加確認（前週比）

  ```bash
  psql "$DATABASE_URL" -c "SELECT COUNT(*), MAX(created_at) FROM entries;"
  ```

- [ ] Neon ストレージ使用量確認（Free: 3GB 上限）
  - Neon コンソール → Monitoring → Storage
- [ ] Render デプロイ履歴確認（失敗がないか）

  ```bash
  render deploys list --service <service-id> | head -5
  ```

- [ ] Prometheus アラートが発火していないか確認
- [ ] pnpm audit（セキュリティ脆弱性スキャン）

  ```bash
  cd yukilabs-core/knowledge-db && pnpm audit
  ```

### 月次

- [ ] 依存パッケージの更新（Renovate PR を確認・マージ）
- [ ] Neon のポイントインタイムリストア設定確認（7日分）
- [ ] SLA 達成状況の確認（Render ダッシュボードの Uptime グラフ）

---

## バックアップ手順

### Neon の自動バックアップ

Neon は継続的な WAL ベースのバックアップを自動実行する。手動操作不要。

- Free プラン: 直近 7 日間のポイントインタイムリストア
- 確認: Neon コンソール → Branching

### 手動スナップショット（任意）

```bash
export DATABASE_URL="..."

# スナップショット作成
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  -f "backup_$(date +%Y%m%d).sql"

# 保存先: ~/backups/knowledge-db/ (MINIPC)
scp "backup_$(date +%Y%m%d).sql" yuki@192.168.68.63:/home/yuki/backups/knowledge-db/
```

---

## 関連ドキュメント

- [SLA・監視メトリクス定義](sla-and-monitoring.md)
- [トラブルシューティング](troubleshooting.md)
- [データ復旧手順](recovery.md)
