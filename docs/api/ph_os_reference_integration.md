# ph_os_reference_integration — PH-OS リファレンス連携方針

```yaml
ssot_id: API-004
title: PH-OS を公開 API の最初のリファレンス利用者とする方針
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
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-07-31
amended_by: [ARC-008]
amendment_status: PENDING_REVISION
amendment_note: "WP-4250 PROPOSED draftで本文は改版済みだが、required reviewと最終human approval前のためrevision完了を先取りしない。ARC-008 amendsはfinalizationまで保持する。"
source_refs: [構築プロンプト v0.2.0 §14(API-first dogfooding / PH-OS / OSS), PRD-006(柱4), PRD-009(戦い4)]
depends_on: [API-002, API-003]
impacts: [WP-0036(Integration Hub), API-005]
related_work_packages: [WP-0046, WP-0036, WP-9002-W5A, WP-4250]
related_tests: [pnpm check:ssot-index, git diff --check]
related_prs: []
evidence_ids: []
change_log:
  - "0.1.3 2026-08-01 WP-4250 exact11 finalization: round-5の独立review三レーン完了(independent verifier PASS・本文HIGHなし)とdirect human approvalによりPROPOSED→APPROVED。本文semanticsは不変。承認範囲はSSOT改版のみであり、実装着手・schema/data migration・production action・conformance主張を含まない。登録済みblockerは全て据え置き"
  - "0.1.3 2026-07-31 WP-4250 PROPOSED Revision 7: HIGH-1訂正の同期。intake commandのunselected化がPH-OSのread-only projection consumer位置づけを広げないことを明記"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 6: FHIR write/history/search wire精密化はPH-OS generic projection contractを拡張しないことを確認"
  - "0.1.3 2026-07-30 WP-4250 PROPOSED Revision 3: PH-OSを将来のread-only generic projection consumer候補へ限定しwrite/intakeを禁止。旧0.1.2承認はprevious-version provenance"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: []
blockers: []
```

## 1. 目的と結論

公開 API の品質は、将来のcontract testと明示承認された実利用でのみ証明できる。
現時点ではPH-OS接続、support、interoperabilityを主張しない。

**結論: PH-OSはgeneric/public canonical projection APIの将来のreference
consumer候補である。投影はread-only・非正本で、`/fhir/R4/*` authority APIとは
別面である。**

ARC-008 §3.1により、external authoritative write producerは`/fhir/R4/*`ただ1つ
に確定し、separate intake command contractは本batchでunselectedとなった。この
変更はPH-OS側の位置づけを広げない。PH-OSは引き続きread-only projectionの
consumer候補であり、authority面へのwrite経路をいかなる形でも持たない。

API-008/DB-005 Revision 7のwrite producer確定、Patient create disabled、
retirement unsupported、snapshot bound、parse boundary、401/403分離、
authority epoch束縛、audit convergenceはいずれもauthority面だけの契約であり、
PH-OS投影へwrite、history authority、FHIR search、method advertisingを
追加しない。

## 2. 原則

1. **特別扱い API を作らない**: PH-OS 専用のエンドポイント・専用フィールド・専用認可を
   設けない。PH-OS が使うのは API-003 のgeneric/public non-authoritative projection APIと公開契約のみ。
   projection経由のwrite/intake/authority mutationは許可しない。
   **PH-OS が使えない API は他社パートナーも使えない**とみなし、契約側の欠陥として扱う。
2. **同一の onboarding**: PH-OS の接続手順(API キー発行・scope 付与・sandbox)は
   将来のパートナーと同一とする。Integration Hub(WP-0036)の Partner Sandbox /
   Contract Test Kit の最初の候補を PH-OS とする。
3. **非対称な依存の禁止**: yrese コアが PH-OS の存在・仕様に依存してはならない
   (依存方向は常に PH-OS → 公開 API の一方向)。PH-OS 都合の変更要望も
   CONTRACT_CHANGE_REQUEST 手順を通す。

## 3. フィードバックループの運用

1. PH-OS 側の接続で発見された契約の不足・不整合は、CONTRACT_CHANGE_REQUEST として
   起票し、該当契約 SSOT の改版(PRC-007)で解消する。口頭・非公式チャネルでの
   契約変更合意は無効とする。
2. 発見された欠陥と解消の記録は State.md / 該当 SSOT の変更履歴に残し、
   「リファレンス利用者で検証済み」を公開 API の品質根拠(QUA-007 の L4 系)として使えるようにする。
3. PH-OS 検証を通過していない契約バージョンを「検証済み」「接続可能」
   「supported」と対外表示しない(fail-closed)。

## 4. 停止条件(fail-closed)

- PH-OS 専用の抜け道 API・特別 scope の実装 → API_CONTRACT_BLOCKED(API-002 §2-2 と同一)
- コア側から PH-OS 仕様への依存の混入 → 実装せず本 SSOT へ差し戻し
- 未検証契約の「検証済み」表示 → BLOCKED(QUA-008 の証拠なき品質主張の禁止と同型)

## 変更履歴

- 0.1.3 (2026-08-01 finalization): round-5 の独立 review 三レーン完了
  (independent verifier は packet 本文 PASS・HIGH なし)と direct human approval に
  より PROPOSED → APPROVED。**本文 semantics は不変**。承認範囲は SSOT 改版のみで
  あり、実装着手・schema/data migration・production action・conformance 主張は
  含まない。登録済み blocker は全て据え置きである。
- 0.1.3 (2026-07-31 Revision 7): independent domain review の HIGH-1 訂正を同期。
  external authoritative write producer が `/fhir/R4/*` 単一へ確定し separate
  intake command contract が unselected になったことを反映し、それが PH-OS の
  read-only projection consumer という位置づけを広げないことを明記。
- 0.1.3 (2026-07-30 Revision 6): API-008/DB-005精密化がPH-OS
  read-only projection contractを拡張しないことを明記。
- 0.1.3 (2026-07-30): WP-4250 PROPOSED。PH-OSをgeneric/public non-authoritative projection consumerへ限定し、FHIR direct-authority面との混同を排除。
- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §14 へ修正)。
- 0.1.0 (2026-07-09): 初版起草(WP-0046)。
