# jahis_conformance_test_plan — JAHIS適合テスト計画

```yaml
ssot_id: JHS-005
title: JAHIS適合テスト計画
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


## テスト体系(3種、TST-001 と統合)

| 種別 | 内容 | 合格条件 |
|---|---|---|
| golden file test | 仕様添付サンプル・自作合成サンプル(仕様準拠)を入力し、期待どおりの構造化結果を得る | 期待値と完全一致(期待値は仕様本文 evidence 由来のみ) |
| invalid file test | 文字コード違反・レコード順違反・必須欠落・コード表外値・分割シンボル欠落等の**違反ファイル**を入力 | 安全に拒否(取込ゼロ、部分取込なし、エラー理由がユーザー提示可能) |
| round-trip test | 出力系 Adapter で 内部モデル→JAHIS形式→内部モデル の往復 | 意味的等価(JHS-008 の等価定義に従う) |

## 共通規律

- fixture は**合成データのみ**(MOD-013。PHI混入禁止 — 仕様添付サンプルに実在名がある場合は置換)
- テスト名に対象仕様の版と evidence_id を含める
- conformance test は CI で常時実行し、仕様版更新時は旧版テストを残して新版テストを追加(当時有効版の検証を維持)
- 適合判定(JHS-002)には全3種のパスが必須

## 未確定(【要確認】)

- 2Dシンボル分割・連結パターンの網羅基準(仕様本文入手後に確定)
- JAHIS 側の公式適合性確認制度の有無(存在すれば優先)
