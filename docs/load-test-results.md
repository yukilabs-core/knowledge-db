# E2E テスト結果

**実施日時**: 2026-08-02T11:10:37.189Z
**対象 URL**: https://knowledge-db-api.onrender.com

## ヘルスチェック
- 応答時間: 438ms
- 状態: ✅ 正常 (healthy)

## 検索精度テスト
| クエリ | 件数 | スコア | 応答(ms) | 結果 |
|--------|------|--------|----------|------|
| machine learning | 5 | 0.191 | 804 | ✅ |
| neural network | 8 | 0.269 | 567 | ✅ |
| deep learning | 3 | 0.250 | 571 | ✅ |
| natural language processing | 2 | 0.112 | 696 | ✅ |
| transformer attention | 2 | 0.106 | 562 | ✅ |
| reinforcement learning | 7 | 0.266 | 574 | ✅ |
| computer vision | 3 | 0.022 | 619 | ✅ |
| graph neural network | 5 | 0.608 | 561 | ✅ |
| large language model | 10 | 0.662 | 578 | ✅ |
| diffusion model | 4 | 0.099 | 561 | ✅ |
| federated learning | 2 | 0.447 | 565 | ✅ |
| knowledge distillation | 2 | 0.099 | 556 | ✅ |
| generative AI | 3 | 0.267 | 560 | ✅ |
| RAG retrieval augmented | 2 | 0.696 | 563 | ✅ |
| xyz_nonexistent_query_12345 | 0 | 0.000 | 561 | ✅ |
| quantum computing blockchain nft | 0 | 0.000 | 585 | ✅ |

合格: 16/16 (100.0%)
判定: ✅ PASS

## 負荷テスト（10並列）
| 項目 | 値 |
|------|----|
| 並列数 | 10 |
| 総処理時間 | 2093ms |
| 成功 | 10/10 |
| エラー | 0 |
| 平均応答 | 1861ms |
| p50 | 1994ms |
| p95 | 2089ms |
| 判定 | ✅ PASS |

## セキュリティチェック
- /metrics 外部アクセス: ✅ 403 Forbidden
- query 501文字: ✅ 400 拒否
- err.message 隠蔽: ✅ コードレビュー済み（PR #4）

## 総合判定
✅ **全テスト PASS** — 本番稼働可能
