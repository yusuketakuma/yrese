# エージェント割当(ルーティング)ポリシー

```yaml
ssot_id: AGT-012
title: エージェント割当(ルーティング)ポリシー
domain: agents
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: 承認後
effective_to: null
source_refs:
  - 構築プロンプト v0.1.7 §0.1.3.2, §0.1.3.3, §0.1.3.6, §0.1.6.18.1, §0.1.6.18.3
depends_on:
  - docs/agents/dual_lane_operating_model.md
impacts:
  - docs/agents/agent_assignment_matrix.md
  - docs/agents/agent_review_pairing_policy.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions: []
blockers: []
```

## 1. 割当の最上位軸: implementation_layer

| layer | 割当 |
|---|---|
| frontend | ClaudeCode側 `/ultracode`(主に sonnet5) |
| backend | Codex側 `ultraモード`(Sol) |
| shared | fable5 が owner を明示し、どちらか一方のみに編集許可 |
| ssot | fable5 が作成・更新(高リスクは opus4.8 レビュー) |
| review | 実装者と別のエージェント |

## 2. 分類6軸

### risk_level
- R0: 低リスク(表示・文書・テスト補助)
- R1: 通常実装(CRUD、通常UI、非請求系API)
- R2: 中リスク(業務フロー、権限、監査、マスター補助)
- R3: 高リスク(算定、請求、資格確認、電子処方箋、PMH、Official Adapter、Edge同期)
- R4: 重大リスク(法令適合性不明、医療安全影響大、請求事故直結、本番移行、セキュリティ重大変更)

### ambiguity_level
- A0: 完全に明確 / A1: 軽微な実装判断のみ / A2: 設計判断が必要 / A3: 規制・業務・UXの複合判断が必要 / A4: 公式資料・人間レビューなしでは判断不可

### implementation_size
- S0: 1ファイル以内 / S1: 小規模 / S2: 複数ファイル / S3: 複数パッケージ横断 / S4: 大規模リファクタリング・複数サービス横断

### execution_need
- E0: コード実行不要 / E1: unit test・lint程度 / E2: DB・migration・E2E・CI・性能検証が必要

### repetition_level
- P0: 一回限りの判断 / P1: 少量反復 / P2: 中量反復 / P3: 大量反復 / P4: 機械的・大量・並列処理向き

### ux_safety_level
- U0: UI影響なし / U1: 通常UI / U2: 業務導線に影響 / U3: 医療安全・請求事故に影響 / U4: 患者取り違え、薬剤師確認、外部未確認状態、請求確定に影響

## 3. 割当アルゴリズム(10則)

1. `A4` または `R4` は実装しない。fable5 が BLOCKER 化し、人間レビューへ回す
2. `A3` 以上は fable5 が仕様・境界・受入条件を先に確定する
3. `R3` 以上は opus4.8 の事前レビューを受ける
4. `R3` 以上の実装者とレビュー者は同一にしない
5. `S3` 以上または `E2` の通常技術作業は、implementation_layer に従い frontend=sonnet5、backend=Codex側Sol を主実装にする
6. `P3` 以上の反復検査・差分確認・整合性確認は haiku4.5 を優先する
7. UI実装は sonnet5 を主実装にする。ただし `U3` 以上は fable5 がUX方針を決め、opus4.8 が医療安全レビューを行う
8. バックエンドコードベース全体の読解、CI失敗調査、大規模リファクタリング、性能ボトルネック調査は Codex を優先する。フロントエンド体験品質は ClaudeCode側を優先する
9. 算定・請求・Official Adapter・オンライン資格確認・電子処方箋・PMH は、fable5 が仕様境界を決め、opus4.8 が高リスクレビュー、バックエンド実装=Codex側Sol、フロントエンド表示実装=sonnet5
10. 法令・通知・医療安全の解釈は fable5 + opus4.8 + 人間レビューの対象とし、sonnet5 / haiku4.5 / Codex に単独判断させない

## 4. 全体最適化ルール(v0.1.7 §0.1.6.18.3)

- fable5 は仕様判断・SSOT・WP・レビューゲートに集中し、実装量を抱え込まない
- opus4.8 は高リスク設計・レビューに集中し、通常画面実装へ浪費しない
- 仕様が揺れているバックエンド作業は Codex側へ投げない(先に fable5 がSSOTを固める)
- Codex側が発見した設計矛盾は実装で吸収せず、SSOT更新提案として fable5 へ返す
- ClaudeCode側が発見したAPI不足はフロントで仮実装せず `FRONTEND_NEEDS_API` として依頼する
- 実装の速さより、請求事故防止・医療安全・法令適合性・SSOT整合性・API契約整合性を優先する

## 5. fable5 の割当時チェックリスト(WP発行前)

- [ ] これは誰が一番得意な種類の作業か
- [ ] 失敗した場合の影響は何か
- [ ] 仕様判断とコード実装を分離できているか
- [ ] 実装者とレビュー者が分離されているか
- [ ] Codexにコード実行権限が必要か
- [ ] Codex Cloudに渡してよい情報か
- [ ] haiku4.5で機械的に検査できる項目はあるか
- [ ] sonnet5に渡せるほど仕様が明確か
- [ ] opus4.8レビューが必要な高リスク領域か
- [ ] 人間レビューが必要な法令・医療安全・請求実務判断か

## 6. WP割当メッセージへの追加項目

risk_level / ambiguity_level / implementation_size / execution_need / repetition_level / ux_safety_level / primary_agent_reason / reviewer_agent_reason / prohibited_agents / required_human_review / allowed_files / forbidden_files
