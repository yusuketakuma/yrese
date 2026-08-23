# partner_sandbox_policy — Partner Sandbox 方針

```yaml
ssot_id: API-014
title: Partner Sandbox 方針
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
depends_on: [API-009, API-010, API-015, MOD-013, SEC-004]
impacts: [apps/api, ops, packages/contracts]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_SECURITY_REVIEW: sandbox と production の network / credential 分離の承認
```

## 1. 目的

partner が本番 PHI に一切触れずに接続仕様を検証できる環境を提供する。Sandbox 合格(API-015)が production partner `ACTIVE` 化の前提である(API-010 §3)。

## 2. 要件

- 専用 synthetic tenant / pharmacy。fixture は MOD-013 の合成データのみ。本番データの複製・匿名化データの持込みを禁止する(機械検証: fixture の PHI classification が `none` 以外なら seed を拒否)。
- production と credential、鍵、network、DB を共有しない。
- 同一 contract(`packages/contracts` の同一版)で動作し、挙動差を作らない。挙動差が必要な場合(外部サービス stub)は stub であることを応答 header で明示する。
- sandbox の監査ログは production と分離し、partner が自 app の監査を閲覧できる。
- リセット可能。リセットは監査される。

## 3. 外部サービス stub

オン資(ADP-A1)、電子処方箋(ADP-A2)、PMH(ADP-A4)の sandbox stub は、公式仕様の登録(REG-001 evidence_id)まで **yrese 自身の境界契約だけ**を模し、公式 IF の形式を推測実装しない。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
