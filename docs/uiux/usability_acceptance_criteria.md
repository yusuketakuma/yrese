# usability_acceptance_criteria — ユーザビリティ受入基準

```yaml
ssot_id: UIX-004
title: ユーザビリティ受入基準
domain: uiux
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §8.4, §8.6 / docs/plan/phase0_plan.md §6
depends_on: [docs/uiux/medical_ui_ux_principles.md, docs/uiux/performance_budget.md]
open_questions:
  - 被験者(新人事務・薬剤師・管理者)の確保方法と人数【要確認・人間対応】
  - アクセシビリティ基準の適用レベル(JIS X 8341-3 / WCAG 2.1 AA 相当の範囲)は quality SSOT で確定【要確認】
```

v0.1.7 §8.4 の12基準を、検証方法・合格条件付きの受入基準に落とす。MVP リリースゲートで全件判定する。

| ID | 基準(§8.4) | 検証方法(§8.6 対応テスト) | 合格条件(候補) | 対象ロール |
|---|---|---|---|---|
| UAC-01 | 主要業務フローをマニュアルなしで完了できる | manual-less workflow test / first-run task completion test: 受付→処方入力→仮算定→会計→帳票の一連タスクを初見被験者に説明なしで実施 | 3ロール各2名以上で、致命的な行き詰まり(進行不能・誤確定)ゼロ、タスク完了率 100% | 新人事務・薬剤師・管理者 |
| UAC-02 | ロール別に迷いやすい箇所を抽出できる | usability heuristic review + UAC-01 の行動観察記録 | 迷い箇所リストが作成され、U3+ の迷いは改善または警告設計で対処済み | 全ロール |
| UAC-03 | 処方入力→算定結果確認の体感速度が現場業務に耐える | perceived performance review + performance budget test(UIX-003 #6-8) | 予算内 + 被験者評価で「業務に支障」回答ゼロ | 事務・薬剤師 |
| UAC-04 | 混雑時の連続受付に耐える | 連続入力シナリオテスト(処方箋 N 枚連続受付、N は capacity plan と整合【要確認】) | 連続10件受付でキーボード主体運用が途切れない・保存失敗ゼロ | 事務 |
| UAC-05 | 主要画面で状態誤認が起きない | 状態誤認テスト: 仮算定/確定、仮保存/確定、薬剤師確認前後、請求可否を被験者に判別させる | 判別正答率 100%(u4画面)、95%以上(その他) | 全ロール |
| UAC-06 | オフライン時にオンライン確認済みと誤認しない | offline UX test: LOCAL_ONLY で資格確認・電子処方箋・送信系の状態を質問 | 「確認済み/送信済み」と誤答した被験者ゼロ | 事務・薬剤師 |
| UAC-07 | 外部送信失敗時に次の操作が分かる | error recovery usability test: 送信失敗を注入し次アクションを問う | 全被験者が画面情報のみで正しい次アクションに到達 | 事務・薬剤師 |
| UAC-08 | 復旧後同期で未解決タスクが明確に分かる | recovery sync UX test: RECOVERY_SYNC 完了後の要対応一覧を確認 | 未解決件数・種別・担当が一覧から即答できる | 薬剤師・管理者 |
| UAC-09 | 帳票出力・再出力・請求前点検の導線が分かりやすい | manual-less workflow test(帳票・点検シナリオ) | 説明なしで再出力・点検一覧到達、履歴確認ができる | 事務 |
| UAC-10 | キーボード中心で主要業務が実行できる | keyboard-only workflow test: マウス無しで受付→入力→算定→会計 | 全工程がキーボードのみで完了、フォーカス喪失ゼロ | 事務 |
| UAC-11 | アクセシビリティ基準を満たす | accessibility test(自動+手動。基準レベルは【要確認】) | 対象画面で違反ゼロ(重大度高)、色非依存表現の確認 | 全ロール |
| UAC-12 | 重大警告が警告疲れで無視されない | warning fatigue review: 通常業務1セッション中の警告発生記録を監査 | CRITICAL 警告の見落としゼロ、WARNING の平均発生数が閾値以下(閾値は実測で設定) | 薬剤師 |

## 運用

- pharmacist workflow review / claim clerk workflow review(§8.6)は UAC-01〜12 の結果を実務観点で承認する最終レビューとして実施する(人間レビュー)。
- 受入試験の被験者に本番個人情報を使わない(training mode / demo data、v0.1.7 §9.9)。
- 不合格項目は defect として管理し、患者安全影響は severity critical、請求事故影響は high 以上(quality_plan)。
