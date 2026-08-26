# audit_log_design — 監査ログ設計

```yaml
ssot_id: SEC-007
title: 監査ログ設計
domain: security
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - security_auditor
  - data_integrity_reviewer
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_product_authority
version: 0.2.1
created_at: 2026-07-09
updated_at: 2026-08-26
approved_at: 2026-08-26
approved_by: direct_user_instruction (WP-5104 limited finalization; reference-only cutover); prior approval provenance preserved in Git history
effective_from: 2026-07-29
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §15, §16, §18
  - direct_user_instruction 2026-07-29 (user-facing audit confirmation is unnecessary)
depends_on:
  - SEC-004 privacy_impact_assessment
  - UIX-001 §12 screen inventory
  - PRC-007 ssot_governance
  - packages/events EventEnvelope
impacts:
  - packages/audit
  - apps/api audit repositories and GET /audit/events
  - apps/web/app/admin
related_work_packages:
  - WP-2003
  - WP-4254
related_tests:
  - pnpm --filter @yrese/audit test
  - pnpm --filter @yrese/api exec vitest run src/audit-log.test.ts
  - pnpm check:openapi
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.1 2026-08-26 WP-5104 reference-only cutover from UIX-007 to UIX-001 §12; audit/security semantics unchanged
  - 0.2.0 2026-07-29 SCR-028 Web viewerを廃止し、権限制御APIと将来の監査済み運用出力を見読性境界として定義。保全・integrity・authorizationは不変
  - 0.1.0 2026-07-09 初版をhuman reviewで承認
open_questions:
  - 監査ログの法定保存期間(e-文書法・GL7.0 の要求)【要確認 — REG-003 と同期】
  - ハッシュチェーンのアンカー方式(定期的な外部タイムスタンプ/署名の要否)
blockers:
  - 保持期間全体を人が確認できる監査済みexport/operation contractは未実装。実装・検証までproduction compliance/release claimを禁止
  - GET /audit/eventsは全保存chainの読出し・検証後にaudit.viewedを追記するため、履歴増加に伴うread amplificationと自己増加がある。bounded pagination/verification戦略とavailability proofがAPPROVED・実装・検証されるまでproduction readinessを主張しない
  - production tenant/authに接続されたincident-response運用経路、role-to-permission mapping、support/break-glass運用は未実装
```

## 位置づけと分担

- 本書: 監査ログの**構造・保全・アクセス制御**の設計(design)
- `audit_event_registry.md`(WP-0012): 監査イベント**種別の台帳**(どの操作を記録するか)。イベント種別の追加は registry 経由のみ — コード内のローカル追加は COMMON_MODULE_DUPLICATION_BLOCKED
- デバッグログ・メトリクスとは**完全分離**し、監査ログとデバッグログを混同しない

## イベント構造

`@yrese/events` の EventEnvelope を基底とし、監査ログ専用の AuditEvent pure coreを`@yrese/audit`に実装済みである。PostgreSQL adapter、append-only migration、API runtime配線もrepository上は実装済みだが、production deployment、物理WORM、保持・完全出力運用の完了を意味しない:

| フィールド | 由来 | 備考 |
|---|---|---|
| eventId / tenantId / pharmacyId / deviceId / actorId | EventEnvelope | actorId は監査では**必須**(システム起動等は system actor) |
| wallClock + logicalClock + sequenceNumber | EventEnvelope | オフライン時も欠落させない(SEC-005)。clock drift は RECOVERY_SYNC で検証 |
| auditEventType | audit_event_registry(WP-0012) | 例: patient.viewed / claim.finalized / master.applied / support.session.started |
| targetRef | 追加 | 対象リソースの kind + id(**PHI を含めない** — 氏名等は ID 参照のみ) |
| outcome | 追加 | success / denied / failed |
| reasonCode | 追加 | error code registry(AUTH-0003 等)参照 |
| prevHash / entryHash | 追加 | ハッシュチェーン(tamper-evident) |
| phiClassification / encryptionStatus | EventEnvelope | PHI≠none → encrypted は既存不変条件で強制 |

## 必須記録操作(初期セット — registry で正式化)

閲覧(要配慮情報アクセス)/ 作成・更新・削除 / 薬剤師確認 / 疑義照会記録 / 算定確定・再計算 / 会計確定・返金 / 帳票出力・再出力 / 請求前点検・月次締め・請求データロック / レセプト出力 / マスター承認・適用・ロールバック / 権限変更・アカウント発行停止 / ログイン・ログアウト・認証失敗 / break-glass 使用 / サポートセッション開始終了と全操作 / エクスポート・データ返却 / 設定変更 / Edge 登録・失効 / 同期競合と人間裁定

## 保全(真正性・見読性・保存性)

1. **tamper-evident**: entryHash = H(prevHash ‖ 正規化ペイロード)。Edge ローカルでもチェーン維持、同期時に Cloud で連続性検証(SEC-005 #11)
2. **追記専用**: 監査ログの UPDATE/DELETE はAPI境界とappend-only DB triggerで拒否する。runtime DB privilege分離や物理WORMを検証済みとは扱わない。訂正は打ち消しイベントの追記で表現
3. **削除権限の分離**: 一般データと同じ権限で削除できてはならない。保持期間満了後の廃棄も専用特権+廃棄証跡
4. **保存期間**: 【要確認】(法定根拠を REG-003 で確定後に設定)。それまで削除ジョブは実装しない
5. **見読性**: 一般薬剤師向けWeb画面は提供しない。repository上のdocumented API `GET /audit/events` は、trusted exact tenant/pharmacy contextと`audit-log:read`が与えられたdevelopment/test contractとして、時系列・actor ID・対象ID・hash-chain検証結果のmax-200応答投影、`no-store`、閲覧自体の監査を証明する。production認証、role-to-permission mapping、監査・incident-response運用経路を実装済みとは扱わない
6. **完全出力・bounded workの非主張**: 現行APIの**応答投影**は1要求あたり最大200件だが、内部処理は全保存イベントを読出し、hash-chainを検証・並べ替えしてから表示上限を適用し、成功した各要求ごとに`audit.viewed`を1件追記する。end-to-end bounded work、保持期間全体のexport、retry-idempotent readを実装済みとは扱わない。完全出力は別のAPPROVED operations/API contract、権限制御、出力監査、PHI再解決禁止、改ざん検知検証を満たすまでrelease blockerとする

## アクセス制御

現行repository実装が証明する閲覧境界は、trusted exact tenant/pharmacy contextと`audit-log:read`をともに満たすdevelopment/test API contractだけである。production認証・運用配線およびrole-to-permission mappingは未実装であり、次表の将来対象を現在利用可能な操作として扱わない。

| 対象境界 | 目標とする操作 | 現在の状態 |
|---|---|---|
| exact tenant + pharmacy | 当該scopeだけの監査イベント閲覧 | repository API contractのみ。production tenant/auth・incident-response運用は未実装 |
| テナント全薬局 | 当該tenant内の複数薬局閲覧 | 未実装。別のAPPROVED authorization/operations contractが必要 |
| サポート | 対象scope限定・session監査つき閲覧 | 未実装。time-bounded break-glass、必要性・最小化、全操作監査、終了後review、applicable human gateが必要 |
| テナント横断監査 | 専用特権による限定閲覧 | 未実装。明示的な目的・最小化・同意等の適用条件、time-bounded authorization、利用監査、事後review、applicable human gateが必要 |

- `audit-log:read` は PermissionScope 済み(shared-kernel)だが、productionのrole assignmentを証明しない。書き込みはアプリケーション内部のみ(外部 API から直接書き込み不可)
- SCR-028はUIX-001 §12の廃止済みIDとして予約する。`/admin`はSCR-029の管理プレースホルダーだけを提供し、監査イベント一覧・chain状態・再試行操作を描画しない

## PHI 方針

- 監査ログ本文に PHI を持たせない(targetRef は ID 参照)。「誰が患者Xの記録を見たか」は patientId / actorId だけで表現する
- `GET /audit/events`、将来の監査済み運用出力、保持期間全体のexportのいずれも、patient/actorの氏名その他のPHIを再解決・結合・表示しない。別の患者情報アクセスを監査出力へ暗黙結合しない
- デバッグ用の文字列化(console.log 等)に AuditEvent を渡すことを lint/レビューで禁止(実装時にルール化)
