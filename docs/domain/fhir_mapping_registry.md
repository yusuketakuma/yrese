# fhir_mapping_registry — canonical model ↔ FHIR/JP Core マッピング台帳

```yaml
ssot_id: DOM-006
title: canonical model ↔ FHIR/JP Core マッピング台帳(枠組み)
domain: domain
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: PRD-007(SRC-FHIR-001..006 経由), 構築プロンプト v0.2.0 §17, §22
depends_on: [PRD-007, DOM-005, ADP-001, ADP-002]
impacts: [WP-0046]
open_questions: conformance 検証ツールの選定(PRD-007 open_question を継承)
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 公的接続系を FHIR マッピングで置換しない(§4)
```

## 1. 目的

canonical model(DOM-002/DOM-005)と FHIR/JP Core プロファイル間の変換を、**登録済みマッピングのみ実装可**とするための台帳の枠組みを定める。
本書は台帳の形式・登録手順・検証ゲートのみを定義し、**マッピング実体は含まない**(実体は個別 WP で公式仕様裏付けの上で登録する — evidence 規律と同型)。

## 2. 台帳形式

マッピングは 1 エントリ = 1 (canonical 概念, FHIR リソース/要素) 対応とし、次のフィールドを必須とする。

| フィールド | 内容 |
|---|---|
| mapping_id | `MAP-FHIR-<4桁連番>`(採番は owner=fable5 のみ) |
| canonical_ref | DOM-002 の集約・属性への参照 |
| fhir_resource | 対象リソース(例: MedicationDispense) |
| fhir_profile | JP Core プロファイル名 + **プロファイルバージョン**(例: JP Core 1.2.0 / FHIR R4 4.0.1) |
| direction | `projection`(canonical→FHIR)/ `intake`(FHIR→canonical)/ `both` |
| terminology | 使用するコード体系・ValueSet と、コードマッピングの根拠(§22 コードマッピング規律に従い CODE_MAPPING_REVIEW_REQUIRED の対象) |
| loss_notes | 変換で失われる/近似される情報の明示(無損失なら `none`) |
| source_ref | 公式仕様の根拠(source_registry.md の SRC-ID) |
| evidence_id | 請求・算定に影響するマッピングでは必須(evidence_register の ID)。それ以外は source_ref のみで可と明記して省略できる |
| conformance_status | UNVERIFIED / VERIFIED(検証ツール・手順は open_question。UNVERIFIED のまま「JP Core 準拠」を訴求しない) |
| valid_from / valid_to | 有効期間(effective-dating)。版切替は既存エントリの書き換えではなく新エントリ起案+旧エントリの valid_to 設定・DEPRECATED 化で行う(§3-5 と整合) |
| status | DRAFT / PROPOSED / APPROVED / DEPRECATED |

台帳本体は本書の後続版(または `fhir_mapping_entries/` 配下の分割ファイル)に APPROVED エントリのみを正本として保持する。

## 3. 登録手順と検証ゲート

1. **起案**: 個別 WP でエントリを DRAFT 登録。source_ref 必須(公式仕様の裏付けなしに登録不可)。
2. **レビュー**: terminology を含むエントリは CODE_MAPPING_REVIEW_REQUIRED、業務影響が高いもの(請求・調剤記録)は opus4.8 レビュー必須。
3. **承認**: status を APPROVED に。実装は APPROVED エントリのみ参照可。
4. **検証ゲート**(実装時):
   - 変換実装は mapping_id を参照し、台帳外変換は実行時拒否(audit registry と同型の allow-list 方式)
   - projection の往復テスト(canonical → FHIR → canonical で loss_notes 以外の情報が保存されること)
   - FHIR validator / conformance test によるプロファイル適合検証(ツール選定は open_question — 未選定の間、「JP Core 準拠」の訴求は BLOCKED_FHIR_CONFORMANCE_REVIEW)
5. **改版**: JP Core / プロファイルのバージョン更新時は既存エントリを自動で読み替えず、新バージョン向けエントリを別途起案する(旧エントリは DEPRECATED)。

## 4. Official Adapter 境界(置換禁止)

**FHIR マッピングは Official Adapter(ADP-001)の代替ではない。** 次は別レーンであり、本台帳の対象外とする。

| 系統 | 従うべき仕様 |
|---|---|
| オンライン資格確認 | 公式外部IF仕様(ONS 経由入手 — BLOCKED_OFFICIAL_ADAPTER_SPEC) |
| 電子処方箋管理サービス | 公式仕様(HPKI 署名・調剤結果登録等を含む) |
| オンライン請求・電子レセプト | 公式仕様(CSV/UKE 等の指定形式) |
| PMH | 公式仕様 |
| JAHIS 連携(レセコン・電子薬歴) | JAHIS 仕様書 |
| NSIPS(薬局内機器連動) | NSIPS ライセンスと ARC-003 の隔離境界(ACL)。薬局内機器連動を FHIR facade スコープに取り込まない |

これらの接続を「JP Core で表現できるから」と FHIR facade へ寄せる変更は BLOCKED_OFFICIAL_ADAPTER_BOUNDARY とし、実装せず SSOT へ差し戻す。
FHIR facade が扱うのは、電子薬歴・PHR・電子お薬手帳・BI・在宅・partner SaaS 等、**公式指定形式が存在しない連携面**のみである(PRD-007 §4)。

## 5. 停止条件(fail-closed)

- source_ref のないエントリ登録 → 登録不可
- 台帳外・DRAFT/PROPOSED エントリに基づく変換実装 → SSOT_UPDATE_REQUIRED
- Official Adapter 系統の FHIR 置換 → BLOCKED_OFFICIAL_ADAPTER_BOUNDARY
- プロファイルバージョン無指定のマッピング → 登録不可
- conformance 未検証での「JP Core 準拠」訴求 → BLOCKED_FHIR_CONFORMANCE_REVIEW

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(v0.2.0 §7 指定の evidence_id / conformance_status / valid_from / valid_to を台帳必須フィールドへ追加・§4 置換禁止レーンに NSIPS を追加)。
- 0.1.0 (2026-07-09): 台帳の枠組み・登録手順・Official Adapter 境界を初版起草(WP-0042)。マッピング実体は未登録。
