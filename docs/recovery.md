# knowledge-db — データ復旧手順

## 目次

1. [完全復旧（Neon バックアップからリストア）](#1-完全復旧neon-バックアップからリストア)
2. [部分復旧（クローラー再実行）](#2-部分復旧クローラー再実行)
3. [DB 接続障害からの復旧](#3-db-接続障害からの復旧)
4. [データ損失なし・サービス停止のみ](#4-データ損失なしサービス停止のみ)
5. [復旧後の検証チェックリスト](#5-復旧後の検証チェックリスト)

---

## 前提：環境変数

```bash
export DATABASE_URL="postgresql://..."   # Neon の接続文字列
export SERVICE_URL="https://knowledge-db-api.onrender.com"
```

---

## 1. 完全復旧（Neon バックアップからリストア）

### 1.1 バックアップの確認

Neon コンソール (`https://console.neon.tech`) → プロジェクト → **Branching** → **Point-in-time restore** で利用可能な復旧ポイントを確認する。

Neon Free プランでは直近 7 日分のポイントインタイムリストアが可能。

### 1.2 リストア手順

**Neon コンソール経由（推奨）:**

1. Neon コンソール → **Branches** → **Create branch**
2. Branch from: `main`、Time: 復旧したいポイントを指定
3. 新しいブランチの接続文字列を取得
4. ローカルで差分確認:

```bash
# 復旧ブランチから件数確認
psql "postgresql://<restore-branch-url>" -c "SELECT COUNT(*) FROM entries;"

# 現在の本番と比較
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM entries;"
```

5. 問題なければ Neon の **Reset from parent** で本番ブランチを上書きするか、`pg_dump` + `pg_restore` でデータを移行:

```bash
# 復旧ブランチからダンプ
pg_dump "postgresql://<restore-branch-url>" \
  --no-owner --no-acl \
  -t entries \
  -f entries_restore.sql

# 本番に適用
psql "$DATABASE_URL" < entries_restore.sql
```

### 1.3 スキーマ再適用が必要な場合

```bash
# スキーマ定義を確認
cat src/db/schema.sql   # または init.sql

# スキーマ適用
psql "$DATABASE_URL" < src/db/schema.sql
```

---

## 2. 部分復旧（クローラー再実行）

データが失われたが、スキーマは正常な場合（クローラーでデータ再収集が可能なケース）。

### 2.1 既存データの確認

```bash
# ソース別件数
psql "$DATABASE_URL" -c "SELECT source, COUNT(*), MAX(created_at) FROM entries GROUP BY source ORDER BY source;"

# 最新エントリの確認
psql "$DATABASE_URL" -c "SELECT title, source, created_at FROM entries ORDER BY created_at DESC LIMIT 10;"
```

### 2.2 クローラー手動実行

```bash
cd /path/to/knowledge-db

# arXiv から再収集（最大 100 件）
DATABASE_URL="$DATABASE_URL" \
  ARXIV_CATEGORY="cs.AI" \
  CRAWL_LIMIT=100 \
  node scripts/run-crawler.js --source arxiv

# dev.to から再収集
DATABASE_URL="$DATABASE_URL" \
  DEVTO_TAG="machinelearning" \
  CRAWL_LIMIT=100 \
  node scripts/run-crawler.js --source devto
```

> `ON CONFLICT (source_url) DO NOTHING` で重複は自動スキップされる。

### 2.3 GitHub Actions で一括再収集

```bash
# workflow_dispatch でトリガー
gh workflow run crawl.yml \
  --field source=all \
  --field limit=200
```

---

## 3. DB 接続障害からの復旧

### 3.1 Neon の suspend（無料プランの自動停止）

**症状:** `/api/health` が 503 を返し、ログに `connection refused` または `endpoint is disabled`。

**手順:**

1. Neon コンソール → プロジェクト → Endpoint が **Suspended** 状態か確認
2. `RESUME` ボタンをクリック（または次のリクエストで自動再開）
3. Render でサービスを手動再起動してコネクションプールをリセット:
   ```bash
   render restarts create --service <service-id>
   ```

### 3.2 DATABASE_URL の変更・ローテーション

Neon パスワードをローテーションした場合、Render の環境変数も更新が必要。

```bash
# Render 環境変数更新
render env set DATABASE_URL="postgresql://new-url" --service <service-id>

# サービス再デプロイをトリガー
render deploys create --service <service-id>
```

### 3.3 接続数超過（`too many connections`）

```bash
# アイドル接続を強制終了
psql "$DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND state_change < NOW() - INTERVAL '5 minutes';
"
```

---

## 4. データ損失なし・サービス停止のみ

### Render サービスのスピンダウン（Free プラン）

Free プランは 15 分アイドルでスピンダウン。初回リクエストで 30〜60 秒かかる。

**対策:** Render Starter プランに移行するか、`UptimeRobot` 等で 10 分間隔の死活監視を設定する。

### コードデプロイによる一時停止

Render はデプロイ中にダウンタイムが発生する（Blue/Green なし）。

**確認:**

```bash
render deploys list --service <service-id> | head -5
```

最新デプロイのステータスが `live` になれば復旧完了。

---

## 5. 復旧後の検証チェックリスト

```bash
# 1. ヘルスチェック
curl "$SERVICE_URL/api/health" | jq .
# 期待: {"status":"ok","db":"connected"}

# 2. エントリ件数
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM entries;"
# 復旧前の件数と比較

# 3. 検索動作
curl "$SERVICE_URL/api/search?q=machine+learning&limit=5" | jq '.results | length'
# 期待: 1以上

# 4. メトリクス
curl "$SERVICE_URL/metrics" | grep 'http_requests_total'
# Prometheus メトリクスが返ること

# 5. 直近エントリの確認
psql "$DATABASE_URL" -c "
  SELECT title, source, created_at
  FROM entries
  ORDER BY created_at DESC
  LIMIT 5;
"

# 6. エラーログ確認（Render）
render logs --service <service-id> | grep -i error | tail -20
```

全項目が正常なら復旧完了。

---

## 関連ドキュメント

- [トラブルシューティングガイド](troubleshooting.md)
- [Prometheus アラートルール](../../flipslidersand/dev-infrastructure/prometheus/rules/knowledge-db.rules.yml)
