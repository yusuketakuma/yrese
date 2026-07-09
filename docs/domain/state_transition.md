# state_transition — 状態遷移設計

```yaml
ssot_id: DOM-004
title: 状態遷移設計
domain: domain
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.2.0 §13-16, §18-19
depends_on: [DOM-001, DOM-002, ARC-001, ARC-002, MOD-005]
open_questions: 本文【要確認】参照
```

## 0. 原則

- 状態名は shared-kernel の実装済み定数(SYSTEM_MODES / PROVISIONAL_STATUSES / RECEPTION_STATUSES / BLOCKER_TYPES)と本書のみを正とする。ローカル定義禁止。
- **ドメインライフサイクル状態(§1 の処方・調剤・請求等の業務遷移状態)の定義の正本は本書**。
  shared-kernel / MOD-005 への登録は、当該状態を使用する実装 WP の着地時に行う(未実装状態の
  先行登録をしない)。登録時は本書と MOD-005 の両方を改版し一致を保つ(MOD-005 §0 と対)。
- ガード関数は実装済みの `canConfirmExternal` / `allowsFinalCalculation` / `allowsClaimFinalization` / `isClaimable` を唯一の実装とする(再実装禁止 — ARC-001)。
- **禁止遷移はUIで隠すだけでなく、API・ドメイン層で拒否する**(UIX-001 P系原則)。
- 全遷移は監査イベント(SEC-007)と、同期対象なら EventEnvelope(MOD-009)を伴う。

## 1. 処方・調剤・会計・請求ライフサイクル(主線)

### 状態一覧

| 状態 | 英語識別子 | 説明 |
|---|---|---|
| 仮受付 | RECEIVED_PROVISIONAL | 受付登録のみ。原本照合・確認前 |
| 仮取込 | IMPORTED_PROVISIONAL | QR/電子からの機械取込済み。照合前 |
| 薬剤師確認済み | PHARMACIST_CONFIRMED | 薬剤師が内容確認(scope: prescription:confirm) |
| 処方確定 | PRESCRIPTION_FINALIZED | 訂正は新版のみ |
| 調剤記録済み | DISPENSING_RECORDED | 調剤入力+薬剤師確認(dispensing:confirm) |
| 仮算定済み | CALCULATED_PROVISIONAL | PROVISIONAL_CALCULATION 付き |
| 確定算定済み | CALCULATED_FINAL | trace 必須・evidence 強制済み |
| 会計済み | SETTLED | 一部負担金収納(未収は別管理) |
| 点検済み | PRE_CLAIM_CHECKED | 記録条件検証+請求前点検通過 |
| 月次締め済み | MONTHLY_CLOSED | 請求月単位 |
| 請求ロック | CLAIM_LOCKED | 変更禁止 |
| 受渡済み | SUBMITTED_HANDOFF | オンライン請求用端末へ公式手順で受け渡し |
| 返戻 | RETURNED | 審査支払機関から差し戻し |
| 再請求済み | RESUBMITTED | 修正後の再提出 |

### 遷移とガード

| 遷移 | ガード条件 |
|---|---|
| 仮受付/仮取込 → 薬剤師確認済み | 薬剤師の明示操作(UI+API両面の scope 検証)。QR由来は原本照合記録が存在すること |
| 薬剤師確認済み → 処方確定 | 全Rpのコード解決が確定済み(曖昧一致は CODE_MAPPING_REVIEW_REQUIRED で停止) |
| 処方確定 → 調剤記録済み | 疑義照会が未解決でないこと(解決記録 or 変更は処方の新版経由) |
| 調剤記録済み → 仮算定/確定算定 | 確定算定は `allowsFinalCalculation(mode)`=true。LOCAL_ONLY では仮算定のみ+PROVISIONAL_CALCULATION 付与 |
| 算定 → 会計済み | 算定結果が CALCULATED であること(BLOCKED からの会計禁止)。金額根拠(trace)提示可能 |
| 会計済み → 点検済み | `isClaimable(statuses)`=true(PENDING系・対象外statusが1つでも残れば不可)+ 記録条件検証全件通過 |
| 点検済み → 月次締め済み | `allowsClaimFinalization(mode)`=true(NORMAL のみ)+ RECOVERY_SYNC 未完了案件ゼロ(ARC-002 R6ゲート) |
| 月次締め済み → 請求ロック | 締め操作者と別の承認(claim:finalize scope)— **統制の正本は CLM-001 系で確定する(本書は候補記載)**【要確認: 単独薬局運用での二者承認の現実性】 |
| 請求ロック → 受渡済み | 公式手順(OPS-012 接続試験通過後)。直接送信自動化は BLOCKED_REGULATORY_REVIEW 継続 |
| 受渡済み → 返戻 | 審査支払機関の返戻受領登録 |
| 返戻 → 再請求済み | 修正は新版レセプト生成(元データ改変禁止)+ 点検再通過 |

### 禁止遷移(API層で拒否)

- CLAIM_LOCKED 以降の遷移前状態への逆行・データ変更(訂正は返戻・再請求の新版のみ)
- PRESCRIPTION_FINALIZED の無履歴編集(訂正版作成のみ許可)
- 薬剤師確認をスキップする一括確定
- BLOCKED な算定結果からの会計・請求生成
- PENDING_REVERIFY / PENDING_EXTERNAL_SYNC / PENDING_PMH_REVERIFY / LOCAL_ONLY_UNVERIFIED / MANUAL_REVIEW_REQUIRED / CONFLICT_REQUIRES_HUMAN_REVIEW を保持したままの請求生成(isClaimable が実装済み)
- LOCAL_ONLY / CLOUD_DEGRADED / EXTERNAL_DEGRADED / RECOVERY_SYNC 中の月次締め・ロック
- 確定帳票の内容改変(再出力は新インスタンス)

## 2. 受付キューの副状態機械(RECEPTION_STATUSES — 実装済み)

受付エントリ(DOM-002 §1)の状態。**処方ライフサイクル(§1)とは独立の副状態機械**であり、
値の正本は shared-kernel の `RECEPTION_STATUSES`(MOD-005 §2.1 / API-006)。

| 遷移 | 条件 |
|---|---|
| (登録)→ WAITING | POST /reception(冪等性は API-006) |
| WAITING → IN_PROGRESS | 対応開始(明示操作) |
| IN_PROGRESS → COMPLETED | 対応完了(終端) |
| 任意の非終端状態 → CANCELLED | 取消(終端)。エントリは物理削除せず CANCELLED で保持(P-12) |

- 遷移の逆行なし(COMPLETED / CANCELLED は終端)。
- 受付状態と処方ライフサイクル(§1 の RECEIVED_PROVISIONAL 等)の対応付けは、
  処方箋取込の実装 WP で確定する(API-006 open_question の解消先)。

## 3. 資格確認スナップショットの状態

| 状態 | 遷移元 | 条件 |
|---|---|---|
| NOT_CHECKED | 初期 | — |
| VERIFIED | NOT_CHECKED / PENDING_REVERIFY | `canConfirmExternal(mode)`=true での公式確認成功のみ |
| PENDING_REVERIFY | VERIFIED | 有効期限超過・保険者変更検出・EXTERNAL_DEGRADED での受付・請求前再確認要求 |
| LOCAL_ONLY_UNVERIFIED | NOT_CHECKED | LOCAL_ONLY 中の参照のみ運用(新規確認の成功扱い禁止 — §15) |

伝播規則: スナップショットが VERIFIED 以外の間、当該患者の当該受付に PENDING_REVERIFY を伝播し、isClaimable を偽にする。表示は PatientHeader(実装済み)の eligibility 状態に対応。

## 4. システムモード遷移(ARC-001 準拠の要約)

NORMAL ⇄ EXTERNAL_DEGRADED ⇄ CLOUD_DEGRADED → LOCAL_ONLY → RECOVERY_SYNC → NORMAL。
モード降格は自動検知+明示表示、昇格(復旧)は RECOVERY_SYNC の工程完了(ARC-002 R1〜R6)を経る。
RECOVERY_SYNC 完了前の月次締め解禁は禁止(ゲートで強制)。

## 5. 同期イベントの状態(実装済み SyncStatus)

pending → sent → acknowledged / failed →(リトライ上限)→ dead_letter(deadLetterReason 必須 — 実装済み)。
dead_letter は自動再投入禁止・人間トリアージ(CONFLICT_REQUIRES_HUMAN_REVIEW 相当の扱い)。

## 6. 【要確認】

- 請求ロックの二者承認の運用(1人薬剤師薬局での代替統制 — 人間レビュー)
- 返戻の細分状態(全部返戻/一部返戻/増減点のみ)— 審査支払機関運用確認後
- 受渡済み後の受付結果・送信結果の状態追加(オンライン請求手順の精読後)
- 疑義照会「未解決」の定義(電話中・保留の扱い — 薬剤師レビュー)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(§2 に受付キュー副状態機械を追記[RECEPTION_STATUSES、処方ライフサイクルと独立]、§0 にライフサイクル状態の所有権規定[本書が定義の正本・実装 WP 着地時に MOD-005 と同期登録]、月次締め→ロック統制の正本を CLM-001 系へ委譲)。
- 0.1.0 (2026-07-09): 初版起草(WP-1101)。
