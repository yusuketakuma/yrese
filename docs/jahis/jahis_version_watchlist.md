# jahis_version_watchlist — JAHIS版監視台帳

```yaml
ssot_id: JHS-004
title: JAHIS版監視台帳
domain: jahis
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - security_critic
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-08-23
source_refs: [構築プロンプト v0.2.0 §0.0.4.10, REG-007, ADP-001, MST-002, CLM-002]
approved_at: 2026-08-23
approved_by: "direct human authority 2026-08-23 (「全てを許可する。実行」); independent review: api-contract lane + security-privacy lane REQUEST_CHANGES -> all findings closed (28dae05, f07e76e); closure checker PASS"
effective_from: 2026-08-23
effective_to: null
depends_on: [REG-001, REG-007, ADP-001, API-009, ADP-003]
impacts: [Plans.md §16 Track C, packages/jahis-2d(予定), packages/jahis-yakureki(予定)]
related_work_packages: [WP-6201, WP-6202, WP-6203, WP-6204, WP-6205, WP-6207, WP-6210]
related_tests: []
related_prs: []
evidence_ids: []
open_questions: []
blockers:
  - BLOCKED_JAHIS_SPEC_ACQUISITION: 仕様本文の正規入手(WP-6201、人間手続き)まで実装根拠にしない
change_log:
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.1 2026-08-23 WP-6203: 昇格 batch 準備 — owner を codex_root へ移管、23 field を補完、2次元シンボルの版認識を Ver.1.11 実在確認済み(REG-007 §7)へ統一(WP-6202)。本文 semantics は不変。status は PROPOSED のまま(review と human approval 待ち)"
```


REG-002(version_watchlist)の JAHIS 特化版。監視結果の差分は QUA-003(change control)フローへ流す。

## 監視対象

| 対象 | 現行確認版 | 確認日 | 確認方法 | 監視頻度(候補) |
|---|---|---|---|---|
| 院外処方箋2次元シンボル記録条件規約 | Ver.1.11(2026年5月) | 2026-07-09 | jahis.jp id=1233(REG-007) | 月次 + 改定期強化 |
| 薬局レセコン電子薬歴連携仕様 | Ver.1.1【要確認】 | — | 未到達 | 初回確認が先 |
| 電子版お薬手帳データフォーマット仕様書 | Ver.2.6(id=1124) | 2026-07-09 | jahis.jp 検索 | 四半期 |
| 電子処方箋実装ガイド | Ver.1.2(2021年2月) | 2026-07-09 | 公開PDF(20-104)。後継有無【要確認】 | 四半期 |
| 監査証跡メッセージ標準規約 | Ver.2.2(2025年7月) | 2026-07-09 | jahis.jp 一覧 | 半期 |
| リモートサービス セキュリティGL | Ver.5.0(2026年2月) | 2026-07-09 | jahis.jp 一覧 | 半期 |
| セキュリティ開示書ガイド | Ver.5.0(2024年9月) | 2026-07-09 | jahis.jp 一覧 | 半期 |
| 電子保存ガイドライン | Ver.5(2024年9月) | 2026-07-09 | jahis.jp 一覧 | 半期 |
| JAHIS標準類マップ(全体棚卸し用) | 2025-09-16 版 | 2026-07-09 | 公開PDF | 半期(棚卸し網羅性の再確認) |

## 版差分検知時の処理

1. 差分内容を本台帳へ記録(旧版・新版・公表日・適用日)
2. JHS-001 該当性・JHS-003 Adapter 影響を評価
3. 高リスク(2Dシンボル・薬歴連携・お薬手帳)は opus4.8 レビュー
4. 当時有効版の選択ルール(処方日・調剤日基準)は MST-001/REG-002 と同一原則
5. 対応完了まで JHS-002 判定を BLOCKED_JAHIS_CONFORMANCE_REVIEW へ戻す
