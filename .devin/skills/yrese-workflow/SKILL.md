---
name: yrese-workflow
description: "Use when picking up, implementing, reviewing, or landing work in the yrese repo (task modes, ownership, frozen-diff review, validation, commit rules)."
---

# yrese workflow

実行主体に依存せず観測可能な成果と境界を定める。model、runtime、tool、権限、外部
availability を推測しない。正本は常にリポジトリ内の SSOT・契約・テスト・コード。

## 作業前に読むもの(対象に応じて)

- 製品正式仕様 `docs/spec/construction_prompt_v0.2.0.md` と関連 APPROVED SSOT
- agent 運用正本 `docs/agents/codex_single_lane_operating_model.md` (AGT-018)
- risk/review 正本 `docs/process/review_gate_matrix.md` (PRC-005) と
  `docs/process/definition_of_ready.md` (PRC-003)
- work-selection charter `DEVELOPMENT_POLICY.md` と唯一の active queue `Plans.md`
- interruption、blocker、human gate、dirty ownership だけを示す `State.md`
- live code、schema、test、current diff、Git state

## Task mode

current request を最初に分類する。

- `READ_ONLY_REVIEW`: 調査と報告だけ。repository・planning record を変更しない。
- `PLAN_ONLY`: request が明示した planning/decision record だけを変更する。
- `IMPLEMENT`: request が明示した scope を変更する。work 選択依頼では `Plans.md` の
  active WIP だけを claim し、WIP 1 / READY 最大 2 等は `DEVELOPMENT_POLICY.md §8` に従う。

## Ownership

- `active_root_writer` を sole maintainer、state-mutating validator、stager、committer、
  optional pusher の同一主体とする。他 context は必要な独立 reviewer に限定し、変更と
  再委譲を禁止する。Edit/Write/Git や unrestricted state-mutating shell を与えない。
- prompt 上の read-only 宣言だけに頼らず、harness permission、deny hook、read-only
  mount、または同等の sandbox で強制する。
- shared tree の test、build、formatter、generated artifact、snapshot、cache、DB write は
  `active_root_writer` だけが実行する。delegated validation は disposable worktree、
  generated directory、DB を分離し、shared mutable state を持たせない。

## 実装の進め方

- 非自明 task では current state、target diff、ownership、acceptance を復元し、最小
  complete slice を実装し、focused gate から検証する。
- 独立レビューを実施した場合は finding を閉じる。未実行 gate を PASS と呼ばず、
  完了または real blocker まで進める。

## Validation・frozen review・landing

- command は `package.json`、workspace package、CI、README、scripts から確認し、
  focused test から typecheck、lint、boundaries、SSOT index、secrets、deps、SBOM、
  build、runtime check へ必要範囲だけ広げる。
- final independent review 前に base SHA、exact path list、candidate diff hash、
  acceptance、validation command/result を packet として freeze し、review 中は
  writer edit を停止する。packet 後の変更は review を無効化し、新 hash、影響
  validation、review を要求する。
- risk に必要な最小 checker を選び、maker と checker を分離する。reviewer output は
  evidence であり approval ではない。
- `active_root_writer` だけが owned exact path を stage し、authorized 時だけ commit し、
  current request/WP が要求する場合だけ push する。commit message は WP-ID を先頭にする。
  required record 更新は final commit 前に完了し、implicit post-push metadata commit を
  作らない。
- `State.md` は interruption、blocker、human gate、dirty ownership の再開 pointer とする。
  通常の完了証拠は Git/CI へ残し、commit 前に確定可能な記録を完成させる。post-commit
  記録更新や追加 push は current request/WP が明示要求する場合だけ行う。
- affected path/consumer 確認、必要変更、objective gate、risk に必要な review、
  critical finding 解消が揃って初めて完了とする。
