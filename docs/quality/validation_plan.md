# validation_plan — バリデーション計画

```yaml
ssot_id: QUA-002
title: バリデーション計画
domain: quality
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-12
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §10, §9.7
depends_on:
  - QUA-001 quality_plan
  - TST-001 test_strategy
  - REG-004 regulatory_blockers
impacts:
  - TST-001 test_strategy
  - validation and Go/No-Go evidence and release gates
related_work_packages: [WP-0011, WP-9002-W16]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-12 WP-9002-W16 metadata-only completion: body/status/version/approval/effective/validation semantics unchanged"
open_questions:
  - 並行稼働の差分許容範囲(件数・金額)の定量値(請求実務者レビューで確定)
  - 接続試験環境(オン資・電子処方箋サンドボックス)の利用申請時期(ONS登録後)
blockers:
  - BLOCKED_REGULATORY_REVIEW(オン資・電子処方箋の接続試験はREG-004 RB-002/RB-003解除までBLOCKED)
```

## 1. バリデーションの層

| 層 | 内容 | 証跡 |
|---|---|---|
| L1 検証(verification) | 実装がSSOT・WPどおりか(unit / contract / boundary / typecheck) | CI 結果、WP_HANDOFF、レビュー記録 |
| L2 妥当性確認(validation) | SSOT・算定結果が公式資料・実務に照らして正しいか | evidence_id、golden test、人間レビュー(薬剤師・請求実務者) |
| L3 実地確認 | 接続試験・並行稼働・現場ユーザビリティ | §9.7 の接続試験群、UAC-01〜12、Go/No-Go |

L1 が通っても L2/L3 の承認なしに「正しい」と主張しない(画像判読ノート CLM-002/CAL-002 は L2 未了の典型例 — 人間の目視ダブルチェックが発行条件)。

## 2. traceability チェーン

```text
公式資料(source_registry / evidence_verification_log)
  → evidence_id(EVD-xxx)
  → SSOT(CAL/CLM/… APPROVED)
  → WP(ssot_refs / evidence_id)
  → 実装(calculation rule の evidenceRefs — @yrese/trace が実行時強制)
  → テスト(golden test の期待値はSSOT由来のみ)
  → コミット(WP-ID)
  → 帳票・レセプト出力時の calculation_trace / legal_trace 保存
```

## 3. 妥当性確認イベント(v0.2.0 §9.7 を統合)

- 算定 golden test: 既知処方案件での算定照合(期待値は evidence_id 付きSSOTから。二次サイト数値の転記禁止)
- レセプト golden test: 記録条件仕様バリデーション+既知請求案件での照合
- 電子レセプト記録条件検証 / 受付・事務点検ASP確認(公式手順確認後)
- オンライン資格確認・電子処方箋の接続試験(ONS登録・サンドボックス — BLOCKED、REG-004)
- JAHIS 2次元シンボル読取互換確認(Ver.1.11)
- 既存レセコンとの並行稼働: 算定照合・レセプト照合・帳票照合・会計照合、差分許容範囲内であること
- LOCAL_ONLY / RECOVERY_SYNC 訓練、返戻・再請求シナリオ確認
- 薬剤師レビュー・請求実務者レビュー(REG-006 の担当割当)

## 4. 合格基準(骨格)

- golden test: 一致率100%(不一致は全件 triage、許容される差分は根拠付きで文書化)
- 並行稼働: 差分許容範囲【要確認・定量化】を超えないこと
- UAC: UIX-004 の合格条件(U4画面の状態誤認ゼロ等)
- Go/No-Go: go_no_go_checklist(OPS 系、WP-0010)の全項目

## 5. 記録

すべてのバリデーション結果は evidence(実行ログ・レビュー記録・照合表)として保存し、Go/No-Go 判定と監査に使えるようにする。
