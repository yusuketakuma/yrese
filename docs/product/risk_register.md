# risk_register — プロジェクトリスク台帳

```yaml
ssot_id: PRD-003
title: プロジェクトリスク台帳(事業・技術・体制)
domain: product
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §4 / docs/plan/phase0_plan.md §15
depends_on:
  - docs/safety/medical_safety_risk_register.md
impacts:
  - Plans.md の優先順位判断
open_questions:
  - ONS等アクセス制限資料の入手経路・時期(人間の手続きが必要)
  - 事業前提(提供形態・価格・サポート体制)の確定時期
blockers: []
```

医療安全に関するリスクは `docs/safety/medical_safety_risk_register.md`(SAF-001)が正本。
本書はプロジェクト遂行・事業・技術・体制のリスクを扱う。

| ID | リスク | 影響 | Sev | Prob | 対応方針 | トリガー/監視 | 状態 |
|---|---|---|---|---|---|---|---|
| RSK-001 | ONS等アクセス前提資料(記録条件仕様・外部IF仕様)が入手できない/遅れる | R3実装(レセプト・オン資・電子処方箋)が長期凍結 | high | high | 入手経路を人間へ依頼(手続き必要)。凍結中は基盤・UI・非依存領域を先行 | source_registry の【要確認】件数 | OPEN |
| RSK-002 | 令和8年度改定とマスター版ズレによる算定誤り | 誤請求・返戻 | high | med | 版・適用日・経過措置を date-time 明示入力+マスター版管理で分離。改定情報を version_watchlist 監視 | 改定告示・疑義解釈の発出 | OPEN |
| RSK-003 | LOCAL_ONLY⇄RECOVERY_SYNC 競合設計の複雑性過小評価 | 二重登録・データ不整合 | high | med | 競合は自動補正禁止(CONFLICT_REQUIRES_HUMAN_REVIEW 実装済み)。同期設計はopus4.8レビュー必須 | 同期実装WPの着手 | OPEN |
| RSK-004 | SaMD該当性の見誤り(重複投薬・併用禁忌チェック等) | 薬機法抵触・機能撤回 | high | med | 該当機能は判定完了まで未実装(MSR-021/022)。BLOCKED_PMDA_SAMD_REVIEW 維持 | 該当性判定タスク | OPEN |
| RSK-005 | NSIPS許諾前の仕様汚染(既存連携要望に引きずられる) | 許諾違反・法的リスク | high | low | NSIPS仕様の複製・模倣・書き写しの全面禁止(non_mvp_scope N8) | 連携要望の発生 | OPEN |
| RSK-006 | 公費・地方単独助成の組み合わせ爆発 | MVPスコープ崩壊・工期超過 | high | high | カバーリストを限定(人間承認)。対象外は BLOCKED_UNSUPPORTED_CLAIM で停止 | coverage matrix 拡充時 | OPEN |
| RSK-007 | マルチテナント分離不備 | 薬局間データ混在(重大事故) | critical | low | tenant isolation test を DoD 必須化(WP-2002以降)。cross-tenant テスト常設 | 認可実装WP | OPEN |
| RSK-008 | 二系統運用での共有ファイル競合・API契約ドリフト | 手戻り・契約不整合 | med | med | ファイル所有+ロック(AGT-009)運用中。contract-first 徹底。現時点競合ゼロ | agmsg BLOCKER 報告 | 監視中 |
| RSK-009 | Codex側実行環境の前提崩れ(モデルID未確認・Cloud不可) | 割当計画の再編 | med | low | R0-R2+全件レビューで運用中(AGT-017)。R3割当前に確認 | R3実装の開始判定 | 監視中 |
| RSK-010 | 移行データのコードマッピング品質不足 | 移行後の誤請求 | high | med | CodeMappingRegistry(confidence/review必須)+移行照合(件数・金額)を必須化 | 移行WP着手 | OPEN |
| RSK-011 | 月次請求期ピークの性能未達・印刷障害 | 業務停止・請求遅延 | high | med | performance budget / capacity plan(WP-0010)で候補値定義→実測調整。印刷失敗の成功扱い禁止 | 負荷テスト | OPEN |
| RSK-012 | AIエージェント実装の仕様逸脱(根拠なき実装) | 請求事故・法令違反 | high | med | trace の evidenceRef 強制(実装済み)+SSOT駆動+レビュー分離+停止条件運用 | レビュー指摘率 | 統制中 |
| RSK-013 | 長期セッション・コンテキスト分断による統率劣化 | 決定の散逸・重複実装 | med | med | State.md / Plans.md / SSOT への即時転記(agmsg・会話は正式証跡にしない) | State.md 更新頻度 | 統制中 |
| RSK-014 | 事業前提(SLA・価格・サポート体制)未確定のまま実装先行 | 手戻り・提供不能 | med | med | service_operations 系SSOT(WP-0010)で枠組み先行、値は人間判断待ち【要確認】 | Go/No-Go 前 | OPEN |

## 運用

- 週次(または Phase gate 時)に fable5 が棚卸しし、状態(OPEN/監視中/統制中/CLOSED)を更新する。
- Sev high 以上の新規リスクは opus4.8 レビュー対象。
- 医療安全へ波及するリスクは SAF-001 へ相互参照を張る。
