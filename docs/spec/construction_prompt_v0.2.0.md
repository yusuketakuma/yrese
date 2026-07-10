# 調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0

```yaml
ssot_id: SPEC-002
title: 調剤用レセプトコンピューター MVP 構築プロンプト v0.2.0
domain: spec
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - user_prompt_2026-07-09_yrese_v0.2.0
  - user_instruction_2026-07-10_codex_single_lane
depends_on:
  - docs/agents/codex_single_lane_operating_model.md
impacts:
  - docs/product/product_concept.md
  - docs/plan/phase0_plan.md
  - docs/ssot_index.md
  - Plans.md
related_work_packages:
  - WP-0040
  - WP-0041
  - WP-0042
  - WP-0043
  - WP-0044
  - WP-0045
  - WP-0046
  - WP-0047
  - WP-0048
  - WP-0049
  - WP-9001
related_tests:
  - rg-version-consolidation
  - git-diff-check
related_prs: []
evidence_ids: []
change_log:
  - 2026-07-09: yrese v0.2.0正本として、全構築プロンプト要求を単一版へ統合。
  - 2026-07-10: ユーザー直接指示(WP-9001)とrequired reviews PASSにより、運用章をAGT-018準拠のCodex単一レーンへ改定・APPROVED化。製品・domain・evidence要件とv0.2.0は維持。
open_questions:
  - 公式資料、許諾資料、医療安全、請求実務、人間レビューが必要な項目は各SSOTで解除条件を定義する。
blockers:
  - v0.2.0の該当SSOTがAPPROVEDになるまで、高リスク領域の本番実装は開始しない。
```

## 0. 正本宣言

本文書のみを、yrese調剤レセプトコンピューターMVP構築プロンプトの正本とする。

過去版本文、過去版一覧、版間の優先順位規定は削除する。
既に提示済みの製品、domain、evidence、SSOT駆動、共通モジュール、会計・領収証、JAHIS、Integration Hub、Open Rececon Platform、FHIR/JP Core、24/365稼働、PH-OS連携、監査WORM、品質公開KPIに関する要求は、この0.2.0へ統合済みとして扱う。

エージェント運用の正本は `docs/agents/codex_single_lane_operating_model.md` (AGT-018) とする。本文書内の運用規定はAGT-018を具体化し、製品・domain・evidence要件を変更しない。運用上の競合では、新しいAPPROVEDなAGT-018と現在の人間指示を優先する。

仕様差分が新たに発生した場合も、版を増やさず本文書へ統合する。
会話ログ、PRコメント、口頭メモ、モデル内部計画はSSOTではない。
実装根拠は、本文書、承認済みSSOT、current Work Package、公式根拠台帳のみとする。current Work Package、`Plans.md`、`State.md`はAPPROVED SSOTを上書きできない。競合時はSSOT改版と再計画までfail-closedで停止する。重要な判断はrepository内の正式文書へ記録する。

## 1. プロダクト定義

プロダクト名は **yrese** とする。

一文定義:

> NSIPSを境界に追放し、イベントログを心臓に据え、品質を公開数字で証明し、APIで生態系を作る、止まらないレセコン。

yreseは、日本の保険薬局向けに、AWSクラウドと薬局内エッジを併用して稼働する調剤用レセプトコンピューターMVPである。
単なる処方入力・会計請求端末ではなく、薬局業務の安全な中核プラットフォーム、薬局データの標準API基盤、外部連携エコシステムの起点として設計する。

## 2. 最上位ロール

最上位の実行ロールは **Codex root agent** とする。

Codex rootは、current state復元、計画立案、全体指揮、要件整理、仕様調査設計、risk管理、role配分、quality gate管理、UI/UXを含む全layerの整合、最終validation、exact-stage landingを担う。
ユーザーが詳細WBS、画面仕様、DB設計、API設計、実装順序を指定しなくても、Codex rootが自律的に分解してcurrent Work Packageへ落とし込む。

非自明な作業は、read-only mapper、実装前のpre-plan reviewer、sole maintainer、変更を作成していないindependent verifier、必要なdomain specialistの順で行う。root自身が編集する場合はsole maintainerを兼ね、同時editorを置かない。

Phase 0と初回応答ではコードを書かない。
高リスク(R3+)は、人間レビュー前に実装へ進まない。R4はhuman authorityによるscope・evidence・risk判断と再計画が完了するまで実装禁止とする。
法令、調剤報酬、薬学、患者安全、production操作などhuman gate対象は、人間の明示承認前に進めない。
仕様不明・根拠不明・許諾不明・医療安全不明の箇所は実装で補完せずBLOCKER化する。

## 3. 正式開発ベースライン

- Codex rootによる計画・scope・roleの自律決定
- Codex native orchestrationによる単一レーン運用
- read-only code mapper / explorer
- read-only pre-plan reviewer (`implementation_planner` または `spec_guardian`)
- active scopeごとに1名だけのsole maintainer
- makerとは別contextのindependent verifier
- 医療安全、privacy、security、DB/data integrity、API contract、UI/accessibility、testのdomain specialist
- frontend、backend、shared、SSOT/docs、database/IaC、test、scripts、CIの全layer所有
- SSOT駆動開発
- 共通モジュール駆動実装
- repository内記録による計画・review・handoff・blockerの追跡
- role名による割当と、未確認model ID・能力・権限の推測禁止
- UI/UXを含む設計判断のroot統率と、必要なhuman/domain review
- rootだけによるowned exact pathのstage、commit、要求時push
- 日本医療システム法令適合
- 医療安全と請求安全
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
- FHIR/JP Core Ready Canonical Core
- NSIPS境界隔離
- イベントログ中心
- 品質公開KPI
- API-first dogfooding
- PH-OSリファレンス連携
- 24/365稼働品質
- 連携エコシステム
- 監査ログ・WORM・厳格なtenant isolation

## 4. yreseが戦う4つの閉塞

1. NSIPS支配による閉じた連携と進歩停滞
2. 低品質レセコンが乗り換えコストと囲い込みで残り続ける構造
3. 24時間稼働を前提にしていない不安定なレセコン運用
4. 弱い連携基盤により、電子薬歴、監査、在庫、POS、在宅、患者接点、分析基盤が発展しない構造

これらは感情的な批判ではなく、プロダクト原則、アーキテクチャ、SSOT、テスト、SLO、公開API、SDK、パートナー戦略、移行戦略で解決する。

## 5. Open Rececon Platform 方針

yreseは閉じた会計請求端末ではなく、薬局業務の安全な中核プラットフォームである。

必須原則:

- レセコンは薬局業務の安全な中核プラットフォームである。
- 標準規格は最低限の互換性の土台であり、進歩を止める上限ではない。
- NSIPSは正規許諾を得た場合のみLegacy Adapterとして尊重し、独自APIとは混同しない。
- JAHISなど該当する標準にはOfficial Adapterとしてフル対応し、公式仕様を勝手に解釈しない。
- 独自APIはOpenAPI、イベント駆動、Webhook、OAuth2、mTLS、署名付きイベント、Contract Testを備える。
- 薬局データは薬局の業務資産であり、ベンダーロックインの道具にしない。
- 請求根拠、算定根拠、連携根拠、障害履歴、監査証跡を説明可能にする。
- 24時間稼働、無停止アップデート、ローカル単独稼働、復旧後同期を標準品質とする。
- 初見でも安全に操作でき、熟練者は高速に使える医療UIにする。
- 連携先ベンダー、薬局、薬剤師、患者にとってフェアなプラットフォームを目指す。

開かれたレセコンは、OpenAPI 3.1、Webhook、Event Catalog、Schema Registry、Partner Sandbox、Contract Test Kit、Partner SDK、JAHIS Official Adapter、許諾済みNSIPS Legacy Adapter、Data Portability、API互換性CI、deprecation policyを持つ。
undocumented API、直接DB参照連携、場当たり的なpartner個別仕様、本番PHIを含むfixtureは禁止する。

## 6. NSIPS境界隔離

NSIPSは攻撃も無断模倣もしない。
ただし、NSIPSをyreseのコア設計に浸食させない。

必須方針:

- コアはFHIR/JP Core ReadyなCanonical Clinical/Dispensing Modelで設計する。
- NSIPSは `NSIPS Legacy Adapter` として境界アダプタ層に閉じ込める。
- DDDのAnti-Corruption Layerとして扱う。
- NSIPS由来のCSV、共有フォルダ、ファイル連携、レガシー状態表現を内部モデルへ持ち込まない。
- NSIPS由来データは正規化、検証、監査、変換、ステータス付与を通してからコアへ入れる。
- コアのイベント、API、算定、請求、監査ログはNSIPS仕様に依存しない。
- NSIPSは互換性確保の翻訳機であり、yreseの進化速度を縛らせない。
- NSIPS仕様を知らない状態で互換実装を推測しない。
- NSIPS依存機能には `LEGACY_DEPENDENCY` を付与し、将来移行候補として追跡する。

S3へのファイル投下とLambda双方向変換はLegacy Adapterの候補構成であり、yreseコアの前提ではない。
薬局内LAN機器との連携、個人情報、医療情報、安全管理ガイドライン、NSIPS利用許諾、ネットワーク分界、オフライン時動作を確認するまで確定してはならない。

## 7. FHIR/JP Core Ready Canonical Core

yreseの内部コアはFHIR/JP Core ReadyなCanonical Clinical/Dispensing Modelを持つ。
ただし、電子処方箋管理サービス、オンライン資格確認、PMH、JAHIS、電子レセプト、オンライン請求は公式仕様を優先し、FHIR内部モデルでOfficial Adapter仕様を勝手に置き換えてはならない。

内部モデル候補:

- YresePatient
- YreseCoverage
- YresePublicExpense
- YreseMedication
- YreseMedicationRequest
- YreseDispenseRequest
- YreseDispenseResult
- YreseMedicationStatement
- YreseClaimCalculation
- YresePaymentLedger
- YreseAuditEvent
- YreseCareOperationEvent

FHIR mappingには、source_system、target_system、fhir_resource_type、fhir_profile、canonical_field、external_field、mapping_rule、version、valid_from、valid_to、evidence_id、conformance_status、review_statusを持たせる。

電子処方箋対応はJP Core/FHIR準拠と同義ではない。
差別化は「電子処方箋対応」単体ではなく、電子薬歴、PHR、電子お薬手帳、在宅、BI、AI、地域連携、電子カルテ情報共有サービスと低コストで安全につながる薬局データ連携基盤として実現する。

## 8. 算定エンジン

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

必須方針:

- LLMに算定判断をさせない。
- 算定ルールはrule_id、effective_from、effective_to、evidence_id、test_case_refsを持つ。
- 厚労省通知、疑義解釈、支払基金仕様、記録条件仕様、実務レビューからgolden testを作る。
- 算定エンジンはDB、外部API、現在時刻へ直接依存しない。
- 処方日、受付日、調剤日、請求月、マスター版、算定ルール版を明示入力にする。
- floating pointを使わず、金額・点数は整数またはDecimalで扱う。
- 丸め処理、負担割合、公費按分、請求先別金額はevidence_id付きで記録する。
- 過去イベントを新ルールで再投影できるようにする。
- 確定済み請求を新ルールで無断上書きしてはならない。
- 再投影は比較、影響分析、差額検出、再請求候補抽出に使い、人間承認なしに確定請求を変更しない。
- finalized claim、issued receipt、submitted receipt はimmutableな証跡を持つ。

MVP対象外の算定が含まれる処方では、`BLOCKED_UNSUPPORTED_CLAIM`、`MANUAL_REVIEW_REQUIRED`、`FUTURE_SCOPE_NOT_CLAIMABLE` のいずれかで止める。
MVP対象外であるにもかかわらず保険請求データを生成してはならない。

## 9. 会計・収納・領収証

算定、請求、会計、領収証、POS/Paymentを混同してはならない。

- Calculation: 調剤報酬点数、患者負担額、保険請求額、公費請求額を算出する領域
- Claim: レセプト請求、保険者請求、公費請求を扱う領域
- Accounting: 患者請求、未収、入金、返金、差額精算、日計を扱う領域
- Receipt: 領収証、調剤明細書、再発行、取消、交付履歴を扱う領域
- POS/Payment: 現金、クレジット、電子マネー、QR決済、セルフレジ、POS連携を扱う領域

会計台帳はappend-only ledgerとする。
既存レコードの上書きで会計事実を改変してはならない。
修正はreversal、adjustment、refund、recalculation_diffとして記録する。

一部入金はMVP対象に含める。
未入金額を領収済みとして表示してはならない。
一部入金、入金割当、返金、領収証再発行、取消、LOCAL_ONLY会計は監査証跡、同期状態、重複防止を必須とする。

領収証は患者から費用の支払を受けた事実に対応して発行する。
調剤明細書は療養の給付に係る費用の算定基礎となった項目を示す文書として扱う。

## 10. レセプト請求・帳票・マスター

レセプト請求は、算定、レセプト中間モデル生成、電子レセプトデータ生成、記録条件仕様バリデーション、標準仕様チェック、請求前点検、請求月締め、請求データロック、オンライン請求用端末・公式手順への受け渡し、送信結果・受付結果・返戻・再請求管理に分ける。

公式仕様外のオンライン請求直接送信、画面自動操作、非公式API送信は実装しない。
公式に許可された接続方式、電子証明書、ネットワーク、接続試験、運用規約を確認するまで送信自動化は `BLOCKED_REGULATORY_REVIEW` とする。

帳票ごとに、法令上必須か、実務上必須か、MVP対象か、出力形式、印刷要否、電子保存要否、保存期間、再出力可否、出力時点の算定根拠、マスター版、算定ルール版、出力者、出力日時、ハッシュ、改ざん検知、患者交付済みフラグを整理する。

マスター自動更新は、取得、署名またはハッシュ確認、形式検証、文字コード検証、スキーマ検証、差分検出、有効日検証、廃止日検証、経過措置検証、参照整合性検証、算定・レセプト・帳票回帰、影響レポート、ステージング、承認、本番反映、Edge Node配布、ロールバックポイント、監査ログ保存を必須とする。

## 11. Integration Hub / Partner API / JAHIS

情報連携機能は巨大APIとして実装しない。
Integration Hubを設計し、対象、権限、監査、形式、同期方式を明確にする。

必須コンポーネント:

- Partner Registry
- Partner App Management
- Scope / Permission Management
- Consent / Authorization Policy
- Data Sharing Policy
- Event Catalog
- Webhook Delivery
- Outbox / Inbox
- Idempotency Manager
- Retry / DLQ
- Audit Trail
- API Gateway Policy
- Sandbox
- Contract Test Harness
- Partner SDK
- Data Export / Import
- Data Portability
- API Versioning
- Deprecation Policy
- Adapter Registry

Pharmacy Integration APIは、OpenAPI 3.1、JSON Schema、OAuth2 Client Credentials、mTLS、署名付きWebhook、Idempotency-Key、tenant_id / pharmacy_id / partner_id、scope、PHI classification、data minimization、audit log、rate limit、replay protection、versioning、contract test、sandboxを必須とする。

JAHISフル対応とは、薬局レセコンに関係するJAHIS制定済標準・技術文書を棚卸しし、該当するものについてOfficial Adapter、テスト、版管理、相互運用性確認を備えることを意味する。
全JAHIS標準を無差別に実装するという意味ではない。
該当性が不明なJAHIS仕様は `JAHIS_APPLICABILITY_REVIEW_REQUIRED` とする。
JAHIS対応を名乗ってよいか不明な場合は `BLOCKED_JAHIS_CONFORMANCE_REVIEW` とする。

## 12. Cloud Core / Pharmacy Edge Node / システムモード

Cloud CoreはAWS上で動作する中枢SaaSであり、全薬局横断の管理、同期、バックアップ、監査、マスター配布、外部連携制御、テナント管理を担う。
Pharmacy Edge Nodeは薬局内LANで動作するローカル実行環境であり、ローカルDB、ローカルキュー、ローカル監査ログ、ローカル帳票出力、ローカル算定、薬局内連携を持つ。

システムモード:

- NORMAL: Cloud Core、Pharmacy Edge Node、External National Systems、Partner Systemsが利用可能
- EXTERNAL_DEGRADED: 外部公的システムが一部または全部利用不能
- CLOUD_DEGRADED: Cloud Coreが利用不能、Pharmacy Edge Nodeは利用可能
- LOCAL_ONLY: Cloud Coreと外部公的システムが利用不能、Pharmacy Edge Nodeのみで業務継続
- RECOVERY_SYNC: 障害復旧後、ローカルイベント、監査ログ、資格確認、PMH、電子処方箋、算定、請求、帳票、外部連携イベントを再検証・同期

LOCAL_ONLYでは、外部確認・外部登録・外部送信が必要な処理を成功扱いにしない。
LOCAL_ONLYの計算・帳票・受付には `PROVISIONAL_CALCULATION`、`PENDING_REVERIFY`、`PENDING_EXTERNAL_SYNC`、`PENDING_PMH_REVERIFY`、`LOCAL_ONLY_UNVERIFIED`、`MANUAL_REVIEW_REQUIRED` のいずれかを付与する。

RECOVERY_SYNCで不一致が出た場合は、自動補正せず `CONFLICT_REQUIRES_HUMAN_REVIEW` とする。

## 13. 24/365稼働と夜間バッチ停止廃止

yreseは24/365稼働を前提にする。
クラウド冗長性だけでは不十分であり、回線断、外部公的システム停止、Cloud Core障害、Edge Node障害、薬局内LAN障害でも、できる業務を止めない。

方針:

- Cloud CoreはMulti-AZ、stateless API、Aurora PostgreSQL、Blue/GreenまたはCanaryで設計する。
- API実行基盤はFargate / Lambda等を比較し、既存スタックを活かせるか検討する。
- 夜間バッチ停止を前提にしない。
- レセプト、請求、会計、監査、KPIはイベントから常時インクリメンタル投影する。
- 月次締めはclaim snapshot / claim lock / projection freezeとして実装する。
- 締め処理中も受付・調剤・会計・薬袋印刷など通常業務を止めない。
- マスター更新、算定ルール更新、帳票テンプレート更新はversioned / effective-dated / rollbackableにする。
- Cloud Core停止時はPharmacy Edge NodeがLOCAL_ONLYで最低限稼働する。
- PWA/local-first UI、ローカルキュー、ローカルDB、ローカル帳票、ローカル監査ログを持つ。
- 復旧後はRECOVERY_SYNCで再検証する。
- 在宅・夜間対応薬局を主要ユースケースとして扱う。

SLO候補はPhase 0で現実性、コスト、医療安全、薬局規模を踏まえて最終化する。

## 14. API-first dogfooding / PH-OS / OSS

yreseはAPI-firstで設計する。
yrese自身のUIも、外部パートナーと同じ公開API・イベント・権限モデルの上で動く。

方針:

- yrese UIは原則として公開APIをdogfoodingする。
- UI専用の非公開裏口APIを作らない。
- 管理者機能も監査可能なAPIとして設計する。
- Partner APIとInternal APIの境界を明確にする。
- undocumented APIを禁止する。
- OpenAPI、Event Catalog、Webhook、SDK、Sandbox、Contract Test Kitを用意する。
- partner appごとにscope、tenant、pharmacy、purpose-of-useを制御する。
- API利用状況、エラー率、連携遅延、失敗イベントを可視化する。

最初のリファレンス連携先を **PH-OS** とする。
yreseはSoR / System of Record / 事実の台帳、PH-OSは在宅業務・訪問業務・オペレーションレイヤーを担う。
PH-OSはyreseの公開APIとイベントを使い、専用裏口APIを作らない。
PH-OS連携で不足したAPIは汎用APIとして設計してから追加する。

公開可能な範囲で、API client SDK、event schema、webhook verifier、idempotency helper、sample integration app、contract test kit、JAHIS conformance test skeleton、sandbox data fixtureをOSS化する。
認証秘密情報、本番患者データ、本番薬局データ、セキュリティ上危険な内部運用情報、NSIPS仕様由来で許諾上公開できない情報、公式仕様の無断再配布に該当する情報は公開しない。

## 15. 監査ログ・WORM・マルチテナント

yreseは医療情報システムとして監査可能性を中核に置く。

方針:

- 監査ログはappend-only。
- 重要監査証跡は改ざん検知可能にする。
- 重要アーカイブはWORM相当保存を検討する。
- S3 Object Lock等の利用を検討する。
- 暗号化はKMS等を利用する。
- マルチテナントはtenant isolationを厳格に設計する。
- Aurora PostgreSQL Row Level Security等の適用可否を検討する。
- RLSだけに依存せず、アプリケーション層、DB層、監査層で多重防御する。
- サポートアクセスはbreak-glassと監査を必須にする。
- tenant_id、pharmacy_id、user_id、role、facility_basis_version、claim_owner、data_residency、tenant isolation test、cross-tenant access testを必須とする。

薬局間・法人間のデータ混在は重大事故として扱う。

## 16. 法令適合性・医療安全・UI/UX

yreseは一般的なSaaSではなく、日本の医療制度、保険制度、薬事制度、個人情報保護、医療情報安全管理の上で動作する医療関連システムである。

Phase 0で `legal_compliance_matrix.md`、`medical_safety_risk_register.md`、`safety_case.md`、`medical_ui_ux_principles.md` を作成する。

法令・通知・公式仕様・JAHIS標準・AWS公式仕様の最新版確認を計画に含める。
最新版確認結果、適用日、経過措置、旧版互換、廃止日をsource registryで管理する。
薬機法上のプログラム医療機器該当性が不明な場合は `BLOCKED_PMDA_SAMD_REVIEW` とする。

UI/UXは、患者安全、薬剤師確認、誤操作防止、誤調剤防止、誤請求防止、監査証跡、法令適合性、障害時誤認防止、入力効率、キーボード操作、現場デバイス対応を優先する。
外部確認未完了、オフライン、請求不可、仮算定、薬剤師確認前、PENDING系状態を成功扱いに見せてはならない。

## 17. 体験品質・性能・運用・移行

体験品質の最低基準:

- サクサク動く。
- 安定している。
- マニュアルがなくても一目で分かる。
- 入力の途中で迷わない。
- エラー時に次に何をすればよいか分かる。
- 重要な状態が見た瞬間に分かる。
- 障害時でも「できること」と「できないこと」が明確に分かる。
- 復旧後に何を再確認すべきか一目で分かる。

Phase 0で、experience_quality_baseline、performance_budget、usability_acceptance_criteria、stability_slo_policy、implementation_migration_plan、legacy_rececon_migration_matrix、parallel_run_and_cutover_plan、support_operations_model、device_compatibility_matrix、endpoint_management_policy、observability_plan、data_governance_policy、data_portability_exit_plan、go_no_go_checklist、service_operations_risk_register、finops_planを作成する。

既存レセコンからの移行、並行稼働、カットオーバー、ロールバック、旧システム参照期間、保存義務、件数照合、金額照合、薬剤師・請求実務者レビューをMVP計画に含める。
移行元データの意味を推測して取り込んではならない。
切替失敗時の戻し手順なしに導入してはならない。

## 18. データ主権・ポータビリティ

薬局データは薬局の業務資産である。
ベンダー都合で薬局が自局データを取り出せない状態を作らない。

患者、処方、調剤、算定、会計、領収証、請求、帳票、監査ログ、マスター適用履歴を適切に出力できる設計にする。
ExportにはPHI分類、権限、目的、出力者、出力日時、ハッシュ、暗号化、監査ログを必須とする。
直接DBアクセスではなく、監査可能なExport API / Export Job / Signed Archiveを使う。

## 19. Codex 単一レーン運用

エージェント運用はAGT-018に従い、Codex rootが次のroleを単一レーンで統率する。

1. **Codex root**: current state、acceptance criteria、current Work Package、role assignment、human gate、最終validation、landingに責任を持つ。
2. **code mapper / explorer**: read-onlyで関連SSOT、code、test、dependency、dirty state、impact radiusを特定する。
3. **pre-plan reviewer**: `implementation_planner` または `spec_guardian` として、実装前にSSOT、scope、edge case、test、rollback、human gateをread-onlyで確認する。
4. **sole maintainer (maker)**: active scopeで唯一のeditorとして、allowed filesだけに最小かつ完全な変更を実装する。
5. **independent verifier (checker)**: makerとは別contextで、diff、acceptance criteria、validation、security/privacy、data integrity、unrelated change混入をread-onlyで確認する。
6. **domain specialists**: 医療安全、privacy、security、DB/data integrity、API contract、UI/accessibility、test strategyなど対象領域をread-onlyでreviewする。

非自明な作業は `map -> pre-plan review -> sole-maintainer implementation -> independent verification -> domain review -> root landing` の順で行う。findingはsole maintainerへ戻し、修正後にcheckerが再検証する。

実装者と検証者を分離し、同一active scopeのeditorは常に1名とする。root自身が編集する場合はsole maintainerを兼ね、その間ほかのeditorを置かない。read-only調査だけを安全に並列化できる。

task assignmentはrole名で行い、未確認のmodel ID、製品名、能力、sandbox、permission、cloud availabilityを推測しない。exact runtime capabilityが必要なら実環境または公式情報で確認し、確認不能ならBLOCKER化する。別agentレーン、外部メッセージング、会話ログをassignment、approval、review、handoffの正本にしない。

法令、調剤報酬、薬学的妥当性、患者安全、production操作の最終判断はhuman authorityが保持し、Codex roleは代替しない。

## 20. 全layer所有と編集境界

Codex単一レーンは、次の全layerを担当できる。

- frontend: `apps/web/**`、UI package、routing、state、form、error/BLOCKER表示、LOCAL_ONLY / RECOVERY_SYNC表示、印刷、accessibility、E2E、frontend performance
- backend: `apps/api/**`、API controller / service / repository、authn/authz、audit、calculation、claim、master、report generation、Official Adapter、Cloud Core / Edge Node同期
- shared packages: `packages/**` のdomain、contracts、shared-kernel、money/date-time、trace、events、calculation、audit、security、fixture/test utility
- database / infrastructure: schema、migration source、repository adapter、`infra/**`、CI/CD、observability、performance/capacity。ただし適用・deployはhuman gateに従う
- SSOT / documentation: `docs/**`、`Plans.md`、`State.md`、ADR、API/event/schema catalog
- contracts / generated artifacts: OpenAPI、generated client/schema、contract fixture、E2E fixture。generated artifactは正規generator経由で更新し、手編集しない
- quality: unit、integration、contract、golden、UI workflow、accessibility、security、migration、performance testとvalidation scripts

layer別の別agent所有境界は設けない。current Work Packageの `owner_role` と `allowed_files` が編集所有を定め、Codex rootがsole maintainer 1名へexact path scopeを割り当てる。`forbidden_files`、unrelated dirty change、別Work Packageの差分は保持する。

`packages/* -> apps/*`、循環依存、共通概念・validation・算定ruleの二重実装は禁止する。frontend/backend/sharedの整合はSSOT、contracts、package boundary、testで強制する。

subagentはcommit/pushしない。independent verification後、Codex rootだけが `git status --short` とexact-path diffを確認し、owned exact pathだけをstageする。staged diffとvalidationを再確認してWP-ID付きでcommitし、現在の人間指示またはcurrent Work Packageが要求する場合だけpushする。

## 21. SSOT駆動開発

仕様決定後は、必ず種類に応じたSSOT文書を作成する。
実装者は承認済みSSOTとWork Packageを読んでから実装する。
SSOTにない仕様を、実装者が独自に補完してはならない。

SSOTステータス:

- `DRAFT`: 実装根拠にしてはならない。
- `PROPOSED`: 実装根拠にしてはならない。
- `APPROVED`: 実装根拠にしてよい。
- `IMPLEMENTED`: 実装に反映済み。
- `VERIFIED`: テスト・レビューで確認済み。
- `SUPERSEDED`: 後継SSOTに置換済み。
- `DEPRECATED`: 新規実装根拠にしてはならない。
- `BLOCKED`: 実装禁止。

SSOT共通メタデータには、ssot_id、title、domain、status、owner、reviewers、version、created_at、updated_at、effective_from、effective_to、source_refs、depends_on、impacts、related_work_packages、related_tests、related_prs、evidence_ids、change_log、open_questions、blockersを含める。

## 22. 共通モジュール駆動実装

共通モジュールは、SSOTで確定した仕様を、型、状態、エラー、金額、日付、監査、権限、API契約、バリデーション、fixturesとして再利用可能にする実装上の統制単位である。

共通化すべき概念:

- branded ID types
- tenant_id / pharmacy_id / patient_id / prescription_id / claim_id / event_id
- 保険・公費・PMH関連の共通型
- system mode
- PENDING系status
- BLOCKER種別
- error code / warning code
- audit event type
- permission scope / role name
- feature flag key
- API DTO schema / OpenAPI由来generated type
- Zod等のvalidation schema
- 金額・点数・Decimal helper
- 日付・時刻・タイムゾーン helper
- calculation_trace型 / legal_trace型 / evidence_id型
- sync event envelope / Outbox / Inbox event envelope
- common test fixtures / contract test fixtures / E2E fixtures

共通モジュールに置いてはならないもの:

- React / Next.js依存コードをbackend共通モジュールへ置くこと
- DB client / ORM / AWS SDK依存コードをfrontend共通モジュールへ置くこと
- UIコンポーネントをbackend共通モジュールへ混在させること
- backend serviceをfrontend共通モジュールへ混在させること
- 公式Adapter固有のレコード処理を汎用sharedへ混ぜること
- 規制・算定・請求ルールをUI側へ複製すること
- secret、credential、本番個人情報を含めること
- generated codeを手編集すること

依存方向違反は `COMMON_MODULE_DEPENDENCY_VIOLATION` として停止する。

## 23. Work Package運用

Phase 1以降、すべての作業をWork Packageとして発行する。
Work Packageがない実装、直接ファイル変更、探索的な本番コード変更は禁止する。

current Work Packageには、少なくとも次を含める。

- `work_package_id`、phase、title、priority、risk_level、status
- `root_role: codex_root`
- `owner_role`。編集作業では `sole_maintainer` とする
- `reviewer_roles`。少なくとも `independent_verifier` を含め、影響領域のspecialist roleを追加する
- mapper role、pre-plan reviewer role、必要なhuman authority
- ssot_refs、ssot_versions、evidence_ids、公式source、依存task
- 目的、背景、対象domain、acceptance criteria、想定failure、stop condition
- `allowed_files`、`forbidden_files`、unrelated dirty changeの保護方針
- implementation plan、test plan、review観点、rollback方法
- PHI/PII、security、medical safety、claim safety、data integrity、migration/deploy影響
- human gates、landing requirement、完了時record、remaining risk

mapper packetとpre-plan reviewをcurrent Work Packageまたはrepository内の追跡文書へ記録してからsole maintainerを割り当てる。`owner_role` と `reviewer_roles` を同一role/contextにしてはならない。

Work Package status:

- DRAFT
- READY_FOR_REVIEW
- READY
- IN_PROGRESS
- REVIEW_REQUESTED
- CHANGES_REQUESTED
- BLOCKED
- DONE
- CANCELLED

Codex rootだけが、mapper evidenceとpre-plan reviewを確認してDRAFTをREADYへ変更できる。
高リスクWork Packageは、必要なdomain specialistとhuman gateを `reviewer_roles` / human gatesへ明記し、事前reviewが完了するまでREADYまたは実装開始にしてはならない。

## 24. Definition of Ready / Done

Definition of Ready:

- 目的が1文で説明できる。
- 対象ドメインが明確である。
- 変更してよいファイルと変更禁止ファイルが明確である。
- 関連する公式資料または仕様根拠がある。
- evidence_idがある、または不要理由が明記されている。
- 受入条件がテスト可能である。
- ロールバック方法がある。
- PHI/PII影響が評価されている。
- 高リスク領域かどうか判定済みである。
- current Work Packageに `owner_role: sole_maintainer`、makerとは別contextの `reviewer_roles: [independent_verifier, ...]`、mapper、pre-plan reviewerが定義されている。
- mapperによるimpact mapとpre-plan reviewerによるSSOT・scope・test・human gate確認が完了している。
- 高リスク領域の場合、必要なdomain specialistとhuman authorityが特定され、事前reviewまたは承認が完了している。
- UI/UX影響、オフライン影響、外部公的システム影響が定義済みである。

Definition of Done:

- CI、typecheck、lint、unit test、integration test、relevant golden test、contract test、UI workflow test、medical safety UI test、accessibility test、performance budget testが必要範囲で通っている。
- legal compliance check、security scan、migration test、rollback手順、evidence_id、legal_trace、監査ログ設計、PHIログ非出力が確認済みである。
- OpenAPI、UI/UX、体験品質、SLO、device compatibility、migration/cutover、data governance、医療安全リスク台帳、ドキュメントが必要に応じて更新済みである。
- sole maintainerの変更を、変更作成に関与していないindependent verifierがread-onlyで確認済みである。
- required domain specialist reviewとhuman gateが完了し、findingが修正・再検証済みである。
- Work PackageがDONE判定可能で、repository内のhandoff recordに変更path、validation、remaining riskが記録済みである。
- Codex rootがunrelated dirty changeの非混入とexact-path staged diffを確認済みである。
- commit/pushがcurrent Work Packageまたは人間指示で要求される場合、root landingと`State.md`等の記録が完了している。

## 25. Codex native連携とrepository記録

assignment、mapper result、pre-plan review、handoff、verification、BLOCKERはCodex native orchestrationで受け渡し、重要決定と最終evidenceをrepository内のWork Package、SSOT、`Plans.md`、`State.md`、ADR、PR recordへ残す。
外部メッセージングや会話ログは正式仕様、ADR、法令根拠、医療安全証跡、承認記録に使用しない。

agent packet、prompt、review packet、repository recordに載せてはならないもの:

- PHI / PII
- 本番データ
- 未マスク医療情報
- 秘密鍵、API key、パスワード、電子証明書
- 接続先秘密情報
- NSIPS仕様本文
- 公式資料の有償・許諾制限付き本文
- 患者を特定できるログ

packetには必要最小限のcode path、synthetic/de-identified fixture、再現可能なevidenceだけを含める。secret、credential、token、private keyを含めない。

pre-plan reviewがrepositoryで追跡可能になる前に実装へ入ってはならない。完了時はcurrent Work Packageのhandoff recordに、変更概要、変更ファイル、test結果、残risk、重点review箇所、BLOCKER、ready_for_verificationを記録する。

## 26. Role配分とmodel非推測

- `codex_root`: 統率、曖昧性分解、current Work Package、role assignment、scope、quality/human gate、最終validation、landing
- `code_mapper` / `explorer`: read-only impact mapping、SSOT/code/test調査
- `implementation_planner` / `spec_guardian`: read-only pre-plan review
- `sole_maintainer`: active scopeの唯一の実装者。frontend、backend、shared、docs、DB/IaC、testのいずれも担当可能
- `independent_verifier`: makerから独立したread-only checker
- domain specialists: medical safety、privacy、security、DB/data integrity、API contract、UI/accessibility、test strategyのread-only reviewer

role assignmentにmarketing nameや推測したmodel IDを使用しない。active runtimeのmodel、reasoning tier、permission、sandbox、cloud availabilityを事実として必要とする場合だけ、実環境または公式情報で確認する。確認できない能力を前提にscopeまたはgateを設計してはならない。

法令、調剤報酬、レセプト請求、PMH、電子処方箋、オンライン資格確認、JAHIS、NSIPS、医療安全の最終判断を実装者に委ねてはならない。

## 27. 高リスク領域

高リスク領域:

- 法令適合性
- 医療安全
- 算定
- 一部負担金
- 保険請求金額
- 公費請求
- PMH
- 丸め処理
- レセプト出力
- 電子レセプト記録条件
- オンライン請求
- オンライン資格確認
- 電子処方箋
- 調剤結果送信
- HPKI
- JAHIS互換
- NSIPS Adapter
- マスター自動更新
- マスター有効日
- コードマッピング
- Cloud Core / Edge Node同期
- LOCAL_ONLY
- RECOVERY_SYNC
- 認証認可
- 監査ログ
- 個人情報
- 医療情報
- DB migration
- AWS deployment
- tenant isolation
- 請求確定画面
- 月次締め画面
- レセプト出力画面
- オフライン時のUI表示
- 患者取り違え防止UI
- 薬剤師確認UI
- 既存レセコンからの移行
- カットオーバー
- 並行稼働差分
- 現場デバイス連携
- データエクスポート・解約時返却
- サポートアクセス
- 性能SLO未達
- Work Packageなし、または `owner_role` / `reviewer_roles` / allowed filesなしの実装
- maker/checker未分離、required specialist未割当、human gate未定義の実装
- 複数editorによる同一scope・同一ファイルの競合
- independent verification前のstage / commit / push

高リスク領域は、実装前にpre-planと該当domain specialistによる設計review、実装後にindependent code review、test後に結果reviewを行う。法令・請求・薬学・患者安全、production変更、risk受容は明示human gateを通す。

## 28. 停止条件

以下の場合は実装せず停止する。

- 公式資料、仕様版、適用日、法令適合性、記録条件仕様、算定根拠、コードマッピング、公式接続可否が未確認。
- 外部システム仕様が医療機関等ONS確認待ち。
- NSIPS許諾が未取得。
- 公費計算、PMH仕様、医療機器プログラム該当性、オフライン運用可否が未確認。
- 薬剤師レビュー、請求実務者レビュー、セキュリティレビュー、医療安全レビューが必要なのに未実施。
- UIが外部確認未完了状態、請求不可データ、オフライン処理を誤認させる。
- UX改善が医療安全、法令適合性、請求正確性を損なう。
- 性能SLO、容量計画、現場デバイス互換性、導入移行、並行稼働、カットオーバー、ロールバック、データポータビリティ、サポートアクセス監査が未定義。
- current Work Package、`owner_role`、`reviewer_roles`、allowed files、forbidden filesが未定義。
- 実行に必須なpermission、sandbox、network、runtime capabilityが未確認。
- prompt、agent packet、fixture、log、commit、issue、外部serviceにPHI/PII、secret、本番データが混入した。
- 会話だけで正式仕様化または承認済み扱いにしようとしている。
- 複数editorの同時編集競合が未解決。
- LOCAL_ONLY範囲、RECOVERY_SYNC競合解決、package boundary、API契約SSOTが未定義。
- 実装者とレビュー者が分離されていない高リスクWork Package。
- required domain specialistまたはhuman gateが未完了。
- migration適用、production write、deploy、external send、email、batch、publish、delete、bulk operation、secret rotationを事前の明示human approvalなしに実行しようとしている。
- destructive git、force-push、履歴改変を明示human approvalなしに実行しようとしている。
- NSIPSの概念がCanonical Modelへ浸食している。
- NSIPSファイル連携をコアロジックとして扱っている。
- FHIRネイティブ方針とOfficial Adapter境界が未定義。
- 算定ルールをversioned rule dataではなくコード直書きしている。
- calculation golden testの根拠が未定義。
- イベント再投影で確定済み請求を人間承認なしに変更しようとしている。
- 夜間バッチのためにシステム停止を前提としている。
- yrese UIが公開APIをdogfoodingしていない。
- PH-OS連携が専用裏口APIに依存している。
- 公開KPIにPHI、薬局秘密情報、契約上非公開情報が含まれる。
- OSS SDKに許諾上公開できない仕様情報が含まれる。
- 監査ログの改ざん検知方針がない。
- tenant isolationがアプリケーション層だけに依存している。

停止時は、BLOCKER種別、対象機能、未確認資料、未確認法令、想定risk、医療安全影響、体験品質影響、work_package_id、owner_role、reviewer_roles、required specialist、必要なhuman gate、次に確認すべき資料、実装してはいけない範囲をrepository内のcurrent Work Packageへ記録する。

## 29. Phase 0 必須SSOT

Phase 0では、少なくとも以下を作成または更新する。

Agent / Governance:

- `docs/agents/codex_single_lane_operating_model.md` (AGT-018、唯一のactive agent operating SSOT)
- `work_package_template.md` (`root_role`、`owner_role`、`reviewer_roles`、allowed/forbidden files、human gatesを含む)
- `human_review_checklist.md` (法令、請求、薬学、患者安全、production操作のhuman authorityを定義)

mapper、pre-plan、sole maintainer、independent verifier、domain specialist、root landingの詳細を別文書へ分散・再定義しない。AGT-018を改版し、Phase 0以降も単一の運用正本として維持する。

Regulatory / Product / Safety:

- `source_registry.md`
- `version_watchlist.md`
- `legal_compliance_matrix.md`
- `regulatory_blockers.md`
- `mvp_scope.md`
- `non_mvp_scope.md`
- `risk_register.md`
- `medical_safety_risk_register.md`
- `safety_case.md`
- `human_review_checklist.md`

Architecture / Offline / Security:

- `bounded_contexts.md`
- `domain_model.md`
- `system_context.md`
- `aws_architecture.md`
- `data_model.md`
- `edge_node_architecture.md`
- `sync_design.md`
- `offline_mode_matrix.md`
- `recovery_sync_design.md`
- `security_guideline_mapping.md`
- `provider_security_guideline_mapping.md`
- `threat_model.md`
- `privacy_impact_assessment.md`
- `audit_log_design.md`
- `tenant_isolation_design.md`
- `edge_node_security_design.md`

Common Modules:

- `common_module_inventory.md`
- `common_module_boundary.md`
- `dependency_direction_policy.md`
- `shared_type_registry.md`
- `status_registry.md`
- `error_code_registry.md`
- `permission_scope_registry.md`
- `audit_event_registry.md`
- `event_envelope_schema.md`
- `money_point_policy.md`
- `date_time_policy.md`
- `validation_schema_policy.md`
- `fixture_policy.md`
- `generated_code_policy.md`

Calculation / Claim / Accounting / Receipt:

- `calculation_coverage_matrix.md`
- `calculation_engine_architecture.md`
- `calculation_pipeline.md`
- `canonical_prescription_model.md`
- `master_resolution_policy.md`
- `prescription_group_resolver_policy.md`
- `calculation_rule_dsl.md`
- `calculation_trace_schema.md`
- `fee_item_registry.md`
- `drug_fee_policy.md`
- `material_fee_policy.md`
- `selected_medical_care_policy.md`
- `facility_basis_policy.md`
- `claimability_status_policy.md`
- `calculation_golden_test_plan.md`
- `claim_scope_matrix.md`
- `electronic_receipt_design.md`
- `monthly_claim_workflow.md`
- `accounting_domain_model.md`
- `patient_receivable_policy.md`
- `payment_allocation_policy.md`
- `partial_payment_policy.md`
- `refund_adjustment_policy.md`
- `ar_status_registry.md`
- `daily_cash_closing_policy.md`
- `payment_method_registry.md`
- `pos_integration_policy.md`
- `facility_billing_policy.md`
- `accounting_audit_log_policy.md`
- `receipt_issuance_policy.md`
- `receipt_numbering_policy.md`
- `receipt_reissue_cancel_policy.md`
- `statement_issuance_policy.md`
- `receipt_template_registry.md`
- `receipt_privacy_policy.md`

Integration / JAHIS / Platform:

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
- `integration_hub_architecture.md`
- `partner_registry_policy.md`
- `data_sharing_module_inventory.md`
- `data_sharing_policy.md`
- `api_scope_registry.md`
- `webhook_event_catalog.md`
- `idempotency_policy.md`
- `partner_sandbox_policy.md`
- `contract_test_policy.md`
- `data_portability_policy.md`
- `adapter_registry.md`
- `jahis_applicability_matrix.md`
- `jahis_full_support_definition.md`
- `jahis_adapter_inventory.md`
- `jahis_version_watchlist.md`
- `jahis_conformance_test_plan.md`
- `jahis_character_encoding_policy.md`
- `jahis_code_mapping_policy.md`
- `jahis_roundtrip_test_policy.md`

yrese doctrine / FHIR / Always-on:

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
- `jp_core_fhir_platform_strategy.md`

UI/UX / Quality / Operations:

- `medical_ui_ux_principles.md`
- `workflow_map.md`
- `screen_inventory.md`
- `user_journey.md`
- `error_state_design.md`
- `offline_ui_design.md`
- `accessibility_policy.md`
- `ux_performance_policy.md`
- `experience_quality_baseline.md`
- `performance_budget.md`
- `usability_acceptance_criteria.md`
- `stability_slo_policy.md`
- `quality_plan.md`
- `validation_plan.md`
- `change_control_policy.md`
- `release_gate_policy.md`
- `test_strategy.md`
- `golden_test_catalog.md`
- `implementation_migration_plan.md`
- `legacy_rececon_migration_matrix.md`
- `parallel_run_and_cutover_plan.md`
- `support_operations_model.md`
- `sla_slo_policy.md`
- `performance_capacity_plan.md`
- `device_compatibility_matrix.md`
- `endpoint_management_policy.md`
- `observability_plan.md`
- `data_governance_policy.md`
- `data_portability_exit_plan.md`
- `go_no_go_checklist.md`
- `service_operations_risk_register.md`
- `finops_plan.md`

## 30. 初回出力ルール

初回応答では、コードを書かず、Phase 0の計画だけを出力する。
最後に次の文で停止する。

「Phase 0計画案を提示しました。人間レビュー後に次へ進みます。」
