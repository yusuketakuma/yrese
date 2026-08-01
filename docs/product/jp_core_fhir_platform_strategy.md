# JP Core / FHIR Ready 薬局データ連携基盤戦略

```yaml
ssot_id: PRD-007
title: JP Core / FHIR Ready 薬局データ連携基盤戦略
domain: product
status: APPROVED
approved_at: 2026-08-01
approved_by: "direct human authority 2026-08-01 (WP-4250 exact11 全て承認); round-5 independent verifier PASS on packet body with no HIGH finding (frozen packet ab086c9f8d6e6bfd26e32fbfe9daa21a3b8b6ccd3f324f413b4d2975731cfab6, base SHA 9d8dbc0c3f5201c762dbb39fd9b15fc3ddc4b875); round-5 security/privacy findings closed in Revision 14; round-5 data-integrity findings closed in Revision 13; codex second opinion unavailable until 2026-08-05 and not counted as evidence"
owner: codex_root
reviewers:
  - independent_verifier
  - product_strategy_reviewer
  - fhir_profile_reviewer
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - human_pharmacist_product_authority
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-07-31
effective_from: 2026-08-01
effective_to: null
amended_by: [ARC-008]
amendment_status: PENDING_REVISION
amendment_note: "WP-4250 PROPOSED draftで本文は改版済みだが、required reviewと最終human approval前のためrevision完了を先取りしない。ARC-008 amendsはfinalizationまで保持する。"
source_refs:
  - SRC-FHIR-001
  - SRC-FHIR-002
  - SRC-FHIR-003
  - SRC-FHIR-004
  - SRC-FHIR-005
  - SRC-FHIR-006
depends_on:
  - PRD-006(product_concept)
  - docs/spec/construction_prompt_v0.2.0.md
  - docs/regulatory/source_registry.md
impacts:
  - WP-0042
  - WP-0046
  - docs/domain/fhir_native_canonical_model.md
  - docs/domain/fhir_mapping_registry.md
  - docs/api/platform_api_architecture.md(WP-0046 で作成予定 — 前方参照)
related_work_packages:
  - WP-0042
  - WP-0046
  - WP-4250
related_tests:
  - pnpm check:ssot-index
  - git diff --check
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 7: MEDIUM-4訂正。package identityとcanonical URLがsource_registry未登録であることを明記しUNREGISTERED_PROVENANCE扱い、SRC-FHIR-002/003がHTMLページで裏付けにならないことを記録"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 6: bounded authorityのPatient cutover baselineとAPI-008/DB-005 wire/storage精密化を同期"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED: bounded hybrid authorityとverified package identity/non-conformance boundaryを追加"
  - "previous version 0.1.2 approval remains provenance only"
open_questions:
  - JP Core 1.2.0以外に薬局領域で参照すべきJP-CLINS/電子カルテ情報共有サービス向けFHIR記述資料の範囲
  - MedicationDispense等で表現しきれない薬局業務イベントをyrese event / Provenance / AuditEvent / 独自Extensionのどこへ分担するか
  - 外部向けに「JP Core準拠」と名乗れるconformance条件と検証ツール
blockers:
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile mapping / terminology mapping / conformance test 未定義のままJP Core準拠を訴求しない
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 電子処方箋、オンライン資格確認、PMH、JAHIS、電子レセプト、オンライン請求をFHIRで勝手に置換しない
  - BLOCKED_FHIR_TERMINOLOGY_AND_VALIDATION: terminology expansion/licensing、real validator、CapabilityStatement未完了
  - BLOCKED_PACKAGE_PROVENANCE: package artifactがsource_registryへ未登録のためpackage/profile identityを確定扱いしない(§4)
```

## 1. 結論

電子処方箋対応だけでは差別化しにくい。
厚労省公開情報では、2026年5月時点で9割以上の薬局に電子処方箋が導入済みとされ、基本対応はコモディティ化している(SRC-FHIR-001)。

一方で、調剤レセコンを **JP Core / FHIR Ready な薬局データ連携基盤** として設計することは差別化になり得る。
ただし「JP Core準拠です」という単体訴求では弱い。
打ち出すべき価値は、電子薬歴、PHR、電子お薬手帳、在宅、BI、AI、地域連携、電子カルテ情報共有サービスへ低コストでつながることである。

## 2. 前提: JP Core準拠と電子処方箋対応を混同しない

JP Core準拠は、選択した日本向けFHIR profileとterminologyに実際に適合することであり、package identityだけでは成立しない。
JP Core公開履歴では、JP Core 1.2.0 / FHIR R4 4.0.1がCurrent Versionとして示され、1.3.0-devは開発版である(SRC-FHIR-002)。
JP Core 1.2.0には、MedicationRequest、MedicationDispense、MedicationStatement等のMedicationグループプロファイルが含まれる(SRC-FHIR-003)。

電子処方箋対応は、電子処方箋管理サービスとの接続、処方・調剤情報参照、重複投薬等チェック、調剤結果登録、HPKI署名、リフィル処方箋などの制度・運用対応である(SRC-FHIR-004)。

したがって、電子処方箋対応済みのレセコンが、JP Core準拠のFHIR APIを持つとは限らない。
yreseはこの差分を将来の差別化**仮説**として検証する。現時点のsupport、
interoperability、conformance claimではない。

## 3. 差別化仮説

### 3.1 電子薬歴・PHR・電子お薬手帳との連携コストを下げる

薬局内のレセコン・電子薬歴連携では、JAHIS仕様やCSV/Shift-JIS等の既存実務寄りの形式が重要である。
JAHISの薬局レセコン・電子薬歴連携仕様は、薬局内システムの独自インターフェース乱立が業務支障になり得ることを背景に、共通的な連携仕様を目的としている(SRC-FHIR-005)。

yreseは、Official Adapterを尊重しつつ、内部では次の構成を目指す。

```text
Patient + oral/topical MedicationRequest candidate authority
  -> bounded /fhir/R4 authority API
internal authoritative domains + selected FHIR authority
  -> generic/public non-authoritative projection
  -> future electronic medication history / PHR / partner candidates
```

### 3.2 医療DXの次フェーズに乗る

電子カルテ情報共有サービスは、全国医療情報プラットフォームの仕組みの一つとして、全国の医療機関や薬局などで患者の電子カルテ情報を共有するための仕組みと説明されている。
2026年6月30日にはシステムベンダ向け技術解説書v2.1.0等も公開されており、仕様更新が継続している(SRC-FHIR-006)。

yreseが将来、薬剤情報・調剤情報を標準形式で流通させるハブになり得るかを
検証する。公式接続、public availability、相互運用性は未証明である。

### 3.3 チェーン薬局・多店舗・在宅で効く

FHIR / JP Core Readyは、単店よりも次の場面で価値が出やすい。

| 場面 | 価値 |
|---|---|
| 複数ベンダーの電子薬歴併用 | 独自I/Fごとの開発を減らす |
| M&A後の統合 | データ移行・比較・名寄せをしやすくする |
| 在宅・施設調剤 | 訪問記録、服薬フォロー、外部サービスへつなぎやすくする |
| BI・経営分析 | 調剤履歴、処方元、薬剤、患者属性を構造化して扱う |
| AI活用 | PDF・自由記載ではなくMedication系リソースを使える |

## 4. 推奨アーキテクチャ

全DBをFHIR化しない。候補FHIR格納正本はPatientとoral/topical MedicationRequestだけである。billing、calculation、claims、audit、accounting、reception、dispensingおよび非選択resourceはinternal authoritative modelを維持する。injection MedicationRequestはunsupported/unselected。

```text
Patient + oral/topical MedicationRequest -> /fhir/R4 direct authority API
internal authoritative models -> generic/public non-authoritative projections
PH-OS -> future generic/public projection consumer candidate
```

候補baselineはFHIR R4 4.0.1、`jpfhir.jp.core#1.2.0`、canonical base `http://jpfhir.jp/fhir/core`。Patientは`http://jpfhir.jp/fhir/core/StructureDefinition/JP_Patient` v1.2.0、oral/topical MedicationRequestは`http://jpfhir.jp/fhir/core/StructureDefinition/JP_MedicationRequest` v1.2.0。

2026-07-30取得package identityはSHA-256 `6094c8b9ebd975cb738c66cc999774c06a0aacf4480c068a8465e597117e52a3`、content-length 2391515、last-modified `2025-11-28T05:12:19Z`。published signature/checksumはなく、manifest `notForPublication`とfile URL不整合があるためauthenticity/conformance evidenceではない。Must Supportはderived IGへ委譲し、追加send/receive要件を推測しない。terminology expansion/licensing、real validator、CapabilityStatementはBLOCKED。

**provenance chainは未確立(MEDIUM-4 訂正)**: 上記のpackage hash/length/
last-modifiedと2つのStructureDefinition canonical URLは、
`docs/regulatory/source_registry.md`の**どのSRC entryにも登録されていない**。
本書frontmatterのSRC-FHIR-002は公開バージョン履歴の**HTMLページ**、
SRC-FHIR-003は実装ガイドの**indexページ**であり、いずれも状態`FETCHED`・
「ハッシュ未取得」である。§2でこの2件を根拠に述べているのは
「1.2.0 / R4 4.0.1がCurrent Versionであること」と
「Medicationグループプロファイルが含まれること」までであって、
**package artifactのidentityでもcanonical URL/versionのprovenanceでもない**。

したがって本batchでは上記identityを`UNREGISTERED_PROVENANCE`として扱い、
verified package identityともverified canonical identityとも呼ばない。解除には
package artifact自体(取得URL、取得日時、SHA-256、content-length、取得手段、
公式配布元の確認方法)を`source_registry.md`へ新規SRC entryとして登録し、
その`SRC-ID`を本節とDOM-006 §1.1から参照することを要する。
`source_registry.md`は本exact11 batchの対象外であるため、この登録は
**別のPRC-007改版**を要する`SSOT_UPDATE_REQUIRED`である。登録完了までは
`BLOCKED_PACKAGE_PROVENANCE`とし、package/profile identityを実装、
validator設定、profile固定、conformance主張の根拠にしない。

Patientはlive PostgreSQL sole authority→read-only shadow parity→human cutover→FHIR sole writer。MedicationRequestはcurrent runtime/store/writer/dataなしで、final approval、locked-profile validation、security prerequisites後のfirst accepted createからFHIR ingestion sole writer。dual-write、automatic fallback、migration/backfillはない。

JP Coreだけで薬局業務イベントを表現しきれる前提にしない。
疑義照会、後発変更、分割調剤、リフィル、在宅訪問、服薬フォロー、残薬調整、HPKI署名、監査ログ、請求確定、返戻再請求は、Official Adapter、JAHIS、電子処方箋仕様、yrese event、Provenance、AuditEvent、独自Extensionを組み合わせる。

## 5. 訴求方針

次はvalidation後の将来positioning候補であり、現時点では公開訴求しない。

1. 制度対応: 電子処方箋、リフィル、HPKI、重複投薬等チェック、電子カルテ情報共有サービス
2. 現場効率: 電子薬歴との一体運用、受付から調剤結果登録までの二重入力削減
3. 標準API候補: validation済みsubsetで電子薬歴、PHR等との接続可能性を検証
4. データ活用: チェーン薬局向けに調剤データ、服薬フォロー、処方元、薬剤別収益、残薬・アドヒアランスを横断分析

locked profile、terminology、validator、CapabilityStatement、security/privacy、
partner contract test、final human approvalが揃うまで、`FHIR対応`、`JP Core Ready`、
`接続可能`、`相互運用`、`conformant`をpublic support claimに使わない。最終表現は
これらのgate後に別途承認する。

## 6. 実装停止条件

- 電子処方箋対応をJP Core準拠と同一視している
- FHIR内部モデルでOfficial Adapter仕様を勝手に置き換えている
- JP Core / FHIR APIにprofile version、terminology mapping、conformance testがない
- Medication系リソースだけで薬局業務イベントを表現しきれる前提にしている
- 「JP Core準拠」を検証なしに営業・公開ドキュメントで訴求している
- source_registry へ未登録の package artifact identity や canonical URL を
  verified として扱い、実装・validator 設定・profile 固定の根拠にしている
  → BLOCKED_PACKAGE_PROVENANCE(§4)
- JAHIS / 電子処方箋 / オンライン資格確認 / PMH / 電子レセプト / オンライン請求の境界が未定義
- PHI/PIIを含むFHIR fixtureを公開・OSS化しようとしている

## 7. Plans.md連携

本書はWP-0042(FHIR canonical SSOT pack)とWP-0046(API-first platform SSOT pack)の上流プロダクト判断である。
WP-0042では本書の初期リソース候補と停止条件を、`fhir_native_canonical_model.md` と `fhir_mapping_registry.md` に落とし込む。
WP-0046では、bounded authority APIとgeneric projectionを分離したうえで、
将来のPartner API / Integration Hub / Sandbox / Contract Test Kit候補を検証する。

## 変更履歴

- 0.1.3 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.3 (2026-07-31 Revision 7): independent domain review の MEDIUM-4 訂正。
  §4 の package hash/length/last-modified と 2 つの StructureDefinition
  canonical URL が `source_registry.md` へ未登録であることを明記し、
  `UNREGISTERED_PROVENANCE` として verified 扱いを撤回。SRC-FHIR-002/003 が
  HTML ページであり package artifact identity も canonical URL provenance も
  裏付けないことを記録。package artifact の新規 SRC 登録を別 PRC-007 改版の
  前提とし、`BLOCKED_PACKAGE_PROVENANCE` と §6 停止条件を追加。
- 0.1.3 (2026-07-30 Revision 6): Patient cutover baselineと
  API-008/DB-005のbounded wire/storage精密化を同期。
- 0.1.3 (2026-07-30): WP-4250 PROPOSED。FHIR authorityをPatient + oral/topical MedicationRequestへ限定し、package identityとauthenticity/conformanceを分離、single-writer/cutoverとinjection unsupportedを明記。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_registry に記録のない版日付「2025-07-30版」の断定を削除・platform_api_architecture.md が前方参照であることを明記)。
- 0.1.0 (2026-07-09): ユーザー提供の市場・差別化分析を、公式ソース確認後にPRD-007として整理。
