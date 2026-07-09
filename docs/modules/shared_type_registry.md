# shared_type_registry — 共有型レジストリ

```yaml
ssot_id: MOD-004
title: 共有型レジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §0.0.3.7
depends_on:
  - packages/shared-kernel(9ab039e)
  - packages/money(533f89a)
  - packages/date-time(ab234fe)
  - packages/trace(ddc06a1)
  - packages/events(85bd3aa)
  - packages/calculation(d26424d)
open_questions:
  - 保険・公費・PMH 関連の共通型(現状 opaque Ref のみ — Phase 1 ドメインSSOT承認後に拡充)
blockers: []
change_log:
  - 0.1.2 (2026-07-09): branded ID を実装12種へ同期(ReceptionId 追加 — WP-3009-BE/93aefa1。台帳更新漏れの是正、opus4.8 DOM レビュー指摘)。
  - 0.1.1: WP-4022 で PrescriptionDate / DispensingDate / ReceptionDate を nominal brand 済みに更新し、異種代入・異種 compare を型で禁止。
```

**現在の正本は実装コードである。** 本レジストリは実装済み型の索引と変更手順を定める。型の追加・変更は「本SSOT改版 → レビュー(owner表 AGT-009 準拠)→ 実装」の順で行い、コード先行の型追加を禁止する(発見時は `SSOT_UPDATE_REQUIRED`)。

## 1. branded ID 型(@yrese/shared-kernel)

`Brand<string, B>`(unique symbol brand)+ 検証付き factory(空文字・空白のみ・制御文字を拒否)。

TenantId / PharmacyId / UserId / PatientId / ReceptionId / PrescriptionId / DispensingId / ClaimId / EventId / DeviceId / EvidenceId / WorkPackageId(12種 — ReceptionId は WP-3009-BE/93aefa1 で追加)

## 2. 値オブジェクト

| 型 | パッケージ | 要点 |
|---|---|---|
| ScaledDecimal | @yrese/money | bigint 係数+scale。string/整数からのみ構築(非整数 number 拒否)。add/subtract/multiply/compare/round/equals |
| Yen / Points | @yrese/money | 整数(bigint)。ScaledDecimal へ変換可 |
| CalendarDate | @yrese/date-time | 'YYYY-MM-DD' または {year,month,day} からのみ構築。実カレンダー検証(うるう年含む) |
| PrescriptionDate / DispensingDate / ReceptionDate | @yrese/date-time | CalendarDate ラッパー(nominal brand 済み — 異種代入・異種 compare を型で禁止) |
| ClaimMonth | @yrese/date-time | 'YYYY-MM'。next()/prev()、CalendarDate からの導出 |

## 3. trace 型(@yrese/trace)

| 型 | 要点 |
|---|---|
| EvidenceRef | evidenceId + sourceType('law'/'notification'/'official_spec'/'master'/'guideline'/'jahis'/'internal_ssot')+ title + version? + effectiveFrom?。**url は型(never)と実行時の双方で禁止**(URLは source_registry 管理) |
| CalculationInputsSummary | ids / dates / masterVersions / ruleVersions のみ(型設計で PHI 排除 — 氏名等のフィールドを持たない) |
| CalculationTraceStep | stepId / description / affectsClaim / evidenceRefs / inputRefs / output。**affectsClaim=true → evidenceRefs≥1 を実行時強制** |
| CalculationTrace / LegalTrace | createCalculationTrace / createLegalTrace factory 経由でのみ生成(immutable、evidenceIds 自動集約) |

## 4. イベント型(@yrese/events)— 詳細は MOD-009

## 5. 算定型(@yrese/calculation)

CalculationRequest(branded ID+診療系日付+claimMonth+masterVersion+calculationRuleVersion。保険・公費は opaque な InsuranceSnapshotRef / PublicExpenseRef)/ CalculationRule(ruleId+evidenceRefs+apply)/ CalculationResult('BLOCKED' | 'CALCULATED' 判別 union)。

## 6. 変更手順

1. 提案者(実装中の発見は `SSOT_UPDATE_REQUIRED` で fable5 へ)
2. fable5 が本SSOTを改版(change_log 記録)
3. AGT-009 owner 表のレビュー(型は fable5+opus4.8)
4. WP 発行 → 実装 → 本SSOTの status を IMPLEMENTED へ
5. 重複定義の検知は check-boundaries.mjs(MOD-003)+ コードレビュー
