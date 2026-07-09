# fhir_native_canonical_model — canonical model と FHIR/JP Core の関係方針

```yaml
ssot_id: DOM-005
title: canonical model と FHIR/JP Core の関係方針
domain: domain
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
source_refs: PRD-007(SRC-FHIR-001..006 経由), 構築プロンプト v0.2.0 §12, §17
depends_on: [PRD-007, DOM-001, DOM-002, ADP-001, ADP-002, MOD-009(event_envelope_schema)]
impacts: [DOM-006, WP-0046]
open_questions: PRD-007 open_questions を継承(JP-CLINS参照範囲 / 業務イベントの表現分担 / conformance条件)
```

## 1. 目的と結論

yrese 内部の正本データモデル(canonical model)と FHIR/JP Core リソースの関係を確定する。

**結論: canonical model ≠ FHIR。FHIR/JP Core は外部連携用の「表現(Facade / 投影)」であり、内部の正本ではない。**
(本書名の fhir_native は「外部連携面が FHIR ネイティブであること」を指し、内部モデルの FHIR 化を意味しない。)

```text
yrese domain/event store(正本)
  -> canonical clinical/dispensing model(DOM-002 の集約群)
  -> terminology / code mapping layer
  -> JP Core / FHIR facade(投影 — 本書の対象境界)
  -> 外部連携(電子薬歴 / PHR / 電子お薬手帳 / BI / 在宅 / partner SaaS)
```

## 2. 原則

1. **正本は DOM-002 のドメインモデル**。集約・不変条件・状態遷移(DOM-004)は FHIR リソース構造に依存しない。FHIR リソースを内部永続化スキーマとして直採用しない(いきなり全DBをFHIR化しない — PRD-007 §4)。
2. **FHIR facade は読み取り側投影**。canonical model から FHIR 表現への変換は一方向の投影として実装し、FHIR 側の構造変更が canonical model を汚染しない(腐敗防止層)。外部から FHIR で受信するデータも、facade で canonical model へ変換してから取り込む。
3. **変換は DOM-006(fhir_mapping_registry)に登録されたマッピングのみ**。台帳外の暗黙変換は実装禁止。
4. **JP Core で表現しきれない業務イベントを FHIR に無理に押し込まない**。疑義照会・後発変更・分割調剤・リフィル・在宅訪問・服薬フォロー・残薬調整・監査ログ・請求確定・返戻再請求は、yrese event / Official Adapter / JAHIS / Provenance / AuditEvent / 独自 Extension の分担で扱う(分担確定は PRD-007 open_question — 未確定のまま実装しない)。
5. **金額・点数・日付は共通パッケージが正本**。FHIR 投影時も @yrese/money / @yrese/date-time の値から導出し、facade 層で浮動小数点に落とさない(丸め・単位変換が必要な場合はマッピング台帳に明記)。

## 3. PHI 分類・暗号化との整合

FHIR リソースは Patient / MedicationDispense 等、ほぼ常に PHI を含む。次を不変条件とする。

- FHIR 表現を **イベントエンベロープ(@yrese/events)で運ぶ場合、phiClassification は none 以外**を指定する。events パッケージの実行時不変条件(PHI≠none → encryptionStatus 'encrypted' 必須)がそのまま適用される。
- FHIR リソース(JSON)を**ログ・trace・agmsg・エラーメッセージへ平文出力しない**(SEC-004 と同一規律)。
- FHIR fixture・サンプルに本番個人情報を使わない。PHI/PII を含む FHIR fixture の公開・OSS 化は禁止(PRD-007 §6)。
- facade API のアクセス制御は apps/api の deny-by-default 権限(requirePermission)配下に置き、テナント境界(tenant_id + pharmacy_id)を FHIR 検索パラメータより優先して強制する。

## 4. 対象リソースの優先順位

初期対象は PRD-007 §4 の候補表に従う(高: Patient / Coverage / MedicationRequest / MedicationDispense / MedicationStatement、中: Practitioner / PractitionerRole / Organization / AllergyIntolerance / Condition)。
本書では優先順位のみを引き継ぎ、**個々のフィールドマッピングは定義しない**(DOM-006 の台帳へ、公式仕様裏付けの上で個別 WP として登録する)。

## 5. 停止条件(fail-closed)

- DOM-006 台帳に未登録のリソース・フィールド変換を実装しようとした → SSOT_UPDATE_REQUIRED
- FHIR リソース構造を集約・永続化スキーマとして直採用しようとした → BLOCKED
- profile version / terminology mapping / conformance test なしに「JP Core 準拠」を訴求 → BLOCKED_FHIR_CONFORMANCE_REVIEW(PRD-007)
- Official Adapter 領域(オン資・電子処方箋・オンライン請求・PMH・JAHIS)を FHIR で置換しようとした → BLOCKED_OFFICIAL_ADAPTER_BOUNDARY(境界の詳細は DOM-006 §4。NSIPS は ARC-003 の隔離境界に従い、本 facade スコープに取り込まない)
- PHI を含む FHIR 表現の平文ログ・平文イベント → 実装禁止(events 実行時例外)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(events 参照を MOD-009 へ訂正・§5 列挙に JAHIS/NSIPS 境界を追記・書名 fhir_native の意味を明確化)。
- 0.1.0 (2026-07-09): PRD-007 を上流として初版起草(WP-0042)。
