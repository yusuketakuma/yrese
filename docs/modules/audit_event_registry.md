# audit_event_registry — 監査イベントレジストリ

```yaml
ssot_id: MOD-008
title: 監査イベントレジストリ
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.3, §34
depends_on:
  - docs/security/audit_log_design.md(SEC-007 — 構造・保全・アクセス制御の正)
  - packages/events(85bd3aa — 基底 EventEnvelope)
open_questions:
  - auditEventType の命名確定(下記候補は SEC-007 初期セット由来 — WP-2003 実装前に opus4.8 レビューで確定)
  - 保存期間(REG-003 の法定根拠確定待ち — SEC-007 と同期)
blockers: []
```

**分担**: SEC-007 = 監査ログの構造・保全・アクセス制御 / 本レジストリ = **イベント種別の台帳**。イベント種別の追加はレジストリ経由のみ — コード内のローカル追加は `COMMON_MODULE_DUPLICATION_BLOCKED`。

**実装状態: 未着手。** 実装は WP-2003(`packages/audit`(仮)+ apps/api 配線)で行い、着手条件は本SSOTの APPROVED。

## 1. イベント種別候補(SEC-007 必須記録操作の初期セットの台帳化)

| 種別候補(kind.action) | 対象操作 | outcome必須 | 備考 |
|---|---|---|---|
| patient.viewed / patient.created / patient.updated / patient.deleted | 要配慮情報アクセス・CRUD | ○ | viewed は要配慮情報アクセス記録 |
| insurance.viewed / insurance.updated | 保険・公費情報 | ○ | public-expense を含む【要確認 — 分離要否】 |
| prescription.created / prescription.updated | 処方入力 | ○ | |
| dispensing.confirmed | 薬剤師確認 | ○ | actor は薬剤師(人間責任の明示) |
| inquiry.recorded | 疑義照会記録 | ○ | |
| calculation.finalized / calculation.recalculated | 算定確定・再計算 | ○ | trace 参照(calculation_trace 保存とセット) |
| checkout.finalized / checkout.refunded | 会計確定・返金 | ○ | |
| report.printed / report.reprinted | 帳票出力・再出力 | ○ | 出力時点の版・ハッシュは帳票側証跡(§20)と連動 |
| claim.checked / claim.closed / claim.locked / claim.receipt_exported | 請求前点検・月次締め・ロック・レセプト出力 | ○ | `claim:finalize` scope 操作 |
| master.approved / master.applied / master.rolled_back | マスター承認・適用・ロールバック | ○ | MST-001 パイプラインと連動 |
| permission.changed / account.issued / account.suspended | 権限変更・アカウント発行停止 | ○ | |
| auth.login / auth.logout / auth.failed | 認証 | ○ | failed は連続失敗の検知対象 |
| breakglass.used | break-glass 使用 | ○ | 事後レビュー必須(SEC-007) |
| support.session.started / support.session.ended / support.operation | サポートセッションと全操作 | ○ | §9.2 リモートサポート監査 |
| data.exported / data.returned | エクスポート・データ返却 | ○ | OPS data governance と連動 |
| config.changed | 設定変更 | ○ | |
| edge.registered / edge.revoked | Edge 登録・失効 | ○ | SEC-005 |
| sync.conflict.detected / sync.conflict.resolved | 同期競合と人間裁定 | ○ | resolved の actor は人間(CONFLICT_REQUIRES_HUMAN_REVIEW) |

## 2. 種別定義の必須属性(実装時)

kind.action 名 / 説明 / 対象 targetRef の kind / outcome(success・denied・failed)/ phiClassification 既定値 / 発火箇所(API・ジョブ・Edge)/ 関連 scope。デバッグログとの分離(§9.6)と PHI 非搭載(targetRef は ID 参照のみ)は SEC-007 の構造規約に従う。

## 3. 変更手順

1. 新規操作の実装WPの DoR で「監査イベント種別が本台帳に存在すること」を要求
2. 不足時は本SSOT改版 → opus4.8 レビュー(監査は高リスク領域)
3. 実装(registry モジュールへ追加 — 将来 `packages/audit`)
4. 台帳にない種別のイベント発火をテスト・レビューで禁止
