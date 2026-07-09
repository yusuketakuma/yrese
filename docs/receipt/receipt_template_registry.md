# receipt_template_registry — 領収証・明細書テンプレート版管理

```yaml
ssot_id: RCP-005
title: 領収証・明細書テンプレート版管理
domain: receipt
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
source_refs: [構築プロンプト v0.2.0 §0.0.4.5, v0.2.0 §20(帳票・電子保存)]
depends_on: [RCP-001, RCP-004, REG-003(e-文書法・保存期間は legal_compliance_matrix 参照)]
impacts: [WP-2202, packages/reports(将来), CAL-008(trace schema)]
open_questions:
  - 電子保存の運用管理規程の策定(REG-003 と同期)【要確認】
  - テンプレートの薬局別カスタマイズ許容範囲(ロゴ・文言)【要確認: 実務レビュー】
blockers: []
```

## 1. テンプレート版管理

- 領収証・調剤明細書のテンプレートは版管理し(template_id + version)、**発行済み文書がどのテンプレート版で出力されたかを恒久記録**する。
- テンプレート変更は change control(QUA-003)対象。法定記載事項に関わる変更は opus4.8 + 人間レビュー。
- 旧テンプレート版は、当該版で発行済み文書が存在する限り削除しない(再出力の見読性保証)。

## 2. 出力時点の保存項目(必須)

発行・再発行・再出力の都度、以下を保存する(v0.2.0 §0.0.4.5 の全項目)。

```text
計算結果 / calculation_trace / マスター版 / 算定ルール版 / 帳票テンプレート版
出力者 / 出力日時 / pharmacy_id / tenant_id / receipt_document_id
hash / reissue_reason(再発行時) / cancel_reason(取消時)
```

- hash は文書内容の改ざん検知に用いる(sha-256、@yrese/events の形式規約と整合)。
- calculation_trace の保存により、出力後にマスター・ルールが改版されても**出力時点の算定根拠を再現可能**にする(v0.2.0 §20「出力時点の算定根拠保存」)。

## 3. 電子保存(真正性・見読性・保存性)

- e-文書法3原則への対応方針・保存期間は REG-003(legal_compliance_matrix)を正本とし、本書はテンプレート・出力物の観点のみ扱う。
- 再出力は元文書の複製として hash・出力者・理由を記録し、原本と区別可能にする。
- 廃棄は保存期間確認+廃棄証跡(OPS-010 data_governance_policy)に従う。

## 4. 変更履歴

- 0.2.0 (2026-07-09): opus4.8 レビュー通過(本書への個別指摘なし)に伴う承認化。APPROVED 化。
- 0.1.0 (2026-07-09): 初版(WP-0034)。
