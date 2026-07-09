# branching_and_pr_policy — ブランチ・PR運用ポリシー

```yaml
ssot_id: PRC-004
title: ブランチ・PR運用ポリシー
domain: process
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §0.10, §40, §0.1.6.12
open_questions:
  - ブランチ運用移行時の CI 必須チェック(branch protection)設定
```

## 1. 現行運用(単一セッション期の暫定運用)

現在は fable5 統率の単一 Claude セッション+Codex(コミット権なし)の体制であり、以下を暫定運用として明文化する。

- `main` へ直接コミットする。**活動単位(WP または SSOT バッチ)ごとにコミット&プッシュ**する。
- コミットメッセージ先頭に `WP-XXXX:` を付け、Codex 実装分は `(implemented by codex, reviewed by claude)` と `Co-Authored-By: Codex` を記載する。
- Codex側は git commit / push を行わない。claude がレビュー後にコミットする(pnpm-lock.yaml 含む)。
- コミット前に、レビュー(コード読解+テスト再実行)を完了していること。CI(typecheck / test / check:boundaries / build)がグリーンであることを事後確認する。
- この暫定運用は「実装者とコミット者の分離」により §0.10 のPRレビュー相当の統制を代替している。

## 2. ブランチ運用への移行条件

以下のいずれかに該当したら、§0.10 のブランチ+PR運用へ移行する(移行判断: fable5、記録: State.md)。

1. 複数の人間開発者、または複数の並行実装セッションが常態化した
2. 高リスク領域(R3+)の本実装(算定ルール・レセプト生成・Official Adapter)が開始された
3. 本番環境・ステージング環境が存在するようになった

移行後のブランチ命名(v0.1.7 §0.10 / §0.1.6.12):

```text
phase/<phase>-<wp-id>-<short-title>
feature/<wp-id>-<short-title>
fix/<wp-id>-<short-title>
review/<wp-id>-<short-title>
claude/<wp-id>-<short-name> / codex-sol/<wp-id>-<short-name>
```

## 3. PR/コミット本文の必須項目(v0.1.7 §40 準拠)

暫定運用ではコミットメッセージ+State.md 記録で以下を担保し、PR運用移行後は PR 本文に全項目を記載する。

目的 / 変更範囲 / work_package_id / 影響ドメイン / 規制・仕様根拠(evidence_id または不要理由)/ 医療安全影響 / 体験品質影響 / テスト結果 / rollback方法 / migration有無 / PHI・PII影響 / security impact / UI・UX影響 / offline mode影響 / Edge Node影響 / performance・SLO影響 / owner_model / reviewer_model / Codex関与有無とレビュー結果 / DoR・DoD充足 / スクリーンショット(UI変更時)/ opus4.8レビュー要否。

## 4. PR作成前チェック(v0.1.7 §0.10)

- 1つのPR(コミット)に複数の高リスク領域を混在させない。PRは小さく保つ。
- PHI/PII が含まれていない(fixtures は合成データのみ)。
- migration がある場合は rollback / expand-migrate-contract 方針がある。
- 高リスクは opus4.8 review required を明記し、承認なしに merge しない。
