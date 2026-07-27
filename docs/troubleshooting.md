# knowledge-db API — トラブルシューティングガイド

## 目次

1. [起動失敗](#1-起動失敗)
2. [DB 接続エラー](#2-db-接続エラー)
3. [検索精度の低下](#3-検索精度の低下)
4. [メモリ使用量増大](#4-メモリ使用量増大)
5. [クローラー失敗](#5-クローラー失敗)
6. [Render デプロイ失敗](#6-render-デプロイ失敗)
7. [/metrics エンドポイント問題](#7-metrics-エンドポイント問題)
8. [レスポンス遅延](#8-レスポンス遅延)

---

## 1. 起動失敗

### 症状

```
Error: Cannot find module './logger.js'
Error: Cannot find module 'pino'
```

**診断コマンド:**

```bash
# Render ログ確認
render logs --service <service-id> | tail -50

# 依存パッケージ確認
cat package.json | jq '.dependencies'
```

**修正:**

```bash
npm install          # 依存関係を再インストール
npm run build        # ビルドを再実行（必要な場合）
```

---

### 症状

```
Error: DATABASE_URL is not defined
```

**診断コマンド:**

```bash
# Render 環境変数を確認
render env list --service <service-id>
```

**修正:** Render ダッシュボード → Environment → `DATABASE_URL` を設定。形式: `postgresql://user:pass@host/db?sslmode=require`

---

## 2. DB 接続エラー

### 症状

```
/api/health → 503
{"status":"error","error":"DB unavailable"}
```

**診断コマンド:**

```bash
# ヘルスチェック
curl https://<service>.onrender.com/api/health

# Neon コンソールでアクティブ接続数を確認
# https://console.neon.tech → Monitoring → Connections
```

**修正手順:**

1. Neon プロジェクトが "Active" 状態であることを確認（長期非アクセスで suspend される）
2. DATABASE_URL のホスト名・パスワードが最新であることを確認
3. Neon コンソールで `RESUME` をクリック
4. Render でサービスを手動再起動

---

### 症状

```
NeonDbError: too many connections
```

**診断コマンド:**

```bash
# 現在の接続数
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"
```

**修正:**

`src/db/connection.js` の `max` を確認（デフォルト 10）。Neon の接続数上限（Free: 20）を超えていれば縮小するか、接続プールを明示的に設定する。

---

## 3. 検索精度の低下

### 症状

- 関連する記事が検索結果に出ない
- スコアが著しく低い（< 0.3）

**診断コマンド:**

```bash
# 検索結果とスコアを確認
curl "https://<service>.onrender.com/api/search?q=<keyword>&limit=10" | jq '.results[] | {title, score}'

# レコード件数確認
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM entries;"
psql "$DATABASE_URL" -c "SELECT source, COUNT(*) FROM entries GROUP BY source;"
```

**原因と修正:**

| 原因                     | 修正                                            |
| ------------------------ | ----------------------------------------------- |
| データが少ない           | クローラーを手動実行 `npm run crawl`            |
| クローラーが止まっている | GitHub Actions の scheduled workflow ログを確認 |
| FTS5 インデックス破損    | `REINDEX TABLE entries;` を実行                 |

---

## 4. メモリ使用量増大

### 症状

- Render が OOM で強制終了
- `/metrics` に `process_resident_memory_bytes` が増加し続ける

**診断コマンド:**

```bash
# Prometheus から確認
curl https://<service>.onrender.com/metrics | grep process_resident_memory

# Render ダッシュボードのメモリグラフを確認
```

**修正:**

Render の Starter プランはメモリ 512MB。Free プランの場合は 256MB が上限。

1. `src/index.js` でリクエストごとにリークしている変数がないか確認
2. `pg` ライブラリのバージョンを確認（接続リーク既知バグがある場合）
3. プランをアップグレードするか、`NODE_OPTIONS=--max-old-space-size=256` を設定

---

## 5. クローラー失敗

### 症状

GitHub Actions の `crawl.yml` が失敗する。

**診断コマンド:**

```bash
# 直近の workflow 実行結果
gh run list --workflow crawl.yml --limit 5

# 特定 run のログ
gh run view <run-id> --log
```

**よくある原因:**

| エラー                     | 原因                  | 修正                                       |
| -------------------------- | --------------------- | ------------------------------------------ |
| `ECONNRESET` / `ETIMEDOUT` | 外部 API の一時障害   | 次回実行まで待つ（retry あり）             |
| `403 Forbidden`            | API レート制限        | `CRAWL_LIMIT` を下げる                     |
| `DATABASE_URL not set`     | GitHub Secrets 未設定 | `Settings → Secrets → DATABASE_URL` を追加 |
| GitHub Actions billing     | 使用量超過            | アカウントの spending limit を増やす       |

**手動実行:**

```bash
DATABASE_URL="..." node scripts/run-crawler.js --source arxiv --limit 20
```

---

## 6. Render デプロイ失敗

### 症状

```
Deploy failed: Build error
```

**診断コマンド:**

```bash
# Render CLI
render deploys list --service <service-id>
render deploys logs <deploy-id>
```

**よくある原因:**

| エラー                     | 修正                                       |
| -------------------------- | ------------------------------------------ |
| `npm ERR! code EINTEGRITY` | `package-lock.json` を再生成               |
| `SyntaxError`              | `node --check src/index.js` でローカル確認 |
| `MODULE_NOT_FOUND`         | `package.json` の `type: "module"` を確認  |

---

## 7. /metrics エンドポイント問題

### 症状

```
curl https://<service>.onrender.com/metrics → 403 or empty
```

**診断コマンド:**

```bash
curl -v https://<service>.onrender.com/metrics
```

**Prometheus が scrape できない場合:**

`prometheus/prometheus.yml` の knowledge-db scrape config がコメントアウトされていないか確認。Render のサービスが HTTPS 443 ポートであることも確認（`scheme: https`）。

---

## 8. レスポンス遅延

### 症状

- 検索 API が 2 秒以上かかる
- Prometheus アラート `KnowledgeDBHighLatency` が発火

**診断コマンド:**

```bash
# p95 レイテンシを確認
curl https://<service>.onrender.com/metrics | grep 'http_request_duration'

# DB クエリ時間を確認
curl https://<service>.onrender.com/metrics | grep 'db_query_duration'
```

**原因と修正:**

| 原因                                | 修正                                                  |
| ----------------------------------- | ----------------------------------------------------- |
| Neon コールドスタート（suspend 後） | サービス再起動または Neon を自動再開設定              |
| FTS5 全文検索が遅い                 | インデックスが壊れていないか確認                      |
| Render スピンダウン（Free）         | Starter プランに移行（スピンダウンなし）              |
| N+1 クエリ                          | `src/controllers/` のクエリを確認し一括 SELECT に変更 |

---

## ログの見方

構造化 JSON ログ（pino）は Render ダッシュボードで確認できる。

```json
{"level":30,"severity":"INFO","time":"2026-07-27T10:00:00.000Z","service":"knowledge-db-api","msg":"Server running on port 3000"}
{"level":50,"severity":"ERROR","time":"...","msg":"Database connection failed","err":{"message":"..."}}
```

`severity` フィールドは GCP Cloud Logging の重大度と対応している。

---

## 関連ドキュメント

- [データ復旧手順](recovery.md)
- [Prometheus アラートルール](../../flipslidersand/dev-infrastructure/prometheus/rules/knowledge-db.rules.yml)
