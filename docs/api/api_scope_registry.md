# api_scope_registry — Partner API scope レジストリ

```yaml
ssot_id: API-011
title: Partner API scope レジストリ
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
depends_on: [API-009, API-010, MOD-007, MOD-009, SEC-006]
impacts: [API-008, API-012, API-016, packages/shared-kernel, packages/contracts]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions:
  - FHIR SMART scope 記法(`patient/*.read` 等)を partner scope に採用するかは API-008 の facade 実装時に決める
blockers:
  - BLOCKED_SECURITY_REVIEW: scope と内部 permission の写像は security review まで実装しない
  - BLOCKED_PRIVACY_REVIEW: direct_identifier / clinical / all 分類の scope を第三者へ発行する前に privacy review を要する
```

## 1. 目的

partner に与える権限を **scope** として列挙し、内部 permission(MOD-007 `PERMISSION_ACTIONS × PERMISSION_RESOURCES`)へ一対多で写像する。レジストリにない scope は発行も受理もしない。

## 2. 初期 scope(候補。APPROVED まで発行しない)

| scope | 内容 | PHI classification | 写像先(MOD-007) |
|---|---|---|---|
| `events:subscribe:<event_type>` | Event Catalog の当該 event だけを webhook 購読(種別ごと。包括購読なし) | 当該 event の分類 | — |
| `patient:read` | Patient projection / FHIR Patient read | direct_identifier | patient:read |
| `medication-request:read` | MedicationRequest projection read | clinical | prescription:read |
| `medication-request:write` | Inbox 経由の MedicationRequest 提出(単一 writer 前提) | clinical | prescription:write |
| `medication-dispense:read` | 確認済み調剤の read(WP-6109 後) | clinical | dispensing:read |
| `yakureki:report` | 薬歴未記載チェック結果の提出(WP-6401) | clinical | prescription:write(MOD-007 改版で専用 resource を検討) |
| `audit-result:submit` | 処方監査結果の未加工提出(WP-6402) | clinical | prescription:write(同上) |
| `inventory:read` | 在庫向け read-only projection(WP-6403) | none | dispensing:read(患者識別子を含まない projection に限定) |
| `export:tenant` | tenant 自身の data portability export(API-016) | all | tenant:admin(`export` action は MOD-007 に無く、改版依存) |

## 3. 規則

- scope は `<resource>:<action>` 形式(event 購読は `events:subscribe:<event_type>`)、小文字、ワイルドカード禁止。写像先の MOD-007 resource/action に無い名称(`export` 等)は MOD-007 改版まで発行しない。
- 付与は PartnerGrant(API-010)単位で tenant/pharmacy ごとに行う。
- 403 応答は scope 名を漏らさない(WP-9008 の error contract に従い `AUTH-0003`)。
- scope の追加・意味変更は本 SSOT の改版を要する。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
