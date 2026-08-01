# platform_api_architecture — 公開 API 構造方針

```yaml
ssot_id: API-003
title: 公開 API(Open Rececon Platform)の構造方針
domain: api
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
effective_from: 2026-08-01
effective_to: null
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - security_auditor
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_pharmacist_product_authority
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-31
source_refs: [構築プロンプト v0.2.0 §14(API-first)・§5(Open Rececon Platform)・§11(Integration Hub), PRD-006(柱4), PRD-007(§4 facade), PRD-009(戦い4)]
depends_on: [API-002, PRD-007, DOM-005, DOM-006, SEC-004(PIA), OPS-005(SLA/SLO)]
impacts: [API-004, API-005, WP-0036(Integration Hub), packages/contracts, apps/api]
related_work_packages: [WP-0046, WP-0036, WP-9002-W5A, WP-4250]
related_tests:
  - apps/api/src/server.test.ts
  - pnpm check:openapi
related_prs: []
evidence_ids: []
change_log:
  - "0.1.2 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 11(mechanical): 本文停止条件が参照するBLOCKED_WRITE_PRODUCER_PREREQUISITESをfrontmatter blockersへ登録(round 4 L-2)"
  - "0.1.2 2026-07-31 WP-4250 PROPOSED Revision 7: HIGH-1訂正。external authoritative write producerを/fhir/R4単一へ確定しintake command APIをunselected化、producer属性未充足時のphase-disabledを明記"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 6: bounded FHIR method advertisingをlive atomic config generationへ拘束し、Patient PUT idempotency/history baselineを同期"
  - "0.1.2 2026-07-30 WP-4250 PROPOSED Revision 3: bounded authority、read-only generic projection、separate intake commandを分離。旧0.1.1承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: []
blockers:
  - BLOCKED_PERFORMANCE_SLO: rate limit / quota / 可用性の具体数値は OPS-005 系確定まで定めない
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 公的接続系を公開 API で代替・再公開しない
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: /fhir/R4 producerのactor/client class・audience・scope・qualification・purpose-of-use充足まで全write interactionはphase-disabled(§1。Revision 11でfrontmatter登録 — 本文停止条件との整合)
```

## 1. 目的とスコープ

外部パートナー(電子薬歴・PHR・BI・在宅・partner SaaS 等)へ提供する公開 API の
構造方針を定める。個別エンドポイントの契約は API-001 と同様に 1 契約 = 1 SSOT で
起案し、本書はその共通土台とする。

**スコープ外**: オン資・電子処方箋・オンライン請求・PMH・JAHIS(DOM-006 §4 の
置換禁止レーン)。公的接続の結果データを公開 API で再公開する場合も、canonical model
経由の投影(DOM-005)としてのみ行い、公式インターフェースの代替を提供しない。

API面は次の3系統を混同しない。

1. `/fhir/R4/*`: DOM-005/DOM-006で選択されたPatientとoral/topical
   MedicationRequestのbounded authority API。read interactionと、API-008でphase
   ごとに許可されたcreate/update commandを持つ。generic/public projectionではない。
   CapabilityStatementと405 Allowは同じrequest-time atomic config generationの
   LIVE ENABLED methodだけを表し、blocked interactionを先行広告しない。
2. generic/public canonical projection API: 内部/FHIR正本から再生成できる
   **read-only** partner-neutral非正本面。POST/PUT/PATCH/delete、write command、
   intake、authority mutationを提供しない。PH-OSは将来consumer候補であり、PH-OS固有core
   semantics、専用endpoint、専用field、専用scopeを持たない。接続/support/
   interoperabilityは未実証。
3. intake command API: **本batchでunselected**。ARC-008 §3.1により、bounded
   authorityへのexternal authoritative write producerは1の`/fhir/R4/*`ただ1つに
   確定した。intake command APIは契約・route・model・実装・広告のいずれも本batchで
   認可しない。将来選択する場合はPRC-007改版とARC-008 §3.1と同等のproducer定義を
   新たに要する。projection route/modelをwrite入口にせず、projectionから
   authorityへ逆流させない規律は引き続き適用する。

1のcreate/update commandは、ARC-008 §3.1のproducer属性(actor/client class、
audience、scope、qualification、purpose-of-use、payload/result、idempotency)を
全て満たす場合だけ有効化できる。production identity、role-to-scope、
qualification、purpose-of-use registryが未実装・未承認である現在は
phase-disabledであり、CapabilityStatementにも405 `Allow`にも現れない。

本draftはroute実装、公開、CapabilityStatement実装、conformance claimを認可しない。

## 2. 認可・テナント境界

1. **deny-by-default**: すべての公開 API は requirePermission 配下。scope 未付与は 403。
   匿名アクセス可能な業務 API を作らない。
2. **テナント境界**: すべてのリクエストはテナント文脈(tenant_id + pharmacy_id)に拘束される。
   ページネーション cursor 等の継続トークンもテナント境界に拘束する(API-001 §5 の一般化)。
3. **PHI**: PHI を含むレスポンスは `Cache-Control: no-store`・平文ログ禁止(SEC-004)。
   パートナーへの PHI 提供は、同意・契約・法令整理(QUA-008 と同系の前提条件)が
   整うまで各契約 SSOT で BLOCKED とする。

## 3. rate limit / quota(方針のみ)

- テナント単位・API キー単位の rate limit / quota を設ける方針とする。
- **具体数値は本書では定めない**(BLOCKED_PERFORMANCE_SLO。OPS-005 系の改版で確定)。
- 超過時は 429 + 明示のエラーコード(error_code_registry へ事前登録)で fail-closed に拒否する。

## 4. バージョニング

1. **破壊的変更は新バージョン**: 既存フィールドの削除・型変更・意味変更は新バージョンの
   契約 SSOT として起案する(DOM-006 §3 の改版規律と同型)。既存バージョンの silent 変更は禁止。
2. **後方互換な追加**(optional フィールド追加等)は同一バージョン内の改版とし、
   契約 SSOT の version を上げて変更履歴に記録する(PRC-007)。
3. **廃止手順**: 旧バージョンの廃止は「非推奨宣言 → 移行期間(パートナー通知)→ 停止」の
   3 段階とし、期間・通知方法は Integration Hub SSOT(WP-0036)で確定する。
   予告なしの停止は行わない(24/365 原則 ARC-010 と整合)。

## 5. 停止条件(fail-closed)

- 契約 SSOT(APPROVED)のないエンドポイント公開 → API_CONTRACT_BLOCKED
- 公的接続系の代替 API 提供 → BLOCKED_OFFICIAL_ADAPTER_BOUNDARY
- generic/public projectionへのwrite/intake追加 → API_CONTRACT_BLOCKED
- `/fhir/R4/*`以外のexternal authoritative write producerを設ける、または
  unselectedなintake command APIを実装/広告 → API_CONTRACT_BLOCKED(ARC-008 §3.1)
- ARC-008 §3.1のproducer属性が未充足のままcreate/updateを有効化・広告 →
  BLOCKED_WRITE_PRODUCER_PREREQUISITES
- rate limit / quota の数値を根拠なく実装へ埋め込む → BLOCKED_PERFORMANCE_SLO
- 既存バージョンの破壊的 silent 変更 → SSOT_UPDATE_REQUIRED

## 変更履歴

- 0.1.2 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.2 (2026-07-31 Revision 7): independent domain review HIGH-1訂正。
  external authoritative write producerを`/fhir/R4/*`単一へ確定し、
  intake command APIを本batch unselectedへ降格。ARC-008 §3.1のproducer属性
  未充足時はcreate/updateをphase-disabledに維持する旨と停止条件を追加。
- 0.1.2 (2026-07-30 Revision 6): CapabilityStatement/Allowを同一の
  request-time atomic config generationのLIVE ENABLED methodへ拘束。
- 0.1.2 (2026-07-30): WP-4250 PROPOSED。`/fhir/R4/*`のbounded direct-authority面とpartner-neutralなgeneric/public非正本投影面を分離し、PH-OSを後者のconsumerに限定。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §14/§5/§11 へ修正)。
- 0.1.0 (2026-07-09): 初版起草(WP-0046)。PRD-007 impacts の前方参照を解消。
