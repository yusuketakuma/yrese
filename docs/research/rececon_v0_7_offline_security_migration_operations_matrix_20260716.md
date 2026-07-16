# yrese / PH-OS v0.7 offline・security・migration・operations matrix

```yaml
document_kind: research_and_planning_artifact
status: DRAFT
work_package: WP-0054h
created_at: 2026-07-16
risk_class: R4
authority: none
implementation_authority: 0
production_authority: 0
evidence_promotion: 0
supersedes: none
```

## 1. 結論

1. 障害時継続は「画面が開く」ことではなく、operationごとに`FINAL / PROVISIONAL_OR_PENDING / FORBIDDEN / RECOVERY_ONLY / BLOCKED_UNDEFINED`を一意にし、復旧後の再検証・差額・競合・送信を完了させることである。
2. Edgeへ載せるのは「全データのコピー」ではない。目的・同意・tenant/pharmacy/patient cohort・Resource version・有効期限・暗号化・manifest/hashを持つ最小bundleとし、技術control stateとclinical payloadを分離する。
3. RTO/RPOはAWS製品名から逆算しない。業務影響と許容損失から決め、selected recovery strategy、backup/PITR/replica、restore validation、traffic failover/failbackを実地訓練で測る。AWS Backup自体はrestore time SLAを保証しないため、候補値4時間/15分を設定だけで達成済みにしない。
4. backup successはrestore successではない。FHIR/transaction ledger/audit/object/queue/config/key/Edgeを復元し、tenant分離、hash、version、referential integrity、claim/accounting totals、FHIR validation、RECOVERY_SYNCを通して初めて復旧証跡となる。
5. migration/cutoverではaggregate単位のwrite authorityを常に1つにする。parallel comparisonは許可しても恒常的dual-writeを正本にしない。rollbackは新系差分export、旧系再入力・照合、audit lineageまでrehearsalする。
6. support accessはsession単位の薬局同意、対象tenant/pharmacy、目的、期限、最小scope、操作監査を必須とし、unattended broad accessや画面録画を既定にしない。PHI解除はbreak-glassであり通常経路ではない。
7. 現行APPROVED文書間に正本、LOCAL_ONLY会計、移行範囲の競合がある。R4領域なので、本Draftで解決せずPRC-007同一batchとhuman authorityへ戻す。

## 2. 反復調査方法

1. ARC-001/002/010、SEC-004/005、OPS-002/003/004/005/010、ADP-002とruntime enumをfresh readした。
2. v0.7のoperation、Edge、RTO/RPO、restore、cutover、support、external fallback要求を既存行へ写像した。
3. MHLW 7.0/FY2026 checklistとAWS公式DR/restore文書をlive取得し、設定と実証を分離した。
4. 既存SSOT間の矛盾を抽出し、推測で統合せずamendment gateを設定した。
5. すべてのoperation/dependencyへ「障害中」「禁止」「pending」「復旧後作業」を割り当て、未決定は`B`で閉じた。

## 3. 現行authorityと競合

| ID | 現行記述A | 現行記述B / v0.7 | 判定 / 必要手続 |
|---|---|---|---|
| CF-01 | ARC-010: Cloud Core event storeが正本、Edgeは正本を持たない | ARC-008/v0.5: clinical dataはauthoritative FHIR ServerのFHIR Resourceが正本 | `BLOCKED_AUTHORITY_CONFLICT`; ARC/DOM/DB/event/FHIR persistenceを同一PRC-007 batchで改版 |
| CF-02 | ADP-002: patient/insuranceはCloud、進行中prescription/dispensingはEdge | yrese/PH-OS resource ownershipはresource単位authoritative FHIR Server、offline local creationあり | aggregate/resource/use-case単位のwrite ownerとreplica昇格規律を再定義 |
| CF-03 | ARC-001: LOCAL_ONLY会計は仮額・仮精算で条件付き許可 | ARC-010: LOCAL_ONLYで会計確定不可 | collection/temporary receipt/ledger posting/final chargeを分離して会計human review |
| CF-04 | ARC-001/shared-kernel: CLOUD_DEGRADEDで外部確認を条件付き許可 | Cloud停止時のOfficial Adapter経路は未確定 | route healthをoperation authorityにし、mode名だけで成功にしない |
| CF-05 | OPS-002: 薬歴・在庫・帳票原本等を移行しない/旧系参照 | v0.7: 薬歴、在庫、帳票/PDF等を移行inventoryに含む | source availability/legal integrity/product scopeをdomain別human decisionへ |
| CF-06 | OPS-005: Cloud RTO 4h/RPO 15m候補 | 実DR strategy、cross-region/data residency、restore evidenceなし | candidate維持、契約/SLO昇格禁止 |
| CF-07 | OPS-010: backup retention候補35日+月次1年 | 法令保存期間にcurrent/future time splitあり | retentionをbackup設定へ直結せずREG-003/legal decisionへ |

APPROVED同士の競合では、後続の明示amendmentであるARC-008をFHIR clinical directionの暫定優先とするが、実装開始権限にはしない。

前提仕様v0.6/v0.6.1のversioned raw artifactはrepositoryに存在しないため、network resilienceとBedrock fallbackのexact requirement/deltaは`PARTIAL_SOURCE_BLOCKED`である。本書のO32/X16/D10はユーザー提示v0.7と現行repositoryからの計画候補であり、欠落原文を復元したものではない。

## 4. 外部公式sourceのlive確認

2026-07-16にdecoded bodyを取得した。hashはdrift検知用であり、適合・認証・法的解釈を意味しない。

| Source | HTTP / bytes / SHA-256 | 適用する推論 | 適用しない推論 |
|---|---|---|---|
| [MHLW 安全管理ガイドライン7.0 landing](https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html) | 200 / 59345 / `5d78477d650aaa16d64c7ddc0c48b712f7dbf2009e00a0bbed87e9902f6dfcfb` | 2026-06 current publication/watch | landingだけで全control適合 |
| [FY2026 pharmacy cybersecurity checklist](https://www.mhlw.go.jp/content/10808000/001716185.pdf) | 200 / 614686 / `a1250114cd1dfb33049f27d86f6c883b61881207e5a47ce8adf11d2dd2ebea8a` | asset/remote maintenance/access log/BCP等をmapping対象化 | product実装だけで薬局運用項目完了 |
| [FY2026 checklist manual](https://www.mhlw.go.jp/content/10808000/001716186.pdf) | 200 / 2191433 / `a5cbb45d7582c9309a81bf537cf97abddc5336dfd45a6274a394059cfdc6df78` | pharmacy/provider responsibilityと確認方法の参照 | human確認・運用規程の代替 |
| [AWS Well-Architected REL13](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel-13.html) | 200 / 13635 / `6044f6e630352186c434582c0432358f6e856566706cf418ab00f84ea8aaf6a1` | RTO/RPOはbusiness needsから定義、DRをtest | AWS利用だけで目標達成 |
| [AWS DR strategies](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_planning_for_recovery_disaster_recovery.html) | 200 / 52223 / `888d901b0df3dc91d61f71ff805ea6d58e163d3acdbadd6203b57e81f7de9079` | backup/pilot light/warm/active-active、PITR、failback、control-plane依存回避 | generic目安をyreseの確約値へ転用 |
| [AWS Backup restore testing](https://docs.aws.amazon.com/aws-backup/latest/devguide/restore-testing.html) | 200 / 63411 / `08c43a8da8157036d8ed9cf60f222e4ab591d341b6bf49b9fb4c531e597a4e29` | periodic restore job、duration、validation evidence | restore job successだけでapplication整合性確認 |
| [AWS Backup restore](https://docs.aws.amazon.com/aws-backup/latest/devguide/restoring-a-backup.html) | 200 / 29101 / `da04d42a40f895d1fa773863ac3338cbe104a6d8290889c25f19a05374d86634` | restore metadata、新resource、RTO実測 | original resourceへ安全に上書きされるとの仮定 |
| [AWS Backup controls](https://docs.aws.amazon.com/aws-backup/latest/devguide/controls-and-remediation.html) | 200 / 31541 / `f7ba951117fea3e7ee04933a2027fba96fb8199fd7f85d2ca930638236e0ca85` | plan/retention/encryption/cross-region/restore objective controls | AWS Backupがrestore time SLAを保証するとの主張 |

## 5. Operation × mode統合matrix

凡例:

- `F`: authoritative final operationを許可。
- `P`: provisional/pendingのみ。外部確認・finalization・送信成功を主張しない。
- `X`: 禁止。UI/API双方で理由付き拒否。
- `V`: recovery/revalidation専用、または完了後にのみ解禁。
- `Q`: 接続経路とauthoritative resultが実際に利用可能な場合だけ条件付き。
- `B`: 新規要求でauthority/contract未確定。実装禁止。

ARC-001の既存28行が優先し、本表は横断projectionである。差異は本表を直すのではなくARC-001改版へ戻す。

| ID | Operation | NORMAL | EXT_DEG | CLOUD_DEG | LOCAL_ONLY | RECOVERY | 必須status / 復旧後作業 |
|---|---|---:|---:|---:|---:|---:|---|
| O01 | cached patient/coverage read | F | F | F | F | F | stale/source time表示 |
| O02 | last eligibility snapshot read | F | F | F | F | F | method/time/reverify表示 |
| O03 | new eligibility verification | F | X | Q | X | V | PENDING_REVERIFY→authoritative recheck |
| O04 | paper prescription reception | F | F | F | P | V | LOCAL_ONLY_UNVERIFIED→identity/source recheck |
| O05 | JAHIS QR candidate import | F | F | F | P | V | original comparison/profile/code revalidation |
| O06 | manual correction | F | F | F | F | F | version/provenance/history |
| O07 | e-prescription retrieve | F | X | Q | X | V | PENDING_EXTERNAL_SYNC→retrieve/compare |
| O08 | e-prescription dispense result | F | X | Q | X | V | queue→send→official result |
| O09 | external duplicate-medication check | F | X | Q | X | V | not checked != no issue |
| O10 | PMH verification | F | X | Q | X | V | PENDING_PMH_REVERIFY |
| O11 | pharmacist review | F | F | F | F | F | actor/time/version; human only |
| O12 | prescription inquiry record | F | F | F | F | F | Communication/Task/provenance candidate |
| O13 | final calculation | F | P | F | X | V | qualification/master/record revalidation |
| O14 | provisional calculation | F | F | F | P | F | PROVISIONAL_CALCULATION |
| O15 | charge/payment collection | F | P | F | P | V | CF-03 unresolved; adjustment/reconciliation |
| O16 | document/receipt/label output | F | P | F | P | V | provisional label, print evidence, reissue |
| O17 | dispense/audit record | F | F | F | F | V | local chain/integrity/rebase |
| O18 | pre-claim check | F | X | X | X | V | all revalidation tasks complete first |
| O19 | monthly snapshot/lock | F | X | X | X | V | RECOVERY unresolved=0 then NORMAL |
| O20 | receipt file finalize/export | F | X | X | X | V | locked snapshot + official validator |
| O21 | official claim handoff | F | X | X | X | V | generation != handoff success |
| O22 | master production activation | F | F | X | X | V | signature/schema/regression/version check |
| O23 | master/version display | F | F | F | F | F | last sync/update time |
| O24 | local-LAN partner integration | F | F | F | F | V | delivery pending/DLQ/idempotency |
| O25 | cloud aggregation/backup | F | F | P | P | V | backlog/backup gap/restore follow-up |
| O26 | authentication | F | F | P | P | V | TTL, revocation recheck, audit |
| O27 | role/user administration | F | F | X | X | V | cloud authority + session invalidation |
| O28 | cancel/amend/refund | F | F | P | P | V | reversal, two-step, human review |
| O29 | PH-OS offline visit create | B | B | B | B | B | authority/persistence/consent contract required |
| O30 | PH-OS offline bundle issue | B | B | B | B | B | manifest/key/expiry/revocation contract required |
| O31 | yrese↔PH-OS FHIR sync | B | P | P | P | V | no multi-master, history/rebase/transaction |
| O32 | Bedrock AI assist | P | P | P | X | P | draft only; unavailableで通常業務継続 |
| O33 | local device operation | F | Q | Q | Q | V | capability/health/idempotency/manual fallback |
| O34 | remote support access | F | F | X | X | V | explicit consent/session/scope/audit |
| O35 | backup restore/failover | V | V | V | V | V | production changeはhuman incident/DR authority |
| O36 | migration cutover/rollback | B | X | X | X | X | scheduled human Go/No-Go only |

O29〜O36はcandidateであり、APPROVED operation SSOTに追加されるまで`B`がfail-closed defaultである。

## 6. Data classification — 二軸モデル

`@yrese/events`の`none / pii / phi / phi_pii`をpayload classificationの唯一の既存runtime authorityとして維持する。秘密情報、法令保持、改ざん耐性を同enumへ混ぜず、次のcontrol axisを別に持つ。

| Control class | 例 | PHI axis例 | Edge | Log/metric | Backup/export | Required controls |
|---|---|---|---|---|---|---|
| C0 PUBLIC | 公開IG、公開Capability | none | 不要 | 可 | integrityのみ | version/hash/license |
| C1 INTERNAL | job state、non-PHI metrics | none | 必要最小 | allowlist | encrypted policy | tenant不要でもaccess制御 |
| C2 PERSONAL | staff/account/contact | pii | 必要時 | raw禁止 | encrypted/scope | purpose/retention/audit |
| C3 CLINICAL | FHIR Patient/Medication/visit | phi_pii/phi | consent-scoped bundle | raw禁止 | encrypted, tenant isolated | least privilege, provenance, history |
| C4 CLAIM_ACCOUNTING | receipt/claim/ledger refs | phi_pii | minimum/offline rule | raw禁止 | immutable lineage | legal retention, append-only/reversal |
| C5 AUDIT_EVIDENCE | AuditEvent/hash/access record | none/ID refs原則 | local chain | debug logと分離 | WORM/tamper controls | no silent delete, chain validation |
| C6 SECRET_KEY | token/private key/certificate | noneだがsecret | TPM/keychain候補 | 絶対禁止 | dedicated secret/key backup only | rotation/revocation/dual control |

Control PlaneへC3/C4 payloadを複製しない。reference、hash、status、retry metadataだけを持ち、debug log/metric labelにpatient/resource raw IDを載せない。

## 7. Edge / Offline Bundle contract candidate

### 7.1 Manifest

```text
bundle_id
bundle_purpose
tenant_ref / pharmacy_ref / device_ref
patient cohort references
consent references and purpose_of_use
created_at / valid_from / expires_at / cutoff
source authoritative server and endpoint identity
resource type + logical id + versionId + lastUpdated + profile
content hashes / manifest signature
encryption envelope / key identifier (key material禁止)
schema / FHIR / JP Core / IG / terminology / master versions
minimum app/Edge version
revocation and stale-data limitations
size/count totals
provenance/audit references
```

### 7.2 Resource/data set

| Bundle | Minimum candidate | Exclude by default | Refresh/expiry | Recovery |
|---|---|---|---|---|
| Pharmacy operations | today reception, selected patient/prescription/dispense, required master subset | cross-store patients, old documents | shift/day + event delta候補 | identity/qualification/calculation recheck |
| PH-OS visit | Patient, MedicationRequest/Dispense, allergy/condition, CarePlan/Task/Appointment/Consent | unrelated family/facility patients | visit window + explicit expiry | history pull, rebase, human conflict |
| Claim emergency read | locked claim/snapshot refs and validation status | editable final claim payload | claim month/read-only | Cloud authority復旧後のみwrite |
| Device config | capability, signed driver/config, printer template | credentials in plaintext | version/signature | self-test + rollback |
| Master | approved last-known-good terminology/rule projection | unvalidated update | effective/version | distribution integrity + regression |

Bundle deletionはexpiryだけで即時断定せず、unsynced local records、legal hold、audit evidenceを分離する。端末紛失時のremote revocationはoffline端末へ即時到達しないため、full-disk encryption、TTL、local access、post-recovery auditが必要である。

## 8. Recovery objective matrix

候補値はOPS-005を再掲するだけで新たなauthorityを作らない。`TBD`はbusiness impact/human approval/実測が必要である。

| Capability/data | Business fallback | RTO candidate | RPO candidate | Recovery strategy candidate | Proof required |
|---|---|---:|---:|---|---|
| Cloud Core aggregate | Edge LOCAL_ONLY | 4h (OPS-005) | 15m (OPS-005) | Multi-AZ + selected regional DR TBD | game day, traffic/failback, application validation |
| Clinical FHIR stores | read-only Edge subset | within Cloud candidate, not separately fixed | resource/event loss tolerance TBD | PITR/backup/replica TBD | FHIR validation/history/reference/tenant checks |
| Claim/accounting ledger | no final claim; provisional collection boundary unresolved | TBD ≤ business deadline | accepted loss likely stricter; human decision | append-only backup/PITR | totals, sequence, reversal, snapshot lock |
| Audit evidence | local chain continues | TBD | missing audit event tolerance requires human/security decision | independent immutable copy | chain/sequence/signature/access validation |
| Documents/Binary | reprint from verified source when possible | TBD | issued document loss tolerance TBD | versioned object + backup | hash/template/version/issued lineage |
| Technical queues | local outbox/inbox | TBD | event loss=0 candidate, not approved | durable queue + replay/history | duplicate/out-of-order/DLQ tests |
| Edge Node failure | Cloud direct if available / replacement device | TBD | last sync + encrypted local backup delta (OPS-005) | local encrypted backup + Cloud rehydrate | replacement drill + RECOVERY_SYNC |
| Identity/certificates | bounded offline auth TTL | TBD | revocation/config RPO TBD | break-glass/secondary path | expired/revoked/offline scenarios |
| Master/terminology | last-known-good version | no business stop | zero silent version drift | signed versioned package | hash/effective date/regression |
| Official external systems | pending operation | provider-controlled | not applicable; local queue durability applies | official downtime procedure | recovery query/retry/result reconciliation |
| Bedrock AI | AIなしで継続 | 0 for core workflow | no clinical authority/data loss accepted | disable/circuit breaker | mandatory workflow without AI |

RTO clock start、detection、declaration、service restoration、data validation、business releaseの各timestampを分ける。「service endpoint up」をRTO完了にせず、critical journeyがsynthetic dataで完了した時点をbusiness restoreとする。

## 9. Backup / restore validation matrix

| Order | Restore unit | Restore action | Application validation | Failure handling |
|---:|---|---|---|---|
| RST-01 | identity/config/IaC inventory | isolated test account/environmentへ復元 | expected version、no production routing | missing config/key dependencyを記録 |
| RST-02 | keys/cert references | authorized recovery/rotation | decrypt sample、expired/revoked reject | key materialをlog/artifactへ出さない |
| RST-03 | FHIR/clinical store | point-in-time/new resourceへ復元 | profile, history, reference, count/hash, tenant isolation | productionへ自動promoteしない |
| RST-04 | claim/accounting | consistent snapshotへ復元 | claim month lock、totals、ledger sequence、reversal | mismatchはrelease BLOCKED |
| RST-05 | audit/event store | immutable copy/chain復元 | hash chain、sequence、logical clock、gap | security incident + no silent repair |
| RST-06 | documents/objects | versioned objects復元 | content hash、metadata、template/master refs | missing object listを証跡化 |
| RST-07 | queues/control state | reconstruct from durable state/history | idempotency、DLQ、no lost/duplicate apply | replayをproductionで即実行しない |
| RST-08 | Edge replacement | encrypted backup + Cloud subset | device cert、DB、audit chain、bundle version | RECOVERY_SYNC必須 |
| RST-09 | projections/search | authoritative storesからrebuild | counts/query contracts/performance | projectionをauthorityにしない |
| RST-10 | full critical journeys | synthetic A/B/C journeys | patient/store/month固定、no false success | human Go/No-Goまでtraffic禁止 |

Restore testの必須記録: recovery point、start/end、operator/approver、environment、resource versions、validation version、expected/actual RPO、expected/actual technical/business RTO、exceptions、cleanup、evidence hash。AWS job successだけではRST-03〜10を満たさない。

## 10. Migration / cutover / rollback matrix

### 10.1 Authority phases

| Phase | Old system | New system | Write authority | Evidence |
|---|---|---|---|---|
| M01 inventory | live | read-only import sandbox | old only | source/version/license/data map |
| M02 dry run | live | isolated candidate | old only | counts/mapping/unmigrated report |
| M03 parallel compare | live | shadow calculation/render | old only unless explicitly scoped | deterministic diff categories |
| M04 freeze | frozen at declared time/month | final delta staging | none during bounded freeze | freeze hash/cursor |
| M05 final reconcile | read-only | staged | none | count/amount/FHIR/code/audit checks |
| M06 Go/No-Go | read-only | staged | none | human approvals + rollback readiness |
| M07 cutover | read-only | production | new only | timestamp/config/version audit |
| M08 hypercare | read-only | production | new only | daily diff/incidents/SLO |
| M09 rollback if invoked | reactivated under runbook | frozen/exported | explicit transfer, never both | new delta export/re-entry/reconcile |
| M10 retirement | retained read-only/export | production | new only | legal retention/export/deletion evidence |

### 10.2 Domain reconciliation

| Domain | Minimum proof | Unknown/error behavior | Rollback concern |
|---|---|---|---|
| Patient/identity | count, identifiers, merge/split candidates | MANUAL_REVIEW_REQUIRED | old/new ID crosswalk |
| Coverage/public expense | count, validity, source | PENDING_REVERIFY | claim impact |
| Medication/prescription/dispense | count, code/version, FHIR validation | unmapped list, no fuzzy assign | clinical lineage |
| Claim/calculation | known-case golden diff, totals, rule/master versions | BLOCKED unsupported/evidence gap | claim month boundary |
| Accounting/unpaid | ledger totals and open balances | imbalance BLOCKED | payment after freeze |
| Inventory | quantity/value/lot/expiry by scope | no silent zero/default | movements during freeze |
| Documents/legal records | count/hash/readability/metadata | missing list, old-reference decision | reissue/authenticity |
| Audit/provenance | chain/export/source identity | gaps become security/data blocker | no fabricated history |
| PH-OS/home | resource ownership/version/consent | out-of-scope list | offline device deltas |

`OPS-002`の現行除外とv0.7 scopeの差は、source export権利、legal preservation、business value、verification costを人間がdomain別に決定するまで自動拡張しない。

## 11. Support access contract

| Stage | Required control | PHI rule | Write rule | Audit/evidence |
|---|---|---|---|---|
| S01 case intake | case ID、category、requestor identity | PHI本文を最小化 | none | timestamp/channel |
| S02 pharmacy verification | registered contact + pharmacy admin | none | none | verification method |
| S03 consent | session purpose/scope/duration | masking default | none | explicit approver/time |
| S04 session issue | named support actor, tenant/pharmacy, device, expiry | no broad tenant switch | deny-by-default | token/session ID |
| S05 diagnosis | health/config/masked logs first | raw PHI禁止 | read-only default | all read/search audit |
| S06 PHI break-glass | necessity/reason/second approval候補 | minimum view | no clinical decision | alert + post review |
| S07 repair proposal | evidence/runbook/expected change | synthetic reproduction優先 | preview/dry-run | diff/rollback |
| S08 write execution | pharmacy/human approval per risk | scoped | idempotent/reversible where possible | command/result/version |
| S09 close | revoke session, summarize | PHI-free case summary | none | revocation/completion |
| S10 post review | anomalous access/necessity | no data reuse | none | reviewer/findings |

禁止: shared account、standing broad access、unattended access、supportによる薬学/請求の自己承認、監査なしのshell/DB write、production copyのlocal download、screen recordingを操作監査の代用にすること。

## 12. External dependency fallback matrix

| ID | Dependency | Detect / mode | During outage | Forbidden / pending | Recovery action |
|---|---|---|---|---|---|
| X01 | Cloud Core | health + CLOUD_DEG/LOCAL | Edge minimum workflow | final claim/role admin; local pending | R1-R6, conflict, recalculation |
| X02 | Edge Node | self-test/device health | Cloud direct if approved | stale local success | replacement restore + RECOVERY |
| X03 | network/DNS | reachability/path checks | local LAN/Edge | generic success assumption | reconnect, queue/history reconciliation |
| X04 | IdP/auth | token/IdP health | TTL-bounded offline auth | new role/admin, expired TTL | revocation/permission recheck |
| X05 | online eligibility | Official Adapter result | last snapshot + manual procedure | new verified status | batch recheck/diff |
| X06 | PMH | Official Adapter result | paper/manual pending | PMH success | recheck/copay difference |
| X07 | e-prescription | Official Adapter result | paper route where officially allowed | retrieve/send success | retrieve/compare/send/result |
| X08 | online claim | official terminal/result | artifact generation/queue only if allowed | transmitted/accepted state | handoff/result reconciliation |
| X09 | JAHIS QR | scanner/parser validation | manual original entry | source trust elevation | compare/hash/provenance |
| X10 | NSIPS legacy | adapter health | FHIR/API core continues | shared-folder record as core truth | retry/DLQ/roundtrip report |
| X11 | partner EHR/history/POS/inventory | partner health | core workflow + pending | delivery/stock/payment success | retry/idempotency/business reconcile |
| X12 | printer/scanner/device | device health/test page | alternate device/manual controlled path | printed/scanned success | job/evidence/double-output check |
| X13 | notification/delivery | provider webhook/result | internal task remains open | notified/delivered/counseled | retry/status query/human follow-up |
| X14 | FHIR partner/subscription | delivery/history cursor | authoritative local server continues | partner synced | history/delta pull, contract validation |
| X15 | master/terminology distribution | signature/version/lag | last-known-good version | stale as latest | package verify/regression/approval |
| X16 | Amazon Bedrock | timeout/circuit breaker | manual/non-AI workflow | AI result required, auto-send/finalize | discard stale draft or regenerate with review |

外部サービスのSLAをyreseの成功stateへ変換しない。authoritative result ID/time/versionを取得できない場合はpending/unknownであり、HTTP 2xxだけでclinical/official successにしない。

## 13. Rehearsal / acceptance package

| Drill | Inject | Pass evidence | Human gate |
|---|---|---|---|
| D01 Cloud outage | Cloud/API unreachable | O01〜17許可/禁止一致、no false final | pharmacist/operations |
| D02 official outage | eligibility/PMH/eRx timeout | PENDING付与、queue、recovery | official workflow/claim |
| D03 Edge loss | disk/device unavailable | Cloud direct or documented stop、replacement | security/operations |
| D04 network partition | duplicate/out-of-order/clock drift | no multi-master、human conflict | data integrity |
| D05 ransomware/credential | immutable backup + revocation scenario | isolated restore、access evidence | security/legal |
| D06 full restore | Cloud stores/objects/audit/queues | RST-01〜10、actual RTO/RPO | Go/No-Go authority |
| D07 cutover rollback | post-cutover critical defect | M09 export/re-entry/reconcile | pharmacist/claim/accounting |
| D08 support break-glass | synthetic PHI case | consent/scope/audit/revoke/post-review | privacy/security |
| D09 PH-OS field offline | visit + delayed sync + conflict | bundle expiry/rebase/transaction | home-care/privacy |
| D10 AI outage | Bedrock unavailable | mandatory workflows complete without AI | product/medical safety |

全drillはsynthetic/de-identified data、isolated environment、事前approved scopeで実施する。production failover、restore、migration、remote writeは別の明示human approvalが必要である。

## 14. Work package分解

| Order | WP candidate | Scope | Exit / blocker |
|---|---|---|---|
| 1 | RES-AMD-01 | CF-01〜04 authority/accounting/mode amendment packet | FHIR/data/accounting/security human decision |
| 2 | MIG-AMD-01 | CF-05 domain migration decision | legal/vendor/license/business decision |
| 3 | DATA-CLASS-01 | PHI axis + C0〜C6 control axis registry | privacy/security/data approval |
| 4 | EDGE-BUNDLE-01 | manifest/resource/expiry/encryption contract | PH-OS/FHIR/consent/device approval |
| 5 | MODE-OPS-01 | O01〜O36 machine-readable operation registry | pharmacist/claim/accounting/operations approval |
| 6 | DR-OBJ-01 | business impact and exact RTO/RPO | product/operations/legal approval |
| 7 | DR-STRAT-01 | selected AZ/Region/backup/failover/failback strategy | data residency/cost/security approval |
| 8 | RESTORE-01 | RST-01〜10 automation + validation | isolated drill evidence |
| 9 | SUPPORT-01 | session consent/scope/audit/break-glass | pharmacy/privacy/security approval |
| 10 | EXT-FALLBACK-01 | X01〜X16 adapter/device runbooks | official specs + partner contracts |
| 11 | CUTOVER-01 | M01〜M10/domain reconciliation | rollback rehearsal + Go/No-Go |
| 12 | BCP-DRILL-01 | D01〜D10 recurring exercise | evidence + corrective action closure |

## 15. BLOCKER / stop conditions

- `BLOCKED_AUTHORITY_CONFLICT`: CF-01〜04を解消せずFHIR/Edge/sync/accountingを実装しない。
- `BLOCKED_MIGRATION_SCOPE`: OPS-002とv0.7の移行差を隠さない。
- `BLOCKED_EDGE_SYNC_DESIGN`: Edge execution/persistence/protocol/key/manifest未確定。
- `BLOCKED_SECURITY_REVIEW`: encryption、offline auth TTL、break-glass、support access未承認。
- `BLOCKED_DR_OBJECTIVES`: business-approved RTO/RPO、data residency、cost/strategy未確定。
- `BLOCKED_RESTORE_EVIDENCE`: backup job successをrestore/application validationの代用にしない。
- `BLOCKED_CUTOVER_ROLLBACK_UNDEFINED`: rehearsalなしにcutoverしない。
- `BLOCKED_OFFICIAL_ADAPTER_SPEC`: unofficial connection/scraping/success fabrication禁止。
- `BLOCKED_PRODUCTION_ACTION`: production restore/failover/migration/support writeは明示human approvalまで禁止。
- `BLOCKED_INDEPENDENT_VERIFICATION`: 現行single laneでは独立検証未実施。

## 16. 網羅性監査

| WP-0054h requirement | Coverage |
|---|---|
| operation×LOCAL_ONLY可否 | §5 O01〜O36 |
| PHI/data class | §6 C0〜C6 + existing PHI axis |
| Edge bundle | §7 manifest + 5 bundle classes |
| RTO/RPO/SLO | §8 capability matrix |
| restore | §9 RST-01〜10 |
| cutover/rollback | §10 M01〜M10 + domain reconciliation |
| support access | §11 S01〜S10 |
| external fallback | §12 X01〜X16 |
| cloud/AI/external unavailable | §5、§8、§12 |
| possible/forbidden/pending/recovery | §5 legend + each matrix row |
| production rehearsal human gate | §13、§15 |
| SSOT conflicts | §3 CF-01〜07 |

網羅性は設計項目の存在を示すだけで、BCP、MHLW checklist、security、RTO/RPO、restore、migration、official connection、production readinessの達成を証明しない。
