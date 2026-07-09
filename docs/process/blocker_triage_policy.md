# blocker_triage_policy — ブロッカー処理ポリシー

```yaml
ssot_id: PRC-006
title: ブロッカー処理ポリシー
domain: process
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §0.13, §42
depends_on:
  - REG-004 regulatory_blockers
impacts: 全WP・全実装
open_questions: []
```

## 1. 報告形式(v0.1.7 §0.13)

agmsg(または State.md)へ以下の形式で報告する。

```text
[msg_type]: BLOCKER
[to]: fable5
[from]: <agent>
work_package_id:
status: BLOCKED
blocker_type:            # @yrese/shared-kernel BLOCKER_TYPES のいずれか
blocking_question:
affected_files:
risk:
recommended_next_step:
```

## 2. BLOCKER 種別

種別の正本はコードの `@yrese/shared-kernel` `BLOCKER_TYPES`(packages/shared-kernel/src/blockers.ts)と本書・REG-004 で同期する。新種別の追加は SSOT 更新(fable5)→ shared-kernel 反映の順で行い、コード側での独自追加を禁止する。

現行の主要カテゴリ: 実装統率系(BLOCKED_NOT_READY 等)/ 規制系(BLOCKED_REGULATORY_REVIEW, BLOCKED_PMDA_SAMD_REVIEW 等 — 台帳は REG-004)/ 移行系 / 実装所有・契約系(IMPLEMENTATION_OWNERSHIP_BLOCKED, API_CONTRACT_BLOCKED)/ 共通モジュール系(COMMON_MODULE_* , GENERATED_CODE_DRIFT_BLOCKED)/ 実行モード系(CODEX_ULTRA_MODE_UNAVAILABLE 等)/ SSOT系(SSOT_UPDATE_REQUIRED)。

## 3. triage(fable5)

fable5 はブロッカーを受領後、以下のいずれかを決定し、State.md に記録する。

1. 追加調査(Web公式資料調査は許可済み — WP-0014/0015 方式)
2. scope 変更 / WP 分割
3. opus4.8 レビュー依頼
4. 人間レビュー依頼(REG-006 human_review_checklist へ登録)
5. 人間作業依頼(例: WP-0016 ONS登録、点数の目視ダブルチェック)
6. future scope へ移動(non_mvp_scope 更新)
7. 実装禁止の確定
8. 代替案採用(SSOT 更新を伴う)

## 4. 優先度

| 優先 | 条件 | 対応期限の目安 |
|---|---|---|
| P0 | 患者安全・請求事故・PHI漏えいに直結 | 即時。関連作業を全停止 |
| P1 | 高リスクWPの進行を止めている | 当該レーンを停止し triage |
| P2 | 通常WPの進行を止めている | 次の WP 発行前に triage |
| P3 | 将来作業の前提(ONS登録等の人間作業) | Plans.md に登録し定期リマインド |

## 5. 解除

- 解除条件は BLOCKER ごとに REG-004 または該当SSOTに明記する(「行単位の解除手順」方式 — CAL-001 参照)。
- 解除は fable5 が判定し、根拠(evidence_id / レビュー記録)を State.md に記録する。
- 解除なしに実装で迂回することを禁止する(先例: 空ruleset→BLOCKED を返す算定エンジン骨格)。
