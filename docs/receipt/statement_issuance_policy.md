# statement_issuance_policy — 調剤明細書交付ポリシー

```yaml
ssot_id: RCP-004
title: 調剤明細書交付ポリシー
domain: receipt
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-12
approved_at: 2026-07-09
approved_by: opus4.8レビュー(APPROVE_WITH_CHANGES)全指摘反映後、fable5承認(人間の包括承認範囲内)
effective_from: null
effective_to: null
source_refs: [構築プロンプト v0.2.0 §0.0.4.5, CAL-003(evidence_register), CLM-001(claim_scope_matrix)]
depends_on: [RCP-001(概念分離), RCP-005, RCP-006]
impacts: [WP-2202, WP-3101]
related_work_packages: [WP-0034, WP-2202, WP-3101, WP-9002-W13]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文§6変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-12 WP-9002-W13 metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - 明細書無償交付義務の根拠規定・例外(正当な理由)の範囲【要確認: 療担規則・関連通知の精読 → evidence_id 発行。条文番号の推測記載は禁止】
  - 支払額0円(公費等)の場合の明細書発行要否【要確認: 公式通知 — v0.2.0 明示の要確認事項】
  - 明細書の法定記載事項・様式【要確認: 記載要領精読】
blockers:
  - 上記【要確認】の解消(evidence_id 発行)まで、明細書の法定要件に関わる実装判断を凍結
```

## 1. 位置づけ

調剤明細書(StatementDocument)は、療養の給付に係る費用の**算定基礎となった項目を示す文書**であり、
領収証(支払事実)とは独立の文書である(RCP-001 の概念分離)。

- 明細書の内容は算定結果(CalculationTrace 付き)から生成する。入金の有無に依存しない。
- 明細書に記載する項目・点数は evidence_id 付き算定結果のみを用いる(根拠なし項目の記載禁止)。

### 1.1 ライフサイクル(opus4.8 指摘反映・fable5決定)

- StatementDocument は**状態機械を持たない**。出力時点の calculation_trace から再生成可能な成果物として扱う(ACC-001 §3 / ACC-006 注記と整合)。
- 無効化・差替は**交付履歴への void 記録**で表現する(文書レコードの状態遷移ではなく履歴の追記)。
- **算定訂正後の再交付**: 新しい calculation_trace から明細書を再生成し、旧交付の void 記録+再交付履歴を残す。旧交付文書の保存自体は維持する(見読性・保存性)。

## 2. 交付の基本設計

- 会計時に領収証とセットで交付するフローを既定とする(画面導線は WP-3101)。
- **明細書交付不要の申し出**: 患者からの申し出を記録し(申出日時・記録者)、以後の交付を抑止できる。申し出はいつでも撤回可能。申出の法的位置づけ・掲示要件は【要確認】。
- **0円時の発行要否**: 公費等で患者支払額が0円の場合の明細書発行要否は【要確認: 公式通知】。確認まで、システムとしては「発行可能・既定ON」で設計し、運用設定で調整できる形とする(発行しない選択が法令違反にならないことの確認が先)。

## 3. 代理人交付

- 代理人への交付時は RCP-006 のプライバシー確認手順(本人同意の確認・代理人区分の記録)を必須とする。
- 明細書は処方内容を含むため、領収証よりも高いプライバシー配慮を要する(v0.2.0 §0.0.4.5)。

## 4. 交付履歴・保存

- 交付履歴(交付/不交付+不要申出の別、日時、交付者、受領者区分)を記録する。
- 出力時点の保存項目は RCP-005 に従う(calculation_trace・マスター版・算定ルール版・テンプレート版・hash 等)。
- 再出力時は出力者・理由・hash を記録する(見読性・真正性)。

## 5. 禁止事項

- 算定根拠(evidence_id / calculation_trace)のない項目を明細書に記載すること
- 仮算定(POINTS_ONLY_COPAY_BLOCKED / PROVISIONAL_CALCULATION)の結果を確定明細として交付すること
- 不要申出の記録なしに交付を省略すること

## 6. 変更履歴

- 0.2.0 (2026-07-09): ライフサイクル明記(状態機械なし・trace再生成・void交付履歴・算定訂正後の再交付手順)。APPROVED 化。
- 0.1.0 (2026-07-09): 初版(WP-0034)。
