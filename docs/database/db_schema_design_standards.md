# db_schema_design_standards — スキーマ設計規約

```yaml
ssot_id: DB-001
title: データベーススキーマ設計規約
domain: database
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - codex (実装可能性)
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-10
amended_by: [ARC-008]
amendment_status: PENDING_REVISION
amendment_note: "ARC-008(APPROVED 2026-07-10)により改版予約中。方向は ARC-008 が暫定的に優先する。本文の全面改版は Phase 1 の PRC-007 10段フローで実施し本注記を解除する。"
source_refs:
  - docs/plan/database_construction_plan.md(PLAN-DB-001 §3 横断原則)
depends_on: [PLAN-DB-001, SEC-006, MOD-010, MOD-011, MOD-004(shared_type_registry), MOD-005(status_registry), DOM-002, DOM-003(ubiquitous_language)]
impacts: [WP-5002(マイグレーション基盤), WP-5003以降の全DB実装]
open_questions:
  - ID の物理表現(UUID v7 か ULID か等)は WP-5002 の実装可能性レビューで確定
```

## 1. 目的

PLAN-DB-001 §3 の横断原則を、テーブル・カラム設計の規約として確定する。
本規約は全 DB 種別(業務 OLTP・イベントストア・監査・マスター等)に適用する。
特定 DB 製品を前提にしない(PostgreSQL 系を第一候補として例示するが、確定は独立ゲート)。

## 2. 命名規約

- テーブル名・カラム名は snake_case。テーブル名は複数形(patients / reception_entries)。
- 予約語・略語の独自発明を避け、ubiquitous_language(DOM-003)の用語に対応させる。
- 外部キーは `<参照先単数形>_id`(patient_id)。複合語は省略しない(prescription_id を presc_id にしない)。

## 3. 必須カラム方針

- **全業務テーブルに `tenant_id` と `pharmacy_id` を必須付帯**(SEC-006。例外はテナント自身の台帳等、DB-003 で列挙)。
- 作成・更新メタ(`created_at` / `updated_at` 等)は**アプリ供給のタイムスタンプのみ**。
  DB の `now()` / `CURRENT_TIMESTAMP` を DEFAULT としてビジネス的意味のあるカラムに使わない
  (暗黙の現在時刻禁止 — MOD-011)。DB 内部の技術メタ(レプリケーション等)はこの限りでない。
- 相関 ID(`correlation_id`)の必須境界は MOD-008/009 が正本であり、本書で要否を再定義しない。
  MOD-008/009 が必須とするイベント・監査系の永続化テーブルでは必須カラムとする。

## 4. 型規約

| 対象 | 規約 |
|---|---|
| 金額・点数 | 整数系のみ(BIGINT / NUMERIC(…, 0))。**浮動小数点カラム(REAL/DOUBLE)禁止**(MOD-010)。スケールは @yrese/money の ScaledDecimal 表現(係数+scale)と一致させる。**可変 scale の ScaledDecimal を永続化する場合は scale を随伴カラム等で保持し、係数だけを保存して scale を失う実装を禁止**(保持方式は WP-5002 で確定。MVP の永続対象 Yen / Points は scale 0) |
| 暦日(処方日・調剤日・受付日等) | DATE(タイムゾーンなしの暦日 — MOD-011 の CalendarDate と一致)。日時が必要な場合のみ TIMESTAMPTZ(UTC 保存) |
| ID(branded ID 対応) | 文字列(TEXT/VARCHAR)または UUID。アプリ層の branded ID(MOD-004)と 1:1 対応し、DB 側で別体系の連番を業務 ID にしない |
| enum 相当 | §5 に従う |
| JSON | 契約・スキーマで形状が固定できない拡張データのみ。業務判断に使う値を JSON に埋めない(fail-closed に検索・制約できないため) |

## 5. enum の写像(二重実装禁止の DB 版)

- 状態・種別の値の正本は shared-kernel / 各 SSOT 台帳(MOD-005 等)。
  **DB 側に独自の enum 型・独自の値集合を定義しない。**
- 写像方法は CHECK 制約(値リストは正本から生成)または参照テーブル(値を正本から同期)とし、
  いずれもマイグレーションで正本の改版に追従する(改版なしの値追加は violation)。
- 未知の値は拒否する(fail-closed)。「その他」カラムで吸収しない。

## 6. NULL・状態の方針

- 業務状態を NULL の有無で表現しない(状態は明示値 — PENDING 系ステータスの規律と同型)。
- NULL を許すのは「業務的に未発生」が明確なカラムのみ(例: 取消前の cancelled_at)。
- 3段階マイグレーション(DB-002 §4)完了後は NOT NULL を原則とする。

## 7. 制約・整合性

- 一意性・参照整合性は可能な限り DB 制約で表現する(アプリ検証と多層防御)。
- 冪等性キー等の一意性境界は契約 SSOT の定義(例: API-006 の (tenant_id, pharmacy_id, idempotency_key))と一致させる。
- append-only テーブル(監査・会計台帳・確定レセプト)の UPDATE/DELETE 禁止は DB-004・SEC-008 に従い、権限(DCL)でも禁止する。

## 8. 停止条件(fail-closed)

- 浮動小数点の金額・点数カラム → 実装禁止(レビューで自動 CHANGES_REQUESTED)
- DB now() のビジネスカラム DEFAULT → 実装禁止
- shared-kernel 正本にない状態値の DB 定義 → COMMON_MODULE_DUPLICATION_BLOCKED
- tenant_id / pharmacy_id を欠く業務テーブル → SSOT_UPDATE_REQUIRED(例外は DB-003 の列挙のみ)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(depends_on に DOM-003 追加、ScaledDecimal の scale 保持規定、correlation_id の必須境界を MOD-008/009 正本へ委譲)。
- 0.1.0 (2026-07-09): 初版起草(WP-5001)。
