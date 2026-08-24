# online_qualification_boundary — オンライン資格確認・マイナ保険証連動の境界 SSOT(骨子)

```yaml
ssot_id: ADP-004
title: オンライン資格確認・マイナ保険証連動の境界
domain: adapters
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - security_critic
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - claims_evidence_specialist
  - human_review_required
version: 0.1.1
created_at: 2026-08-23
updated_at: 2026-08-24
approved_at: 2026-08-23
approved_by: "direct human authority 2026-08-23 (「全てを許可する。実行」); independent review: api-contract lane + security-privacy lane REQUEST_CHANGES -> all findings closed (28dae05, f07e76e); closure checker PASS"
effective_from: 2026-08-23
effective_to: null
source_refs: [構築プロンプト v0.2.0 §3・§8・§10・§27, PRD-001 M2/M3, PRD-005 §1 行8, ADP-001 ADP-A1, REG-004 RB-002/RB-003/RB-005, DOM-001 C3, SEC-004, SEC-007]
depends_on: [ADP-001, REG-001, REG-004, DOM-002, DOM-005, API-006, API-009, API-017, MOD-005, MOD-008]
impacts: [reception_entries.eligibility_status, Patient/Coverage projection(DOM-006 改版), CLM-001 工程6 請求前点検, SCR-001/002/024/025, packages/adapter-onshi(予定)]
related_work_packages: [WP-6301, WP-6302, WP-6303, WP-6304, WP-6305, WP-6306, WP-6307, WP-6312]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.1 2026-08-24 review A-9/M5: §4 の再確認を「結果不変は監査 event、結果変化は新 snapshot」と定義して §3 と整合。 §3 見出しを DB 実体(patients.eligibility_status は患者要約、受付単位状態は snapshot 導出)に合わせ、§6 に受付表示の正本を明記。EXPIRED / MISMATCH からの復帰は evidence を伴う人間 gate として open question に残す。semantics 不変。review と human approval まで PROPOSED"
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.0 2026-08-23 WP-6302 骨子起案(PROPOSED)。外部 IF 仕様(ONS)未入手のため、yrese 側の状態機械・不変条件・fail-closed 規則・privacy 境界だけを定める。公式 IF の形式・項目・接続方式は一切推測しない"
open_questions:
  - 資格確認端末経由(薬局内 PC)と API 経由のどちらを主経路にするかは ONS 仕様入手後に決める
  - 薬剤情報・特定健診情報の閲覧同意フローを yrese UI で扱うか端末側に委ねるかは privacy review 論点
  - 災害時モード(資格確認不能時の特例取扱い)の制度条件は REG-003 で確認する
  - 代理人・法定代理人による同意、未成年、意思能力を欠く場合の扱い(legal review)
  - 同意の有効期間と再取得契機
  - 撤回の伝播先(画面キャッシュ、印刷済み帳票、生成済み export、配送済み/DLQ の event)
  - 同意記録自体の保持期間
  - 同意取得主体(資格確認端末側か yrese UI か)
  - EXPIRED / MISMATCH 受付の復帰に必要な evidence(同一性照合の再実施記録)と人間 gate の形
blockers:
  - BLOCKED_REGULATORY_REVIEW: RB-002(オン資外部 IF 仕様未入手)・RB-003(電子処方箋)・RB-005(PMH)が解除されるまで外部接続コードを書かない
  - BLOCKED_OFFICIAL_ADAPTER_SPEC: ADP-001 共通
  - BLOCKED_PRIVACY_REVIEW: 閲覧同意・監査・保持の privacy review 完了まで薬剤情報/特定健診情報の取込を実装しない
  - BLOCKED_LEGAL_REVIEW: 代理人・未成年・意思能力の同意取扱い
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: eligibility.* および consent.* 監査種別
```

## 1. 目的と範囲

保険資格の確認結果を **改ざん不能なスナップショット**として受付・算定・請求に結びつけ、
未確認・期限切れ・不一致の受付が請求へ進めないことを fail-closed で保証する。
マイナ保険証(マイナンバーカードの健康保険証利用)と従来の被保険者証の両経路を同じ
状態機械で扱う。

本 SSOT は yrese 側の境界だけを定める。オンライン資格確認等システムの外部 IF、
資格確認端末の仕様、電文形式、証明書、ネットワーク要件は ONS で入手した公式資料を
`source_registry` に登録し evidence_id を発行してから別改版で記述する(RB-002)。
**本書のどの記述も公式 IF の形式を示すものではない。**

## 2. ドメイン概念

| 概念 | 定義 | 不変条件 |
|---|---|---|
| EligibilitySnapshot(資格確認スナップショット) | ある時点で外部システムまたは券面から確認した資格情報の不変記録 | append-only。訂正は新 snapshot。元の actor / 時刻 / 確認方式を後から変更しない |
| verified_method | `MYNA_ONLINE`(マイナ保険証でオンライン確認)/ `CARD_ONLINE`(被保険者証番号でオンライン確認)/ `CARD_VISUAL`(券面目視、オンライン不能時)/ `NONE` | `NONE` は snapshot ではなく「未確認」状態 |
| 資格内容 | 保険者番号・記号番号・枝番・負担割合・限度額適用区分・有効期間・公費(受給者証)情報 | 項目名は DOM-002 / DOM-005 の canonical model に従い、公式 IF 入手後に写像表を追加 |
| 外部応答原本 | 資格確認応答を未加工で保存した記録 | PHI classification 付与・暗号化・監査。yrese は内容を解釈して書き換えない。**§5 の薬剤情報・特定健診情報・診療情報の閲覧応答は外部応答原本として保存しない**(表示のみ。保存対象は表示事実と範囲の監査) |
| 閲覧同意記録 | 薬剤情報・特定健診情報・診療情報の閲覧に対する患者同意 | 同意の範囲・時刻・取得経路・撤回を監査。同意なき閲覧は拒否 |

## 3. 受付の資格状態機械(受付単位。`patients.eligibility_status` の患者要約とは別概念)

```text
UNVERIFIED ──(確認成功)──▶ VERIFIED_MYNA | VERIFIED_CARD
UNVERIFIED ──(券面目視のみ)──▶ PROVISIONAL_VISUAL
UNVERIFIED ──(外部不能: EXTERNAL_DEGRADED / LOCAL_ONLY)──▶ OFFLINE_PROVISIONAL
VERIFIED_* ──(有効期間超過・再確認期限超過)──▶ EXPIRED
VERIFIED_* ──(患者同一性不一致・保険者変更検知)──▶ MISMATCH
OFFLINE_PROVISIONAL / PROVISIONAL_VISUAL ──(RECOVERY_SYNC 再確認成功)──▶ VERIFIED_*
OFFLINE_PROVISIONAL / PROVISIONAL_VISUAL ──(再確認失敗)──▶ MISMATCH | EXPIRED
```

規則:

- 算定の確定(`allowsFinalCalculation`)と請求データ生成は `VERIFIED_*` だけを許す。
  `PROVISIONAL_*` / `OFFLINE_PROVISIONAL` は仮算定のみ、`UNVERIFIED` / `EXPIRED` /
  `MISMATCH` は `MANUAL_REVIEW_REQUIRED` で停止する(CAL-007、CLM-001 工程 6)。
- 遷移は全て監査 event を伴う(MOD-008 に `eligibility.*` 種別を追加する改版が前提 — `BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT`)。同意の状態(未取得 / 取得 / 撤回)は資格状態とは別の evidence として snapshot に紐づけ、「同意不明」は未取得として扱う。
- 状態は snapshot から導出し、受付行に結果だけを複製する場合も snapshot_id を必ず持つ。
- 患者同一性(氏名・生年月日・性別)の照合結果は資格確認結果とは別の evidence とし、
  一致しない場合に弱属性で自動統合しない(DEVELOPMENT_POLICY.md §6)。

## 4. 請求前資格確認(CLM-001 工程 6 への入力)

- 請求月締め前に、対象受付の snapshot が「請求対象日に有効」かを再確認する。
  再確認の結果が変わった場合(資格喪失・保険者変更・不一致)は §3 の遷移表に従う新 snapshot
  (`EXPIRED` / `MISMATCH`)として追加する(上書きしない)。結果が変わらない再確認は新 snapshot を
  作らず、既存 snapshot_id を対象とする監査 event(`eligibility.verified`、MOD-008 §1.2)として
  記録する — §3 の表に VERIFIED_* の自己遷移が無いのはこのためである(review M5)。
- 資格喪失・保険者変更・負担割合変更を検知した受付は請求データ生成から除外し、
  `MANUAL_REVIEW_REQUIRED` 一覧へ出す。
- 再確認の外部 IF 仕様は RB-002 解除後に記述する。

## 5. マイナ保険証連動で追加される境界

| 機能 | yrese 側の扱い | gate |
|---|---|---|
| 資格確認(マイナ) | §3 の `VERIFIED_MYNA` | RB-002 |
| 薬剤情報・特定健診情報・診療情報の閲覧 | 閲覧同意記録 → 表示のみ。yrese は正本を保持せず、表示した事実と範囲を監査 | BLOCKED_PRIVACY_REVIEW、C-037 |
| 限度額適用認定情報 | snapshot の項目として保持し、一部負担金計算(CAL-R-024)への入力候補 | RB-008、CAL-R-024 |
| 電子処方箋の引換番号/処方箋 ID との連携 | ADP-A2 境界 SSOT(WP-6308)へ委ねる | RB-003 |
| PMH(医療費助成) | ADP-A4 境界 SSOT(WP-6311)へ委ねる。本書は snapshot に受給者証参照を持つ余地だけ確保 | RB-005 |

## 6. システムモード別の挙動(ARC-001 / ARC-002 との接続)

| モード | 資格確認 | 受付 | 算定 |
|---|---|---|---|
| NORMAL | 実施 | `VERIFIED_*` | 確定可 |
| EXTERNAL_DEGRADED | 不能 | `OFFLINE_PROVISIONAL` | 仮算定のみ |
| LOCAL_ONLY | 不能 | `OFFLINE_PROVISIONAL` | 仮算定のみ |
| RECOVERY_SYNC | 再確認を順次実施 | 再確認結果で遷移 | 再確認後に確定可 |

未確認受付を「確認済み」と表示してはならない(SPEC-002 §16)。受付画面の資格表示の正本は
**受付単位の状態(§3)**であり、`patients.eligibility_status`(患者要約)を受付の確認済み表示に使わない。
実装: `eligibility_snapshots` + `reception_entries.eligibility_snapshot_id`(migrations/000009・000011)、
状態機械は `@yrese/shared-kernel` `RECEPTION_ELIGIBILITY_STATES`(MOD-005 §2.2)。

## 7. Privacy / security 不変条件

- snapshot・外部応答原本は PHI classification `direct_identifier` 以上として暗号化し、
  tenant/pharmacy 境界内でのみ読める。URL・log・metric に資格情報を出さない。
- 閲覧同意のない薬剤情報・健診情報は取得も表示もしない。同意は撤回可能で、撤回後の
  表示は拒否する。
- 外部システムの資格証明書・接続 credential は secret として扱い、repository に置かない。

## 8. 禁止事項

- 公式 IF の電文・項目・エラーコードを推測して実装すること(RB-002)。
- 資格確認結果を後から書き換える修復。訂正は新 snapshot。
- 未確認・期限切れ・不一致の受付からの請求データ生成。
- 資格確認結果による患者の自動統合。

## 9. 解除ロードマップ

1. WP-6301: ONS アクセス確保、外部 IF 仕様の `source_registry` 登録、evidence_id 発行【人間手続き】。
2. 本書改版: 公式 IF 項目と §2 の写像表、接続方式、証明書・ネットワーク要件を追記。
3. DOM-002 / DOM-005 / DOM-006 改版: EligibilitySnapshot と Coverage projection の追加。
4. MOD-008 改版: `eligibility.*` 監査種別。
5. WP-6303 / WP-6304 / WP-6312: synthetic stub での状態機械実装と fail-closed テスト。
6. WP-6306: 公式 sandbox 接続試験【human gate】→ ADP-003 registry で `SANDBOX` → `CERTIFIED`。
