# jahis_character_encoding_policy — JAHIS文字コードポリシー

```yaml
ssot_id: JHS-006
title: JAHIS文字コードポリシー
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


## 原則

- 内部表現は UTF-8(TypeScript string)。**Shift-JIS 等の外部符号は Official Adapter 境界内でのみ扱い、内部へ持ち込まない**。
- 参考実測(CLM-002): レセプト記録仕様は JIS X 0201-1976 8単位符号 + JIS X 0208-1983 附属書1 シフト符号化表現(シフトJIS)、区切りコンマ(2C)・レコード区切り CR LF(0D 0A)・EOF(1A)。JAHIS 各仕様の文字符号規定は**本文入手後に仕様ごとに確定**する(推測禁止)。

## 必須規律

- 変換不能文字(UTF-8→Shift-JIS 外字等)は**無言の置換をしない**: 取込側は保持+警告、出力側はエラー(請求・交付文書に「?」等が混入する事故を防ぐ)
- 機種依存文字・外字の扱いは仕様ごとに evidence 付きで定義
- 半角カナ(JIS X 0201 片仮名)の許容範囲は仕様規定に従う
- BOM 禁止/許容、改行コード、EOF の扱いを Adapter ごとに宣言しテストで固定
- エンコーディング検証は invalid file test(JHS-005)の必須項目

## 実装配置

- 変換ユーティリティは Adapter パッケージ内(汎用 shared へ置かない — MOD-002 の「Adapter固有処理を汎用sharedへ混ぜない」原則)
