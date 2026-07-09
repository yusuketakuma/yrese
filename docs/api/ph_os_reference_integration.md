# ph_os_reference_integration — PH-OS リファレンス連携方針

```yaml
ssot_id: API-004
title: PH-OS を公開 API の最初のリファレンス利用者とする方針
domain: api
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §14(API-first dogfooding / PH-OS / OSS), PRD-006(柱4), PRD-009(戦い4)]
depends_on: [API-002, API-003]
impacts: [WP-0036(Integration Hub), API-005]
```

## 1. 目的と結論

公開 API の品質は、実利用者が本番業務で使って初めて証明される。

**結論: PH-OS を公開 API の最初のリファレンス利用者(reference integration)と
位置づけ、公開 API の実用性を dogfooding とは別の外部視点で継続検証する。**

## 2. 原則

1. **特別扱い API を作らない**: PH-OS 専用のエンドポイント・専用フィールド・専用認可を
   設けない。PH-OS が使うのは API-003 の公開 API と @yrese/contracts の公開契約のみ。
   **PH-OS が使えない API は他社パートナーも使えない**とみなし、契約側の欠陥として扱う。
2. **同一の onboarding**: PH-OS の接続手順(API キー発行・scope 付与・sandbox)は
   将来のパートナーと同一とする。Integration Hub(WP-0036)の Partner Sandbox /
   Contract Test Kit の最初の通過者を PH-OS とする。
3. **非対称な依存の禁止**: yrese コアが PH-OS の存在・仕様に依存してはならない
   (依存方向は常に PH-OS → 公開 API の一方向)。PH-OS 都合の変更要望も
   CONTRACT_CHANGE_REQUEST 手順を通す。

## 3. フィードバックループの運用

1. PH-OS 側の接続で発見された契約の不足・不整合は、CONTRACT_CHANGE_REQUEST として
   起票し、該当契約 SSOT の改版(PRC-007)で解消する。口頭・非公式チャネルでの
   契約変更合意は無効とする。
2. 発見された欠陥と解消の記録は State.md / 該当 SSOT の変更履歴に残し、
   「リファレンス利用者で検証済み」を公開 API の品質根拠(QUA-007 の L4 系)として使えるようにする。
3. PH-OS 検証を通過していない契約バージョンを「検証済み」と対外表示しない(fail-closed)。

## 4. 停止条件(fail-closed)

- PH-OS 専用の抜け道 API・特別 scope の実装 → API_CONTRACT_BLOCKED(API-002 §2-2 と同一)
- コア側から PH-OS 仕様への依存の混入 → 実装せず本 SSOT へ差し戻し
- 未検証契約の「検証済み」表示 → BLOCKED(QUA-008 の証拠なき品質主張の禁止と同型)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §14 へ修正)。
- 0.1.0 (2026-07-09): 初版起草(WP-0046)。
