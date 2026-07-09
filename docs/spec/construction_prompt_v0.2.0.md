# 調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0

```yaml
ssot_id: SPEC-002
title: 調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0
domain: spec
status: APPROVED
owner: fable5
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - user_prompt_2026-07-09_yrese_v0.2.0
depends_on:
  - docs/spec/construction_prompt_baseline.md
impacts:
  - docs/product/product_concept.md
  - docs/plan/phase0_plan.md
  - docs/ssot_index.md
  - Plans.md
blockers:
  - v0.2.0のSSOT群がAPPROVEDになるまで、該当領域の本番実装は開始しない
```

## 位置づけ

本文書は、ユーザーが2026-07-09に提示した「調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0」を、リポジトリ内で参照できる形に保存した版別ベースラインである。
既存の `docs/spec/construction_prompt_baseline.md` に収録済みの v0.1.7 / v0.1.8 を継承し、v0.1.9 の Open Rececon Platform 方針と v0.2.0 の yrese 戦略ドクトリンを追加する。

優先順位は `v0.2.0 > v0.1.9 > v0.1.8 > v0.1.7` とする。
ただし、過去版で追加された高リスク停止条件、SSOT駆動、Claude/Codex二系統運用、共通モジュール駆動、会計・領収証・JAHIS・Integration Hub方針は累積的に有効であり、v0.2.0を緩和方向に解釈してはならない。

## 正式開発ベースライン

yrese は、日本の保険薬局向け調剤用レセプトコンピューター MVP である。
正式開発ベースラインは次を含む。

- fable5計画自律決定
- Claude側はClaude Code `/ultracode`
- Codex側は `ultraモード`
- Claude側・Codex側の二系統チーム運用
- Codex側Sol中心のバックエンド実装
- ClaudeCode側フロントエンド実装
- SSOT駆動開発
- 共通モジュール駆動実装
- agmsg経由の相互連携
- UI/UX fable5決定
- 日本医療システム法令適合
- 医療安全
- 体験品質底上げ
- 実運用・移行・サポート
- 性能SLO
- 現場デバイス
- データガバナンス
- Cloud Core + Pharmacy Edge Node
- Official Adapter分離
- 金額管理・未収金管理・一部入金・領収証発行
- API情報連携モジュール化
- JAHIS関連規格フル対応
- 開かれたレセコン
- NSIPS依存卒業
- Open Rececon Platform
- FHIRネイティブCore
- NSIPS境界隔離
- イベントログ中心
- 品質公開KPI
- API-first
- PH-OSリファレンス連携
- 24時間稼働品質
- 連携エコシステム

## yrese 戦略ドクトリン

プロダクト名を **yrese** とする。

一文定義:

> NSIPSを境界に追放し、イベントログを心臓に据え、品質を公開数字で証明し、APIで生態系を作る、止まらないレセコン。

yrese が戦う対象は次の4つである。

1. NSIPS支配による閉じた連携と進歩停滞
2. 低品質レセコンが乗り換えコストと囲い込みで残り続ける構造
3. 24時間稼働を前提にしていない不安定なレセコン運用
4. 弱い連携基盤により、電子薬歴、監査、在庫、POS、在宅、患者接点、分析基盤が発展しない構造

これらは感情的な批判ではなく、プロダクト原則、アーキテクチャ、SSOT、テスト、SLO、公開API、SDK、パートナー戦略、移行戦略で解決する。

## Open Rececon Platform 方針

v0.1.9の追加方針として、yreseは閉じた会計請求端末ではなく、薬局業務の安全な中核プラットフォームである。

Phase 0では次を作成する。

- `open_rececon_manifesto.md`
- `open_rececon_platform_definition.md`
- `nsips_dependency_exit_strategy.md`
- `legacy_adapter_strategy.md`
- `integration_ecosystem_strategy.md`
- `24h_reliability_strategy.md`
- `quality_competition_strategy.md`
- `pharmacy_data_sovereignty_policy.md`
- `partner_program_policy.md`
- `api_publication_policy.md`
- `conformance_kit_strategy.md`
- `platform_slo_policy.md`
- `ecosystem_governance_policy.md`

開かれたレセコンは、OpenAPI 3.1、Webhook、Event Catalog、Schema Registry、Partner Sandbox、Contract Test Kit、Partner SDK、JAHIS Official Adapter、許諾済みNSIPS Legacy Adapter、データポータビリティ、API互換性CI、deprecation policyを持つ。
undocumented APIと直接DB参照連携は禁止する。

## NSIPS境界隔離

NSIPSは攻撃も無断模倣もしない。
ただし、NSIPSをyreseのコア設計に浸食させない。

方針:

- コアはFHIRネイティブなCanonical Modelで設計する
- NSIPSは `NSIPS Legacy Adapter` として境界アダプタ層に閉じ込める
- DDDのAnti-Corruption Layerとして扱う
- NSIPS由来のCSV、共有フォルダ、ファイル連携、レガシー状態表現を内部モデルへ持ち込まない
- NSIPS由来データは正規化、検証、監査、変換、ステータス付与を通してからコアへ入れる
- NSIPSは互換性確保の翻訳機であり、yreseの進化速度を縛らせない
- NSIPS仕様を知らない状態で互換実装を推測しない
- NSIPS依存機能には `LEGACY_DEPENDENCY` を付与する

Phase 0で `nsips_quarantine_architecture.md` を作成する。
S3へのファイル投下とLambda双方向変換はLegacy Adapterの候補構成であり、yreseコアの前提ではない。
薬局内LAN機器との連携、個人情報、医療情報、安全管理ガイドライン、NSIPS利用許諾、ネットワーク分界、オフライン時動作を確認するまで確定してはならない。

## FHIRネイティブCanonical Core

yreseの内部コアはFHIRネイティブなCanonical Clinical/Dispensing Modelを持つ。
ただし、電子処方箋管理サービス、オンライン資格確認、PMH、JAHIS、電子レセプト、オンライン請求は公式仕様を優先し、FHIRを理由にOfficial Adapter仕様を勝手に置き換えてはならない。

Phase 0で次を作成する。

- `fhir_native_canonical_model.md`
- `fhir_mapping_registry.md`

内部モデル候補:

- FablePatient
- FableCoverage
- FablePublicExpense
- FableMedication
- FableMedicationRequest
- FableDispenseRequest
- FableDispenseResult
- FableMedicationStatement
- FableClaimCalculation
- FablePaymentLedger
- FableAuditEvent
- FableCareOperationEvent

FHIR mappingには、source_system、target_system、fhir_resource_type、fhir_profile、canonical_field、external_field、mapping_rule、version、valid_from、valid_to、evidence_id、conformance_status、review_statusを持たせる。

## 品質透明性と公開KPI

yreseは「品質が高い」と主張するだけではなく、数字、テスト、監査証跡、SLO、changelog、公開KPIで証明する。

Phase 0で次を作成する。

- `quality_transparency_strategy.md`
- `public_quality_kpi_policy.md`
- `claim_return_rate_kpi_policy.md`

品質KPI候補:

- platform_uptime
- api_p95_latency
- calculation_golden_test_pass_rate
- receipt_validation_pass_rate
- claim_return_rate_aggregated
- pre_claim_blocker_detection_count
- master_update_success_rate
- zero_downtime_deployment_success_rate
- edge_sync_success_rate
- external_adapter_error_rate
- contract_test_pass_rate
- production_incident_count
- mean_time_to_recovery

返戻率をKPIとして公開する方針は高リスクである。
公開対象、公開粒度、集計方法、匿名化、薬局同意、比較可能性、外れ値処理、地域差補正、KPI悪用リスク、法務・契約レビュー要否、非公開詳細情報を `claim_return_rate_kpi_policy.md` で整理する。

## 算定エンジン

算定エンジンは、コードに算定ルールを埋め込まず、次で構成する。

```text
versioned rule data
+ effective-dated master data
+ deterministic pure functions
+ calculation trace
+ golden tests
+ receipt validation
+ event-sourced facts
+ projections
```

Phase 0で次を作成する。

- `calculation_rule_data_architecture.md`
- `calculation_pure_function_policy.md`
- `calculation_golden_test_source_policy.md`
- `event_sourcing_architecture.md`
- `projection_recalculation_policy.md`
- `claim_finalization_immutability_policy.md`

必須方針:

- LLMに算定判断をさせない
- 算定ルールはrule_id、effective_from、effective_to、evidence_id、test_case_refsを持つ
- 厚労省通知、疑義解釈、支払基金仕様、記録条件仕様、実務レビューからgolden testを作る
- 算定エンジンはDB、外部API、現在時刻へ直接依存しない
- 過去イベントを新ルールで再投影できるようにする
- 確定済み請求を新ルールで無断上書きしてはならない
- 再投影は比較、影響分析、差額検出、再請求候補抽出に使い、人間承認なしに確定請求を変更しない
- finalized claim、issued receipt、submitted receipt はimmutableな証跡を持つ

## 24/365稼働と夜間バッチ停止廃止

yreseは24/365稼働を前提にする。
クラウド冗長性だけでは不十分であり、回線断、外部公的システム停止、Cloud Core障害、Edge Node障害、薬局内LAN障害でも、できる業務を止めない。

Phase 0で次を作成する。

- `always_on_rececon_architecture.md`
- `no_nightly_batch_policy.md`

方針:

- Cloud CoreはMulti-AZ、stateless API、Aurora PostgreSQL、Blue/GreenまたはCanaryで設計する
- API実行基盤はFargate / Lambda等を比較し、Hono等の既存スタックを活かせるか検討する
- 夜間バッチ停止を前提にしない
- レセプト、請求、会計、監査、KPIはイベントから常時インクリメンタル投影する
- 月次締めはclaim snapshot / claim lock / projection freezeとして実装する
- 締め処理中も受付・調剤・会計・薬袋印刷など通常業務を止めない
- マスター更新、算定ルール更新、帳票テンプレート更新はversioned / effective-dated / rollbackableにする
- Cloud Core停止時はPharmacy Edge NodeがLOCAL_ONLYで最低限稼働する
- PWA/local-first UI、ローカルキュー、ローカルDB、ローカル帳票、ローカル監査ログを持つ
- 復旧後はRECOVERY_SYNCで再検証する
- 在宅・夜間対応薬局を主要ユースケースとして扱う

## API-first dogfooding

yreseはAPI-firstで設計する。
yrese自身のUIも、外部パートナーと同じ公開API・イベント・権限モデルの上で動く。

Phase 0で次を作成する。

- `api_first_dogfooding_policy.md`
- `platform_api_architecture.md`

方針:

- yrese UIは原則として公開APIをdogfoodingする
- UI専用の非公開裏口APIを作らない
- 管理者機能も監査可能なAPIとして設計する
- Partner APIとInternal APIの境界を明確にする
- undocumented APIを禁止する
- OpenAPI、Event Catalog、Webhook、SDK、Sandbox、Contract Test Kitを用意する
- EventBridge等のイベント基盤からWebhookを配信できる設計にする
- partner appごとにscope、tenant、pharmacy、purpose-of-useを制御する
- API利用状況、エラー率、連携遅延、失敗イベントを可視化する

## PH-OSリファレンス連携

yreseの最初のリファレンス連携先を **PH-OS** とする。

責務分担:

- yrese: SoR / System of Record / 事実の台帳
- PH-OS: 在宅業務・訪問業務・オペレーションレイヤー

Phase 0で `ph_os_reference_integration.md` を作成する。
PH-OSはyreseの公開APIとイベントを使い、専用裏口APIを作らない。
PH-OS連携で不足したAPIは汎用APIとして設計してから追加する。

## OSS SDK / Event Schema公開方針

Phase 0で `oss_sdk_and_schema_publication_policy.md` を作成する。

公開候補:

- API client SDK
- event schema
- webhook verifier
- idempotency helper
- sample integration app
- contract test kit
- JAHIS conformance test skeleton
- sandbox data fixture

公開禁止候補:

- 認証秘密情報
- 本番患者データ
- 本番薬局データ
- セキュリティ上危険な内部運用情報
- NSIPS仕様由来で許諾上公開できない情報
- 公式仕様の無断再配布に該当する情報

## 監査ログ・WORM・マルチテナント

yreseは医療情報システムとして監査可能性を中核に置く。

Phase 0で `audit_worm_and_tenant_isolation_strategy.md` を作成する。

方針:

- 監査ログはappend-only
- 重要監査証跡は改ざん検知可能にする
- 重要アーカイブはWORM相当保存を検討する
- S3 Object Lock等の利用を検討する
- 暗号化はKMS等を利用する
- マルチテナントはtenant isolationを厳格に設計する
- Aurora PostgreSQL Row Level Security等の適用可否を検討する
- RLSだけに依存せず、アプリケーション層、DB層、監査層で多重防御する
- サポートアクセスはbreak-glassと監査を必須にする

## v0.2.0追加SSOT

Phase 0では、既存SSOTに加えて以下を必ず作成する。

- `yrese_product_doctrine.md`
- `yrese_four_battles_strategy.md`
- `nsips_quarantine_architecture.md`
- `fhir_native_canonical_model.md`
- `fhir_mapping_registry.md`
- `legacy_adapter_s3_lambda_policy.md`
- `quality_transparency_strategy.md`
- `public_quality_kpi_policy.md`
- `claim_return_rate_kpi_policy.md`
- `calculation_rule_data_architecture.md`
- `calculation_pure_function_policy.md`
- `calculation_golden_test_source_policy.md`
- `event_sourcing_architecture.md`
- `projection_recalculation_policy.md`
- `claim_finalization_immutability_policy.md`
- `always_on_rececon_architecture.md`
- `no_nightly_batch_policy.md`
- `api_first_dogfooding_policy.md`
- `platform_api_architecture.md`
- `ph_os_reference_integration.md`
- `oss_sdk_and_schema_publication_policy.md`
- `audit_worm_and_tenant_isolation_strategy.md`

## v0.2.0追加停止条件

以下の場合は実装せず停止する。

- NSIPSの概念がCanonical Modelへ浸食している
- NSIPSファイル連携をコアロジックとして扱っている
- NSIPS許諾未確認のまま互換実装を進めようとしている
- FHIRネイティブ方針とOfficial Adapter境界が未定義
- 公式仕様をFHIR内部モデルで勝手に置き換えようとしている
- 算定ルールをversioned rule dataではなくコード直書きしている
- calculation golden testの根拠が未定義
- イベント再投影で確定済み請求を人間承認なしに変更しようとしている
- 夜間バッチのためにシステム停止を前提としている
- Cloud Core停止時のLOCAL_ONLY業務継続が未定義
- yrese UIが公開APIをdogfoodingしていない
- PH-OS連携が専用裏口APIに依存している
- 公開KPIにPHI、薬局秘密情報、契約上非公開情報が含まれる
- OSS SDKに許諾上公開できない仕様情報が含まれる
- 監査ログの改ざん検知方針がない
- tenant isolationがアプリケーション層だけに依存している

## 継承される実装統制

v0.2.0でも、次は維持する。

- 初回応答・Phase 0ではコードを書かない
- 人間レビュー前に実装へ進まない
- SSOTが未作成、未承認、古い、矛盾している場合は実装を開始しない
- API契約が未承認ならfrontend/backendの実装に入らない
- ClaudeCode側はフロントエンド実装、Codex側はバックエンド実装を主担当とする
- 共有領域はfable5がownerとfile lockを明示する
- 実装者はagmsgや会話ログではなく、承認済みSSOTとWork Packageを根拠にする
- Codexは高リスク領域を単独判断しない
- PHI/PII、秘密情報、未許諾NSIPS仕様本文をagmsgやCloud実行環境へ出さない

## Plans.md反映

このv0.2.0ベースラインに対応するPhase 0作業、SSOT作成候補、停止条件は `Plans.md` の「v0.2.0 yrese ベースライン受理」節で管理する。
