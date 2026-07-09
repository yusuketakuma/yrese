# definition_of_ready — Definition of Ready

```yaml
ssot_id: PRC-003
title: Definition of Ready
domain: process
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §0.4
impacts: 全WP
open_questions: []
```

実装開始前に、すべての work package で以下を満たすこと。1項目でも欠ける場合は `BLOCKED_NOT_READY` とし、実装を開始しない。

## チェックリスト(v0.1.7 §0.4 全項目)

| # | 項目 | 判定基準 |
|---|---|---|
| 1 | 目的が1文で説明できる | WP title + 目的欄 |
| 2 | 対象ドメインが明確 | implementation_layer / domain 記載 |
| 3 | 変更してよい/禁止ファイルが明確 | allowed_files / forbidden_files 記載 |
| 4 | 公式資料または仕様根拠がある | ssot_refs が APPROVED、または R0-R2 でSSOT不要の理由明記 |
| 5 | evidence_id がある、または不要理由が明記 | 算定・請求・帳票・法令対応ロジックは必須(EVD未発行なら着手不可) |
| 6 | 受入条件がテスト可能 | テスト手順欄と対応 |
| 7 | ロールバック方法がある | git revert 単位 / migration は expand-migrate-contract |
| 8 | PHI/PII影響が評価済み | SEC-004 PIA 参照。fixtures は合成データのみ |
| 9 | 高リスク領域か判定済み | risk_level 記載(§39 の高リスク領域一覧と照合) |
| 10 | R3+ は opus4.8 事前レビュー完了 | レビュー記録 |
| 11 | UI/UX影響がある場合 UIX-001 に適合 | 画面は UIX-007 台帳に存在すること(台帳外画面の実装禁止) |
| 12 | オフライン影響がある場合 LOCAL_ONLY / RECOVERY_SYNC の扱いが定義済み | ARC-001 / ARC-002 参照 |
| 13 | 外部公的システム影響がある場合 Official Adapter 境界が定義済み | ADP-001 / ADP-002 参照 |
| 14 | 共通モジュール再利用チェック済み | 既存 packages/* で実現できる概念の再実装は COMMON_MODULE_DUPLICATION_BLOCKED |
| 15 | 実装者とレビュー者が分離されている(R3+) | AGT-014 参照 |

## 運用

- fable5 が WP 発行時にこのチェックリストを埋め、READY 判定する。
- 実装者は着手前に ssot_refs の status が APPROVED であることを自ら確認する(DRAFT/PROPOSED/STALE を根拠にした実装は禁止 — 現段階の PROPOSED 文書群は Phase 0 ゲートの人間レビューで一括承認予定。承認前に依存する実装は「骨格・型・ガード」の R0-R2 範囲に限る)。
