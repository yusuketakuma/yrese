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
version: 0.1.0
created_at: 2026-07-10
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED; data_integrity_auditor APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
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
  - 0.1.0 2026-07-10 Codex単一レーン、maker/checker分離、全layer所有、human gateをAPPROVED化(WP-9001、required reviews PASS)
open_questions: []
blockers: []
```

## 1. 目的と適用範囲

本書は yrese におけるエージェントの計画、実装、review、verification、landing の唯一の運用正本である。Codex root agent と Codex native subagent だけで単一レーンを構成し、SSOT/docs、frontend、backend、shared packages、database/IaC、tests、scripts、CIを含む全layerを一貫して扱う。

単一レーンは「1人ですべてを自己承認する」ことを意味しない。編集権を sole maintainer 1名に限定し、maker と checker を別context・別役割に分離して、並行編集と自己reviewを防ぐ。

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

### 3.2 Codex root agent

- repository current stateを復元し、acceptance criteria、所有範囲、停止条件を確定する。
- mapper、plan reviewer、sole maintainer、independent verifier、domain specialistを割り当てる。
- 同時editorが1名だけであることと、unrelated dirty changeが保護されていることを確認する。
- 最終validation、exact staging、commit/push、`State.md`等のlanding記録に責任を持つ。

### 3.3 Code mapper / explorer

- read-onlyで関連SSOT、code path、test、dependency、dirty state、impact radiusを特定する。
- 事実と推測を分離し、`path:line`、実行command、再現手順など検証可能なevidenceをrootへ返す。
- ファイルを編集せず、実装を先取りしない。

### 3.4 Plan reviewer

- `implementation_planner` または `spec_guardian` としてread-onlyで計画を確認する。
- SSOTの承認状態、acceptance criteria、edge case、migration/rollback、test範囲、human gate、scope過不足を確認する。
- 仕様不足は `SSOT_UPDATE_REQUIRED`、evidence不足はBLOCKEDとしてrootへ返す。

### 3.5 Sole maintainer (maker)

- 1つのactive work scopeで唯一ファイルを編集できる役割である。
- approved scope内の最小で完全な変更を、repo-local patternを使って実装する。
- root causeを修正し、必要なtestとprogress記録を更新する。
- commit/pushは行わず、変更pathとvalidation結果をrootへ返す。

### 3.6 Independent verifier (checker)

- 対象変更を作成していない別contextのCodex agentを割り当てる。
- read-onlyでdiff、acceptance criteria、test妥当性、security/privacy、data integrity、performance、unrelated change混入を確認する。
- failureやfindingを隠さずsole maintainerへ戻す。verifier自身は修正しない。
- 修正後は再度独立検証し、evidence付きでPASS / CHANGES_REQUIRED / BLOCKEDを返す。

### 3.7 Domain specialists

対象に応じ、次のread-only reviewerを追加する。

- medical / pharmacy / patient / prescription / medication / inventory / claim / audit: `medical_safety_reviewer` + `privacy_compliance_reviewer`
- auth / authorization / tenant boundary / secret / external request: `security_critic` + 必要なら `threat_modeler`
- DB / migration / accounting / append-only ledger: `db_steward` + `data_integrity_auditor`
- API / schema / generated client: `api_contract_reviewer`
- UI / accessibility / clinical workflow: `frontend_reviewer` + `accessibility_ux_reviewer` + 必要なら `ui_flow_tester`
- test strategy / regression: `test_architect`

specialistは最終human authorityを代替せず、編集もしない。

## 4. 標準フロー

非自明な作業は次の順序で行う。

1. rootが `git status --short`、`Plans.md`、`State.md`、progress file、既存validationからcurrent stateを復元する。
2. code mapperが関連SSOT/code/testとimpact radiusをread-onlyで特定する。
3. rootがsingle highest-value taskと具体的acceptance criteriaを定義する。
4. plan reviewerがSSOT、edge case、test、human gate、停止条件を確認する。
5. rootがsole maintainer 1名とexact path scopeを指定する。
6. sole maintainerが最小のcomplete fixと必要なtestを実装し、validationする。
7. independent verifierと必要なdomain specialistがread-onlyでmaker/checker reviewを行う。
8. findingがあればsole maintainerが修正し、checkerが再検証する。
9. rootがstaged前のdiff、validation、human gateを確認する。
10. rootだけがexact pathをstageし、staged diffを再確認してcommit/pushする。
11. rootが`State.md`、必要なprogress/PR記録へcommit、validation、残riskを残す。

read-only調査は安全に並列化できる。編集は並列化せず、常にsole maintainer 1名に限定する。root自身が編集する場合はrootがsole maintainerを兼ね、その間ほかのeditorを置かない。

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
- task assignmentは `code_mapper`、`maintainer`、`verifier` などrole/capabilityで行い、未確認のモデル名でroutingしない。
- exact modelまたはruntime capabilityがacceptanceに必要なら、実行環境または公式情報で確認する。確認不能ならblockerとして記録する。
- Claude / Opus その他の別agentレーンを起動・依頼・必須gate化しない。
- agmsgをtask assignment、handoff、approval、status、reviewに使用しない。repository recordとCodex native orchestrationを使う。

## 10. Validation、Git、完了

- `package.json`、CI、scriptsから実在commandを選び、focused checkから必要なfull gateへ広げる。
- validation failureを無視せず、実行不能なcheckは理由と未検証範囲を記録する。
- maintainerとcheckerの結果が一致し、critical findingが解消するまで完了にしない。
- subagentはcommit/pushしない。rootだけがowned exact pathを明示stageし、staged diffを再確認する。
- commit messageはWP-IDを先頭にし、unrelated dirty changeを混ぜない。
- pushは現在のhuman instructionまたはapproved WPが要求する場合だけrootが行う。
- 完了報告にはchanged files、validation command/result、残issue、未実施human gateを含める。

## 11. 旧文書の扱い

本書がPROPOSEDの間、AGT-001〜AGT-017は既存のAPPROVED statusを維持する。本書がindependent verificationとrequired human gateを通過してAPPROVEDになる同一batchで、AGT-001〜AGT-017をmetadata-onlyで`SUPERSEDED`へ変更する。旧文書の本文は決定履歴・provenanceとして保持するが、cutover後の割当、model routing、Claude/Opus gate、dual lane、agmsg、lock/handoff手順の根拠には使用しない。

cutover後に旧文書と本書が競合する場合は本書を適用する。旧文書の一部を復活させる場合は、暗黙に参照せず、本AGT-018を人間承認付きで改版する。

## 12. 承認・発効シーケンス

1. WP-9001のworking diffでは本書と関連改版を`PROPOSED`に保ち、`approved_at` / `approved_by` / `effective_from`を空欄にする。
2. 変更を作成していないindependent verifierとrequired specialistsが、scope、SSOT間整合、human gate、機械validationを確認する。
3. findingをsole maintainerが修正し、checkerが再検証する。
4. direct user instructionによるcutover承認とverification PASSをrecordした後、次のstatus matrixどおりに同一finalization batchを作る。元のstatusを無視して全SSOTを一括APPROVEDにしてはならない。
5. Codex rootがfinalization diffとvalidationを再確認してからlandingする。途中状態をmainへlandingしない。

### 12.1 WP-9001 finalization status matrix

| 対象 | `a5eb9a8`時点 | review中 | required review後のtarget |
|---|---|---|---|
| AGT-018 | 文書なし | PROPOSED | direct cutover approval + independent verifier + required specialistsのPASS後にAPPROVED |
| SPEC-001/002、PRC-001〜007、OPS-012、REG-006、PLAN-PHASE0-001、IDX-001 | APPROVED | PROPOSED revision | routing改版のindependent verifier、relevant specialists、既存のapplicable human gate完了後にAPPROVEDへ戻す |
| PLAN-UIUX-001 | PROPOSED | PROPOSED routing-overlay revision | **PROPOSEDを維持**。WP-9001のcutover approvalをdesign/product/human approvalへ流用せず、別のrequired design/human gateなしにAPPROVED化しない |
| AGT-001〜AGT-017 | APPROVED | APPROVEDのまま・本文無変更 | AGT-018のAPPROVED化と同一batchでmetadata-only SUPERSEDED |
| `AGENTS.md`、`CLAUDE.md`、`Plans.md`、`State.md` | SSOT status対象外 | review diff | SSOT statusを付与しない |

### 12.2 旧AGT metadata finalization gate

AGT-001〜AGT-017のSUPERSEDED化は本文を変更せず、frontmatterだけを更新する。ただし`metadata-only`を理由にPRC-007の共通metadataを省略してはならない。finalization前に17件すべてについて次の23 fieldを機械監査する。

`ssot_id` / `title` / `domain` / `status` / `owner` / `reviewers` / `version` / `created_at` / `updated_at` / `approved_at` / `approved_by` / `effective_from` / `effective_to` / `source_refs` / `depends_on` / `impacts` / `related_work_packages` / `related_tests` / `related_prs` / `evidence_ids` / `change_log` / `open_questions` / `blockers`

2026-07-10のreview-stage監査ではAGT-001〜015は23 fieldを満たし、AGT-016/017に`effective_from` / `effective_to` / `depends_on` / `impacts` / `related_work_packages` / `related_tests` / `related_prs` / `evidence_ids` / `change_log`の不足を確認した。finalization sole maintainerはAGT-016/017へ不足fieldをprovenanceに基づいて追加し、全17件へversion、`updated_at`、`effective_to`、`superseded_by: AGT-018`、SUPERSEDED change logを整合させる。旧本文がbaseからbyte-identicalであること、23-field監査、index status同期をindependent verifierが確認するまでlandingしない。
