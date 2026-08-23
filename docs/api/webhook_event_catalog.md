# webhook_event_catalog — Event Catalog と Webhook 配送方針

```yaml
ssot_id: API-012
title: Event Catalog と Webhook 配送方針
domain: api
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - security_critic
  - privacy_compliance_reviewer
  - human_review_required
version: 0.1.0
created_at: 2026-08-23
updated_at: 2026-08-23
approved_at: null
approved_by: null
effective_from: null
effective_to: null
source_refs: [構築プロンプト v0.2.0 §11(Integration Hub / Partner API / JAHIS)・§14(API-first)・§18(データ主権), PRD-001 M12, API-002, API-003, API-005]
depends_on: [API-009, API-010, API-011, API-013, MOD-009, MOD-008, DB-005]
impacts: [apps/api, packages/events, migrations(outbox), API-004]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions:
  - MOD-009 が PROPOSED のため envelope schema の確定が先行条件
blockers:
  - BLOCKED_SECURITY_REVIEW: 署名方式・鍵 rotation・replay window の承認まで外部配送しない
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: 配送成功/失敗/DLQ の監査種別を MOD-008 に追加するまで配送 worker を production で動かさない
```

## 1. Event Catalog

公開 event は本表に登録されたものだけである。内部 outbox `event_type` と公開名は 1:1 とし、公開 schema は `packages/contracts` で版管理する。

| 公開 event | 発生源 | payload(最小) | PHI | 導入 WP |
|---|---|---|---|---|
| `reception.created` | WP-4050 command | eventId(=outbox id), occurredAt, auditEventId, aggregate{type:reception,id} — 実装: `packages/contracts/src/partner-event.ts` | none | WP-6003/6004(実装済) |
| `prescription.draft.created` | C-059 | prescription_id, reception_id, version | none | Milestone 3 |
| `dispense.confirmed` | C-061/063 | dispense_id, prescription_id, version, confirmed_at | none | Milestone 3 |
| `calculation.trace.recorded` | WP-6501 | trace_id, dispense_id, rule_version, master_version | none | Track F |
| `eligibility.snapshot.recorded` | WP-6303 | snapshot_id, aggregate ref, version(patient_ref・verified_method は載せない) | none | Track D |

payload は識別子・版・日時のみを既定とし、本文は scope 付き read API で取得する。患者氏名・生年月日・薬剤名に加え、**患者単位で安定な参照(patient_ref を含む)も載せない**(partner 側で受診時系列を連結できるため。`PARTNER_EVENT_FORBIDDEN_KEYS` で機械禁止)。

## 2. 配送

- 配送 worker は `outbox_events` の `pending` 行を aggregate 単位の順序で取り出し、partner の DeliveryEndpoint へ POST する。at-least-once。
- 署名: HMAC-SHA256、署名対象 = `timestamp.body`(event_id は header と body 双方に含まれ body が署名対象)。header に `x-yrese-event-id`、`x-yrese-timestamp`、`x-yrese-signature`(`v1=<hex>`)、`x-yrese-key-id`。鍵は endpoint ごと、rotation 時は新旧 2 鍵併記期間を持ち、併記期間の上限を定めて超過分は強制失効。受信側は constant-time 比較し、timestamp ± replay window 外を拒否する。実装: `apps/api/src/webhook-partner-sink.ts`(key-id と rotation は未実装)。
- 成功条件は 2xx。timeout・5xx・署名検証不能は失敗。
- retry: 指数 backoff(上限と試行回数は API-003 性能 SLO 確定後に数値化)。上限超過で DLQ へ移し、`EXTERNAL_DEGRADED` の可視化(SCR-024/025)と監査 `delivery.dead_lettered` を出す。
- DLQ からの再送は tenant 管理者の明示操作とし、自動再送しない。再送は配送時点の partner 状態(`ACTIVE`)、PartnerGrant、購読、同意(API-017)を再評価し、いずれかが失効していれば破棄する。再送操作は businessReason 付きで監査する。
- 配送済み判定は `delivered_at` の単一遷移(migrations/000005 のトリガ)だけで表現する。retry 回数・DLQ 状態は intent 行に持たず、MOD-009 §3 の delivery state 分離に従い別 table(DDL human gate)で持つ。導入までは pending と恒久失敗を区別できないことを運用上の既知制約とする。

## 3. 購読

- partner は `events:subscribe:<event_type>` scope(種別ごと、API-011)で購読する。購読は PartnerGrant と同じ tenant/pharmacy 境界に閉じる。
- FHIR Subscription(R4 `rest-hook`)は本配送機構の別表現として WP-6110 で載せる。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
