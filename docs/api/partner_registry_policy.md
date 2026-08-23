# partner_registry_policy — Partner Registry / Partner App 管理方針

```yaml
ssot_id: API-010
title: Partner Registry / Partner App 管理方針
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
depends_on: [API-009, API-011, SEC-006, MOD-007, MOD-008]
impacts: [API-012, API-014, apps/api, packages/contracts]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_SECURITY_REVIEW: credential 発行・保管・rotation の方式承認まで partner 登録 API を公開しない
  - BLOCKED_LEGAL_REVIEW: partner 利用規約・データ共有契約の法務確認
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: partner.* 監査種別の MOD-008 登録まで partner 操作を production で行わない
```

## 1. 目的

yrese に接続する外部システム(電子薬歴、処方監査、在庫・分包機、PH-OS、医療機関システム等)を **partner** として登録し、partner ごとに client app、scope、配送先、状態、契約を管理する。登録のない主体からの接続は存在しないものとして拒否する。

## 2. モデル

| 概念 | 説明 | 不変条件 |
|---|---|---|
| Partner | 法人・製品単位の相手方。`partner_id` は tenant 横断で一意 | 削除しない。`RETIRED` へ遷移 |
| PartnerApp | partner が持つ client(OAuth2 client / mTLS 証明書主体)。複数可 | credential は **(partner, tenant, pharmacy) に固定して発行**し、1 credential が複数 tenant の grant を持つ構成を禁止する。tenant は credential から一意に決まり、request body/query の tenant は一切参照しない(SEC-006)。app 停止で即時全経路停止 |
| PartnerGrant | tenant / pharmacy が partner app に与える scope の集合 | tenant/pharmacy ごとに明示付与。既定はゼロ |
| DeliveryEndpoint | webhook 受信 URL と署名鍵 | HTTPS 必須。登録時と配送時に宛先を検証: 公開 IP のみ(private / loopback / link-local / cloud metadata アドレスを拒否)、DNS 再解決後も同条件、リダイレクト非追従、ポートは 443 のみ(SSRF 統制)。宛先の所在国を登録し、SEC-004 §4(越境移転なし)との整合確認を `ACTIVE` 化の前提とする。署名鍵は secret store に保管し、API 応答・log・export に出さない。endpoint 変更時は所有権再検証(challenge)を経て再 `ACTIVE` 化。鍵は rotation 対応(API-012) |

状態: `DRAFT → ACTIVE → SUSPENDED → RETIRED`。`SUSPENDED` / `RETIRED` は配送・受信・read すべてを fail-closed で停止する。

## 3. 登録・変更の gate

- partner 登録、scope 付与、endpoint 変更、credential rotation はすべて監査対象(MOD-008 に `partner.*` 種別を追加する改版が前提 — `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`)。
- tenant/pharmacy の管理者ロール(MOD-007)だけが自 tenant の PartnerGrant を変更できる。yrese 運用者は partner 自体の登録を行うが、tenant の PHI へのアクセスを付与しない。
- 本番 partner の `ACTIVE` 化は Sandbox(API-014)で contract test(API-015)に合格した app だけを対象とする。

## 4. 禁止事項

- 共有 credential、tenant 横断の包括 grant、scope のワイルドカード。
- partner に tenant_id を自己申告させること。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
