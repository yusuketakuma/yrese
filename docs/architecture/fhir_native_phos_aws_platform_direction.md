# fhir_native_phos_aws_platform_direction — FHIR ネイティブ・PH-OS 連携・AWS プラットフォーム方針

```yaml
ssot_id: ARC-008
title: FHIR ネイティブ(ハイブリッド)・PH-OS 汎用投影・AWS プラットフォーム方針
domain: architecture
status: APPROVED
approved_at: 2026-07-10
approved_by: opus4.8 (APPROVED_READY) + 人間承認(2026-07-10) + fable5
owner: fable5
reviewers:
  - opus4.8
  - 人間承認済み(2026-07-10)
version: 0.1.2
created_at: 2026-07-10
updated_at: 2026-07-10
source_refs:
  - ユーザー実装親プロンプト(2026-07-10「PH-OS接続FHIRネイティブ・レセコン実装」)
  - ユーザー方針決定(2026-07-10 AskUserQuestion: FHIR=ハイブリッド / PH-OS=汎用投影 / インフラ=AWS移行)
depends_on: [PRD-006, PRD-007, DOM-005, API-004, PRC-007]
amends: [PRD-007, DOM-005, API-004, DB-001, DB-002, DB-003, DB-004, ARC-005, ARC-007]
impacts:
  - API-003(platform_api_architecture — /fhir/R4 facade + 汎用投影 API の新 API 面)
  - packages/contracts(CapabilityStatement・投影契約を contract-first 単一正本へ)
  - SEC-006(JWT 認可・テナント取得の拡張)/ SEC-008(本番認証・分離方式の独立ゲート)
  - 新規 SSOT: AWS 基盤設計 / DynamoDB single-table 設計 / FHIR ストア・CapabilityStatement 設計 / DOM-006 拡張(FHIR extension) / 汎用投影 API 契約
  - WP: Phase 1..6(FHIR 契約・REST API・投影・Claim/レセ電・電子処方箋・テスト)
open_questions:
  - DynamoDB single-table の key 設計と FHIR/レセコン関係データの access pattern(専用設計 SSOT で確定)
  - Cognito/API Gateway JWT Authorizer の claim 設計(tenant_id/role/user_id)と本番認証解禁(SEC-008 セキュリティレビューと同期)
  - PostgreSQL→DynamoDB の段階移行の具体手順(動く実装を即撤去しない前提)
  - DynamoDB 製品確定そのもの(下記 §2 の派生設計判断。access pattern 検証 + BLOCKED_SECURITY_REVIEW の解除後に確定)
blockers:
  - BLOCKED_SECURITY_REVIEW: 本番 Cognito 認証・KMS(保存時暗号化)・S3/DynamoDB のテナント分離方式(IAM 条件キー等)の確定はセキュリティレビュー完了後(SEC-008 §3 と同期)
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile/terminology/conformance test なしに JP Core 準拠を訴求しない(PRD-007 継承)
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 電子処方箋・オン資・オンライン請求・PMH・JAHIS・レセ電・NSIPS(ARC-003 隔離境界)を FHIR で置換しない(DOM-005/DOM-006 継承)
  - BLOCKED_LEGAL_REVIEW: 監査・会計・確定レセプト/確定請求の保存年限未確定(DB-004 継承。削除しない側に倒す)
```

## 1. 目的

ユーザー実装親プロンプト(2026-07-10)とそれに伴う方針決定を、既存 SSOT との整合を取りつつ**アーキテクチャ方針として確定**する。本書は複数の APPROVED SSOT を改版する上位方針であり、各 SSOT 本体の改版は本書を根拠に **§9 のカスケード順序**に従って行う(SSOT-first / fail-closed)。

## 2. 決定の記録(2026-07-10)

**ユーザー確定判断**(AskUserQuestion):

| # | 論点 | ユーザー決定 |
|---|---|---|
| 1 | FHIR の位置づけ | **ハイブリッド**: 臨床/外部向けリソースは FHIR を格納正本とし FHIR REST API で提供。算定・請求確定・レセ電・監査の内部コアは非 FHIR 正本を維持 |
| 2 | PH-OS 向け API | **汎用投影 API に一般化**(partner 中立・PH-OS を最初の利用者・専用抜け道禁止 — API-004 の原則維持) |
| 3 | インフラ | **AWS スタックへ移行** |

**fable5 派生設計判断(未確定・§8/open_questions のゲート対象)**: AWS 具体構成として Cognito(JWT)/ API Gateway(JWT Authorizer)/ DynamoDB single-table / S3 を第一候補とする。**製品確定(特に DynamoDB 採用)は access pattern 検証 + BLOCKED_SECURITY_REVIEW 解除後**であり、ユーザー必須決定ではない(AWS への移行方針のみがユーザー確定)。

## 3. 目標アーキテクチャ(格納正本と投影の一意な境界)

```text
[認可] Cognito JWT -> API Gateway JWT Authorizer -> AuthContext(tenant_id/role/user_id)
        認可は常に JWT/AuthContext。body/query/path/FHIR meta.security/extension の tenant を信用しない(SEC-006)

[格納正本 — 単一格納。集約ごとに正本は1つ]
  A. 臨床/外部リソース = FHIR R4 / JP Core を「格納正本」とする
     (Patient/Coverage/Medication/MedicationRequest/MedicationDispense/Organization/Practitioner/PractitionerRole/Location/DocumentReference 等)
     - meta.versionId + 楽観ロック(If-Match)。保存は暗号化必須(§6)
     - この格納正本を提供/更新する面が FHIR REST facade(/fhir/R4/*)。**FHIR REST は正本の直接読み書き面であり「再生成可能な非正本投影」ではない**
     - 外部から FHIR で受信するデータは、取込境界(ACL)で検証・正規化してから格納正本へ反映(腐敗防止は「取込方向」に働く)
  B. 算定・請求確定・レセ電・監査 = 非 FHIR 内部正本コア(@yrese/calculation / claim / money / date-time / trace / audit)
     - 算定/請求は A の臨床リソースを「入力として読む」。A を二重格納しない
     - FHIR Claim は請求候補の中間表現 -> 内部 BillingLine -> レセ電 CSV(日本仕様。FHIR で請求を完結しない)
     - 監査は非FHIR内部正本(append-only + ハッシュチェーン)。FHIR Provenance を公開する場合は「内部監査の投影」であり内部監査正本を置換しない(§6)

[読取投影 — 非正本・A/B から再生成可能]
  汎用投影 API(BFF。partner 中立、PH-OS が最初の利用者)。処方カード投影・取込エンドポイント等
  (FHIR REST facade は §A の正本面であり、この投影層には含めない)

[基盤] DynamoDB single-table(候補)/ S3 / CloudWatch(構造化ログ・PHI 非出力)
```

- **調剤(MedicationDispense)の straddle 解決**: 調剤の**格納正本は §A の FHIR MedicationDispense(単一格納)**。算定・請求(§B)は MedicationDispense を**入力として読む**のみで再格納しない。これにより「臨床=FHIR正本 / 算定=非FHIR正本」の境界が調剤集約でも一貫し、§6 二重実装禁止と衝突しない。
- 既存の非FHIR実装(Patient/Reception)は §A へ寄せる(FHIR Patient 化 + Reception は Appointment/Task 等へ写像 or 内部保持)。**Reception の写像先(Appointment/Task か内部保持か)は未確定の設計選択であり、FHIR ストア設計 SSOT で確定する**(本書では決定しない)。移行は §7・§9 に従い cutover まで二重権威を作らない。
- **§A のリソース列挙は例示**である。正式な対象リソース集合・優先順位は FHIR ストア設計 SSOT / DOM-006(および PRD-007 §4 / DOM-005 §4 の優先表)で確定する(§3 の列挙と §4「優先順位は維持」の粒度差は設計 SSOT 側で吸収する)。

## 4. 改版が必要な既存 SSOT(§9 の順序で実施)

- **PRD-007**(jp_core_fhir_platform_strategy): §4「FHIR=Facade のみ・全DBをFHIR化しない」を「ハイブリッド(臨床/外部リソースは FHIR 格納正本、内部コアは非FHIR)」へ改版。§6 停止条件(conformance なしの準拠訴求禁止等)は維持。
- **DOM-005**(fhir_native_canonical_model): **§2 原則1(FHIR を内部永続化スキーマに直採用しない)と §2 原則2(FHIR facade は読取側投影・外部 FHIR を canonical へ変換して取込・ACL)を改版**し、臨床/外部リソースについて「FHIR が格納正本、ACL は取込方向に働く」へ再定義。**§2 原則3(DOM-006 台帳のみ)・原則4(業務イベント分担 — 疑義照会/後発変更/在宅/監査/請求確定等は yrese event/Provenance/AuditEvent/Extension)・原則5(money/date は共通パッケージ正本)・§3 PHI・§5 停止条件は維持**。§4 リソース優先順位は維持。
- **API-004**(ph_os_reference_integration): PH-OS を「汎用投影 API の最初の利用者」と再定義。投影 API 追加を許容しつつ partner 中立・非正本・専用抜け道禁止(§2/§4)を維持。
- **DB-001〜004**: **DB-001 は「製品中立(PostgreSQL は例示)」を、ユーザー AWS 決定に基づき DynamoDB 第一候補へ狭める**(製品確定自体は独立ゲート — 保存時暗号化・分離方式は BLOCKED_SECURITY_REVIEW 継続)。金額整数・DB now() 禁止・append-only・テナント必須・enum は正本参照等の**不変規律は維持**。DB-002 マイグレーション規律・DB-003 テナント分離・DB-004 保存削除を DynamoDB 文脈で再定義(§6 の DynamoDB 固有ガードを反映)。
- **ARC-005**(event_sourcing_architecture): 永続化技術 BLOCKED(§5)を本 ADR が DynamoDB 方向で上位判断する。ES イベントストアの DynamoDB 実現に append-only・リプレイ決定論(CAL-009/010)・時刻トリガー自動実行禁止(ARC-011)・WORM 志向を継承要件として改版。
- **ARC-007**(claim_finalization_immutability): 確定請求 append-only ストアが DynamoDB へ移ることを反映(§6 TTL 禁止・保存時暗号化を継承)。

## 5. 新規に必要な SSOT(Phase 1 で起草)

- AWS 基盤設計(Cognito/API Gateway/実行基盤/S3/CloudWatch、IaC 方針)
- DynamoDB single-table 設計(key 設計・access pattern・GSI・テナント分離 PK・IAM 条件キー)
- FHIR ストア・CapabilityStatement 設計(サポート resource/interaction、meta.versionId、If-Match、OperationOutcome、Content-Type application/fhir+json)
- 汎用投影 API 契約(処方カード投影・dispense-workflow/residual/risk-review/claim-candidate 取込。命名は中立)— packages/contracts 単一正本(API-003 / contract-first)
- **JWT 認可・テナント取得は SEC-006 の拡張**として設計(新規独立 SSOT でなく SEC-006/008 に接続)
- FHIR extension は **DOM-006 の拡張**として台帳登録(packaging-instruction / set-method / set-target / residual-used / phos-card-link / source-system 等)

## 6. 維持する不変条件(方針転換でも緩めない)

- **認可はJWT/AuthContext**。body/query/path、および FHIR meta.security/extension の tenant_id を認可根拠にしない。全 DB クエリにテナント文脈(SEC-006)。
- **テナント越えを通常系で権限的に不可能にする**(DB-003 §4 の critical 要件)。DynamoDB では RLS が無いため、**IAM 条件キー(`dynamodb:LeadingKeys` 等)+ テナント別 PK 前提の接続ロール分離**を DB-003 §4 の DynamoDB ネイティブ代替として要件化する(確定は BLOCKED_SECURITY_REVIEW)。多層防御の DB 層を AWS 移行で暗黙に消さない。
- **純粋コアは persistence-agnostic を維持**(MOD-003・CLAUDE.md「packages/* は runtime-neutral」)。DynamoDB 結合は**永続化アダプタ層に限定**し、calculation/money/date-time/trace/audit の純粋コアは DynamoDB を知らない(check:boundaries が機械強制)。
- **PHI 非露出 + 保存時暗号化**: FHIR リソース(PHI をほぼ常に含む)・PHI をログ/trace/agmsg/エラーへ平文出力しない(SEC-004/DOM-005 §3)。**FHIR 格納正本ストアは保存時暗号化必須**(鍵運用=KMS は BLOCKED_SECURITY_REVIEW)。MOD-009 封筒不変条件(phiClassification≠none → encryptionStatus 'encrypted'、違反 throw)を継承。fixture は合成のみ(MOD-013)。
- **evidence 規律**: 算定・請求・帳票は evidence_id 裏付け必須。FHIR 化しても点数根拠なしに算定しない(算定エンジンは BLOCKED 継続)。
- **Official Adapter 境界**: 電子処方箋・オン資・オンライン請求・PMH・JAHIS・レセ電・**NSIPS(ARC-003 隔離境界)**を FHIR で置換しない(BLOCKED_OFFICIAL_ADAPTER_BOUNDARY)。レセ電最終出力は FHIR でなく日本のレセ電仕様/マスターコード/CSV。
- **監査 append-only + ハッシュチェーン**: WP-5004a の監査 core を維持。永続化先が DynamoDB でも append-only(UPDATE/DELETE 不可)・prevHash を永続 tip から採番・外部アンカー可能構造(SEC-007/008)。**FHIR Provenance を公開する場合は内部監査の投影であり内部監査ハッシュチェーン正本を置換しない**(監査正本の二重化防止)。
- **金額・点数・日付**: @yrese/money / date-time が正本。浮動小数点禁止。DB now() のビジネスカラム禁止(アプリ供給タイムスタンプ)。
- **二重実装の禁止**: enum/status/money/date/validation を共通パッケージ正本から再利用。集約ごとの格納正本は単一(§3)。DynamoDB 側で独自 enum を定義しない。
- **公式情報確認**: FHIR R4 / JP Core / 厚労省 / 支払基金の一次情報を確認してから実装(推測実装禁止)。

## 7. 段階移行方針(fail-closed)

- **動く PostgreSQL 実装(WP-5002/5003)を即撤去しない**。DynamoDB single-table 設計 SSOT を先に確定・レビューし access pattern を検証してから移行する。
- **移行中も集約ごとの格納正本は常に単一**。他方(構築中)は非正本とし cutover まで権威にしない(二重権威・二重書きの恒常化を禁止)。
- WP-5004a(監査 hash core、純粋ロジック)は永続化非依存のため維持。WP-5004b(永続化)は DynamoDB 設計確定後に再アサイン。
- 本番 AWS 認証(Cognito)・KMS・分離方式の確定は BLOCKED_SECURITY_REVIEW(SEC-008 §3 と同期)。それまで dev スタブは本番起動拒否(WP-4056 の fail-closed 継承)。

## 8. 停止条件

- 認可を body/query/path/FHIR meta の tenant で行う → 実装禁止(§6)
- 算定・請求・レセ電・監査の内部正本を FHIR に置換 → BLOCKED(ハイブリッドの範囲外。§3)
- 同一集約を FHIR 正本と内部正本に二重格納 → 実装禁止(§3・§6 二重実装)
- **append-only・法定保存アイテム(監査/会計台帳/確定レセプト/確定請求)への DynamoDB TTL(自動失効)設定 → 実装禁止**(物理削除と同一、DB-004/SEC-008 違反。BLOCKED_LEGAL_REVIEW 継承)
- 純粋コアへの DynamoDB 直結合 → CHANGES_REQUESTED(persistence-agnostic 違反、§6)
- PH-OS 専用の抜け道 API・専用 scope → API_CONTRACT_BLOCKED(API-004 §4 継承)
- DynamoDB 設計 SSOT 未確定のまま PostgreSQL 正本を撤去 → SSOT_UPDATE_REQUIRED(§7)
- 一次情報未確認の FHIR/レセ電/電子処方箋実装 → SSOT_UPDATE_REQUIRED(推測実装禁止)

## 9. 改版カスケードの順序(APPROVED 同士の矛盾回避 — fail-closed)

`amends` は現行 PRC-007 の標準メタデータに無い。APPROVED になった ARC-008 と、旧 APPROVED 本文(FHIR=投影)のままの PRD-007/DOM-005 が併存すると、実装者が旧本文を読んで誤実装する(APPROVED 同士の矛盾 = fail-closed BLOCKED)。これを防ぐため:

1. **ARC-008 の APPROVED 昇格と同一バッチで**、改版対象(PRD-007/DOM-005/API-004/DB-001..004/ARC-005/ARC-007)に **version bump + フロントマターへ「ARC-008 により改版中(方向は ARC-008 が暫定的に優先)」注記**を即時付与する。旧本文を単独で権威化しない。
2. 各本体の完全改版(PRC-007 の10段フロー)を Phase 1 で順次実施し、注記を解除する。
3. 併せて **PRC-007 を改版**し、`amends`(上位方針 ADR による改版予約)と暫定権威(ADR APPROVED が対象 SSOT 再版まで優先)を正式定義する。
4. 個別実装 WP は、**step1(同一バッチの注記付与)および step3(PRC-007 改版で `amends`/暫定権威を正式定義)の完了まで**着手しない(SSOT-first)。step1 の「暫定優先」注記が step3 の PRC-007 裏付けを得る前に実装が始まる循環を閉じる。

## 変更履歴

- 0.1.2 (2026-07-10): opus4.8 再レビュー(APPROVED_READY)の任意文言改善 R1-R3 を反映(再レビュー不要と明言済み)。R1: §9 step4 の実装ゲートに step1 に加え step3(PRC-007 改版)完了を明記し、暫定優先注記が PRC-007 裏付け前に実装が始まる循環を閉じた。R2: §3 §A のリソース列挙が例示であり正式集合は FHIR ストア設計 SSOT / DOM-006 で確定する旨を追記(§4 優先表との粒度差の吸収先を明示)。R3: Reception の写像先(Appointment/Task か内部保持か)が未確定の設計選択で設計 SSOT で確定する旨を明示。方針・不変条件・fail-closed 性に変更なし。人間承認(2026-07-10「承認して実行」)取得により PROPOSED→APPROVED 昇格、§9 改版カスケード(PRD-007/DOM-005/API-004/DB-001..004/ARC-005/ARC-007 の改版予約注記 + PRC-007 改版)を同一バッチで実行。
- 0.1.1 (2026-07-10): opus4.8 レビュー反映。§3 の FHIR 正本/投影の自己矛盾を一意化(FHIR REST=格納正本の直接面、汎用投影のみ非正本層)+ 調剤 straddle の単一格納正本を確定。§4 DOM-005 改版スコープ精密化(原則2 投影方向も改版、構造誤参照訂正、DB-001 は製品中立→DynamoDB へ)。§6 に DynamoDB 固有ガード追加(persistence-agnostic 維持・保存時暗号化+MOD-009・IAM LeadingKeys の DB-003§4 代替・Provenance 投影・NSIPS 追加)。§8 に TTL 物理削除禁止。§9 改版カスケード順序を新設(amends の fail-closed 担保)。amends/impacts に ARC-005/ARC-007/API-003 追加。§2 でユーザー確定(AWS)と派生設計(DynamoDB 等)を分離。
- 0.1.0 (2026-07-10): ユーザー実装親プロンプト + 方針決定を ARC-008 として起草。
```
