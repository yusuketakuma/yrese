# State.md — 活動ログ

調剤用レセプトコンピューター MVP(構築プロンプト v0.2.0)の活動記録。新しいエントリを上に追記する。

> 現行routingはAPPROVED AGT-018のCodex単一レーンである。AGT-001〜017はmetadata-only SUPERSEDED。PRC-007 v0.3.1はAPPROVED。IDX-001 v0.4.44とWP-9002-W31 exact5はtwelve-role review後、commit `72474ba`でsafe feature branchへLANDED。以下の旧model/role名はhistorical provenanceでcurrent gateには再利用しない。

---

## 2026-07-13

### WP-4118 reception queue client canonical ordering — LANDED

- clean baseline `7f4475d`。API-006がclient責務とするacceptedAt+ReceptionId安定順をbrowserが適用せず、transport順でPHI-rich受付queueを表示できる実在R2 workflow gapをexact5で修正中。
- duplicate検査後、copied entriesをexact UTC acceptedAt asc、equal instantはcode-unit ReceptionId ascへsort。arbitrary fractional秒、source非mutation、entry/date/UI semanticsを維持。
- independent verifierとreception/data/API/frontend/accessibility/medical/privacy/security review APPROVED、findingsなし。focused reception web54、web294、API233 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `7eb4038`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。contracts/OpenAPI/API/repository/DB/SSOT/UI/ARIA/human gates不変。

### WP-4117 healthy audit browser chronology validation — LANDED

- clean baseline `f28c6fa`。schema-valid healthy responseのwallClock順序違反をbrowserがverifiedな最新証跡として表示できる実在R2 audit-evidence gapをexact5で修正中。
- duplicate/count precedence後、healthyだけをsub-millisecond精度のexact UTC instantでnon-increasing検査。equal許可、違反はfixed non-echo全体拒否。broken raw-window/CRITICAL、sortなし、last verified/retryを維持。
- independent verifierとaudit/data/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。focused audit web38、web290、API233 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `cebd9de`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。contracts/OpenAPI/API/core/DB/SSOT/UI/ARIA/human gates不変。

### WP-4116 repository patient cursor consumed-offset binding — LANDED

- clean baseline `52f6436`。repository next cursorをrequest offset/返却件数へ拘束せずAPIが署名できる実在R2 pagination/data-integrity gapをexact5で修正中。
- over-limit/schema/duplicate precedence後、defined continuationへnonempty、safe exact consumed offsetを要求。same/backward/skip/empty/overflowはfixed non-echo 500/no-store、encode zero、補正/partial responseなし。
- independent verifierとAPI/data/security/privacy/medical/DB-boundary review APPROVED、findingsなし。focused server73、API233 + PostgreSQL14 expected skips、web284、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `8c5880b`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。contracts/OpenAPI/codec/repository/DB/SSOT/web/human gates不変。

### WP-4115 patient append cursor self-loop rejection — LANDED

- clean baseline `1c1133b`。append cursor Cがdistinct/empty pageと同じ`nextCursor:C`を返すとpartial rowsをcommitしたままpaginationが停止/loopする実在R1 gapをexact5で修正。
- stale/page duplicate/state tuple/cross-page overlap後、merge前にdefined cursorのexact equalityだけを拒否。decode/order推測なし。prior rows/query/cursor、generic error、retryを維持しpartial commitなし。
- independent verifierとpatient/data/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。focused patient-search36、web284、API227 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `066ca00`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。API/contracts/cursor codec/DB/WP-4057/UI/ARIA/SSOT/human gates不変。

### WP-4114 audit browser response count integrity — LANDED

- clean baseline `b909011`。schema-validだが相互矛盾するentries/totalCount/checkedCount/breakIndexをbrowserが監査証拠として表示できる実在R2 gapをexact5で修正。
- schema/healthy duplicate EventId検査後、entries<=total、healthy checked=total、broken checked=break<totalを要求。fixed non-echo全体拒否、補正/部分commitなし。consistent broken duplicate、last verified view、generic error、retryを維持。
- independent verifierとaudit/data/security/privacy/API/frontend/accessibility/medical review APPROVED、findingsなし。focused audit web32、web282、API227 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `b7cf057`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。contracts/OpenAPI/API/core/reason/DB/SSOT/UI/ARIA/human gates不変。

### WP-4113 verified audit sequence continuity — LANDED

- clean baseline `b324c52`。異なるEventIdを正しく再hash連結したsequence gap chainがcore verifierでhealthyになる実在R2 audit completeness gapをAPI exact5で修正。APPROVED DB-005の初回1/TIP採番`1..N`をapp read boundaryで補強。
- scope/core verify後、WP-4112 EventId全件passを完了してからhealthy full listのみsequenceを別pass検査。start2/gap/reuse/valid-prefix backwardをfixed non-echo 500/no-store/audit zeroで全体拒否。broken/malformedは既存reason/view auditを維持。
- initial domain/verifier MEDIUM 2件をfull-pass分離と`[1,2,1]` fixtureで修正し、independent verifierとaudit/data/security/privacy/API/medical/DB-boundary re-review APPROVED。focused audit23、API227 + PostgreSQL14 expected skips、web272、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 implementation commit `4077779`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。audit core/reason/contracts/OpenAPI/repository/DB/SSOT/web/human gates不変。

### WP-4112 verified audit duplicate EventId rejection — LANDED

- clean baseline `9799680`。同一EventIdをsequence/logicalClock更新+正しいprevHashで再hashした2件chainがcore verifierでhealthyになる実在R2 audit identity gapをAPI+browser exact7で修正。
- scope guard/core verify後、healthy full chainのみEventId一意性をaudit.viewed/window/projection前に強制。browserもhealthy responseのみ検査。duplicate healthyはfixed non-echo全体拒否、refreshはlast verified viewを保持してretry。broken/malformed duplicateは既存CRITICAL reason/view auditを維持。
- independent verifierとaudit/data/security/privacy/API/frontend/accessibility/medical/DB-boundary review APPROVED、findingsなし。focused audit API18/web22、API222 + PostgreSQL14 expected skips、web272、audit183、workspace typecheck/test/buildと全gate PASS。
- exact7 implementation commit `2eafa3b`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。audit core/reason enum/contracts/OpenAPI/repository/DB/SSOT/human gates不変。

### WP-4111 audit refresh active-flight sharing — LANDED

- clean baseline `5e794e9`。parameterless audit refreshの同期duplicate/re-entryが複数GETと複数`audit.viewed`を生むR1 request/audit-integrity gapをexact5で修正。WP-4086のtwo-GET latest-winsをactive-flight共有+explicit invalidate supersessionへ更新。
- owner/shared Promiseをemit/fetch前に公開し、active callerは同一Promiseへjoin。invalidateはdetach+generationのみでaudited GETをabortせず、old completion zero emit。exact-owner cleanup-before-settleでreplacementを保護し、completed cacheなし。
- independent verifierとaudit/frontend/accessibility/security/privacy/API/data/medical review APPROVED、findingsなし。focused audit-log-view19、web269、API219 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。WP-4100 retained/broken CRITICAL/ARIA/error/retry不変。
- exact5 implementation commit `0ebe4f9`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。

### WP-4110 reception queue duplicate identity rejection — LANDED

- clean baseline `6eeb216`。queue内の同一ReceptionIdへ矛盾する患者/status/acceptedAtを持つ複数rowがAPI/UIへ到達するR2 queue identity gapをserver+browser exact7で修正。
- 両境界でfull schema parse後にexact ReceptionId uniquenessを要求。duplicateは固定non-echo全体拒否、dedupe/merge/partial response/commitなし。refreshではlast verified queue/date/metadataを保持してgeneric error/retryへ流す。
- independent verifierとreception/frontend/accessibility/API/data/privacy/security/medical review APPROVED、findingsなし。focused server67/reception-dashboard50、API219 + PostgreSQL14 expected skips、web266、audit183、workspace typecheck/test/buildと全gate PASS。
- exact7 implementation commit `172b98e`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。同患者の別受付、entry order/date/JST/generation、contract/DB/SSOT/human gatesは不変。

### WP-4109 patient-search duplicate identity rejection — LANDED

- clean baseline `bdbc5e2`。page内またはoffset pagination append跨ぎで同一PatientIdの矛盾summaryが共存・選択可能になるR2 identity-integrity gapをserver+web exact7で修正。
- serverはlimit-first、全schema validation後にpage内exact PatientId uniquenessをcursor/response前に強制。webはnew page内重複とauthoritative existing rowsとの交差をmerge前に拒否し、verified rows/query/cursorを保持してgeneric append error/retryへ流す。dedupe/merge/partial commitなし。
- initial domain MEDIUMのcross-page ambiguityをclient guardで修正後、independent verifierとAPI/data/privacy/security/medical re-review APPROVED、remaining findingsなし。focused server65/patient-search34、API217 + PostgreSQL14 expected skips、web263、audit183、workspace typecheck/test/buildと全gate PASS。
- exact7 implementation commit `4c94b91`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。cross-page snapshot/keyset、患者統合、patientNumber重複判断、contract/DB/SSOTは不変。

### WP-4108 patient-search result limit binding — LANDED

- clean baseline `ad04318`。patient search repositoryのover-returnをrouteが拒否せず、要求limit超過の患者PHIを200で返せるR2 PHI-minimization/data-integrity gapをexact5で修正。
- search直後、cursor encode/response前にvalidated limitへ件数を拘束。超過は固定non-echo 500/no-store、slice/filter/partial response/cursor発行なし。正常pagination/cursor semanticsは維持。
- independent verifierとAPI/privacy/security/data-integrity/medical review APPROVED、findingsなし。focused server62、API214 + PostgreSQL14 expected skips、web260、audit183、workspace typecheck/test/buildと全gate PASS。contract/OpenAPI/repository/DB/cursor/SSOT不変。
- exact5 implementation commit `efedddc`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。

### WP-4107 reception client response patient identity binding — LANDED

- clean baseline `55807b0`。browser側がschema-valid 200/201 reception responseの別患者entryを成功扱いできるR2 wrong-patient gapをexact5で修正。WP-4105 server-side adapter result bindingと相補的なclient boundary。
- 2xx responseをparse一回後、POSTしたexact patientIdとnested response patientIdをstrict比較。一致後だけreturnし、不一致は固定non-echo error。成功表示、入力clear、queue reloadはthrow後に実行されない。
- independent verifierとfrontend/medical/privacy/security/API/data/accessibility review APPROVED、findingsなし。focused reception-dashboard47、web260、API212 + PostgreSQL14 expected skips、audit183、workspace typecheck/test/buildと全gate PASS。UI/copy/ARIA/API/contracts/server/DB/SSOT不変。
- exact5 implementation commit `85c17a2`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。

### WP-4106 audit result tenant/pharmacy scope binding — LANDED

- clean baseline `c9b256e`。scoped audit listが返すevent authority fieldsをrouteで再拘束せず、別tenant/pharmacyまたはmixed結果がchain/displayへ影響できるR2 tenant-isolation gapをexact5で修正。
- list直後、chain verify/audit.viewed/sort/projection/response前に全eventのtenantId/pharmacyIdをstrict比較。mismatchは固定non-echo 500/no-store、partial response/filter/repair/audit.viewed successなし。local healthy/broken/malformed semanticsは維持。
- independent verifierとsecurity/privacy/audit/data-integrity/API/medical review APPROVED、findingsなし。focused audit-log15、API212 + PostgreSQL14 expected skips、web256、audit183、workspace typecheck/test/buildと全gate PASS。contract/OpenAPI/core/repository/DB/migration/SSOT/human gates不変。
- exact5 implementation commit `0b4e7ae`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。

### WP-4105 reception result patient identity binding — LANDED

- clean baseline `cc7eb21`。schema-valid reception repository resultのpatientId不一致がcreated/existingでsuccess audit/responseへ進めるR2 wrong-patient gapをexact5で修正。
- conflict判定後、audit/response前にstrict requested/result patient ID一致を要求。不一致は固定non-echo error、no-store、audit zero。contract/OpenAPI/repository/DB/migration/SSOT/idempotency semanticsは不変。
- independent verifierとmedical-safety/privacy/security/API/data-integrity review APPROVED、findingsなし。focused server60、API209 + PostgreSQL14 expected skips、web256、audit183、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
- exact5 implementation commit `cc7b42c`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。壊れた外部repositoryの事前side effect rollbackは主張せず、現行in-memory/PostgreSQL adapterで到達不能な invariantのroute defense-in-depthに限定。

### WP-4104 patient refresh response identity binding — LANDED

- clean baseline `dabb180`。schema-valid get-by-id 200 responseのpatientId不一致が選択中文脈を別患者へ置換できるR2 wrong-patient gapをexact5で修正中。
- parse一回後のstrict requested/returned ID一致をprojection前に要求し、不一致は固定non-echo errorから既存onFailure/stale経路へ流す。404 removal/non-ok/schema/stale generation semanticsは維持。copy/DOM/ARIA/focus/animation/API/contracts/server/DB/SSOTは不変。
- independent verifier APPROVED、findingsなし。patient-safety/domain reviewもfrontend/medical/privacy/security/API/data implicationsを確認してAPPROVED、findingsなし。focused patient-context19/19、web full256/256、web typecheck/build PASS。full workspace gate exit0: workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
- exact5 implementation commit `9cc9f56`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。strict response identity bindingを追加し、404 removalとstale clear/switch semanticsを維持。

### WP-4103 reception queue latest-flight sharing — LANDED

- clean baseline `23caf6e`。同一latest active queue targetの重複loadがgeneration/emit/fetchを重ねるR1 request-integrity gapをexact5で修正中。
- latest single flightをtarget/unique owner/shared Promiseでsynchronous emit前に公開し、same targetはjoin、different targetとA-B-Aはadmit。exact-owner cleanup後にsettleする。verifier + reception/data/frontend/accessibility/medical/privacy/API review APPROVED、findingsなし。
- focused reception-dashboard43、web251、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。WP-4102 state、UI/tracker/URL/POST/API/DB/SSOTは不変。
- exact5 implementation commit `ea67f13`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。identical latest active queue flightをsharedし、A-B-Aとexact-owner lifecycleを維持。

### WP-4102 reception queue retained-source refresh — LANDED

- clean baseline `0ba6352`。refresh loading/failureで直前queue/source date/Tが消え、requested targetとresponse.date不一致も受理するR2 queue-integrity gapをexact5で修正中。
- candidate arbitrationはLOW same-flight候補よりR2 last-verified queue/source preservationを優先。loaded refresh substateでnonempty/empty response identityとloadedAtを保持し、current matching responseだけを置換。mismatchはactual date非echo、stale completionはzero emit。
- initial accessibility MEDIUMのduplicate queue-level live regionを、refresh count/empty非live、qualifier sole status、error one alertで修正。verifier + reception/data/frontend/accessibility/medical/privacy/API re-review APPROVED、remaining findingsなし。focused reception-dashboard35、web243、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。WP-4101 tracker、URL、POST/idempotency/generation/every GET、API/DB/SSOT/CSS/focus/animationは不変。
- exact5 implementation commit `9fda4dc`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。retained queue source/date/Tとrequest-target integrityを維持。

### WP-4101 reception registration latest queue-target reload — LANDED

- clean baseline `be76c75`。deferred registration completionがcaptured start-dateをreloadし、POST中のexplicit queue-date変更を巻き戻すR2 workflow-integrity gapをexact5で修正中。
- component-instance closure trackerをevery load先頭でmarkし、success completionはcurrent targetをreloadする。input draft、URL/generation、POST/idempotency/single-flight/input clearing、copy/CSS/focus/animation/API/DB/SSOTは不変。
- verifier + reception/frontend/accessibility/medical/privacy/API/data review APPROVED、findingsなし。focused reception-dashboard29、web237、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
- exact5 implementation commit `dc8f088`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。registration completionはlatest requested queue targetをreloadし、draft/URL/generation/POST semanticsを維持。

### WP-4100 audit refresh last-verified-view preservation — LANDED

- clean baseline `c1aa0a1`。refresh loading/failureが直前のverified audit chain/count/table、特にbroken-chain CRITICALを消すR2 workflow-integrity gapをexact5で修正中。
- loaded refresh substateとfunctional updaterでexact dataを保持し、refresh controlだけをloading/error化する。initial audit/UI MEDIUMのfreshness ambiguityを、exact `role=status` qualifier-before-view、broken CRITICAL + refresh errorのtwo alerts、ErrorNotice/retry隣接で修正。
- verifier + audit/security/frontend/accessibility/privacy/API/medical re-review APPROVED、remaining findingsなし。focused audit-log-view16、web231、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。CSS/focus/animation/API/contracts/server/core/DB/SSOTは不変。
- exact5 implementation commit `6221ead`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。refresh loading/error中もlast verified audit data、freshness qualifier、broken-chain CRITICALを保持。

### WP-4099 patient-search append structural single-flight — LANDED

- clean baseline `fdca88a`。同一非blank query/cursor appendの同期重複が複数fetchとgeneration競合を起こすR1 request-integrity gapをexact5で修正中。
- closure-local nested Mapとowner-token finally cleanupでidentical active tupleだけを抑止する。initial verifier MEDIUMのobsolete owner findingを、full/blank authority change前のownership clearとexact-token replacement protectionで修正。
- verifier + frontend/accessibility/privacy/API/medical re-review APPROVED、remaining findingsなし。focused patient-search31、web226、API207 + PostgreSQL14 expected skips、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。UI DOM/copy/CSS/focus/animation/state/API/cursor semanticsは不変。
- exact5 implementation commit `9689a83`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。同一active appendだけをcoalesceし、full/blank/different tupleとstale-generation handlingを維持。

### WP-4098 migration rollback-failed client quarantine — LANDED

- clean baseline `97ca41f`。post-BEGIN migration operation failure後のROLLBACK失敗clientが通常poolへ戻るR2 connection-integrity gapをexact5で修正中。
- rollback失敗時だけouter ownerへunusableを通知して`release(true)`とし、original operation error、SQL/order/migration/history/checksum/API/SSOT/DB execution/retry/log semanticsを維持する。
- independent verifier + DB/data/security/privacy/operations review APPROVED、findingsなし。focused migration18（runner4）、API207 + PostgreSQL14 expected skips、web218、workspace typecheck/test/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。
- exact5 implementation commit `27b6391`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。rollback失敗clientだけをdestroyし、SQL/order/migration/history/checksum/API/SSOT/DB execution/retry/log semanticsは不変。

### WP-4097 patient search append failure recovery — LANDED

- clean HEAD `6021f0b`。append failureが既存患者results/query/cursor/未読込警告を全消去するLOW-MEDIUM workflow gapをmapper/plannerが確認。API-001/MSR-001/P-09の比較継続性を改善するexact5を採択。
- loaded append substateでrows/cursorを保持し、既存ErrorNoticeと明示retryを併設。API/DB/cursor/CSS/focus/animation/PHI handlingは不変。
- independent verifier APPROVED、findingなし。focused23、web218、workspace typecheck/test（API203 + PostgreSQL14 expected skips）/build、OpenAPI/calculation-purity/boundaries/SSOT173/secrets/deps high0 critical0/SBOM231/scripts/diff全PASS。commit `9f41c07` をfeature branchへpush済み。

### WP-4096 reception rollback-failed client quarantine — LANDED

- clean HEAD `644dc9d`。reception createにもWP-4095と同じrollback-failed client再利用欠陥を確認。API-006/MSR-001/MSR-026境界のため、created/existing/different-patient conflict全正常分岐もcharacterizeするexact5を採択。
- rollback失敗時だけclient destroy。idempotency scope/patient identity/response/SQL/timestamp/ID semanticsは変更しない。
- created/existing/different-patient conflict/rollback success/failureの5分岐を固定。independent DB/data/API/security/privacy/medical review APPROVED。API203 + expected skip14、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `80b6bd7`をfeature branchへpush済み。受付transactionの状態不明client再利用を防ぎ、正常/idempotent/conflict semanticsは維持。

### WP-4095 audit rollback-failed client quarantine — LANDED

- clean HEAD `2e07ee8`。audit transaction失敗後のROLLBACK自体が失敗してもclientを通常poolへ戻すMEDIUM lifecycle gapをmapper/plannerが確認。installed pg/type/runtimeは`release(true)` destroyを正式サポート。
- exact5でrollback失敗時だけclientをquarantineし、original error、SQL/order/lock/hash/sequence、DB/API semanticsは維持する。WP-4092 pending integration fileとの目的混在を避け、新規unit testへ分離。
- success/rollback-success/rollback-failureをDB非依存fake clientで固定。independent DB/data/audit/security/privacy/medical review APPROVED。API198 + expected skip14、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `cd500ed`をfeature branchへpush済み。transaction-state不明clientのpool再利用を防ぎ、正常/recovered client reuseは維持。

### WP-4094 verified audit wallClock-desc display ordering — LANDED

- clean HEAD `a24da45`。公開contractはwallClock descだがruntimeはappend reverse + limitで、非単調時刻時にmembershipまで誤るMEDIUM driftをmapper/plannerが確認。rollback client quarantineより先行する。
- exact5でfull chain append-order検証を維持し、healthy displayだけwallClock desc + later-append tieへ整合。broken chainはWP-4093 no-backfill quarantineを保持し、untrusted wallClockを並べ替えない。
- nonmonotonic membership、equal-time tie、full checkedCountを回帰固定。independent API/audit/data/security/privacy/frontend/medical review APPROVED。API195 + expected skip14、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `b5fa648`をfeature branchへpush済み。公開display orderingを満たし、chain authorityと破損時quarantineは維持。

### WP-4093 fail-visible malformed audit display projection — LANDED

- clean HEAD `ded1134`の増分scanで、WP-4089後もraw display fieldのdereference/response parseがmalformed rowを500へ戻すR2 gapをmapperが再現。plannerは保存集合/chain/totalCountを維持し、raw limit後のdisplay projectionだけを省略する設計をAPPROVED。
- exact5で既存entry schemaを唯一の表示authorityとし、placeholder/backfill/raw echoを禁止。core verification ok時のsilent omissionも禁止する。DB/contracts/OpenAPI/UIは不変。
- malformed target/wallClock、no-backfill、valid neighbor、totalCount、non-echo、view auditを回帰固定。independent audit/data/security/privacy/API/frontend/medical review APPROVED。API193 + expected skip14、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `888c449`をfeature branchへpush済み。chain verification/count/raw windowを保持し、display契約不能rowだけをfalse-chain時に省略する。

### WP-4092 PostgreSQL audit append observed-concurrency proof — IN PROGRESS

- clean HEAD `544c7f7`。audit integration pool `max:1`がrepository transactionをclient checkoutで直列化し、advisory lockの並行保証を未証明とmapper/plannerが確認。production defectではなくMEDIUM evidence gap。
- test-only exact4でblocker + waiter2のDB-observed overlapとchain収束を追加する。local `TEST_DATABASE_URL`は未設定のため、local skipを完了扱いにせずCI zero-skipをlanding gateとする。
- independent reviewはcode APPROVED / runtime VERIFY_REQUIRED。local focused5 skip、API191 + DB skip14、web215、audit183、workspace typecheck/test/buildと全gate PASS。candidate commit/push後もCI PostgreSQL実証までIN PROGRESSを維持する。
- candidate exact4 commit `193024b`をfeature branchへpush済み。current branchにPRがなくCI runは生成されていないため、PostgreSQL zero-skip証拠待ち。production codeは不変。

### WP-4091 deterministic in-memory patient search field ordering — LANDED

- clean HEAD `eb2b916`。PostgreSQLは`patient_number, patient_id`順でpaginationする一方、InMemoryは投入順のままsliceし、同一synthetic recordのpage membershipがrepository modeで変わることをmapperが再現。plannerは公開ordering/collation保証を除外するpins付きでAPPROVED。
- exact5でcurrent synthetic ASCII field tuple/order stageだけを整合する。tenant/pharmacy filter、query/cursor/API/SQL/DB/SSOT、PHI handlingは不変。
- filter後にexplicit patientNumber/patientId sortしてからsliceし、投入順差・scope外boundary・2page completeness・input非破壊・defensive tieを回帰固定。independent API/data/DB/privacy/medical reviewはfindingsなしでAPPROVED。API191 + expected skip13、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `c7a4b56`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。current synthetic ASCII alignmentに限定し、public ordering/collation/DB semanticsは不変。

### WP-4090 audit advisory-lock source literal-NUL hygiene — LANDED

- clean HEAD `981d5a3`。audit repository line 63 / byte offset 2631にphysical `0x00`が1個あり、sourceがbinary判定されることをmapper/plannerがHIGH confidenceで確認。runtime separatorは正しく、source representationだけが欠陥。
- WP-1011 precedentに従いexact4で`\u0000`へescape化する。advisory lock key bytes/SQL/transaction/tenant scope、DB/API/contracts/SSOTは不変。
- physical NUL 0、textual escape 1、runtime/UTF-8 strict equality、通常`rg`とnew blob text判定を確認。independent DB/data/security/privacy reviewはfindingsなしでAPPROVED。API188 + expected skip13、web215、audit183、workspace typecheck/test/buildと全gate PASS。
- exact4 commit `9238a54`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。committed blobはUTF-8 text/NUL0で、lock key/DB semanticsは不変。

### WP-4089 fail-visible malformed stored audit payload verification — LANDED

- clean HEAD `4c121f3`。adapter parity候補の比較中、保存audit eventのcanonical payload不正がverifierからthrowし、structured chain breakと`audit.viewed`を失うR2 integrity gapをplannerが検出。mapperがunsafe `schemaVersion` + valid-format hashで`RangeError`を独立再現し、HIGH confidenceでconfirmed。
- 既存`hash_format_invalid`を再利用するexact6を採択。DB/contract/OpenAPI/SSOT/UI変更、repair/quarantine、raw値投影は行わない。
- canonicalization/hash再計算のnarrow catchとcore/API回帰を実装。independent audit-data/security/privacy/API/medical reviewはfindingsなしでAPPROVED。audit183、API188 + expected skip13、web215、workspace typecheck/test/buildと全gate PASS。
- exact6 commit `8b7b162`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。DB repair/quarantineやcontract/UI変更なしで監査破損をstructured CRITICALへ戻した。

### WP-4088 BusinessNav live current-location semantics — LANDED

- clean HEAD `08acfd8`。productionは`BusinessNav`へcurrent propを渡さず全routeで`aria-current`が欠落する一方、既存testは手動prop経路だけを通していた。mapper/plannerはMEDIUM accessibility defect、WP-4088 exact5、exact pathname semanticsをHIGH confidenceで承認した。
- `usePathname()`をproduction signatureへ配線し、pure viewへ委譲する最小client boundaryを実装。label/order/CSS/layout、nested route policy、focus/animation、API/contracts/SSOT/DBは不変。
- exact path/unknown/nested semanticsをproduction hook mockで固定。independent verifierはfindingsなしでAPPROVED。focused15、web215、API187 + expected skip13、workspace typecheck/test/buildと全gate PASS。
- exact5 commit `77e91f7`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。productionの現在地表示を回復し、未承認nested policyや非対象UI/API/data semanticsは導入していない。

### WP-4087 preserve next-patient reception input on prior success — LANDED

- clean HEAD `1032d32`。受付Aのpending中に次患者Bを入力するとA成功時のunconditional clearでBが消える通常操作R1をmapper/plannerが再現確認。監査R2を先行landing後、次sliceとして採択した。
- raw snapshot exact比較のsuccess-only functional clearを実装。unchanged/padded unchangedはclearし、pending中のBとraw差異は保持する。input enabled、same-flight lock、API-006、copy/focus/DB/contractsは不変。
- independent/frontend/accessibility/medical/privacy/API reviewはAPPROVED。focused23、web210、API187 + expected skip13、workspace typecheck/test/buildと全gate PASS。exact5 landing待ち。
- exact5 commit `ac032df`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。次患者入力を保持しつつaccepted patient/request semanticsは不変。

### WP-4086 audit log latest-only and lifecycle invalidation — LANDED

- clean HEAD `c3e6773`のincremental scanで、古い監査正常応答が新しいchain-break CRITICALを上書きし得るclient raceを検出。受付次患者ID入力損失もR1候補だが、security/data-integrity fail-closed優先でR2 WP-4086を先行する。
- exact5でgeneration runnerとcleanup invalidationを追加。old healthy/new broken、old failure/new success、old success/new error、invalidate、2 GET維持、transport/error mappingを固定した。Abort/single-flight/dedupはなく、各GET/backend `audit.viewed`は不変。
- independent/frontend/accessibility/security/privacy/audit-data/medical reviewはAPPROVED。focused11、web206、API187 + expected skip13、workspace typecheck/test/buildと全gate PASS。初回parallel build/typecheckの`.next/types`競合は順次rerunで解消。exact5 landing待ち。
- exact5 commit `e7c86b3`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。最新chain verification/errorだけをauthorityとし、backend side effectsは維持する。

### WP-4085 protected sensitive routes early no-store enforcement — LANDED

- clean HEAD `1c8f37f`でmapper/plannerが一致してR1 privacy/cache hardeningを選定。live route確認によりplannerの`/audit-log`表記を実在する`/audit/events`へ補正した。
- 5 sensitive routeだけへroute-local `onRequest`を付与し、tenant/auth拒否より前に`no-store`を設定。handler内5重複setterを除去し、missing/malformed/insufficient scopeの15拒否、400/404/409/500/成功、health/whoami非対象を固定した。
- review指摘の404/409 assertion不足と500 non-echo過剰記録を修正後、independent/API/security/privacy/medical reviewはAPPROVED。server58、API187 + expected skip13、web200、workspace typecheck/test/buildと全gate PASS。exact5 landing待ち。
- exact5 commit `591e27a`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。5 sensitive routeの認可前non-cacheabilityを固定し、health/whoamiとauth/body/status/repository semanticsは不変。

### WP-4084 reception registration same-flight mutual exclusion — LANDED

- clean HEAD `4f31994`でplannerが受付登録の同期再入を検出。mapper反証で通常double-clickはdisabledが軽減すると確認し、R2ではなくR1 bounded hardeningとして採択。API-006のsame-key semantics、retry key lifecycle、DB/API/contracts/SSOTは変更しない。
- exact5でsingle-flight coordinatorをproduction handlerへ配線し、同一flightの重複POST/UUID/state更新を抑止。lockはqueue reloadまで保持し、success/failure後に解放する。independent/frontend/accessibility/medical/privacy/API/data reviewはAPPROVED。
- focused19、web200、API172 + PostgreSQL13 expected skips、server43、workspace typecheck/test/buildと既存gateはPASS。exact5 landing待ち。API-006/retry key lifecycle/DB/contracts/SSOT/copy/CSSは不変。
- exact5 commit `0d3eafa`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。通常double-clickの実害は未立証のためR1を維持し、曖昧network retryは別semantic gateへ残す。

## 2026-07-12

### WP-4083 patient-search blank-submit stale request invalidation — LANDED

- clean HEAD `18680e0`でmapper/plannerが一致して次のR2 sliceに選定。blank validation前にgenerationを進め、blankを最新actionとして先行検索のlate success/failureを破棄する。警告文/fetch/API/contracts/SSOTは不変。
- deferred late success/failure、blank fetch zeroの3 testsを追加。independent/frontend/accessibility/medical/privacy reviewはAPPROVED。focused20、web196、API172 + PostgreSQL13 expected skips、workspace typecheck/test/buildと全gateはPASS。exact5 landing待ち。
- exact5 commit `edd594e`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。blank後の旧患者結果/error復活を防止し、valid query/append semanticsは不変。

### WP-4082 patient-context manual-clear stale refresh invalidation — LANDED

- read-only mapperは患者検索blank-submit raceを、independent plannerはより直接的なwrong-patient riskとして患者コンテキスト解除後の旧refresh復活を最優先に選定。R2、既存APPROVED H-02/API-001 authority内で、SSOT/contract/DB/migration/human gate変更なし。
- sole maintainerはlatest-only refresh runnerを追加し、手動解除、patient切替、effect cleanup/null遷移で旧200/404/errorを無効化した。初回reviewで再取得開始時のpremature `stale=false`とclear配線test不足を検出したため、staleはauthoritative 200/404まで保持し、invalidate→clear順序をcoordinator testで固定。
- independent/frontend/accessibility/medical/privacy再reviewはAPPROVED。focused14、web193、API172 + PostgreSQL13 expected skips、workspace typecheck/test/buildと全既存gateはPASS。exact5 landing待ちで、API/contracts/SSOT/DB/migration/package/lock/copy/CSS/productionは不変。
- exact5 commit `ed67009`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。患者解除後の旧refresh復活raceを閉じ、stale表示はauthoritative responseまで保持する。

### WP-9002 remaining57 classification + WP-4057 keyset gate — LANDED

- W32 `NO_ELIGIBLE`後の57文書を、`metadata-safe=0`、`semantic-amendment-required=18`、`human-authority-required=39`へ漏れ/重複なく分類し、`ops/refactor/WP-9002-remaining-classification.md`へmissing-field signature、drift根拠、next gateを記録した。本manifestは非SSOTであり、IDX v0.4.44/inventory173/57/116/status/approvalを変更しない。
- WP-4057 keyset-onlyは、API-001のnon-PHI cursor要件と既存sort key(patientNumber/patientId)が衝突。平文署名cursorは禁止し、AEAD cursorのprivacy/security契約改版または非PHI不変order keyのDB migrationについてhuman choice/approvalが得られるまで実装を停止する。現行v1 HMAC/OFFSETは不変。
- independent/domain reviewはAPPROVEDまたはAPPROVED_WITH_PINS。exact4 commit `e654938` を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。SSOT/index/codeは不変。

### W32 metadata eligibility stop + WP-0020〜0023 ledger reconciliation — LANDED

- HEAD `0ea60fb`、inventory173/57/116でremaining57をfresh再監査。CAL-006のeffectiveTo/from-only/5-rule記述、CAL-005のimplementation matrix、CAL-007の`BLOCKER_TYPES 31種`などが live codeと矛盾し、その他はsemantic field・公式evidence・human authority判断を要するため、W32 metadata-onlyは`NO_ELIGIBLE`としてIDX v0.4.44/inventoryを変更しない。
- 別の台帳driftとして、WP-0020〜0023がcommit `97338e5`で起草、`c6867e3`でCAL-005〜008 v0.2.0 APPROVED済みにもかかわらず`[ ]`のままであることを確認。SSOT作成タスクだけを`[x]`へ同期し、CAL-005/006/007の本文drift、WP-2105、CAL-008 typed value/全producer/rounding/live APIは未完了として保持する。SSOT/index/code/runtimeの変更やreadiness主張はない。
- independent/spec/data/calculation/claims/medical reviewはAPPROVEDまたはAPPROVED_WITH_PINS。exact3 commit `6dff2a3` を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。IDX v0.4.44、inventory173/57/116、CAL SSOT/code/runtimeは不変。

### WP-9002-W31 CAL-008 metadata — LANDED

- clean feature-branch baseline `aa266fa`で残存58 SSOTをfresh mappingし、JHS-003との再裁定後、既存impacts/question/blockerを保持し機械的な7 fieldだけを補完できるCAL-008単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- CAL-008本文3791 bytes / SHA-256 `fefeb253533993f2ad015c1bc1093195c8ee91e15d4c45f1cbeb67c01dad8bd5`、APPROVED/v0.2.0/legacy approval、1 question、1 blockerを不変とする。candidate inventory173/57/116、non-target172 `14192/cce5e51c…`。6 extension rows、rounding自己完結、legacy fields、4 migration steps、4 statusesを保持し、現行trace/contracts testsをrounding/calculation/claim readinessへ昇格しない。12 roleがAPPROVED_WITH_PINS、full gates PASS、IDX v0.4.44 finalize後にlanding前検証を完了した。
- final exact5はindependent verifierがAPPROVED。commit `72474ba`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。CAL-008本文・6 extensions・rounding規則・legacy fields・4 migration steps・4 statuses・1 question・1 blocker・172 non-targetを保持し、WP-9002は57 incompleteでIN_PROGRESSを継続する。WP-4050は別件のまま分離する。

### WP-9002-W30 CAL-009 metadata — LANDED

- clean feature-branch baseline `8798b0c`で残存59 SSOTをfresh mappingし、OPS-004との再裁定後、既存impacts/questions/blockerを保持し機械的な7 fieldだけを補完できるCAL-009単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- CAL-009本文3363 bytes / SHA-256 `c4c4d9599dc4cd423d63b8faf3bab5157d1a43d4e95127f09264deff9a4646b9`、APPROVED/v0.1.1/legacy approval、2 questions、1 blockerを不変とする。candidate inventory173/58/115、non-target172 `14281/10cea7a6…`。3層/5不変条件/5 rules・166点/4 stopsを保持し、現行testをrule-data/evidence/claim readinessへ昇格しない。11 roleがAPPROVED_WITH_PINS、full gates PASS、IDX v0.4.43 finalize後にlanding前検証を完了した。
- final exact5はindependent verifierがAPPROVED。commit `ea29a28`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。CAL-009本文・3 layers・5 invariants・5-rule 166-point example・4 stops・2 questions・1 blocker・legacy authority・172 non-targetを保持し、WP-9002は58 incompleteでIN_PROGRESSを継続する。WP-4050は別件のまま分離する。

### WP-9002-W29 UIX-006 metadata — LANDED

- clean feature-branch baseline `2ac4c7d`で残存60 SSOTをfresh mappingし、implementation-state drift/high-authority候補を避け、normative workflow authorityであるUIX-006単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- UIX-006本文4122 bytes / SHA-256 `cf5ec8fa5e15bbed2974a365ed228ee79638fa2dd0aca2a4bff7e34e9d26c003`、APPROVED/v0.1.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/59/114、non-target172 `14409/3af708d3…`。NORMAL/LOCAL_ONLY/RECOVERY_SYNC、4 role home、3 navigation principles、既存inline blockers、人間conflict解決、support PHI非表示を保持する。部分UIをE2E workflow証拠へ昇格せず、導線ごとのONS/record-spec evidenceとworkflow/release readinessを独立blockerで維持。13 roleがAPPROVED_WITH_PINS、full gates PASS、IDX v0.4.42 finalize後にlanding前検証を完了した。
- final exact5はindependent verifierがAPPROVED。commit `0634b9d`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。UIX-006本文・3 flows・4 role homes・3 navigation principles・legacy authority・172 non-targetを保持し、WP-9002は59 incompleteでIN_PROGRESSを継続する。WP-4050は別件のまま分離する。

### WP-9002-W28 UIX-004 metadata — LANDED

- clean feature-branch baseline `363a7a1`で残存61 SSOTをfresh mappingし、高authority/fact-drift候補を避け、12 UACをcriteria authorityのまま保持するUIX-004単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- UIX-004本文3817 bytes / SHA-256 `b92633441b0b3c06d7027612c092ec91b21e71ca912594749bd469ffd7e85f06`、APPROVED/v0.1.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/60/113、non-target172 `14508/06bf0654…`。UAC-01〜12の方法/候補合格値/role、薬剤師・請求事務最終review、synthetic/demo限定、patient-safety critical/claim high以上のdefect規律を保持する。既存unit/component testsをUAC実施証拠へ昇格せず、usability/release acceptanceは未達。13 roleがAPPROVEDまたはAPPROVED_WITH_PINS、full gates PASS、IDX v0.4.41 finalize後にlanding前検証を完了した。
- final exact5はindependent/data verifierがAPPROVED。commit `5afca6d`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。UIX-004本文・UAC-01..12・legacy authority・172 non-targetを保持し、WP-9002は60 incompleteでIN_PROGRESSを継続する。WP-4050は別件のまま分離する。

### WP-4081 patient-search cursor privacy assertion determinism — LANDED

- W25 regressionで、random MACに偶然`qh`が含まれたためprivacy-shape testが1件false redとなり、focused/full rerunでPASSした。read-only mapper/pre-planはproduction codec defectではなく、property不在をserialized random value substringで検査したtest root causeと判定した。発生率は約0.996%/run、riskはR1 test reliability。
- exact4候補では対象testだけをdeterministic keyへ変更し、MAC `8c4GnZ-0ZaYbhA2mheIdWSDA2Bqh5ieA2H_cXatuNtU` が合法的に`qh`を含む一方、body exact keysは`v/o/m`だけでlegacy `t/p/q/qh/offset` propertyがないことを固定した。production codec/contract/OpenAPI/DB/SSOT/packageは未変更。review/validationは完了し、landingのみ未実施。
- independent/test/spec/security/privacy/medical reviewは全APPROVED。focused 8/8、repeat20=160/160、API172+13 expected skips、workspace typecheck/test/buildと全gateがPASS。production codecはSHA-256 `bd8b37227acfda2aeaa9eb10fb17bcc0b5e7e337fef716a8282601e992051808`でbyte-identical。privacy/security semantic変更なしでexact4 landing前検証を完了した。
- final exact4のState整合指摘を修正後、independent/data verifierがAPPROVED。commit `82f8b85`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。CI false-red root causeは解消し、production runtime/contract/DB/SSOTは不変。

### WP-9002-W27 UIX-005 metadata — LANDED

- clean feature-branch baseline `366a031`で残存62 SSOTをfresh mappingし、refund/audit/medical/security/production drift候補を避け、候補SLOと実装方針を完成主張しないUIX-005単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- UIX-005本文2955 bytes / SHA-256 `093669b03ef45143be0052a7179c876342934cb37d904f4c669494f5c0ed7b5f`、APPROVED/v0.1.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/61/112、non-target172 `14633/a402fe26…`。7 SLO候補、ST-01〜15、2禁止、PHI非出力、エラー/partial failure非隠蔽を保持する。SystemModeBadge/error boundary等の部分実装をnetwork detection/LOCAL_ONLY/RECOVERY/audit/stability readinessへ拡張せず、WP-4050 audit sink gapも未解決。11 roleがAPPROVEDまたはAPPROVED_WITH_PINS、full gates PASS、IDX v0.4.40 finalize済み、landingのみ未主張。
- final exact5はindependent/data verifierがAPPROVED。commit `f02d3c2`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。UIX-005本文・7 SLO・ST-01..15・legacy authority・172 non-targetを保持し、WP-9002は61 incompleteでIN_PROGRESSを継続する。WP-4050とrandom-MAC flakyは別WPのまま分離する。

### WP-9002-W26 UIX-003 metadata — LANDED

- clean feature-branch baseline `6703c59`で残存63 SSOTをfresh mappingし、refund/legal/audit/medical/security/production drift候補を避け、全数値をPhase 0候補と明示するUIX-003単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- UIX-003本文2563 bytes / SHA-256 `d27a7144725fbea20e8d8375ebea0c9666a3a503656aecaefef8c361dd91ce21`、APPROVED/v0.1.0/legacy approval、dependency、2 questionsを不変とする。candidate inventory173/62/111、non-target172 `14751/70435986…`。3設計前提、18候補値、3運用ルール、PHI非出力、検証/監査/外部確認省略禁止、async状態可視化を保持する。Phase 1 latency/perceived-performance実測未着手のため、候補値をrelease SLO達成やEdge/Cloud/async runtime readinessへ昇格しない。3 dead impact pathsを正本へ訂正後、11 roleがAPPROVEDまたはAPPROVED_WITH_PINS。full gates PASS、IDX v0.4.39 finalize済み、landingのみ未主張。
- final exact5はindependent/data verifierがAPPROVED。commit `c3947e3`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。UIX-003本文・18候補値・legacy authority・172 non-targetを保持し、WP-9002は62 incompleteでIN_PROGRESSを継続する。random-MAC substring flaky assertionは別WP候補のまま分離する。

### WP-9002-W25 UIX-002 metadata — LANDED

- clean feature-branch baseline `53f55eb`で残存64 SSOTをfresh mappingした。ACC-005はrefund/legal/permissionの高権限human gateが密なため後続のsemantic reviewへ分離し、本文と限定的live component存在を確認できるUIX-002単独exact5を採用した。
- UIX-002本文3659 bytes / SHA-256 `2a4b5ed191720b378c57eb998ee692ec3cc5b511f5dcdcb1308af65742b15b5e`、APPROVED/v0.1.0/legacy approval、dependency/impactsを不変とする。candidate inventory173/63/110、non-target172 `14858/29885af8…`。11最低基準、速さ/安定性/直感性3柱と禁止、10 UX禁止、14必須テスト、2 open questionsを保持する。BusinessNav/SystemModeBadge/PatientHeaderの存在だけをUI/Edge/offline/performance/usability/accessibility/medical workflow/release readinessへ拡張しない。candidate reviewは完了しIDX v0.4.38へfinalize済み、landingだけを未主張とする。
- independent/spec/data/frontend/accessibility/product/security/privacy/medicalの9 roleがAPPROVEDまたはAPPROVED_WITH_PINS。本文/preserved/all23、inventory173/63/110、172 non-target identityを独立確認。typecheck/build/gatesはPASS。初回workspace testはrandom MACに偶然`qh`を含むunrelated flaky assertionで1件failしたが、focused 8/8とworkspace rerunはAPI172+13 expected skips/web188を含めPASSした。IDX v0.4.38をAPPROVED/effective 2026-07-12へfinalizeしたが、14 UX tests、WP-0032、accessibility/performance/medical workflow/production/human gatesは未解除。exact5 landing待ち。
- final exact5は指摘修正後にindependent verifier/data reviewerがAPPROVED。commit `9e0b38e`を`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。UIX-002本文・legacy authority・172 non-targetを保持し、WP-9002は63 incompleteでIN_PROGRESSを継続する。random-MAC substring flaky assertionの恒久修正は別WPで扱い、W25には混入させない。

### WP-9002-W24 ACC-009 metadata — LANDED

- clean feature-branch baseline `60fa14f`で残存65 SSOTをfresh mappingした。OPS-014はcloud/pricing assumptionsのfact freshness reviewへ分離し、direct POS接続非MVPと境界設計だけを明示するACC-009単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-009本文1351 bytes / SHA-256 `e93cdd5b84f555c3c585e9c70ef549f5d5b47f93ff83657ec75fbec78b96fd04`、APPROVED/v0.2.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/64/109、non-target172 `14980/aaa93047…`。direct DB禁止、POSSettlement→RECEIVED/CAPTURED、Idempotency、failure states/nonmasking、cash fallback、payment≠dispensingを保持。WP-0036/0037/human approvalまでBLOCKED_NOT_READY、direct tests/evidence/runtimeなし。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/product/payment/API/security/privacy/medicalの13 roleがAPPROVED。ACC-009本文/preserved/all23、inventory173/64/109、172 non-target identity、boundary/failure pinsを独立確認。full gatesはPASSしたがPOS/payment runtime correctness証拠ではない。IDX v0.4.37をAPPROVED/effective 2026-07-12へfinalizeし、WP-0036/0037/2203/3101/payment-security/DB/API/UI/external/production/human gatesは未解除。exact5をcommit `cfaa01b`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は64 incompleteでIN_PROGRESSを継続する。

### WP-9002-W23 ACC-004 metadata — LANDED

- clean feature-branch baseline `47c7422`で残存66 SSOTをfresh mappingし、known drift/高権限候補を避け、ACC-006との明示read-throughがあるACC-004単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-004本文1882 bytes / SHA-256 `b2b41d847221ab02ea8fdb871d1fa926ba95eef9f0a8c3679a27e3f7e412fb9d`、APPROVED/v0.2.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/65/108、non-target172 `15096/cea9bad6…`。10要件/4禁止、実受領額のみ領収、残債非隠蔽、現金RECEIVED/キャッシュレスCAPTURED、LOCAL_ONLY番号/sync/reverifyを保持。copay blockerを狭く継承し、direct tests/evidence/runtimeなし。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/receipt-legal/API/security/privacy/medicalの13 roleがAPPROVED。ACC-004本文/preserved/all23、10 requirements/4 prohibitions、inventory173/65/108、172 non-target identityを独立確認。full gatesはPASSしたがpartial-payment runtime correctness証拠ではない。IDX v0.4.36をAPPROVED/effective 2026-07-12へfinalizeし、copay/receipt/legal/LOCAL_ONLY/WP/DB/API/UI/production/human gatesは未解除。exact5をcommit `b692f09`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は65 incompleteでIN_PROGRESSを継続する。

### WP-9002-W22 ACC-006 metadata — LANDED

- clean feature-branch baseline `cee9415`で残存67 SSOTをfresh mappingし、known drift群とACC-005/006を比較した。refund permission/fraud/legal面が広いACC-005を後続へ回し、live codeで26 state runtime未実装を確認したACC-006単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-006本文3713 bytes / SHA-256 `ea1f5bca3fdc8f306f956855a3fb38192286d2a5c2dd4e0d3965af8e9c519c5c`、APPROVED/v0.2.0/legacy approval、dependencies/impacts、1 questionを不変とする。candidate inventory173/66/107、non-target172 `15216/ec444498…`。PatientReceivable10/Payment10/ReceiptDocument6と遷移、StatementDocument no-state、local duplicate禁止を保持。MOD-005+approved implementation WPまでBLOCKED_NOT_READYで、direct tests/evidence/runtimeなし。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/API/security/privacy/medicalの12 roleがAPPROVED。ACC-006本文/preserved/all23、10/10/6 states、inventory173/66/107、172 non-target identityを独立確認。full gatesはPASSしたがstate runtime correctness証拠ではない。IDX v0.4.35をAPPROVED/effective 2026-07-12へfinalizeし、MOD-005/WP-2201/2202/3101/DB/API/UI/production/human gatesは未解除。exact5をcommit `65c68d9`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は66 incompleteでIN_PROGRESSを継続する。

### WP-9002-W21 ACC-003 metadata — LANDED

- clean feature-branch baseline `c19d03e`で残存68 SSOTをfresh mappingし、known drift群とACC-003/006を比較した。複数state machineとblocker構造化を伴うACC-006より意味面が小さく、candidate値を本文で明示するACC-003単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-003本文2410 bytes / SHA-256 `d29074caf138552fdc5245133862cecf46de19c5cfc7c639bcd5ee47fdf40b4e`、APPROVED/v0.2.0/legacy approval、dependencies、1 questionを不変とする。candidate inventory173/67/106、non-target172 `15317/5708eeda…`。割当順序と24h窓は候補のまま、append-only/idempotency/human review/auto-cancel禁止を保持。direct runtime tests/PRs/evidenceなし。blockers emptyはdocument validityだけでWP-2201/3101/runtime readyを意味しない。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/API/security/privacy/medicalの12 roleがAPPROVED。ACC-003本文/preserved/all23、inventory173/67/106、172 non-target identity、candidate valuesを独立確認。full gatesはPASSしたがallocation runtime correctness証拠ではない。IDX v0.4.34をAPPROVED/effective 2026-07-12へfinalizeし、order/24h/overpayment/dedupe/audit/WP-2201/3101/DB/API/UI/production/human gatesは未解除。exact5をcommit `e0c9609`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は67 incompleteでIN_PROGRESSを継続する。

### WP-9002-W20 ACC-010 metadata — LANDED

- clean feature-branch baseline `f21e380`で残存69 SSOTをfresh mappingし、fact-drift群とACC-003/010を比較した。候補運用値を持つACC-003より意味面が小さく、WP-0037/0038 human scope判断までruntimeを停止できるACC-010単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-010本文1333 bytes / SHA-256 `a7fc92b1dad967665c0e2be8b5548401ce9fde4fedbb8b371f7c91709797705d`、APPROVED/v0.2.0/legacy approval、dependencies、3 questionsを不変とする。candidate inventory173/68/105、non-target172 `15435/5997b181…`。個人/施設会計分離、患者別内訳、二重請求排他、MVP model separation+route flagを保持し、invoice/AR/payment allocation/HQ runtimeやWP-0037/0038をunblockしない。direct tests/PRs/evidenceは空。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/product/API/security/privacy/medicalの13 roleがAPPROVED。ACC-010本文/preserved/all23、inventory173/68/105、172 non-target identity、human-scope blockerを独立確認。full gatesはPASSしたがfacility runtime correctness証拠ではない。IDX v0.4.33をAPPROVED/effective 2026-07-12へfinalizeし、WP-0037/0038/product/privacy/legal/accounting/DB/API/UI/production/human gatesは未解除。exact5をcommit `a570c51`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は68 incompleteでIN_PROGRESSを継続する。

### WP-9002-W19 ACC-002 metadata — LANDED

- clean feature-branch baseline `ca38b0f`で残存70 SSOTをfresh mappingし、fact-drift候補と会計候補を比較した。ACC-006より意味面が小さく、ACC-001の既存copay stopをPatientReceivable生成へ狭く継承できるACC-002単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-002本文1724 bytes / SHA-256 `702a35e047be61983ba205beaf401bdb826a360eeb52937a6b512aca7883a805`、APPROVED/v0.2.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/69/104、non-target172 `15549/826ab6de…`。direct receivable tests/PRs/evidenceはなく、copay blockerはACC-001から狭く継承するだけ。仮債権禁止、未収非隠蔽、WRITTEN_OFF human approvalを維持し、WP-2201/3101/DB/API/UI/runtimeをunblockしない。review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/API/security/privacy/medicalの12 roleがAPPROVED。ACC-002本文/preserved/all23、inventory173/69/104、172 non-target identity、narrow copay blockerを独立確認。full gatesはPASSしたがreceivable runtime correctness証拠ではない。IDX v0.4.32をAPPROVED/effective 2026-07-12へfinalizeし、copay/Charge/write-off/notification/WP-2201/3101/DB/API/UI/production/human gatesは未解除。exact5をcommit `4e2cc4e`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は69 incompleteでIN_PROGRESSを継続する。

### WP-9002-W18 ACC-001 metadata — LANDED

- clean feature-branch baseline `81b4d18`で残存71 SSOTをfresh mappingし、known fact-drift候補とmissing最少群を比較した。会計runtime未実装とWP-2201 BLOCKEDを本文設計原則から区別し、copay blocker/Charge-before-Payment/append-only/tenant境界を保持できるACC-001単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- ACC-001本文6250 bytes / SHA-256 `db48374c9974a4cb857ef7665fb3a18d21112b858338d61bcfecc6064c8ae633`、APPROVED/v0.2.0/legacy approval、dependencies/impacts、3 questions、copay blockerを不変とする。candidate inventory173/70/103、non-target172 `15667/e4eec545…`。direct accounting tests/PRs/evidenceは存在せず空であり、APPROVEDをledger/DB/API/UI/payment/receipt runtime readyやWP-2201/3101 unblockと解釈しない。independent/domain review待ち、landing未主張。
- independent/spec/data/architect/DB/test/accounting/claims/security/privacy/medicalの11 roleがAPPROVED。ACC-001本文/preserved/all23、21 concepts、inventory173/70/103、172 non-target identityを独立確認。full gatesはPASSしたがaccounting runtime correctness証拠ではない。IDX v0.4.31をAPPROVED/effective 2026-07-12へfinalizeし、copay/retention/journal/Deposit/DB privileges/refund/receipt/tax/WP-2201/3101/production/human gatesは未解除。exact5をcommit `f1339a6`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は70 incompleteでIN_PROGRESSを継続する。

### WP-9002-W17 CAL-003 metadata — LANDED

- clean feature-branch baseline `973f1fb`で残存72 SSOTをfresh mappingし、missing最少のCAL-001/CAL-003/SEC-001/SEC-004を比較した。CAL-001/SEC-001/004はrouting/security/privacy fact driftがあるため除外し、未確認事項とevidence限界を本文でfail-closedに保持するCAL-003単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- CAL-003本文13044 bytes / SHA-256 `df10e6f29793745cadfaf862f230845e505881c103e7f9fbe7f958539b88bdc5`、APPROVED/v0.1.0/legacy approval、71 EVD IDs、P-01..08、points/sources/caveats、2 questions、empty blockerを不変とする。candidate inventory173/71/102、non-target172 `15771/7eb06b78…`。focused calculation testsは一部implemented-EVD consumerのpartial regressionだけで、全71件、公式原本、算定要件、golden/claim correctnessを証明しない。document-level evidence_ids emptyはrow-level EVDを置換・免除しない。independent/domain review待ちでlanding未主張。
- independent/spec/data/architect/test/claims/regulatory/calculation/security/privacy/medicalの11 roleがAPPROVED。CAL-003本文/preserved/all23、71 EVD、8 holds、inventory173/71/102、172 non-target identityを独立確認。calculation87とfull gatesはPASSしたがpartial/regression-onlyである。IDX v0.4.30をAPPROVED/effective 2026-07-12へfinalizeし、公式原本/修正版/算定要件/golden/claimability/release/human gatesは未解除。exact5をcommit `9e03142`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は71 incompleteでIN_PROGRESSを継続する。

### WP-9002-W16 QUA-002 metadata — LANDED

- clean feature-branch baseline `27f9325`で残存73 SSOTをfresh mappingし、QUA-002/005/006を比較した。QUA-005/006はproduction operations fact driftがあるため除外し、本文のREG-004接続試験停止を意味変更なく構造化できるQUA-002単独exact5をpre-plan `APPROVED_WITH_PINS`とした。
- QUA-002本文2594 bytes / SHA-256 `61c58e92c4e9a05f4028ff8de65d67d056e9f464863653b2ebed35a6d78a1125`、APPROVED/v0.1.0/legacy approval、dependencies、2 questionsを不変とする。candidate inventory173/72/101、non-target172 `15865/1ba901fa…`。related tests/PRs/evidenceは空で、L1 CI/traceはL2/L3、golden妥当性、外部sandbox、並行稼働、UAC、Go/No-Go/release readinessを証明しない。外部接続・production変更なし。independent/domain review待ちでlandingは未主張。
- independent/spec/data/architect/test/claims/regulatory/product-quality/security/privacy/medicalの11 roleがAPPROVED。QUA-002本文/preserved fields/all23、inventory173/72/101、172 non-target identity、RB-002/RB-003限定blockerを独立確認。workspace typecheck/test/buildと全gateはPASSしたがL1 regression-onlyである。IDX v0.4.29をAPPROVED/effective 2026-07-12へfinalizeし、L2/L3/golden/external/UAC/Go-No-Go/releaseとhuman authorityは未解除。exact5をcommit `3cf9257`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は72 incompleteでIN_PROGRESSを継続する。

### WP-9002-W15 QUA-008 metadata — LANDED

- clean feature-branch baseline `894967a`で残存74 SSOTをfresh mappingし、QUA-002/005/006/008を比較した。既存`BLOCKED_LEGAL_REVIEW`と3 open questionsが構造化済みで不足8 fieldだけを意味判断なしに補完できるQUA-008単独exact5をpre-plan `APPROVED_WITH_PINS`とした。QUA-006はproduction monitoring fact freshnessの別reviewが必要なため除外した。
- QUA-008本文4271 bytes / SHA-256 `de14877893ccef8f3ef355443934fe6f6505c16dc33340d6379915fe50711754`、APPROVED/v0.1.0/legacy approval、dependencies、legal blocker、3 questionsを不変とする。candidate inventory173/73/100、non-target172 `15971/76a074e4…`。related tests/PRs/evidenceは空であり、法令、匿名化、同意、契約、PHI、KPI/publication correctnessの証拠不在を免除しない。外部公開・production変更なし。independent/domain reviewとfull regression validation待ちで、landingは未主張。
- independent/spec/data/architect/test/product-quality/claims/security/privacy/medicalの10 roleがAPPROVED。QUA-008本文/preserved fields/all23、inventory173/73/100、172 non-target identityを独立確認。workspace typecheck/test/buildと全gateはPASSしたが法務/privacy/匿名化/同意/publicationの直接証拠ではない。IDX v0.4.28をAPPROVED/effective 2026-07-12へfinalizeし、BLOCKED_LEGAL_REVIEWとhuman authorityは未解除。exact5をcommit `2fda53a`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は73 incompleteでIN_PROGRESSを継続する。

### WP-9002-W14 QUA-009 metadata — LANDED

- clean feature-branch baseline `86a63e1`で75 incomplete SSOTをfresh mappingし、QUA-009 exact5をpre-plan `APPROVED_WITH_PINS`とした。不足8 fieldだけを補完し、本文3693 bytes / SHA-256 `b163e8a4912109f835ea502b21fecbd2e511f551bfcb834137dba2bccf97264f`、APPROVED/v0.1.1/legacy approval、dependencies・2 blockers・2 questionsを不変とする。candidate inventory173/74/99、non-target172 `16075/eb9ec0ed…`。`allowsClaimFinalization`はNORMAL-only mode guardの部分証拠だけで、直接KPI aggregator/publication runtime/testはない。返戻/査定・分母分子、法務/privacy/匿名化/同意/公開、PHI、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.27はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/test/claims/security/privacy/medical/product-qualityの10 roleがAPPROVED。QUA-009本文/preserved fields/all23、inventory173/74/99、172 non-target identityを独立確認。full gatesはPASSしたがKPI correctness/publication evidenceではない。IDX v0.4.27をAPPROVED/effective 2026-07-12へfinalize。legacy LOCAL_ONLY provenance/filtering表現もend-to-end証明済みとせず、blockers/human authorityは未解除。exact5はcommit `16eb58f`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は74 incompleteでIN_PROGRESSを継続する。

### WP-9002-W13 RCP-004 metadata — LANDED

- clean feature-branch baseline `18ec003`で76 incomplete SSOTをfresh mappingし、sole receipt residual RCP-004 exact5をpre-plan `APPROVED_WITH_PINS`とした。不足7 fieldだけを補完し、本文2993 bytes / SHA-256 `3868a926099a03d83be853e397b89df8380da8df0bc62582d396795635d7aa05`、APPROVED/v0.2.0/legacy approval、依存・impacts・3 questions・1 blockerを不変とする。candidate inventory173/75/98、non-target172 `16185/d6adb1ad…`。直接StatementDocument runtime/testはなく、legacy source、CAL/CLM partial evidence、RCP cycles、statement.declined audit gapを解決済みとしない。free/zero-yen/legal fields、calculation/evidence、privacy/PHI、audit/retention、WP-2202/3101、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.26はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/DB/test/claims/security/privacy/medicalの10 roleがAPPROVED。RCP-004本文/preserved fields/all23、inventory173/75/98、172 non-target identityを独立確認。full regression gatesはPASSしたがStatementDocument直接実装証拠ではない。IDX v0.4.26をAPPROVED/effective 2026-07-12へfinalize。known gapsとhuman authorityは未解除。exact5はcommit `fb1928d`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は75 incompleteでIN_PROGRESSを継続する。

### WP-9002-W12 RCP-001 metadata — LANDED

- clean feature-branch baseline `5133f19`で77 incomplete SSOTをfresh mappingし、RCP-001単独exact5をpre-plan `APPROVED_WITH_PINS`とした。RCP-004とのgroupingは別authority surfaceのため却下。不足7 fieldだけを補完し、本文3254 bytes / SHA-256 `8d7336d37c9816741bd2e72bf72c0814857c6851ef60daf9e3fb13fcbd3082ed`、APPROVED/v0.2.0/legacy approval、依存・impacts・2 questions・1 blockerを不変とする。candidate inventory173/76/97、non-target172 `16286/9e7a90df…`。直接ReceiptDocument/payment issuance runtime/testはなく、既存cycle/source drift/audit部分証拠を解決済みとしない。actual payment/partial balance、LOCAL_ONLY/recovery、audit、legal/tax/accounting、PHI、WP-2202/3101、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.25はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/DB/test/claims/security/privacy/medicalの10 roleがAPPROVED。RCP-001本文/preserved fields/all23、inventory173/76/97、172 non-target identityを独立確認。full regression gatesはPASSしたがreceipt/payment直接実装証拠ではない。IDX v0.4.25をAPPROVED/effective 2026-07-12へfinalize。known gapsとhuman authorityは未解除。exact5はcommit `06719da`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は76 incompleteでIN_PROGRESSを継続する。

### WP-9002-W11 RCP-003 metadata — LANDED

- clean feature-branch baseline `ab04f9e`で78 incomplete SSOTをfresh mappingし、RCP-003単独exact5をpre-plan `APPROVED_WITH_PINS`とした。不足7 fieldだけを補完し、本文2805 bytes / SHA-256 `0429a418bc44e98511cea207d95fbc50b3054eefdc4944e6e93f9ce55b5b225c`、APPROVED/v0.2.0/legacy approval、依存・impacts・2 open questions・blockersを不変とする。review candidate inventoryは173/77/96、non-target172は`16379/a039b7b2…`。RCP-001 cycle、RCP-005/source参照不足、receipt.replaced未登録、businessReason強制差を変更・解決せず、direct ReceiptDocument/API/runtime/test evidenceはない。legal/tax/accounting/audit/atomicity/idempotency/concurrency/PHI、WP-2202/3101、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.24はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/DB/test/claims/security/privacy/medicalの10 roleがAPPROVED。RCP-003本文/preserved fields/all23、inventory173/77/96、172 non-target identityを独立確認。full regression gatesはPASSしたがreceipt state直接実装証拠ではない。IDX v0.4.24をAPPROVED/effective 2026-07-12へfinalize。既知gapとhuman authorityは未解除。exact5はcommit `e233197`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は77 incompleteでIN_PROGRESSを継続する。

### WP-9002-W10 RCP-002 metadata — LANDED

- clean feature-branch baseline `d3647bb`で79 incomplete SSOTをfresh mappingし、RCP-002単独exact5をpre-plan `APPROVED_WITH_PINS`とした。不足7 fieldだけを補完し、本文2726 bytes / SHA-256 `8fa466890938c07e665dbb6c87a493c8b8408bf48ccd714b8a4eaf749f667535`、APPROVED/v0.2.0/legacy approval、依存・impacts・2 open questions・blockersを不変とする。review candidate inventoryは173/78/95、non-target172は`16483/0dbb5e51…`。RCP-001との既存cycleを変更せず、direct ReceiptDocument/numbering runtime/test evidenceはない。法定採番、年度境界、LOCAL_ONLY/recovery、transaction/idempotency/conflict、PHI、WP-2202、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.23はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/DB/test/claims/security/privacy/medicalの10 roleがAPPROVED。RCP-002本文/preserved fields/all23、inventory173/78/95、172 non-target identityを独立確認。full regression gatesはPASSしたが採番直接実装証拠ではない。IDX v0.4.23をAPPROVED/effective 2026-07-12へfinalize。ARC-010/RCP-001間の既存LOCAL_ONLY表現差も解消済みとせず、human authorityと全停止境界は未解除。exact5はcommit `8b8f70f`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は78 incompleteでIN_PROGRESSを継続する。

### WP-9002-W9 RCP-006 metadata — LANDED

- clean feature-branch baseline `d6677f9`で80 incomplete SSOTをfresh mappingし、RCP-006単独exact5をpre-plan `APPROVED_WITH_PINS`とした。不足7 fieldだけを補完し、本文1862 bytes / SHA-256 `1bc7aa7db477fcd8858983201a3117aa8866767c987ce427e76d70a5a2b9b3c8`、APPROVED/v0.2.0/legacy approval、依存・impacts・2 open questions・blockersを不変とする。review candidate inventoryは173/79/94、non-target172は`16584/c860764d…`。RCP-004との既存cycleは変更せず、direct runtime/test evidenceはない。privacy consent/代理人、PHI、法令、permission/audit、WP-2202/3101、DB/API/UI/production/externalを解除せず、候補時のIDX v0.4.22はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/test/claims/security/privacy/medicalの9 roleがAPPROVED。RCP-006本文/preserved fields/all23、inventory173/79/94、172 non-target identityを独立再現。full regression gatesはPASSしたがprivacy/receipt直接実装証拠ではない。IDX v0.4.22をAPPROVED/effective 2026-07-12へfinalize。human authorityと全停止境界は未解除。exact5はcommit `ee91fad`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は79 incompleteでIN_PROGRESSを継続する。

### WP-9002-W8 RCP-005 metadata — LANDED

- clean feature-branch baseline `7558084`で81 incomplete SSOTをfresh mappingし、RCP-005単独exact5をpre-plan `APPROVED_WITH_PINS`とした。RCP-005の不足7 fieldだけを補完し、本文1808 bytes / SHA-256 `2142925c8a298b450f127459edf77ff55ab63e0ef3afdd0002e7ccaceecf609a`、APPROVED/v0.2.0/legacy approval、依存・impacts・2 open questions・blockersを不変とする。review candidate inventoryは173/80/93。`@yrese/events`はlowercase SHA-256形式の隣接証拠だけでreceipt直接実装ではない。WP-2202、receipt生成/再発行、法令適合、電子保存、hash計算、DB/production/externalを解除せず、候補時のIDX v0.4.21はPROPOSED・approval/effective nullでreview待ちだった。
- independent/spec/data/architect/test/claims/security/privacy/medicalの9 roleがAPPROVED。RCP-005本文/preserved fields/all23、inventory173/80/93、172 non-target baseline identityを独立再現した。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0/critical0、SBOM231、diffはPASSしたがreceipt直接実装証拠ではない。IDX v0.4.21をAPPROVED/effective 2026-07-12へfinalize。legal/pharmacy/product/claims authority、WP-2202、receipt生成/再発行、電子保存、hash計算、DB/production/externalは未解除。exact5はcommit `fbef2c2`として`origin/agent/reconcile-wp9002-w7c-20260712`へpush済み。WP-9002は80 incompleteでIN_PROGRESSを継続する。

## 2026-07-11

### WP-9002-W7C ACC-008 metadata — LANDED

- clean `375c1ee`でresidual82を再triageし、OPS-009は`causationId` optionalとの本文driftと未実装observability基盤のためmetadata-onlyから除外した。ACC-008だけをbody-preserving exact5へ選定。PaymentMethod/POSSettlement等のruntime/direct testはなく、empty tests/evidenceはnon-waiver。body `1256/987fea1d…`、target173/81/92、non-target172 `16778/097329f5…`、IDX v0.4.20。CASH/MVP、Payment method_code、POS結果不在時の決済完了非捏造、混合支払、open question、legacy approvalは不変。copay、Charge-before-Payment、ACC-009、WP-0037/0038、WP-2201/3101、tenant/audit/production/deployを解除しない。候補時にACC-008は23 fieldを補完し、IDX v0.4.20はPROPOSED/nullだった。
- independent/spec/data/architect/DB/test/claims/security/privacy/medicalの10 roleがAPPROVED。ACC-008のbody/status/version/legacy approval/effective nullは不変、IDX v0.4.20をAPPROVED/effective 2026-07-11へfinalize。workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0/critical0、SBOM231、diffがPASSし、API PostgreSQL integration 9件は`TEST_DATABASE_URL`なしのexpected skip。これらはACC-008のruntime証拠ではなくregression-onlyであり、payment/POS/claim/tenant/production/human gateを解除しない。exact5はcommit `57172ca`として`origin/main`へpush済みで、current HEADの祖先である。inventoryは173/81/92。WP-9002はIN_PROGRESSのままで、次waveはfresh read-only mappingとpre-plan reviewを要する。

### WP-9007 SEC-008 audit security freshness — LANDED

- verified residualは83 incomplete。mapperのA metadata / B fact-routing / C human-authority分類はtracked全件manifest未作成の暫定advisoryで、queue-wide terminal判定には使わない。SEC-008 exact5 candidateでWP-5004a/WP-2009/WP-2010 pure-core実装事実だけを同期し、persistence/WORM/KMS/RLS/retention/break-glass authorization/productionは未実装・human-gatedのまま。privacy/medical reviewの指摘により、tamper-evident対外訴求はpure coreと適用永続層の双方証拠、WORM訴求は採用authorityと運用検証を必須化し、correlation/causationはcaller-supplied規律でcross-event enforcementではないと明記した。候補時のSEC-008/IDX v0.4.19はPROPOSED/nullで、23 field充足、baseline `e14dd04`、target173/82/91、non-target172 `16879/060cf2b2…`、expected body `5738/f9104fa8…`。この候補を独立re-reviewとfull validationへ通した。
- independent/spec/data/architect/DB/API/test/security/privacy/medicalの10 roleがAPPROVED。audit182、workspace typecheck/test/build、OpenAPI、calculation-purity、scripts、SSOT173、secrets、boundaries、deps high0/critical0、SBOM231、diffがPASSし、API PostgreSQL integration 9件は`TEST_DATABASE_URL`なしのexpected skip。SEC-008 v0.1.2とIDX v0.4.19をAPPROVED/effective 2026-07-11へfinalize。physical WORM/KMS/RLS、retention/legal、break-glass authorization、persistence、productionは未実装・human-gatedのまま。exact5をcommit `4a2cefd`として`origin/main`へpushしLANDED。

### WP-9002-W7B ACC-007 metadata — completed / LANDED

- clean `4b99ab7`でACC-007を実装・台帳へ照合し、DailyCashClosing/CashDrawerSessionのruntime/direct testがないことを確認。単独exact5をpre-plan APPROVED_WITH_PINS。本文/承認/3 questions不変、target173/83/90、non-target172 `16991/7de30c7d…`。empty blocker/tests/evidenceはdocument-level nonclaimで、accounting/claims/LOCAL_ONLY/POS/production readinessを解除しない。10 role/full regression gates PASS後にIDX v0.4.18をAPPROVED/effective 2026-07-11へfinalize。commit `e8477c9`をorigin/mainへpushしLANDED。

### WP-9002-W7A SEC-003 metadata — completed / LANDED

- clean `7098c2d`でsecurity 7件を監査し、routing/implementation driftまたはstatus-blocker矛盾の6件を除外。SEC-003単独exact5をpre-plan APPROVED_WITH_PINS。本文/承認/security semantics不変、target173/84/89、non-target172 `17122/d7abe6d4…`。関連testはpartial control evidenceのみで、complete STRIDE/tenant/mTLS/KMS/Edge/production/security readinessを主張しない。10 role/full gates PASS後にIDX v0.4.17をAPPROVED/effective 2026-07-11へfinalize。commit `464f454`をorigin/mainへpushしLANDED。

### WP-9006 product scope routing compatibility — completed / LANDED

- clean `47154bd`でPRD-001/002/003を監査し、3件metadata-only案を却下。PRD-003はrisk-state semantic/human authority WPへ分離し、PRD-001/002だけをexact2 routing-line amendment + 23-field completionとしてpre-plan APPROVED_WITH_PINS。M1-M12/N1-N14、claim stop、open questions/blockers/reactivation/human gates不変。orphan landing ledger/reviewer-set findingsを修正し、target173/85/88、non-target171 `17183/037b3f5b…`、10 role/full gates PASS。PRD-001/002 v0.1.1とIDX v0.4.16をAPPROVED/effective 2026-07-11へfinalize。commit `770590a`をorigin/mainへpushしLANDED。

### WP-9002-W6C CAL-010/011 metadata — completed / LANDED

- clean `76afa17`からpure-function/golden-source policyをexact6 metadata-only waveへ選定。本文/status/version/approval/source/deps/impacts/questions/blockers不変、target173/87/86、non-target171 `17326/58c51344…`。calculation20/purity/scriptsは部分証拠のみで、全pure規律、golden catalog、算定要件、copay/claim/regulatory/production readinessを主張しない。`evidence_ids: []`は各goldenのEVD/human gateを免除しない。9 role/full gates PASS後にIDX v0.4.15をAPPROVED/effective 2026-07-11へfinalize。commit `8eb3e98`をorigin/mainへpushしLANDED。

### WP-9005 quality governance compatibility — completed / LANDED

- clean `bfb806c`からQUA-001/003の旧model・dual-lane・agmsg routingとQUA-004/005/006未作成扱いを検出。exact6 semantic amendmentをpre-plan APPROVED_WITH_PINSで起票。C1-C5、medical/claims/security/privacy/legal/production/human authority、golden/regression、incident、rollback、synthetic-only gateは不変。誤ったnon-target fingerprint evidenceをreview指摘で訂正し、target173/89/84・171 rows `17568/31502549…32f051`を再確認。8 role/full gates PASS後にQUA-001 v0.1.2、QUA-003 v0.1.1、IDX v0.4.14をAPPROVED/effective 2026-07-11へfinalize。commit `2b26c06`をorigin/mainへpushしLANDED。

### WP-9002-W6B QUA-004 metadata — completed / LANDED

- clean `2d695fa`でquality/regulatory/receiptを比較。QUA-001/003はAGT-018と矛盾する旧routing本文、他quality/regulatory/receiptはclaims/legal/production/external意味のため除外し、QUA-004単独exact5へ縮小してpre-plan APPROVED_WITH_PINS。target173/91/82、対象外172 hash `54f8fede…5d45f`。本文/承認、2questions、document-level empty blocker非免除を保持。9 role reviewとworkspace typecheck/test/buildを含むfull gatesが全PASSし、IDX v0.4.13をAPPROVED/effective 2026-07-11へfinalize。commit `c9a2641` をorigin/mainへpushし、exact5でLANDED。

### WP-9002-W6A PLAN-DB metadata — completed / LANDED

- clean `05a1edc`でsafety/plan/claim最小カテゴリを再評価。SAFはWP-9004b、claimはclaims semantics、Phase0 gate reportはstale historical blockersのため除外し、PLAN-DB-001単独exact5をpre-plan APPROVED_WITH_PINS。target173/92/81、対象外172 hash `467e8abc…9729709`。PROPOSED/null承認、本文・open question・6停止条件を保持した。
- independent/spec/data-integrity/architect/DB/test/claims-evidence/security/privacy/medicalの10 roleがAPPROVED。workspace full gates PASS。IDX v0.4.12を旧provenance+10承認でAPPROVED finalizationし、exact5をcommit `07bdc96`として`origin/main`へpush。PLAN-DB自体はPROPOSED/null承認、DB/infra/production非activation。

### WP-9004a SAF-001 critical aggregate correction — completed / LANDED

- pre-plan reviewでSAF-001表のcritical行が11件、集計欄の列挙IDも同じ11件なのに件数だけ9件と判明。risk意味を変えずsummaryを11件へ訂正。exact4、表count/setとsummary一致、risk rows/frontmatterはbyte-identical。independent/medical-safety review APPROVED、SSOT/scripts/secrets/boundaries/diff PASS。commit `0b0b5ba`を`origin/main`へpush。古い実装状況記述はWP-9004b evidence freshness reviewへ分離。

### WP-9002-W5F domain metadata — completed / LANDED

- clean `ebb4ca4`からDOM-001..006をexact10 waveとしてmap/pre-plan。target173/93/80、対象外167 hash `59f36f3f…aeed28`。本文/承認/広い既存questionを保持し、DOM-005 ARC-008 amendment exact、DOM-006 blocker非変更。WP-1101はcommit-history-only provenance。
- independent/spec/data-integrity/architect/test/API/claims-evidence/security/privacy/medicalの10 roleがAPPROVED。workspace typecheck/test/buildと全gateがPASS。IDX v0.4.11を旧provenance保持+10承認でAPPROVED finalizationし、exact10をcommit `5976a0a`として`origin/main`へpush。FHIR/adapter/claim/security/medical/external/production変更なし。

### WP-9002-W5E database metadata — completed / LANDED

- clean `96cc1dd`からDB-001..005をatomic waveとしてmap/pre-plan。exact9、target173/99/74、対象外168 hash `c3a067a4…a803c1`。本文/承認/DB-001..004 ARC-008 amendmentと全既存blocker/questionを保持し、DB-003/004は本文の未解決事項だけを追加。DB-005 testはaudit subset限定で、DB/FHIR/security/legal readinessを主張しない。
- independent/spec/data-integrity/architect/DB/test/API/security/privacy/medicalの10 roleがAPPROVED。workspace typecheck/test/buildと全gateがPASS。IDX v0.4.10を旧provenance保持+10承認でAPPROVED finalizationし、exact9をcommit `a57bacd`として`origin/main`へpush。DB接続、migration、DDL/DML、AWS、production、deploy変更なし。

### WP-9002-W5D masters metadata — completed / LANDED

- clean `6ca8fc6`からMST-001/002をatomic pairとしてmap。既存相互依存を変更せず、pre-planをAPPROVED_WITH_PINS。target173/104/69、対象外171 hash `a70313e7…07ade`。本文/人間承認/MST-001 evidence blockerを保持し、MST-002 blockerは本文直接写像のみ。文書evidence空配列はrecord単位evidenceを免除しない。
- independent/spec/data-integrity/architect/test/security/privacy/medical/claims-evidence-master-dataの9 roleがAPPROVED。workspace typecheck/test/buildと全gateがPASS。IDX v0.4.9を旧provenance保持+9承認でAPPROVED finalizationし、exact6をcommit `ea2ddf2`として`origin/main`へpush。コード、DB、external、deploy変更なし。

### WP-9002-W5C adapters metadata — completed / LANDED

- clean `34d0a6e`からremaining 108件を再scanし、domain/database/adapters/mastersを比較。最小coherent pairのADP-001/002をexact6 W5Cに選定し、pre-planをAPPROVED_WITH_PINS。target173/106/67、対象外171 hash `6d777f91…53b346`。本文/人間承認/個別gateを保持し、ADP-002の共通blockerは本文T3のdocument-level umbrellaに限定。
- independent/spec/data-integrity/architect/API/test/security/privacy/medicalの9 roleがAPPROVED。workspace typecheck/test/buildと全gateがPASS。IDX v0.4.8を旧provenance保持+9承認でAPPROVED finalizationし、exact6をcommit `86319a4`として`origin/main`へpush。コード、DB、external、deploy変更なし。

### WP-9002-W5B architecture metadata — completed / LANDED

- clean `ff7fb77`からarchitecture 10件をmap/pre-plan。exact14、inventory173/108/65、対象外163 hash `de1e4127…f340b2`。本文/approval、ARC-005/007 amendment、ARC-008 amends、全blockerを保持した。
- independent/spec/data-integrity/architect/test/security/privacy/medical/APIの9 roleがAPPROVED。workspace typecheck/test/buildとOpenAPI/calculation-purity/scripts/SSOT173/secrets/boundaries/deps/SBOM/diffがPASS。IDX v0.4.7を旧provenance保持+9承認でAPPROVED finalizationし、exact14をcommit `05edac6`として`origin/main`へpush。コード、DB、external、deploy変更なし。

### WP-9002-W5A API legacy metadata migration — completed / LANDED

- clean `134864c`からdocs/api全8件をread-only mappingし、pre-planは12パス限定R2 waveをAPPROVED_WITH_PINS。API-008 PROPOSED/null承認、API-004 PENDING_REVISION、API-005/API-008 blocker、全本文/status/version/approval/effective semanticsを保持した。
- review targetは173/118/55、target missing 0、対象外165 missing-set 20481 bytes / SHA-256 `479459faefe5ea55412d508559bd486162eec68955a10b57f9a13ef6303b6ca0`。API-004/005/008は実装testを主張しない。
- core/spec/data、API/test、security/privacy/medicalの8 roleがAPPROVED。API-004 amendment、API-005 legal blocker、API-008 PROPOSED/null承認+3 blockerを保持し、API-004/005/008は実装testを主張しない。
- exact12/staged0、inventory173/118/55、8本文/preserved fields、対象外165 hashを確認。workspace typecheck/test/buildと全gate PASS。IDX-001 v0.4.6を旧provenance保持+W5A 8承認でAPPROVED finalizationし、commit `74666c9`を`origin/main`へpush。external/DB/runtime/deploy変更なし。

### WP-9002-W4 remaining MOD/TST legacy metadata migration — completed / LANDED

- cleanな`5d68633`をbaselineに、残りmodule 10件+TST-001の23-field不足、本文hash、provenanceをread-only mapping。pre-planは11件一括のR2 metadata-only waveをAPPROVEDした。本文/status/version/human approval/effective semanticsは不変。
- review candidateはinventory 173/126/47、target missing 0、対象外162 canonical missing-set 21306 bytes / SHA-256 `2725393dd4eee5cd7949dc43238edbb4df2a962dd23c15ae23c6b882a51d1a5d`。TST-001 `blockers: []`は文書承認blockerなしだけを示し、本文のBLOCKED/planned testカテゴリは解除しない。
- API/test reviewがMOD-001 calculation-purity、MOD-012 WP-4043、TST-001 secrets provenance不足を検出して修正。W2 validation listへの誤挿入もcore/safety reviewで検出し、W4へ移した。3系統再review後、independent/spec/data-integrity/test/security/API-contract/medical-safety/privacyの8 roleがAPPROVED。
- exact 15 paths/staged 0、inventory 173/126/47、11本文/preserved fields、対象外162 hashを確認。workspace typecheck/test/build、OpenAPI/calculation-purity/scripts/SSOT173/secrets/boundaries/deps/SBOM/diffがPASS。IDX-001 v0.4.5を全旧provenance保持+W4 8承認でAPPROVED finalizationし、commit `09070f3`を`origin/main`へpushした。product code、DB、external、deploy変更なし。

### WP-9002-W3 MOD-006/MOD-007 legacy metadata migration — completed / LANDED

- WP-9003はcommit `3e8dee0`で`origin/main`へlanded済み。cleanな同commitをbaselineにread-only mapperがMOD-006/MOD-007の本文、legacy frontmatter、23-field不足、implementation/test provenanceを照合し、pre-plan reviewerがexact six-path R2 metadata-only waveをAPPROVEDした。
- 両targetは同じ7 field不足。本文をMOD-006 3509 bytes / SHA-256 `96ebdea1a65b949e77ef4165dd3049cc4f7e7eeda27904dce19a8f67e075e84c`、MOD-007 2139 bytes / `94974900b71ece2bcdf025b876e661e7692e8174e54d4cd4f887a2ce01ea86f0`で固定し、status/version/human approval/effective semanticsを変えず、保守的provenanceだけを追加した。review inventoryは173/137/36、対象外171 missing-set baselineは22739 bytes / SHA-256 `40b4506bfa956eed0303348fa62945dfe9456d123ba4942395993abfcd49ca42`。
- API/test reviewがimpactに対する直接WP provenance不足を検出したため、MOD-006へWP-4036/WP-4062、MOD-007へWP-2002/WP-4042/WP-4065を追加し、3系統すべてで再reviewした。independent/spec/data-integrity/security/API-contract/test/medical-safety/privacyの8 roleがAPPROVED。新規human gateなし。
- exact six paths/staged 0、inventory 173/137/36、target missing 0、両本文hash、対象外171 hash、preserved fieldsを確認。shared-kernel 23、contracts 23、API 43、Web 28、OpenAPI/scripts/SSOT 173/secrets/boundaries/diff checkがPASS。IDX-001 v0.4.4を全旧provenance保持+W3 8承認でAPPROVED finalizationし、commit `1b07db6`を`origin/main`へpushした。product code、DB、migration、external、deploy変更なし。

### WP-9003 repository reconciliation state pack — completed

- 未追跡`ops/refactor` 7文書をAPPROVED AGT-018のCodex-only運用、landed 4 commits、current validation、terminal task split、high-risk/rollback/human gate、WP-9002 173/139/34 inventoryとW3 next actionへ同期した。旧dual-lane / agmsg / model gate / SSOT 172 / commit_requestはactive stateから除去し、historical provenanceだけを既存Plans/Stateに保持した。
- `ops/refactor/STATE.md`を単独resume entrypointとし、current phase、last completed、blockers、validation、Git resume checks、next actionを明記。product code、DB、migration、external、deploy変更なし。independent verifierとdocs gates PASS後にCodex rootがexact 9 pathsをlandingする。rollbackはWP-9003 docs commitのrevert。

### WP-4080 production plaintext Web API base fail-closed hardening — completed

- 最終security scanで、WP-4067のresolverがproductionを含む全environmentでabsolute HTTPを受理し、患者検索・受付データを平文送受信し得るHIGHを確認。APPROVED SEC-003の「LAN内もTLS必須」を上位根拠にCodex-native pre-planをAPPROVEDし、WP-4067履歴を改変せずfollow-up化した。
- absolute HTTPはexact development + canonical loopback (`localhost` / `127.0.0.1` / `[::1]`)だけ許可。root-relative/HTTPSは維持し、production/staging/test/preview/unknown HTTPとdev外部/LAN/lookalikeを固定値非echo errorでfetch前拒否する。raw `?` / `#`、empty/populated userinfoの`@`も拒否し、WHATWG empty delimiter bypassを閉じた。
- focused resolver/search/reception 59/59、web 99、web typecheck/build、workspace typecheck/test、boundaries/secrets/diff checkがPASS。患者検索、受付一覧、受付登録はいずれもunsafe production baseでzero-fetch、errorへのbase/query/patientId非露出を固定。
- independent verifierとsecurity/privacy/medical-safety specialistは修正後APPROVED。active Goal §10のR3事前human authority下のcontrol tighteningで、API/auth/CORS/Next rewrite/DB/PHI schema/deployは変更なし。production origin TLS/HSTSは別deploy gate。rollbackは4ファイルのatomic revert。

### WP-3010a shared-kernel mode-guard projection foundation — completed

- ARC-001とshared-kernelの3 guardだけを判定源に、全5 `SystemMode`の禁止・未禁止、禁止理由、復旧後導線、仮状態凡例を表示するfixture-only componentを追加した。未禁止は`data-mode-guard="not-prohibited"`かつ「実行可否は未確定」とし、権限・資格・evidence・`isClaimable`・個別接続/業務条件を明示する。
- online claimをgeneric external-confirmation labelから除外し、CLOUD_DEGRADEDを全面許可にせず、RECOVERY_SYNCを物理的接続断と誤断定しない。非LOCALの`PROVISIONAL_STATUSES`は「候補」とし、LOCAL_ONLYだけARC-001の必須付与を表示。PHI、network、API、DB、auth、請求ロジック変更なし。
- web 99、focused mode 7、web typecheck/build、boundaries/secrets/diff checkがPASS。independent verifier、medical-safety、privacy、frontend/accessibility specialistはpresentational foundationをAPPROVEDした。
- parent WP-3010はfull SCR-026として完了扱いせず、WP-3010b(28操作/16禁止・live mode・件数contract/human review)とWP-3010c(route/browser/UI-flow)を解除条件付きBLOCKEDへ分離。rollbackはcomponent/testと`MODE_LABELS` exportの3-file revert。

### WP-3011a fixture-first calculation_trace read contract/viewer foundation — completed

- APPROVED API-007/CAL-008/QUA-007を根拠に、`@yrese/contracts`へ`@yrese/trace`のread-only zod写像を追加した。enumはtrace const tupleを再利用し、canonical base-10 `resultPoints` / `resultYen` predicateとstep/rounding由来evidence-id collectorをtrace側の単一正本としてruntime constructorとcontractで共有した。contractはevidenceIdsの欠落・余剰・重複を拒否する。
- `CalculationTraceView`は合成fixtureだけを表示し、evidence/rounding gap、blockers、未知source/statusをfail-closedに明示する。EvidenceRef URL、PHI-like intermediate key、外部link/log/sendは拒否/不実装。endpoint、permission、tenant binding、live trace、routeは追加していない。
- trace 37、contracts 86、web 99、workspace typecheck/test、web/full build、OpenAPI/boundaries/secrets/diff checkがPASS。independent verifier、API-contract、medical-safety、privacy、frontend/accessibility reviewerはfixture-only foundationをAPPROVEDした。
- parent WP-3011はlive screenとして完了扱いせず、WP-3011b(intermediate typed semantics / producer trust boundary)とWP-3011c(endpoint/auth/tenant/route/UI-flow)を具体的解除条件付きBLOCKEDへ分離。rollbackは本subtaskのcontracts/trace/web/package/lock差分のatomic revert。

### WP-4078 direct audit intent fingerprint single-snapshot/Proxy TOCTOU hardening — completed

- AGT-018のread-only mapper / spec guardianがcurrent diffをAPPROVED SSOTへ再照合し、Codex root sole maintainerがdirect append fingerprintを単一frozen descriptor snapshotへ変更した。outer version-first、v1 deep copy、canonical `wallClock` exactly once、同一snapshotによるhash/domain validationでProxy/mutable inputのhash-A/validate-Bを除去した。
- stored M3a behavior、public API、v1 canonical JSON/golden `2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745`、既存error class/messageは不変。direct optional明示`undefined`は承認済み5項目だけを新規拒否し、API/AWS/DB/raw item/network/package/lock/SSOTは変更していない。
- focused 80/80、audit 182/182、audit typecheck/build、workspace typecheck/test/build、OpenAPI/secrets/deps(high=0, critical=0)/SBOM(231)/boundaries/calculation-purity/SSOT index(173)/script harness/diff checkがPASS。PostgreSQL integration 9件は`TEST_DATABASE_URL`不在のexpected skipで、DB操作なし。
- independent verifier、security/data-integrity、medical-safety、privacy reviewerはAPPROVED。active Goal §10をR3事前human authorizationとして記録し、監査意味変更・PHI・storage/log・production・migration・残存risk受容なし。rollbackはaudit 3ファイルのatomic revert。
- 別finding WP-4079はstored pathのversion-before-deep-read問題として`BLOCKED_HUMAN_SCOPE_APPROVAL`へ分離した。

## 2026-07-10

### WP-9002-W2 MOD-011/MOD-014 legacy frontmatter migration — LANDED

- approved pre-planに従い、HEAD `73fda4bce9f500fbe9c4dc157c8cc573ca28eee2`のinventory 173/141/32をbaselineとして、MOD-011とMOD-014の不足8 fieldだけを補完した。targetは173/139/34、変更許可は両target、`docs/ssot_index.md`、`Plans.md`、`State.md`のexact five pathsだけで、W1 LANDED recordは変更していない。
- MOD-011は本文3041 bytes / SHA-256 `e4a73fad7fc8f47a0485c2d08eab461edd6c5a5a3d024adbcb55775e94b06066`、MOD-014は本文2507 bytes / SHA-256 `ed145a48bdda369e64c7d7b4e3d88b6e759d1bb4397c1b637cb1e4781c698d16`を固定する。両文書のversion/status/approval/owner/reviewers/created/source/depends/open-questions/blockersは維持し、W2 reviewerをtarget approved_byへ追加していない。
- MOD-011はdate-time/events wallClock/API reception business-date/web reception presentationのtraceable impactsと、date-time/API server/PostgreSQL repository integration/web receptionのfocused testsだけをmetadataとして追加した。MOD-014はcontracts/OpenAPI/check-openapiと`future generated-client boundary (unimplemented; no coverage claim)`のtraceable impacts、check gatesだけをmetadataとして追加した。コード、API契約、生成物、テスト、DB、migration、external、deploy、destructive operationは変更していない。
- independent_verifier、test_architect、spec_guardian、api_contract_reviewer、data_integrity_auditor、medical_safety_reviewer、privacy_compliance_reviewerは全員`APPROVED`。metadata-only scope、本文・preserved approval値・effective semantics、traceability、inventory、W1 provenance、DB/外部非変更を確認し、未解決findingはない。W2 human approvalは主張しない。
- seven-reviewer approval後、sole maintainerがIDX-001 v0.4.3を`APPROVED`へfinalizeした。approved_at/effective_fromは2026-07-10、approved_byはWP-9001/W1の全provenanceを保持してW2の7 reviewer approvalだけを追記し、既存human_review_if_requiredとW1 rolesを削除していない。historical 173/142、W1 173/141/32、index rows/status/path、総数173を維持し、W2 final inventoryは173/139/34である。
- validationはtarget missing 0、inventory 173/139/34、171非対象missing-set baseline同一、両本文の指定bytes/hash、preserved fields、W1 record byte identity、exact five paths / staged 0をPASSした。focused testはdate-time 8、API server 43、web reception 10がPASSし、PostgreSQL repository integrationは`TEST_DATABASE_URL`不在のため7件expected skipで、DB接続・migration・DML操作は行っていない。`pnpm check:openapi`、`pnpm test:scripts`、`pnpm check:ssot-index`(173)、secrets、boundaries、`git diff --check`もPASSした。
- review gateはindependent_verifier / spec_guardian / data_integrity_auditor、MOD-011のmedical_safety_reviewer / privacy_compliance_reviewer、MOD-014のapi_contract_reviewer / test_architectである。semantic/effective/approval/policy/medical/privacy/API/test-policy changeが必要なら停止し、applicable human authorityを持つ別WPへ分離する。全review APPROVED後にだけIDX finalizationへ進み、stage/commit/pushはCodex rootに限定する。
- Codex rootはexact five pathsをcommit `ff7518f` (`WP-9002-W2: normalize module metadata`)としてstage/commitし、origin/mainへ`73fda4b..ff7518f`をpushした。W2は`LANDED`、landing gateはsatisfiedである。landing時点のinventoryは173/139/34。MOD-011はcurrent file 4679 bytes / SHA-256 `a929603619981b113bb81c209584900e1f78275806d47388e2d1fd0754675074`、本文3041 bytes / SHA-256 `e4a73fad7fc8f47a0485c2d08eab461edd6c5a5a3d024adbcb55775e94b06066`、MOD-014はcurrent file 3786 bytes / SHA-256 `0fa815faebec490b3c0704c00271b8e705939cf209679c056208240aeb42e032`、本文2507 bytes / SHA-256 `ed145a48bdda369e64c7d7b4e3d88b6e759d1bb4397c1b637cb1e4781c698d16`を維持した。7 role approvalとdate-time 8 / API server 43 / web reception 10 PASS、PostgreSQL integration 7 expected skip(`TEST_DATABASE_URL`不在、DB接続・migration・DMLなし)、OpenAPI/scripts/SSOT/secrets/boundaries/diff gatesを維持し、コード、DB、external、deploy、destructive changeはない。
- WP-9002全体は不足139文書を残して`[~] / IN_PROGRESS`でありDONEではない。W1/W2はLANDED、W3は未着手で、W3の編集前に新しいread-only mappingとpre-plan reviewを必須とする。

### WP-9002-W1 QUA-007 legacy frontmatter canary — LANDED

- approved canary planに従い、HEAD `619806842135e4a1d08d84488b771c06e12f8778`をbaselineとして23-field exact-key scanを実施。index対象173文書中、不足142 / 充足31、QUA-007は`effective_from` / `effective_to` / `related_work_packages` / `related_tests` / `related_prs` / `evidence_ids` / `change_log`の7 field不足を確認した。
- sole maintainerは許可された`docs/quality/quality_transparency_strategy.md`、`docs/ssot_index.md`、`Plans.md`、`State.md`だけを変更。QUA-007はversion/status/approval/owner/reviewers/created/source/dependency/impact/blocker/open-questionを保持し、PRC-007 metadataだけを補完した。本文境界のbaselineは3336 bytes、SHA-256 `3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851`である。
- IDX-001 v0.4.2はreview diffとしてPROPOSEDにし、approval/effective metadataを空欄のまま保持。historical 173/142記録、総数173、QUA-007 APPROVED/path行を変えず、W1 baseline 173/142/31とtarget 173/141/32を別ledgerとして追加した。
- worktree-local dependency provisioning後にfull auditを再実行。23-field target 173/141/32、QUA missing 0、非対象172文書のmissing-set同一、QUA preserved frontmatter、本文3336 bytes / SHA-256 `3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851`、exact 4-path unstaged diff、historical 173/142・QUA index APPROVED/path・総数173をすべてPASSした。`pnpm check:ssot-index`(173)、`pnpm test:scripts`、secrets、boundaries、`git diff --check`もPASSし、independent_verifier、spec_guardian、data_integrity_auditorのreview-readyである。
- independent_verifier、spec_guardian、data_integrity_auditor、medical_safety_reviewer、privacy_compliance_reviewer、security_criticのcombined reviewは`APPROVED`。exact 4-path、QUA本文3336 bytes / 指定SHA、status/version/approval不変を確認し、`BLOCKED_LEGAL_REVIEW`、claim evidence/evidenceRef fail-closed、PHI/PII非露出を維持してmetadataがsemantic activationを生じないと判定した。
- six-reviewer approval後、sole maintainerがIDX-001 v0.4.2をAPPROVEDへfinalizeした。approved_at/effective_fromは2026-07-10、approved_byはWP-9001 provenanceを保持して全WP-9002-W1 reviewer approvalを追記した。QUA-007 current fileはbyte-for-byte変更していない。
- post-finalization validationはQUA current file 4663 bytes / SHA-256 `e7a7e7ec8800288e9865da6c2ed878862e25887373b7617bf5087bd83aa62e7c`、HEAD-identical body 3336 bytes / 指定SHA、preserved values、173/141/32、QUA missing 0、非対象172 missing-set同一、IDX APPROVED/six reviewers/WP-9001 provenance/historical 142、QUA index行/総数、exact 4-path/staged 0をPASS。`pnpm check:ssot-index`(173)、`pnpm test:scripts`、secrets、boundaries、diff checkもPASSした。
- Codex rootはexact four pathsをcommit `41c4d9f` (`WP-9002-W1: normalize QUA-007 frontmatter`)としてstage/commitし、origin/mainへ`6198068..41c4d9f`をpushした。W1は`LANDED`、landing gateはsatisfiedである。landing時点のinventoryは173/141/32、QUA current fileは4663 bytes / SHA-256 `e7a7e7ec8800288e9865da6c2ed878862e25887373b7617bf5087bd83aa62e7c`、本文は3336 bytes / SHA-256 `3315dfe31bf199248ace7058adf044e4fd3d72b260873063efa438800b36b851`で、six-reviewer approvalと全validation gateを維持した。コード、DB、migration、external、deploy、destructive changeはない。
- WP-9002全体は不足141文書を残して`[~] / IN_PROGRESS`でありDONEではない。次waveは未着手で、編集前に新しいread-only mappingとpre-plan reviewを必須とする。policy/legal/medical-safety/claim-evidence/privacy/security/external-publicationのsemantic changeが必要な文書は対象から分離し、該当human authorityの承認を持つ別WPへ送る。

### WP-4078 direct audit intent fingerprint single-snapshot/Proxy TOCTOU hardening — historical PLAN_APPROVED / AGT-018 re-plan pending / implementation HOLD

- independent explorer(confidence HIGH)が、direct M1 fingerprint pathでexact descriptor検証後のcopyを捨てて元のouter/context/intent/nestedを再dereferenceし、canonicalize後も元inputを`createAuditEvent`へ渡していることを確認。hostile Proxy/mutable inputはhash対象Aとdomain validation対象Bを分離し、将来のdedupe/conflict判定を壊し得るためHIGH audit-integrity findingとして登録した。copy/freeze済みのstored M3a event pathは変更対象外。
- historical fable5 `PLAN_APPROVED`: 許可範囲は `packages/audit/src/intent-fingerprint.ts`, `packages/audit/src/index.ts`, `packages/audit/src/intent-fingerprint.test.ts`, `Plans.md`, `State.md`のみ。outer exact key → version validation → v1 deep copy → canonicalize → domain validationの順を固定し、単一frozen snapshot、`wallClock` canonical string exactly once、stored/direct共用nested copy helperを使う。v1 bytes/public API/error label・message・classとstored behaviorは不変で、新error classは追加しない。direct optional明示`undefined`は承認済み5項目だけを新規拒否する。このscope/pinはprovenanceとして保持し、着手前にAGT-018のread-only mapper/pre-plan reviewerがcurrent diffとSSOTへ再照合する。
- 実装・テストは未着手。descriptor once/get zeroの5層、alternating getter/invalid descriptor、hash-A/validate-B、hostile Date、5 optional undefined、version error precedence、golden不変、stored回帰を実装後に固定し、Codex sole maintainer → independent verifier + security/data-integrity specialistをcurrent commit前gateとする。当時のprivacy review不要裁定はhistorical provenanceであり、current pre-plan reviewerが再確認する。PHI/storage/log scopeへ拡大する場合はprivacy/human gateを追加する。audit code/test、API/AWS/DB/raw item/network/package/lock/SSOTは変更しておらず、DB操作、stage / commit / pushも行っていない。

### WP-4051 PostgreSQL reception idempotency durability/concurrency proof — completed

- WP-5003 / `000002_create_patient_and_reception_tables.sql` で既に実装済みの `(tenant_id, pharmacy_id, idempotency_key)` UNIQUE、transaction、scoped既存行返却について、test-only PostgreSQL integration proofを4件追加した。同一scope/key/同一patientの並行createはdistinct `acceptedAt`でも `created` + `existing` と1行・同一receptionId/保存acceptedAtへ収束し、別patientの並行createはwinner順序を仮定せず `created` + entryなし `idempotency_conflict` と1行へ収束することを固定した。
- repositoryを新規生成した後の同一key/patient再送が元のreceptionId/acceptedAtを返すことと、同一opaque keyを `(tenantA, pharmacyA)` / `(tenantA, pharmacyB)` / `(tenantB, pharmacyA)` で独立に3行作成し、新規repositoryから各scopeの正しい受付だけを返すことも固定した。全fixtureは合成、keyは非PHI opaque値。sleep/barrier/retry/timing/winner順序への依存は置いていない。
- `withMigratedSchema` のworkload poolだけを `poolMax` option対応にし、default 1を維持して新規並行2テストだけmax 2を指定。admin/cleanup poolと既存・再生成・scope分離テストはmax 1のまま。source/migration/schema/contracts/OpenAPI/CI/package/lock、fingerprint/hashは変更しておらず、WP-4054の `PLAN_INVALID_AS_WRITTEN` 裁定も維持した。
- 最終ローカル検証: `pnpm -r typecheck`、`pnpm -r test`(API 161 PASS + PostgreSQL integration 9 expected SKIP)、`pnpm -r build` → `pnpm clean`、`pnpm check:openapi`、`pnpm check:secrets`、`pnpm check:deps`(high=0 / critical=0)、`pnpm check:sbom`(231 components)、`pnpm check:boundaries`、`pnpm check:calculation-purity`、`pnpm check:ssot-index`(172文書)、`pnpm test:scripts`、`git diff --check` はすべてPASS。
- 独立 verifier は `APPROVED`。data-integrity/privacy reviewerも10/10、findingなしで `APPROVED`。read-only Opus最終reviewも `APPROVED` で、非blocking所見はLOWのtest-local `normalizeInstant` 重複とINFOのdefault `READ COMMITTED` semantics依存のみ。テストはwinnerを仮定せず、いずれもsource変更を要する指摘ではない。
- implementation commit `6f5bd5b` をpush。GitHub Actions run `29062131540` / job `86266062178` は1m14sでsuccess。CI disposable PostgreSQL上で `src/db/postgres-repositories.integration.test.ts` 7件(既存3 + 新規4)が603msでPASS、migration-runner integration 2件もPASSし、API全体は10 files / 170 tests PASS・0 skipped。typecheck/test/build/OpenAPI/secrets/deps/SBOM/boundaries/calculation purity/SSOTの全CI stepもgreenとなり、WP-4051の実DBdurability/concurrency proofは完了した。
- CI証明は当該disposable PostgreSQLだけを対象とし、localは `TEST_DATABASE_URL` 不在のためDB接続・migration適用・DMLを実行していない。prod DBやその他環境へのmigration適用・変更は行っておらず、source/migration/schema/contracts/OpenAPI/package/lock、fingerprint/hashも変更していない。本ledger completionではstage / commit / pushなし。

### WP-4077 raw audit DynamoDB physical item envelope SSOT pin

- WP-7001 M3a後のself-scanで、DB-005は監査event/dedupe/TIPのkey・連番・minimum pointer/TIP属性を定める一方、raw event完全属性、DynamoDB `S`/`N`/`M`物理型、nested表現、optional omit/`NULL`、item schema version/discriminator、timestamp retry semantics、item別PHI/encryption、golden/decoder互換を未確定のまま残していることを確認。raw codecへ進むと永続契約の推測実装になるため `SSOT_UPDATE_REQUIRED` と判定した。
- 当時はownerをClaude/fable5、WP-7001 M3b / WP-5004b共通DoRとするpending SSOT-only WP-4077を追加し、Claude側へagmsgで起案依頼した。この履歴はprovenanceとして保持する。current ownerはCodex sole maintainerであり、完全physical map、logical fingerprintと分離したitem version、exact 3 discriminator、bigint decimal `S`、optional omit/unknown拒否、app-supplied timestamp retry規律、item別PHI/encryption + no TTL/GSI/PHI、synthetic full/min golden、version dispatch/no implicit v0、append-only no rewrite、TIP migration分離を必須pinとする。APPROVED DB-005改版・索引反映後も、AGT-018のmapper/pre-plan/independent verifierとsecurity/data/privacy/DB specialists、必要なhuman infrastructure authorityのreview前はM3b実装を停止する。
- ledger-only変更。コード、既存SSOT本文、raw codec、AWS SDK/table/network/write、DynamoDB Local、DB/migration、package/lockは変更していない。`git diff --check` / `pnpm check:ssot-index`(172文書)はPASSし、stage / commit / pushは行っていない。

### WP-7001 M3a / WP-2009 strict audit hydration and stored-event fingerprint

- fable5 `PLAN_APPROVED` の許可範囲で `@yrese/audit` に `hydrateAuditEvent(unknown)` を追加。rootと`targetRef` / `businessReason` nestedをexact plain own enumerable data shapeとしてdescriptor検証後に一度だけ内部copyし、unknown/symbol/non-enumerable/accessor/missing、optional明示`undefined`、非canonical wallClock、domain/hash形式不正を固定非echo `AuditEventHydrationError(reason=malformed_event)`へ収束した。shape/domainが正しくlowercase SHA-256形式の保存hashだけが再計算値と異なる場合に限り `entry_hash_mismatch` とし、Proxyが公開errorを投げてreasonを偽装する経路もmalformedへ固定。`createAuditEvent`をsole domain/hash coreとして再利用し、返却値は入力と独立したroot/nested frozen再生成物。
- `computeAuditEventIntentFingerprint` は同じexact event validatorを再利用し、trusted `AuditWriteContext` と保存eventのtenant/pharmacy/actor完全一致を固定非echo `AuditEventContextMismatchError` で強制。M1 `intentFields` 単一正本から存在するoptionalだけを射影し、`sequenceNumber` / `prevHash` / `entryHash` を除外して既存v1 canonicalizer/version dispatchへ委譲した。M1 golden hashは不変で、`retryCount`変更は異なるfingerprintとなる。
- テストは全required欠落、全optional明示undefined、全optional同時dead-letter成功/freeze、canonical instant、root/nested descriptor攻撃、attacker coercion、Proxy reason偽装、stored hash/payload/prevHash改変、runtime bigint/enum/classification不正、context不一致、chain位置除外、unknown fingerprint versionに加え、outer/context exact guardと全nestedを含むProxy descriptor exactly-once/property-get zeroを合成データだけで固定。focused 127、audit全体173、全workspace typecheck/test、audit/full build、OpenAPI、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、diff-checkがPASS。独立 verifier 10/10 と read-only Opus最終reviewはいずれも `APPROVED`、blocker/HIGH findingなし。raw DynamoDB itemは物理属性envelope未確定のため `SSOT_UPDATE_REQUIRED` として停止し、AWS SDK/table/network/write、DynamoDB Local、DB操作/migration、TIP/genesis/state/TWI/CAS/retry/persistence verify、package/lockは未変更。stage / commit / pushなし。

### WP-7001 M2 audit persistence key/sequence canonical codec

- fable5 read-only `PLAN_APPROVED` の許可範囲で、`apps/api/src/dynamodb/audit-persistence-key-codec.ts` と focused testを追加。`@yrese/audit` の `AuditWriteContext` を正本として再利用し、trusted tenant/pharmacy由来の `TENANT#{tenantId}#PHARMACY#{pharmacyId}#AUDIT#CHAIN#CLOUD`、event/dedupe/TIP SK、uint64 decimal/20桁sort segment、strict event SK round-tripをpure・side-effect-freeに固定した。
- branded ID factoryが許す `#` をcodec境界で全補間IDから拒否し、blank/control/wrong type、BigInt前のASCII文法、zero/max+1/20桁overflow、malformed marker/width/eventIdを入力値非echoの固定errorへ収束。seq=1/maxのexact golden、数値順=辞書順、`DEDUPE# < SEQ# < TIP`、actor非関与を74テストで固定した。
- 検証: codec 74/74、API 161 PASS + PostgreSQL integration 5 expected SKIP、audit 105/105、全workspace typecheck/test、API/full build、`pnpm check:openapi`、boundaries、secrets、deps(high=0 / critical=0)、SBOM(231 components)、script harness、`pnpm install --frozen-lockfile`、diff-checkがPASS。独立 verifier 10/10 と read-only Opus最終reviewはいずれも `APPROVED`、blocker/HIGH findingなし。AWS SDK/table/network/write、DynamoDB Local、DB操作/migration、genesis/state判断、raw item hydrate、TWI/CAS/retry/verifyは未変更でM3へHOLD。

### WP-4076 reception idempotency SSOT-plan contradiction cleanup — completed

- self-scanで、WP-4054 が server 採番の `acceptedAt` / 導出業務日付を fingerprint 対象にして同一 key + 同一 `patientId` の正当再送を409へ変える計画となっており、APPROVED API-006 v0.2.0 の200既存返却契約と矛盾することを確認した。API-006 payload 範囲の WP-4051 要件は in-memory / PostgreSQL の両実装で充足済み。
- 当時のfable5 read-only裁定 `CHANGES_REQUIRED` に従い、WP-4054 を `PLAN_INVALID_AS_WRITTEN` として無効化し、清算用WP-4076を追加した。この裁定はhistorical provenanceとして保持する。将来のfingerprintはAPI-006 APPROVED改版、AGT-018のread-only pre-plan reviewer再承認、independent verifier、security/privacy specialists、必要なhuman gateをcurrent gateとし、client送信内容限定、`acceptedAt` / `receptionId` / 導出 `businessDate` 恒久除外、PHI生値のhash input/storage/log禁止を必須pinとする。
- ledger-only変更を commit `a5eb9a8` としてpush。コード・migration・API契約・OpenAPI・package/lockは変更しておらず、DB操作も行っていない。
- GitHub Actions run `29058471602` / job `86254995220` はsuccessし、typecheck / test / build / OpenAPI / secrets / deps / SBOM / boundaries / calculation purity / SSOTを含む全stepがgreen。WP-4076のsole deliverableであるWP-4054の無効化と安全な後続gateの台帳化は完了した。

### WP-9001 Codex single-lane governance cutover — COMPLETE

- direct user instruction (2026-07-10) により、旧複数lane前提を停止し、Codex root / read-only mapper / read-only pre-plan reviewer / sole maintainer / independent verifier / relevant specialists / root exact-stage landingへrepository governanceをatomicに切り替えるWPを開始した。
- code mapperは、active agent/process/spec/plan/ledgerが旧routingを相互参照し、入口だけの修正ではAPPROVED文書同士の矛盾が残るimpact radiusを確認。initial plan reviewはscope/atomicity/current-artifact coverage不足で`CHANGES_REQUIRED`となり、Codex rootがAGENTS/CLAUDE、AGT-001〜018、SPEC-001/002、PRC-001〜007、current plans/ledgersを含むexpanded atomic scopeへ修正した。
- coordination preflightではprojectのagmsg delivery modeはoff、hooksは0であり、WP-9001はagmsgに依存しない。別用途でpre-existingの他Codex bridgeが存在したが、本WPの権限・依存範囲外なのでkill/restartせず、そのまま保全した。
- shared main worktreeに別作業のconcurrent WIPが存在したため、`/tmp/yrese-wp9001`のisolated worktreeを使用。sole maintainerはassigned exact pathsだけを編集し、shared mainのWIPとcommit履歴を変更していない。
- first independent/safety reviewは`CHANGES_REQUIRED`。OPS-012の旧Go/No-Go lane、REG-006のAGT-017/R3割当制約、unfinished Plansの旧review gate、A3/A4停止規律不足、WP-9001必須field不足、PRC frontmatter不足、AGT-018 routing precedence、SPEC-002高risk human review、承認前status主張を検出した。
- sole maintainer remediation: AGT-018、SPEC-001/002、PRC-001〜007、OPS-012、REG-006、Phase 0/UI plans、indexをreview用`PROPOSED`へ統一し、`approved_at` / `approved_by` / `effective_from`を空欄化。AGT-001〜017はcurrent `APPROVED`のまま保持する。base `a5eb9a8`のstatusを復元したfinalization matrixにより、元APPROVEDのSPEC/PRC/OPS/REG/Phase0/index改版はrequired review後APPROVEDへ戻し、新AGT-018はdirect cutover approval + independent/specialist verification後だけAPPROVED、元PROPOSEDのPLAN-UIUX-001は別design/human gateまでPROPOSEDを維持する。旧AGTはAGT-018承認と同一batchでmetadata-only SUPERSEDEDにし、中間状態はlandingしない。
- safety/governance remediation: Codex rootはGo/No-Go案の作成だけを担い最終判断はhuman-only、OPS-012 A3〜A6を人間薬剤師/請求実務/production security/medical riskの別gateへ分離。REG-006はrepository-local synthetic-only Codex承認とCloud/PHI/external/privilege/secret/production action承認を分離。PRC-002/003へA3 human/spec解消・再計画とA4 `BLOCKED_NOT_READY`を追加し、WP/Plans/StateがAPPROVED SSOTを上書きできないことを固定した。
- `Plans.md` WP-9001をPRC-002全必須fieldで展開。follow-up reviewで残存を検出したWP-2009/4007/4050/4051/4057、invalid WP-4054も補正し、先行補正済みWP-3022/5004/0019/0038とcurrent sequencing/issuanceを含むunfinished/current blockをAGT-018へre-routeした。旧fable/Opus/Claude名はcompleted historyまたは明示的なhistorical provenanceに限定し、再開時はmapper/pre-plan/sole maintainer/independent verifier + relevant specialistsで再計画する。薬剤師、請求実務、法務、security、privacy、data-governance、medical-riskのhuman authorityをCodex specialistと別gateで維持する。
- post-remediation validationは`pnpm check:ssot-index`(173)、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check`、unfinished/current blockの旧routing監査、base-aware status matrix監査がすべてPASS。
- legacy AGT frontmatterの23-field監査ではAGT-001〜015は充足、AGT-016/017は`effective_from` / `effective_to` / `depends_on` / `impacts` / `related_work_packages` / `related_tests` / `related_prs` / `evidence_ids` / `change_log`が不足。review中は旧AGTを変更せず、finalization sole maintainerが不足を追加し、全17件の23-field・本文byte identity・index同期をindependent verifierが確認する。
- review cycleはinitial independent/safety/spec review `CHANGES_REQUIRED` → sole maintainer remediation → independent_verifier、spec_guardian、medical_safety_reviewer、privacy_compliance_reviewer、security_criticの最終`APPROVED`で完了した。
- atomic finalizationではAGT-018をAPPROVED、baseでAPPROVEDだったSPEC-001/002・PRC-001〜007・OPS-012・REG-006・PLAN-PHASE0-001・IDX-001をAPPROVEDへ復帰、PLAN-UIUX-001をPROPOSEDのまま維持、AGT-001〜017を本文byte identityを保ったmetadata-only SUPERSEDEDへ変更した。AGT-016/017の不足9 fieldも補完し、全17件がPRC-007の23 fieldを満たす。
- final validationは`pnpm check:ssot-index`(173)、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check`、旧AGT 17件の23-field/status/effective_to/superseded_by・本文base identity、SPEC untargeted section identity、PLAN-UIUX PROPOSED、code/package/lock差分なしをすべてPASS。
- post-finalization scanで、index対象173文書中142文書にPRC-007 required 23 field不足を確認。既存legacyのstatus/approvalを直ちに無効化しない移行規則としてPRC-007 v0.3.1とIDX-001 v0.4.1をPROPOSED化し、WP-9002 `legacy SSOT frontmatter migration`をWP-9001 landing後の未完了taskとして追加した。metadata migrationは本文/status/approval/effective semantics不変、wave単位、body identity/index同期を必須とし、本文・human/safety/evidence判断は別WPへ分離する。
- independent_verifier、spec_guardian、medical_safety/privacy/security reviewsに加え、data_integrity_auditorもAPPROVED。data-integrity evidenceはindependent inventory 173/142、legacy semantics/body/status/approval/effective preservation、AGT 17件のbody/status/23-field、validation gates PASSである。PRC-007 v0.3.1 / IDX-001 v0.4.1をAPPROVEDへfinalizeし、AGT-018 `approved_by`へdata_integrity approvalをmetadata-onlyで追記した。
- final approval metadata validationは`pnpm check:ssot-index`(173)、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check`、inventory 173/142、PRC-007/IDX APPROVED metadata、AGT-018 data-integrity approval、legacy AGT 17件のbody/status/23-field、status/claims audit、code/package/lock差分なしがすべてPASS。
- exact-stage landing commit `86be6b1` (`WP-9001: switch repository governance to Codex only`) は `origin/main` へ `86fa45c..86be6b1` としてpush済み。post-rebase suiteは全workspace typecheck/build、audit 173、API 161 + `TEST_DATABASE_URL`不在によるexpected integration skip 9、web 63、その他全workspace test、OpenAPI、calculation purity、SSOT index 173、script harness、secrets、boundaries、diff checkがPASS、dependency auditはhigh=0 / critical=0、SBOMは231 components。governance/data-integrity reviewsも`APPROVED`であり、WP statusを`DONE`、landing stateを`LANDED`、本entryを`COMPLETE`とする。
- landing対象はgovernance/SSOT文書だけで、apps/packages/scripts/migrations/package/lock、DB data、external system、deployの変更・操作はない。WP-9002は未着手のまま、本ledger更新landing後の次のeligible governance taskとする。

### WP-4075 reception patient identity single-source enforcement

- WP-4074 landing後のself-scanで、受付create内部入力が requested `patientId` と `patient.patientId` の二重identityを持ち、in-memory/PostgreSQLとも保存IDとresponse属性を別々の入力から構成することを確認。`patient-requested-001` と別snapshot `patient-other-999` のdirect createが成功し、後者のID/属性を返す再現を得た。cross-tenant auth bypassではないが、faulty/future lookup adapterでwrong-patient表示・保存混在を起こす HIGH medical/data-integrity risk。
- historical fable5 `PLAN_APPROVED`のmandatory pinに従い、scoped lookup結果の`patient.patientId`とrequest patientIdをstrict equalityで検証。不一致はreception repositoryを呼ばず、ID・氏名・カナ・患者番号を含まない固定errorの500でfail-closedに停止する。`ReceptionCreateInput.patientId`を削除し、両repositoryの永続ID/idempotency比較/responseは検証済みpatient snapshotの単一IDだけから導出する。SQL text、contract/OpenAPI、DB migration/schema、package/lockは不変更。このapproval名はsuperseded routingのprovenanceである。
- malicious lookup route testは別ID snapshotでcreate 0 call、500固定error、request/returned ID・name/kana/patientNumber非露出を固定。PostgreSQL integrationにcreated response IDとlookup snapshot IDの一致assertを追加した。検証はAPI 87 PASS + PostgreSQL integration 5 expected SKIP、全workspace typecheck/test/build、`pnpm check:openapi`、`pnpm check:boundaries`、`pnpm check:secrets`、`pnpm check:deps`(high=0 / critical=0)、`pnpm check:sbom`(231 components)、`pnpm test:scripts`、`git diff --check`がPASS。historical read-only Opus final review `APPROVED`はsuperseded routingのprovenanceとしてのみ保持する。AGT-018でのcurrent completion evidenceはindependent Codex verifier、medical safety/data-integrity reviewer、privacy reviewerの`APPROVED`、blocker/HIGH findingなしである。`TEST_DATABASE_URL`不在のためPostgreSQL assertはlocal skip、DB操作・migration適用なし。

### WP-4074 patient search cursor authenticity/privacy hardening

- WP-7001 M1 landing後のself-scanで、API-001が不透明・非PHI・tenant/pharmacy/query拘束を要求する患者検索cursorに対し、旧実装が clear tenant/pharmacy + unsalted SHA-256(query) + offset のbase64url JSONであることを確認。cursorをdecodeしてquery候補をoffline照合でき、offsetを999へ改変・再encodeしたcursorも200で受理され空pageを返す再現を得た。既存cross-tenant/pharmacy/query checkは有効でauth bypassではない。
- historical fable5 `PLAN_APPROVED`のmandatory pinに従い、server-only `PatientSearchCursorCodec`を実装。token bodyはexact canonical `{v,o,m}`のみで、HMAC-SHA256はdomain/version/trusted tenant/pharmacy/trim済みquery/decimal offsetを4-byte BE length-prefix付きで結合する。strict outer/inner base64url、UTF-8/JSON/key順/safe-int検査とconstant-time比較を行い、legacy unsigned、offset/MAC/version/extra/noncanonical改変はgeneric `PAT-0001`で拒否する。tokenはquery/queryHash/tenant/pharmacyを保持せず、keyed HMACでqueryを隠す。同一binding/offsetの決定論的token相関可能性とunlinkabilityはAPI-001の現要件外であり、nonceは将来のSSOT/threat-model拡張へ分離した。このapproval名はsuperseded routingのprovenanceである。
- pure config resolverはenv keyをexact unpadded base64url 32-byteとして検証し、blank/malformed/noncanonicalを固定errorで拒否。key欠落時はexact development/test + explicit in-memoryだけephemeral decisionを許し、それ以外はstartup fail-closed。乱数生成はmain composition rootだけに限定し、`buildServer` はdefault/in-memory/PostgreSQLの全modeで明示注入codecがなければ同じ固定configuration errorをthrowする。BuildServerOptionsはraw keyでなくcodecを注入する。v1 rotationは旧cursor失効、overlapはTTL/kid SSOTへ分離。contract/OpenAPI/DB/package/lockは不変更。
- hard-coded synthetic v1 golden vector(key `000102...1f`、offset 42)でexact MAC `i5Em-uMH7nIgBLdC-t2wAlF7H0WG8wGuvy2lQREANk8`とouter token bytesを固定。canonical base64urlだがinvalid UTF-8の`wyg`と、golden tokenと同一decoded bytesのouter noncanonical alias末尾`...gifR`の拒否も固定した。検証はAPI 86 PASS + PostgreSQL integration 5 expected SKIP、API typecheck/build、`pnpm check:openapi`、`pnpm check:boundaries`、`pnpm check:secrets`、`git diff --check`がPASS。先行実装時の全workspace typecheck/test/build、deps、SBOM、script harnessも維持。historical read-only Opus final review `APPROVED`はsuperseded routingのprovenanceとしてのみ保持する。AGT-018でのcurrent completion evidenceはindependent Codex verifierとsecurity/privacy reviewerの`APPROVED`、blockerなしである。DB操作・migration適用・外部送信は行っていない。

### WP-7001 M1 audit intent fingerprint golden-before-write gate

- fable5 の `PLAN_APPROVED` と DB-005 v0.1.2 APPROVED に基づき、永続化writeより先に必要な M1 だけを `@yrese/audit` へ実装。`AuditAppendIntent` は trusted context の tenant/pharmacy/actor と分離し、authority/chain位置を型とruntime exact-key検証で供給不能にした。fingerprintは context + intent全フィールド(`retryCount`含む)の sorted-key canonical JSON に対する SHA-256で、`fingerprintSchemaVersion=1` はhash入力に含めず別metadataとして返し、未知versionは専用errorでfail-closedに拒否する。
- strict canonical JSON は UTF-16 key順、object `undefined` omit、`null` preserve、bigint base10、safe integer限定、wallClock UTC millisecond ISO、array順序維持・hole/undefined拒否、cycle/symbol/function/Date/非plain object拒否を固定。outer/context/intent/nestedの未知・symbol・non-enumerable・accessor propertyをdereference前に拒否し、既存 `createAuditEvent` のpure domain validationを再利用して負clock/retry、無効schema/hash/event type/target、PHIをI/O前に停止する。未知event type errorは入力値をechoしない固定文言へ変更し、runtime import cycleも解消した。
- synthetic-only golden vectorは全optional fieldを含み、canonical JSONがversionを含まないことと hash `2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745` をbyte固定。既存 `audit.test.ts` は変更せず、canonical JSONとentryHash `dcfea14c0e42f227bd98c651f8cedb1e4d86712b71625701f519245660583836` の不変を46 legacy testsで確認。independent Codex verifier/security reviewerの`APPROVED`をcurrent M1 completion evidenceとする。historical read-only Opus final review `APPROVED`はsuperseded routingのprovenanceとしてのみ保持する。
- 検証: audit 105/105 (intent fingerprint 59 + legacy audit 46)、`pnpm -r typecheck`、`pnpm -r test`、audit build、`pnpm check:boundaries`、`pnpm check:secrets`、`pnpm check:deps`、`pnpm check:sbom`、`pnpm test:scripts`、full build、`git diff --check` がPASS。local PostgreSQL integration 5件は `TEST_DATABASE_URL` 不在でexpected skip、DB操作なし。AWS SDK/package/lock、DynamoDB Local harness、adapter/persistence writeは未変更で後続laneはHOLD。

### WP-4072 SQL secret scan coverage

- fable5 の `PLAN_APPROVED` に基づき、`scripts/check-secrets.mjs` の既存 text extension allow-listへ `.sql` だけを追加。secret pattern、ignored dirs/files、same-line `secret-scan: allow`、findingにpath/line/pattern nameだけを出して値を出さないredacted output contractは変更せず、binary/生成物や未関係拡張子へ対象を広げていない。
- regression harnessは clean SQL pass、synthetic API-key assignment exit 1、SQL same-line allow pass、findingのrelative path/line/`Generic secret assignment`表示、raw synthetic value非露出を固定。fixtureは合成・非PHIで、real credentialを含まない。
- 検証: `node --check scripts/check-secrets.mjs` PASS、`node --check scripts/check-scripts.mjs` PASS、`pnpm test:scripts` PASS、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。live scanで現行migration `000001` / `000002` / `000003` もclean。独立reviewer 2名から `APPROVED` を受領した。

### WP-4073 CI PostgreSQL integration fail-open closure

- fable5 の `PLAN_APPROVED` に基づき、CI `check` jobへ official `postgres:16@sha256:be01cf82fc7dbba824acf0a82e150b4b360f3ff93c6631d7844af431e841a95c` disposable serviceを追加。digest provenance は Docker Hub official tag API endpoint `https://hub.docker.com/v2/namespaces/library/repositories/postgres/tags/16` の `digest` fieldを2026-07-10に取得し、OCI index `sha256:be01cf82fc7dbba824acf0a82e150b4b360f3ff93c6631d7844af431e841a95c` を得たもの。合成専用user/password/database、port 5432、`pg_isready` health gateを設定し、`TEST_DATABASE_URL` は Test stepだけへ注入する。interim CI PostgreSQL 16はtest runtime限定で、production Aurora majorは別途SSOT_UPDATE対象として推測・流用しない。
- test-only `resolveTestDatabaseUrl()` を両PostgreSQL integration fileで共有。missing/blank URLかつ `CI` exact `true` は値を含まない固定errorでmodule load時にfail-closed、local missing/blankは従来どおり明示skip、configured URLは原文を保持する。integration SQL/test semantics、migration、package/lock、prod configは変更していない。
- 検証: localでは resolver focused 3 tests、`pnpm --filter @yrese/api test` 70 PASS + PostgreSQL integration 5 expected SKIP、API typecheck、workflow YAML parse/pin/Test-step-only env assertion、`actionlint .github/workflows/ci.yml`、`pnpm test:scripts`、`pnpm check:secrets`、`pnpm check:boundaries`、`git diff --check` がPASSし、docker/`TEST_DATABASE_URL`不在のためDB接続・migration適用なし。commit `b725545` の GitHub Actions run `29052682750` は success。pinned PostgreSQL container初期化後、migration integration 2 PASS、repository integration 3 PASS、resolver 3 PASS、API 8 files / 75 tests PASS・0 skippedを確認し、後続のOpenAPI/secrets/deps/SBOM/boundaries/calculation/SSOT gatesも全てgreen。staging/prod DBへのapplyは行っていない。

### WP-4070 SBOM component version/link validation fail-closed

- fable5 の `PLAN_APPROVED` に基づき、`scripts/check-sbom.mjs` の missing/blank version `0.0.0` 合成と malformed node silent skip を廃止。workspace root / dependency node / dependency container を plain object、name/version/path を primitive nonblank string として fail-closed 検証する。明示 `0.0.0` と nonblank version 原文は semver/trim 正規化せず維持し、`unsavedDependencies` は承認どおり対象外、既知 pnpm 追加fieldは許容する。
- workspace registry は absolute root path の一意性と同名 workspace の path/version consistency を強制。`link:` は nonblank suffix、absolute node path、登録済み target、dependency key/name一致、non-link concrete target version の全条件を要求する。ただしsuffixは表示metadataとして検証するだけでpath解決せず、pnpmのabsolute `node.path`→unique registryだけをidentity authorityとした。package name は whitespace/extra `@`/slashを拒否する unscoped/scoped grammarへ限定し、component Mapは曖昧なbom-refでなくJSON pair keyを使う。workspace rootsはdependency traversal前に全件applicationとしてcanonical emitし、root順序によるlibrary降格を防止。同名同versionのnon-link dependencyはworkspace impersonationとして拒否する。同一external dependency pairの再出現はdedupeを維持。errors は raw node/name/version/link/path/resolved URL を出さない固定contextとした。
- output は全validation後にserializeし、targetと同一directoryの exclusive unique 0600 temp fileへ書いてから atomic renameする。temp write/rename failure はbest-effort cleanup後に固定errorで停止し、既存targetを保持する。regression harness は invalid package name、raw値非露出、malformed時のoutput no-create/no-overwriteに加え、nonempty directoryをtargetにしたdeterministic rename failureでsentinel保持とtemp artifact不在を固定。package/lock/CI/docs は変更していない。
- 検証: root順序正逆、非権威link suffix、workspace/external identity conflict、bom-ref境界攻撃を追加固定。`node --check scripts/check-sbom.mjs` PASS、`node --check scripts/check-scripts.mjs` PASS、`pnpm test:scripts` PASS、`pnpm check:sbom` PASS(231 components)、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4071 patientNumber tenant/pharmacy uniqueness enforcement

- fable5 の `PLAN_APPROVED` に基づき、APPROVED DOM-002 の薬局内患者番号一意性を PostgreSQL に fail-closed で反映。checksum 管理済み `000002_create_patient_and_reception_tables.sql` は SHA-256 `2910b460d2b9733904937093b399784089dbda9a444af75ac5fd498a1ae4b599` のまま変更せず、forward-only `000003_add_patient_number_scope_unique.sql` に named UNIQUE constraint `(tenant_id, pharmacy_id, patient_number)` を追加した。
- 一意性は保存済み exact 値に限定し、lower/trim/citext 等の正規化、既存重複の自動 cleanup/renumber/merge、DML、既存 `patients_search_idx` の削除は行っていない。既存 index は検索互換性を優先して明示的に保持する。legacy 重複がある環境では constraint 構築が SQLSTATE 23505 で失敗し、migration runner の既存 transaction により constraint/history 書込とも rollback、legacy rows は不変となる。
- static tests は `000002` checksum、`000003` の loader forward order、exact 3-column constraint、DML/normalization/index drop 不在を固定。disposable schema 専用 integration tests は同一 tenant+pharmacy+exact patientNumber の重複を constraint 名付き SQLSTATE 23505 で拒否し、tenant/pharmacy 越えの同値、case/whitespace variant、scoped search、legacy 重複時の rollback/history/rows不変を固定した。
- 検証: focused static 10 PASS + PostgreSQL integration 5 SKIP、`pnpm --filter @yrese/api test` 67 PASS + 5 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。`TEST_DATABASE_URL` 不在のため PostgreSQL integration は明示 skip。migration 適用や既存/dev/prod DB への DDL/DML は実行していない。

### WP-4068 event/audit ISO instant calendar validation

- fable5 の `PLAN_APPROVED` に基づき、`@yrese/events` に共有 `assertIsoInstant` を追加。primitive string / non-empty を明示検証し、既存の timezone 必須・任意長 year・offset・fraction の lexical semantics を維持しつつ、文字列から年月日を捕捉して proleptic Gregorian calendar 上の実在日を fail-closed に検証する。任意長 year は全体を数値化せず、400年周期に必要な末尾4桁のみで閏年を判定する。
- event envelope は検証済み `wallClock` の原文を保持する。`@yrese/audit` は重複していた ISO regex を削除し、文字列入力を共有 validator へ通してから既存の `Date` offset→UTC 正規化を実行する。Date 入力 branch と canonicalization、既存 audit golden hash は変更していない。
- tests は非閏年2026/2023/1900年の2月29日、2月30/31日、4月31日を Z/offset 入力で拒否し、2028/2024/2000年の leap day、任意長 year、events の原文保持、audit の valid leap offset 正規化を固定。null / undefined / boxed String / `toString` object の暗黙文字列化も拒否する。検証: `pnpm --filter @yrese/events test` PASS(45)、events typecheck/build PASS、`pnpm --filter @yrese/audit test` PASS(46)、audit typecheck/build PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。

### WP-4069 dependency audit report fail-closed validation

- fable5 の `PLAN_APPROVED` に基づき、dependency audit gate の malformed/partial/error-only JSON false-pass と、parseable stdout 時の pnpm nonzero status 見落としを修正。`metadata.vulnerabilities` は plain object、info/low/moderate/high/critical はすべて finite な非負 safe integer を必須とし、error field・欠落・文字列・負数・小数・unsafe integer は fail-closed にした。
- live command は spawn error・signal・exit status を必ず評価し、検証済み0件かつ status=0 の場合だけ pass とする。registry/network の warn-only は具体的な pnpm/system error code に限定し、generic な `registry` / `network` / `socket` / `timeout` 文言は例外扱いしない。既存 HIGH/CRITICAL threshold と `--from-audit-json` / `--from-audit-error` fixture mode は維持した。
- `scripts/check-scripts.mjs` は clean、HIGH/CRITICAL、malformed shape/count matrix、明示 outage、generic near miss、偽 `pnpm` の parseable clean JSON + exit 23 を固定。検証: `pnpm test:scripts` PASS、元の `{}` / error-only / invalid-string reproduction は全て exit 1、`pnpm check:deps` PASS(high=0, critical=0)、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4067 web API transport fail-closed + same-origin dev routing

- fable5 の `PLAN_APPROVED` に基づき、患者検索・受付一覧・受付登録の API endpoint 解決を `apps/web/app/api-transport.ts` へ集約。明示された HTTP(S) / 安全な root-relative base のみ許可し、production/test/staging/undefined で base が欠落・空・不正なら、設定値・患者検索語・患者IDを含まない固定エラーで `fetch` 前に停止する。
- development の未設定時だけ `/_yrese-api` を同一オリジン base として返し、Next rewrite で `127.0.0.1:3001` へ転送する。rewrite 自体も `NODE_ENV=development` のみ生成し、production/test/staging では internal-loopback proxy route を公開しない。broad CORS、apps/api、WP-4066 auth semantics、WP-4065 dev-only least-privilege headers は変更していない。
- tests は resolver environment matrix、unsafe base 拒否、production 設定欠落時の患者検索/受付一覧/受付登録の zero fetch、エラーへの query/患者ID 非露出、3操作の same-origin URL、rewrite の development-only matrixを固定。検証: `pnpm --filter @yrese/web test` PASS(63)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web build` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4066 dev tenant context explicit opt-in — completed / HIGH review APPROVED

- fable5 の `PLAN_ADJUSTMENT_APPROVED` に基づき、caller-controlled dev tenant headers を composition root の明示 opt-in なしでは一切 trusted context にしない deny-by-default 境界を実装。tenant context plugin から `process.env` 参照を除去し、常時 `tenantContext=undefined` を decorate、明示 `dev_headers` mode の場合だけ header hook を登録する。
- config resolver は parsed DB URL / resolved repository mode を受け、flag exact true + environment exact development/test + repository exact in_memory + parsed DB URL absent の全条件でのみ `dev_headers` を返す。absent / exact false は disabled、malformed flag と undefined/staging/Production/typo/production/PostgreSQL/DB URLありは入力値を含まない固定 startup errorで拒否する。
- `buildServer()` は既定 disabled とし、`dev_headers` + explicit in_memory 以外を Fastify construction 前に拒否。`main.ts` は repository mode と tenant mode を一度ずつ解決して両 repository 経路へ渡し、API dev script は必要な環境変数を明示した。OIDC・audit event・permission semantics・DB操作は変更していない。
- テストは既存の header/permission security cases を explicit dev helper で維持し、default server に attacker-selected headers を送った患者検索・受付一覧・受付登録が全て403、患者 repository search/findById と受付 repository list/create が全て0 callであることを追加固定。検証: focused config/server 53 tests PASS、API全体65 tests PASS + PostgreSQL integration 3 tests expected SKIP(`TEST_DATABASE_URL`不在)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。
- commit `137315d` に対する fable5/Opus 4.8 の `REVIEW_RESULT: APPROVED` と GitHub CI green を確認し、WP-4066 を完了。残る外部 deployment black-box verification は deployment gate として維持し、コード完了の blocker とはしない。

### WP-7001 Phase 1 DynamoDB persistence foundation — AGT-018 RE-PLAN / implementation HOLD

- 旧運用下でWP-7001のtechnical planが承認された履歴をprovenanceとして保持する。persistence adapterは`apps/api` server-only、AWS SDK importはadapter層限定、最初の集約はFHIR Patientを推測実装せずsynthetic-only `AuditAppendStore`とする。DynamoDB Local harnessの限界、trusted context由来authority、PHI非露出のpinは継続するが、これを後続workのcurrent approvalとして扱わない。
- decision A/B/C は全て承認済み。A=`SEQ#` zero-pad width 20 / uint64範囲 / overflow事前拒否。B=app-local verification が連番・dedupe・TIP整合を検証し、hash continuity は audit core に委譲。C=同一 eventId + 同一 logical intent は冪等成功、異なる intent は hard conflict。同時に event/dedupe/TIP の tenant-scoped同一PK・別SKと、retry loop 外で一度だけ生成する stable eventId を確認した。
- 必須制約は adapter 層以外への AWS import 禁止、同一 item の ConditionCheck+Update 禁止、監査 dedupe guard + tip 採番 sequence、TTL/物理削除禁止、per-request tenant scope、PHI のキー/GSI/ログ非露出、PostgreSQL 正本の段階移行維持。`AuditWriteContext` の trusted tenant/pharmacy/user だけから scope を再構成し、caller intent に authority/prevHash/sequence を持たせない。
- 実装着手条件の(a) WP-4066 landingは充足済み。残る条件は(b) DB-005 §6/§10 pinがAPPROVED SSOTへ反映・landing済みであることの確認。確認後もCodex rootがread-only mapper/pre-plan reviewer、independent verifier、DB/security/privacy specialists、必要なhuman infrastructure gateをcurrent WPへ定義するまでimplementation HOLDとする。AWS SDK/package/DynamoDB Local/adapter codeは未変更。

### WP-4065 dev tenant header least-privilege split

- fable5 から `WP-4065(dev tenant header least-privilege split)` の `PLAN_APPROVED` を受領。dev-only・frontend-only だが auth/security hygiene のため `[risk: HIGH]` handoff 対象として扱い、スコープを `apps/web` と focused tests に限定。API認可plugin・DB・SSOT本文・contract shape は変更なし。
- `devTenantHeaders()` を shared-kernel の `permissionScope()` / `PermissionScope` に結び、既定の患者検索 request は `patient:read` のみを送るように変更。production/test/undefined では引き続き `{}` を返し、本番境界は緩めていない。
- 受付ダッシュボードは queue fetch を `reception:read,patient:read`、create request を `reception:write,patient:read` に分割。dev stub で過剰権限を前提にした UI 側 permission drift が見えるようにした。
- focused tests で患者検索・受付一覧・受付登録それぞれの `x-dev-scopes` を固定し、dev-only gating の既存テストも維持。検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4065 dev tenant header least-privilege split plan request

- agmsg inbox 空、monitor は `yrese/codex` alive。Claude 側 dirty の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は引き続き温存。
- self-scan で `apps/web/app/patients/patient-search.tsx` の `devTenantHeaders()` が development 限定ながら全 request に `patient:read,reception:read,reception:write` を送っており、患者検索・受付一覧・受付登録の必要scopeと比べて過剰である点を確認。
- auth/security 境界に触れるため即実装せず、Claude へ `CODEX_PLAN_REQUEST [risk: HIGH]` を送信。想定は frontend-only で操作別の最小 `x-dev-scopes` に分割し、API認可plugin・DB・SSOT本文・contract shape は変更しない。
- `Plans.md` に WP-4065 を未完了の承認待ち候補として登録。検証: `git diff --check` のみ(ledger update)。

### WP-4055 / WP-4058 DB migration runner fail-closed hardening

- fable5 から `WP-4055 + WP-4058(bundle)` の `PLAN_APPROVED` を受領。DB runner 領域のため HIGH risk とし、スコープを `apps/api/src/db/migrations.ts` と focused unit test のみに限定。Claude 側 dirty の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は温存。
- WP-4055: `loadMigrationFiles()` の silent filter を廃止し、migration directory entry を先に分類するように変更。`NNNNNN_snake_case.sql` は読み込み、`README.md` / `.gitkeep` / `.DS_Store` は明示 allowlist で無視し、それ以外の不正/typo/大文字/backup系 entry はファイル名付きで fail-closed に throw する。既存の SQL 内容・checksum・version sort・duplicate version semantics は変更なし。
- WP-4058: `defaultMigrationsDirectory()` を `process.cwd()` 依存から `import.meta.url` 由来の repo root anchor へ変更。`pnpm --filter @yrese/api` や任意 cwd から呼んでも root `migrations/` を解決する。明示 `migrationsDirectory` 引数は従来どおり尊重。
- focused test: valid migrations の version sort/checksum、allowlist file ignore、不正 migration-like file の throw、`process.chdir()` 後の cwd 非依存 default path を追加。
- 検証: `pnpm --filter @yrese/api exec vitest run src/db/migrations.test.ts` PASS(7)、`pnpm --filter @yrese/api test` PASS(60 + 3 SKIP)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4064 PatientSearch runner lazy initialization

- WP-4063 handoff後も agmsg inbox は空。dev tenant scope の最小化候補は auth/security 境界に触れるため即実装せず、純粋な Web 内部初期化の self-scan を優先。
- `apps/web/app/patients/patient-search.tsx` の `useRef(createSearchRunner(fetchSearch, setState))` は render ごとに初期値式を評価し、最初の runner 以外に未使用の runner closure を生成しうる点を確認。
- `runnerRef` を `null` 初期化し、初回 render 時だけ `createSearchRunner()` を代入する lazy ref に変更。検索 runner 内の generation guard の所有者が明確になり、表示・API・契約shapeは不変更。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4063 web display label exhaustiveness tightening

- WP-4062 handoff後も agmsg inbox は空。DB runner の高リスク PLAN_REQUEST は承認待ちのため、Web表示型の低リスク self-scan を継続。
- 性別ラベル(`PatientSearch` / `PatientHeader`)と処方箋受付区分ラベル(`ReceptionDashboard`)が現行値は満たす一方、契約/props union に対する明示的な `Record<..., string>` 網羅性を持っていない点を検出。
- `SEX_LABELS` を `PatientSearchResult["sex"]` / `PatientHeaderProps["sex"]` に、`PRESCRIPTION_INTAKE_LABELS` を `ReceptionQueueEntry["prescriptionIntakeType"]` に結び、将来の値追加時に typecheck が未対応ラベルを検出できるようにした。表示文言・DOM・契約shapeは不変更。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4062 frontend error code registry filtering

- agmsg inbox 空、DB-005/DB設計の Claude 側 dirty 差分(`docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md`)は触らず、frontend-only self-scan を継続。
- `apps/web/app/patients/patient-search.tsx` と `apps/web/app/reception-dashboard.tsx` が API body の `errorCode` を形式チェックだけで表示対象にしており、`packages/contracts/src/error.ts` の登録済み registry 制約と drift している点を検出。
- `apps/web/app/components/error-code.ts` に `registeredErrorCodeOrUndefined()` を追加し、shared-kernel の `createKernelErrorCodeRegistry()` に登録済みのコードだけを `ErrorNotice` へ渡すように統一。患者検索・受付画面の API error parsing を更新し、`SYSTEM-9999` のような未登録コードを表示しないテストを追加。
- 検証: `pnpm --filter @yrese/web test` PASS(37)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4061 ReceptionDashboard queue stale response guard

- agmsg inbox 空のため、DB/SSOT/docs/database に触れない frontend-only self-scan を継続。
- `apps/web/app/reception-dashboard.tsx` の受付一覧 `load()` が generation guard を持たず、連続した日付表示で古い応答・古い失敗が後続の日付表示を上書きしうる点を検出。
- `createReceptionQueueRunner()` を追加し、最新ロードだけが `QueueState` を更新できるようにした。`ReceptionDashboard` は runner を `useRef` で保持し、既存の API 契約・表示構造は変更していない。web test で stale success / stale failure の破棄を固定。
- 検証: `pnpm --filter @yrese/web test` PASS(36)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4060 ReceptionDashboard acceptedAt clock display JST pin

- agmsg inbox 空、`yrese/codex` monitor alive、`main` は `origin/main` と同期済みから再開。DB-005 関連の `docs/ssot_index.md` / `docs/database/dynamodb_single_table_design.md` は Claude 側 dirty として触らない。
- self-scan で `apps/web/app/reception-dashboard.tsx` の受付時刻表示が `acceptedAt` UTC instant をホスト/ブラウザ timezone 依存で表示している点を検出。受付業務日付は WP-4053 で JST 固定済みのため、時刻表示も `Asia/Tokyo` 明示へ寄せた。
- `formatAcceptedTime()` を `Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" })` に変更し、UTC 20:15 が JST 05:15 として表示されるテストを追加。契約・DB・SSOT本文は変更なし。
- 検証: `pnpm --filter @yrese/web test` PASS(34)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-2003 audit skeleton ledger closure

- DB-005 commit_request 待ちの interim として、上部一覧に残っていた WP-2003 の未完了表示を再確認。
- `@yrese/audit` は audit event registry / AuditEvent envelope / targetRef・outcome・businessReason・hash field guard を実装済みで、WP-2003 opus4.8 事後レビューも APPROVED 済み。LOW 指摘の否定テスト補強は WP-4024 で反映済み。
- `Plans.md` 上部の WP-2003 を完了済みに更新。hash-chain 計算/永続化は既存どおり WP-2009 / WP-5004 に残し、コード・SSOT本文・docs/database には触れていない。
- 検証: `pnpm --filter @yrese/audit test` PASS(41)、`pnpm --filter @yrese/audit typecheck` PASS、`pnpm check:boundaries` PASS。

### WP-4037/4038/4041 PatientSearch hardening closure

- DB-005 commit_request 待ちの interim として、SSOT/DB migration/docs/database に触れない patient search backlog の重複状態を再確認。
- 現行 `apps/web/app/patients/patient-search.tsx` は `createSearchRunner()` の generation guard で stale success / stale failure / stale append を破棄し、`devTenantHeaders()` は development 以外で dev tenant headers を送らない。資格状態表示は `PatientHeader` の `ELIGIBILITY_LABELS` を再利用し、PatientSearch 側の安全文言二重実装はない。
- `apps/web/app/patients/patient-search.test.tsx` は WP-4037 / WP-4038 / WP-4041 の該当挙動を個別テストで固定済み。`Plans.md` の未完了候補を現行実装で解消済みに更新。コード変更なし。
- 検証: `pnpm --filter @yrese/web test` PASS(33)、`pnpm --filter @yrese/web typecheck` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4023 PatientHeader eligibility status type convergence

- DB-005 commit_request 待ちの interim として、既存 backlog のうち SSOT/DB migration に触れない WP-4023 を実施。
- `apps/web/app/components/patient-header.tsx` の `EligibilityDisplayStatus` ローカル union を削除し、`@yrese/contracts` の `EligibilityStatus` alias へ変更。資格状態の値集合は contracts/shared-kernel 正本、表示文言は引き続き web の `ELIGIBILITY_LABELS` が唯一の正。
- 検証: `pnpm --filter @yrese/web typecheck` PASS、`pnpm --filter @yrese/web test` PASS(33)、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-4042 /whoami contract and OpenAPI coverage decision closure

- self-scan で WP-4042 の現状を再確認。現行 `@yrese/contracts` は `whoamiResponseSchema` / `WhoamiResponse` を持ち、`packages/contracts/src/index.ts` から export 済み。`apps/api/src/server.ts` の `/whoami` は `whoamiResponseSchema.parse()` を通して返す。
- `packages/contracts/src/openapi.ts` と generated `docs/api/openapi.yaml` に `/whoami` / `WhoamiResponse` が含まれることを確認。route print でも `/whoami` が登録済み。
- `Plans.md` の WP-4042 を現行実装で解消済みに更新。コード変更なし。
- 検証: `pnpm --filter @yrese/contracts test` PASS(66)、`pnpm check:openapi` PASS、`pnpm --filter @yrese/api exec tsx -e ...server.printRoutes()` PASS、`git diff --check` PASS。

### WP-4059 PostgreSQL reception integration test load-bearing narrowing

- agmsg inbox 空、HEAD=origin/main=`c8ec0df`、worktree clean から再開。Claude へ、返信待ちの間は SSOT/DB migration 方針に触れない test-only WP-4059 を読む旨を通知。
- `apps/api/src/db/postgres-repositories.integration.test.ts` の受付冪等性ケースに `expectReceptionEntryResult()` helper を追加。`created` / `existing` を期待する場面で `idempotency_conflict` や別 kind が返った場合は即時 throw し、entry 比較から型上の逃げ道を削除した。
- 実装コード・migration・契約・SSOT本文は変更なし。`TEST_DATABASE_URL` 不在時は PostgreSQL 統合テスト本体が skip されるため、型検査で narrowing が成立することを検証の中心にした。
- 検証: `pnpm --filter @yrese/api typecheck` PASS、`pnpm --filter @yrese/api test` PASS(53 PASS + 3 SKIP)、`git diff --check` PASS。

### WP-6003 pure core AWS boundary non-static import regression coverage

- agmsg で WP-6001 REVIEW_RESULT(CHANGES_REQUIRED、formalize は fable5 側)と WP-6002 の位置づけを再確認。WP-6002 は `c18d50d` で push 済み、inbox は空、monitor bridge は `yrese/codex` alive、worktree clean から再開。
- self-scan で、WP-6002 の checker 本体は `require()` / dynamic `import()` / `export ... from` も抽出する一方、回帰 fixture は static import 中心であることを確認。純粋コアへの AWS/DynamoDB 混入を non-static 経路でも固定する scripts-only 追補として WP-6003 を追加。
- 実装: `scripts/check-scripts.mjs` に pure core `trace` fixture を追加し、`require('aws-sdk')`、`import('@aws-sdk/client-dynamodb')`、`export * from 'dynamodb-toolbox'` が `check-boundaries` で拒否されることを固定。アプリ本体・SSOT本文・WP-6001 proposal は変更なし。
- 台帳: `Plans.md` に WP-6001 / WP-6002 の現状と WP-6003 の完了を追記。
- 検証: `pnpm test:scripts` PASS、`pnpm check:boundaries` PASS、`pnpm check:secrets` PASS、`git diff --check` PASS。

### WP-4056 API repository mode explicitness and in-memory startup guard

- fable5 PLAN_APPROVED に基づき、API 起動時の暗黙 in-memory fallback を廃止する方針で実装中。`YRESE_API_REPOSITORY_MODE` を明示 repository mode とし、許可値は `postgres` / `in_memory` のみ。`DATABASE_URL` がある場合は `postgres`、`DATABASE_URL` 不在時は `YRESE_API_REPOSITORY_MODE=in_memory` の明示がある場合だけ in-memory 起動を許可する。
- `YRESE_API_REPOSITORY_MODE=in_memory` は `NODE_ENV=production` で起動拒否。未知の mode、`postgres` 明示かつ `DATABASE_URL` 不在、`in_memory` 明示かつ `DATABASE_URL` ありは fail-closed。
- dev 起動は `pnpm --filter @yrese/api dev` が `YRESE_API_REPOSITORY_MODE=in_memory tsx src/main.ts` を使うため、開発時は明示 in-memory mode で起動する。永続化期待環境では `DATABASE_URL` を設定して PostgreSQL repository を使う。
- 検証: `pnpm --filter @yrese/api test` 53 PASS + 3 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm -r typecheck` PASS、`pnpm check:boundaries` PASS、`pnpm test` PASS。`pnpm --filter @yrese/api dev` は明示 `YRESE_API_REPOSITORY_MODE=in_memory` 経由で起動開始を確認し、確認後に停止。

### WP-1101 DOM-001..004 APPROVED 昇格と opus4.8 指摘是正

- Claude側 fable5 から commit_request を受領し、対象7文書のみを stage して `99e84c2` として commit/push。対象は `docs/domain/bounded_contexts.md`、`docs/domain/domain_model.md`、`docs/domain/ubiquitous_language.md`、`docs/domain/state_transition.md`、`docs/modules/shared_type_registry.md`、`docs/modules/status_registry.md`、`docs/ssot_index.md`。
- DOM-001〜004 を APPROVED へ昇格。DOM-002 に Reception 集約を追加し、branded ID は実装済み12種(ReceptionId含む)へ同期。Reception の冪等性境界は API-006 を正本として再定義しない方針に整理。
- DOM-001 は C8 Billing の独立維持(ACC-001〜011 が正本)を明記し、C12/C13 の正本参照を補強。DOM-003 は受付用語と DOM-004 状態名(RECEIVED_PROVISIONAL / IMPORTED_PROVISIONAL)を統一。DOM-004 は受付キュー副状態機械(RECEPTION_STATUSES)とライフサイクル状態所有権を追記。
- MOD-004(shared_type_registry)を 0.1.2 へ、MOD-005(status_registry)を 0.1.4 へ改版し、DOM昇格に伴う共有型・状態台帳のdriftを是正。`docs/ssot_index.md` は168文書で再生成済み。
- 検証: `git diff --check` PASS、`pnpm check:ssot-index` PASS、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`pnpm check:calculation-purity` PASS、`pnpm test:scripts` PASS、`pnpm check:deps` PASS、`pnpm check:openapi` PASS、`pnpm check:sbom` PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS、`pnpm build` PASS、`pnpm lint` PASS。

## 2026-07-09(続き)

### WP-5003 患者・受付 Repository DB 実装差し替え

- fable5 PLAN_APPROVED に基づき、`docs/domain` と `docs/modules` の MOD-004/005 には触れず実装。`ELIGIBILITY_STATUSES` は contracts ローカル tuple から shared-kernel 正本へ移し、`RECEPTION_STATUSES` と同じくDB CHECK値源として扱う。`scripts/check-boundaries.mjs` / `check-scripts.mjs` も正本移動に合わせて更新。
- DB migration: `migrations/000002_create_patient_and_reception_tables.sql` を追加。`patients` / `reception_entries` は DB-001 規約どおり tenant_id + pharmacy_id を必須化。`accepted_at` は TIMESTAMPTZ、`business_date` は DATE。`reception_entries` は `(tenant_id, pharmacy_id, idempotency_key)` unique、queue index は `(tenant_id, pharmacy_id, business_date, accepted_at, reception_id)`。監査・会計・イベント系 append-only テーブルは未作成(WP-5004/5005へ分離)。
- DB Repository: `PostgresPatientRepository` / `PostgresReceptionRepository` を追加。既存 interface は不変、in-memory は既定維持。`DATABASE_URL` 設定時のみ API 起動時の schema check 後に PostgreSQL 実装を注入し、startup check は引き続き自動適用なし。
- テスト: migration DDL の CHECK 値が shared-kernel tuple と一致すること、PostgreSQL 統合テスト(TEST_DATABASE_URL gate)で patient search/find、tenant/pharmacy不可視、reception create/list、冪等再送 existing、idempotency conflict、JST business_date、accepted_at+reception_id 安定順序を検証するテストを追加。ローカル環境では `TEST_DATABASE_URL`・`docker`・`psql` が不在のため実DB統合は明示 skip。
- 検証: `pnpm --filter @yrese/api test` 48 PASS + PostgreSQL integration 3 SKIP、`pnpm --filter @yrese/api typecheck` PASS、`pnpm --filter @yrese/contracts test` 66 PASS、`pnpm --filter @yrese/shared-kernel test` 23 PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS、`pnpm build` PASS、`pnpm check:openapi` PASS、`pnpm check:ssot-index` PASS、`pnpm check:secrets` PASS、`pnpm check:boundaries` PASS、`pnpm test:scripts` PASS、`pnpm lint` PASS、`pnpm check:deps` PASS、`pnpm check:sbom` PASS、`pnpm check:calculation-purity` PASS、`git diff --check` PASS。

### WP-5002 開発 PostgreSQL + マイグレーション基盤

- fable5 PLAN_APPROVED に基づき、既製 migration tool ではなく repo-local forward-only SQL runner + `pg` を採用。DB-002 の3分類照合(前方互換な DB 先行は許容 / checksum相違・未適用要求は起動拒否)を直接実装し、起動時は照合のみで自動適用しない方針にした。
- 実装: `compose.yaml` に dev PostgreSQL(`127.0.0.1:55432`)を追加し、PHI/PII/本番薬局データ投入禁止をコメントで明示。`migrations/000001_create_schema_migrations.sql` は履歴テーブルのみで、業務テーブルは WP-5003 以降へ分離。
- `apps/api/src/db/**` に migration loader、checksum、state reconciliation、explicit apply CLI(`pnpm db:migrate`)、startup check CLI(`pnpm db:check`)を追加。`DATABASE_URL` がある API 起動時は `assertMigrationStateAllowsStartup` のみ実行し、未適用 migration は fail-closed にする。
- 既存 `BuildServerOptions` の `patientRepository` / `receptionRepository` injection seam を維持し、既存テストは in-memory 既定のまま。PostgreSQL 統合テストは `TEST_DATABASE_URL` 不在時に skip 名を表示する `describe.skip` にし、silent pass にしない。
- 検証: `pnpm --filter @yrese/api test` 47 PASS + PostgreSQL integration 1 SKIP(`TEST_DATABASE_URL` 不在)、`pnpm --filter @yrese/api typecheck` PASS、`pnpm -r typecheck` PASS、`pnpm -r test` PASS(全体 47+1 skip を含む)、`pnpm build` PASS、`pnpm check:openapi` PASS、`pnpm check:secrets` PASS、`pnpm check:deps` PASS、`pnpm check:sbom` PASS、`pnpm check:boundaries` PASS、`pnpm check:ssot-index` PASS、`pnpm check:calculation-purity` PASS、`pnpm test:scripts` PASS、`git diff --check` PASS。`docker` CLI 不在のため compose 起動と実 PostgreSQL 統合テストは未実行。

### WP-4046 API ID wire-field validation policy

- fable5 裁定: wire ID は素の string を維持しつつ、受付系と同じ検証水準(非空・空白のみ拒否・制御文字拒否・妥当な max 長)を全契約で統一。
- 実装: `@yrese/contracts` に shared-kernel branded ID factory 由来の共通 `wire-id` schema を追加。`patientSearchResultSchema.patientId`、`whoamiResponseSchema.tenantId/pharmacyId/actorId`、受付キューの `receptionId` / `patientId` を同一 helper へ寄せ、contracts ローカルの ID 規則再発明を避けた。
- API-001 / API-006 / MOD-012 / MOD-001 を改版。OpenAPI には対象 ID field の `maxLength: 128` を generator 経由で反映。wire shape は string のまま変更なし。
- 検証: `pnpm --filter @yrese/contracts test` 66 tests PASS、`pnpm --filter @yrese/contracts typecheck` PASS、`pnpm --filter @yrese/api test` 40 tests PASS、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:openapi` PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`pnpm -r typecheck` PASS、`git diff --check` PASS。

### WP-4053 reception business date JST boundary

- fable5 から WP-4053-UI commit_request と WP-4053-API assign を受領。UI側は `todayAsIsoDate()` を `Asia/Tokyo` 固定にする Claude 差分を `49fb867` として commit/push 済み。
- API側実装: `apps/api/src/reception-repository.ts` の `acceptedAt` → `record.date` 導出を JST 固定の業務日付へ変更し、UTC 日付(`toISOString().slice(0,10)`)の流用を廃止。`server.test.ts` に JST 00:00〜08:59 境界(UTCでは前日)の受付がJST業務日のキューへ入るテストを追加。
- MOD-011(date_time_policy)を v0.1.1 へ改版し、業務日付は薬局ロケール(MVPでは `Asia/Tokyo` 固定)の暦日、UTC日付流用禁止を明記。
- 検証: `pnpm --filter @yrese/api test` 40 tests PASS、`pnpm --filter @yrese/api typecheck` PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`git diff --check` PASS。

### WP-5001 DB設計 SSOT パック

- Claude側 fable5 起草の DB-001〜004 を Codex 側 commit/push 対象として受領。初回 PROPOSED commit 後、opus4.8 レビュー反映により `docs/database/db_schema_design_standards.md`、`db_migration_policy.md`、`db_tenant_isolation_ddl_policy.md`、`db_retention_and_deletion_policy.md` は v0.1.1 APPROVED へ昇格。
- 要旨: DB-001 は tenant/pharmacy 必須・money/date型・enum二重実装禁止・ScaledDecimal scale保持、DB-002 は前方一方向+3段適用+明示運用操作+起動時照合3分類(前方互換な DB 先行は許容 / checksum相違・未適用要求は起動拒否)、DB-003 はテナント分離DDL/Repository方針(通常系接続でテナント越え不可を要件化、RLS採用はBLOCKED_SECURITY_REVIEWまで候補)、DB-004 は保存期間・削除方針(年限未確定は削除しない側に倒す)。
- 検証: `pnpm check:ssot-index` PASS、`git diff --check` PASS。

### WP-4052 web typecheck prebuild reproducibility

- fable5 裁定: WP-4052 は frontend/tooling 領域として Codex 実装可。clean checkout でも `pnpm --filter @yrese/web typecheck` が単独 PASS することを目的に実施。
- 実装: `apps/web/package.json` の `typecheck` を `next typegen && tsc --noEmit` へ変更。Next.js 15 の `.next/types` 生成を型検査前に実行し、`apps/web/tsconfig.json` の `.next/types/**/*.ts` include は推奨構成として維持。UIコード、webpack extensionAlias、実行時設定は不変更。
- 検証: `pnpm clean` で生成物を削除後、`pnpm --filter @yrese/web typecheck` PASS(Next route types 生成確認)、`pnpm -r typecheck` PASS、`pnpm --filter @yrese/web test` 32 tests PASS、`pnpm check:ssot-index` PASS、`pnpm check:boundaries` PASS、`pnpm build` PASS、`git diff --check` PASS。

### WP-3009 完結・commit/push 運用変更

- WP-3009 SCR-001 受付ダッシュボード実体化が完結。API-006 受付キュー契約 APPROVED(30f09a3) → backend 実装(WP-3009-BE/93aefa1: shared-kernel ReceptionId / RECEPTION_STATUSES / RCV-0001〜0003 / contracts+OpenAPI / apps/api) → frontend 実装(WP-3009-UI/8bdee8a: 受付ダッシュボード UI)の3段を完了。
- WP-4049/911e009 + follow-up 0282410 で、MOD-001/002/012 と API-006 の実装状態を受付キュー実装後の実態へ同期。要件・規律・wire 形状は不変更。fable5 レビュー APPROVED。
- 検証証跡: web 32 tests / api 39 tests / contracts 43 tests を含む `pnpm -r test` PASS、`pnpm lint` PASS、`pnpm build` PASS、`pnpm -r typecheck` PASS。初回 typecheck は build 前の `.next/types` 未生成で TS6053 失敗したため、WP-4052 として再現性改善候補を Plans.md に登録(f6581cb)。
- 運用変更(ユーザー指示 2026-07-09 / fable5通知): 以後、git commit と push は Codex 側が実行する。Claude 側の変更は `[commit_request]` として対象ファイル・commit message・検証結果を Codex へ渡し、Codex が対象ファイルのみ stage して検証後に commit & push する。Claude 側変更の commit には `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を併記する。

### データベース構築計画の立案(ユーザー指示)

- ユーザー指示3件: (1)「各種データベースの構築計画立案を開始」、(2) 医療機関・薬剤など他のマスター DB の個別台帳化、(3) 漏れの網羅確認
- `docs/plan/database_construction_plan.md`(PLAN-DB-001、PROPOSED)を起案: 種別台帳12種(業務OLTP / イベントストア / 監査 / マスター群 / Edge / 同期キュー / 検索分析 / 帳票文書 / 請求成果物 / 外部連携記録 / 認証テナント / アーカイブ法定保存)+ マスター個別台帳 M1〜M10(医薬品・一般名・点数・医療機関・医師・保険者・公費・用法・薬局内・安全性系[BLOCKED])+ 対象外3(電子薬歴=外部面 / 在庫=non-MVP / 安全性DB)
- 横断原則: アプリ層テナント分離が正 / 浮動小数点カラム禁止 / DB now() 業務使用禁止 / append-only の DDL/DCL 化 / 前方一方向マイグレーション(明示操作のみ)
- 段階計画 DB-0〜DB-5(WP-5001〜5008 を Plans.md 登録)。本番インフラ製品確定は SEC-008 §3 + 人間承認の独立ゲート
- WP-3009-BE(受付バックエンド、93aefa1)レビュー APPROVED — 全10ワークスペース 252 テスト・全ゲート PASS。WP-3009-UI(受付ダッシュボード)フォーク実行中

### WP-4019 — OpenAPI generation pipeline

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/contracts` の zod schema を正本として `zod-openapi` で OpenAPI 3.1 YAML を生成する pipeline を追加。
- 生成物は `docs/api/openapi.yaml` にコミットし、`GENERATED - DO NOT EDIT` / 手編集禁止 / 再生成コマンド / 生成ツール版をヘッダに記録。`pnpm generate:openapi` で生成、`pnpm check:openapi` で再生成ドリフトを `GENERATED_CODE_DRIFT_BLOCKED` として検出する。
- CI に OpenAPI drift check を追加し、`scripts/check-scripts.mjs` にドリフト検出の回帰テストを追加。MOD-014 `generated_code_policy.md` は v0.1.1 に改版し、OpenAPI は zod schema 正本 + `zod-openapi` 方式へ確定。generated client は未導入として分離。
- 検証予定: contracts test/typecheck、openapi generate/check、script harness、全体 typecheck/test/build、deps/sbom、boundaries、ssot-index、diff check。

### WP-4034 — calculation StepResult runtime shape guard

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/calculation` の `rule.apply()` 戻り値に runtime shape guard を追加し、型を迂回した不正 `StepResult` を曖昧な TypeError ではなく `BLOCKED` / `SSOT_UPDATE_REQUIRED` として fail-closed に返すようにした。
- probe で判明した `{ status: "SKIPPED" } as any` に加え、`ITEM_CALCULATED` の `applicationKey` 欠落、`BLOCKED` の `blocker` 欠落を否定テストで固定。warning は `算定ルール戻り値SSOT不一致(SSOT_UPDATE_REQUIRED)` に統一。
- 既存の算定ルール、点数値、正常系 trace/golden は変更なし。正常系16本を含む calculation 19テストが PASS。
- 検証: `pnpm --filter @yrese/calculation test`(19 tests PASS)、`pnpm --filter @yrese/calculation typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`pnpm check:ssot-index`、`git diff --check`。

### UI/UX 開発計画の起案(ユーザー指示)

- ユーザー指示2件: (1) UI 構築時は The Component Gallery(component.gallery)を活用する(メモリにも保存)、(2) fable5 が UI/UX の今後の開発計画を緻密に立案する
- `docs/plan/uiux_development_plan.md`(PLAN-UIUX-001、PROPOSED)を起案: UIX-001〜007 と画面台帳 SCR-001〜029 を基に Phase UI-1(デザイン基盤)〜UI-6(請求線)の6波を定義。契約 SSOT なしに画面を作らない fail-closed 発行条件、U4 画面の opus4.8 医療安全レビュー必須、component.gallery 参照規律を組込み
- Plans.md に WP-3006〜3021 を登録。第1弾は WP-3006(トークン+状態コンポーネント)/ WP-3007(SCR-013 横断表示)/ WP-3011(trace ビューア)
- codex: WP-4033(money RoundingMode ガード、ef978d4)/ WP-4022(date-time nominal brand、6f04722)いずれもレビュー APPROVED(money 12・date-time 8 テスト、全 typecheck PASS)

### WP-4022 — date-time clinical wrapper nominal brands

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/date-time` の PrescriptionDate / DispensingDate / ReceptionDate を nominal brand 化し、異種ラッパーの `compare()` / `equals()` と代入を型で拒否するようにした。
- 実行時挙動は維持。既存コード調査では本番側に意図的な異種ラッパー比較はなく、旧テスト内の異種比較だけを同種比較+`@ts-expect-error` 型テストへ置換。
- MOD-004 `shared_type_registry.md` を v0.1.1 へ改版し、日付ラッパー nominal brand の open question を解消済みに移動。
- 検証: `pnpm --filter @yrese/date-time test`(8 tests PASS)、`pnpm --filter @yrese/date-time typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`pnpm check:ssot-index`、`git diff --check`。

### WP-4033 — @yrese/money RoundOptions.mode runtime guard

- fable5 PLAN_APPROVED 後に codex 実装。MOD-010 の RoundingMode 7種と一致する `ROUNDING_MODES` const tuple を追加し、`RoundingMode` 型を tuple から派生させて runtime allow-list と型の値源を単一化。
- `ScaledDecimal.round()` で `options.mode` を明示検証し、`invalid_mode` や `mode` 欠落は `RangeError` で fail-closed。既存の丸め結果・政策値/evidence 規律は変更なし。
- 既存テストで全 mode の代表値を固定済みであることを確認し、`ROUNDING_MODES` の値順と invalid/missing mode の否定テストを追加。
- 検証: `pnpm --filter @yrese/money test`(12 tests PASS)、`pnpm --filter @yrese/money typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### SSOT 第3波(WP-0046/0047)

- WP-0046: API-first platform pack — API-002(dogfooding: 自社 UI も公開 API と同一契約のみ、抜け道 API 禁止)/ API-003(公開 API 共通土台: deny-by-default・テナント境界・バージョニング。数値は BLOCKED_PERFORMANCE_SLO)/ API-004(PH-OS リファレンス連携、特別扱い API 禁止)/ API-005(OSS 公開 allow-list、実公開は BLOCKED_LEGAL_REVIEW + 人間最終承認)。全て PROPOSED
- WP-0047: SEC-008 — 監査 WORM・テナント分離戦略。論理層(append-only・SEC-007 ハッシュチェーン・偽ハッシュ供給禁止の規律化)と物理層候補(S3 Object Lock/KMS/RLS = 追加防御)を分離、break-glass は監査必須 fail-closed。PROPOSED
- ssot_index 再生成: 161文書。check:ssot-index / boundaries PASS
- codex: WP-4032(events 実行時ガード強化、d665c06)レビュー APPROVED — enum 値源を const tuple に単一化、events 31テスト PASS

### WP-4032 — EventEnvelope ID / enum runtime guard

- fable5 PLAN_APPROVED 後に codex 実装。`@yrese/events` の `SyncStatus` / `PhiClassification` / `EncryptionStatus` を既存 union literal と同じ値の exported const tuple から派生させ、runtime allow-list と型の値源を単一化。
- `createEventEnvelope()` で eventId / tenantId / pharmacyId / deviceId / actorId / causationId / correlationId / aggregateId / aggregateType / idempotencyKey の空白のみ・制御文字を拒否。`syncStatus='lost'`、`phiClassification='bad'`、`encryptionStatus='plain'` は fail-closed に拒否する否定テストを追加。
- PHI≠none→encrypted と dead-letter reason の既存不変条件は維持。
- 検証: `pnpm --filter @yrese/events test`(31 tests PASS)、`pnpm --filter @yrese/events typecheck`、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### codex autonomous scan — trace / money follow-up candidates

- agmsg 未読なしを確認後、read-only スキャンを継続。`@yrese/trace` の runtime enum/kind guard 補強候補(WP-4039)と、`@yrese/money` constructor 入力型ガード候補(WP-4040)を `Plans.md` へ登録。
- 既存の WP-4033(rounding mode guard)とは別に、trace の target/kind drift と money constructor の不明瞭 TypeError 化を後続 triage 対象に分離。
- 追加スキャンで PatientSearch の資格状態表示が PatientHeader より安全含意の弱い文言になっている点を検出し、frontend owner確認待ち候補 WP-4041 として `Plans.md` へ登録。

### SSOT 第1〜2波 opus4.8 レビュー → 一括 APPROVED(WP-0052/0053)

- opus4.8 レビュー3系統(doctrine 6 / FHIR 3 / calc・quality 9)完了。BLOCKER 1件(PRD-007 の source_registry 未記録日付)、MAJOR 5件(ARC-010 の OPS-005/009 取り違え、QUA-009 の RCP→CLM 委譲先取り違え、DOM-005 の MOD-009 誤参照、DOM-006 台帳の §7 必須フィールド欠落、新規ブロッカーコード2種の allow-list 未登録)、ほか MINOR 群
- WP-0052: 指摘を11ファイルで是正(各文書 v0.1.1 化、blockers.ts に BLOCKED_OFFICIAL_ADAPTER_BOUNDARY / BLOCKED_FHIR_CONFORMANCE_REVIEW 追加、MOD-005 status_registry 31→33種 v0.1.2)
- WP-0053: 18文書(PRD-007/008/009、ARC-003〜007/010/011、DOM-005/006、CAL-009〜011、QUA-007〜009)を APPROVED へ昇格(approved_by: opus4.8 review + fable5)。索引再生成、shared-kernel 22テスト・boundaries・ssot-index・全 typecheck PASS
- codex 並行: WP-4031 APPROVED。WP-4032〜4036 を codex が直接登録(CLAUDE.md/AGENTS.md に直接 commit&push 規定追記 f4ad019 — codex 経由のユーザー指示と報告)
- 次: WP-4032(events の PHI enum ガード優先)→ WP-4022 を codex へ。Claude 側は第3波(WP-0046/0047)起草へ

### WP-4031 — CAL-008 trace optional extension fields

- codex実装。`@yrese/trace` の `CalculationTraceStep` に CAL-008 の optional 拡張フィールド(`feeItemCode` / `formula` / `intermediateValues` / `rounding` / `stepStatus` / `resultPoints` / `resultYen`)を追加。
- 後方互換性を維持し、既存の最小 trace は変更なしで通る。`affectsClaim=true → evidenceRefs>=1` の既存不変条件は維持。`rounding.evidenceId` 必須、intermediateValues string-only/PHI-like key拒否、stepStatus enum検証、nested freeze、rounding evidenceId集約を追加。
- 検証: `pnpm --filter @yrese/trace test`(11 tests PASS)、`pnpm --filter @yrese/calculation test`(16 tests PASS)、`pnpm -r typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4029 — patient search cursor length cap

- codex実装。`@yrese/contracts` に `PATIENT_SEARCH_CURSOR_MAX_LENGTH = 512` を追加し、query cursor / response nextCursor の最大長を契約層で固定。
- API route でも長大 cursor は backend decode 前に 400 `PAT-0001` となることをテストで固定。API-001 文書へ同じ上限を追記し、fable5承認条件に従い API-001 version を 0.2.1 へ更新。
- 検証: `pnpm --filter @yrese/contracts test`(21 tests PASS)、`pnpm --filter @yrese/api test`(30 tests PASS)、contracts/api typecheck、`pnpm check:boundaries`、`git diff --check`。

### WP-4024 — audit runtime guard negative tests

- codex実装。WP-2003 opus4.8 レビューのLOW指摘に対応し、既存のauditランタイムガードを否定テストで固定。
- `targetRef` 空/制御文字/非snake_case、invalid outcome、malformed `businessReason.code`、missing `correlationId` を追加カバー。実装コード変更なし。
- 検証: `pnpm --filter @yrese/audit test`(28 tests PASS)、`pnpm --filter @yrese/audit typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4021 — dev patient search fixture alignment

- codex実装。Web側の既定DEV_HEADERS(`t-dev` / `ph-dev` / `u-dev`)を変更せず、API synthetic fixture に同じdevテナントの非PHI合成患者2件を追加。
- `/patients/search?q=合成` をWeb既定devヘッダで呼ぶroute-level APIテストを追加し、開発UIの手動確認で空結果にならないことを固定。
- 検証: `pnpm --filter @yrese/api test`(29 tests PASS)、`pnpm --filter @yrese/api typecheck`、`pnpm check:boundaries`、`git diff --check`。

### WP-4030 — dev tenant context malformed ID route tests

- codex自律バックログから実施。`apps/api/src/server.test.ts` に `/whoami` と `/patients/search` の不正 dev ID ヘッダ否定テストを追加。
- 空白 `x-dev-tenant`、制御文字入り `x-dev-pharmacy`、制御文字入り `x-dev-actor` は route 経由で 403 `AUTH-0003` となることを固定。`tenant-context` 実装は既に fail-closed のため変更なし。
- 検証: `pnpm --filter @yrese/api test`(28 tests PASS)、`pnpm --filter @yrese/api typecheck`、`pnpm check:boundaries`、`git diff --check`。

### SSOT 第1波(WP-0041/0042/0043)+ 索引整合性修復(WP-0051)

- WP-0041(6cd714e): yrese doctrine pack — PRD-008 製品ドクトリン D1〜D7 / PRD-009 4つの戦い / ARC-003 NSIPS隔離ACL / ARC-004 Legacy Adapter S3/Lambda 方針。全て PROPOSED
- WP-0042(4482e1e): FHIR canonical pack — DOM-005(canonical model ≠ FHIR、facade投影・PHI整合)/ DOM-006(マッピング台帳枠組み、Official Adapter 置換禁止 = BLOCKED_OFFICIAL_ADAPTER_BOUNDARY)。PRD-007 とセットで承認予定
- WP-0043(cc47d59): quality transparency pack — QUA-007/008/009(証明可能性4層・公開KPI前提条件・返戻率 fail-closed 集計)。外部公開実施は BLOCKED_LEGAL_REVIEW 解除まで BLOCKED
- **WP-0051: ssot_index.md に約50文書が未登録という整合性欠陥を検出**(accounting/calculation/domain/jahis/receipt/api/spec 等が Phase 0 ゲート後の索引更新漏れ)。frontmatter からの機械再生成で全148文書を索引化(IDX-001 v0.3.0)。以後、索引は手編集禁止。CI ゲート化は WP-4020(codex へアサイン予定)
- codex: WP-0050(AGENTS.md ミラー、8970be8)/ WP-4018(web test gate、b800ab2)APPROVED。自律スキャン提案 WP-4019/4021/4022 をバックログ登録
- **WP-2003 opus4.8 事後レビュー完了: APPROVED**(audit 17テスト・全10ワークスペース typecheck・boundaries 全て PASS、台帳60種別を MOD-008 と1件ずつ照合し完全一致)。LOW 2件: (1) entryHash の計算・連続性未検証は WP-2009 の範囲 — 完了まで本番配線で任意ハッシュ供給禁止を申し送り、(2) 実行時ガードの否定テスト補強 → WP-4024 として登録
- 進行中: WP-0044/0045 第2波起草フォーク、codex WP-4020(ssot_index CI ゲート)

### SSOT 第2波(WP-0044/0045)+ codex 横断ゲート群の統合

- WP-0044: calculation event-sourcing pack — CAL-009(versioned rule data、silent 変更禁止)/ CAL-010(純粋関数規律)/ CAL-011(golden test は evidence_id 由来のみ)/ ARC-005(ES は履歴が正本であるべき集約に限定、既定非適用)/ ARC-006(イベントが正本・投影は使い捨て、再算定は新イベント追記)/ ARC-007(確定レセプト append-only、訂正は返戻再請求レーン、確定は NORMAL のみ)。全て PROPOSED
- WP-0045: always-on pack — ARC-010(Cloud Core / Edge Node 役割分担、SystemMode 5態と shared-kernel 判定関数の整合)/ ARC-011(夜間バッチ廃止、月次締めは明示業務操作)。PROPOSED
- ssot_index 再生成: 156文書(IDX-001 v0.3.0 系列)。codex の WP-4020 ゲート(`pnpm check:ssot-index`)が未索引8文書を正しく検出→再生成後 PASS を確認
- codex レビュー3件 APPROVED: WP-4020(c06c913、ssot_index CI ゲート)/ WP-4025(06c3c80、health clock 注入化)/ WP-4026(2c4758c、不正 PORT fail-fast)。api 22テスト PASS で検証
- 台帳整合(WP-4027): WP-4020 完了反映。codex 提案 WP-4028(純粋関数静的検査)/ WP-4029(cursor 上限)/ WP-4030(不正 dev ヘッダ否定テスト)をバックログ登録
- 一時保留(ユーザー操作)→「続きを実行」指示で再開

### WP-4018 — web test gate strictness

- `apps/web/package.json` の `test` から `--passWithNoTests` を削除し、webテストが誤って消えた場合に成功扱いにならないようにした。
- 既存の `apps/web/app/shell-smoke.test.tsx` が実テストとして存在することを確認し、WP-3005後の退行検知ゲートを厳格化。
- 検証: `pnpm --filter @yrese/web test`, `pnpm --filter @yrese/web typecheck`, `pnpm -r test`, `pnpm check:boundaries`, `git diff --check`。

### 構築プロンプト仕様の0.2.0一本化

- WP-0049: `docs/spec/construction_prompt_baseline.md` を0.2.0正本入口へ縮約し、過去版本文・版一覧・版間優先順位規定を削除。
- `docs/spec/construction_prompt_v0.2.0.md` を唯一の正本として、SSOT駆動、Claude/Codex二系統運用、共通モジュール、会計・領収証、JAHIS、Integration Hub、Open Rececon Platform、FHIR/JP Core、24/365稼働、監査WORM等を0.2.0へ集約。
- リポジトリ全体の構築プロンプト参照を v0.2.0 へ統一し、旧プロダクト呼称を yrese へ正規化。

### 17:00〜17:10 — マイルストーン: 初の evidence 裏付け算定コード(WP-2101b)

- **Phase 0 ゲート通過**(人間承認)→ 98 SSOT 一括 APPROVED(5fa3f14)
- WP-0017: evidence 71件正式採番、算定16行 EVIDENCE_ISSUED 化(8cf3f10)
- CAL-004 算定エンジン設計: fable5起案 → opus4.8 レビュー(APPROVE_WITH_CHANGES)→ 全指摘反映+register照合訂正(EVD-CAL-0021=3剤分まで)で v0.2.1 APPROVED(24adf71)
- **WP-2101b マージ(76da0d6)**: 5ルール(調剤基本料1=47点/内服薬剤調製料=24点上限3/調剤管理料2=10点/服薬管理指導料3=45点/夜間・休日等加算=40点)、POINTS_ONLY_COPAY_BLOCKED(claimable:false型強制)、適用日ガード(2026-06-01 inclusive)、重複・上限検知、golden 16テスト。opus4.8事後レビュー(APPROVE_WITH_CHANGES→境界通過側テスト2件+canonical golden 166点を追加して解消)
- copay(一部負担金)は evidence 未発行のため BLOCKED_REGULATORY_REVIEW 維持(点→円換算・負担割合・端数処理の根拠が必要)
- WP-1101 ドメイン設計SSOT 4文書(PROPOSED、Phase 1ゲート対象)f817dc2
- codex後続: WP-4011(スクリプト回帰ハーネス)→ WP-4013(重複レジストリスキャン拡充)を発行済み

## 2026-07-09

### 16:00〜16:35 — 第4〜5波: Phase 0 文書完成・算定骨格・codex自律スキャン・ゲート報告

- SSOT完成: WP-0008(UI/UX 7)4aa6595 / WP-0009(セキュリティ 7)bcdf89f / WP-0010(運用 14)ff145ae / WP-0011(プロセス・品質 11)008baec / WP-0012(共通モジュール 14)a257598 / WP-0013(ssot_index 97文書+品質3補完+ゲート報告)79edf9a
- WP-2101a 完了: @yrese/calculation 骨格(空ruleset→BLOCKED、複数CALCULATED→SSOT_UPDATE_REQUIRED ガードをレビュー往復で追加)d26424d
- WP-0015 完了: 一次資料精読(記録条件仕様R8.6 レコード体系一式+点数表約45項目、人間ダブルチェック待ち)0ef7ab3
- codex 自律スキャン運用開始(ユーザーがcodex側へ直接指示): バックログ5+2+1件提案 → WP-1008(dead-letter不変条件)/WP-4005(CI全build)/WP-4004(lint整合)5729ea7、WP-1010(**権限スコープ検証の実バグ修正**)/WP-4006(dist衛生)e51f920、WP-2006(認可回帰テスト)/WP-1009(エラーコードシード)b5e4f22 — すべてレビュー承認済み
- kernel.test.ts のリテラル制御文字混入(codex発見・WP-1011)を修正
- **Phase 0 ゲート報告を提出(docs/plan/phase0_gate_report.md)— 人間レビュー待ち。新規 WP_ASSIGN は一時停止、codex はバックログ提案のみ継続**
- 現時点: コミット40件超、テスト66+件全パス、CI グリーン、二系統WPフロー13件完走(CHANGES_REQUESTED 2件はいずれも安全側修正)

### 15:40〜15:55 — 実装第3波: 契約基盤・境界検査・SSOT量産・公式資料確定

- WP-1007 完了: @yrese/contracts(contract-first の器。health スキーマ移設、zod v4 z.iso.datetime)codex実装・claudeレビュー、7fa369c
- WP-3004 完了: 業務ルーティングシェル(業務順ナビ+8ルート、各プレースホルダーに解除条件明記)2b195b5
- WP-0005 完了: 規制・法令SSOT 6文書 c1fbad8 / WP-0006 完了: 医療安全・スコープSSOT 7文書 ae24ae6 / WP-0007 完了: 外部境界・マスターSSOT 6文書 50f988e
- WP-4003 完了: check-boundaries(依存方向・循環・重複const検査をCIへ。違反注入検出を実証)codex実装・claudeレビュー、0213ac0
- **WP-0014 完了(重要)**: 公式資料検証 — 全10項目 CONFIRMED。令和8年度改定実在(施行R8.6.1)、記録条件仕様(調剤)R8.6版が公開中、安全管理GL第7.0版・JAHIS Ver.1.11 実在(v0.2.0 の記載が正確、f2の旧情報を訂正)。オン資外部IF・電子処方箋記録条件は ONS 限定 → WP-0016(人間作業)f166bee
- WP-2002: codex実装 → claudeレビューで CHANGES_REQUESTED(本番起動拒否のバイパスオプション allowDevTenantContextInProduction の除去を要求 — セキュリティ規律)
- 進行中フォーク: f6=WP-0015(記録条件仕様・点数表の一次精読)、f7=WP-0008(UI/UX SSOT)、f8=WP-0009(セキュリティSSOT)

### 15:30〜 — ユーザー指示: fable5 全権コントロール・公式資料検索許可・完了まで継続

- ユーザー指示(原文趣旨): fable5 は全体コントロール役。必要に応じて公式資料をインターネット検索して最新情報を取得し、計画を修正して実装完了まで動き続ける。タスクの追加・削除・修正権限を持つ
- 運用への反映:
  - 公式資料(厚労省・支払基金・診療報酬情報提供サービス・デジタル庁等)のWeb調査を evidence_id 発行の正規手段として使用する(Priority A/B のみ実装根拠化、Priority C は補助)
  - BLOCKED_REGULATORY_REVIEW の解除は「公式ソースの版・適用日を source_registry に記録 → evidence_id 発行 → 該当SSOT APPROVED」の手順で行う
  - Plans.md のタスクは fable5 判断で随時追加・削除・修正する
- WP-1006 完了: @yrese/events(EventEnvelope、PHI≠none→encrypted必須、sha-256形式検証、bigint clock)codex実装・claudeレビュー、7テストパス、85bd3aa
- WP-1007 発行: @yrese/contracts(contract-first の器、healthスキーマ移設)→ codex
- フォーク2系統実行中: WP-0005 規制・法令SSOT / WP-0006 医療安全・スコープSSOT

### 15:20〜15:30 — 実装第2波: date-time / trace / CI / 患者ヘッダー

- WP-1004 完了: @yrese/date-time(CalendarDate 実カレンダー検証・うるう年、処方日/調剤日/受付日、ClaimMonth、現在時刻への暗黙依存なし)codex実装・claudeレビュー、8テストパス、ab234fe。レビューノート: 日付ラッパー3種が構造的に同型のため異種間compareが可能 → 算定エンジン接続時にnominal brand追加予定
- WP-1005 完了: @yrese/trace(CalculationTrace/LegalTrace/EvidenceRef。affectsClaim=trueのstepはevidenceRef必須=「evidence_idのない算定ロジック禁止」を型・実行時で強制。inputsSummaryは型設計でPHI排除。URLはコード禁止=source_registry管理)codex実装・claudeレビュー、6テストパス、ddc06a1
- WP-0004 完了: llm_capability_registry + codex_capability_verification(AGMSG_PROTOCOL_UNVERIFIED を実測により解除。CODEX_CAPABILITY_UNVERIFIED はモデルID・Cloud関連のみ継続)aa904f9
- WP-4001 完了: GitHub Actions CI(typecheck/test/build)初回グリーン49秒、2116587
- WP-3002 完了: PatientHeader(カナ併記・生年月日+年齢・資格確認状態のテキストラベル表示、PENDING_REVERIFY/LOCAL_ONLY可視化)1acfa3f
- WP-1006 進行中: @yrese/events(sync event envelope、PHI未暗号化拒否の不変条件)を codex へ WP_ASSIGN
- 二系統WPフロー4周目。競合ゼロ、レビュー指摘は軽微のみ

### 15:05〜15:20 — 実装第1波: scaffold + 共通モジュール + 両アプリ骨格

- WP-0003 完了: 二系統運用SSOT 15文書(docs/agents/、status PROPOSED)コミット 8d47d70。フォークの open_questions(Codexモデル名、agmsgルーム機能なし→[room]タグ代替等)は llm_capability_registry 作成時に反映予定
- WP-1001 完了: monorepo scaffold(pnpm workspaces + strict TS base)c81d6ca
- WP-1002 完了: @yrese/shared-kernel(branded ID / SystemMode / PENDING系status / BLOCKER種別 / エラーコード・権限スコープ基盤)テスト15件パス、9ab039e
- WP-2001 完了: @yrese/api scaffold(Fastify 5 + zod /health)— **codex実装・claudeレビュー承認**、58411c0。二系統WPフロー(WP_ASSIGN→CODEX_PLAN→承認→実装→WP_HANDOFF→レビュー→コミット)が一巡目から正常動作
- WP-3001 完了: @yrese/web scaffold(Next.js 15、全画面共通SystemModeBadge=色非依存の状態表示、フォーカスリング、受付ダッシュボードプレースホルダー)build+typecheckパス、12a5ac2
- WP-1003 完了: @yrese/money(bigint ScaledDecimal / Yen / Points、丸め政策値の配線はBLOCKED_REGULATORY_REVIEW明記)— codex実装・claudeレビュー(丸めロジックのbigint truncated-division整合を確認)、11テストパス、533f89a
- WP-1004 進行中: @yrese/date-time を codex へ WP_ASSIGN、CODEX_PLAN 承認済み
- 運用メモ: pnpm-lock.yaml は claude が一括コミット(codexはcommit禁止の取り決めが機能)

### 15:00 — agmsg 連携確立(Claude側⇄Codex側)

- チーム `yrese` を作成し `claude`(このセッション)が join。配信モード monitor(リアルタイム受信)
- Codex側 `codex` が join 済みを確認。挨拶メッセージ受信
- 連携プロトコルを送信: レーン分担(claude=仕様/SSOT/frontend、codex=backend)、WP_ASSIGN→CODEX_PLAN→実装→WP_HANDOFF、共有ファイルのロック、R3+高リスク領域のBLOCKED維持
- ユーザー指示: 「codexはclaudeと連携しながら動作。可能なら常に連絡を取り合い、タスクのやりとりをする。お互いを尊重して動作」

### 14:5x — セッション開始〜Phase 0 承認〜実装開始指示

- GitHub 公開リポジトリ作成: https://github.com/yusuketakuma/yrese(main、.claude/.omc/.harness-mem は gitignore)
- Phase 0 計画案 `docs/plan/phase0_plan.md` をコミット(d24ecac)。人間レビューで承認(「次に進む」)
- **能力検証(WP-0002)完了**:
  - Codex側: codex-cli 0.143.0(~/.agents/bin/codex)、ChatGPTログイン済み。モデル名「GPT-5.6 sol max」は【要確認】
  - agmsg: ~/.agents/skills/agmsg/scripts/ 稼働確認
  - Claude側 /ultracode: 本環境のマルチエージェントオーケストレーション(fork/Workflow)として利用可能
- WP-0003 起動: 二系統運用SSOT 15文書を fork で並列作成中(docs/agents/ 配下のみ、完了待ち)
- ユーザー指示により実装開始承認。Plans.md / State.md 運用開始、活動単位ごとにコミット&プッシュ
- 方針: R3+ 高リスク領域(算定点数の具体値・レセプト記録条件・Official Adapter)は公式根拠 evidence_id 確認まで BLOCKED。R0-R2 の基盤(scaffold・共通モジュール)から実装

### 次アクション

- WP-1001 monorepo scaffold(claude)
- WP-2001 apps/api scaffold を codex へ WP_ASSIGN(scaffold 完了後)
- WP-0003 フォーク成果(docs/agents/)の受領・コミット
