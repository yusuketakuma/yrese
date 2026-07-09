# JP Core / FHIR Ready 薬局データ連携基盤戦略

```yaml
ssot_id: PRD-007
title: JP Core / FHIR Ready 薬局データ連携基盤戦略
domain: product
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-10
amended_by: [ARC-008]
amendment_status: PENDING_REVISION
amendment_note: "ARC-008(APPROVED 2026-07-10)により改版予約中。方向は ARC-008 が暫定的に優先する。本文の全面改版は Phase 1 の PRC-007 10段フローで実施し本注記を解除する。"
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
open_questions:
  - JP Core 1.2.0以外に薬局領域で参照すべきJP-CLINS/電子カルテ情報共有サービス向けFHIR記述資料の範囲
  - MedicationDispense等で表現しきれない薬局業務イベントをyrese event / Provenance / AuditEvent / 独自Extensionのどこへ分担するか
  - 外部向けに「JP Core準拠」と名乗れるconformance条件と検証ツール
blockers:
  - BLOCKED_FHIR_CONFORMANCE_REVIEW: profile mapping / terminology mapping / conformance test 未定義のままJP Core準拠を訴求しない
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 電子処方箋、オンライン資格確認、PMH、JAHIS、電子レセプト、オンライン請求をFHIRで勝手に置換しない
```

## 1. 結論

電子処方箋対応だけでは差別化しにくい。
厚労省公開情報では、2026年5月時点で9割以上の薬局に電子処方箋が導入済みとされ、基本対応はコモディティ化している(SRC-FHIR-001)。

一方で、調剤レセコンを **JP Core / FHIR Ready な薬局データ連携基盤** として設計することは差別化になり得る。
ただし「JP Core準拠です」という単体訴求では弱い。
打ち出すべき価値は、電子薬歴、PHR、電子お薬手帳、在宅、BI、AI、地域連携、電子カルテ情報共有サービスへ低コストでつながることである。

## 2. 前提: JP Core準拠と電子処方箋対応を混同しない

JP Core準拠は、日本向けFHIRプロファイルに沿ってPatient、Coverage、MedicationRequest、MedicationDispense、MedicationStatement等を扱えるようにすることである。
JP Core公開履歴では、JP Core 1.2.0 / FHIR R4 4.0.1がCurrent Versionとして示され、1.3.0-devは開発版である(SRC-FHIR-002)。
JP Core 1.2.0には、MedicationRequest、MedicationDispense、MedicationStatement等のMedicationグループプロファイルが含まれる(SRC-FHIR-003)。

電子処方箋対応は、電子処方箋管理サービスとの接続、処方・調剤情報参照、重複投薬等チェック、調剤結果登録、HPKI署名、リフィル処方箋などの制度・運用対応である(SRC-FHIR-004)。

したがって、電子処方箋対応済みのレセコンが、JP Core準拠のFHIR APIを持つとは限らない。
yreseはこの差分をプロダクト上の差別化軸として扱う。

## 3. 差別化仮説

### 3.1 電子薬歴・PHR・電子お薬手帳との連携コストを下げる

薬局内のレセコン・電子薬歴連携では、JAHIS仕様やCSV/Shift-JIS等の既存実務寄りの形式が重要である。
JAHISの薬局レセコン・電子薬歴連携仕様は、薬局内システムの独自インターフェース乱立が業務支障になり得ることを背景に、共通的な連携仕様を目的としている(SRC-FHIR-005)。

yreseは、Official Adapterを尊重しつつ、内部では次の構成を目指す。

```text
yrese canonical domain model
  -> JP Core / FHIR facade
  -> electronic medication history / PHR / e-medication notebook / BI / homecare / partner SaaS
```

### 3.2 医療DXの次フェーズに乗る

電子カルテ情報共有サービスは、全国医療情報プラットフォームの仕組みの一つとして、全国の医療機関や薬局などで患者の電子カルテ情報を共有するための仕組みと説明されている。
2026年6月30日にはシステムベンダ向け技術解説書v2.1.0等も公開されており、仕様更新が継続している(SRC-FHIR-006)。

yreseは「請求・入力システム」だけではなく、薬剤情報・調剤情報を標準形式で流通させるハブとして設計する。

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

いきなり全DBをFHIR化しない。
yreseでは、Canonical Core と Official Adapter の境界を保ったうえで、FHIRは外部連携用Facadeまたは標準データ出力レイヤーとして扱う。

```text
yrese domain/event store
  -> canonical clinical/dispensing model
  -> terminology/code mapping layer
  -> JP Core / FHIR facade API
  -> partner API / export / BI / PHR / e-medication notebook / homecare SaaS
```

初期優先リソース候補:

| 優先度 | FHIRリソース | 用途 |
|---|---|---|
| 高 | Patient | 患者基本情報 |
| 高 | Coverage | 保険・公費情報 |
| 高 | MedicationRequest | 処方指示 |
| 高 | MedicationDispense | 調剤・払い出し記録 |
| 高 | MedicationStatement | 服薬状況・薬剤情報共有 |
| 中 | Practitioner / PractitionerRole | 薬剤師・医師情報 |
| 中 | Organization | 薬局・医療機関 |
| 中 | AllergyIntolerance | アレルギー |
| 中 | Condition | 傷病・疾患情報、電子カルテ情報共有サービス側連携 |

JP Coreだけで薬局業務イベントを表現しきれる前提にしない。
疑義照会、後発変更、分割調剤、リフィル、在宅訪問、服薬フォロー、残薬調整、HPKI署名、監査ログ、請求確定、返戻再請求は、Official Adapter、JAHIS、電子処方箋仕様、yrese event、Provenance、AuditEvent、独自Extensionを組み合わせる。

## 5. 訴求方針

「FHIR対応」単体ではなく、次の順で訴求する。

1. 制度対応: 電子処方箋、リフィル、HPKI、重複投薬等チェック、電子カルテ情報共有サービス
2. 現場効率: 電子薬歴との一体運用、受付から調剤結果登録までの二重入力削減
3. 標準API: JP Core / FHIR Readyで電子薬歴、PHR、電子お薬手帳、在宅支援、BI、AIサービスと接続可能
4. データ活用: チェーン薬局向けに調剤データ、服薬フォロー、処方元、薬剤別収益、残薬・アドヒアランスを横断分析

最終的なプロダクト表現は「電子処方箋対応レセコン」ではなく、**JP Core / FHIR Readyな薬局データ連携基盤** とする。

## 6. 実装停止条件

- 電子処方箋対応をJP Core準拠と同一視している
- FHIR内部モデルでOfficial Adapter仕様を勝手に置き換えている
- JP Core / FHIR APIにprofile version、terminology mapping、conformance testがない
- Medication系リソースだけで薬局業務イベントを表現しきれる前提にしている
- 「JP Core準拠」を検証なしに営業・公開ドキュメントで訴求している
- JAHIS / 電子処方箋 / オンライン資格確認 / PMH / 電子レセプト / オンライン請求の境界が未定義
- PHI/PIIを含むFHIR fixtureを公開・OSS化しようとしている

## 7. Plans.md連携

本書はWP-0042(FHIR canonical SSOT pack)とWP-0046(API-first platform SSOT pack)の上流プロダクト判断である。
WP-0042では本書の初期リソース候補と停止条件を、`fhir_native_canonical_model.md` と `fhir_mapping_registry.md` に落とし込む。
WP-0046では、JP Core / FHIR facadeをPartner API / Integration Hub / Sandbox / Contract Test Kitと接続する。

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_registry に記録のない版日付「2025-07-30版」の断定を削除・platform_api_architecture.md が前方参照であることを明記)。
- 0.1.0 (2026-07-09): ユーザー提供の市場・差別化分析を、公式ソース確認後にPRD-007として整理。
