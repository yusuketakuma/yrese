# Codex 単一レーン運用モデル

```yaml
ssot_id: AGT-018
title: Codex 単一レーン運用モデル
domain: agents
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_if_required
version: 0.2.0
created_at: 2026-07-10
updated_at: 2026-09-08
approved_at: 2026-09-08
approved_by: "direct_user_approval (2026-09-08; Codex cleanup operating revision); native independent review FINDINGS_NONE; frozen_diff_sha256 59b1e57cc7bd18570828c7ac7baf63acd6b8b7be0e1449f5387369c61b37a855"
effective_from: 2026-09-08
effective_to: null
source_refs:
  - human_instruction Codex environment cleanup approval (2026-09-08)
  - human_instruction WP-9001 (2026-07-10)
  - docs/spec/construction_prompt_v0.2.0.md
depends_on: []
impacts:
  - AGENTS.md
  - CLAUDE.md
  - docs/agents/
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
supersedes:
  - AGT-001
  - AGT-002
  - AGT-003
  - AGT-004
  - AGT-005
  - AGT-006
  - AGT-007
  - AGT-008
  - AGT-009
  - AGT-010
  - AGT-011
  - AGT-012
  - AGT-013
  - AGT-014
  - AGT-015
  - AGT-016
  - AGT-017
change_log:
  - "0.2.0 2026-09-08 APPROVED — user-requested removal of automatic delegation and universal review gates; R3+, product, safety, privacy and release gates preserved; prior approval provenance remains in Git history; direct user approval and frozen independent review FINDINGS_NONE recorded"
  - 0.1.0 2026-07-10 Codex単一レーン、maker/checker分離、全layer所有、human gateをAPPROVED化(WP-9001、required reviews PASS)
open_questions: []
blockers: []
```

## 1. 目的と適用範囲

本書は yrese におけるエージェントの計画、実装、review、verification、landing の唯一の運用正本である。Codex root agentを主担当とし、SSOT/docs、frontend、backend、shared packages、database/IaC、tests、scripts、CIを含む全layerを一貫して扱う。

編集権はCodex root 1名に限定する。通常作業の独立レビューはriskと対象変更に応じて選び、全taskで一律に必須化しない。明示されたSSOT改版、specialist、human、release gateは維持し、独立checkerが必要な場合はmakerと別contextにする。

## 2. 優先順位

矛盾がある場合は次の順で扱う。

1. 適用法令、公式な医療・請求要件、患者安全、security/privacy制約、および明示されたhuman gate
2. 現在の人間による明示指示。APPROVED SSOTの結論変更を伴う場合は、その指示を根拠にPRC-007の改版手順を完了する
3. `docs/` 配下のAPPROVED SSOT。製品正式仕様は `docs/spec/construction_prompt_v0.2.0.md`
4. エージェントのassignment、routing、maker/checker、handoff、landingについてはAPPROVED後の本AGT-018
5. `AGENTS.md` の実行手順
6. `Plans.md`、`State.md`、progress file
7. code、test、README、commentなどの実装証拠

同じ階層では、対象を限定した規定と新しいAPPROVED版を優先する。本書がAPPROVEDになった時点で、文書のdomainや配置場所を問わず、エージェントのassignment、routing、maker/checker、handoff、landingに関する旧記述だけを本書へ読み替える。このglobal compatibility clauseは、製品scope、domain model、法令、公式evidence、算定・請求、医療安全、security/privacy、data integrity、human approval gateを変更または緩和しない。

`Plans.md`、`State.md`、current Work Package、agent packet、code、testはAPPROVED SSOTを上書きできない。WPとAPPROVED SSOTが競合する場合は`SSOT_UPDATE_REQUIRED`または`BLOCKED_NOT_READY`として停止し、SSOT改版、必要なhuman approval、再計画、pre-plan reviewを完了してから再開する。解消できない矛盾は推測せず、人間へfail-closedでエスカレーションする。

## 3. 単一レーンの役割

### 3.1 Human product / safety authority

- scope、business priority、法令・薬学・患者安全上の最終判断を行う。
- human gate対象のproduction操作、external action、risk受容、SSOT昇格を承認する。
- 実装詳細や通常のread-only調査まで逐次承認する役割ではない。

### 3.2 Codex root agent / sole maintainer

- 調査、repository探索、計画、実装、test、修正、validationを直接行う。
- current state、acceptance criteria、exact path scope、dirty ownership、停止条件を確認する。
- shared treeの唯一のwriterとして、generated artifact更新、stage、authorized commit/push、必要な記録を担当する。
- 通常作業をmapper、planner、implementerなどの別agentへ自動割当しない。

### 3.3 Independent reviewer / checker

- 独立レビュー、反証、監査が必要な場合にCodex標準subagentを使う。固定modelや役割階層を設けない。
- reviewerは変更を作成していない別contextとし、allowlisted code/diffとsynthetic evidenceだけを確認する。
- read-only sandbox、deny hook、read-only mountまたは同等の実行環境で変更を禁止する。prompt上の宣言だけでは不十分。
- 実装・修正、shared treeでのstate-mutating validation、再委譲、外部model相談、Git操作を行わない。
- findingと根拠をrootへ返す。採否、修正、統合、再検証、最終判断はrootが行う。必要な独立再検証をrootの自己検証で代替しない。
- 通常作業の委譲はcurrent userが明示要求した範囲だけとし、共有資産保護とhuman gateは維持する。

### 3.4 Domain specialists

PRC-005のriskと明示gateに応じ、次の専門観点を独立レビューへ含める。role名は観点の識別であり、各項目ごとのagent起動や固定人数を要求しない。

- medical / pharmacy / patient / prescription / medication / inventory / claim / audit: `medical_safety_reviewer` + `privacy_compliance_reviewer`
- auth / authorization / tenant boundary / secret / external request: `security_critic` + 必要なら `threat_modeler`
- DB / migration / accounting / append-only ledger: `db_steward` + `data_integrity_auditor`
- API / schema / generated client: `api_contract_reviewer`
- UI / accessibility / clinical workflow: `frontend_reviewer` + `accessibility_ux_reviewer` + 必要なら `ui_flow_tester`
- test strategy / regression: `test_architect`

specialistは最終human authorityを代替せず、編集もしない。

## 4. 標準フロー

1. rootがGit、`Plans.md`、`State.md`、関連SSOT/code/testからcurrent stateとimpact radiusを確認する。
2. rootが対象、acceptance criteria、edge case、test、rollback、risk、必要なspecialist/human gateを確定する。
3. 必要な事前gateを満たした後、rootが最小complete sliceを実装し、focused validationから必要範囲を検証する。
4. PRC-005のrisk、明示gateまたは対象変更の反証必要性に応じて独立レビューを行う。rootがfindingを修正し、影響validationと必要な独立再検証を行う。
5. rootがdiff、validation、human gateを確認する。commit前に確定できる記録を完成させる。
6. rootだけがauthorized exact pathsをstageし、staged diffを確認する。commit/pushはcurrent request/WPの許可範囲に限る。

`State.md`はinterruption、blocker、human gate、dirty ownershipの再開用pointerとし、通常の成功履歴はGit/CIに残す。commit後の記録更新や追加pushを暗黙の完了条件にしない。current request/WPが明示要求する場合だけ行う。

## 5. 全layerの所有

Codex単一レーンは次のすべてを担当できる。

- product/domain SSOT、ADR、API/schema、運用・安全・security文書
- `apps/web` frontend、UI、accessibility、E2E
- `apps/api` backend、auth、repository、integration
- `packages/*` shared kernel、money/date、trace、events、contracts、calculation、audit
- migrations、database design、IaC、CI/CD、scripts、dependency governance
- unit、contract、integration、golden、E2E、performance test

layer間の担当分割を別agentレーンの境界にしない。代わりにSSOT、package boundary、exact path ownership、sole-editor規律で衝突を防ぐ。`packages/* -> apps/*`、循環依存、共通概念の二重定義は禁止する。

## 6. SSOT・evidence・実装規律

- APPROVED SSOTが先、実装が後。未承認または欠落した仕様をcodeで推測補完しない。
- 算定、請求、帳票はevidence registerのevidence_idがない限り実装せずBLOCKEDにする。
- 未知status、未知error、未知ruleはallow-list外としてfail-closedに扱う。
- 金額・点数はbigint正本、暦日はdate-time正本を使い、浮動小数点と暗黙current timeを使わない。
- APIはcontract-first、authorizationはdeny-by-default、accounting/audit/event ledgerはappend-onlyを維持する。
- 同一concept、enum、status、validationを複製せず、既存SSOTとcommon packageを拡張する。

## 7. Data、PHI、secret

- productionのPHI/PII、患者、処方、薬剤、請求、監査データをprompt、subagent packet、fixture、test、log、commit、issue、外部serviceへ渡さない。
- syntheticまたは適切にde-identifiedな最小データだけを使う。production dumpを開発・reviewへ転用しない。
- secret、credential、token、private keyをprompt、log、artifact、source controlへ含めない。
- tenant/pharmacy/user scopeをtrusted contextから構築し、caller提供値でauthorityを拡張しない。
- PHIをkey、index、URL、metric label、unredacted errorへ露出しない。必要な保存・転送はapprovedなencryptionとretentionに従う。
- subagentには必要なcode pathとsynthetic evidenceだけを渡し、機密データを複製しない。

## 8. Human approval gate

次の操作・判断は、実行直前の明示human approvalなしに行わない。

- migration適用、production `INSERT` / `UPDATE` / `DELETE`、data backfill、bulk operation
- deploy、publish、release、external API送信、email、batch実行、secret rotation
- production infrastructure変更、課金を伴うresource作成、不可逆操作
- `git reset --hard`、destructive cleanup、force-push、履歴改変
- auth/security/privacy制約の緩和、重大riskのacceptance
- 法令、診療報酬、薬学的妥当性、患者安全の最終判断
- SSOTまたはWPがhuman approvalを要求する昇格・release

高リスク(R3+)の実装は、required specialist reviewに加えて該当するhuman authorityの事前review recordが揃うまで開始しない。R4は実装禁止とし、human authorityがscope、evidence、risk acceptanceを明示して再計画するまでBLOCKEDを維持する。

通常のrepository内編集、focused test、read-only inspectionは、scope内なら逐次承認を必要としない。DB調査はSELECT/read-onlyを既定とする。

## 9. モデルと通信の禁止事項

- actual model ID、marketing name、reasoning tier、Cloud availability、sandbox/permissionを推測しない。
- 固定model階層、cost/token/complexityによる自動routing、automatic fan-outを行わない。
- exact modelまたはruntime capabilityがacceptanceに必要なら、実行環境または公式情報で確認する。確認不能ならblockerとして記録する。
- Claude / Opus その他の別agentレーンを起動・依頼・必須gate化しない。
- agmsgをtask assignment、handoff、approval、status、reviewに使用しない。repository recordとCodex native orchestrationを使う。

## 10. Validation、Git、完了

- `package.json`、CI、scriptsから実在commandを選び、focused checkから必要なfull gateへ広げる。
- validation failureを無視せず、実行不能なcheckは理由と未検証範囲を記録する。
- 必要なvalidation/review/human gateが完了し、critical findingが解消するまで完了にしない。
- subagentはcommit/pushしない。rootだけがowned exact pathを明示stageし、staged diffを再確認する。
- commit messageはWP-IDを先頭にし、unrelated dirty changeを混ぜない。
- pushは現在のhuman instructionまたはapproved WPが要求する場合だけrootが行う。
- 完了報告にはchanged files、validation command/result、残issue、未実施human gateを含める。

## 11. 旧文書の扱い

AGT-001〜AGT-017はWP-9001でSUPERSEDEDとなった決定履歴であり、本書の再改版中もそのstatusを維持する。旧割当、model routing、別agent lane、通信・lock/handoff手順を現行運用へ復活させない。初回cutoverの承認・metadata移行証拠はGit履歴を参照する。

## 12. 承認・発効シーケンス

本書の改版はPRC-007に従う。レビュー中は改版対象をPROPOSEDとし、承認・発効欄を空欄にする。required independent/specialist review、finding解消、必要なhuman approval、index同期を完了した後だけ承認・発効を記録する。今回の通常レビュー任意化を、本改版自体のrequired gateの免除へ先取り適用しない。rootがfinalization diffとvalidationを確認し、未完了の中間状態をlandingしない。
