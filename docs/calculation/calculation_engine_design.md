# calculation_engine_design — 算定エンジン設計

```yaml
ssot_id: CAL-004
title: 算定エンジン設計(集計セマンティクス・ルール粒度・copay境界)
domain: calculation
status: APPROVED
owner: fable5
reviewers:
  - opus4.8 (APPROVE_WITH_CHANGES 2026-07-09 → 全指摘反映済み)
  - human_review_if_required
version: 0.2.1
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: opus4.8レビュー反映後、fable5承認(人間の包括承認 2026-07-09 の範囲内)
source_refs: [CAL-001, CAL-002, CAL-003, MOD-010, 構築プロンプト v0.2.0 §18]
depends_on: [CAL-003(evidence_register), MOD-010(money_point_policy)]
impacts: [packages/calculation, WP-2101b]
```

## 1. 目的

WP-2101a の骨格が `SSOT_UPDATE_REQUIRED` で停止している「複数 CALCULATED ルールの集計セマンティクス」を定義し、
evidence 発行済み(CAL-003)の算定項目に限定した最初の CalculationRule 実装(WP-2101b)を可能にする。

## 2. 集計セマンティクス

- ルールは**項目単位**とし、`ItemCalculatedStepResult`(新設)として **項目点数(itemPoints: Points)** を返す。
- エンジンは全項目点数を **合算(sum)** して `total: Points` を得る。合算は Points の add のみで行い、丸めを伴わない。
- **本SSOTのスコープ外(opus4.8指摘#1)**: 乗率(注3「100分の80」EVD-CAL-0007、多剤逓減「100分の90」EVD-CAL-0068)、減算(▲5点等)、合計への下限クランプ(注16「3点未満なら3点」EVD-CAL-0020)は**未定義**であり、これらを要するルールの実装は本SSOTの改版まで禁止する。WP-2101b の対象ルールは「独立・固定点数・加算のみ」に限定する。
- 既存の「単一ルールが total/patientCopay を直接返す」形(CalculatedStepResult)は廃止し、判別unionから除去する。**移行手順**: 既存テスト(空ruleset→BLOCKED / 複数CALCULATED→SSOT_UPDATE_REQUIRED)のうち前者は維持、後者は新セマンティクスのテスト(重複適用検知)に置換し、置換理由をテストコメントに記録する。
- **重複適用の検知(opus4.8指摘#8-2)**: 重複判定は ruleId 単独ではなく **(ruleId, applicationKey)** の組で行う。applicationKey は適用対象の識別子(剤=RP単位の識別子等)であり、「1剤につき」型の項目(EVD-CAL-0021 内服薬: 24点、**4剤分以上は算定しない=3剤分まで**)は異なる applicationKey での同一 ruleId 適用を正当とする。同一 (ruleId, applicationKey) の2回目は BLOCKED。上限回数は evidence 記載の文言どおりにルール定義側で宣言し(EVD-CAL-0021 なら上限3適用)、超過はエンジンが BLOCKED にする。
- **排他グループ(opus4.8指摘#4)**: 併算定不可は `exclusivityGroup` で表現し、同一グループの複数適用をエンジンが検知して BLOCKED にする。**exclusivityGroup の割当には根拠 evidence_id を必須で紐付ける**(グループ宣言自体が請求安全に影響するため)。排他グループの網羅性(未設定漏れがないか)は、ルール定義レビュー(opus4.8)の必須確認項目とする。未設定漏れはエンジンでは検知できないことを明記する。

## 3. 適用日ガード(opus4.8指摘#8-1・必須)

- 各 CalculationRule は `effectiveFrom: CalendarDate`(evidence の施行日、CAL-003 由来)を必須で宣言する。
- エンジンは **調剤日(dispensingDate)が effectiveFrom より前の場合、当該ルールを適用せず BLOCKED**(blocker: BLOCKED_REGULATORY_REVIEW、detail に「適用日前」)を返す。
- 令和8年度点数(施行 2026-06-01)を 2026-05-31 以前のデータへ適用することを機械的に禁止する。effectiveTo(廃止日)は将来の版管理で追加する(version_watchlist 連動)。

## 4. 一部負担金(patientCopay)の境界

- 点数→金額変換(1点=10円)、負担割合、端数処理は CAL-003 に evidence が存在しない。**copay 算出は BLOCKED_REGULATORY_REVIEW を維持**する。
- `CalculationResult` の再定義(opus4.8指摘#3を反映):
  - `status: 'POINTS_ONLY_COPAY_BLOCKED'` — 点数合計(total: Points)と trace は evidence 付きで確定。**必須プロパティ `readonly claimable: false`** を型レベルで持ち、blockers に BLOCKED_REGULATORY_REVIEW(copay根拠未発行)を必ず含む。患者請求・レセプト生成には**使用不可**。
  - `status: 'CALCULATED'` — total + patientCopay 両方確定(copay evidence 発行後に解禁。現時点で到達不能)。
  - `status: 'BLOCKED'` — 従来どおり。
- **呼び出し側規律**: 請求可否の判定は `status === 'CALCULATED'` の**ホワイトリスト比較のみ**を許可する。`status !== 'BLOCKED'` による否定形の成功判定を禁止し、コードレビューの必須確認項目とする。

## 5. ルール定義の規律

- 各 CalculationRule は `evidenceRefs` に CAL-003 の evidence_id を必ず持つ(affectsClaim=true → trace 層の実行時強制)。
- CAL-003 の caveat が付く項目のルールは、ルール定義コメントに caveat を転記する。
- **発行保留リスト(CAL-003 P-01〜P-08)の項目のルール実装を禁止**する。
- 算定**要件**(施設基準・患者条件等)は evidence 未発行のため、WP-2101b では要件判定を実装せず、適用可否は呼び出し側が明示指定する。**POINTS_ONLY_COPAY_BLOCKED 結果の warnings に「算定要件未検証(適用可否は呼び出し側指定)」を必ず含める**(opus4.8指摘#5)。要件の自動判定は留意事項通知(P-06)等の evidence 発行後。
- **CAL-001 プロセスとの整合(opus4.8指摘#5)**: EVIDENCE_ISSUED 行の実装解禁は CAL-001 の解除手順に従う。本SSOTの承認(opus4.8レビュー済み)をもって、§7 の対象5ルールに限り「期待値レビュー→APPROVED_FOR_IMPLEMENTATION」を充足したものとみなす(golden test の期待値は CAL-003 記載値と1:1対応、乖離時は SSOT_UPDATE_REQUIRED)。他の EVIDENCE_ISSUED 行は個別にこの手順を踏む。

## 6. Golden test 規律(TST-001 準拠)

- 期待値は CAL-003 の evidence 値のみから作成し、テスト名に evidence_id を含める。
- 誌面判読 caveat があるため、golden test ファイル冒頭に「原本再照合まで暫定」の注記を置く。
- **再照合トラッキング(opus4.8指摘#6)**: 暫定 golden の再照合状態は CAL-003 に `revalidation_status` 列(PENDING/DONE)で追跡し、P-08(令和8年6月19日修正版の有無確認)完了までは「全 golden が暫定」であることを Plans.md の残タスクとして維持する。再照合完了前のレセプト出力実装は禁止(そもそも WP-2102 は別途 BLOCKED)。
- 不一致発見時はテストを直さず SSOT_UPDATE_REQUIRED(QUA-004)。

## 7. WP-2101b スコープ(このSSOTで解禁される実装)

対象ルール(**すべて CAL-003 採番済み・独立固定点数・caveat最小**。opus4.8指摘#7で差し替え済み):

1. 調剤基本料1(EVD-CAL-0001: 47点・処方箋受付1回につき)
2. 内服の薬剤調製料(EVD-CAL-0021: 24点・1剤につき・4剤分以上は算定しない=上限3適用 — applicationKey/上限のリファレンス実装)
3. 調剤管理料2(EVD-CAL-0037: 10点 — 固定点数区分を選定。1剤につき型の調剤管理料1は乗率・剤数複雑性がないことを確認の上、次バッチ)
4. 服薬管理指導料3(EVD-CAL-0042: 45点・介護老人福祉施設等入所者訪問 — イ/ロ同点 caveat のない区分を選定)
5. 夜間・休日等加算(EVD-CAL-0032: 40点 — 単純固定加算)

実装内容:
1. StepResult の再定義(ItemCalculatedStepResult / applicationKey / 上限 / 排他グループ+evidence必須 / 重複検知)
2. 適用日ガード(effectiveFrom、調剤日比較)
3. 合算エンジン + `POINTS_ONLY_COPAY_BLOCKED`(claimable: false 型強制、要件未検証 warning 必須)
4. 各ルールの golden test + 合算 golden test(evidence_id をテスト名に含める)
5. 禁止: copay 系・保留8件・乗率/減算/クランプ項目・要件自動判定

**明示リスク**: P-08(6月19日修正版)未確認のため、5ルールの点数は暫定 golden。修正版で差分が判明した場合は CAL-003 を SUPERSEDED 改版し golden を SSOT 経由で更新する(作り直しコストを許容する)。

## 8. 変更履歴

- 0.2.1 (2026-07-09): evidence register との照合で EVD-CAL-0021 の上限記述を訂正(4剤分以上算定しない=3剤分まで)、対象5ルールの evidence_id を確定値に固定。
- 0.2.0 (2026-07-09): opus4.8 レビュー(APPROVE_WITH_CHANGES)の全指摘を反映 — 嚥下困難者用製剤加算を削除し実在evidenceに差し替え / 適用日ガード追加 / 重複検知を(ruleId, applicationKey)に変更 / POINTS_ONLY_COPAY_BLOCKED 命名+claimable:false 型強制 / 要件未検証warning必須化 / exclusivityGroup の evidence必須化 / スコープ外(乗率・減算・クランプ)明記 / 再照合トラッキング / CAL-001 プロセス整合 / 移行手順。承認。
- 0.1.0 (2026-07-09): 初版。
