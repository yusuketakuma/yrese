# data_portability_policy — Data Portability(export / import)方針

```yaml
ssot_id: API-016
title: Data Portability(export / import)方針
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
depends_on: [API-009, API-011, API-017, SEC-004, SEC-007, DOM-005, DOM-006]
impacts: [apps/api, packages/contracts]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions:
  - export 形式の第一候補は FHIR Bundle(`type=collection`)+ JSON Lines の併用。確定は DOM-006 mapping entry の充足後
blockers:
  - BLOCKED_PRIVACY_REVIEW: export の同意・目的・宛先・保持の privacy review
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: FHIR Bundle 形式の export は conformance review まで『FHIR 準拠』と表記しない
  - BLOCKED_SECURITY_REVIEW: 一時 URL・成果物暗号化・manifest 署名鍵の方式承認
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: import 監査種別
  - SEC-007 release blocker: 監査 export は同 SSOT の contract 成立まで対象外
```

## 1. 目的

薬局(tenant)は自らのデータを、yrese に依存せず取り出し、他システムへ移せる(SPEC-002 §18 データ主権)。同時に、他社レセコンからの移行を受け入れる。

## 2. Export

- 対象: tenant/pharmacy 配下の患者・受付・処方・調剤・算定 trace・会計。正本が yrese にないもの(薬歴、PH-OS 側資源)は参照のみ。**監査の export は SEC-007 §保全6 の APPROVED operations/API contract が成立するまで対象外**とし、成立後も出力時に PHI の再解決・結合を行わない。
- 形式: FHIR Bundle(mapping entry のある resource)+ JSON Lines(非 FHIR canonical domain)。署名付き manifest(ファイル一覧、SHA-256、版、生成日時、生成者)。
- 実行: `export:tenant` scope、tenant 管理者の明示操作、監査必須(`data.exported`)、非同期 job、暗号化された一時 URL。一時 URL は短命・単回・要求 actor 紐付けとし、ダウンロードを監査する。成果物は tenant 別鍵(SEC-006)で暗号化し、生成から定めた期限で自動削除する。manifest 内のファイル名に PHI を使わない。完了通知は Event Catalog 経由。
- 禁止: 他 tenant のデータ混入、部分成功の完全成功表示、URL に PHI。

## 3. Import(移行)

- 入力: JAHIS 形式(WP-6205 decoder)、FHIR Bundle、CSV。いずれも **原本扱いしない**(仮取込 → 薬剤師確認)。
- dry-run が既定。差分レポート(件数、mapping loss、拒否理由)を提示し、人間承認後に本 import(import 監査種別の MOD-008 登録が前提)。
- 書込みは各 resource の単一 writer 経由。Patient の自動マージは禁止(弱属性一致で統合しない)。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
