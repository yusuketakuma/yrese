# reception_queue_contract — 受付キュー API 契約

```yaml
ssot_id: API-006
title: 受付キュー API 契約(GET /reception/queue, POST /reception)
domain: api
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [UIX-007(SCR-001), UIX-006(業務導線), API-001 v0.2.2(様式先例), API-003(公開API共通土台)]
depends_on: [API-001, API-002, API-003, DOM-004(処方ライフサイクルとの分界), MOD-005(状態台帳 — 改版前提), MOD-011(date-time policy)]
impacts: [packages/contracts, apps/api, apps/web(WP-3009 SCR-001), packages/shared-kernel(RECEPTION_STATUSES / PERMISSION_RESOURCES 追加)]
open_questions:
  - GET の認可を reception:read と patient:read のどちらに置くか(§3。本契約は reception:read 案、codex 実装可能性レビューで確定)
  - キュー状態と DOM-004 処方ライフサイクル(RECEIVED_PROVISIONAL 等)の対応付け(処方箋取込 WP で確定)
blockers:
  - API_CONTRACT_BLOCKED: 本契約 APPROVED 前の実装禁止(API-001 §5 と同一手順)
```

## 1. 目的とスコープ

SCR-001 受付ダッシュボード(当日の受付キュー・業務起点)のための最小契約。
**受付は業務管理であり、算定・請求・点数には一切触れない**(算定系は CAL/CLM 系 SSOT の別レーン)。
DB 未導入のため、実装はリポジトリインターフェース+インメモリ合成データから始める(API-001/WP-2008 と同型)。

## 2. エンドポイント

### GET /reception/queue?date=YYYY-MM-DD

- `date` は**必須**(暗黙の「今日」をサーバー側で解決しない — MOD-011 の暗黙現在時刻禁止。既定日付は UI 側の責務)。
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
- キューの並びは acceptedAt 昇順を既定とする(並び替えはクライアント責務)。

### POST /reception

- ボディ: `{ patientId: string, idempotencyKey: string }`
- `acceptedAt`・`receptionId` はサーバー採番。`receptionStatus` は `WAITING` で開始。
- **冪等性: idempotencyKey は必須**(受付窓口の二重操作は現実的リスク)。同一 (tenant, pharmacy, idempotencyKey) の再送は新規作成せず既存エントリを 200 で返す(重複受付の fail-closed 防止)。
- レスポンス(201 / 冪等再送時 200): 登録された ReceptionQueueEntry。

## 3. 認可・テナント境界(API-003 準拠)

- GET: `reception:read` / POST: `reception:write`(requirePermission — deny-by-default)。
- **PERMISSION_RESOURCES への `reception` 追加が必要**(現行 13 リソースに存在しない)。
  shared-kernel の追加+該当レジストリ SSOT の改版を本契約 APPROVED と同一バッチで行うこと(実装前提条件)。
- UIX-007 の SCR-001 仮 scope(patient:read)は本契約で reception:read へ置換する(台帳更新)。
  患者表示情報を含むため patient:read も併須とするかは codex 実装可能性レビューで確定(open_question)。
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

**実装前提条件: MOD-005(status_registry)の改版で `RECEPTION_STATUSES` を台帳追加し、
shared-kernel へ同一バッチで実装**(CAL-007 が定める「新ステータスは SSOT 承認+MOD-005 改版後まで
実装コードへ追加禁止」の規律と同型 — 台帳と shared-kernel の原子的着地)。
未知状態の扱いは fail-closed(契約 parse で拒否)。キュー状態は請求可否判定(isClaimable)に関与しない。

## 6. エラー

- 400: 検証失敗の全ケース(date 欠落/形式不正、patientId 不正、idempotencyKey 欠落/形式不正)→ `RCV-0001`(invalid reception request)。**`RCV-0001` と domain `RCV` は実装前に error_code_registry / shared-kernel シードへ登録**(ERROR_DOMAINS への追加要否を含む)。
- 403: scope 不足(AUTH-0003、既存)
- 404: patientId が当該テナントに存在しない → `RCV-0002`(patient not found for reception)。テナント越え探索を許さない(存在有無の応答もテナント内に限定)。
- キュー0件は 200 + 空配列(エラーではない)。

## 7. 実装規律

- zod schema は @yrese/contracts に置き(単一契約 — API-002)、frontend は契約外フィールドを仮定しない。OpenAPI 生成(WP-4019)へ掲載する。
- 契約変更は CONTRACT_CHANGE_REQUEST 経由(API-001 §5 と同一)。
- 受付の登録・状態変更・取消は監査イベント対象(MOD-008 の文法に従う種別を実装 WP で台帳追加)。
- fixtures は完全合成データのみ(MOD-013)。
- **本契約は codex 実装可能性レビュー → APPROVED 後に実装**(それまで API_CONTRACT_BLOCKED)。

## 変更履歴

- 0.1.0 (2026-07-09): 初版起案(WP-3009 第一段階)。
