# integration_hub_architecture — Integration Hub アーキテクチャ

```yaml
ssot_id: API-009
title: Integration Hub アーキテクチャ
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
depends_on: [API-003, API-002, MOD-009, SEC-006, SEC-007, ARC-003, ADP-001]
impacts: [API-010, API-011, API-012, API-013, API-014, API-015, API-016, API-017, API-018, ADP-003, packages/contracts, packages/events, apps/api]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions:
  - Hub を apps/api 内 module とするか別 deployable にするかは性能 SLO(BLOCKED_PERFORMANCE_SLO)確定後に決める
blockers:
  - BLOCKED_SECURITY_REVIEW: partner 認証(OAuth2 Client Credentials / mTLS)の設計承認まで partner 向け endpoint を公開しない
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: Inbox 経由の書込みは DOM-005 / API-008 の単一 writer 前提が満たされるまで受け付けない
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: Hub 操作・配送・同意・export/import の監査種別を MOD-008 へ登録するまで production で動かさない
```

## 1. 目的

yrese の情報連携(FHIR JP Core facade、JAHIS adapter、電子薬歴・処方監査・在庫・PH-OS 等の partner 連携)を、巨大 API ではなく **Integration Hub** という 1 つの境界に集約する。Hub は「誰が(partner)・何を(event / resource)・どの権限で(scope)・どの形式で(adapter)・どの同期方式で(webhook / inbox / projection)」を一箇所で決め、監査する。

## 2. 構成要素と担当 SSOT

| 要素 | 責務 | SSOT |
|---|---|---|
| Partner Registry / App Management | partner と client app の登録・状態・credential 参照 | API-010 |
| Scope / Permission Management | partner scope の定義と内部 permission(MOD-007)への写像 | API-011 |
| Event Catalog / Webhook Delivery | outbox event の公開名・schema・配送・署名・retry・DLQ | API-012 |
| Idempotency Manager | 受信・送信双方の冪等鍵と重複判定 | API-013 |
| Sandbox | synthetic tenant と fixture による partner 検証環境 | API-014 |
| Contract Test Harness | OpenAPI / JSON Schema / FHIR profile からの consumer-driven contract test | API-015 |
| Data Portability / Export-Import | tenant 自身のデータの署名付き export と dry-run import | API-016 |
| Data Sharing Policy | 共有対象・目的・同意・最小化・保持 | API-017 |
| Data Sharing Module Inventory | 共有 module の棚卸しと所有 | API-018 |
| Adapter Registry | Official Adapter(ADP-001)と JAHIS Adapter(JHS-003)の登録・版・状態 | ADP-003 |
| Audit Trail | 全 Hub 操作の監査(MOD-008 へ event 種別を追加) | MOD-008(改版必要) |
| API Versioning / Deprecation | API-003 §4 の廃止期間・通知方法を本 Hub で確定 | API-003(改版必要) |

## 3. データフロー(方向別)

- **Outbound(yrese → partner):** domain command が同一 transaction で `outbox_events` に intent を書く(WP-4050)→ 配送 worker(WP-6003)が Event Catalog の公開 schema へ投影 → Webhook Delivery が署名付きで配送 → 受領/失敗を監査 → 失敗は retry → DLQ。配送 payload は識別子と版のみを既定とし、本文は partner が scope 付き read API で取得する(data minimization)。
- **Inbound(partner → yrese):** Inbox が署名・idempotency・schema・scope を検証 → `PENDING_EXTERNAL_SYNC` として保存 → 書込みは該当 resource の単一 writer(MedicationRequest ingestion 等)だけが行う。Inbox は clinical authority を持たない。
- **Projection(read):** FHIR facade(API-008)と generic projection API(API-003 §1)は read-only の非正本面であり、Hub の scope で保護する。

## 4. 非機能要件

- 配送は at-least-once、aggregate 単位の順序保証、receiver 側の冪等前提(API-013)。
- 全経路で tenant isolation(SEC-006)、rate limit、replay protection、監査(SEC-007)。
- Hub 停止時でも domain command は成功する(outbox が吸収)。Hub の障害は `EXTERNAL_DEGRADED` モードとして可視化し、配送失敗を成功と誤認させない(MSR-017)。

## 5. 禁止事項

- partner ごとの個別仕様・undocumented API・直接 DB 参照連携(SPEC-002 §5)。
- NSIPS 仕様の取込み(ARC-003 の ACL 外)。
- Hub を経由しない外部送信。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
