# calculation_trace_read_contract — calculation_trace 読取契約(SCR-012 表示)

```yaml
ssot_id: API-007
title: calculation_trace 読取契約(SCR-012 表示・QUA-007 L2 初UI)
domain: api
status: APPROVED
approved_at: 2026-07-10
approved_by: opus4.8 review + fable5
effective_from: null
effective_to: null
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-10
updated_at: 2026-07-11
source_refs:
  - docs/quality/quality_transparency_strategy.md(QUA-007 §2 L2 過程の証明)
  - docs/uiux/screen_inventory_draft.md(SCR-012)
depends_on:
  - CAL-008(calculation_trace_schema — trace スキーマの正本)
  - MOD-004(shared_type_registry — branded ID / 型の正本)
  - QUA-007(L2 透明性の要件)
  - API-001(patient_search_contract — 契約規約・contract-first の先例)
  - API-006(reception_queue_contract — 契約規約の先例)
impacts:
  - WP-3011(SCR-012 calculation_trace ビューア)
  - packages/contracts(calculation-trace.ts の追加)
  - apps/web(SCR-012 コンポーネント)
related_work_packages: [WP-3011, WP-3011a, WP-9002-W5A]
related_tests:
  - packages/trace/src/trace.test.ts
  - packages/contracts/src/calculation-trace.test.ts
  - apps/web/app/components/calculation-trace-view.test.tsx
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - trace を返すエンドポイントのパス・キー(calculationResultId)は算定結果契約(算定エンジン解禁後)で確定する。本契約は trace ペイロードの読取表現と不変条件を確定し、結線はそちらへ委譲する。
blockers:
  - 算定エンジンは copay 等 evidence 未発行で BLOCKED。live な trace 生成経路の実装は evidence 発行後。本契約と SCR-012 ビューアは合成 fixture で先行する(L2 表示層の先行整備)。
```

## 1. 目的と位置づけ

SCR-012「calculation_trace 表示」の**読取契約**を確定する。QUA-007 §2 の L2「過程の証明」を可視化する初 UI であり、
任意の算定について「なぜこの点数か」を evidenceRef 付きで再構成して提示する。calculation_trace は
薬剤師・事務・請求担当・監査・レセプト点検・返戻対応の**共通言語**(CAL-008 §1)であり、本契約はその
**表示のための読取表現**を contract-first で固定する。

本契約は **表示のみ(read-only)**。trace の生成・改変の経路は定義しない(生成は算定エンジン=packages/calculation、
正本スキーマは CAL-008 / @yrese/trace)。

## 2. 正本と非再定義(二重実装の禁止)

- **trace 構造の正本は @yrese/trace 実装(CAL-008)である。** 本契約の zod スキーマは @yrese/trace の
  `CalculationTrace` / `CalculationTraceStep` / `EvidenceRef` / `CalculationInputsSummary` を**写像**するものであり、
  型・enum・不変条件をローカル再定義しない(COMMON_MODULE_DUPLICATION_BLOCKED の対象)。
- enum 値(`EVIDENCE_SOURCE_TYPES` / `TRACE_ID_REF_KINDS` / `TRACE_DATE_REF_KINDS` /
  `CALCULATION_TRACE_STEP_STATUSES`)は @yrese/trace の const tuple を単一の出所とし、契約側で値を手書きしない。
- 契約が @yrese/trace とドリフトした場合は本契約の改版(PRC-007)で追従する。契約テストで写像の一致を機械検査する(§8)。

## 3. 読取表現(wire schema)

応答本体は `CalculationTrace` の JSON 表現とする。フィールドは @yrese/trace と 1:1:

| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| inputsSummary | InputsSummary | ○ | ids / dates / masterVersions / ruleVersions?。**PHI 非包含**(§5) |
| masterVersion | string | ○ | 当時有効なマスター版 |
| calculationRuleVersion | string | ○ | 算定ルール版(L3 版の証明と接続) |
| steps | TraceStep[] | ○ | 導出ステップ列。空配列可(BLOCKED 時) |
| warnings | string[] | ○ | 警告(空配列可) |
| blockers | string[] | ○ | 停止理由(空配列可)。非空なら算定は未確定 |
| evidenceIds | string[] | ○ | steps から収集した evidence_id の集合(@yrese/trace が導出) |

TraceStep(`CalculationTraceStep` の写像):

| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| stepId | string | ○ | `{evidence_id}:{slug}` |
| description | string | ○ | 人間可読の説明 |
| affectsClaim | boolean | ○ | 請求に影響するか |
| evidenceRefs | EvidenceRef[] | ○ | **affectsClaim=true なら 1 件以上**(§7 で読取側も強制) |
| inputRefs | string[] | ○ | 参照した入力の識別子 |
| output | string | ○ | 人間可読サマリー |
| feeItemCode | string | — | 算定項目コード |
| formula | string | — | 計算式の宣言的表現(**PHI 非包含**) |
| intermediateValues | Record<string,string> | — | 中間値。**金額・点数は bigint 由来の文字列**(float 禁止)。**PHI 様キー禁止**(§5) |
| rounding | { method: string; evidenceId: string } | — | 存在時は evidenceId 必須(CAL-008 §2 の自己完結ルール) |
| stepStatus | CALCULATION_TRACE_STEP_STATUSES(applied/suggested/excluded/blocked) | — | 候補/確定/除外/停止。**値集合は @yrese/trace の同 const tuple を正とし契約側で手書きしない**(§2) |
| resultPoints | string | — | bigint 文字列 |
| resultYen | string | — | bigint 文字列 |

EvidenceRef(`EvidenceRef` の写像): `evidenceId` / `sourceType`(EVIDENCE_SOURCE_TYPES)/ `title` / `version?` /
`effectiveFrom?`。**`url` を持たない**(URL は source_registry が正本 — @yrese/trace が型で禁止)。

InputsSummary(`CalculationInputsSummary` の写像。**PHI 非包含** — ids / 診療系日付 / 版のみ、氏名・自由記述を持たない):

| フィールド | 型 | 必須 | 備考 |
|---|---|---|---|
| ids | TraceIdRef[] | ○ | 算定に入った ID 参照 |
| dates | TraceDateRef[] | ○ | 算定に入った診療系日付 |
| masterVersions | TraceMasterVersionRef[] | ○ | 当時有効マスター版の参照 |
| ruleVersions | TraceRuleVersionRef[] | — | 算定ルール版の参照 |

- TraceIdRef: `kind`(TRACE_ID_REF_KINDS = tenant / pharmacy / patient / prescription / dispensing / claim / device / event)/ `id`(string)
- TraceDateRef: `kind`(TRACE_DATE_REF_KINDS = prescription_date / dispensing_date / reception_date / claim_month / service_date)/ `value`(string。暦日または請求月)
- TraceMasterVersionRef: `masterName`(string)/ `version`(string)
- TraceRuleVersionRef: `ruleName`(string)/ `version`(string)

nested 型の enum(`TRACE_ID_REF_KINDS` / `TRACE_DATE_REF_KINDS`)も @yrese/trace の const tuple を単一の出所とし、
契約側で値を再定義しない(§2)。TraceIdRef.id は branded ID の wire 表現(生 string)であり、PHI(氏名等)を載せない。

数値表現は全て**文字列**(金額・点数は bigint 由来)とし、契約に浮動小数点数フィールドを置かない(MOD-010)。

## 4. アクセス・権限

- 権限は `calculation:read`(deny-by-default。requirePermission で強制。UI のみの制御禁止)。
  `calculation` リソースの PERMISSION_RESOURCES 登録状況の正本は MOD-007。未登録スコープは deny-by-default で
  fail-closed に落ちる。本契約の transport 結線時に `calculation:read` が登録済みであること(未登録なら MOD-007 改版で追加)を
  確認する。権限結線の最終確定はエンドポイント結線(open_questions)と同じく算定結果契約側で行ってよい。
- テナント文脈(tenantId + pharmacyId)に拘束する。テナント越えの trace 読取 API を作らない(DB-003 と同型)。
- trace は表示のみ。書込・改変の経路は本契約に存在しない。

## 5. PHI 不変条件(fail-closed)

- calculation_trace は**型レベルで PHI を排除**する(@yrese/trace: inputsSummary は ids/日付/版のみ、
  intermediateValues は PHI 様キー〔patient/name/address/phone/tel/email/free_text/memo〕を実行時拒否)。
  本契約はこの排除を**緩めない**。契約に氏名・住所・電話・自由記述・患者可読名のフィールドを追加しない。
- 表示側(SCR-012)は trace 本文以外の PHI(患者氏名等)を trace ビューへ**合成しない**。患者文脈が必要なら
  別の権限付き経路で解決し、trace ペイロードには載せない。
- `formula` / `output` / `description` は PHI を含まない前提(生成側 @yrese/trace / packages/calculation が保証)。
  読取側はこれらをそのまま表示してよいが、**表示時にリンク化・外部送信をしない**(evidence の URL 化は禁止)。

## 6. 状態と空・エラー

| 状態 | 表現 |
|---|---|
| trace あり(確定/仮) | 上記 wire schema。`blockers` が空なら確定候補、非空なら未確定 |
| 算定 BLOCKED | trace は `steps` に blocked step を含むか、`blockers` 非空で返す(「根拠不足で止まる」を可視化)。空の捏造をしない |
| trace 未生成・対象なし | 404 相当(エラーコード registry の該当コード)。空の trace を成功として返さない(fail-closed) |

- エラー本文は error code registry(shared-kernel)の登録コードのみを可視化する(未登録コードの verbatim 表示禁止 —
  WP-3007a の規律と同型)。

## 7. 読取側の最小検証(表示の安全性)

- 受領した trace を表示する前に、**affectsClaim=true かつ evidenceRefs 空**の step を「正当な確定根拠」として
  表示しない(生成側で起きない不変条件だが、契約境界でも fail-closed に扱い、異常として明示する)。
- `rounding` が存在して `rounding.evidenceId` を欠く step は異常として扱う(CAL-008 §2)。
- 未知の `sourceType` / `stepStatus` は不明表示にフォールバックし、既定で「適用済み・正当」に見せない(allow-list)。

## 8. 契約テストの要件

- zod スキーマ ⇔ @yrese/trace 型の**写像一致**を検査(enum 値集合の一致、必須/optional の一致)。
- 代表 fixture(合成・PHI-free)で round-trip(parse→型)を検査。affectsClaim=true→evidenceRefs≥1 を満たす
  正常 fixture と、それを破る異常 fixture の双方を用意し、異常は表示側で弾く。
- OpenAPI 生成(check:openapi)に read スキーマを載せる場合も PHI フィールドが現れないことを確認する。

## 9. 停止条件(fail-closed)

- 契約への PHI フィールド(氏名・住所・電話・自由記述等)追加 → 実装禁止(§5)
- EvidenceRef への `url` 追加・trace 由来値の外部リンク化 → 禁止(source_registry 正本)
- 浮動小数点数フィールドの追加(金額・点数)→ 実装禁止(MOD-010)
- @yrese/trace の enum をローカル再定義 → COMMON_MODULE_DUPLICATION_BLOCKED
- affectsClaim=true・evidence 空の step を正当表示 → CHANGES_REQUESTED(§7)
- テナント越え trace 読取 API → 実装禁止(§4)

## 変更履歴

- 0.1.0 (2026-07-10): 初版起草(WP-3011)。@yrese/trace / CAL-008 を正本とした読取表現・PHI 不変条件・アクセス権限・fail-closed 表示規律を定義。エンドポイント結線は算定結果契約へ委譲。opus4.8 レビュー反映(§3 InputsSummary サブテーブル追加・stepStatus を CALCULATION_TRACE_STEP_STATUSES 参照へ・§4 calculation:read の MOD-007 provenance 追記)後、APPROVED 昇格。
