# event_envelope_schema — イベントエンベロープスキーマ

```yaml
ssot_id: MOD-009
title: イベントエンベロープスキーマ
domain: modules
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - data_integrity_reviewer
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_review_required
version: 0.2.1
created_at: 2026-07-09
updated_at: 2026-08-23
approved_at: 2026-08-23
approved_by: "direct human authority 2026-08-23 (「全てを許可する。実行」); independent review: api-contract lane + security-privacy lane REQUEST_CHANGES -> all findings closed (28dae05, f07e76e); closure checker PASS"
effective_from: 2026-08-23
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §32(同期設計の必須項目), §0.0.3.3
  - docs/api/reception_queue_contract.md(API-006 v0.3.0 proposal)
  - docs/modules/audit_event_registry.md(MOD-008)
  - docs/database/db_migration_policy.md(DB-002)
depends_on:
  - packages/events(85bd3aa)
  - docs/architecture/recovery_sync_design.md(ARC-002)
  - docs/modules/audit_event_registry.md(MOD-008)
impacts:
  - packages/events envelope validation
  - packages/audit base envelope
  - apps/api reception command unit-of-work
  - PostgreSQL outbox intent persistence
  - future Outbox delivery/Inbox/DLQ consumers
related_work_packages:
  - WP-0012
  - WP-1006
  - WP-4032
  - WP-4050
  - WP-9002-W4
related_tests:
  - pnpm --filter @yrese/events test
  - apps/api/src/reception-command.test.ts
  - apps/api/src/db/reception-command.integration.test.ts
  - apps/api/src/db/migration-ddl.test.ts
related_prs: []
evidence_ids: []
open_questions:
  - 配送workerのbackoff上限・dead_letter移行回数は、実測と運用SSOTを根拠に後続WPで確定する
  - reception.created以外のpayload canonical profileは各eventのAPPROVED SSOTで追加する
blockers:
  - WP-4050 R3 specialist review and human approval required before APPROVED
change_log:
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.2.1 2026-08-23 WP-6004: §4.3 を実装済み outbox_events(単一 table + sequence_number + FK)と整合させ、2 table 構造を将来の delivery state 追加として位置づけ。envelope semantics 不変。PROPOSED 維持"
  - "0.2.0 2026-07-29 PROPOSED: WP-4050向けreception.created Outbox intent profile、immutable intent/mutable delivery分離、atomic completeness、legacy orphan fail-closed規則を追加"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W4 metadata-only completion: body/status/version/approval/effective semantics unchanged"
```

**現在の正本は `@yrese/events` の実装である。** EventEnvelope は Cloud Core / Pharmacy Edge Node 間同期(Outbox/Inbox)の共通封筒であり、監査イベント(MOD-008)の基底でもある。変更は本SSOT改版 → opus4.8 レビュー → 実装。

## 1. フィールド(v0.2.0 §32 対応 — 実装済み)

| フィールド | 型 | 検証(createEventEnvelope) |
|---|---|---|
| eventId / tenantId / pharmacyId | branded ID | 非空 |
| deviceId? / actorId? | branded ID | 指定時のみ非空 |
| aggregateId / aggregateType | string | 非空 |
| sequenceNumber / logicalClock | **bigint** | 非負(aggregate 単位の単調増加は Outbox 実装側の責務) |
| wallClock | string | ISO instant(タイムゾーン付き)必須。**呼び出し側供給 — new Date() 既定値なし** |
| idempotencyKey | string | 非空(二重適用防止) |
| causationId? / correlationId | EventId | correlation 必須・causation 任意 |
| schemaVersion | number | 正の安全整数 |
| payloadHash | string | sha-256 hex 小文字64桁(ハッシュ計算は呼び出し側) |
| phiClassification | 'none'/'phi'/'pii'/'phi_pii' | — |
| encryptionStatus | 'plaintext_forbidden'/'encrypted' | **不変条件: phiClassification≠'none' → 'encrypted' 必須(違反は throw)** |
| syncStatus | 'pending'/'sent'/'acknowledged'/'failed'/'dead_letter' | — |
| retryCount | number | 非負安全整数 |
| deadLetterReason? | string | 指定時のみ非空 |

出力は Object.freeze による immutable。

## 2. 設計原則

- 二重送信・順序逆転・重複適用・部分同期・競合を**前提**とする(§32)。冪等性は idempotencyKey、順序は sequenceNumber/logicalClock、追跡は correlation/causation で担保
- PHI を平文で封筒に載せる経路を型と実行時の双方で遮断(SEC-004 の最小化統制)
- 監査イベント(MOD-008 / SEC-007)は本封筒を基底に auditEventType / targetRef / outcome / prevHash / entryHash を拡張する

## 3. 永続化レイヤーの分離

Outbox は次の2層を分離する。

- **Outbox intent**: business transaction が配送義務を負った事実。append-onlyであり、
  `UPDATE` / `DELETE` を禁止する。業務fact、監査eventと同一transactionで1回だけ
  追加する。
- **Delivery state**: 配送試行の可変状態。intentとは別table/itemとし、
  `pending` / `sent` / `acknowledged` / `failed` / `dead_letter`、`retryCount`、
  `deadLetterReason`を保持する。intentのpayloadやidentityを変更してはならない。

配送worker、Inbox、再送backoff、DLQ運用はWP-4050の対象外である。WP-4050は
intentと初期delivery state (`pending`, `retryCount=0`) のatomic persistenceまでを
実装する。配送機能が未実装でもintentを消去・成功扱いしてはならない。

## 4. `reception.created` Outbox intent profile (WP-4050)

### 4.1 event body

Outbox intentの`event_body`は、同じcommandで`audit_events`へ追加する
`AuditEvent`と**同一eventId・同一immutable body**を持つ。値は次に固定する。

| field | value |
|---|---|
| `auditEventType` | `reception.created` |
| `aggregateType` / `targetRef.kind` | `reception` |
| `aggregateId` / `targetRef.id` | 作成済み`receptionId` |
| `actorId` | 認可済みtenant contextから1回だけsnapshotしたactor |
| `wallClock` | command開始時に1回だけsnapshotしたISO instant |
| `idempotencyKey` | `reception.created:<receptionId>` |
| `eventId` / `correlationId` | 同一の新規eventId。`causationId`は未指定 |
| `schemaVersion` | `1` |
| `phiClassification` | `none` |
| `encryptionStatus` | `plaintext_forbidden` |
| `syncStatus` / `retryCount` | `pending` / `0` |
| `outcome` | `success` |

patientId、患者属性、client supplied idempotencyKey、氏名、患者番号、処方情報を
event bodyへ含めない。tenantId / pharmacyIdは認可済みcontext由来のscopeであり、
request body/query/path由来の値を信用しない。

### 4.2 canonical profile とpayload hash

schemaVersion `1`の`payloadHash` preimageはUTF-8で次の4値をNUL (`U+0000`)
区切りで連結したbyte列とする。

```text
reception.created \0 reception \0 <receptionId> \0 success
```

SHA-256 lowercase hexを`payloadHash`とし、現行
`buildChainedAuditEvent`の計算と一致させる。保存JSONはAuditEventの全fieldを持ち、
`bigint`は符号なし10進文字列としてserializeする。読み出し時は
`hydrateAuditEvent`で型・hash・envelope不変条件を再検証する。

これは`reception.created` schemaVersion `1`だけのcanonical profileである。
別event typeまたはbreaking payload変更はschemaVersionを増やし、APPROVED SSOTと
consumer allow-listを同一batchで追加する。未知schemaVersionは処理せず
fail-closedに隔離する。

### 4.3 PostgreSQL persistence contract

**実装済み構造(2026-08-23 時点、migrations/000005 + 000007):** 単一 table `outbox_events`
(PK `(tenant_id, pharmacy_id, outbox_event_id)`、UNIQUE `(tenant_id, pharmacy_id, aggregate_type, aggregate_id, event_type)`、DB 割当て `sequence_number`、`delivered_at` の pending→delivered 単一遷移だけを許す trigger、reception_entries / audit_events への FK)。配送 worker は `apps/api/src/db/outbox-delivery.ts`。以下の 2 table 構造は **retry / DLQ を導入する将来の forward migration の論理設計**であり、`outbox_events` を作り替えるものではない(`outbox_events` = intent、`outbox_delivery_state` を別 table として追加する)。migration適用は別human gateである。

- `outbox_intents`: tenantId、pharmacyId、eventId、eventType、aggregateType、
  aggregateId、schemaVersion、eventBody、createdAtを保持するappend-only table。
  primary keyは`(tenant_id, pharmacy_id, event_id)`、さらに
  `(tenant_id, pharmacy_id, event_type, aggregate_type, aggregate_id, schema_version)`
  をuniqueにする。
- `outbox_delivery_state`: intentのprimary keyを参照し、status、retryCount、
  lastAttemptAt、deadLetterReasonを保持する。作成時は`pending` / `0` /
  `NULL` / `NULL`。
- intentへの`UPDATE` / `DELETE`はtriggerで拒否する。delivery stateの遷移は
  `pending -> sent|failed`、`sent -> acknowledged|failed`、
  `failed -> sent|dead_letter`だけを許可する。`dead_letter`は
  `deadLetterReason`必須、その他statusでは禁止する。

### 4.4 atomic completeness とcommand result

受付作成commandの完全状態は、同一tenant/pharmacy/receptionIdに対して次が
exactly oneずつ存在し、auditとOutboxが同一eventIdを持つ状態だけである。

1. `reception_entries`の業務fact
2. `audit_events`の`reception.created` event
3. `outbox_intents`の同一event
4. `outbox_delivery_state`の初期`pending`行

PostgreSQL実装は1つの`PoolClient`と1つのtransactionでreception insert、
audit scope lock、audit append、Outbox intent/state insertを行う。どのinsert、
validation、commit前処理が失敗しても全体をrollbackする。rollback失敗時はclientを
破棄し、元の失敗を成功へ変換しない。

同一key再送は、同一患者かつ完全状態なら`existing_complete`、異なる患者なら
`idempotency_conflict`、同一患者でも構成要素の欠落・重複・identity不一致が
あれば`reconciliation_required`とする。`reconciliation_required`では自動補修、
actor/timeの推定、追加writeを行わない。

InMemory実装もscope+idempotency key単位で直列化し、reception/audit/Outboxの
cloneを全検証後に一度だけswapする。失敗時は3 storeすべてを変更しない。

## 5. legacy orphan と配送非claim

WP-4050以前に作成されたreceptionでauditまたはOutboxが欠落する場合、過去actor、
wallClock、eventIdを推測して埋めない。`reconciliation_required`として人間確認へ
送る。異なる患者による同一key conflictでは、既存recordの完全/不完全を応答へ
漏らさず常にidempotency conflictを優先する。

Outbox intentの永続化は配送成功を意味しない。WP-4050は`sent`、
`acknowledged`、外部consumer適用、RECOVERY_SYNC完了をclaimしない。
