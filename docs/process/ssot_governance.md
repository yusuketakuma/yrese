# ssot_governance — SSOT ガバナンス

```yaml
ssot_id: PRC-007
title: SSOT ガバナンス
domain: process
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - data_integrity_auditor
  - human_review_if_required
version: 0.3.1
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; data_integrity_auditor APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §0.1.6.17
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
impacts: 全SSOT・全実装
related_work_packages:
  - WP-9001
  - WP-9002
related_tests:
  - pnpm check:ssot-index
  - git diff --check
related_prs: []
evidence_ids: []
change_log:
  - 0.3.1 2026-07-10 WP-9001 cutover以降の23-field必須化とlegacy migration規則をAPPROVED化(data_integrity inventory 173/142・legacy semantics/body/status/approval/effective preservation確認)
  - 0.3.0 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSによりCodex単一レーン、independent verification、human/evidence gate、履歴明確化へ改定
  - 0.2.0 2026-07-10 ARC-008に基づくamends/PENDING_REVISION機構とdocs/research非SSOT領域を追加
  - 0.1.0 2026-07-09 初版。Phase 0 human reviewで承認
open_questions: []
blockers: []
```

## 1. 基本ルール

- Codex rootが仕様決定・差分・driftを検知した場合、current Work Packageを作成し、該当SSOTを作成または更新する。
- 実装者はAPPROVED SSOT、current WP、公式evidenceを読んでから実装する。SSOTにない仕様の独自補完を禁止する。
- current WP、`Plans.md`、`State.md`、agent packet、code、testはAPPROVED SSOTを上書きできない。競合時はWP側を`BLOCKED_NOT_READY`または`SSOT_UPDATE_REQUIRED`として停止し、SSOT改版後に再計画する。
- 仕様不備はcode側で解決せず`SSOT_UPDATE_REQUIRED`としてrootへ返す。
- read-only mapperが関連SSOT、source、depends_on/impacts、implementation/testを特定し、read-only pre-plan reviewerが改版scopeとgateを確認する。
- SSOTのeditorはsole maintainer 1名に限定し、変更を作成していないindependent verifierがdiff、metadata、source/evidence、index整合を確認する。
- high-risk領域はrelevant domain specialist reviewを必須とする。法令、請求、外部interface、薬学、患者安全、production操作、risk受容はhuman gateを明記する。
- commit/PR recordは`ssot_refs` / `ssot_versions`を記載する。SSOT差分なしにhigh-risk implementationだけを変更しない。
- 会話ログ、model内部計画、一時agent packetはSSOTではない。有益な内容はrepository内の正式文書へformalizeしてから根拠化する。
- rootだけがindependent verification後にowned exact pathをstageし、staged diffを確認してcommitし、要求時だけpushする。

## 2. ステータス

`DRAFT`(実装根拠禁止) → `PROPOSED`(review待ち・実装根拠禁止) → `APPROVED`(実装根拠可) → `IMPLEMENTED` → `VERIFIED`。

その他:

- `SUPERSEDED`: 後継SSOTに置換済み。履歴/provenanceとして保持するが現行根拠にしない
- `DEPRECATED`: 新規実装根拠にしない
- `BLOCKED`: 根拠不足、矛盾、法令/human確認待ち。解除条件まで実装禁止

statusを自動的に昇格しない。required specialist/human/evidence gateが未完了ならAPPROVEDへ変更しない。

working diffで新規SSOTまたは改版後の内容をreviewする間は`PROPOSED`、`approved_at` / `approved_by` / `effective_from`空欄を維持する。独立検証前に、将来の承認・発効・supersessionを完了済みとしてfrontmatterやindexへ記録しない。

## 3. 共通メタデータ

WP-9001 cutover以降に新規作成または改版するSSOTは、冒頭のyaml blockに少なくとも`ssot_id` / `title` / `domain` / `status` / `owner` / `reviewers` / `version` / `created_at` / `updated_at` / `approved_at` / `approved_by` / `effective_from` / `effective_to` / `source_refs` / `depends_on` / `impacts` / `related_work_packages` / `related_tests` / `related_prs` / `evidence_ids` / `change_log` / `open_questions` / `blockers`の23 fieldを置く。

WP-9001 cutover以前から存在し、今回本文・policyを改版していないlegacy SSOTは、23 field不足だけを理由に直ちにstatusを降格・無効化しない。既存のstatus、approval、effective date、実装根拠としての意味は、該当SSOT自身の既存frontmatterとindexに従う。legacy SSOTを将来改版する場合は、その同一変更で23 fieldを補完してからreviewへ回す。

legacy不足の一括解消はWP-9002で段階的に行う。metadata-only migrationは本文、status、approval、effective date、human decisionの意味を変更せず、各waveでindex同期、本文byte identity、independent verification、relevant spec/data-integrity reviewを必須とする。本文、法令、請求、薬学、患者安全、security/privacy、evidence、risk acceptanceの変更が必要になった文書はmigration waveから除外し、required human gateを持つ別WPとして扱う。本移行規則をhuman/safety/evidence gateの省略・緩和に使用してはならない。

ssot_id prefix: AGT(agents) / REG(regulatory) / SAF(safety) / PRD(product) / CAL(calculation) / CLM(claim) / ADP(adapters) / ARC(architecture) / MST(masters) / UIX(uiux) / SEC(security) / PRC(process) / QUA(quality) / TST(testing) / OPS(operations) / MOD(modules) / API(api)。

改版予約に用いる任意field `amends`(ADR側) / `amended_by`・`amendment_status`・`amendment_note`(対象SSOT側)は§7で定義する。非SSOTの提案・調査文書を置く`docs/research/`は§8で定義する。

## 4. 更新フロー(10段)

1. Codex root / mapperが仕様決定、差分、drift、source更新を検知する。
2. mapperが該当SSOT、depends_on/impacts、evidence、implementation/test impactを特定する。
3. rootがcurrent WPに`owner_role` / `reviewer_roles` / allowed/forbidden files / acceptance criteria / human gatesを定義する。
4. pre-plan reviewerが改版理由、scope、source/evidence、version、status、test planをread-onlyで確認する。
5. sole maintainerがmetadata、本文、index、関連SSOTを最小のcomplete batchで更新する。
6. independent verifierとrelevant specialistがdiff、source/evidence、矛盾、machine validationをread-onlyで確認する。
7. required human authorityが法令、請求、薬学、患者安全、production/risk gateを承認する。
8. required gate完了後だけstatusをAPPROVEDへ変更し、WPへ`ssot_refs` / versionsを固定する。
9. rootがowned exact pathだけをstageし、staged diffとvalidationを確認してcommit/pushする。
10. implementationとtest反映後、別のvalidation evidenceに基づきIMPLEMENTED / VERIFIEDへ更新する。

SSOT更新と実装を同じWPで行う場合も、APPROVED化に必要なreview/evidenceを実装で後追いしてはならない。

複数SSOTをatomic cutoverする場合は、review用batchをすべてPROPOSEDで整合させる。independent verificationとrequired human gateのPASS後、後継文書のAPPROVED化、旧文書のSUPERSEDED化、index同期を同一finalization batchで行い、そのfinalization diffをrootが再確認する。中間状態をlandingしない。

## 5. Phase 0 gateの歴史的事実

この節は2026-07-09に完了したPhase 0 gateの履歴であり、現在のstatusやrole routingを定義しない。

- gate前にはPhase 0文書群がPROPOSEDとして`ssot_index.md`へ列挙され、薬剤師、請求実務、法務、経営を含むhuman review対象になった。
- human reviewで承認された文書はAPPROVEDへ昇格し、指摘対象は差し戻す運用だった。
- gate以前にPROPOSED文書へ依存できる実装はR0-R2の骨格・型・guard・検査に限定され、R3+の算定rule値、receipt生成、Official Adapter、本番authはAPPROVED SSOT + evidence_idまで開始禁止だった。
- 現在の文書statusは各frontmatterと`docs/ssot_index.md`を確認する。Phase 0での一括reviewを、後日追加・改版された文書へのblanket approvalとして扱わない。

## 6. 検証済み情報の優先

同一項目が矛盾する場合、一次sourceに照合済みのREG-007 `evidence_verification_log`を、未確認注記より優先する。Codex rootはmapper evidence、independent verification、必要なdomain/human reviewを経て旧記載を訂正する。sourceの版、適用日、取得日、対象範囲を記録し、記憶や推測で上書きしない。

## 7. 上位方針ADRによる改版予約(`amends`)と暫定権威

上位architecture方針ADR(例: ARC-008)が既存APPROVED SSOTの結論を改版する必要がある場合、対象SSOT本体の完全改版(§4)を待たずにADRをAPPROVEDにできる。ただしAPPROVED同士の矛盾による誤実装をfail-closedで防ぐため、以下を必須とする。

1. **`amends`宣言**: ADRのfrontmatterに`amends: [対象ssot_id...]`を列挙する。これは対象SSOTの該当結論を改版予約していることのmachine-readableな宣言である。
2. **同一batchの改版予約stamp**: ADRをAPPROVEDへ昇格するcommitと同一batchで、各対象SSOTのfrontmatterに次を付与し、versionを1段上げる。
   - `amended_by: [ADR の ssot_id]`
   - `amendment_status: PENDING_REVISION`
   - `amendment_note: "<ADR>(APPROVED <date>)により改版予約中。方向は <ADR> が暫定的に優先する。本文の全面改版は §4 の10段フローで実施し本注記を解除する。"`
   このstampは軽量注記であり、`amendment_note`が変更記録を兼ねる。独立したchange_log行は対象SSOTの完全改版時にまとめて記載してよい。
3. **暫定権威**: `amendment_status: PENDING_REVISION`の対象SSOTについて、当該結論がADRと矛盾する場合はADR(APPROVED)を暫定的に優先する。旧本文を単独の実装根拠にせず、`amendment_note`とADRの該当箇所を確認する。
4. **予約の解除**: 対象SSOTを§4の10段フローで完全改版した時点で`amendment_status`を削除し、change_logへ改版内容を記載する。ADR側の`amends`から解除済み対象を落とすか解除済みと注記する。
5. **順序担保(fail-closed)**: ADRのAPPROVED昇格、`amends`宣言、全対象への予約stampを同一batchで行う。個別implementation WPはこの順序担保が済むまで着手しない。

本節は§4の10段フローを置換しない。ADRは方向の予約だけを与え、対象SSOT本体の正式結論は各文書の完全改版で確定する。

## 8. 非SSOT作業領域(`docs/research/`)

`docs/research/`はSSOTではない提案・調査・review用の作業領域である。

- SSOT index(IDX-001)の追跡対象外とし、`ssot_id`必須・index登録の規律を適用しない。`check:ssot-index`はこの領域を除外する。
- 実装の直接根拠にしない。proposalはpre-plan review、independent verification、relevant specialist/human gateを経て、該当SSOTへformalizeしてから根拠化する。
- frontmatterに`proposal_id` / `status: DRAFT`等を持ってよいが、APPROVED SSOTの正本性を持たない。
- SSOTへ昇格する内容はsole maintainerが該当domain SSOTを新規作成/改版し、root exact-stage landingを行う。

## 9. SSOT index machine validation

文書追加またはmetadata変更と同じbatchで`docs/ssot_index.md`を更新する。`pnpm check:ssot-index`で総数、section件数、ssot_id重複、path、label、status、並び順、未登録/不存在文書をmachine validationする。indexを未実装の自動生成物として扱わず、検証済みrepository artifactとしてmaintainする。

## 変更履歴

- 0.3.1 (2026-07-10): WP-9001 cutover後の新規・改版SSOTへ23-fieldを必須化し、既存legacyを無効化せずWP-9002でmetadata-only migrationする移行規則をAPPROVED化。data_integrity_auditorはinventory 173/142、legacy semantics/body/status/approval/effective preservation、AGT 17件のbody/status/23-field、validation gatesを確認してAPPROVED。
- 0.3.0 (2026-07-10): direct user instruction (WP-9001) により、AGT-018 role、maker/checker、human/evidence gate、root landing、Phase 0履歴の時制、index machine validationを明確化。`amends` / `PENDING_REVISION`機構は維持。
- 0.2.0 (2026-07-10): ARC-008 §9に基づき、上位方針ADRの`amends`、暫定権威、`PENDING_REVISION` stamp、同一batch順序担保と`docs/research/`非SSOT領域を追加。当時必須だったarchitecture/human reviewを経てAPPROVED化。
- 0.1.0 (2026-07-09): 初版。構築prompt v0.2.0のSSOT governanceを確定し、Phase 0 human reviewで承認。
