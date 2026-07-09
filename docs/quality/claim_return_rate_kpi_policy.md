# claim_return_rate_kpi_policy — 返戻率KPI定義方針

```yaml
ssot_id: QUA-009
title: 返戻率KPIの定義方針(fail-closed 集計)
domain: quality
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.2.0 §10、PRD-006 product_concept(柱2: 返戻率KPI公開)
depends_on:
  - QUA-007 quality_transparency_strategy
  - QUA-008 public_quality_kpi_policy
  - RCP-系 レセプトSSOT(請求確定・返戻の業務定義)
  - CLM-001 claim_scope_matrix
blockers:
  - BLOCKED_LEGAL_REVIEW(公開実施は QUA-008 の前提条件に従い BLOCKED)
  - SSOT_UPDATE_REQUIRED(分母分子の確定は返戻業務フロー SSOT の APPROVED 範囲に依存)
open_questions:
  - 返戻の要因分類(記載不備 / 資格エラー / 算定内容 等)の分類体系と、要因別KPIの要否
  - 再請求後に通った返戻の扱い(累積返戻率 vs 最終返戻率の併記方針)
```

## 1. 目的

yrese が公開する中核品質KPI「返戻率」の定義方針を定める。本書は**定義の枠組みと
集計規律**を確定し、分母分子の業務的な確定は請求 SSOT(RCP系)の APPROVED 範囲に
従う — 請求・返戻の業務定義を本書が先回りして確定しない。

## 2. 定義の枠組み

- **返戻率 = 返戻レセプト件数 ÷ 請求確定レセプト件数**(件数ベースを既定とする。
  点数ベース併記の要否は open question)。
- **分母**: 対象請求月に**請求確定**したレセプト件数。「請求確定」の業務定義は
  RCP 系 SSOT の APPROVED 定義に従う。
- **分子**: 分母のレセプトのうち、審査支払機関から**返戻**として返送された件数。
  「返戻」の定義(査定との区別を含む)も RCP 系 SSOT に従う。返戻と査定は別KPIとし、
  混合した単一指標を作らない。
- **帰属月**: 返戻は元レセプトの請求月に帰属させる(返戻到着月ではない)。
  したがって公開値は確定までにラグを持ち、値は「集計時点」を必ず併記する。

## 3. fail-closed 集計規律

1. **確定データのみ**: 集計対象は月次請求確定を完了したレセプトのみ。
   下書き・請求前点検中・PENDING 系ステータス・BLOCKED のレセプトは分母に含めない。
2. **NORMAL モード確定のみ**: 請求確定は SystemMode = NORMAL でのみ許可される
   (shared-kernel `allowsClaimFinalization`)。この不変条件により、分母には
   NORMAL モードで確定したレセプトのみが入る。仮算定・LOCAL_ONLY 由来の未確定
   データが KPI に混入することはない(混入を検出した場合は集計を BLOCKED とする)。
3. **未確定は数えない**: 返戻かどうか不明なもの・処理中の返戻疑いは分子に含めない。
   分類不能なレコードを発見した場合、当該月の当該薬局の集計値を公開対象から除外する
   (推測で分類しない)。
4. **再集計の決定性**: 集計は「データスナップショット + 定義版数」から決定的に
   再計算可能であること(QUA-007 再現可能性原則)。集計ロジックにも calculation_trace
   相当の集計根拠記録を残す。
5. **遡及訂正**: 帰属月方式のため過去月の値は返戻到着により変動しうる。公開値の更新は
   訂正履歴付きで行う(QUA-008 §6)。

## 4. 公開条件

- 公開の可否・匿名化・同意・契約は QUA-008 の一般方針に完全に従う(本書で緩和しない)。
- 分母が最小集計単位(閾値は QUA-008 改版で確定)未満の集計は公開しない。
- 公開時は定義版数・集計時点・「返戻≠過失」の説明文を必ず併記する。

## 5. 非範囲

- 返戻業務フロー(受領・要因分類・再請求)の実装仕様 — RCP 系 SSOT の範囲
- 具体的な公開頻度・閾値・媒体 — QUA-008 の決定手順に従い改版で確定
- 査定率・その他KPIの定義 — 必要になった時点で別 SSOT として起案
