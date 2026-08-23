# jahis_roundtrip_test_policy — JAHIS round-trip テストポリシー

```yaml
ssot_id: JHS-008
title: JAHIS round-trip テストポリシー
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


## 目的

出力系 JAHIS Adapter(お薬手帳出力・薬歴連携出力等)が、内部モデル→JAHIS形式→内部モデル の往復で情報を失わない・改変しないことを機械的に保証する。

## 等価の定義

- **意味的等価**: 医療上・請求上の意味が変わらないこと。以下は等価違反とする:
  - 医薬品・用法・数量・日数・患者識別子のいずれかの欠落・改変
  - コードの別コードへの置換(同義でも CodeMappingRegistry の根拠なしは違反)
  - 文字化け・変換不能文字の無言置換(JHS-006)
- 許容差: 仕様上意味を持たない空白・パディング・項目順(仕様がレコード順を規定する場合は順序も等価条件に含める)

## 規律

- 取込専用 Adapter(2Dシンボル読取)は逆方向生成を実装しないため round-trip 対象外 — 代わりに「同一入力の再取込冪等性」テストを課す
- round-trip fixture は合成データのみ、仕様版ごとに管理
- 失敗時は Adapter 実装ではなく**まず仕様解釈を疑い** SSOT_UPDATE_REQUIRED として fable5 へ返す(勝手にテスト緩和しない)
