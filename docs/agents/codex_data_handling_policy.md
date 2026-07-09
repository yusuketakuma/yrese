# Codex側データ取扱いポリシー

```yaml
ssot_id: AGT-010
title: Codex側データ取扱いポリシー
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
  - 構築プロンプト v0.1.7 §0.1.6.14, §0.1.6.7, §0.6, §0.7
depends_on:
  - docs/agents/codex_side_ultra_mode_charter.md
impacts:
  - docs/agents/agmsg_cross_lane_protocol.md
related_work_packages: []
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - 0.1.0 初版作成(Phase 0 作業#1)
open_questions:
  - codex CLI のデータ送信範囲(ローカル実行時にリポジトリ内容がクラウドへ送信される範囲)の確認【要確認】
  - Codex Cloud 利用時のデータレジデンシー・保持ポリシー【要確認】
blockers: []
```

## 1. 原則

Codex側(ローカルCLI / Cloud を問わず)には、**合成データと公開可能なメタ情報のみ**を渡す。本プロジェクトは要配慮個人情報(医療情報)を扱うため、Codex側への入力は常に data minimization を適用する。

## 2. Codex側に渡してよいもの

- work package 本文
- リポジトリ内ドキュメント参照(パス・抜粋。ただし下記禁止物を含まないもの)
- issue番号 / PR番号
- テストログ(マスク済み)
- マスク済みログ
- 合成テストデータ / synthetic fixture
- public official source references のメタ情報(資料名・版・適用日等。本文の再配布制限に注意)

## 3. Codex側に渡してはならないもの

- 患者氏名・生年月日等、実患者を特定できる情報(PHI/PII)
- 保険証記号番号・保険者番号と個人を紐づける実データ
- 公費受給者番号等の実データ
- 本番レセプトデータ / 本番処方データ / 本番DBの内容
- 電子証明書 / 秘密鍵 / API token / パスワード / 接続先ID・秘密情報
- 未許諾NSIPS仕様本文
- 医療機関等ONS等、アクセス制限・許諾制限付き資料の本文そのもの
- 患者を特定できるログ / 本番ログ全文

## 4. Codex Cloud の追加制約

- Codex Cloud 上で機微情報・本番データ・未マスク医療情報を扱ってはならない
- Cloud並列実行した作業は、PRまたはdiffを確認するまで完了扱いにしない
- Cloud利用可否・権限は `codex_capability_verification.md`(fable5所有)で確認済みであること

## 5. fixtures・テストデータの規律

- `packages/fixtures/**` には本番個人情報・復元可能な医療情報を含めない
- 合成データは実在の患者・薬局・医療機関と偶然一致しない形式で生成する(氏名は明示的なテスト名、保険者番号等はテスト用番号帯)
- fixtures への PHI 混入は CI の fixtures PHI scan(haiku4.5 担当)で検査する

## 6. 違反時の処理

1. 検知者は即時 agmsg `incident` ルームへ報告(違反内容自体を再掲しない。参照情報のみ)
2. 該当WPを停止し、`AGMSG_PHI_LEAK` または `CODEX_DATA_POLICY_VIOLATION` として記録
3. fable5 が影響範囲(どの外部サービスへ送信されたか)を確認し、人間レビューへエスカレーション
4. 再発防止策を本SSOTへ反映してから該当WPを再開する
