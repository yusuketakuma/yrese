# AGENTS.md

## 適用範囲と実行レーン

このファイルは yrese リポジトリ全体に適用する Codex CLI 向け実行規約である。
WP-9001のreview中は、本ファイルと `docs/agents/codex_single_lane_operating_model.md` (AGT-018) はPROPOSED cutover batchである。2026-07-10のdirect user instructionによりWP-9001自体はCodex-onlyで進めるが、independent verificationとatomic finalization前にrepository全体へ発効済みと扱わない。AGT-018がAPPROVEDになった時点で、本ファイルとAGT-018をエージェント運用の正本として適用する。

- 実行レーンは Codex の単一レーンのみとする。
- Claude / Opus その他の別レーン、モデル名を前提にした割当、agmsg による連絡・承認・ハンドオフは使用しない。
- `CLAUDE.md` は非アクティブな停止通知であり、作業指示として使用しない。
- モデルID、製品名、能力、権限を推測しない。必要な場合は実行環境または公式情報で確認し、確認できなければ役割名だけを使う。

## 役割

Codex root agent が作業全体に責任を持つ。非自明な作業では次の順序を守る。

1. `code_mapper` または `explorer` が read-only で影響範囲を特定する。
2. `implementation_planner` または `spec_guardian` が計画、SSOT適合、受入条件、停止条件を read-only で確認する。
3. root が1名の `maintainer` を sole editor に指定する。編集者は同時に1名だけとし、指定範囲だけを変更する。
4. 実装後、変更を行っていない `verifier` が独立して差分と検証結果を確認する。
5. 医療安全、privacy、security、DB/data integrity、API contract、UI/accessibility など影響領域の専門 reviewer を追加する。
6. 指摘があれば sole maintainer に戻し、修正後に independent verifier が再確認する。

root は調整、受入条件、所有権、最終検証、exact-stage commit/push を担当する。root 自身が編集する場合は、その間 root が sole maintainer を兼ね、他の editor を起動しない。mapper、planner、reviewer、verifier、domain specialist は read-only とし、ファイルを変更しない。

## 基本姿勢

- ユーザー向けの進捗・完了報告は、指定がなければ日本語で行う。
- code comment、identifier、commit message、error message など英語が慣例の技術成果物は英語で記述する。
- active profile が許す範囲で自律的に進め、論理的に不足する情報や human gate がない限り承認待ちで停止しない。
- 完了を装わない。validation が失敗している状態で完了にしない。エラーを黙って無視しない。
- ユーザーや他作業の変更を保持し、無関係な差分を戻さない、stageしない、commitしない。
- 非自明な作業では編集前に具体的な acceptance criteria を定義する。

## 指示と仕様の優先順位

矛盾がある場合は次の順に解決する。

1. 適用法令、公式な医療・請求要件、患者安全、security/privacy 制約、および明示された human gate
2. 現在のユーザー指示。APPROVED SSOTの変更を伴う場合はPRC-007の改版・承認手順を完了する
3. `docs/` 配下の APPROVED SSOT。製品正式仕様は `docs/spec/construction_prompt_v0.2.0.md` のみ
4. エージェント運用についてはAPPROVED後のAGT-018。cutover時にAGT-001〜AGT-017および他文書の旧agent-routing記述だけを置換する
5. 本 `AGENTS.md`
6. `Plans.md`、`State.md`、`.codex/ralph-state.md` の作業記録
7. 実装、テスト、README、コメントなどの現状証拠

同じ層では具体的な規定、新しい APPROVED 版を優先する。Work Package、`Plans.md`、`State.md`、agent packet、code、testはAPPROVED SSOTを上書きできない。競合時はSSOT改版と再計画までfail-closedで停止する。AGT-018のrouting互換は製品/domain/evidence/medical/security/privacy/data-integrity/human gateを変更しない。解消できない矛盾、根拠不足、患者安全・請求・法令判断は推測せず人間へエスカレーションする。

## Ralph loop

すべての非自明な repository task で次を繰り返す。

1. repository files、`git status --short`、`Plans.md`、`State.md`、既存 progress file、直近 validation から current state を復元する。
2. 完了条件に最も寄与する単一の次タスクを選ぶ。
3. mapper と plan reviewer で関連コード、SSOT、テスト、影響範囲を確認する。
4. sole maintainer が最小かつ完全な変更を実装する。
5. 実在する validation を実行する。
6. independent verifier と必要な domain specialist が maker/checker 分離で確認する。
7. `.codex/ralph-state.md` が存在する場合は current task、inspected/changed files、bugs、security/performance findings、validation、remaining work、next action を更新する。
8. 完了条件を満たすか、実在する blocker に到達するまで継続する。

## プロジェクト

yrese は日本の保険薬局向け調剤用レセプトコンピューター MVP である。
正式仕様は `docs/spec/construction_prompt_v0.2.0.md` のみ。`docs/spec/construction_prompt_baseline.md` は正本への入口であり、別仕様ではない。
タスク台帳は `Plans.md`、活動ログは `State.md`。活動単位で検証し、root が対象ファイルだけを commit/push する。

## コマンド

```bash
pnpm install
pnpm -r typecheck
pnpm -r test
pnpm --filter @yrese/calculation test
pnpm --filter @yrese/api exec vitest run -t "名前"
pnpm check:boundaries
pnpm check:ssot-index
pnpm check:secrets
pnpm check:deps
pnpm check:sbom
pnpm test:scripts
pnpm -r build
pnpm clean
pnpm --filter @yrese/api dev
pnpm --filter @yrese/web dev
```

実際のコマンドは `package.json`、workspace package、Makefile、CI、README、scripts から確認する。CI (`.github/workflows/ci.yml`) の typecheck / test / boundaries / SSOT index / secrets / deps / SBOM / build を含む既存ゲートを弱めない。

## アーキテクチャ

pnpm monorepo。`apps/*` が実行体、`packages/*` が runtime-neutral な共通モジュールである。

- `packages/shared-kernel`: branded ID、SystemMode、PENDING系status、BLOCKER種別、error code、permission scope の唯一の正
- `packages/money` / `packages/date-time`: bigint ベースの金額・点数と暦日。浮動小数点と暗黙の現在時刻は禁止
- `packages/trace`: calculation trace / EvidenceRef。`affectsClaim=true` は evidenceRef 必須
- `packages/events`: Outbox/Inbox event envelope。`PHI != none` は encrypted 必須
- `packages/contracts`: zod API contract の唯一の正。consumer は契約外fieldを仮定しない
- `packages/calculation`: pure calculation engine。evidence のあるruleだけを実装し、根拠不足は BLOCKED
- `packages/audit`: audit event registry。台帳外event typeは実行時拒否
- `apps/api`: Fastify 5。deny-by-default permission。dev tenant stub は production 起動拒否
- `apps/web`: Next.js 15。共通packageは `transpilePackages`、NodeNext import は `extensionAlias` を使用

`packages/* -> apps/*`、循環依存、共通概念の重複定義は禁止し、`scripts/check-boundaries.mjs` を停止ゲートとする。

Codex 単一レーンは frontend、backend、shared packages、SSOT/docs、tests、scripts、CI、infra の全layerを担当できる。ただし1つの作業範囲につき editor は常に sole maintainer 1名とし、並行編集しない。

## SSOT・evidence・fail-closed

- APPROVED でない仕様を根拠に実装しない。仕様不足はコードで補完せず `SSOT_UPDATE_REQUIRED` として扱う。
- 算定、請求、帳票は `docs/calculation/evidence_register.md` の evidence_id を必須とし、点数や法令要件を推測実装しない。
- 未知statusは請求不可、空rule算定は BLOCKED、未入金を領収済み表示しない、会計・監査台帳は append-only とする。
- 同じ concept、enum、status、validation、money/date 処理を二重実装しない。既存の `packages/*` と SSOT を先に検索する。
- contract-first を守り、API/schema変更では contracts、generated artifacts、consumer、contract test の整合を確認する。

## Engineering・security・performance

- 症状ではなく root cause を修正する。例外を隠さず、typeを弱めて通さず、失敗testを理由なく削除しない。
- null、undefined、empty、boundary、concurrency、stale state、invalid input、data integrity を確認し、必要なtestを追加する。
- input validation、authentication、authorization、IDOR、injection、unsafe deserialization、secret、log/error、dependency、path traversal、SSRF、unsafe shell を確認する。
- secret漏えい、auth bypass、permission緩和、unsafe eval/shell interpolation、broad CORS、security check無効化、plaintext credentialを導入しない。
- correctness を優先し、N+1、重複I/O/network、unbounded loop、不要な同期blockingなど重大な非効率だけを根拠付きで改善する。

## 医療データ・PHI・外部処理

- production の患者・処方・薬剤・請求・監査データを prompt、subagent packet、fixture、test、log、commit、issue、外部serviceへ渡さない。synthetic または適切に de-identified なデータだけを使う。
- secret、credential、token、private key を prompt、log、artifact に含めない。
- tenant/pharmacy/user scope、least privilege、encryption、auditability、retention を fail-closed で維持する。
- DB は read-only 調査を既定とする。migration適用、`DELETE`、`UPDATE`、production write、external send、email、batch、deploy、publish、削除、bulk操作には事前の明示 human approval が必要。
- 医療、薬局、患者、処方、薬剤、在庫、請求、監査ログに影響する変更は `medical_safety_reviewer` と `privacy_compliance_reviewer` を優先し、security/data影響に応じて専門reviewerを追加する。

## Human gates

次は Codex が推測または自己承認せず、人間の明示承認を得る。

- 高リスク(R3+)の実装開始前review。R4はhuman authorityによるscope/evidence/risk判断と再計画まで実装禁止
- 法令、診療報酬、薬学的妥当性、患者安全の最終判断
- production data / infrastructure の変更、migration適用、deploy、公開、外部送信、secret rotation
- destructive git、force-push、履歴改変、production data deletion
- security/authorization/privacy制約の緩和、例外受容、重大riskの残存判断
- human approval が必要と SSOT/WP に明記された仕様昇格・release gate
- scope、期待結果、公式evidenceが衝突し、fail-closed のまま解消できない場合

## Validation と完了

- 編集前後に `git status --short` を確認する。
- 対象に応じて focused test、typecheck、lint、format check、boundaries、SSOT index、secrets、deps、SBOM、build、runtime check を実行する。
- 存在しないvalidationを作ったことにしない。実行不能なら理由と未検証範囲を記録する。
- independent verifier は diff、testの妥当性、security/privacy/data integrity、未関係差分の混入を確認する。
- relevant pathの確認、必要な変更、利用可能なvalidation、critical bug/high-priority riskへの対処、progress file更新が揃って初めて完了とする。

## Git と landing

- commit message は WP-ID を先頭にする。例: `WP-2101b: harden reception transition`。
- subagent、mapper、planner、maintainer、reviewer、verifier は commit/push しない。
- Codex root agent だけが、independent verification 後に `git status --short` と `git diff -- <exact paths>` を再確認し、所有対象の exact path だけを明示的に stage する。
- root は staged diffを再確認し、対象validationが成功した場合だけ commitし、現在のユーザー指示/WPが要求する場合だけ pushする。
- unrelated dirty files、ユーザー変更、別WP差分を commit に混ぜない。`git reset --hard`、destructive cleanup、force-push は明示承認なしに実行しない。
- push後は commit、実行validation、結果、残riskを `State.md` および要求されたhandoff/PR記録へ残す。agmsg は使用しない。
