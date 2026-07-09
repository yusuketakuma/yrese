# audit_event_registry — 監査イベントレジストリ

```yaml
ssot_id: MOD-008
title: 監査イベントレジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §34
depends_on:
  - docs/security/audit_log_design.md(SEC-007 — 構造・保全・アクセス制御の正)
  - packages/events(85bd3aa — 基底 EventEnvelope)
open_questions:
  - 保存期間(REG-003 の法定根拠確定待ち — SEC-007 と同期)
change_log:
  - 0.2.0 (2026-07-09) opus4.8 命名レビュー(CHANGES_REQUIRED)反映 — 文法正式化・会計taxonomy統合(checkout.* supersede)・欠落3種追加・実装時必須2点。命名確定済み、WP-2003 解禁。
blockers: []
```

**分担**: SEC-007 = 監査ログの構造・保全・アクセス制御 / 本レジストリ = **イベント種別の台帳**。イベント種別の追加はレジストリ経由のみ — コード内のローカル追加は `COMMON_MODULE_DUPLICATION_BLOCKED`。

**実装状態: 未着手。** 実装は WP-2003(`packages/audit`(仮)+ apps/api 配線)で行い、着手条件は本SSOTの APPROVED。

## 0. 命名文法(確定 — opus4.8 レビュー 2026-07-09)

`auditEventType = <domain>.<resource?>.<action>`(ドット区切り・snake_case・action は過去分詞/完了形)

- **resource セグメント**: 単一リソースのドメインでは省略可(例: `patient.viewed`)。複数リソースを持つドメイン(会計等)では**必須**(例: `accounting.payment.received`)。
- 3セグメント形は例外ではなく規範(`support.session.started` / `sync.conflict.detected` は本文法に適合)。
- この文法はパース・索引・前方一致フィルタの**構造契約**であり、変更は本SSOTの breaking 改版+opus4.8 レビューを要する。

## 1. イベント種別台帳(SEC-007 必須記録操作の初期セット)

| 種別(文法準拠) | 対象操作 | outcome必須 | 備考 |
|---|---|---|---|
| patient.viewed / patient.created / patient.updated / patient.deleted | 要配慮情報アクセス・CRUD | ○ | viewed は要配慮情報アクセス記録 |
| insurance.viewed / insurance.updated | 保険・公費情報 | ○ | public-expense を含む【要確認 — 分離要否】 |
| prescription.created / prescription.updated | 処方入力 | ○ | |
| dispensing.confirmed | 薬剤師確認 | ○ | actor は薬剤師(人間責任の明示) |
| inquiry.recorded | 疑義照会記録 | ○ | |
| calculation.finalized / calculation.recalculated | 算定確定・再計算 | ○ | trace 参照(calculation_trace 保存とセット) |
| ~~checkout.finalized / checkout.refunded~~ | (SUPERSEDED) | — | §1.1 の会計 taxonomy に置換(0.2.0) |
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
| system.mode.changed | システムモード遷移(from→to・理由・actor) | ○ | LOCAL_ONLY/RECOVERY_SYNC 遷移は監査上重大(0.2.0追加) |
| audit.viewed / audit.exported | 監査ログ自体の閲覧・出力(メタ監査) | ○ | SEC-007「監査担当の使用自体を監査」に対応(0.2.0追加) |
| retention.disposed | 保持期間満了後の廃棄(廃棄証跡付き) | ○ | SEC-007 保全4に対応(0.2.0追加) |

### 1.1 会計イベント(ACC-011 taxonomy の正規化統合 — 0.2.0)

ACC-011 の短縮名(charge_created 等)は以下の正規形へ写像する。**正本は本表**。

| 種別(正規形) | ACC-011 短縮名 | 備考 |
|---|---|---|
| accounting.charge.created / accounting.charge.reversed | charge_created / charge_reversed | |
| accounting.payment.received / accounting.payment.cancelled / accounting.payment.refunded | payment_received / payment_cancelled / payment_refunded | |
| accounting.allocation.created / accounting.allocation.reversed | allocation_created / allocation_reversed | |
| accounting.adjustment.created | adjustment_created | |
| accounting.receivable.status_changed | receivable_status_changed | |
| receipt.issued / receipt.reissued / receipt.cancelled / receipt.voided | receipt.* | RCP-003 と連動 |
| statement.issued / statement.voided | statement.* | RCP-004(状態なし・交付履歴 void) |
| closing.executed / closing.adjusted | closing.* | ACC-007 |
| facility.invoice.issued / facility.payment.received | facility.* | ACC-010 |

## 2. 種別定義の必須属性(実装時)

種別名(文法準拠)/ 説明 / 対象 targetRef の kind / outcome(success・denied・failed)/ phiClassification 既定値 / 発火箇所(API・ジョブ・Edge)/ 関連 scope。デバッグログとの分離(§9.6)と PHI 非搭載(targetRef は ID 参照のみ)は SEC-007 の構造規約に従う。

**WP-2003 実装時の必須事項(opus4.8 指摘 0.2.0)**:
- `correlationId` を AuditEvent の必須フィールドとする(返金=Reversal+Refund+領収証取消のような複合操作の再構成に必要。EventEnvelope は保持済み — 必須化を骨格実装で強制)。
- 業務理由フィールド `businessReason`(構造化: 理由コード+自由記述禁止 or マスク済み)を `reasonCode`(error code registry 参照=失敗理由)と**分離**して追加する。取消・無効化・調整・返金イベントでは businessReason 必須。

## 3. 変更手順

1. 新規操作の実装WPの DoR で「監査イベント種別が本台帳に存在すること」を要求
2. 不足時は本SSOT改版 → opus4.8 レビュー(監査は高リスク領域)
3. 実装(registry モジュールへ追加 — 将来 `packages/audit`)
4. 台帳にない種別のイベント発火をテスト・レビューで禁止
