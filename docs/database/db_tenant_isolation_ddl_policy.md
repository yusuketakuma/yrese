# db_tenant_isolation_ddl_policy — テナント分離 DDL 方針

```yaml
ssot_id: DB-003
title: テナント分離の DDL・クエリ方針
domain: database
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - codex (実装可能性)
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - docs/plan/database_construction_plan.md(PLAN-DB-001 §3)
depends_on: [PLAN-DB-001, DB-001, SEC-006(テナント分離設計の正本), SEC-008(§2-4 テナント越え監査), MOD-013(fixture)]
impacts: [WP-5002以降の全DB実装, apps/api Repository層]
blockers:
  - BLOCKED_SECURITY_REVIEW: RLS 等 DB 層分離の採用確定はセキュリティレビュー完了後(SEC-008 §3)
```

## 1. 目的と位置づけ

テナント分離の設計正本は SEC-006。本書はその DB 実装(DDL・クエリ・権限)の方針を定める。
**正はアプリ層の deny-by-default**(requirePermission + テナント文脈拘束)であり、
DB 層の分離は多層防御の「追加」として評価する — DB 層があるからアプリ層を緩めることはしない。

## 2. DDL 方針

- 全業務テーブルに `tenant_id` + `pharmacy_id` を必須付帯(DB-001 §3)。
  **例外は次の列挙のみ**: テナント台帳自身・システム全体のマスター(M1〜M8 の配布値そのもの)・
  スキーマ適用履歴(DB-002)。例外の追加は本 SSOT の改版による。
- 業務テーブルの主要インデックス・一意制約は `(tenant_id, pharmacy_id, …)` を先頭に含め、
  テナント越えの一意性を意図しない限りテナント内一意として定義する。
- **RLS 追加可能な構造を保つ**: テナントカラムの型・命名を全テーブルで統一し、
  将来 Row Level Security を有効化する際に DDL の作り直しが要らないようにする。
  RLS の採用確定自体は BLOCKED_SECURITY_REVIEW(SEC-008 §3 の前提条件充足後)。

## 3. クエリ・Repository 層の規約

- Repository のあらゆる読み書きはテナント文脈(tenantId + pharmacyId)を**引数で必須**とし、
  WHERE 句で常に拘束する(現行 in-memory 実装の listByDate / findById と同型)。
- テナント文脈なしの全件クエリ API を作らない。集計・KPI(QUA-009 系)もテナント文脈から出発する。
- 継続トークン(cursor)・冪等性キーの一意性境界もテナント文脈に拘束する(API-001/006 で確立済みの規律)。

## 4. テナント越え操作

- テナント越えの読み書きは当社特権操作のみとし、**操作自体を監査イベントにする**(SEC-008 §2-4)。
  break-glass の規律(SEC-008 §4: businessReason・事後レビュー・監査不能時は実行しない)に従う。
- 特権操作用の DB ロール/接続はアプリ通常系と分離し、**通常系の接続からはテナント越えが
  権限的に不可能であることを要件とする**(努力目標ではない — テナント越えは SEC-006 で critical)。
  具体の権限設計(GRANT/ロール構成)は WP-5002 実装レビューで確定し、確定までは
  テナント越えを伴う機能の実装を開始しない(DoR)。

## 5. 環境分離と fixture

- **dev / test / CI に本番 PHI を投入しない**(MOD-013: fixture は完全合成データのみ)。
- 本番データを使う調査・検証はコピー環境でも PHI 規律(SEC-004)を維持し、持ち出しを監査する。

## 6. 停止条件(fail-closed)

- テナント文脈なしの業務クエリ API → 実装禁止
- DB 層分離を根拠にアプリ層検査を省略 → 実装禁止(多層防御の逆転)
- 例外列挙外のテナントカラム省略 → SSOT_UPDATE_REQUIRED
- 本番 PHI の dev/test 投入 → 禁止(インシデント手順 QUA-005)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(§4 テナント越え不可を努力目標から要件へ格上げ、権限設計確定までの DoR を明記)。
- 0.1.0 (2026-07-09): 初版起草(WP-5001)。
