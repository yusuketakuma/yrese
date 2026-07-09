# audit_log_design — 監査ログ設計

```yaml
ssot_id: SEC-007
title: 監査ログ設計
domain: security
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §34, §9.6, §20(電子保存)、§0.0.3.3
depends_on:
  - docs/security/privacy_impact_assessment.md(SEC-004)
  - packages/events(EventEnvelope, 85bd3aa)
impacts:
  - docs/agents/…(audit_event_registry は WP-0012 で作成)
  - apps/api 監査ログ実装(WP-2003 予定)
open_questions:
  - 監査ログの法定保存期間(e-文書法・GL7.0 の要求)【要確認 — REG-003 と同期】
  - ハッシュチェーンのアンカー方式(定期的な外部タイムスタンプ/署名の要否)
  - 監査ログ閲覧 UI の権限粒度(監査担当ロール新設の要否)
blockers: []
```

## 位置づけと分担

- 本書: 監査ログの**構造・保全・アクセス制御**の設計(design)
- `audit_event_registry.md`(WP-0012): 監査イベント**種別の台帳**(どの操作を記録するか)。イベント種別の追加は registry 経由のみ — コード内のローカル追加は COMMON_MODULE_DUPLICATION_BLOCKED
- デバッグログ・メトリクスとは**完全分離**(§9.6: 監査ログとデバッグログを混同しない)

## イベント構造

`@yrese/events` の EventEnvelope を基底とし、監査ログ専用の拡張を持つ AuditEvent とする(Phase 2 で `packages/audit`(仮)として実装、WP-2003):

| フィールド | 由来 | 備考 |
|---|---|---|
| eventId / tenantId / pharmacyId / deviceId / actorId | EventEnvelope | actorId は監査では**必須**(システム起動等は system actor) |
| wallClock + logicalClock + sequenceNumber | EventEnvelope | オフライン時も欠落させない(§9.3)。clock drift は RECOVERY_SYNC で検証 |
| auditEventType | audit_event_registry(WP-0012) | 例: patient.viewed / claim.finalized / master.applied / support.session.started |
| targetRef | 追加 | 対象リソースの kind + id(**PHI を含めない** — 氏名等は ID 参照のみ) |
| outcome | 追加 | success / denied / failed |
| reasonCode | 追加 | error code registry(AUTH-0003 等)参照 |
| prevHash / entryHash | 追加 | ハッシュチェーン(tamper-evident) |
| phiClassification / encryptionStatus | EventEnvelope | PHI≠none → encrypted は既存不変条件で強制 |

## 必須記録操作(初期セット — registry で正式化)

閲覧(要配慮情報アクセス)/ 作成・更新・削除 / 薬剤師確認 / 疑義照会記録 / 算定確定・再計算 / 会計確定・返金 / 帳票出力・再出力 / 請求前点検・月次締め・請求データロック / レセプト出力 / マスター承認・適用・ロールバック / 権限変更・アカウント発行停止 / ログイン・ログアウト・認証失敗 / break-glass 使用 / サポートセッション開始終了と全操作 / エクスポート・データ返却 / 設定変更 / Edge 登録・失効 / 同期競合と人間裁定

## 保全(真正性・見読性・保存性 — §20)

1. **tamper-evident**: entryHash = H(prevHash ‖ 正規化ペイロード)。Edge ローカルでもチェーン維持、同期時に Cloud で連続性検証(SEC-005 #11)
2. **追記専用**: 監査ログの UPDATE/DELETE は API・DB 権限の双方で禁止。訂正は打ち消しイベントの追記で表現
3. **削除権限の分離**: 一般データと同じ権限で削除できてはならない(§9.5)。保持期間満了後の廃棄も専用特権+廃棄証跡
4. **保存期間**: 【要確認】(法定根拠を REG-003 で確定後に設定)。それまで削除ジョブは実装しない
5. **見読性**: 監査ログ画面(screen_inventory)で時系列・actor・対象・テナント絞り込み表示。エクスポートは監査対象操作

## アクセス制御

| ロール | 可能な操作 |
|---|---|
| 薬局管理者 | 自薬局の監査ログ閲覧 |
| テナント管理者 | 自テナント全薬局の閲覧 |
| 当社サポート | 対象テナント限定・セッション監査つき閲覧(§9.2) |
| 当社特権(監査担当) | テナント横断閲覧 — 使用自体を監査+事後レビュー |

- `audit-log:read` は PermissionScope 済み(shared-kernel)。書き込みはアプリケーション内部のみ(外部 API から直接書き込み不可)

## PHI 方針

- 監査ログ本文に PHI を持たせない(targetRef は ID 参照)。「誰が患者Xの記録を見たか」は patientId で表現し、表示時に権限のある閲覧者だけが患者名を解決する
- デバッグ用の文字列化(console.log 等)に AuditEvent を渡すことを lint/レビューで禁止(実装時にルール化)
