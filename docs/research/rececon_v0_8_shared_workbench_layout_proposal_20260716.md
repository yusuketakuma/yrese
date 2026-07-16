# yrese / PH-OS 共通 Workbench UI/UX 画面配置案

```yaml
document_kind: research_and_design_proposal
status: DRAFT
decision_status: PROPOSED
work_package: WP-0055f
created_at: 2026-07-16
last_updated_at: 2026-07-16
design_revision: 2
authority: none
implementation_authority: 0
production_authority: 0
ssot_promotion: 0
supersedes: none
```

## 1. 結論

全22ドメインの共通画面構造には、**Evidence-rail workbench（文脈固定型ワークベンチ）**を採用候補とする。

本案の製品固有要素は、Context LockbarからEvidence Spine、FinalizeGate、次の安全な操作までを一本の読解モデルで結ぶ**Safety Thread（安全糸）**とする。その末端に**Safe Next Beacon**を置き、「いま何をしているか」「次に何をするか」「なぜ必要か」「何が揃えば完了か」を決定論的に示す。これはAIの推奨、単一progress meter、自動実行ではなく、authoritativeなcontext、state、command precondition、blockerの投影である。

```text
上:   法人・薬局・利用者・System modeと、患者・請求月・訪問等の固定文脈
左:   現在の業務journey、工程、担当、次の安全な操作
中央: 一度に一つの主作業
右:   blocker、臨床警告、外部確認、同期、請求可否、根拠、版
下:   戻る、下書き、確認へ進む等の安定したcommand領域
```

22ドメインを22個のトップレベル画面や132個のrouteへ展開しない。既存の業務順routeを維持し、その内側で同じ`WorkbenchShell`を再利用する。Guided ModeとExpert Modeは別の状態機械にせず、同一command、schema、validation、permission、idempotency、concurrency、resource version、domain state、API、audit、outcomeを共有する。許容差分は説明量、表示密度、focus初期位置、review/根拠への移動、競合review済みshortcutだけとし、finalize/reverseを直接実行しない。

本書は配置案であり、APPROVED SSOT、API contract、runtime UI、Release Gateを変更しない。採用にはWP-0055fのview/command分類、PRC-007、人間の薬剤師・請求実務・UX/accessibility・privacy/security reviewが必要である。

## 2. 設計目的と判断基準

### 2.1 主な利用者

- 受付事務、会計担当、請求担当
- 薬剤師、管理薬剤師、在宅担当
- 本部担当、監査者、承認済みsupport担当

### 2.2 一つの中心job

> 選択中の患者、処方、調剤、請求、訪問の文脈と未解決事項を失わず、次の正しいcommandを安全かつ最短で完了する。

### 2.3 優先順位

1. 患者取り違え、誤店舗、誤請求月、誤versionの防止
2. 臨床BLOCKER、未確認、LOCAL_ONLY、外部障害の見落とし防止
3. 一つの主作業と次の安全な操作の明確化
4. 連続入力、keyboard操作、比較・修正の速度
5. 200% zoom、screen reader、forced colorsを含む到達可能性
6. 初期表示量、再描画、network waterfallの抑制
7. 見た目の一貫性と製品らしさ

## 3. 現行との差分

現行は`SystemModeBadge`、水平`BusinessNav`、`PatientContextBar`、単一カラム`main`という骨格である。患者文脈、状態badge、blocker、臨床警告、audit/version部品は再利用できるが、22ドメインを受け止める共通workbench、全画面の薬局文脈、請求月/訪問/version文脈、常設の安全根拠領域は未実装である。

| Before | After | Why |
|---|---|---|
| 9個の水平routeと単一カラム | route群の内側に共通`WorkbenchShell` | 22 domain / 132 UI labelをnav wallにしない |
| 患者文脈だけが横断表示 | tenant、pharmacy、modeと業務対象を二段固定 | 誤患者・誤店舗・誤請求月・誤versionを同時に防ぐ |
| 工程と状態が画面ごとに分散 | 左journey、右safety/evidenceを固定slot化 | 「どこまで進んだか」と「進めてよいか」を分離する |
| 主作業と警告・根拠が同じ流れで競合 | 中央主作業、右にblocker/根拠 | 重要情報を隠さず主作業の認知負荷を下げる |
| Guided/Expertを別UIとして増やせる | 同じcommand registryの二つのpresentation | 熟練者向け速度がvalidationやauditを迂回しない |
| 狭幅でsidebarをdrawerへ隠す | 安全情報を主作業より前へ単一列reflow | zoom/screen readerでもblockerを見失わない |
| 画面ごとのsuccess/error toast | 状態軸、inline error、review結果を適切なregionへ | queued、sent、verified、finalizedの誤認を防ぐ |
| 右railを読まないと次の操作が分からない | Safety Thread末端のSafe Next Beacon | 外部manualなしでも次の安全な一手と完了条件を理解できる |
| iconとmotionを画面ごとに選べる | 共通Icon GrammarとQuiet Motion matrix | 同じ意味を同じ形で学習し、高頻度業務の視覚疲労を防ぐ |

## 4. 比較した配置案

| 案 | 構造 | 情報効率 | 初見 | 熟練 | accessibility | 判定 |
|---|---|---:|---:|---:|---|---|
| A. Evidence-rail workbench | 左journey / 中央task / 右safety-evidence | 高 | 高 | 高 | DOM順と視覚配置を分離しやすい | **推奨** |
| B. Linear guided canvas | contextからreviewまで縦一列 | 中 | 非常に高 | 中〜低 | 読み順と狭幅に強い | Guided専用画面に限定 |
| C. Command matrix cockpit | 高密度table + palette + inspector | 非常に高 | 低 | 非常に高 | grid keyboard/zoomが複雑 | 請求点検等の専門viewに限定 |

Aは「現在工程」と「進行を止める根拠」を常時分離でき、Guided/Expertの共通契約、200% zoom、部分的なcode splitを同時に成立させやすい。BとCは否定せず、`WB-MAIN`内のview patternとして用途を限定する。

## 5. 共通画面配置

### 5.1 Desktop標準（1440×900候補）

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ WB-GLOBAL  yrese │ 法人/薬局 │ NORMAL/LOCAL_ONLY │ user/role │ 業務切替・privacy          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ CONTEXT SEAL  患者:氏名/生年月日/ID │ 処方:7/16 │ 請求:2026-07 │ 訪問:- │ v3 LOCKED │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ WB-ALERT  未解決2件「用量確認」「資格期限切れ」                 [最初の解除箇所へ]       │
├────────────────┬─────────────────────────────────────────────┬───────────────────────────┤
│ WB-JOURNEY     │ WB-MAIN                                     │ SAFETY THREAD             │
│ ● 受付 完了    │ 処方内容を確認                              │ ◆ Context       一致     │
│ ● 本人確認     │                                             │ │ patient/pharmacy/v3     │
│ ◐ 処方確認     │ 用法 [1日3回 毎食後]                        │ ⬢ BLOCKER       2        │
│ ○ 調剤         │ 用量 [ 1 ] 錠 × [ 3 ] 回                    │ │ [用量確認へ]           │
│ ○ 監査         │      └ 要確認: 原本との差分があります      │ ◇ External      期限切れ │
│ ○ 会計・交付   │                                             │ │ [資格確認へ]           │
│                │ 根拠 [原本を見る] [前回との差分]             │ ⬡ Review         未完了   │
│ 担当・待ち時間 │ inline validation / recovery                │ ◇ Sync           SYNCED   │
│                │                                             │ ◎ FinalizeGate   BLOCKED  │
├────────────────┴─────────────────────────────────────────────┴───────────────────────────┤
│ SAFE NEXT BEACON  いま:処方照合 │ 次:用量差分確認 │ 理由:原本と不一致 │ 完了:未確認0件  │
│ [戻る] [下書き保存] [根拠の詳細]                              [用量確認へ進む →]         │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ WB-ANNOUNCE  deduplicated status / alert live region                                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Safety Threadは一本の緑色progressではない。各nodeは独立した`label + shape + value + actor/time/version + 解除条件`を持ち、`SYNCED`でも`REVIEWED`や`CLAIMABLE`でない状態を同時に示せる。connectorに方向矢印、完了塗り、連続充填、百分率を使わず、node間の線は読解関係だけを示す。nodeから該当入力・根拠へfocusし、修正後は元nodeへ戻す。200% zoomでは`CONTEXT → ALERT → SAFETY THREAD → MAIN → BEACON/ACTIONS`の縦列へreflowする。意図的に強い視覚要素はこの一本だけとし、周囲は文字階層、罫線、余白で静かに構成する。

### 5.2 情報階層

| Level | 内容 | 配置 | 表示規律 |
|---|---|---|---|
| L0 | System mode、患者/薬局/version不一致、操作停止BLOCKER | `WB-GLOBAL` / `WB-ALERT` | 隠さない、自動消去しない |
| L1 | 患者、請求月、施設/訪問、現在工程、主要command | `WB-CONTEXT` / `WB-JOURNEY` / `WB-ACTIONS` | 操作中に位置を変えない |
| L2 | 入力、比較、薬剤、金額、issue、回復手順 | `WB-MAIN` / `WB-SAFETY` | 一つの主目的に絞る |
| L3 | audit、version履歴、詳細trace、raw technical detail | `WB-SAFETY`内の明示展開 | 初期表示を圧迫しないが到達可能にする |

### 5.3 LandmarkとDOM順

視覚上の三列より、意味上の安全順を優先する。

```text
DOM / focus: GLOBAL → CONTEXT → ALERT/SAFETY summary → JOURNEY → MAIN → ACTIONS → ANNOUNCE
visual:      GLOBAL → CONTEXT → ALERT → [JOURNEY | MAIN | SAFETY] → ACTIONS
```

- `header`、`nav`、`main`、`aside`、labelled `section`を使い、landmarkを過剰に増やさない。
- skip linkは「患者・業務文脈」「未解決blocker」「主作業」「操作」へ提供する。
- `WB-JOURNEY`の現在工程は`aria-current="step"`で示す。
- 重大状態はdrawer、tab、hover、tooltipだけに置かない。

## 6. Region contract

| Region ID | 責務 | 常時/条件 | 禁止 |
|---|---|---|---|
| `WB-GLOBAL` | tenant、pharmacy、role、system mode、session、業務切替 | 全画面 | 患者PHIの大量表示、userによるmode偽装 |
| `WB-CONTEXT` | patient、prescription/dispense、claim month、facility/visit、authority/version | 該当業務 | raw IDだけの表示、silent context switch |
| `WB-ALERT` | 操作停止、臨床、外部/同期障害の優先表示 | issue発生時 | dismiss不能issueの自動消去、同一原因の重複 |
| `WB-JOURNEY` | 現在の5〜12工程、担当、完了/保留/次 | case業務 | 22 domain全件の羅列、独自完了判定 |
| `WB-MAIN` | 一つの主作業、inline validation、比較 | 全画面 | safety情報を上書きするfullscreen、無関係dashboard |
| `WB-SAFETY` | 直交状態、blocker、根拠、actor/time/version、回復 | case/更新業務 | `SYNCED=VERIFIED=CLAIMABLE`等の状態統合 |
| `WB-ACTIONS` | 戻る、下書き、review、finalize/reverse入口 | command存在時 | shortcut一発確定、権限のUIだけでの保証 |
| `WB-ANNOUNCE` | deduplicateしたstatus/alert通知 | event時 | 同一eventの多重読み上げ、技術errorの臨床alert化 |

### 6.1 固定文脈の最小表示

| Context | 最小表示 | 切替時guard |
|---|---|---|
| Tenant / Pharmacy | 人間可読法人名、店舗名/コード、remote入力表示 | 再認可、dirty guard、queue再読込、監査 |
| System mode | label、制約、最終変化時刻 | system authorityのみ変更可 |
| Patient | 氏名、カナ、生年月日、年齢、性別、補助identifier | 保存/破棄選択、対象再確認、mutation停止 |
| Prescription / Dispense | source、処方日、対象version | If-Match、差分、stale時fail-closed |
| Claim | `YYYY-MM`、snapshot、lock | 明示picker、当時の版、audit |
| Facility / Visit | 施設、patient、訪問日時/ID、bundle cutoff | consent、offline bundle、task再読込 |
| Authority | server/resource version、read-only/permission | session/permission再検証 |

物理regionを**Context Lockbar**、その中でpatient/pharmacy/claim month/visit/version等のcommand対象tupleを同じ順序で表示・照合し、review/finalize時に再提示するpatternを**Context Seal**と呼ぶ。Context Sealは別region、別state、別authorityではなくContext Lockbarの安全表示contractである。

### 6.2 Safety / Evidence Spine

右railは次の直交軸を一行ずつ揃え、各行に`label + shape + count/value + actor/time/version + 解除条件`を持たせる。

1. Record lifecycle
2. External verification
3. Sync / conflict
4. Clinical/human review
5. Calculation provisional/final
6. Claimability
7. Delivery/notification

色は補助に限定する。例えば`SYNCED`でも未確認、未review、請求不可は同時に成立し得るため、単一の緑色「完了」へ潰さない。

**Evidence Spine**は`WB-SAFETY`という物理regionである。**Safety Thread**はContext Seal、Evidence Spine内の独立node、FinalizeGate、Safe Next Beaconを順に読めるよう接続する視覚・focus modelであり、新しい状態軸、進捗率、別authorityではない。

## 7. 全22ドメインへの共通適用

132 UI labelを132 routeにせず、次のview familyとregionへ分類する。domainはmodule/authority境界であり、必ずしも画面境界ではない。

| Workbench family | Domain | `WB-MAIN`の主view | `WB-JOURNEY` | `WB-SAFETY`の重点 |
|---|---|---|---|---|
| 受付・患者 | PAT / REC | 検索、候補比較、受付queue、同意/代理人 | 受付→本人/資格→処方待ち | identity、consent、duplicate、expiry |
| 処方・安全 | ING / PRX / SAFE | 原本照合、処方入力、前回差分、alert review | 取込→照合→疑義/変更→安全確認 | source trust、FHIR、version、clinical blocker |
| 調剤・在庫・機器 | DSP / INV / DEV | picking、調製、監査、reservation、device結果 | 調剤→監査→差戻し→交付 | lot/stock、device result、review separation |
| 算定・会計・帳票 | CALC / ACC / DOC | fee trace、会計、入金割当、帳票preview | 仮算定→確認→会計→領収/交付 | provisional/final、unpaid、hash、print/delivery |
| 請求・公的・master | CLM / NAT / MST | precheck issue table、lock、外部取引、版差分 | 確認→snapshot→lock→handoff/result | claim month、eligibility、external result、master版 |
| 在宅・患者接点・AI | HOM / ENG / AI | visit record、残薬、report draft、delivery | 準備→訪問→review→同期/共有 | bundle expiry、consent、AI draft、delivery result |
| 本部・platform・運用 | HQ / INT / ANL / MIG / OPS | queue/config/table/dashboard/runbook | assignment/rollout/cutover/incident | tenant scope、approval、freshness、rollback、SLO |

各familyは次のview patternだけを組み合わせる。

- `Queue/List`: 対象選択、優先度、担当、freshness
- `Record Detail`: authoritative factとversion/Provenance
- `Command Workbench`: 入力・review・実行
- `Comparison`: before/after、原本/FHIR、旧新計算
- `Issue Review`: blocker一覧、担当、解除、再実行
- `Configuration`: 有効期間、scope、approval、rollback
- `Analytics`: 定義、freshness、drill-down、privacy

## 8. Guided / Expert Mode

### 8.1 共通command contract

```ts
type WorkbenchCommand = {
  commandId: string;
  label: string;
  intent: "read" | "draft" | "review" | "finalize" | "reverse";
  requiredContext: readonly string[];
  inputSchemaId: string;
  validationContractId: string;
  permissionScope: string;
  preconditions: readonly string[];
  idempotency: "required" | "not-applicable";
  concurrencyContractId: string;
  resourceVersion: "required" | "optional";
  domainStateTransitionId: string;
  apiContractId: string;
  executeContractId: string;
  outcomeSchemaId: string;
  successProjectionId: string;
  auditEventType: string;
  recoveryCommandIds: readonly string[];
  shortcut?: string;
};
```

これは設計候補であり、`packages/contracts`へ未承認で追加しない。

### 8.2 表示差

| 項目 | Guided | Expert | 差を認めないもの |
|---|---|---|---|
| Journey | 理由、必須確認、次工程を展開 | compact、issueへ直接移動 | command ID、precondition |
| Form | 一つのまとまり、例、補足 | 高密度、予測可能な初期focus | schema、validation、Terminology |
| Alert | 根拠と対応を同時表示 | summaryから根拠へ即移動 | severity、block、override |
| Command | 明示review step | review summaryへ直接移動可 | permission、version、idempotency、audit |
| Keyboard | Tab/Enter中心 | palette/設定済みshortcut | finalize/reverseの直接実行禁止 |

command paletteは表示の入口に過ぎず、editable field内の単一文字shortcutを禁止する。finalize/reverse shortcutは実行せず、同じreview画面を開く。実際のkey chordはscanner、OS、browser、IMEとの競合試験後にregistryへ固定する。

### 8.3 Manual-free interaction contract

「マニュアルなし」は安全確認やhuman gateの省略ではなく、画面内の情報だけで目的、次の正しい操作、理由、完了条件、回復方法を理解できることと定義する。

| Pattern | 表示・操作 | 安全境界 |
|---|---|---|
| `Safe Next Beacon` | `いま / 次にすること / なぜ必要 / 完了条件`と一つのprimary commandを同じ場所に表示 | AI推奨、自動実行、権限・preconditionの迂回に使わない |
| `Fix Path` | blocker nodeから該当field、review、根拠へ一操作でfocusし、修正後に元nodeへ戻す | blockerを消すだけ、focus強奪、別患者への移動を禁止 |
| `Context Seal` | patient/pharmacy/claim month/versionを同じ順序で表示し、切替時はbefore/afterを再提示 | silent switchとdirty data破棄を禁止 |
| `Stable Verb` | `下書き保存 → 保存しました`のようにcommandと結果で同じ動詞を使う | `OK`、`実行`、`送信`等の結果が曖昧なlabelを避ける |
| `Guided Disclosure` | Guidedは理由、例、単位、必須条件をinline表示し、Expertは同じDOM/commandの補足だけを折り畳む | schema、validation、alert、review、auditを減らさない |
| `Recovery in Place` | validation、stale、timeout後も入力、保持内容、修正箇所、再実行条件を同じ画面に残す | errorで初期画面へ戻す、成功を推測する、raw errorを表示することを禁止 |
| `Contextual Help` | `なぜ必要？`と短い具体例を常に同じ位置から開き、元taskとfocusを失わない | tooltip、hover、外部manualだけを唯一の説明にしない |
| `Resume` | 中断復帰時に対象context、前回完了点、未解決件数、次の安全な操作を再提示 | stale状態から自動確定・自動再送しない |

初回tourやcoachmarkを必須にしない。採用する場合も任意、dismissible、再表示可能とし、患者文脈、alert、主作業、focus、actionsを覆わない。緊急業務、BLOCKER、LOCAL_ONLY中に強制tourを開始しない。empty stateは説明だけで終えず、対象roleが実行できる次のcommandまたは必要roleを示す。help mechanismは全業務で同じ位置と順序に保つ。

## 9. Responsive / zoom

device名ではなくworkbench container幅でreflowする。

| Container | Layout | Safety rule |
|---|---|---|
| `>= 80rem` | `13–18rem / minmax(30rem, 1fr) / 17–22rem` | 三列常設 |
| `56–79.99rem` | safety summaryを上段、journey + mainの二列 | blocker summaryを折り畳まない |
| `< 56rem`または200% zoom | DOM順の単一列 | context、blocker、main、actionをすべて到達可能にする |

- action barは狭幅でoverlayにせず通常flowへ戻す。
- tableだけに局所horizontal scrollを許し、page全体の横scrollを禁止する。
- tableはcaption、操作説明、sticky key column、visible focusを持つ。
- sidebarをdrawerへ隠す場合も、重大blocker summaryはmainより前に残す。
- sticky header/footerには実測offsetと`scroll-padding` / `scroll-margin`を設け、focusを覆わない。

## 10. Visual / typography / density

### 10.1 方向性

「高密度だが静かな医療workbench」とする。大きな装飾cardやgradientを避け、Context LockbarとEvidence Spineを製品固有の視覚言語にする。

- 背景とsurfaceは既存tokenを再利用し、APPROVED status registryを通さず生のstatus色を増やさない。
- 日本語本文は既存の`BIZ UDGothic` / `Hiragino` / system stackを優先する。
- identifier、version、時刻、金額、点数はtabular numeralsを使う。
- 標準control高は現行44pxを維持候補とする。Expertの高密度rowはtarget spacingと人間accessibility reviewなしに縮めない。
- 罫線と余白でgroup化し、shadowはdialog/overlay等のlayer表現に限定する。
- 主actionは一つ。下書き、戻る、破壊的操作を同じ強さにしない。

#### Surface palette candidate

以下はsurface、navigation、focus補助、evidenceに限る候補であり、臨床状態、BLOCKER、sync、claimability、successの意味色は既存Visual Status Registryへ委譲する。

| Token | Value | Role |
|---|---:|---|
| `Porcelain Canvas` | `#F4F7F6` | workbench背景 |
| `Clinical Paper` | `#FFFFFF` | 主作業surface |
| `Ledger Ink` | `#142425` | 主文字、構造線 |
| `Graphite Note` | `#5E6E70` | metadata、補助説明 |
| `Command Blue` | `#1A56DB` | primary command、focus補助。現行accentを再利用 |
| `Evidence Indigo` | `#4656A6` | evidence link、version、Provenance。statusには使わない |

gradient、glass、blur、装飾的な半透明、clinical content背後のpatternを使わない。大胆さはSafety Threadだけに集中し、その他はopaque surfaceと高contrastの境界を使う。

#### Type roles

外部fontを追加せず、offline、初期表示、ライセンスの不確実性を増やさない。既存の`BIZ UDGothic` / `Hiragino` / system stackを役割別に使う。

| Role | Candidate | Use |
|---|---|---|
| Work title | 700、`20/28px` | 現在の主作業 |
| Section heading | 700、`16/24px` | Journey、Safety Thread群 |
| Clinical body | 400、`15/24px` | 説明、alert、入力 |
| Control label | 600、`14/20px` | button、field、status label |
| Ledger data | 500、`14/20px`、`tabular-nums` | 金額、点数、時刻、version |
| Metadata | 500、`12/16px` | actor、source、更新時刻 |

患者名、薬剤名、金額へmonospaceを使わない。opaqueなtechnical IDだけを例外候補とする。

### 10.2 Clinical Icon Grammar

iconは意味の主担ではなくscan補助とする。status、clinical alert、sync、offline、finalize、overrideは既存Visual Status Registryのvisible Japanese label、shape、toneを唯一の状態authorityとし、新規iconへ置換しない。wireframe内の記号は配置説明だけで、runtime icon IDまたは新statusを承認するものではない。

| Family | Candidate concept | Rule |
|---|---|---|
| Navigation / work | 受付、患者、処方、調剤、安全、算定、請求、会計、在宅、在庫、system | icon + visible label。route間で同じconceptを同じ形にする |
| Action verb | 検索、追加、下書き保存、比較、review、印刷、送信、回復、help | 結果を表す動詞labelを必須にし、iconだけで確定操作を行わない |
| Context | patient、pharmacy、claim month、visit、version | Context Sealの人間可読値を常時併記 |
| Evidence / utility | evidence、history、expand、copy候補 | 低リスクutility以外はvisible label必須。tooltipは補足だけ |

候補geometryは`24×24 viewBox`、標準20px、primary 24px、dense metadata 16px、stroke 1.75または2px、round cap/join、`currentColor`、optical centeringとする。同一iconの複数concept利用、同一conceptの複数icon、emoji、異なるbrand setの混在、薬や心臓等を根拠なく「安全」「確認済み」の意味へ使うことを禁止する。decorative iconは`aria-hidden`、visible labelがない低リスクutilityだけaccessible nameと認識試験を必須とする。status、offline、finalize、override、destructive actionはicon-only不可とする。

現行`apps/web`にはicon/motion libraryがないため、本案ではdependencyを選定・追加しない。Gate後に候補setのlicense、security、bundle、tree-shaking、forced-colors、stroke一貫性をreviewし、共通registryへ`REUSE / AMEND_PRC007 / REJECT`分類する。外部CDN、icon font、画面単位の手書きSVG分散を禁止候補とする。

### 10.3 Alert配置

優先順は固定する。

1. 患者、薬局、version、権限不一致による操作停止
2. BLOCKER / CRITICAL臨床警告
3. 未確認資格、原本差分、PMH、薬剤師未review
4. LOCAL_ONLY、sync conflict、外部障害
5. 通常の非安全系通知

alertは短く具体的なheading、影響、担当、次の安全な操作を持つ。同一原因は一つに集約し、toastは非安全・一過性の保存通知等だけに使う。NHS warning calloutの「重要な警告を簡潔で自己完結したheadingにする」という知見は参考にするが、同componentをそのまま日本の薬局transactionへ移植しない。

### 10.4 Before / After / Why

| Before | After | Why |
|---|---|---|
| Context LockbarとEvidence Spineが別の読解対象 | Context SealからFinalizeGateまで続くSafety Thread | 文脈、根拠、実行可否を一つの理解モデルにする |
| 状態badgeを横並びで読む | 独立nodeにlabel/value/解除条件を併記 | 直交状態を一つのsuccessへ潰さない |
| 右railを読んで次の操作を推測 | Safe Next Beaconを常設 | manualを開かず安全な次手を判断できる |
| iconをcomponentごとに選択 | concept単位のClinical Icon Grammar | 同じ意味を同じ形で学習できる |
| spinner/shimmerで待機を強調 | 静的状態、開始時刻、経過、回復操作 | 動きの停止を完了と誤認しない |
| Guided/Expertで情報構造が分岐 | 同じDOM/commandの説明密度だけを変更 | 熟練速度がvalidationやauditを迂回しない |
| blockerから手作業で修正箇所を探索 | Fix Pathでfocus往復 | 見落としと探索時間を減らす |

## 11. Keyboard / accessibility

- 全commandはkeyboardで到達でき、focus順は業務順を保つ。
- route/context変更後は新しい`h1`またはerror summaryへfocusを置く。
- dialogはfocus移動、contain、Escape、triggerへの復帰を満たす。
- focus取得だけでcontext変更、送信、患者切替を起こさない。
- stateはlabel + shape + optional colorで表現し、forced colorsでも境界/current/focusを残す。
- pointer targetは最低24×24 CSS pxまたは認められたspacingを満たし、重要操作は44px候補を維持する。
- status transitionは一度だけ読み上げ、複数の入れ子`role=status`を避ける。
- 200% zoomで重なり、情報欠落、page-wide horizontal scroll、固定領域によるfocus隠蔽を0にする。
- production PHIをaccessibility test、screen capture、telemetryへ使用しない。

W3Cは、sticky header/footer等がkeyboard focusを完全に隠さないこと、pointer targetを24×24 CSS px以上または適切なspacingとすること、landmarkをlabelled region/skip linkとして利用できることを示している。適合宣言は自動testだけで行わず、対象範囲と支援技術を固定したmanual testを必要とする。

## 12. Privacy / security / finalization

- `WB-ACTIONS`はpermission registryの投影であり、API側でtenant/pharmacy/resource/versionを必ず再検証する。
- 業務理解に必要な権限外操作は、必要roleと理由を伴うdisabled表示を候補とする。単に隠すかはcommandごとに決める。
- break-glassは通常commandから隔離し、理由、期限、scope、再認証、継続banner、auditを必須にする。
- patient-bound mutation中は取り違え防止に必要な患者識別を中途半端にmaskしない。手動lock、承認済みidle timeout、session/device lockまたはrevocationで画面全体をshieldし、再認証までmutationも止める。window blur/background tabでの自動shield条件はhuman privacy/operations reviewで固定し、少なくとも一時表示中のsecret/PHI revealを閉じ、mutationを再開前確認へ戻す。
- queue/listでは住所、電話、保険番号等の非必須PHIを既定非表示とする。
- error、URL、telemetry、DOM属性、tooltip、notificationへPHIを入れない。
- shield中はpointer、keyboard shortcut、command palette、application clipboard command、print/export、外部共有、PHI revealを実行不能にする。shield解除は再認証とcontext/version再読込を伴う。
- support/共有画面は目的とroleに必要な最小PHI projectionだけを返し、CSS maskだけでserver response内の余分なPHIを隠さない。
- 最終modalは患者、薬局、対象version、請求月、金額、取消可能性を再提示する。
- Enter単独でfinalize/reverseしない。stale version、重複submit、患者切替はfail-closedにする。
- append-only/finalized recordは削除でなく訂正、取消、amendment lineageへ誘導する。

### 12.1 FinalizeGate候補

`finalize` / `reverse` commandは、UIのbutton状態に依存せず、commandごとのapplicabilityを含む次のpreconditionをserver-sideで再評価する。

1. commandが要求するtenant、pharmacy、patient/claim/visit、resource context tupleが完全一致する。
2. permission、purpose、Consentまたは適用可能なlegal basis、sessionが有効である。
3. resource version / If-Matchが一致し、silent overwriteがない。
4. commandに適用される未解決BLOCKERが0である。
5. 必須human/pharmacist reviewが完了し、overrideにはactor、理由、時刻がある。
6. 請求関連commandではclaimability blockerが0である。
7. commandが要求するexternal verificationが有効期間内に完了している。
8. 算定関連commandではfinal calculation、evidence、master/rule versionが確定している。
9. commandが要求するSystem modeであり、LOCAL_ONLY等の禁止状態ではない。
10. idempotency、concurrency、duplicate-effect防止が成立する。
11. 業務更新と必須audit/outboxが定義済みtransaction境界で成功する。

一つでも失敗した場合はauthoritative stateをfinalized/reversedへ進めず、draft/review状態と入力を安全に保持し、外部送信・会計/在庫/請求の二重効果を発生させない。UIは最初の未解決条件だけでなく全件summary、解除条件、担当、該当箇所へのfocus移動を提供する。

## 13. LOCAL_ONLY / RECOVERY_SYNC

System modeとrecord sync stateを分離する。

- `LOCAL_ONLY` / `RECOVERY_SYNC`は小badgeだけにせず、`WB-GLOBAL`と`WB-ALERT`へ固定表示する。
- 検知時刻、最終cloud確認、許可操作、禁止操作、recovery入口を表示する。
- 各recordには`LOCAL_ONLY / QUEUED / SYNCING / CONFLICT / SYNCED`、queue age、担当を表示する。
- 仮算定、仮受付、未送信帳票は値の直近にも「仮」「未送信」を表示する。
- reconnectだけで薬剤師review、確定算定、claim lock、交付完了へ自動遷移しない。
- `QUEUED ≠ 送信済み`、`印刷queue投入 ≠ 印刷済み`、`通知sent ≠ patient delivered`を保つ。

## 14. Motion / performance

### 14.1 Motion

**Quiet Motion**と呼び、動かすことより即応と認知の安定を優先する。keyboard起点、高頻度操作、patient/context、安全状態にはanimationを付けない。pointer pressは即時のborder/background変化で受理を示し、motion completionをcommand受付条件にしない。

| Interaction | Frequency | Purpose | Candidate standard | Reduced motion |
|---|---:|---|---|---|
| keyboard入力、focus、shortcut | 100+/day | 即応 | `0ms` | 同一 |
| command palette | 100+/day | 即時検索 | `0ms` | 同一 |
| route、patient、pharmacy、claim switch | tens–100+/day | 文脈安全 | `0ms` | 同一 |
| journey、status、BLOCKER、offline更新 | tens–100+/day | 誤読防止 | `0ms`、text/shapeを即時更新 | 同一 |
| 通常button pointer press | 100+/day | 受理feedback | motion `0ms`、即時border/background | 同一 |
| evidence popover | occasional | 発生源との空間関係 | enter `160ms` / exit `120ms`、opacity + `scale(.97→1)`、trigger origin | opacity `100/80ms`だけ |
| contextual help | frequency unproven / tens候補 | 画面内説明 | `0ms`。頻度実測とhuman reviewなしにmotionを追加しない | 同一 |
| final review modal | occasional | commit前の注意固定 | enter `200ms` / exit `140ms`、opacity + `scale(.97→1)`、center origin | opacity `100/80ms`だけ |
| privacy shield、permission loss | rare | 即時保護 | `0ms` | 同一 |
| loading | frequent | 待機 | static skeleton + 処理名/開始時刻/経過、shimmerなし | 同一 |
| authoritative result / error | frequent | 正確なfeedback | `0ms`、inline text/shape + deduplicated announce | 同一 |

許可motionは`transform`と`opacity`だけに限定し、`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`を候補とする。`transition: all`、`ease-in`、layout/height/width animation、stagger、bounce、pulse、shake、parallax、大きなzoom/blur、autoplay、無限motion、swipe/dragだけで主要業務を実行することを禁止する。CRITICAL/BLOCKERは静的、永続、非dismissとし、背景eventでfocusを奪わない。submitで検出したerrorだけerror summaryへfocusする。`prefers-reduced-motion`では位置・scale変化を除き、情報、focus順、command結果を同一に保つ。

### 14.2 Loading architecture

- shell、Context Lockbar、server-readable安全projectionを先に表示する。
- active journeyの`WB-MAIN`と`WB-SAFETY`を並列取得し、waterfallを避ける。
- 初期bundleに22 domain moduleや全evidence detailを含めず、現在のroute/journeyだけをloadする。
- queueはpagination/bounded queryを基本とし、screen reader/focusの代償を測るまで安易にvirtualizeしない。
- interaction-to-paintとauthoritative command completionを別metricにする。
- 現行性能値はreal device、Edge/LAN、data volume、cold/warm baseline前は`CANDIDATE_NOT_SLO`を維持する。

## 15. 受入条件候補

| ID | 条件 | 既存接続 |
|---|---|---|
| WB-AC-01 | 全画面でtenant/pharmacy/system modeを識別できる | WP-0054g / UAC-05 |
| WB-AC-02 | patient-specific画面で氏名、カナ、生年月日、年齢、性別を常時確認できる | UIX-001 / PAT-007候補 |
| WB-AC-03 | claim画面でpharmacy、請求月、snapshot、lockを常時確認できる | WP-0054g |
| WB-AC-04 | Guided/Expertでcommand ID/schema/validation/permission/idempotency/concurrency/resource version/domain state/API/audit/outcome差分が0 | WP-0055f |
| WB-AC-05 | `SYNCED`、`VERIFIED`、`REVIEWED`、`CLAIMABLE`を別状態として判別できる | UAC-05 |
| WB-AC-06 | LOCAL_ONLYで外部確認・送信・最終確定を成功表示しない | UAC-06 |
| WB-AC-07 | blockerから対象入力またはreview箇所へkeyboardで直接移動できる | UAC-10 |
| WB-AC-08 | 200% zoomでcontext、blocker、main、actionを失わず完了できる | UAC-11 / WCAG candidate |
| WB-AC-09 | sticky領域がkeyboard focusを完全に隠さない | WCAG 2.2 SC 2.4.11 candidate |
| WB-AC-10 | stale version、duplicate submit、context switchで誤確定0 | UIX-001 / security/data integrity |
| WB-AC-11 | recovery中の未解決件数、種別、担当を即答できる | UAC-08 |
| WB-AC-12 | 132 UI labelをregion/view/commandへ100%分類し、top-level route増分を根拠化する | WP-0055f |
| WB-AC-13 | FinalizeGateのいずれかを失敗注入した時にstate不変、外部送信/二重効果0、解除条件へfocus可能 | security/data integrity/human review |
| WB-AC-14 | privacy shield中のpointer/shortcut/palette/copy/print/export/mutationが0で、再認証後だけcontext/version再読込して解除 | privacy/security |
| WB-AC-15 | 新人/熟練者が3 critical journeyで外部manualを開かず正しい次commandを選択できる割合90%以上、安全上の誤command成功0 | UAC-01を置換しない補助指標 / human usability review |
| WB-AC-16 | patient/pharmacy/claim month/versionと「いま/次/なぜblocked」を5秒以内に正答100%、誤context mutation 0。`SYNCED + REVIEW未完了 + CLAIMABLE BLOCKED`等の混在状態を総合進捗・順次完了と回答した件数0 | Context Seal / Safety Thread / Safe Next Beacon |
| WB-AC-17 | 全BLOCKERから該当field/review/evidenceへkeyboard 1 command、pointer 1 activation以内で移動し、focus return 100% | Fix Path / UAC-10 |
| WB-AC-18 | registry外icon、競合concept、安全・状態label欠落、critical icon-only commandがすべて0 | Clinical Icon Grammar / accessibility |
| WB-AC-19 | keyboard、高頻度button、context/status/BLOCKER変化のmotion開始0。許可motionは200ms以下かつtransform/opacityのみ | Quiet Motion / reduced motion |
| WB-AC-20 | reduced motion、forced colors、screen reader、200% zoomの組合せでもcontext、alert、main、action、helpへ到達100% | accessibility human test |
| WB-AC-21 | 誤patient/store/month/version、CRITICAL見落とし、offline false success、unsafe finalize/override、focus lossを速度指標より優先し全件0 | medical/privacy/security review |

### 15.1 Human measurement protocol gate

`WB-AC-15`と`WB-AC-16`は、human authorityが次のprotocol fieldsを固定するまで`HUMAN_PROTOCOL_REQUIRED / NOT_EVALUATED`とし、90%、5秒、100%、誤認0をPASS宣言しない。

| Field | Required definition |
|---|---|
| Cohort | 受付事務、薬剤師、請求、在宅の新人/熟練者区分と選定基準 |
| Denominator / N | role別participant数、task数、除外条件。NはCodexが決定しない |
| Scenario | synthetic data、開始状態、critical journey、混在状態、失敗注入 |
| Clock | start event、stop event、timeout、pause/再開規則 |
| Assistance | 画面内help、外部manual、facilitator介入、再試行の許可と記録 |
| Oracle | 正しいcommand、context、blocker理由、safe recoveryを判定する承認済みscenario answer |
| Safety stop | 誤context、CRITICAL見落とし、false success、unsafe finalize/override、focus lossの即時停止 |
| Reporting | role/cohort別completion、first-correct-action、assistance数、recovery、誤認、confidence |

`WB-AC-15`はfirst-correct-actionの補助指標であり、既存UAC-01のrole別task completion 100%と致命的誤操作0を緩和・置換しない。速度または90%選択率を達成してもSafety stopが1件あれば不採用とする。

## 16. Synthetic validation matrix

本案の採用前に、production PHIを使わず次を検証する。

| Environment | Scenario | Stop condition |
|---|---|---|
| 1440×900 / 1920×1080 | 受付→処方→調剤→会計→交付 | 誤context、blocker見落とし、action移動 |
| 200% zoom / narrow container | patient、claim、visit task | context/action欠落、overlap、page横scroll |
| Keyboard-only | 10件連続受付、issue修正、review | trap、focus loss、shortcut bypass |
| Screen reader | landmark、state、alert、dialog | 多重announce、無名region、状態誤読 |
| Forced colors / reduced motion | state、focus、alert | 色依存、focus不可視、意味消失 |
| LOCAL_ONLY / RECOVERY_SYNC | 仮受付、仮算定、queue、conflict | false success、自動確定、owner不明 |
| Failure injection | stale、duplicate、external timeout、printer failure | 二重効果、raw error/PHI露出、回復不能 |
| Authorization | role loss、cross-tenant/pharmacy、break-glass expiry、FinalizeGate各条件 | UI/API不一致、mutation成功、audit失敗後のfinalized |
| Privacy shield | manual/idle/session lock、background tab、離席復帰、support、print failure | shortcut/copy/print/export成功、過剰PHI、再認証なし解除 |
| First-use learnability | 新人/熟練者別に受付→交付、月次請求、在宅訪問 | external manual依存、安全誤操作、assistance過多、回復不能 |
| Icon comprehension | icon非表示、色非表示、forced colors、低リスクutility iconの認識 | icon/色消失で意味消失、同一iconの意味競合、critical icon-only |
| Motion matrix | pointer/keyboard、通常/reduced motion、低/高頻度 | 許可外motion、layout shift、motion待ち、状態変化の遅延 |

## 17. 実装順序候補

これは新しいWP authorityではなく、WP-0055f内のexecution slice候補である。

1. **UX-S1 View inventory**: R1/R2の再現可能source条件が成立した後、132 UI labelを`MERGED_REGION / DISTINCT_VIEW / DEFERRED / REJECTED`へ分類し、region、command、role、context、state、error、offline、testへ接続する。
2. **UX-S2 Prototype specification only**: 実行可能codeを作らず、synthetic wireframe、Safety Thread / Safe Next Beacon、Clinical Icon Grammar、Quiet Motion matrix、screen/interaction specification、3 journey manual-free test protocol、200% zoom/reflow期待値だけを作る。
3. **UX-S3 Contract proposal**: Context Lockbar、Evidence Spine、Safe Next Beacon、command/icon registryに必要なread projectionを列挙し、既存`packages/contracts`/status registry/componentへの`REUSE / AMEND_PRC007 / REJECT`候補を作る。runtime contract、dependency、status authorityは変更しない。
4. **UX-S4 Human design validation**: 受付事務、薬剤師、請求実務、在宅、accessibility、privacy/securityがwireframe/specification/test protocolをreviewし、Safety Threadが単一progressと誤認されないこと、manual-freeがguardrail省略にならないことを確認する。
5. **UX-S5 Atomic amendment / Gate re-evaluation**: UX-S4後、採用差分だけをPRC-007 atomic amendment batchとして既存`screen_inventory`、`workflow_map`、必要なUI原則へ承認・反映する。続いてWP-0055gがWP-0055a〜f、official evidence、human decision、PRC-007を含む全Gate 0条件を再評価し、全件PASS後に限りG0-08でGate 1 exact scopeを再発行する。
6. **UX-S6 Synthetic clickable prototype**: Gate 1再発行とrequired human review後だけ、production contractを仮定しないsynthetic dataでshared shellと3 journeyを検証する。
7. **UX-S7 Bounded implementation**: prototype independent verification後、shell → one critical journey → independent verification → 残journeyの順に拡張する。

## 18. 停止条件

- WP-0055aでR1/R2をbyte-preserving captureし、R2 raw取得またはhuman source-authorityによる明示的source-gap判断とindependent verificationが完了するまで132 UI label分類を開始しない。
- WP-0055fのview/command/context分類が未完了のままruntime shellを正本化しない。
- APPROVED `docs/uiux`を本Draftで上書きしない。
- claim month、facility/visit、authority/version等のcontractをfixture fieldで捏造しない。
- 22 domain別route、別Guided/Expert API、別state registryを作らない。
- safety/blockerをdrawer、tab、toastだけへ隠さない。
- Gate後のlicense/security/performance/accessibility review前にicon/motion dependency、external CDN、icon font、画面単位の手書きSVG、runtime animationを追加しない。既存Visual Status Registryを新iconで置換しない。
- human review前にR3 layoutを採用済み、WCAG適合済み、現場効率最大化済みと宣言しない。
- PRC-007 atomic amendment approval、WP-0055gによる全Gate 0条件PASS、G0-08 Gate 1 exact scope再発行、required design review前にclickable prototypeまたはruntime UIを実装しない。
- real-device baseline前にcandidate performance値をrelease SLOにしない。
- Gate 0=`NO_GO`の間はproduction UI、clinical data、external sendへ反映しない。

## 19. 根拠と参照

### Repository

- `docs/uiux/medical_ui_ux_principles.md`
- `docs/uiux/usability_acceptance_criteria.md`
- `docs/uiux/screen_inventory_draft.md`
- `docs/uiux/workflow_map.md`
- `docs/research/rececon_v0_7_ux_performance_kpi_evidence_20260716.md`
- `apps/web/app/layout.tsx`
- `apps/web/app/nav.tsx`
- `apps/web/app/components/patient-context.tsx`
- `apps/web/app/status/visual-status-registry.ts`

### External official / public design guidance checked on 2026-07-16

- [W3C WCAG 2.2: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
- [W3C WCAG 2.2: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C WAI-ARIA APG: Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- [W3C WAI-ARIA APG: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [W3C WCAG 2.2: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
- [W3C WCAG 2.2: Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help)
- [W3C WCAG 2.2: Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification)
- [W3C WCAG 2.2: Context-sensitive Help](https://www.w3.org/WAI/WCAG22/Understanding/help.html)
- [USWDS: Icon](https://designsystem.digital.gov/components/icon/)
- [USWDS: Icon list](https://designsystem.digital.gov/components/icon-list/)
- [USWDS: Icon accessibility tests](https://designsystem.digital.gov/components/icon/accessibility-tests/)
- [GOV.UK Design System: Task list](https://design-system.service.gov.uk/components/task-list/)
- [NHS digital service manual: Warning callout](https://service-manual.nhs.uk/design-system/components/warning-callout/)
- [NHS digital service manual: Notification banners](https://service-manual.nhs.uk/design-system/components/notification-banners)

W3C Understanding/APG、USWDS、GOV.UK、NHS guidanceは設計ガイダンスであり、yreseの適合性、法令適合性、薬剤師安全性を単独で証明しない。W3Cのconsistent help/identificationはhelp位置と同一機能の呼称一貫性、animation guidanceは非必須motionの停止、USWDSはiconの一貫性とtext併記、GOV.UK task listはtask/statusの短く一貫した表示の参考に限定する。厳密な順序を持つ調剤・請求工程を利用者が自由に並べ替えられるtask listへはしない。NHS patternは日本の保険薬局向けtransactionで検証されたものではないため、alert hierarchyと簡潔なheadingの参考に限定する。
