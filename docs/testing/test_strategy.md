# test_strategy — テスト戦略

```yaml
ssot_id: TST-001
title: テスト戦略
domain: testing
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §36, §8.6
depends_on:
  - QUA-001 quality_plan
  - QUA-002 validation_plan
  - UIX-002 experience_quality_baseline
open_questions:
  - E2E フレームワーク選定(Playwright 想定、Phase 1 で確定)
  - golden test 資産の管理場所(packages/fixtures 想定、fixture_policy と連動)
change_log:
  - 0.1.1 (2026-07-09): WP-4047 実装状態 drift 整備。CI ゲートの secret scan / dependency scan / SBOM 実装状態を WP-4009/a90df35・WP-4012/b0ecf84+702c2f5 に同期(テスト戦略要件は不変更)。
```

## 1. 大原則

- **本番個人情報をテストに使わない**。fixtures は合成データのみ(PHI scan を CI に追加予定)。
- golden test の期待値は **APPROVED SSOT(evidence_id 付き)由来のみ**。二次サイトの数値・モデルの記憶からの転記を禁止する。
- 「根拠不足で止まる」挙動自体をテストで固定する(実績: 算定骨格の空ruleset→BLOCKED、trace の evidenceRefs 必須 throw、events の PHI未暗号化拒否、tenant-context の本番起動拒否)。
- テストは実装者が書き、レビュー者が「テストが仕様を正しく固定しているか」を確認する。

## 2. 実装済みテスト資産(2026-07-09 時点、計55件+境界検査)

| パッケージ | 件数 | 固定している仕様 |
|---|---|---|
| @yrese/shared-kernel | 15 | branded ID 検証、5モード、PENDING系6status、isClaimable の請求遮断、BLOCKER種別、権限scope |
| @yrese/money | 11 | bigint ScaledDecimal 演算・丸めモード、float拒否 |
| @yrese/date-time | 8 | 実カレンダー検証(うるう年)、ClaimMonth 境界 |
| @yrese/trace | 6 | affectsClaim step の evidenceRef 必須、URL禁止、PHI排除形状 |
| @yrese/events | 7 | PHI≠none→encrypted 必須、hash形式、bigint clock |
| @yrese/contracts | 3 | health契約の受理・拒否 |
| @yrese/api | 5 | /health 契約、deny-by-default 403、本番起動拒否 |
| scripts/check-boundaries | CI | 依存方向・循環・重複const(違反注入で検出実証済み) |

## 3. テスト種別カタログ(v0.2.0 §36 全種別 → 状態)

| 種別 | 状態 / 予定 |
|---|---|
| 算定 golden / レセプト golden | 未着手 — evidence_id 発行後(CAL-001 の行単位解除と連動)。golden_test_catalog を作成 |
| マスター差分・有効日・公費/PMH組み合わせ・負担割合・丸め | 未着手 — masters/calculation 実装と同時にWP化 |
| QR読取 / 電子処方箋 / オン資 / PMH / JAHIS互換 / 外部API contract | BLOCKED(公式仕様・ONS) — Adapter 実装WPに同梱 |
| UI workflow / medical safety UI / keyboard / accessibility / error state / offline UI | 未着手 — E2E基盤(Phase 1)で導入。受入条件は UIX-004 |
| performance budget / perceived performance / latency regression | 未着手 — UIX-003 の候補値をテスト化 |
| usability heuristic / first-run / manual-less / error recovery / recovery sync UX / warning fatigue | 人間参加型 — UAC-01〜12 の検証方法に従う |
| 法令適合性 / 帳票保存性 / 監査証跡 | 該当実装WPで必須化(evidence_id・ハッシュ・再出力) |
| オフラインモード / 復旧後同期 / 競合解決 / Edge故障 / Cloud停止 / 外部停止 | ARC-001/002 のマトリクスをテストケース化(バックエンド実装と同時) |
| Blue/Green deployment / DB migration rollback | インフラWP(Phase 1 以降) |
| セキュリティ / tenant isolation / audit log tamper / backup restore / BCP rehearsal | SEC-006 の isolation test 5種を CI 必須ゲート化(DB導入時) |

UIX-002 の必須テスト14種(§8.6)は上表の該当行に統合済み。

## 4. CI ゲート

現行: typecheck / unit test / build(全ワークスペース) / check:boundaries / check:openapi / check:ssot-index / check:secrets(WP-4009/a90df35) / check:deps(WP-4012/b0ecf84) / check:sbom(WP-4012/b0ecf84+702c2f5)。
追加予定(SSOT承認と実装進行に応じて): duplicate schema scan / fixtures PHI scan / isolation tests / golden tests / E2E / performance budget。

## 5. golden test 運用ルール

1. 期待値の出所は evidence_id 付きSSOT(CAL/CLM)のみ。出所のない期待値を書いたテストはレビューで CHANGES_REQUESTED。
2. 1ケース = 1既知案件(合成データ)+ 期待点数・期待負担金・期待レコード列。
3. マスター版・算定ルール版・処方日/調剤日/請求月を明示入力(同一入力→同一出力の決定性を全ケースで検証)。
4. 改定時は新旧両版のケースを併存させる(当時有効版の選択ロジックを固定)。
5. 不一致は「テストを直す」前に SSOT_UPDATE_REQUIRED として fable5 が原因を判定する。
