# contract_test_policy — Partner Contract Test 方針

```yaml
ssot_id: API-015
title: Partner Contract Test 方針
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
depends_on: [API-009, API-014, TST-001, MOD-014, API-005]
impacts: [scripts, packages/contracts, .github]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_LEGAL_REVIEW: Contract Test Kit の OSS 公開は API-005 の法務確認後
```

## 1. 目的

partner 接続の合否を人の目ではなく **契約からの機械検証**で決める。contract は OpenAPI 3.1 + JSON Schema(`packages/contracts`)、FHIR profile(JP Core package、WP-6102 validator)、Event Catalog schema(API-012)である。

## 2. 構成

| 層 | 内容 | gate |
|---|---|---|
| Provider test | yrese 自身が契約どおりに応答することを CI で検証(`check:openapi` の拡張、FHIR validator) | CI 必須 |
| Consumer-driven test | partner app が生成した request/expectation を sandbox で再生 | partner `ACTIVE` 化の前提 |
| Webhook receiver test | partner endpoint が署名検証・冪等・2xx を正しく返すかを sandbox から送信して検証 | 同上 |
| Negative test | scope 不足、署名不正、replay、stale version、cross-tenant が fail-closed で拒否されること | CI 必須 |

## 3. 規則

- contract の変更は consumer test の再実行を要する。破壊的変更は API-003 §4 の versioning に従う。
- test fixture は合成データのみ。
- 合格 evidence は sandbox の監査ログと CI artifact で残し、Markdown に複製しない。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
