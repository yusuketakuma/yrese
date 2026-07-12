# public_quality_kpi_policy — 公開品質KPI一般方針

```yaml
ssot_id: QUA-008
title: 公開品質KPIの一般方針(匿名化・同意・契約・悪用リスク)
domain: quality
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-12
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §10、PRD-006 product_concept(柱2)
depends_on:
  - QUA-007 quality_transparency_strategy
  - SEC-系 セキュリティSSOT(PHI分類・ログ規律)
impacts:
  - QUA-009 claim_return_rate_kpi_policy
  - future public quality KPI aggregation and publication implementation
related_work_packages: [WP-0043, WP-9002-W15]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-12 WP-9002-W15 metadata-only completion: body/status/version/approval/effective/legal/privacy/publication semantics unchanged"
blockers:
  - BLOCKED_LEGAL_REVIEW(個人情報保護法・関連ガイドラインへの適合が未確認)
open_questions:
  - 匿名加工情報 / 仮名加工情報 / 統計情報のいずれの整理で公開するか(法令レビューで確定)
  - k-匿名性等の具体的匿名化手法と閾値(法令レビュー・統計的検証後に確定)
  - 薬局との公開同意の契約条項ドラフト(利用規約 or 個別合意)
```

## 1. 目的

品質KPI(返戻率等)を外部公開する際に全KPIへ共通適用する一般方針を定める。
個別KPIの定義は各KPI SSOT(例: QUA-009 返戻率)が持ち、本書は横断規律のみを持つ。

## 2. 公開の前提条件(全て満たすまで公開は BLOCKED)

1. **法令レビュー完了** — 個人情報保護法・次世代医療基盤法その他の適用整理は本書で
   断定しない。法令レビュー(BLOCKED_LEGAL_REVIEW)が完了し、公開形態(統計情報・
   匿名加工情報等の位置づけ)が確定するまで、いかなる公開も実施しない。
2. **定義 SSOT の APPROVED** — 公開対象KPIの定義・集計手順 SSOT が APPROVED であること。
3. **同意・契約の充足** — §4 の同意・契約要件を満たすこと。
4. **匿名化検証の完了** — §3 の匿名化要件を満たすことの検証記録があること。

## 3. 匿名化・非特定化

- 公開値は**集計値のみ**とし、個票(患者単位・処方箋単位・レセプト単位)は公開しない。
- 患者が特定されうる粒度の公開を禁止する。小規模集計(該当件数が僅少で個人が推定
  されうるセル)は抑制(セル秘匿)する。具体的な最小セルサイズ・k-匿名性等の手法と
  閾値は、法令レビューと統計的検証の完了後に本書の改版で確定する(現時点で数値を
  定めない — 推測で閾値を実装しない)。
- 薬局の特定についても同様に扱う: 薬局別公開は当該薬局の同意がある場合のみ(§4)。
- 公開パイプラインに PHI/PII を通さない。集計は非PHI化された確定データに対して行い、
  公開系システムは PHI 分類データへの参照権限を持たない(deny-by-default)。

## 4. 同意・契約

- **患者同意**: 公開は集計値のみであり個人データの第三者提供に該当しない整理を目指すが、
  該当性の判断は法令レビューに委ねる。レビュー結果が患者同意等の手続を要求する場合、
  その手続が整うまで公開しない(fail-closed)。
- **薬局同意**: 薬局を識別できる形の公開(薬局別KPI)は、当該薬局との契約上の明示同意を
  必須とする。同意は撤回可能とし、撤回後は次回公開分から除外する。
- **既定は非識別公開**: 同意がない場合の既定は「全体集計・非識別」のみ。
- 契約条項(利用規約への組み込み or 個別合意)は法務ドラフト後に本書へ追記する。

## 5. 悪用リスクと緩和策

| リスク | 内容 | 緩和策 |
|---|---|---|
| 恣意的比較 | 競合・第三者が文脈を無視した薬局間比較に利用 | 定義・集計条件を必ず併記して公開。定義なし数値の引用可否を利用条件で制約 |
| 小規模薬局の特定 | 処方箋枚数が少ない薬局の値から患者・経営状況が推定される | 最小集計単位の下限設定(閾値は改版で確定)、薬局別は同意制 |
| チェリーピッキング | 良い月・良い店舗のみ公開する選択バイアス | 公開単位・期間の事前定義(後出しの対象選択禁止)。公開開始後の遡及削除は原則不可 |
| ゲーミング | KPI を良く見せるための運用歪み(例: 請求保留の乱用) | KPI 定義側で fail-closed 集計を規定(QUA-009)。異常な保留率は内部監視 |
| 誤解 | 返戻率=薬局の過失と誤読される | 公開時に定義・要因分類の説明を付す(表示要件は KPI SSOT が定める) |

## 6. 公開の決定手順

1. KPI 定義 SSOT の APPROVED(通常レビューゲート: opus4.8 + 人間レビュー)
2. 法令レビュー結果の記録(blockers 解除の根拠を SSOT に追記)
3. 匿名化検証記録の作成
4. 公開判断は人間(事業責任者)が行う — 自動公開を初期リリースでは行わない
5. 公開後の訂正: 集計誤りが判明した場合は訂正履歴付きで公開値を更新する(silent fix 禁止)

## 7. 非範囲

- 個別KPIの分母分子定義(各KPI SSOT)
- 公開頻度・媒体・具体的閾値(法令レビュー後の改版で決定)
