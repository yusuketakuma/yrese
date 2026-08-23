# integration_hub_architecture — Integration Hub アーキテクチャ

```yaml
ssot_id: API-009
title: Integration Hub アーキテクチャ
domain: api
status: APPROVED
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
approved_at: 2026-08-23
approved_by: "direct human authority 2026-08-23 (「全てを許可する。実行」); independent review: api-contract lane + security-privacy lane REQUEST_CHANGES -> all findings closed (28dae05, f07e76e); closure checker PASS"
effective_from: 2026-08-23
effective_to: null
source_refs: [構築プロンプト v0.2.0 §11(Integration Hub / Partner API / JAHIS)・§14(API-first)・§18(データ主権), PRD-001 M12, API-002, API-003, API-005]
depends_on: [API-003, API-002, MOD-009, SEC-006, SEC-007, ARC-003, ADP-001]
impacts: [API-010, API-011, API-012, API-013, API-014, API-015, API-016, API-017, API-018, ADP-003, packages/contracts, packages/events, apps/api]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions:
  - Hub を apps/api 内 module とするか別 deployable にするかは性能 SLO(BLOCKED_PERFORMANCE_SLO)確定後に決める
blockers:
  - BLOCKED_SECURITY_REVIEW: partner 認証(OAuth2 Client Credentials / mTLS)の設計承認まで partner 向け endpoint を公開しない
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: partner の clinical resource 提出は FHIR facade(API-008)の単一 producer 前提が満たされるまで受け付けない。Inbox は非 authority 提出専用で clinical 書込み経路にはならない
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: Hub 操作・配送・同意・export/import の監査種別を MOD-008 へ登録するまで production で動かさない
```

## 1. 目的

yrese の情報連携(FHIR JP Core facade、JAHIS adapter、電子薬歴・処方監査・PH-OS 等の partner 連携。在庫・POS・分包機は PRD-002 N9 により MVP 外で API v1 候補)を、巨大 API ではなく **Integration Hub** という 1 つの境界に集約する。Hub は「誰が(partner)・何を(event / resource)・どの権限で(scope)・どの形式で(adapter)・どの同期方式で(webhook / inbox / projection)」を一箇所で決め、監査する。

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
| Inbox(非 authority 受信) | partner からの非 clinical-authority 提出(薬歴記載報告、処方監査結果の未加工転記)の受信境界。**clinical resource の書込み経路ではない** | API-009 §3、API-013 |
| API Gateway Policy | rate limit、replay protection、body size、timeout の閾値を partner app 単位で持つ。閾値は API-003 性能 SLO 確定後に数値化 | API-009 §4(専用 SSOT は SLO 確定後) |
| Partner SDK | 契約からの生成物と公開範囲 | API-005 |
| Adapter Registry | Official Adapter(ADP-001)と JAHIS Adapter(JHS-003)の登録・版・状態 | ADP-003 |
| Audit Trail | 全 Hub 操作の監査(MOD-008 へ event 種別を追加) | MOD-008(改版必要) |
| API Versioning / Deprecation | 廃止期間・通知方法(本 Hub で確定): 破壊的変更は新 major、旧 major は **最低 12 か月**併存、廃止は Partner Registry の連絡先へ通知しつつ応答 header `Deprecation` / `Sunset`(RFC 9745 / RFC 8594)で機械通知、sandbox へ先行反映。API-003 §4 は本行を参照する形へ改版する | API-009(API-003 改版で参照) |

## 3. データフロー(方向別)

- **Outbound(yrese → partner):** domain command が同一 transaction で `outbox_events` に intent を書く(WP-4050)→ 配送 worker(WP-6003)が Event Catalog の公開 schema へ投影 → Webhook Delivery が署名付きで配送 → 受領/失敗を監査 → 失敗は retry → DLQ。配送 payload は識別子と版のみを既定とし、本文は partner が scope 付き read API で取得する(data minimization)。
- **Inbound(partner → yrese、clinical resource):** partner による MedicationRequest 等の提出は **`/fhir/R4/*`(API-008)経由のみ**であり、API-003 §1 の単一 external write producer を Hub は変更しない。Hub は scope・rate limit・監査をその前段で適用するだけで、別 route・別 model・別 idempotency 規則を持たない。
- **Inbound(partner → yrese、非 authority 提出):** Inbox は薬歴記載報告(`yakureki:report`)と処方監査結果の未加工転記(`audit-result:submit`)のような、clinical authority を持たない記録だけを受ける。署名・idempotency(API-013、FHIR と同一規則)・schema・scope を検証し `PENDING_EXTERNAL_SYNC` で保存する。Inbox から clinical resource を書くことはできない(API_CONTRACT_BLOCKED)。
- **Projection(read):** FHIR facade(API-008)と generic projection API(API-003 §1)は read-only の非正本面であり、Hub の scope で保護する。

## 4. 非機能要件

- 配送は at-least-once、aggregate 単位の順序保証、receiver 側の冪等前提(API-013)。
- 全経路で tenant isolation(SEC-006)、rate limit(partner app 単位、429 + `Retry-After`)、replay protection(署名 timestamp window)、body size 上限、監査(SEC-007)。閾値は BLOCKED_PERFORMANCE_SLO 解除後に数値化する。
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
