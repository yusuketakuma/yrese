# yrese / PH-OS v0.7 UX・性能・KPI evidence plan

```yaml
document_kind: research_and_planning_artifact
status: DRAFT
work_package: WP-0054g
created_at: 2026-07-16
authority: none
implementation_authority: 0
production_authority: 0
evidence_promotion: 0
supersedes: none
```

## 1. 結論

1. Guided Mode と Expert Mode は別の業務状態機械にしない。同一の command、validation、permission、audit、idempotency、FHIR / business Resource version を使い、presentation と入力支援だけを変える。
2. 取り違え防止の固定文脈は患者だけでは不足する。全画面で tenant、pharmacy、system mode を固定し、患者業務では patient、請求業務では claim month、在宅では visit / facility を追加する。文脈変更は明示操作、未保存変更確認、再認可、監査を伴う。
3. `仮/確定`、`未確認/確認済み`、`同期待ち/同期済み`、`請求可/不可` は直交する状態軸であり、単一の「完了」へ潰さない。色だけでなく、短いラベル、形状、ARIA role/live region、根拠日時・actorを組み合わせる。
4. v0.7の性能値は既存UIX-003候補値と一部異なる。既存APPROVED本文をDraftが上書きしてはならない。Phase 1の実機baseline、負荷モデル、測定点、cold/warm、Edge/Cloud経路、データ量を固定し、PRC-007改版が承認されるまでrelease SLOにしない。
5. KPIは名称だけでは実装不能である。全指標に numerator、denominator、event-time clock、source authority、exclusion、late-arrival/correction、version、privacy classificationを持たせる。業務改善KPIと人事評価を分離し、AI利用率や店舗ランキングを代理評価へ流用しない。
6. 現在のruntime evidenceは受付・患者検索・横断状態部品が中心で、3本のend-to-end journey、全キーボード操作、screen reader実機、real-device performance、PH-OS訪問同期は未実証である。計画を実装済みと扱わない。

## 2. 調査範囲と判定規律

対象はv0.7 §27、§34、WP-0054g、および22 domain中のUX/KPI横断部分である。調査は次の順序で反復した。

1. repositoryのAPPROVED SSOT、実装、test evidenceを確認する。
2. 一次標準または標準保有者の公開資料をlive取得する。
3. 標準が直接要求する事項と、本計画が安全上推論した事項を分離する。
4. 既存SSOTと差分があれば上書きせず、改版候補とhuman gateへ戻す。
5. 受入条件・測定条件・失敗条件まで分解できない項目はBLOCKEDのままにする。

本書は設計候補であり、APPROVED SSOT、法令判断、薬剤師判断、請求実務判断、production SLOを変更しない。

## 3. 現行repository evidence

| 領域 | 現行証拠 | 判定 |
|---|---|---|
| 通常/LOCAL_ONLY/RECOVERY_SYNC | `docs/uiux/workflow_map.md` | 3導線はAPPROVED。ただしeffective_fromはnull、E2E/human validationは未完了 |
| 操作×system mode | `docs/architecture/offline_mode_matrix.md` | 28操作、LOCAL_ONLY絶対禁止16項目。薬剤師/請求実務の最終確認は未完了 |
| 医療UI原則 | `docs/uiux/medical_ui_ux_principles.md` | 患者固定、色非依存、仮/確定、外部未確認の原則あり |
| usability | `docs/uiux/usability_acceptance_criteria.md` | UAC-01〜12は候補条件。被験者、WCAG/JIS範囲、実施証跡なし |
| performance | `docs/uiux/performance_budget.md` | 18候補値。Phase 1実測・capacity整合前はSLO化禁止 |
| stability | `docs/uiux/stability_slo_policy.md` | 7候補指標、ST-01〜15。runtime/integration validation未完了 |
| capacity/telemetry | `docs/operations/performance_capacity_plan.md`, `docs/operations/observability_plan.md` | 負荷値は候補。PHI-free correlation、p50/p95/p99方針あり |
| public KPI | `docs/quality/public_quality_kpi_policy.md` | 法務・匿名化・同意完了まで公開BLOCKED |
| 返戻率 | `docs/quality/claim_return_rate_kpi_policy.md` | 定義枠はあるが返戻workflow SSOT待ち |
| runtime UI | `apps/web/app/**` | 受付、患者検索、患者文脈、状態部品、fixture-only機能が中心 |
| Guided/Expert | repository検索 | 名称・共通command contract・切替規律は未実装 |
| pharmacy固定 | whoami contractには`pharmacyId`あり | 全画面の人間可読店舗固定表示は未実装 |
| claim month固定 | date-time/domain SSOTには型あり | 月次請求全画面の固定表示・変更guardは未実装 |
| browser/device evidence | `docs/ui-ux-refresh/10-verification-evidence.md` | unit/build証拠あり。E2E、200% zoom、target size、screen reader、実機は未実施 |

### 3.1 実装済みと計画済みを混同しない

- 患者文脈部品と横断接続が存在しても、全22 domainの患者固定を証明しない。
- `SystemModeBadge`が存在しても、live Edge mode、全操作可否、recovery queueのend-to-endを証明しない。
- status registryが存在しても、各domainのauthoritative transitionとUI表示の一致を証明しない。
- component/unit testは、実ブラウザ、支援技術、現場端末、混雑時、薬剤師/事務ユーザー試験の代替ではない。
- fixture-only画面をproduction contractまたはlive data pathとして数えない。

## 4. 外部一次資料のlive確認

2026-07-16にdecoded bodyを取得した。hashはページ更新検知用であり、法令・標準の版固定や転載許諾を意味しない。

| Source | HTTP / bytes / SHA-256 | 本計画で使う範囲 | 使わない推論 |
|---|---|---|---|
| [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/) | 200 / 512457 / `6e3c5fe397257cae509a2fb4752b73062cf8cbeb92c2cec618989b17e4cf7057` | normative success criteriaの基準点 | yreseが適合済みとの主張 |
| [SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) | 200 / 43857 / `f4a2beabf987bf97256e7c82088f3f396d80e3468354581baa0eddd2d55439a8` | 色以外のtext/shape cue | 色を禁止すること |
| [SC 3.3.4 Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html) | 200 / 47877 / `290b14c44ff5d33946fa361de22f19e009da4aeb69054f2be5dbcd97266f9a77` | 金銭・重要データ操作のreversible/checked/confirmed | 全保存にmodalを要求すること |
| [SC 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | 200 / 50853 / `b93282227d05fca17a2f5b6bf4a4ade2171e2ab40894082f9de4817ca303f6ed` | 意味・操作を保持するfocus順 | 視覚配置と常に同一順を強制すること |
| [SC 2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | 200 / 49543 / `a79262a0d026f6dbc6e5d34aa627be58dc45719735498c5724b7c051b61021d9` | sticky patient/store/mode headerがfocusを完全に隠さない | 固定headerを禁止すること |
| [SC 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 200 / 65164 / `f006ee8815f8e2a87ebd83fa538bb71d3d2dc43d921e9cd2761b77a590830f7f` | 24×24 CSS pxまたはspacing等の例外条件 | 全controlを同じ大きさにすること |
| [WAI-ARIA APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 200 / 43147 / `4282d2eeb383c717ba41f52f0db1643fb3eb9acc33fa3879ef817e27c162453e` | focus移動、trap、return、Escape/close設計 | APG exampleだけでWCAG適合とすること |
| [Interaction to Next Paint](https://web.dev/articles/inp) | 200 / 150771 / `b6418a8fffab82db03292f7b8a2c2dedce4d0bd53b2674cbb9c9bd11e3362c1a` | click/tap/keyboardからnext paintまでのfield responsiveness | business operation完了時間の代用 |
| [OpenTelemetry HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/) | 200 / 291994 / `de82cf989b6add74316854aa71705d1fb327df91f8c07a329d201d9ec6ce572d` | HTTP duration histogram、単位・属性の標準化 | PHIや高cardinality IDをmetric labelに入れること |

W3C Understanding/APGはnormative WCAG本文そのものではない。実装ガイダンスとして使用し、適合判定は対象範囲、accessibility support、manual/automated testを別途固定する。

## 5. 共通interaction architecture

### 5.1 Guided / Expertは同一command contract

```text
Presentation(Guided | Expert)
  -> same UseCaseCommand
  -> same input schema and precondition
  -> same permission and tenant/pharmacy scope
  -> same idempotency/concurrency contract
  -> same authoritative domain transition
  -> same audit/provenance outcome
  -> same read projection
```

| 項目 | Guided Mode | Expert Mode | 共通でなければならないもの |
|---|---|---|---|
| 導線 | 次操作、理由、必須確認を段階表示 | shortcut、command palette、連続入力 | command ID、前提条件、結果state |
| 入力 | progressive disclosure、説明、例 | compact layout、既定focus | schema、validation、terminology |
| 警告 | 詳細説明を同時表示 | summaryから詳細へ即移動 | severity、BLOCKER、override rule |
| 確定 | review stepを明示 | review summaryへ直接移動可 | confirm payload、actor、version、audit |
| エラー | recovery guidanceを展開 | error codeとrecovery shortcut | outcome、retry/idempotency、no false success |
| 設定 | user preference | user preference | role/permissionを変更しない |

禁止:

- Expertだけvalidation、薬剤師確認、会計確認、請求lockを省略する。
- GuidedとExpertで別status enum、別API、別audit eventを作る。
- mode変更で未保存入力、patient/pharmacy/claim month文脈を失う。
- shortcutが非表示buttonや権限外commandを実行する。
- AIがGuidedの「次へ」を利用してhuman gateを自動通過する。

### 5.2 固定文脈契約

| Context | 常時表示条件 | 最小表示 | 変更時guard |
|---|---|---|---|
| Tenant | 全画面 | 法人/tenantの人間可読名 | session再認可、未保存確認、監査 |
| Pharmacy | 全画面 | 店舗名、店舗コード、remote入力表示 | 明示選択、権限再検証、患者/queue再読込 |
| System mode | 全画面 | NORMAL等のlabel、制約、最終変化時刻 | system authorityのみ、user偽装不可 |
| Patient | patient-specific画面 | 氏名、カナ、生年月日、年齢、性別、identifier補助 | dirty form破棄/保存選択、対象再確認 |
| Claim month | claim/check/closing/resubmission | YYYY-MM、snapshot/lock状態 | explicit picker、当時有効版再解決、監査 |
| Facility / Visit | PH-OS施設・訪問画面 | 施設、patient、visit date/time、visit ID | offline bundle整合、route/task再読込 |
| Authority/version | update/finalize画面 | server/resource versionまたはsnapshot ID | If-Match/競合、silent overwrite禁止 |

tenant/pharmacy/patient/claimMonth等のraw IDを画面だけのauthorityにしない。API側の認証contextとresource referenceを一致させ、不一致はfail-closedにする。

### 5.3 直交状態軸

| Axis | 例 | UI要件 | 確定判定への影響 |
|---|---|---|---|
| Record lifecycle | DRAFT, PENDING_REVIEW, APPROVED, FINALIZED, AMENDED | actor/time/versionを表示 | FINALIZEDでも外部未確認なら請求不可になり得る |
| External verification | NOT_CHECKED, PENDING_REVERIFY, VERIFIED | source、確認日時、期限 | 未確認を成功色・checkで表示しない |
| Sync | LOCAL_ONLY, QUEUED, SYNCING, CONFLICT, SYNCED | queue age、retry、conflict owner | SYNCEDは臨床妥当性や請求可を意味しない |
| Claimability | claimable / blocked + reasons | blocker一覧、解除条件 | 単一booleanだけで根拠を隠さない |
| Calculation | provisional / final | rule/master/evidence version | provisionalを患者最終額・請求額にしない |
| Human review | unreviewed / reviewed / overridden | reviewer、timestamp、override reason | AI draftや機械checkをhuman reviewにしない |
| Delivery/notification | pending / delivered / failed | recipient channel、retry | 通知成功を服薬指導完了にしない |

## 6. Journey A — 受付から会計・交付

| Step | Command / read | 固定文脈 | 成功state | pending/blocker | Keyboard / accessibility | Offline / failure |
|---|---|---|---|---|---|---|
| A01 受付選択 | create/select reception | pharmacy, mode | PRE_RECEIVED/CHECKED_IN候補 | duplicate/expired | 一覧→詳細のfocus順 | LOCAL_ONLY仮受付 |
| A02 患者特定 | search/select/create Patient | pharmacy, patient | patient context fixed | matching review | 同姓同名をtext差分 | cached/local範囲を明示 |
| A03 代理人/同意 | select RelatedPerson/Consent | patient | representative confirmed | consent withdrawn | 関係・権限を読上げ可能 | 未確認を保留 |
| A04 資格/公費 | read verification snapshot | patient, mode | VERIFIED snapshot | PENDING_REVERIFY/PMH | 最終確認日時を可視 | 外部成功を捏造しない |
| A05 処方入口 | import/manual/OCR candidate | patient, source | ingress candidate | trust/profile/code errors | source/trustをlabel | OCR/QRは候補、原本照合 |
| A06 原本照合 | confirm source diff | patient, prescription | MedicationRequest accepted | unresolved diff | 差分へ直接focus | offline履歴を保持 |
| A07 処方変更 | amend/query/substitute | patient, prescription | new version + provenance | inquiry/clinical blocker | before/after非色依存 | destructive overwrite禁止 |
| A08 調剤入力 | create/update dispense draft | patient, prescription | dispensing draft | device/stock/picking issue | RP単位の予測可能focus | local draft/autosave候補 |
| A09 臨床監査 | evaluate/ack alert | patient, meds | reviewed or task | BLOCKER/CRITICAL | alertは適切なlive region | external check pendingを分離 |
| A10 仮算定 | calculate candidate | patient, claim context | provisional trace | evidence/master gap | traceへshortcut | LOCAL_ONLYは仮のみ |
| A11 薬剤師確認 | confirm clinical/dispense | patient, versions | reviewer recorded | segregation/override reason | review summary、戻って修正 | human action必須 |
| A12 確定算定 | calculate final candidate | patient, mode | final calculation | qualification/record blocker | amount+根拠 | LOCAL_ONLY禁止 |
| A13 会計確認 | create charge/payment intent | patient, pharmacy | checked transaction | unpaid/partial/refund | review/correct/confirm | 仮精算を明示 |
| A14 入金/領収 | append ledger entries | patient, receipt context | payment allocated | device/duplicate/number | reversible/checked/confirmed | local number collision防止 |
| A15 帳票/交付 | enqueue/record delivery | patient, document | issued/delivered state | print/send failure | statusをprogrammatic通知 | queued != printed/delivered |
| A16 終了/次受付 | close journey | pharmacy | COMPLETED | remaining task | 1 commandで受付へ、patient解除 | pending taskを隠さない |

Acceptance scenarioはnormal、external degraded、LOCAL_ONLY、RECOVERY_SYNC、duplicate submit、stale version、printer failure、partial payment、patient switchを別ケースで持つ。

## 7. Journey B — 月次請求

| Step | 固定文脈 | 入力/出力 | fail-closed condition | 証跡 |
|---|---|---|---|---|
| B01 対象月選択 | pharmacy + claim month | candidate cohort | 暗黙の現在月禁止 | actor/time/month |
| B02 snapshot候補 | claim month + definition version | immutable candidate set | draft/pending混入 | cohort hash/count |
| B03 資格再確認 | patient/claim refs | verification result | unresolved external/PMH | source/time/result |
| B04 記録整合 | claim/resource refs | record existence result | required record missing | rule/evidence refs |
| B05 算定再検証 | master/rule versions | deterministic diff | unsupported/evidence gap | calculation trace |
| B06 形式検証 | receipt spec version | errors/warnings | exact official artifact未固定 | validator/version |
| B07 修正loop | issue owner | amended source + rerun | finalized source silent overwrite | before/after/provenance |
| B08 Snapshot | claim month | immutable snapshot | non-NORMAL/recovery残 | snapshot ID/hash |
| B09 Lock/finalize | claim month + version | locked batch | permission/If-Match/audit failure | lock actor/time/version |
| B10 Export/handoff | locked batch | receipt artifact | generation != official transmission | artifact hash/result |
| B11 Result intake | batch/result | accepted/returned/reduced | unknown result mapped as success | source file hash |
| B12 Return/resubmit | original batch/ref | new correction lineage | original mutation | reason/diff/lineage |

全画面でclaim month、pharmacy、snapshot/lock stateを固定する。Guidedは未解消理由順に案内し、Expertはissue tableとshortcutを提供するが、同じB01〜B12 commandを使う。

## 8. Journey C — yrese / PH-OS在宅訪問

| Step | Authority | Bundle/context | pending/conflict | Offline behavior |
|---|---|---|---|---|
| C01 訪問準備 | PH-OS | patient/facility/appointment/task | stale yrese replica | bundle cutoff/version表示 |
| C02 yrese臨床同期 | yrese resources | Patient/Coverage/MedicationRequest/Dispense等 | missing/provenance gap | read-only replica |
| C03 Offline Bundle | PH-OS | consent-scoped minimum data | consent/expiry/device risk | encrypted、expiry、manifest/hash |
| C04 チェックイン | PH-OS | Encounter candidate | wrong patient/facility | local create + provenance |
| C05 観察/残薬 | PH-OS | Observation/MedicationStatement draft | source/confidence | autosave、draft明示 |
| C06 写真/文書 | PH-OS | DocumentReference metadata | upload pending/failed | local encrypted queue |
| C07 AI支援 | draft only | provenance/model/input refs | unavailable/unsafe output | AIなしで継続 |
| C08 薬剤師review | PH-OS | reviewed resources/tasks | missing review | human action、version固定 |
| C09 Recovery rebase | both, no multi-master | history/delta + local versions | conflict requires human | auto overwrite禁止 |
| C10 transaction push | PH-OS authority | Bundle + idempotency | partial/OperationOutcome | retry/dead letter |
| C11 yrese replica | PH-OS resources | Encounter等 | lineage/tenant mismatch | read-only replica |
| C12 報告/共有 | PH-OS | Communication/DocumentReference | consent/delivery failure | queued != delivered |

## 9. Keyboard / accessibility test contract

### 9.1 Baseline candidate

- 対象conformanceはWCAG 2.2 AAを候補とし、JIS X 8341-3との適用関係はhuman accessibility/legal reviewで確定する。
- 全機能をkeyboardで操作でき、focus orderが意味と業務順を保持し、sticky context header/dialog/toastがfocusを完全に隠さない。
- focus indicator、text label、shape、programmatic name/role/valueを持つ。色・位置・アニメーションだけで意味を表さない。
- status messageは重要度に応じて`status`/`alert`等を使い、focusを不必要に奪わない。BLOCKER dialogはAPG patternに沿ってfocusをcontainし、close後にtriggerへ戻す。
- financial/data finalizationはreview、correction、reversalの少なくとも適切な仕組みを持つ。日常のdraft saveへ無差別なmodalを追加しない。
- pointer targetはSC 2.5.8の24×24 CSS pxまたは認められたspacing/例外をtestする。現場touch端末の安全targetは実機試験でより大きいproduct基準を検討する。

### 9.2 Scenario matrix

| Test | Input | Required evidence | Stop condition |
|---|---|---|---|
| Keyboard-only A/B/C | mouse/touch禁止 | focus trace、completion、error count | trap、focus loss、hidden focus |
| 200% zoom/reflow | supported viewport | screenshot + task completion | context/actionが不可視 |
| forced colors | OS/browser mode | status discrimination | color-only state |
| reduced motion | OS preference | no essential info loss | motion required to understand |
| screen reader | NVDA/JAWS/VoiceOver候補 | name/role/value/status transcript | false success/unannounced blocker |
| target size | automated + manual | dimensions/spacing report | adjacent high-risk misactivation |
| error prevention | payment/finalize/delete | review/correct/reverse evidence | irreversible accidental action |
| context switch | patient/pharmacy/month | dirty guard + audit | stale context retained |
| warning fatigue | synthetic session | counts, acknowledgement, misses | CRITICAL miss |

使用ブラウザ、OS、scanner/keyboard、display resolution、zoom、assistive technology versionはtest runごとに固定する。本番PHIは使用しない。

## 10. Performance measurement contract

### 10.1 二種類のlatencyを分離する

1. `interaction_latency`: click/tap/keyから次の意味あるpaintまで。INP/RUMで観測できる範囲。
2. `business_operation_latency`: command開始からauthoritative outcomeが利用可能になるまで。API、Edge、Cloud、job、adapterを含む。

INPが速くても保存・算定・会計が未完了なら成功ではない。逆に非同期job全体が長くても、投入確認・進捗・取消が速ければinteractive UXは成立し得る。

### 10.2 必須measurement fields

| Field | Rule |
|---|---|
| operation_id | SSOT registryの低cardinality ID |
| start/end | monotonic clockでduration、wall clockは相関用 |
| outcome | success / blocked / error / cancelled / timeoutを分離 |
| mode/path | NORMAL等、EDGE_LOCAL/CLOUD/ADAPTER/JOB |
| device_class | approved hardware profile。serialやpatient IDは禁止 |
| browser/app/schema/master version | cohort比較可能にする |
| cold_warm | cold start/cache cold/warmを分離 |
| data_volume_bucket | patient/claim/item countのbucket。raw PHIは禁止 |
| concurrency_bucket | active terminal/job count |
| network_profile | LAN/WAN/degraded/offline、RTT/packet loss profile |
| percentile/window | p50/p95/p99、window、sample count、missing count |
| correlation | trace/exemplarへPHI-free IDで接続 |
| exclusion | bot/test/cancel等をversioned ruleで明示 |

HTTP transport durationはOpenTelemetryのstable `http.client.request.duration` / server counterpart等を利用候補とし、business operation histogramを別名で定義する。tenant/pharmacy/patient/resource IDをmetric labelへ入れず、必要な調査は権限制御されたtrace/auditへ分離する。

### 10.3 候補値の競合と扱い

| Operation | v0.7記述 | UIX-003既存候補 | 判定 |
|---|---:|---:|---|
| 通常interaction | p95 300ms | shell遷移 p95 500ms等 | operation定義不一致。新SLO化禁止 |
| 患者検索 | p95 500ms | local p95 200ms | 既存候補をDraftで緩和しない |
| 処方初期表示 | p95 1s | 直接対応なし | cold/warm/data量を定義して測定 |
| 仮算定 | p95 1s | local p95 500ms | 既存候補をDraftで緩和しない |
| QR/FHIR mapping | p95 1.5s | QR仮取込 p95 1.5s | mapping/profile validation終点を明確化 |
| 会計確定 | p95 1s | p95 800ms | 既存候補をDraftで緩和しない |

PRC-007改版まではUIX-003の18候補値が既存authorityであり、どちらもrelease SLOではない。

### 10.4 Baseline run matrix

最低限、approved low/mid端末×supported browser、Edge warm/cold、master/index warm/cold、synthetic small/median/high-volume、1/3/5 terminal候補、normal/degraded/RECOVERY burstを直交させる。事業計画上の実負荷が確定するまで80/150 prescriptions等の既存capacity候補を事実として扱わない。

## 11. KPI definition registry candidate

共通field: `kpi_id`, `definition_version`, `numerator`, `denominator`, `unit`, `event_time`, `attribution`, `source_authority`, `exclusions`, `late_arrival`, `correction_policy`, `privacy_class`, `owner`, `human_approval`。

### 11.1 受付・調剤・在宅

| KPI | Numerator / denominator | Clock / attribution | Source / exclusion |
|---|---|---|---|
| prescription_count | eligible finalized dispensing journeys / none(count) | dispense completion date / pharmacy | MedicationDispense + journey; cancelled/test excluded |
| patient_count | distinct Patient refs with eligible journey / none | service period / pharmacy | authoritative refs; merge lineage applied |
| new_patient_count | first eligible pharmacy journey patients / eligible patients | first-service event / pharmacy | migration baseline required; unknown history excluded |
| wait_time | checked-in→counseling-ready duration observations | event time / reception pharmacy | queue events; paused/external wait separately tagged |
| input_time | input-start→validated-draft observations | monotonic duration / actor role | command events; idle timeout excluded by versioned rule |
| dispensing_time | dispensing-start→dispensing-complete | event time / pharmacy | workflow events; rework reported separately |
| audit_reject_rate | rejected audits / completed audit decisions | audit decision / pharmacy | audit workflow; cancelled excluded |
| handover_completion_time | checked-in→handover-complete duration | event time / pharmacy | journey events; delivery journey separate |
| unfinished_medication_record_rate | overdue unfinished records / due records | due cutoff / pharmacy | record lifecycle + policy version; not-yet-due excluded |
| followup_completion_rate | completed eligible followups / due eligible followups | due period / responsible pharmacy | Task/Communication; cancelled with reason separated |
| home_visit_completion_rate | completed authorized Encounters / scheduled eligible visits | scheduled period / PH-OS org | Appointment/Encounter; patient cancel separated |

### 11.2 請求・会計

| KPI | Numerator / denominator | Clock / attribution | Source / exclusion |
|---|---|---|---|
| preclaim_detection_rate | issues detected before lock that would block/correct claim / validated true issues | original claim month | check results + final disposition; denominator needs adjudication protocol |
| return_rate | returned receipts / finalized submitted receipts | original claim month / pharmacy | QUA-009; unknown/late result fail-closed |
| eligibility_error_rate | confirmed eligibility-caused returns/errors / submitted receipts | original claim month | structured return reason; unclassified excluded and reported |
| public_expense_error_rate | confirmed public expense/PMH errors / submitted receipts | original claim month | return/check authority; paper-only uncertainty separated |
| resubmission_completion_rate | completed resubmissions / eligible returned claims | return cohort / pharmacy | return lifecycle; withdrawn separate |
| unpaid_balance | open charge amount - allocated payment/refund adjustments | as-of instant / ledger owner | append-only ledger; provisional charge excluded |
| refund_amount_count | finalized refund amount and count / none | refund posting date | ledger; voided entries handled by reversal |
| cash_variance | counted cash - expected cash | closing event / register-pharmacy | closing ledger; unresolved variance visible |

### 11.3 在庫・薬事業務

| KPI | Numerator / denominator | Clock / attribution | Source / exclusion |
|---|---|---|---|
| inventory_value | on-hand quantity × approved valuation basis | as-of snapshot / pharmacy | inventory ledger + price version; valuation policy unresolved |
| inventory_turnover | dispensed cost / average inventory value | period / pharmacy | ledger; valuation consistency required |
| dead_stock | value/count over no-movement threshold | as-of instant | inventory events; threshold versioned/human approved |
| waste | wasted quantity/value / received or available basis | waste event period | ledger + reason; recall/expiry separated |
| stockout_rate | stockout demand events / eligible demand events | demand time / pharmacy | reservation/procurement events; rejected prescriptions not inferred |
| generic_ratio | approved generic measure numerator / approved denominator | claim/service period | official definition/version required; do not improvise |
| add_on_status | eligible/claimed add-on measure by official definition | claim month | calculation/claim trace; evidence/version required |

### 11.4 Platform / reliability / AI

| KPI | Numerator / denominator | Clock / attribution | Source / exclusion |
|---|---|---|---|
| api_success_rate | contract-success responses / eligible requests | request end / API class | telemetry; auth attacks/health probes separated |
| offline_incident_count | LOCAL_ONLY entry episodes / none | mode transition time / pharmacy cohort | system mode events; flap coalescing rule versioned |
| sync_conflict_rate | human-review conflicts / sync attempts or resources | detection time / authority pair | sync control + refs; retry duplicates deduped |
| sync_recovery_success | recovered items / recovery-eligible items | recovery cohort | queue/history; unresolved remain denominator |
| webhook_delivery_success | acknowledged deliveries / eligible deliveries | delivery attempt cohort / partner | control plane; retries shown separately |
| subscription_recovery_success | recovered missed changes / detected missed changes | recovery window / partner | history/delta evidence; undetected loss cannot be claimed |
| AI_usage_rate | human-initiated eligible AI assists / eligible opportunities | interaction period / use case | AI orchestration; disabled/unsupported excluded explicitly |
| AI_acceptance_rate | human-accepted reviewed drafts / human-reviewed AI drafts | review decision / use case | provenance/review events; no-review outputs excluded, partial edits separate |

### 11.5 KPI禁止事項

- denominatorを小さくするためPENDING、返戻、未完了をsilent exclusionしない。
- event arrival monthとclinical/claim attribution monthを混同しない。
- zeroを「問題なし」とせず、no data / not applicable / collection failureを分離する。
- merged/split Patient、late return、reversal、backfill、definition changeの再集計履歴を消さない。
- 店舗、薬剤師、患者のランキングや人事評価へ、適用性・統計・法務・倫理reviewなしに流用しない。
- AI利用率を目標化して不要なAI利用を誘発しない。
- public KPIはQUA-008のlegal/privacy/contract/匿名化human gateを通るまで公開しない。

## 12. Prototype and test package

WP-0054gは実UIを変更せず、後続WPのtestable packageを定義する。

| Artifact | 内容 | Exit evidence |
|---|---|---|
| Journey state model | A01-16/B01-12/C01-12とcommand/status/ref | domain/API/UX human approval |
| Context header prototype | tenant/pharmacy/mode/patient/month/facility | 200% zoom、keyboard、focus-not-obscured |
| Guided/Expert prototype | 同一command IDの2 presentation | state/audit/API diff=0 |
| State discrimination set | lifecycle/verification/sync/claimability/calculation/review | color-off、screen reader、誤認test |
| Error/recovery prototype | timeout/409/412/partial/print/offline/conflict | next action到達率、false success=0 |
| Performance harness | RUM + business timer + Edge/Cloud trace | field completeness、PHI leak=0 |
| KPI registry schema | common fields + 34 candidate definitions | numerator/denominator/clock/source completeness |
| Synthetic scenario pack | normal/degraded/offline/recovery/duplicate/stale | no production PHI、deterministic fixtures |

## 13. Work package分解

| Order | WP candidate | Scope | Dependency / human gate |
|---|---|---|---|
| 1 | UX-CTX-01 | fixed context tupleとswitch guard | identity/tenant/security/product approval |
| 2 | UX-STATE-01 | orthogonal state presentation contract | medical safety/accessibility approval |
| 3 | UX-CMD-01 | Guided/Expert shared command registry | API/domain ownership approval |
| 4 | UX-JNY-A | reception→accounting prototype/protocol | claim/accounting/pharmacist/clerk review |
| 5 | UX-JNY-B | monthly claim prototype/protocol | official claim evidence + claim clerk review |
| 6 | UX-JNY-C | home/offline/recovery prototype/protocol | PH-OS ownership/privacy/home-care review |
| 7 | PERF-REG-01 | operation registry + telemetry schema | privacy/security/operations review |
| 8 | PERF-BSL-01 | real-device/capacity baseline | hardware/business load inputs |
| 9 | KPI-REG-01 | internal KPI definitions/schema | domain/data/quality review |
| 10 | KPI-PUB-01 | publication subset | legal/privacy/statistical/contract approval |
| 11 | UAC-RUN-01 | synthetic usability/accessibility run | participant recruitment + approved protocol |
| 12 | SLO-AMD-01 | UIX/OPS candidate revision via PRC-007 | baseline evidence + human approval |

## 14. Human review items

1. 薬剤師: A/C journey、薬剤師確認、警告/override、患者・薬剤取り違え防止。
2. 請求実務者: B journey、claim month固定、請求前点検、返戻/再請求、KPI帰属月。
3. 会計実務者: finalization、一部入金、未収、返金、領収、LOCAL_ONLY仮精算。
4. accessibility specialist: WCAG/JIS scope、screen reader/browser matrix、shortcut、target size。
5. privacy/security: context exposure、telemetry fields、support evidence、AI/KPI secondary use。
6. operations/performance: device/network/load matrix、SLO/error budget、observability cardinality。
7. data/statistics: KPI cohort、late arrival、missingness、small cell、gaming/bias。
8. legal/product authority: public KPI、financial confirmation、release acceptance、PRC-007 amendments。

## 15. BLOCKER / stop conditions

- `BLOCKED_APPROVED_AMENDMENT`: UIX-003/004/005/006、ARC-001等のAPPROVED本文を本Draftで変更しない。
- `BLOCKED_REAL_DEVICE_BASELINE`: 実機・実ブラウザ・Edge・network・volume条件なしにcandidateをSLO化しない。
- `BLOCKED_HUMAN_WORKFLOW`: 薬剤師、請求事務、会計、在宅実務レビュー前にjourneyをrelease-readyとしない。
- `BLOCKED_ACCESSIBILITY_SCOPE`: WCAG/JIS適用範囲、支援技術matrix、manual test未確定。
- `BLOCKED_KPI_AUTHORITY`: generic ratio/add-on/claim reason等の公式定義・source authority未固定。
- `BLOCKED_PUBLICATION`: QUA-008の法務、匿名化、同意、契約、統計review未完了。
- `BLOCKED_TELEMETRY_PRIVACY`: PHI-free allowlist、cardinality、retention、access control未承認。
- `BLOCKED_PHOS_RUNTIME`: PH-OS FHIR authority、offline persistence、sync/rebaseのruntime evidenceなし。
- `BLOCKED_INDEPENDENT_VERIFICATION`: 現行Codex single laneでは独立検証未実施。

## 16. 網羅性監査

| Requirement | Coverage |
|---|---|
| Guided/Expert同一state | §5.1 |
| 受付→会計 | §6 A01-A16 |
| 月次請求 | §7 B01-B12 |
| 在宅訪問 | §8 C01-C12 |
| offline/recovery | §6〜8、§9 |
| keyboard/accessibility | §4、§9 |
| patient/store/month固定 | §5.2 |
| 仮/確定/未確認/同期待ち | §5.3 |
| SLO候補と実機baseline | §10 |
| numerator/denominator/clock/source | §11、34 KPI候補 |
| prototype/test plan | §12 |
| human review/BLOCKER | §14〜15 |

網羅性は計画項目の存在を示すだけで、実装、適合、臨床安全、請求正確性、performance達成を証明しない。
