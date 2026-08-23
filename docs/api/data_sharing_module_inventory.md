# data_sharing_module_inventory — Data Sharing Module 棚卸し

```yaml
ssot_id: API-018
title: Data Sharing Module 棚卸し
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
depends_on: [API-009, API-017, MOD-001, MOD-002, ADP-001, JHS-003]
impacts: [Plans.md §16, packages, apps/api]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 外部公式 IF に依存する module は ADP-001 の境界 SSOT APPROVED まで実装しない
```

## 1. 目的

情報連携を担う module を列挙し、所有・方向・依存・状態を一表で管理する。本表にない連携 module を作らない。

## 2. 棚卸し(2026-08-23 時点)

| module | 方向 | 相手 | 形式 | 所有 package | 状態 | WP |
|---|---|---|---|---|---|---|
| outbox intent | 内部 | — | DB | apps/api | 実装済(配送 worker なし) | WP-4050 |
| outbox delivery worker | out | partner | sink 注入 | apps/api/src/db/outbox-delivery.ts | 実装済(独立レビュー finding 閉鎖) | WP-6003 |
| Event Catalog schema | out | partner | zod / JSON Schema | packages/contracts/src/partner-event.ts | 実装済(`reception.created`) | WP-6004 |
| webhook sink(HMAC 署名) | out | partner | HTTPS POST | apps/api/src/webhook-partner-sink.ts | 実装済(registry 配線・key-id・rotation 未) | WP-6005 |
| Partner Registry | — | partner | DB/API | apps/api(新) | 未実装 | WP-6006 |
| Inbox(非 authority 提出のみ) | in | partner | JSON | apps/api(新) | 未実装。clinical resource の書込み経路ではない(API-003) | WP-6008(再定義) |
| FHIR facade(Patient/MR) | out(read) / in(MR create) | partner | FHIR R4 JP Core | apps/api(新)/ packages/fhir(新) | 未実装 | WP-6105/6106 |
| JAHIS 2D decoder | in | 処方箋 | JAHIS Ver.1.11 | packages/jahis-2d(新) | 未実装 | WP-6205 |
| JAHIS 薬歴連携 adapter | out | 電子薬歴 | JAHIS Ver.1.1 | packages/jahis-yakureki(新) | 未実装 | WP-6207 |
| オン資 adapter(ADP-A1) | in | 資格確認 | 公式 IF(未入手) | packages/adapter-onshi(新) | 未実装・RB-002 | WP-6306 |
| 電子処方箋 adapter(ADP-A2) | in/out | 管理サービス | 公式 IF(未入手) | packages/adapter-eprescription(新) | 未実装・RB-003 | WP-6308〜6310 |
| PMH adapter(ADP-A4) | in | PMH | 公式 IF(未入手) | — | 未実装・RB-005 | WP-6311 |
| PH-OS projection | in/out | PH-OS | API-004 | — | 未実装 | WP-6404 |
| Export/Import | out/in | tenant | Bundle/JSONL/CSV | apps/api(新) | 未実装 | WP-6012/6406 |
| NSIPS ACL(ADP-A6) | — | 薬局内機器 | 許諾未取得 | — | 設計凍結 | RB-006 |

## 3. 規則

- 新規 module は本表へ追加してから実装する。package 名は `packages/<module>` で MOD-003 依存方向に従う。
- 外部 IF 依存 module は stub 先行とし、公式 IF 形式を推測実装しない。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
