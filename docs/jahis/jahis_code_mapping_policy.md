# jahis_code_mapping_policy — JAHISコードマッピングポリシー

```yaml
ssot_id: JHS-007
title: JAHISコードマッピングポリシー
domain: jahis
status: PROPOSED
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
approved_at: null
approved_by: null
effective_from: null
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
  - "0.1.1 2026-08-23 WP-6203: 昇格 batch 準備 — owner を codex_root へ移管、23 field を補完、2次元シンボルの版認識を Ver.1.11 実在確認済み(REG-007 §7)へ統一(WP-6202)。本文 semantics は不変。status は PROPOSED のまま(review と human approval 待ち)"
```


## 原則

- 「JAHISコード」という単一コード体系は存在しない(v0.2.0 §22)。JAHIS 各仕様が参照するコード表(用法コード、医薬品コード指定等)は**仕様ごとに** MST-002 CodeMappingRegistry の code_system として登録する。
- コード変換は必ず CodeMappingRegistry 経由。Adapter 内のハードコード変換表を禁止する。
- 曖昧一致で請求コード・医薬品コードを決定しない。曖昧な変換は `CODE_MAPPING_REVIEW_REQUIRED`。

## JAHIS由来コード表の登録要件

- code_system 名は仕様名+版で一意化(例: jahis_2d_v1.11_youhou)
- 各マッピング行に evidence_id(仕様本文の該当箇所)・valid_from/valid_to・mapping_confidence を必須付与
- 仕様版更新時は旧 code_system を残し新設(当時有効版対応)
- 2Dシンボル取込では、コード解決に失敗した項目を**手入力補正キューへ**回し、自動補完しない(v0.2.0 §26)

## 未確定

- 各仕様のコード表実体(本文入手後に登録。推測登録禁止)
