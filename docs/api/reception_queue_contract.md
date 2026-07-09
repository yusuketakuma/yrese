# reception_queue_contract — 受付キュー API 契約

```yaml
ssot_id: API-006
title: 受付キュー API 契約(GET /reception/queue, POST /reception)
domain: api
status: APPROVED
approved_at: 2026-07-09
approved_by: codex 実装可能性レビュー(CONTRACT_REVIEW 全反映)+ fable5
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.2.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [UIX-007(SCR-001), UIX-006(業務導線), API-001 v0.2.2(様式先例), API-003(公開API共通土台)]
depends_on: [API-001, API-002, API-003, DOM-004(処方ライフサイクルとの分界), MOD-005(状態台帳 — 改版前提), MOD-006(error_code_registry — 改版前提), MOD-007(permission registry — 改版前提), MOD-011(date-time policy)]
impacts: [packages/contracts, apps/api, apps/web(WP-3009 SCR-001), packages/shared-kernel(RECEPTION_STATUSES / PERMISSION_RESOURCES / RCV エラーコード / ReceptionId factory 追加)]
open_questions:
  - キュー状態と DOM-004 処方ライフサイクル(RECEIVED_PROVISIONAL 等)の対応付け(処方箋取込 WP で確定)
blockers:
  - API_CONTRACT_BLOCKED: 本契約 APPROVED 前の実装禁止(API-001 §5 と同一手順。WP-3009-BE/93aefa1 で backend 側は実装済み)
```

## 1. 目的とスコープ

SCR-001 受付ダッシュボード(当日の受付キュー・業務起点)のための最小契約。
**受付は業務管理であり、算定・請求・点数には一切触れない**(算定系は CAL/CLM 系 SSOT の別レーン)。
DB 未導入のため、実装はリポジトリインターフェース+インメモリ合成データから始める(API-001/WP-2008 と同型)。backend 側の初期実装は WP-3009-BE/93aefa1 で完了している。

## 2. エンドポイント

### GET /reception/queue?date=YYYY-MM-DD

- `date` は**必須**(暗黙の「今日」をサーバー側で解決しない — MOD-011 の暗黙現在時刻禁止。既定日付は UI 側の責務)。
- `date` は `YYYY-MM-DD` の**形式だけでなく実在する暦日として検証**する(例: `2026-02-31` は 400 で拒否。@yrese/date-time の CalendarDate 由来 parser を用いる — 独自 date パーサの実装禁止)。
- レスポンス(200):

```
{
  date: string,                  // YYYY-MM-DD(要求と同一)
  entries: ReceptionQueueEntry[]
}

ReceptionQueueEntry = {
  receptionId: string,           // wire は素の string(branded 化は内部 — API-001 と同方針)
  patient: PatientSummary,       // §4(患者検索の結果形状を再利用)
  acceptedAt: string,            // ISO datetime(サーバー採番)
  receptionStatus: ReceptionStatus,       // §5
  prescriptionIntakeType: 'paper'         // 初期は紙のみ。電子処方箋は BLOCKED(ONS=WP-0016)—
                                          // 'electronic' は解除後に後方互換な enum 追加として改版
}
```

- 1薬局・1日のキューは有界のため初期契約はページネーションなし(全件)。肥大が実測された場合は API-001 と同型の cursor を改版で追加する。
- キューの並びは **acceptedAt 昇順 + receptionId 昇順の安定順序**を契約とする(acceptedAt 同値時も決定的な順序 — テストの安定性と表示の再現性のため。並び替えはクライアント責務)。

### POST /reception

- ボディ: `{ patientId: string, idempotencyKey: string }`
- `acceptedAt`・`receptionId` はサーバー採番。`receptionStatus` は `WAITING` で開始。
- **idempotencyKey の制約**: 非空・空白のみ/制御文字を拒否・最大128文字。**キーに患者情報(氏名・患者番号等の PHI)を使わない**(クライアント生成の不透明キー — UUID 等 — とする)。
- **冪等性**: idempotencyKey は必須(受付窓口の二重操作は現実的リスク)。一意性境界は (tenantId, pharmacyId, idempotencyKey)。
  - 同一 key + **同一 patientId** の再送 → 新規作成せず既存エントリを 200 で返す(重複受付の fail-closed 防止)。
  - 同一 key + **異なる patientId** → **409 + `RCV-0003`**(idempotency conflict)。誤患者のエントリを返さない(fail-closed)。実装は payload(patientId)を key と併せて保存し不一致を検出する。
- レスポンス(201 / 冪等再送時 200): 登録された ReceptionQueueEntry。

## 3. 認可・テナント境界(API-003 準拠)

- **GET: `reception:read` + `patient:read` 併須 / POST: `reception:write` + `patient:read` 併須**
  (requirePermission — deny-by-default)。ReceptionQueueEntry.patient は PHI(氏名・カナ・生年月日・
  患者番号・資格状態)を含むため、reception scope 単独では患者 PHI を読めない設計とする
  (codex 実装可能性レビューの指摘1を採用。POST もレスポンスに PatientSummary を返すため併須)。
- **PERMISSION_RESOURCES への `reception` 追加は実装済み**(WP-3009-BE/93aefa1。現行 15 リソース)。
  shared-kernel の追加+MOD-007 の改版は本契約 APPROVED と同一バッチで完了済み。
- UIX-007 の SCR-001 仮 scope(patient:read)は本契約で reception:read + patient:read 併須へ置換する(台帳更新)。
- テナント境界拘束・PHI レスポンスの `Cache-Control: no-store`・平文ログ禁止は API-003 §2 に従う。

## 4. PatientSummary(患者表示情報 — 再利用)

`PatientSummary` は API-001 の `PatientSearchResult` と**同一形状・同一 zod オブジェクトを再利用**する
(patientId / name / kana / birthDate / sex / patientNumber / eligibilityStatus / eligibilityCheckedAt)。
契約ローカルの類似形状を新設しない(二重実装禁止)。資格確認状態を受付キュー時点でも隠さない(v0.2.0 §7)。

## 5. 受付状態(ReceptionStatus)

調査結果: shared-kernel / MOD-005 / DOM-004 に受付キュー専用の状態は現存しない
(DOM-004 の RECEIVED_PROVISIONAL 等は処方箋ライフサイクルの状態であり、キュー管理とは別概念)。

本契約が要求する最小 enum(**値の正本は shared-kernel — 契約ローカル定義禁止**):

| 値 | 意味 |
|---|---|
| WAITING | 受付済み・未着手 |
| IN_PROGRESS | 調剤・服薬指導等の対応中 |
| COMPLETED | 当日対応完了 |
| CANCELLED | 取消(エントリは削除せず保持 — P-12。取消理由の記録様式は会計・調剤系 SSOT に委譲) |

**実装状態: MOD-005(status_registry)の改版で `RECEPTION_STATUSES` を台帳追加し、
shared-kernel へ同一バッチで実装済み**(WP-3009-BE/93aefa1。CAL-007 が定める「新ステータスは SSOT 承認+MOD-005 改版後まで
実装コードへ追加禁止」の規律と同型 — 台帳と shared-kernel の原子的着地)。
未知状態の扱いは fail-closed(契約 parse で拒否)。キュー状態は請求可否判定(isClaimable)に関与しない。

## 6. エラー

- 400: 検証失敗の全ケース(date 欠落/形式不正/非実在暦日、patientId 不正、idempotencyKey 欠落/形式不正)→ `RCV-0001`(invalid reception request)
- 403: scope 不足(AUTH-0003、既存)
- 404: patientId が当該テナントに存在しない → `RCV-0002`(patient not found for reception)。テナント越え探索を許さない(存在有無の応答もテナント内に限定)。
- 409: idempotencyKey conflict(同一 key + 異なる patientId)→ `RCV-0003`(idempotency conflict)
- **エラーコードの体系: domain は `RECEPTION`、code prefix は `RCV`**(「domain RCV」ではない — 現行 shared-kernel の ErrorDomain 体系に従い、MOD-006 に「RECEPTION domain は RCV prefix を使用する」旨を明記して登録済み)。`RCV-0001/0002/0003` は MOD-006 + shared-kernel KERNEL_ERROR_CODES へ登録済み(WP-3009-BE/93aefa1)。WP-4036 以降、registry 未登録 errorCode は契約 parse で fail-closed に落ちる。
- キュー0件は 200 + 空配列(エラーではない)。

## 7. 実装規律と着地順(DoR)

実装の着地順は次のとおりとし、各段の前提が揃うまで次へ進まない(原子的着地):

1. 本契約 v0.2.0 の APPROVED(完了)
2. **同一 WP で** MOD-007(PERMISSION_RESOURCES へ `reception` 追加)/ MOD-005(`RECEPTION_STATUSES` 4値の台帳追加)/ MOD-006(`RCV-0001/0002/0003` + RECEPTION domain の RCV prefix 明記)の各改版 **+** shared-kernel 実装(permissions.ts / status.ts / error-codes.ts / branded `ReceptionId` factory)(WP-3009-BE/93aefa1 で完了)
3. @yrese/contracts の schema 追加 + OpenAPI 生成(check:openapi ドリフト再生成)(WP-3009-BE/93aefa1 で完了)
4. apps/api(ReceptionRepository + routes)(WP-3009-BE/93aefa1 で完了)
5. apps/web(SCR-001 受付ダッシュボード)(WP-3009-UI)

- zod schema は @yrese/contracts に置き(単一契約 — API-002)、frontend は契約外フィールドを仮定しない。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由(API-001 §5 と同一)。
- 受付の登録・状態変更・取消は監査イベント対象(MOD-008 の文法に従う種別を実装 WP で台帳追加)。
- fixtures は完全合成データのみ(MOD-013)。
- **本契約は APPROVED 後に実装する**。backend 側(shared-kernel / contracts / apps/api)は WP-3009-BE/93aefa1 で実装済み。frontend 側は WP-3009-UI の対象。

## 変更履歴

- 0.2.1 (2026-07-09): WP-4049 実装状態 drift 整備。WP-3009-BE/93aefa1 による shared-kernel / contracts / OpenAPI / apps/api の backend 実装完了状態を反映。契約の要求・wire 形状は不変更。
- 0.2.0 (2026-07-09): codex 実装可能性レビュー(CONTRACT_REVIEW)の指摘5点+安定順序を反映 — GET/POST とも patient:read 併須、idempotencyKey 制約と 409/RCV-0003 の conflict 定義、domain RECEPTION / prefix RCV への訂正、shared-kernel 原子的着地の DoR 精緻化(リソース数14に訂正・ReceptionId factory 追加)、date の実在暦日検証、acceptedAt+receptionId の安定順序。
- 0.1.0 (2026-07-09): 初版起案(WP-3009 第一段階)。
