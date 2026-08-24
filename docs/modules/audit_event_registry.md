# audit_event_registry — 監査イベントレジストリ

```yaml
ssot_id: MOD-008
title: 監査イベントレジストリ
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.5
created_at: 2026-07-09
updated_at: 2026-08-24
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §34
depends_on:
  - docs/security/audit_log_design.md(SEC-007 — 構造・保全・アクセス制御の正)
  - packages/events(85bd3aa — 基底 EventEnvelope)
  - packages/audit(WP-2003/73ffd90, WP-2010/4cf702f — AuditEvent registry 実装)
impacts:
  - packages/audit event registry
  - packages/events audit envelope base
  - apps/api future audit persistence boundary
related_work_packages:
  - WP-0012
  - WP-2003
  - WP-2010
  - WP-3009-BE
  - WP-4043
  - WP-9002-W4
related_tests:
  - pnpm --filter @yrese/audit test
related_prs: []
evidence_ids: []
open_questions:
  - 保存期間(REG-003 の法定根拠確定待ち — SEC-007 と同期)
change_log:
  - "0.2.5 (2026-08-24): §1.2 情報連携イベント 20 種(partner.* / delivery.* / eligibility.* / consent.* / external_record.viewed / sandbox.reset / data.imported)を追加し、API-009〜018・ADP-004 の BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT の解除前提を満たす(review B-1〜B-5 反映: 種別数 20、payload の所在と phiClassification 既定値、targetRef kind、§0 の主リソース省略規則を明記)。businessReason 必須集合に delivery.resent / partner.suspended / partner.retired / sandbox.reset を追加。@yrese/audit AUDIT_EVENT_TYPES と同期。文法・既存種別は不変。review と human approval まで PROPOSED"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W4 metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - "0.2.4 (2026-07-31): WP-4162(全 PHI 読取り監査)に基づき、列挙アクセスの監査イベント `patient.searched` / `reception.queue.viewed` を追加(命名文法準拠: patient は単一リソースで resource 省略、reception は queue リソースを明示)。データ最小化規律(クエリ文字列・PHI をペイロードへ入れない)を備考へ明記。文法・既存種別・必須属性は不変更。承認: direct user instruction 2026-07-31(ヒューマンゲート包括許可)。独立レビューは codex lane 復帰(2026-08-05)後に実施予定と記録。"
  - 0.2.3 (2026-07-09): WP-3009-BE / API-006 v0.2.0 に基づき、受付キュー操作の監査イベント `reception.created` / `reception.cancelled` を追加。`reception.cancelled` は action=cancelled の既存規律により businessReason 必須。
  - 0.2.2 (2026-07-09): WP-4043 実装状態 drift 整備。MOD-008 台帳の実装先を `@yrese/audit` 実装済みとして記録し、旧予定の記述を現行 packages/* 実態へ同期(命名文法・イベント種別・必須属性は不変更)。
  - 0.2.1 (2026-07-09) SEC-008 §4 反映 — breakglass.ended を追加し、businessReasonRequiredEventTypes に breakglass.used を登録。終了イベントは発動イベントと同一 correlationId で紐づける。
  - 0.2.0 (2026-07-09) opus4.8 命名レビュー(CHANGES_REQUIRED)反映 — 文法正式化・会計taxonomy統合(checkout.* supersede)・欠落3種追加・実装時必須2点。命名確定済み、WP-2003 解禁。
blockers: []
```

**分担**: SEC-007 = 監査ログの構造・保全・アクセス制御 / 本レジストリ = **イベント種別の台帳**。イベント種別の追加はレジストリ経由のみ — コード内のローカル追加は `COMMON_MODULE_DUPLICATION_BLOCKED`。

**実装状態: `@yrese/audit` に実装済み(WP-2003/73ffd90, WP-2010/4cf702f)。** apps/api 監査ログ永続化・業務配線は未着手であり、SEC-007 の後続WPで扱う。

## 0. 命名文法(確定 — opus4.8 レビュー 2026-07-09)

`auditEventType = <domain>.<resource?>.<action>`(ドット区切り・snake_case・action は過去分詞/完了形)

- **resource セグメント**: 単一リソースのドメインでは省略可(例: `patient.viewed`)。複数リソースを持つドメイン(会計等)では**必須**(例: `accounting.payment.received`)。
- 3セグメント形は例外ではなく規範(`support.session.started` / `sync.conflict.detected` は本文法に適合)。
- ドメインの主リソース自体に対する操作は resource を省略してよい(`reception.created` と `reception.queue.viewed`、`support.operation` と `support.session.*`、`partner.registered` と `partner.app.issued` が並存する形。0.2.4 / 0.2.5 で容認済み)。
- この文法はパース・索引・前方一致フィルタの**構造契約**であり、変更は本SSOTの breaking 改版+opus4.8 レビューを要する。

## 1. イベント種別台帳(SEC-007 必須記録操作の初期セット)

| 種別(文法準拠) | 対象操作 | outcome必須 | 備考 |
|---|---|---|---|
| patient.viewed / patient.created / patient.updated / patient.deleted | 要配慮情報アクセス・CRUD | ○ | viewed は要配慮情報アクセス記録 |
| patient.searched | 患者検索(要配慮情報の列挙アクセス) | ○ | 1 検索リクエスト=1 イベント。payload は件数等の識別子情報のみ — **検索クエリ文字列・氏名・カナ・生年月日を監査ペイロードへ入れない**(データ最小化。0.2.4) |
| reception.created / reception.cancelled | 受付キュー登録・取消 | ○ | API-006。cancelled は businessReason 必須(action 規律) |
| reception.queue.viewed | 受付キュー閲覧(要配慮情報の列挙アクセス) | ○ | 1 閲覧リクエスト=1 イベント。payload は業務日付+件数のみ(PHI 非含有。0.2.4) |
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
| breakglass.used / breakglass.ended | break-glass 発動・終了 | ○ | `breakglass.used` は businessReason 必須。`breakglass.ended` は発動イベントと同一 correlationId で紐づける。事後レビュー必須(SEC-007/SEC-008) |
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

### 1.2 情報連携イベント(Integration Hub / 資格確認 / 同意 — 0.2.5)

API-009〜018、ADP-004 が前提としていた `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT` を解消する種別。
本節の「payload」は EventEnvelope の `payloadHash` がコミットする domain event payload(監査本文には
置かず、SEC-007 の構造規約どおり `targetRef` は ID 参照のみ)を指す。識別子のみ(partner_id / app_id /
endpoint_id / outbox_event_id / snapshot_id / consent_id)で、URL・署名鍵・資格内容・閲覧した医療情報の
本文を入れない。`phiClassification` 既定値は下表のとおりで、`none` 以外は EventEnvelope の不変条件により
暗号化が強制される。保持期間は `BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY` の枠で確定する。

| 種別(文法準拠) | 対象操作 | outcome必須 | targetRef kind | phiClassification 既定値 | 備考 |
|---|---|---|---|---|---|
| partner.registered / partner.suspended / partner.retired | partner の登録・停止・退役(API-010 状態遷移) | ○ | partner | none | suspended / retired は businessReason 必須(取引先停止は説明責任が重く、`account.suspended` より厳格) |
| partner.app.issued / partner.app.revoked | client credential の発行・失効 | ○ | partner_app | none | credential 値は載せない。app_id のみ |
| partner.grant.changed | tenant/pharmacy が partner app へ与える scope 集合の変更 | ○ | partner_app | none | 変更前後の scope 名を payload に持つ(scope 名は PHI ではない) |
| partner.endpoint.changed | DeliveryEndpoint の登録・変更・所有権再検証 | ○ | delivery_endpoint | none | URL は載せず endpoint_id のみ |
| delivery.sent / delivery.failed / delivery.dead_lettered | outbox 配送の成功・失敗・DLQ 移送(API-012) | ○ | outbox_event | none | failed は error name のみ(message 禁止)。actor は system |
| delivery.resent | DLQ からの人間操作による再送 | ○ | outbox_event | none | businessReason 必須。再送時の partner 状態・grant・同意の再評価結果を payload に持つ |
| eligibility.verified / eligibility.provisional_recorded / eligibility.expired / eligibility.mismatch_detected | 資格確認スナップショットの状態遷移(ADP-004 §3) | ○ | eligibility_snapshot | phi(受付単位の資格確認事実) | payload は snapshot_id・verified_method・状態のみ。保険者番号等の資格内容は載せない |
| consent.recorded / consent.revoked | 薬剤情報・特定健診情報等の閲覧同意の記録・撤回(ADP-004 §5、API-017) | ○ | consent | phi | 同意の範囲コードのみ。revoked の actor は患者代理の操作者。revoked に businessReason を要求しない(撤回に理由を強制しない — 意図的判断) |
| external_record.viewed | 同意に基づく外部医療情報(薬剤情報・特定健診情報・診療情報)の表示 | ○ | consent | phi(閲覧カテゴリは健康関連情報) | 表示した種別と範囲コードのみ。本文は保存しない(ADP-004 §2) |
| sandbox.reset | partner sandbox のリセット(API-014) | ○ | sandbox | none | businessReason 必須 |
| data.imported | 移行 import の本適用(API-016。dry-run は監査しない) | ○ | import_job | none | job_id・件数のみ |

## 2. 種別定義の必須属性(実装時)

種別名(文法準拠)/ 説明 / 対象 targetRef の kind / outcome(success・denied・failed)/ phiClassification 既定値 / 発火箇所(API・ジョブ・Edge)/ 関連 scope。デバッグログとの分離(§9.6)と PHI 非搭載(targetRef は ID 参照のみ)は SEC-007 の構造規約に従う。

**WP-2003 実装で反映済みの必須事項(opus4.8 指摘 0.2.0)**:
- `correlationId` を AuditEvent の必須フィールドとする(返金=Reversal+Refund+領収証取消のような複合操作の再構成に必要。EventEnvelope は保持済み — 必須化を骨格実装で強制)。
- 業務理由フィールド `businessReason`(構造化: 理由コード+自由記述禁止 or マスク済み)を `reasonCode`(error code registry 参照=失敗理由)と**分離**して追加する。取消・無効化・調整・返金イベントでは businessReason 必須。
- `businessReasonRequiredEventTypes` の初期値は `accounting.adjustment.created` と `breakglass.used`。break-glass 終了イベント(`breakglass.ended`)は SEC-008 §4 に businessReason 必須根拠がないため必須化せず、同一 `correlationId` と必要に応じた `causationId` で発動イベントに紐づける。

## 3. 変更手順

1. 新規操作の実装WPの DoR で「監査イベント種別が本台帳に存在すること」を要求
2. 不足時は本SSOT改版 → opus4.8 レビュー(監査は高リスク領域)
3. 実装(registry モジュールへ追加 — 現在 `@yrese/audit` / WP-2003/73ffd90)
4. 台帳にない種別のイベント発火をテスト・レビューで禁止
