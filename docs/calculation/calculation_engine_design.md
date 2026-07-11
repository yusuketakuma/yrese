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
version: 0.4.0
created_at: 2026-07-09
updated_at: 2026-07-11
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
- **計算式セマンティクス(v0.3.0 で解禁 — human_review_required)**。項目点数の**項目内計算**として以下を定義する
  (いずれも純関数 `packages/calculation/src/formulas.ts`。合算セマンティクス自体は不変):
  - **数量段階型(tiered_daily)**: 日数等の数量入力から点数を決める(湯薬 EVD-CAL-0024/0025/0026:
    7日以下190点 / 8〜28日は190点+8日目以上1日10点 / 29日以上400点)。数量は算定要件未検証の入力として呼び出し側が指定する。
  - **乗率(multiplier)**: 「所定点数の100分のX」(EVD-CAL-0007/0008/0068/0031)。**乗算結果が整数点にならない場合、
    丸め根拠 evidence が未発行の間は BLOCKED_REGULATORY_REVIEW**(MOD-010 §1-4「丸めは公式根拠がある場合のみ」)。
    整数になる入力のみ通す。丸め evidence 発行後は RoundingMode+evidence_id をルール宣言で受ける。
  - **減算(reduction)**: ▲5点(EVD-CAL-0012)/▲15点(EVD-CAL-0019)等は**負の項目として合算しない**。
    基礎点数から差し引いた結果を1項目として返す**合成計算**とし、両 evidence を evidenceRefs に持つ。途中結果が負になる場合は下限クランプが無い限り BLOCKED。
  - **下限クランプ(floor)**: 注16(EVD-CAL-0020)は調剤基本料の合成計算内の最終段で適用(3点未満→3点)。
  - **薬価→点数変換(EVD-CAL-0067)**: 15円以下→1点 / 15円超→10円又はその端数を増すごとに1点を加算(=1+⌈(価格−15円)/10円⌉)。
    caveat(端数処理の細部は留意事項通知で確定)があるため、**結果には暫定 warning を必ず付与**する。
  - **合成の適用順は暫定**: 乗率→減算→下限(留意事項通知の精読で確定するまで、合成結果に暫定 warning を必ず付与)。
- **引き続きスコープ外**: 算定要件の自動判定、copay、発行保留(P-01〜P-08)項目、丸め evidence なしでの端数丸め。
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

## 8. 実装カバレッジと明示的除外(v0.4.0)

CAL-003 に採番済みで**実装可能(点数値確定・除算/判定不要・保留外)**な項目を、すべて「算定要件は自動判定せず、適用可否は呼び出し側指定」の**表示専用ルール**として実装済み(要件未検証 warning 必須)。

**実装済み evidence(rule ファクトリ)**:
- 区分00 加算: 0009 地域支援体制加算1〜5 / 0010 連携強化 / 0011 バイオ後続品 / 0016・0017 在宅薬学総合体制1・2 / 0018 電子的調剤情報連携
- 区分01 加算: 0031 時間外・休日・深夜加算(乗率。端数=BLOCKED)
- 区分10の2: 0035・0036 調剤管理料1イ・ロ(1剤ごと・上限3) / 0038 残薬調整加算 / 0039 薬学的有害事象等防止加算(**SaMD該当性 REG-005 未評価を warning で明示・判定ロジック非搭載**)
- 区分10の3: 0040・0041 服薬管理指導料1・2 / 0043 指導料4 / 0044〜0053 各加算(麻薬管理・特定薬剤1/2/3・乳幼児・小児特定・吸入薬・かかりつけF/訪問・特例)
- 区分14の2/3: 0054 外来服薬支援料1 / 0057 施設連携加算 / 0058 服用薬剤調整支援料1
- 区分15系(在宅): 0059 在宅患者緊急時等共同指導料(本体+5加算) / 0061 退院時共同指導 / 0062 服薬情報等提供料 / 0063 経管投薬支援 / 0064 在宅移行初期管理 / 0065 訪問薬剤管理医師同時指導 / 0066 複数名薬剤管理指導訪問
- 第3〜5節: 0068 多剤逓減(乗率100分の90) / 0069 特定保険医療材料料(材料価格÷10。端数=BLOCKED・暫定 warning) / 0070 ベースアップ評価料 / 0071 物価対応料

**明示的除外(未実装。捏造せず defer)**:
1. **介護保険(居宅療養管理指導費 等)** — CAL-003 は医療保険の調剤報酬点数表(S1)のみを台帳化しており、介護報酬(厚労省告示・単位数)の evidence は未採番。**原本照合による新 evidence 台帳(別 SSOT)が必要**であり、単位数の捏造は禁止(MOD-010/捏造禁止)。保険薬局が算定する介護保険項目の実装は本台帳の範囲外。
2. **保留 P-01〜P-08 絡み** — 特別調剤基本料B(P-01)/服用薬剤調整支援料2(P-02)/無菌製剤処理加算(P-03)/在宅患者訪問薬剤管理指導料・在宅患者緊急訪問(区分15/15の2)本体(P-04。0060 訪問加算は本体保留のため未実装)/施設基準(P-05)/留意事項通知の算定要件(P-06)/疑義解釈(P-07)/6月19日修正版差分(P-08)。
3. **注4 別薬局減算(0008 100分の50)** — 調剤基本料合成への組み込みで端数(47×50/100=23.5 等)を生じ、丸め evidence 未発行のため未組込(必要時 BLOCKED 経路で対応可)。
4. **分割調剤(0013〜0015)** — 分割回数での除算・回次管理を要し、端数/丸め evidence と回次状態設計が別途必要(CAL-R-022 非MVP)。

## 9. 変更履歴

- 0.4.0 (2026-07-11): CAL-003 の実装可能な全項目(加算・本体・料)を表示専用ルールとして実装(human_review_required — 人間指示「他全ての加算…確認し不足あれば実装」「在宅・介護保険など保険薬局に関係する項目を全て網羅」による)。
  §8 に実装済み evidence 一覧と明示的除外(**介護保険は新 evidence 台帳が必要=範囲外**、保留 P-01〜08、注4減算、分割調剤除算)を記録。乗率型(0031/0068)・材料料(0069)は端数を BLOCKED とし丸め evidence 未発行の規律を継承。0039 は SaMD該当性未評価を warning で明示し判定ロジックは非搭載。要件自動判定・copay は引き続き禁止。
- 0.3.0 (2026-07-11): 計算式セマンティクスの解禁(human_review_required — 人間指示「調剤報酬の点数計算ロジックを開発」による改版)。
  §2 に数量段階型(湯薬)・乗率(丸め evidence 未発行時は端数=BLOCKED)・減算(負項目禁止・合成計算)・
  下限クランプ(注16)・薬価→点数変換(EVD-CAL-0067、暫定 warning 必須)を定義。
  合成の適用順(乗率→減算→下限)は暫定とし warning 必須。区分01 薬剤調製料の全剤形
  (EVD-CAL-0022/0023/0024/0025/0026/0027/0028/0029/0030)と区分00 合成(0007/0012/0019/0020)、
  使用薬剤料(0067)のルール実装を解禁。要件自動判定・copay・保留 P-01〜08・根拠なし丸めは引き続き禁止。
- 0.2.2 (2026-07-11): エンジン防御強化(human_review_required — 承認済みセマンティクスの機械的強制の強化であり算定値の意味論は不変。
  レビュー記録: docs/research/calculation_engine_logic_review_20260711.md)。
  (1) §3 予告の effectiveTo(最終有効日・その日を含む)ガードを実装 — CAL-006 §3.1 停止条件(第2版 evidence 導入前提)を充足。
  終了日<開始日の宣言は SSOT_UPDATE_REQUIRED。
  (2) §2 スコープ外の減算が負の固定点数として混入することを SSOT_UPDATE_REQUIRED で機械的に禁止(0 は許容)。
  (3) 同一 ruleId 内の maxApplications 宣言不整合を SSOT_UPDATE_REQUIRED で停止(evidence 文言との1:1対応の防御)。
  (4) StepResult の SSOT 外フィールドを SSOT_UPDATE_REQUIRED で拒否。
  (5) warnings の重複蓄積を初出順維持で排除(必須警告の存在保証は不変)。
- 0.2.1 (2026-07-09): evidence register との照合で EVD-CAL-0021 の上限記述を訂正(4剤分以上算定しない=3剤分まで)、対象5ルールの evidence_id を確定値に固定。
- 0.2.0 (2026-07-09): opus4.8 レビュー(APPROVE_WITH_CHANGES)の全指摘を反映 — 嚥下困難者用製剤加算を削除し実在evidenceに差し替え / 適用日ガード追加 / 重複検知を(ruleId, applicationKey)に変更 / POINTS_ONLY_COPAY_BLOCKED 命名+claimable:false 型強制 / 要件未検証warning必須化 / exclusivityGroup の evidence必須化 / スコープ外(乗率・減算・クランプ)明記 / 再照合トラッキング / CAL-001 プロセス整合 / 移行手順。承認。
- 0.1.0 (2026-07-09): 初版。
