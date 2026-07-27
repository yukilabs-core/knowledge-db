# knowledge-db — SLA・監視メトリクス定義書

## SLA 目標値

| 指標 | 目標 | 備考 |
|------|------|------|
| 可用性 (Uptime) | 99.0% / 月 | Render Starter プラン相当（計画外停止 < 7.3h/月） |
| RTO（目標復旧時間） | 30 分以内 | Render 自動再デプロイ + 手動対応で対処 |
| RPO（目標復旧時点） | 24 時間以内 | Neon の日次スナップショット |
| p50 レイテンシ | < 200ms | 通常のキャッシュ有りリクエスト |
| p95 レイテンシ | < 2,000ms | アラートしきい値（KnowledgeDBHighLatency） |
| エラー率 (5xx) | < 5% | 5 分間の rolling window（KnowledgeDBHighErrorRate） |

---

## 監視メトリクス一覧

### HTTP レイヤー

| メトリクス名 | 説明 | WARNING | CRITICAL | 対応アクション |
|---|---|---|---|---|
| `http_requests_total` | 累積リクエスト数（method/route/status_code） | — | — | トレンド確認 |
| `http_request_duration_seconds` (p95) | リクエスト処理時間 p95 | > 1s | > 2s | DB クエリ・N+1 確認 |
| 5xx エラー率 | `rate(5xx)[5m] / rate(total)[5m]` | > 2% | > 5% | ログ確認・DB 接続確認 |
| `up{job="knowledge-db-api"}` | サービス死活 | — | == 0 (2m) | Render 再起動 |

### DB レイヤー

| メトリクス名 | 説明 | WARNING | CRITICAL | 対応アクション |
|---|---|---|---|---|
| `db_query_duration_seconds` (p95) | DB クエリ時間 p95 | > 0.5s | > 1s | クエリ最適化・Neon 状態確認 |
| Neon 接続数 | pg_stat_activity count | > 15 | > 18 | アイドル接続強制終了 |
| `/api/health` 503 率 | ヘルスチェック失敗率 | — | > 0 (1m) | Neon suspend 確認 |

### ビジネスレイヤー

| メトリクス名 | 確認方法 | 目標 | 対応アクション |
|---|---|---|---|
| エントリ総件数 | `SELECT COUNT(*) FROM entries` | 増加傾向 | クローラー再実行 |
| 検索結果件数 | `/api/search?q=test` | >= 1 | データ再収集 |
| 最新エントリ日時 | `MAX(created_at) FROM entries` | 24h 以内 | クローラーワークフロー確認 |

### インフラレイヤー（Render / Prometheus）

| メトリクス名 | 説明 | WARNING | CRITICAL |
|---|---|---|---|
| `process_resident_memory_bytes` | Node.js プロセスメモリ | > 400MB | > 480MB |
| `process_cpu_seconds_total` | CPU 使用率 | > 80% | > 95% |
| `nodejs_eventloop_lag_seconds` | イベントループ遅延 | > 100ms | > 500ms |

---

## Prometheus アラートルール（参照）

アラートルールは dev-infrastructure リポジトリで管理:

```
prometheus/rules/knowledge-db.rules.yml
```

| アラート名 | 条件 | 重大度 | 発火時間 |
|---|---|---|---|
| `KnowledgeDBDown` | `up == 0` | critical | 2m |
| `KnowledgeDBHighErrorRate` | 5xx 率 > 5% | warning | 2m |
| `KnowledgeDBHighLatency` | p95 > 2.0s | warning | 5m |
| `KnowledgeDBHealthCheckFailing` | `/api/health` 503 | critical | 1m |

---

## 監視設定（Prometheus scrape）

Render デプロイ後、`prometheus/prometheus.yml` のコメントを外す:

```yaml
- job_name: "knowledge-db-api"
  static_configs:
    - targets: ["knowledge-db-api.onrender.com:443"]
  metrics_path: "/metrics"
  scheme: https
```

---

## Grafana ダッシュボード（推奨パネル）

| パネル | クエリ |
|---|---|
| QPS | `rate(http_requests_total{job="knowledge-db-api"}[5m])` |
| 5xx エラー率 | `rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])` |
| p95 レイテンシ | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| DB クエリ時間 | `histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))` |
| メモリ使用量 | `process_resident_memory_bytes{job="knowledge-db-api"}` |

---

## 関連ドキュメント

- [トラブルシューティング](troubleshooting.md)
- [データ復旧手順](recovery.md)
- [本番運用ドキュメント](operations.md)
