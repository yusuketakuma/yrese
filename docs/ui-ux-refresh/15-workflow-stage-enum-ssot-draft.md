# 15 — workflow-stage enum SSOT ドラフト(調剤ワークフロー工程の正本)

> **DRAFT / PROPOSED — non-SSOT 作業領域上の起草文書。**
> 正式 SSOT への昇格(移設先・採番は §8、`docs/ssot_index.md` 登録含む)は PRC-007 の
> 10段改版フローに従い、exact11 batch の dirty ownership 解消後に行う。
> 本書の承認前に `packages/shared-kernel` へ enum を実装しない(捏造禁止)。

```yaml
# 昇格時に確定する frontmatter 案
ssot_id: TBD            # domain 系採番(DOM-xxx)を PRC-007 で確定。UI 消費だが正本は domain
title: 調剤ワークフロー工程(workflow-stage)
domain: domain
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - data_integrity_reviewer
  - medical_safety_reviewer   # 工程順・確認前後の区別は医療安全に直結
  - frontend_reviewer
  - human_review_required     # 薬剤師による工程実務レビュー
version: 0.1.0-draft
created_at: 2026-07-31
source_refs:
  - docs/uiux/workflow_map.md(UIX-006 v0.2.0 APPROVED — 工程順の上位正本)
  - docs/domain/state_transition.md(DOM-004 — ライフサイクル状態・遷移ガードの正本)
  - docs/ui-ux-refresh/14-one-board-direction-decision.md(丁採用決定 R-5)
  - docs/ui-ux-refresh/13-ui-component-system-ssot-draft.md(UIX-008 候補 §4)
  - packages/shared-kernel/src/status.ts(既存 status 規約)
depends_on: [UIX-001, UIX-006, UIX-007, DOM-004]
impacts: [packages/shared-kernel, apps/web/app/status/visual-status-registry.ts, UIX-008候補]
open_questions: 本文 §9
blockers:
  - BLOCKED_SSOT_INDEX_DIRTY(exact11 landing 前は index 登録しない)
  - 本書 APPROVED 前の shared-kernel 実装禁止
```

## 1. 目的と適用範囲

丁「一枚盤面」(14号決定)の工程行(`WorkflowSheet` / `WorkflowStageRow`)が表示する
**工程の同一性(identity)と順序**、および**工程進捗の導出語彙**を単一正本として定義する。

- 工程順の上位正本は **UIX-006 業務導線マップ**であり、本書はその enum 化である。
  UIX-006 と矛盾する順序・工程を定義しない。
- **本書はライフサイクル状態を定義しない。** 処方・調剤・会計・請求の業務遷移状態
  (RECEIVED_PROVISIONAL〜RESUBMITTED)・遷移ガード・禁止遷移の正本は **DOM-004 §1** であり、
  本書の「工程(stage)」はそれと直交する**盤面上の位置の軸**である。状態の重複定義・
  別名定義を禁止する。
- 適用範囲は**患者単位の調剤線(調剤盤)**のみ。月次の請求線
  (請求前点検→月次締め→レセプト→返戻 = 請求盤)は別のライフサイクルであり、
  本 enum に含めない(将来の別 SSOT)。

## 2. 設計原則(fail-closed)

1. **進捗は保存しない。導出する。** 工程進捗の新しい永続状態を作らない。
   **DOM-004 §1 のライフサイクル状態**と既存の実装済み正本
   (`ReceptionStatus`(DOM-004 §2 副状態機械)・`EligibilityStatus`・`ProvisionalStatus`・
   `isClaimable`・`SYSTEM_MODES` ガード)からの**純関数導出のみ**とし、二重実装・二重真実を
   禁止する。DOM-004 の状態が shared-kernel に未登録の間(登録は使用実装 WP 着地時 —
   DOM-004 §0)、当該工程は `UNAVAILABLE` に導出される。
2. **正本のない工程は進捗を主張しない。** 処方・調剤・薬剤師確認・会計等のドメイン契約が
   未起草である間、当該工程は `UNAVAILABLE`(未接続)へ導出される。UI が勝手に
   「未着手」「進行中」を表示することを型で不可能にする。
   **型による強制の実装形(2026-07-31 checker 訂正)**: 素の文字列 union では
   `progress: "IN_PROGRESS"` の直接リテラル指定を型は止められない。`StageProgress` は
   **opaque brand 型**として輸出し、`deriveStageProgress` だけが構築できる形
   (`Brand<..., "StageProgress">` — shared-kernel `branded-ids.ts` の既存イディオム)を
   実装要件とする。これにより「導出関数以外からの進捗表示が型エラーになる」が真になる。
3. **enum は全工程、表示は投影。** enum は UIX-006 の全9工程を保持する。一枚盤面が
   「受付・患者特定をキュー側へ吸収」「会計と帳票を1行に統合」するのは表示層の投影であり、
   ドメイン正本を削らない。
4. **モード判定を再発明しない。** LOCAL_ONLY / RECOVERY_SYNC による工程可否は既存の
   `SYSTEM_MODES` ガード関数(`allowsClaimFinalization` 等)を唯一の判定源とする。

## 3. 提案 enum(shared-kernel 実装形 — 承認後に実装)

既存規約(`as const` 配列 + union type、SCREAMING_SNAKE 値)に従う。

```ts
// packages/shared-kernel/src/workflow-stage.ts(承認後に新設)

/** 調剤線の工程。順序は UIX-006 §1 と完全一致(配列順=業務順)。 */
export const DISPENSING_WORKFLOW_STAGES = [
  "RECEPTION",                // 受付
  "PATIENT_IDENTIFICATION",   // 患者特定
  "COVERAGE_CONFIRMATION",    // 患者・保険・公費確認(資格確認・PMH 含む)
  "PRESCRIPTION_ENTRY",       // 処方入力(2D仮取込・照合を含む)
  "DISPENSING",               // 調剤入力(残薬調整・後発品変更記録)
  "CALCULATION",              // 仮算定(ローカル)— 確定算定は PAYMENT 側(UIX-006 §1 準拠)
  "PHARMACIST_CONFIRMATION",  // 薬剤師確認(ここまで「確認前」表示 — P-07)
  "PAYMENT",                  // 会計(一部負担金請求・収納)
  "DOCUMENT_OUTPUT",          // 帳票出力(領収証・明細書・薬袋等)
] as const;
export type DispensingWorkflowStage = (typeof DISPENSING_WORKFLOW_STAGES)[number];

/** 工程進捗の導出語彙。保存禁止 — deriveStageProgress の戻り値専用。 */
export const STAGE_PROGRESSES = [
  "NOT_STARTED",   // 前工程が完了し、着手可能だが未着手
  "IN_PROGRESS",   // ドメイン正本が進行中・下書き・仮状態を示す
  "BLOCKED",       // 進行不能(モード禁止・BLOCKER・要再確認未解消など理由必須)
  "COMPLETED",     // ドメイン正本が確定状態を示す(根拠のある確定のみ — P-17)
  "UNAVAILABLE",   // 対応するドメイン契約が未承認・未接続(進捗を主張しない)
] as const;
export type StageProgress = (typeof STAGE_PROGRESSES)[number];

/** 導出関数の契約(実装は承認後)。純関数・網羅 switch・既存正本のみを入力とする。 */
export type StageProgressInput = {
  /** 導出対象の患者(2026-07-31 checker H-1 追加 — 患者束縛)。 */
  patientId: PatientId;                     // shared-kernel branded ID
  reception?: ReceptionStatus;              // DOM-004 §2(実装済み副状態機械)
  eligibility?: EligibilityStatus;
  provisional?: readonly ProvisionalStatus[];
  systemMode: SystemMode;
  patientSelected: boolean;                 // §9 未決(完了条件)の暫定入力 — 本欄参照
  // lifecycle?: DispensingLifecycleState — DOM-004 §1 の状態。shared-kernel への登録が
  // 使用実装 WP で行われた後、本書を改版してこの入力を追加する(先行定義しない)
};

/** 判別可能ユニオン: BLOCKED は reason(既存 BlockerType)を必須で伴う。
 *  戻り値は patientId を運搬し、描画側は表示先の患者文脈と一致しない結果を
 *  描画してはならない(非同期 stale 結果の別患者混入防止 — checker H-1)。 */
export type StageProgressResult =
  | {
      patientId: PatientId;
      progress: Exclude<StageProgress, "BLOCKED">;
    }
  | {
      patientId: PatientId;
      progress: "BLOCKED";
      reason: BlockerType;   // 既存 shared-kernel blockers.ts の BlockerType を流用(新型を作らない)
    };

export declare function deriveStageProgress(
  stage: DispensingWorkflowStage,
  input: StageProgressInput,
): StageProgressResult;
```

`BLOCKED` は必ず理由(`reason`)を伴う。**理由の型は既存 shared-kernel
`blockers.ts` の `BlockerType` を流用し、新しい理由型を作らない**
(2026-07-31 checker 訂正 — 当初案の `BlockerReason` はリポジトリに存在しない型で、
新設すると BLOCKER_TYPES との二重実装になる。既存 BlockerType で不足する理由が
実装時に見つかった場合は blockers.ts 側の改版として扱う)。判別可能ユニオンにより
理由なしの BLOCKED は構文的に構築不能である
(P-18/P-19: 何が危険か・何を確認するか・復旧後に何が必要か)。

## 4. 工程 → ドメイン正本の写像(導出可能性の現況)

導出入力の正本は DOM-004 §1 のライフサイクル状態(*斜体* = shared-kernel 未登録につき現時点
`UNAVAILABLE`)と実装済み status である。

| 工程 | 正本(導出入力) | 現況 |
|---|---|---|
| RECEPTION | `ReceptionStatus`(DOM-004 §2・実装済み) | ✅ 導出可 |
| PATIENT_IDENTIFICATION | 患者文脈確定(patient-search 契約 + PatientContext) | ✅ 導出可 |
| COVERAGE_CONFIRMATION | `EligibilityStatus` + PMH 系 `ProvisionalStatus` | ◐ 資格は導出可 / PMH は BLOCKED(外部仕様待ち) |
| PRESCRIPTION_ENTRY | *RECEIVED_PROVISIONAL / IMPORTED_PROVISIONAL / PHARMACIST_CONFIRMED / PRESCRIPTION_FINALIZED*(DOM-004 §1) | `UNAVAILABLE`(状態未登録・実装 WP 待ち) |
| DISPENSING | *DISPENSING_RECORDED*(DOM-004 §1) | `UNAVAILABLE`(同上) |
| CALCULATION | *CALCULATED_PROVISIONAL*(DOM-004 §1)+ `PROVISIONAL_CALCULATION` — **仮算定まで。確定算定(CALCULATED_FINAL)は PAYMENT 側の導出入力**(UIX-006 §1「会計(確定算定 → 一部負担金請求)」準拠 — 2026-07-31 checker 訂正: 工程境界の二重帰属を排除) | `UNAVAILABLE`(live 結線先の WP-3011b/c は**現 active queue に存在しない** — 契約承認後の実装 WP 起草が前提) |
| PHARMACIST_CONFIRMATION | DOM-004 の確認記録(§9 の順序突合が前提) | `UNAVAILABLE` |
| PAYMENT | *CALCULATED_FINAL / SETTLED*(DOM-004 §1)+ 会計契約(**未起草 — 旧 WP-2201/2202 は現 active queue に存在しない**) | `UNAVAILABLE` |
| DOCUMENT_OUTPUT | 帳票契約 — **未起草** | `UNAVAILABLE` |

DOM-004 状態の shared-kernel 登録(使用実装 WP 着地)と各契約 APPROVED の時点で、
本書の `StageProgressInput` と導出表を**同一改版で**拡張する(先行導出をしない)。
遷移の可否・禁止遷移の判定は DOM-004 §1 のガードが正であり、本導出はその**表示投影**にすぎない。

## 5. 疑義照会・分岐の扱い

疑義照会(SCR-015)は UIX-006 上「処方入力からの分岐」であり、**線形工程ではない**。
本 enum に工程として追加せず、`PRESCRIPTION_ENTRY` の BLOCKED 理由
(照会中 = 進行停止+理由「疑義照会の回答待ち」)として表現する。
照会状態の enum(照会中/回答済み/処方訂正)は処方ドメイン契約起案時に定義する(予約)。

## 6. Visual Status Registry との接続(UIX-008 候補 L1)

承認後、Registry に次の 2 軸を追加する:

1. **工程 identity**: 確定日本語ラベル
   受付 / 患者特定 / 保険・公費確認 / 処方入力 / 調剤 / 算定 / 薬剤師確認 / 会計 / 帳票出力
   (UIX-006 の用語と一致。形状・トーンは持たない — identity は状態ではない)。
   **実装形(2026-07-31 checker 訂正)**: Registry の `StatusQuery` union
   (全 domain が tone/shape 必須の `StatusPresentation` を返す)へは追加**しない**。
   既存の identity-only 前例 `CLINICAL_ALERT_TYPE_IDENTITY`(StatusQuery の外側の
   label-only マップ)に倣い、`WORKFLOW_STAGE_IDENTITY` として同型で実装する
   (偽の tone/shape を捏造しない)。
2. **進捗(domain=`stage-progress`)**:

| key | label | tone | shape | 備考 |
|---|---|---|---|---|
| NOT_STARTED | 未着手 | neutral | ○ | |
| IN_PROGRESS | 進行中 | pending | ↻ | 下書き・仮状態を含む |
| BLOCKED | 停止(理由併記) | blocked | ■ | reason 必須 |
| COMPLETED | 完了 | ok | ● | 根拠ある確定のみ |
| UNAVAILABLE | 未提供(契約未承認) | neutral | — | 進捗を主張しない正直表示。shape「—」は既存 `StatusShape` union に存在せず **L1 変更(union への追加改版)を要する**(13号 §2: L1 変更の自由度 低)。追加の可否・代替形状は WP-5112 実装時に L1 改版として判断【要確認】 |

工程行 chip は本 2 軸のみを使い、ドメイン固有の詳細状態(資格・仮算定等)は
行内サマリで既存軸の chip を併置する(丁プロトタイプの表示と同型)。

## 7. 検証要件(実装 WP で必須)

- 網羅性: 全 stage × 全 progress の導出テスト(switch 網羅を型+テストで担保)
- 順序: `DISPENSING_WORKFLOW_STAGES` の配列順が UIX-006 §1 と一致することのテスト
- **工程内容の対応**: 配列順の一致だけでなく、各工程の**内容境界**(特に CALCULATION=
  仮算定まで / 確定算定=PAYMENT 側)が UIX-006 §1 の記述と一致することの対応表テスト
  (2026-07-31 checker 追加 — 順序一致テストは境界ズレを検出できない)
- fail-closed: 契約未承認ドメインの入力が undefined のとき必ず `UNAVAILABLE` になること
- **UNAVAILABLE の消費側 fail-closed**(2026-07-31 checker C-2 追加): 導出結果が
  `UNAVAILABLE` の工程を集計・抽出するキュー・一覧(確認待ちキュー等)は、
  空集合表示ではなく「未接続(UNAVAILABLE)」の理由表示へ倒すこと。
  「空(対象ゼロ)」と「導出不能」を区別しないビューを禁止するテスト
- **患者束縛**(2026-07-31 checker H-1 追加): 導出結果の `patientId` が表示先の
  患者文脈と一致しない場合に描画されないこと(非同期 stale 結果の別患者混入)のテスト
- BLOCKED reason 必須の型検査、モード連動(LOCAL_ONLY で PAYMENT 以降が BLOCKED 等)
- Registry 2 軸の label/tone/shape/ARIA 網羅テスト(既存 registry テストの流儀)
- **前提**: 上記のうち DOM/インタラクションを要するテストは RTL/jsdom ハーネスが
  apps/web に未導入であるため(13号 blockers)、ハーネス整備 WP の完了が前提

## 8. 昇格手順

1. 本ドラフトのレビュー(data-integrity / medical-safety / frontend / independent+薬剤師実務)
2. exact11 landing → `docs/ssot_index.md` 登録可能化
3. 移設・採番確定(domain 系 DOM-xxx。`docs/domain/` 配下へ。番号は index 正本と突合して採番)
4. APPROVED 後に shared-kernel 実装 WP を Plans.md へ登載(WIP=1 規律)— 実装+テスト+Registry 2 軸
5. UIX-008(13号)§3 台帳へ `workflow-stage.ts` 行を追加

## 9. Open questions

- **薬剤師確認の位置 — open question から必須改版事項へ昇格(2026-07-31 / 17号 SF-2)**:
  製品方向は direct user instruction(17号 D-2)で確定 — `PHARMACIST_CONFIRMATION` は
  調剤・入力完了後の**処方入力内容の最終確定**であり、電子処方箋の調剤結果登録ジョブ投入を兼ねる
  (1操作・2段分離 — 17号 §2)。ただし DOM-004(APPROVED)の2段確認構造
  (処方段階 PHARMACIST_CONFIRMED / 調剤内包 dispensing:confirm)との整合には
  **PRC-007 による DOM-004 改版が必須**であり、本書はその APPROVED を前提条件とする。
  改版前に本 enum の当該工程を実装しない【DOM-004 改版 + medical_safety + 薬剤師レビュー】
- **外部登録の進捗表現(17号 SF-3)**: `STAGE_PROGRESSES` に「ローカル確定済み・外部登録待ち」を
  追加**しない**。最終確定後の調剤結果登録は既存 `PENDING_EXTERNAL_SYNC`(ProvisionalStatus)の
  chip を工程行サマリへ併置して表現する(進捗5値は投影に徹し、外部同期の正本を二重化しない)
- `PATIENT_IDENTIFICATION` の完了条件 — 患者選択のみで完了か、本人確認カード(丁の二段階選択)の確認操作まで要するか【薬剤師レビュー】。
  **注記(2026-07-31 checker)**: §3 の `patientSelected: boolean` と §4 の「✅導出可」は
  「患者選択のみで完了」側を暫定採用した形になっており、本未決の答えを先取りしている。
  薬剤師レビューで確認操作必須と決まった場合、§3 入力と §4 の現況は改版される
- **同一確認イベントの多重計上**(2026-07-31 checker L-5 追加)— *PHARMACIST_CONFIRMED* が
  PRESCRIPTION_ENTRY の導出入力に、*DISPENSING_RECORDED*(dispensing:confirm 内包)が
  DISPENSING の導出入力に現れる。DOM-004 状態の登録後、1つの薬剤師確認イベントが
  複数工程の進捗を同時に動かす表示になるが、それが実務の工程観と一致するかの確認
  【薬剤師レビュー + WP-5102 突合】
- COVERAGE_CONFIRMATION の粒度 — 保険・公費・資格・PMH を1工程に束ねる本案 vs 分割【実務レビュー】
- 会計と帳票の統合表示(丁の1行統合)を enum 側でも統合すべきか — 本案は分離を維持(帳票失敗が会計完了を汚さないため)【要確認】
- `UNAVAILABLE` の日本語確定文言(「未提供(契約未承認)」案)【表現レビュー】
- 中断・取消(ReceptionStatus CANCELLED)時の後続工程表示 — 全て NOT_STARTED のまま停止か、CANCELLED 専用表示か【要確認】
- **一人薬剤師(ロール兼任)時の導出・表示** — clerk 不在で pharmacist が入力〜確認まで全工程を操作する運用が業界に実在する(16号 §3)。導出関数はロールに依存しない設計を維持しつつ、自己入力+自己確認の記録分離(確認操作の scope 検証を兼任時も緩めない)を工程表示がどう扱うか【medical_safety + 実務レビュー】

## 変更履歴

- 0.1.2-draft (2026-07-31): WP-5101 fresh-context checker(3 lane)findings 反映 —
  `BlockerReason`(存在しない型)を既存 `BlockerType` 流用へ確定し BLOCKED を判別可能
  ユニオン化(H-1)、`StageProgress` の brand 化を実装要件へ明記し「型で不可能」を
  実現可能な主張へ(§2-2)、導出入出力へ `patientId` を追加し患者束縛テストを必須化
  (safety H-1)、CALCULATION の境界を仮算定までへ訂正し確定算定を PAYMENT 側へ
  (UIX-006 突合)、identity 軸の実装形を CLINICAL_ALERT_TYPE_IDENTITY 同型の
  identity-only マップへ確定・UNAVAILABLE shape の L1 改版必要性を明記、
  UNAVAILABLE 消費側の fail-closed(空/導出不能の区別)を検証要件へ追加(C-2)、
  WP-3011b/c・WP-2201/2202 の active queue 不在を明示、§9 へ patientSelected 先取り
  注記と確認イベント多重計上を追加(L-5)。
- 0.1.1-draft (2026-07-31): 17号反映 — 薬剤師確認位置を D-2 決定受領+DOM-004 必須改版事項へ昇格(SF-2)、外部登録は PENDING_EXTERNAL_SYNC 併置で表現し進捗5値を不変とする方針を明記(SF-3)。
- 0.1.0-draft (2026-07-31): 初版起案(14号 R-5 / ユーザー指示「workflow-stage enumのSSOT起案から進めて」による)。
