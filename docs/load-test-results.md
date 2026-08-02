# E2E テスト結果

**実施日時**: 2026-08-02T08:54:04.362Z
**対象 URL**: https://knowledge-db-api.onrender.com

## ヘルスチェック（コールドスタート確認）

- 応答時間: 1824ms
- 状態: ✅ 正常（ウォーム状態）
- 対策: 定期 ping（例: 14分毎に GET /api/health）でスリープを防止可能

## 検索精度テスト

| 結果 | 件数 |
|------|------|
| 合格 | 14 |
| 不合格 | 0 |
| **合格率** | **100.0%** |
| 判定 | ✅ PASS |

### クエリ別結果

| クエリ | 件数 | スコア | 応答(ms) | 結果 |
|--------|------|--------|----------|------|
| machine learning | 5 | 0.191 | 798 | ✅ |
| neural network | 8 | 0.269 | 606 | ✅ |
| deep learning | 3 | 0.250 | 710 | ✅ |
| natural language processing | 2 | 0.112 | 715 | ✅ |
| transformer attention | 2 | 0.106 | 615 | ✅ |
| reinforcement learning | 7 | 0.266 | 1023 | ✅ |
| computer vision | 3 | 0.022 | 612 | ✅ |
| graph neural network | 5 | 0.608 | 615 | ✅ |
| large language model | 23 | 0.662 | 607 | ✅ |
| diffusion model | 4 | 0.099 | 601 | ✅ |
| federated learning | 2 | 0.447 | 601 | ✅ |
| knowledge distillation | 2 | 0.099 | 598 | ✅ |
| xyz_nonexistent_query_12345 | 0 | 0.000 | 596 | ✅ |
| quantum computing blockchain nft | 0 | 0.000 | 555 | ✅ |

## 負荷テスト（10並列）

| 項目 | 値 |
|------|----|
| 並列数 | 10 |
| 総処理時間 | 2226ms |
| 成功 | 10/10 |
| エラー | 0 |
| 平均応答 | 1895ms |
| p50 | 2030ms |
| p95 | 2226ms |
| 判定 | ✅ PASS |

## 総合判定

✅ **全テスト PASS** — 本番稼働可能
